'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Agent }              = require('./agent');
const { getSystemPrompt, buildBrainContext } = require('./brain');
const { loadSkills }         = require('./skillRetriever');
const { loadProjectContext } = require('./projectLoader');
const logger                 = require('./logger');

// System prompt is loaded lazily — getSystemPrompt() is called at request time,
// not at module load time, so /reload immediately affects subsequent AI calls.
// Log at startup to confirm brain files are readable.
console.log(`[AI] System prompt ready (lazy) — brain chars: ${getSystemPrompt().length}`);

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_MODEL      = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 12_000;
const MAX_GEMINI_RETRY  = 2;

/**
 * Parse OpenRouter model list from env vars.
 * Supports three formats — all deduplicated and comma-safe:
 *   1. OPENROUTER_MODELS=a,b,c           (plural, comma-separated)
 *   2. OPENROUTER_MODEL=a,b,c            (singular, comma-separated)
 *   3. OPENROUTER_MODEL=a  OPENROUTER_MODEL2=b … (numbered, one per var)
 * Any single env var may contain multiple models joined by commas.
 */
function loadOpenRouterModels() {
  const seen   = new Set();
  const result = [];

  // Always split by comma so "a,b,c" in ONE var → three separate models
  function addRaw(raw) {
    (raw || '').split(',').forEach((s) => {
      const v = s.trim();
      if (!v) return;
      if (v.includes(',')) {
        throw new Error(`[OR] Parsing error: model entry still contains comma after split: "${v}"`);
      }
      if (!seen.has(v)) { seen.add(v); result.push(v); }
    });
  }

  // Format 1: OPENROUTER_MODELS=a,b,c  (plural key)
  if (process.env.OPENROUTER_MODELS) addRaw(process.env.OPENROUTER_MODELS);

  // Format 2+3: OPENROUTER_MODEL / OPENROUTER_MODEL2 … (singular key, numbered)
  Object.entries(process.env)
    .filter(([key]) => /^OPENROUTER_MODEL\d*$/.test(key))
    .map(([key, val]) => ({
      order: key === 'OPENROUTER_MODEL' ? 0 : parseInt(key.slice('OPENROUTER_MODEL'.length), 10) || 0,
      val,
    }))
    .sort((a, b) => a.order - b.order)
    .forEach(({ val }) => addRaw(val));

  return result;
}

const OPENROUTER_MODELS = loadOpenRouterModels();
const OPENROUTER_MODEL  = OPENROUTER_MODELS[0] || 'none';

// ── Role models for smart pre-routing ─────────────────────────────────────────
// These are tried FIRST for matching intent before falling to the general chain.
// Set in .env — omit to disable that role's pre-routing (falls back to Gemini).
const REASONING_MODEL = process.env.OPENROUTER_REASONING_MODEL || ''; // claude-haiku
const CODE_MODEL      = process.env.OPENROUTER_CODE_MODEL      || (OPENROUTER_MODELS[0] || '');

// Startup validation — catch any entry that still contains a comma
OPENROUTER_MODELS.forEach((m) => {
  if (m.includes(',')) {
    throw new Error(`[OR] Parsing error: model entry contains comma: "${m}" — check OPENROUTER_MODEL* env vars`);
  }
});

console.log('[AI] Gemini model:', GEMINI_MODEL);
console.log('[OR] Parsed models:', OPENROUTER_MODELS);
console.log('[OR] Model count:', OPENROUTER_MODELS.length);

// ── Gemini client ─────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Lazy model cache — rebuilt whenever the system prompt changes (e.g. after /reload).
// getSystemPrompt() has its own 30-second TTL; after reloadBrain() clears the cache
// the next call returns the freshly-loaded prompt and triggers a model rebuild here.
let _geminiModelCache = null; // { prompt: string, model: GenerativeModel }

