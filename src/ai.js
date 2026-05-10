'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LEO_AI_SYSTEM_PROMPT } = require('./prompts/leo-ai-system');
const { Agent }           = require('./agent');
const { buildBrainContext } = require('./brain');
const logger              = require('./logger');

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
const geminiModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: LEO_AI_SYSTEM_PROMPT,
});

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

async function callGemini(history, userText) {
  const chat = geminiModel.startChat({ history });
  return Promise.race([
    chat.sendMessage(userText).then((r) => r.response.text()),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS),
    ),
  ]);
}

async function callGeminiWithRetry(history, userText, userId) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_GEMINI_RETRY; attempt++) {
    try {
      const text = await callGemini(history, userText);
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

function getOrAgent(model) {
  if (_orAgents.has(model)) return _orAgents.get(model);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const agent = new Agent({
    apiKey,
    model,
    systemPrompt: LEO_AI_SYSTEM_PROMPT,
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

async function callOpenRouter(history, userText, userId) {
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
      const text  = await agent.chat(orHistory, userText, userId);
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

async function generateReply(history, userText, userId) {
  const start    = Date.now();
  const tokenEst = Math.ceil((userText.length + 50) / 4);

  const brainCtx = buildBrainContext();
  const brainHistory = brainCtx
    ? [
        { role: 'user',  parts: [{ text: `[CONTEXT]\n${brainCtx}` }] },
        { role: 'model', parts: [{ text: 'รับทราบ context ปัจจุบันครับ' }] },
      ]
    : [];

  const fullHistory = [...brainHistory, ...history];

  // 1. Gemini (primary) — return immediately on success
  console.log('[AI] Using Gemini');
  try {
    const result = await callGeminiWithRetry(fullHistory, userText, userId);
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
        const result = await callOpenRouter(fullHistory, userText, userId);
        if (!result?.text?.trim()) throw new Error('OpenRouter returned empty text');
        _orExhaustedUntil = 0; // reset cache on success
        console.log(`[AI] Generated response (OpenRouter/${result.model}): "${result.text.slice(0, 60)}..."`);
        console.log('[AI] OpenRouter success');
        logger.info('Reply OK via OpenRouter', {
          userId, model: result.model, latencyMs: Date.now() - start, tokenEst, fallback: true,
        });
        return result;
      } catch (err) {
        _orExhaustedUntil = Date.now() + 30_000; // suppress OR for 30s after total failure
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
  GEMINI_MODEL,
  OPENROUTER_MODEL,
  OPENROUTER_MODELS,
};