function getGeminiModel() {
  const prompt = getSystemPrompt();
  if (!_geminiModelCache || _geminiModelCache.prompt !== prompt) {
    _geminiModelCache = {
      prompt,
      model: genAI.getGenerativeModel({
        model:             GEMINI_MODEL,
        systemInstruction: prompt,
      }),
    };
    console.log('[AI] Gemini model rebuilt (prompt changed)');
  }
  return _geminiModelCache.model;
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  if (/no endpoints|no available|provider.*unavailable|model.*not.*found/i.test(msg)) return 'NO_ENDPOINTS';
  if (/429|quota|resource.has.been.exhausted|rate.?limit/i.test(msg))                return 'QUOTA';
  if (/401|403|api.?key|invalid.?key|permission.?denied/i.test(msg))                 return 'AUTH';
  if (/timeout|aborted|socket.hang/i.test(msg))                                       return 'TIMEOUT';
  if (/503|502|service.unavailable/i.test(msg))                                       return 'UNAVAILABLE';
  if (/404/i.test(msg))                                                                return 'NO_ENDPOINTS';
  if (/fetch failed|econnrefused|econnreset|enotfound|network|dns/i.test(msg))        return 'NETWORK';
  return 'UNKNOWN';
}

// ── Per-model cooldown ────────────────────────────────────────────────────────

const _cooldownMap = new Map(); // model -> expiresAt (ms)

const COOLDOWN_MS = {
  NO_ENDPOINTS:  3 * 60_000,  //  3 min — 404 / model not found (free models go down often)
  QUOTA:            90_000,   // 90 sec — 429 rate limit
  AUTH:         60 * 60_000,  //  1 hr  — bad key (no point retrying)
  UNAVAILABLE:      30_000,   // 30 sec — temporary overload
  TIMEOUT:          15_000,   // 15 sec — network timeout
  NETWORK:               0,   //  0 sec — network error, retry next model immediately
  UNKNOWN:          60_000,   //  1 min — unknown error
};

function _msToStr(ms) {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)}m` : `${Math.round(ms / 1_000)}s`;
}

function setCooldown(model, kind) {
  const ms = COOLDOWN_MS[kind] ?? COOLDOWN_MS.UNKNOWN;
  if (ms === 0) {
    console.log(`[OR] No cooldown for ${model} (${kind}) — retry next model immediately`);
    return;
  }
  _cooldownMap.set(model, Date.now() + ms);
  console.log(`[OR] cooldown set:\n  model=${model}\n  reason=${kind}\n  duration=${_msToStr(ms)}`);
  logger.warn('OR cooldown set', { model, reason: kind, duration: _msToStr(ms) });
}

function clearCooldown(model) {
  if (_cooldownMap.has(model)) {
    _cooldownMap.delete(model);
    console.log(`[OR] Cooldown cleared: ${model} (success)`);
  }
}

function isOnCooldown(model) {
  const until = _cooldownMap.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    _cooldownMap.delete(model);
    console.log(`[OR] cooldown expired: ${model} → ready`);
    return false;
  }
  return true;
}

function cooldownRemainingStr(model) {
  const until = _cooldownMap.get(model);
  if (!until) return '0s';
  return _msToStr(Math.max(0, until - Date.now()));
}

// ── Per-model health scoring ──────────────────────────────────────────────────

const _healthMap = new Map(); // model -> { wins, losses }

function recordWin(model) {
  const h = _healthMap.get(model) || { wins: 0, losses: 0 };
  h.wins++;
  _healthMap.set(model, h);
}

function recordLoss(model) {
  const h = _healthMap.get(model) || { wins: 0, losses: 0 };
  h.losses++;
  _healthMap.set(model, h);
}

function healthScore(model) {
  const h = _healthMap.get(model);
  if (!h || h.wins + h.losses === 0) return 0.5;
  return h.wins / (h.wins + h.losses);
}

// Permanently broken = 0 wins after ≥10 consecutive losses (free models are unreliable — be lenient)
function isPermanentlyBroken(model) {
  const h = _healthMap.get(model);
  return !!h && h.wins === 0 && h.losses >= 10;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Gemini ────────────────────────────────────────────────────────────────────

// imageData: { mimeType: string, data: string (base64) } | null
async function callGemini(history, userText, imageData = null, maxTokens = 1000) {
  const chat    = getGeminiModel().startChat({
    history,
    generationConfig: { maxOutputTokens: maxTokens },
  });
  const timeout = imageData ? 25_000 : GEMINI_TIMEOUT_MS;

  const message = imageData
    ? [{ text: userText }, { inlineData: imageData }]
    : userText;

  return Promise.race([
    chat.sendMessage(message).then((r) => r.response.text()),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Gemini timeout')), timeout),
    ),
  ]);
}

async function callGeminiWithRetry(history, userText, userId, imageData = null, maxTokens = 1000) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_GEMINI_RETRY; attempt++) {
    try {
      const text = await callGemini(history, userText, imageData, maxTokens);
      return { text, model: GEMINI_MODEL };
    } catch (err) {
      lastErr = err;
      const kind = classifyError(err);
      logger.warn('Gemini attempt failed', { userId, attempt, kind, err: err.message });
      if (kind === 'AUTH') break;
      if (attempt === MAX_GEMINI_RETRY) break;
      await sleep(1_000 * Math.pow(2, attempt - 1));
    }
  }
  throw lastErr;
}

// ── OpenRouter agents (one per model, lazy cached) ────────────────────────────

const _orAgents = new Map();

/**
 * Clears all cached AI model instances so the next call rebuilds them with
 * the freshly-loaded system prompt. Call this immediately after reloadBrain().
 */
function clearAgentCache() {
  _orAgents.clear();
  _geminiModelCache = null;
  console.log('[AI] Agent cache cleared — next call will rebuild with fresh prompt');
}

function getOrAgent(model) {
  if (_orAgents.has(model)) return _orAgents.get(model);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const agent = new Agent({
    apiKey,
    model,
    systemPrompt: getSystemPrompt(), // always read current prompt, not module-load snapshot
    siteUrl:      'https://leoai-production.up.railway.app',
    siteName:     'Leo AI LINE OA',
  });

  agent.on('thinking:start', ({ userId: uid, model: m }) =>
    logger.info('OR thinking', { userId: uid, model: m }),
  );
  agent.on('error', ({ userId: uid, err }) =>
    logger.error('OR agent error', { userId: uid, err }),
  );

  _orAgents.set(model, agent);
  return agent;
}

async function callOpenRouter(history, userText, userId, maxTokens = 1000) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');
  if (OPENROUTER_MODELS.length === 0)   throw new Error('No OPENROUTER_MODEL env vars set');

  // Convert Gemini history → OpenAI format
  const orHistory = history.map((h) => ({
    role:    h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0]?.text || '',
  }));

  // Build candidates: skip cooldown + permanently broken, sort by health score descending
  const candidates = OPENROUTER_MODELS.filter((m) => {
    if (isPermanentlyBroken(m)) {
      console.log(`[OR] Skip permanently broken: ${m}`);
      return false;
    }
    if (isOnCooldown(m)) {
      console.log(`[OR] Skip cooldown: ${m} (${cooldownRemainingStr(m)} remaining)`);
      return false;
    }
    return true;
  }).sort((a, b) => healthScore(b) - healthScore(a));

  if (candidates.length === 0) {
    throw new Error('All OpenRouter models on cooldown or permanently broken');
  }

  console.log(`[OR] Candidates (${candidates.length}/${OPENROUTER_MODELS.length}): ${candidates.join(', ')}`);

  let lastErr;

  for (const model of candidates) {
    console.log(`[OR] Trying: ${model} (score=${healthScore(model).toFixed(2)})`);
    logger.info('OR trying model', { userId, model, score: healthScore(model).toFixed(2) });

    try {
      const agent = getOrAgent(model);
      const text  = await agent.chat(orHistory, userText, userId, maxTokens);
      if (!text?.trim()) throw new Error(`${model} returned empty response`);

      recordWin(model);
      clearCooldown(model);
      console.log(`[OR] Success: model=${model} score=${healthScore(model).toFixed(2)} chars=${text.length}`);
      logger.info('OR model success', { userId, model, chars: text.length, score: healthScore(model).toFixed(2) });
      return { text, model };
    } catch (err) {
      const kind = classifyError(err);
      console.log(`[OR] Failed: ${model} | ${kind} | ${err.message.slice(0, 120)}`);
      logger.warn('OR model failed', { userId, model, kind, err: err.message.slice(0, 200) });
      recordLoss(model);
      setCooldown(model, kind);
      lastErr = err;
    }
  }

  throw lastErr || new Error('All OpenRouter candidates exhausted');
}

// ── Force a single specific OR model (ignores cooldown — user chose it) ────────

async function callSingleOrModel(history, userText, userId, model, maxTokens = 1000) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const orHistory = history.map((h) => ({
    role:    h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0]?.text || '',
  }));

  console.log(`[OR] Force model: ${model}`);
  const agent = getOrAgent(model);
  const text  = await agent.chat(orHistory, userText, userId, maxTokens);
  if (!text?.trim()) throw new Error(`${model} returned empty response`);

  recordWin(model);
  clearCooldown(model);
  console.log(`[OR] Force success: ${model} (${text.length} chars)`);
  return { text, model };
}

// ── Smart pre-routing: try a role model first, respects cooldown ───────────────

async function callSpecificModel(history, userText, userId, model, maxTokens = 1000) {
  if (!model || !process.env.OPENROUTER_API_KEY) return null;
  if (isOnCooldown(model) || isPermanentlyBroken(model)) {
    console.log(`[OR] Pre-route skip (cooldown/broken): ${model}`);
    return null;
  }
  try {
    const result = await callSingleOrModel(history, userText, userId, model, maxTokens);
    logger.info('Pre-route success', { userId, model, chars: result.text.length });
    return result;
  } catch (err) {
    const kind = classifyError(err);
    recordLoss(model);
    setCooldown(model, kind);
    logger.warn('Pre-route failed', { userId, model, kind });
    return null;
  }
}

// ── System status (for /debug and /health commands) ───────────────────────────

function getSystemStatus() {
  return {
    uptime:   Math.floor(process.uptime()),
    gemini: {
      model:  GEMINI_MODEL,
      keySet: !!process.env.GEMINI_API_KEY,
    },
    openrouter: {
      keySet:     !!process.env.OPENROUTER_API_KEY,
      modelCount: OPENROUTER_MODELS.length,
      models:     OPENROUTER_MODELS.map((m) => {
        const h      = _healthMap.get(m) || { wins: 0, losses: 0 };
        const broken = isPermanentlyBroken(m);
        return {
          model:  m,   // always one model string, never comma-separated
          status: broken ? 'broken' : isOnCooldown(m) ? `cooldown ${cooldownRemainingStr(m)}` : 'ready',
          score:  healthScore(m).toFixed(2),
          wins:   h.wins,
          losses: h.losses,
        };
      }),
    },
  };
}

// ── OR exhaustion cache — avoid hammering static fallback every message ───────
// When all OR models fail together, skip OR for 30s to prevent spam.
// Resets to 0 on any successful OR reply.
let _orExhaustedUntil = 0;

// ── Main: Gemini → OpenRouter chain → static fallback ─────────────────────────

/**
 * Main reply generator.
 *
 * @param {Array}       history    - Session conversation history
 * @param {string}      userText   - User message
 * @param {string}      userId     - LINE userId
 * @param {string|null} forceModel - Forced model override
 * @param {object|null} routeInfo  - { skills, project } from router (optional)
 * @param {object|null} imageData  - { mimeType, data (base64) } — vision input (optional)
 */
async function generateReply(history, userText, userId, forceModel = null, routeInfo = null, imageData = null) {
  const start     = Date.now();
  const tokenEst  = Math.ceil((userText.length + 50) / 4);
  // Skills active → use 2000 tokens; plain chat → 1000
  const maxTokens = (routeInfo?.skills?.length > 0) ? 2000 : 1000;

  // ── Build dynamic context from routing info ──────────────────────────────────
  const contextParts = [];

  // 1. Brain context (memory + tasks) — always injected
  const brainCtx = buildBrainContext();
  if (brainCtx) contextParts.push(brainCtx);

  // 2. Skill context — only load relevant skills (never all at once)
  if (routeInfo?.skills?.length > 0) {
    const skillCtx = loadSkills(routeInfo.skills);
    if (skillCtx) contextParts.push(skillCtx);
    console.log(`[AI] Skills loaded: ${routeInfo.skills.join(', ')}`);
  }

  // 3. Project context — load matching project + shared knowledge
  if (routeInfo?.project) {
    const projectCtx = loadProjectContext(routeInfo.project);
    if (projectCtx) contextParts.push(projectCtx);
    console.log(`[AI] Project loaded: ${routeInfo.project}`);
  }

  const combinedCtx = contextParts.join('\n\n');
  const brainHistory = combinedCtx
    ? [
        { role: 'user',  parts: [{ text: `[CONTEXT]\n${combinedCtx}` }] },
        { role: 'model', parts: [{ text: 'รับทราบ context ครับ' }] },
      ]
    : [];

  const fullHistory = [...brainHistory, ...history];

  // ── IMAGE / VISION — always use Gemini (OR free models don't support vision) ──
  if (imageData) {
    console.log('[AI] Vision mode — forcing Gemini');
    try {
      const result = await callGeminiWithRetry(fullHistory, userText, userId, imageData, 2000);
      if (!result?.text?.trim()) throw new Error('empty vision response');
      logger.info('Vision reply OK', { userId, latencyMs: Date.now() - start });
      return result;
    } catch (err) {
      logger.warn('Vision call failed', { userId, err: err.message });
      return { text: 'ขออภัยครับ ไม่สามารถวิเคราะห์รูปได้ตอนนี้ ลองส่งใหม่ครับ', model: 'gemini-error' };
    }
  }

  // ── FORCED GEMINI ────────────────────────────────────────────────────────────
  if (forceModel === 'gemini') {
    console.log('[AI] Forced: Gemini');
    try {
      const result = await callGeminiWithRetry(fullHistory, userText, userId, null, maxTokens);
      if (!result?.text?.trim()) throw new Error('empty');
      logger.info('Reply OK (forced gemini)', { userId, latencyMs: Date.now() - start });
      return result;
    } catch (err) {
      logger.warn('Forced Gemini failed', { userId, err: err.message });
      return {
        text: `Gemini ตอบไม่ได้ตอนนี้ครับ (${classifyError(err)})\nใช้ /use auto แล้วลองใหม่ได้เลยครับ`,
        model: 'gemini-error',
      };
    }
  }

  // ── FORCED OPENROUTER MODEL ──────────────────────────────────────────────────
  if (forceModel && forceModel !== 'auto') {
    console.log(`[AI] Forced: ${forceModel}`);
    try {
      const result = await callSingleOrModel(fullHistory, userText, userId, forceModel, maxTokens);
      logger.info('Reply OK (forced OR)', { userId, model: forceModel, latencyMs: Date.now() - start });
      return result;
    } catch (err) {
      const kind = classifyError(err);
      console.log(`[AI] Forced model failed: ${kind} — falling back to auto`);
      logger.warn('Forced OR failed — auto routing', { userId, model: forceModel, kind });
      // Fall through to auto routing
    }
  }

  // ── SMART PRE-ROUTING — role model first for matching intents ─────────────────
  const preferredModel = routeInfo?.preferredModel;

  if (preferredModel === 'deepseek' && CODE_MODEL) {
    console.log(`[AI] Pre-route → DeepSeek (${CODE_MODEL})`);
    const result = await callSpecificModel(fullHistory, userText, userId, CODE_MODEL, maxTokens);
    if (result?.text?.trim()) {
      logger.info('Reply OK (pre-route deepseek)', { userId, model: CODE_MODEL, latencyMs: Date.now() - start });
      return result;
    }
    console.log('[AI] DeepSeek pre-route failed — falling to Gemini');
  }

  if (preferredModel === 'claude-haiku' && REASONING_MODEL) {
    console.log(`[AI] Pre-route → Claude Haiku (${REASONING_MODEL})`);
    const result = await callSpecificModel(fullHistory, userText, userId, REASONING_MODEL, maxTokens);
    if (result?.text?.trim()) {
      logger.info('Reply OK (pre-route claude-haiku)', { userId, model: REASONING_MODEL, latencyMs: Date.now() - start });
      return result;
    }
    console.log('[AI] Claude Haiku pre-route failed — falling to Gemini');
  }

  // ── AUTO ROUTING ─────────────────────────────────────────────────────────────

  // 1. Gemini (primary) — return immediately on success
  console.log('[AI] Using Gemini');
  try {
    const result = await callGeminiWithRetry(fullHistory, userText, userId, null, maxTokens);
    if (!result?.text?.trim()) throw new Error('Gemini returned empty text');
    console.log(`[AI] Generated response (Gemini): "${result.text.slice(0, 60)}..."`);
    logger.info('Reply OK', { userId, model: result.model, latencyMs: Date.now() - start, tokenEst });
    return result;
  } catch (err) {
    console.log(`[AI] Gemini failed → fallback OpenRouter (${classifyError(err)})`);
    logger.warn('Gemini failed — switching to OpenRouter', {
      userId, kind: classifyError(err), err: err.message,
    });
  }

  // 2. OpenRouter (all available models, health-sorted) — return immediately on success
  if (process.env.OPENROUTER_API_KEY && OPENROUTER_MODELS.length > 0) {
    const orSkipRemaining = _orExhaustedUntil - Date.now();
    if (orSkipRemaining > 0) {
      console.log(`[OR] Skip — all failed recently (${Math.ceil(orSkipRemaining / 1_000)}s cache)`);
    } else {
      try {
        const result = await callOpenRouter(fullHistory, userText, userId, maxTokens);
        if (!result?.text?.trim()) throw new Error('OpenRouter returned empty text');
        _orExhaustedUntil = 0;
        console.log(`[AI] Generated response (OpenRouter/${result.model}): "${result.text.slice(0, 60)}..."`);
        console.log('[AI] OpenRouter success');
        logger.info('Reply OK via OpenRouter', {
          userId, model: result.model, latencyMs: Date.now() - start, tokenEst, fallback: true,
        });
        return result;
      } catch (err) {
        _orExhaustedUntil = Date.now() + 30_000;
        logger.error('OpenRouter candidates exhausted', { userId, err: err.message });
      }
    }
  }

  // 3. Static fallback — only if ALL providers fail
  // Use varied messages so it doesn't feel robotic
  const fallbackMessages = [
    'ขออภัยครับ ระบบ AI ติดขัดชั่วคราว ลองใหม่ใน 30 วินาทีนะครับ',
    'โมเดล AI กำลังโหลดอยู่ครับ รอแป๊บนึงแล้วลองใหม่ได้เลยครับ',
    'ตอนนี้ระบบมีโหลดสูงครับ ลองถามใหม่อีกครั้งในอีกสักครู่นะครับ',
  ];
  const msg = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
  logger.error('All AI providers failed — static response', { userId, latencyMs: Date.now() - start });
  return { text: msg, model: 'static-fallback' };
}

module.exports = {
  generateReply,
  getSystemStatus,
  clearAgentCache,
  GEMINI_MODEL,
  OPENROUTER_MODEL,
  OPENROUTER_MODELS,
};
