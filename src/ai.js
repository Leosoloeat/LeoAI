'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LEO_AI_SYSTEM_PROMPT } = require('./prompts/leo-ai-system');
const { Agent }           = require('./agent');
const { buildBrainContext } = require('./brain');
const logger              = require('./logger');

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_MODEL      = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_GEMINI_RETRY  = 3;

// Scan ALL process.env keys matching OPENROUTER_MODEL or OPENROUTER_MODEL2…N
// Sorted by numeric suffix so order is always MODEL(1st) → MODEL2 → MODEL3 …
function loadOpenRouterModels() {
  return Object.entries(process.env)
    .filter(([key]) => /^OPENROUTER_MODEL\d*$/.test(key))
    .map(([key, val]) => ({
      order: key === 'OPENROUTER_MODEL' ? 0 : parseInt(key.slice('OPENROUTER_MODEL'.length), 10) || 0,
      val:   (val || '').trim(),
    }))
    .filter(({ val }) => Boolean(val))
    .sort((a, b) => a.order - b.order)
    .map(({ val }) => val);
}

const OPENROUTER_MODELS = loadOpenRouterModels();
const OPENROUTER_MODEL  = OPENROUTER_MODELS[0] || 'none';

console.log('[AI] Gemini model:', GEMINI_MODEL);
console.log('[AI] OpenRouter models:', OPENROUTER_MODELS);

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
  return 'UNKNOWN';
}

// ── Provider cooldown — prevent hammering failed models ───────────────────────

const _cooldownMap = new Map(); // model -> cooldownUntil (ms)

const COOLDOWN_MS = {
  NO_ENDPOINTS: 15 * 60_000,  // 15 min — model truly unavailable
  QUOTA:         5 * 60_000,  // 5 min  — quota exhausted
  AUTH:         60 * 60_000,  // 1 hr   — bad key
  UNAVAILABLE:   3 * 60_000,  // 3 min  — transient server error
  TIMEOUT:       1 * 60_000,  // 1 min  — network issue
  UNKNOWN:       2 * 60_000,  // 2 min  — unknown
};

function setCooldown(model, kind) {
  const ms = COOLDOWN_MS[kind] || COOLDOWN_MS.UNKNOWN;
  _cooldownMap.set(model, Date.now() + ms);
  console.log(`[OR] Cooldown set: ${model} for ${Math.round(ms / 60_000)}m (${kind})`);
}

function isOnCooldown(model) {
  const until = _cooldownMap.get(model);
  if (!until) return false;
  if (Date.now() > until) { _cooldownMap.delete(model); return false; }
  return true;
}

function cooldownRemainingMin(model) {
  const until = _cooldownMap.get(model);
  if (!until) return 0;
  return Math.ceil((until - Date.now()) / 60_000);
}

// When ALL models are on cooldown, remove the one expiring soonest so at
// least one attempt can be made — returns the cleared model name or null
function clearOldestCooldown() {
  if (_cooldownMap.size === 0) return null;
  let oldest = null;
  let oldestTime = Infinity;
  for (const [model, until] of _cooldownMap) {
    if (until < oldestTime) { oldestTime = until; oldest = model; }
  }
  if (oldest) {
    _cooldownMap.delete(oldest);
    console.log(`[OR] Auto-cleared oldest cooldown: ${oldest}`);
  }
  return oldest;
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
      await sleep(1_000 * Math.pow(2, attempt - 1)); // 1s → 2s → 4s
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

// Try each model in order, skip models on cooldown; auto-clear oldest if all cooling
async function callOpenRouter(history, userText, userId) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');
  if (OPENROUTER_MODELS.length === 0)   throw new Error('No OPENROUTER_MODEL env vars set');

  // Convert Gemini history → OpenAI format
  const orHistory = history.map((h) => ({
    role:    h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0]?.text || '',
  }));

  // Log active vs cooldown split before attempting
  const activeModels   = OPENROUTER_MODELS.filter((m) => !isOnCooldown(m));
  const cooldownModels = OPENROUTER_MODELS.filter((m) =>  isOnCooldown(m));
  console.log(`[OR] Active models: ${activeModels.join(', ') || 'none'}`);
  if (cooldownModels.length) {
    console.log(`[OR] Cooldown models: ${cooldownModels.map((m) => `${m}(${cooldownRemainingMin(m)}m)`).join(', ')}`);
  }

  let lastErr;
  let triedCount = 0;

  for (const model of OPENROUTER_MODELS) {
    if (isOnCooldown(model)) {
      logger.info('OR skipped (cooldown)', { userId, model, remainingMin: cooldownRemainingMin(model) });
      continue;
    }

    triedCount++;
    console.log(`[OR] Selected model: ${model}`);
    logger.info('OR trying model', { userId, model });

    try {
      const agent = getOrAgent(model);
      const text  = await agent.chat(orHistory, userText, userId);
      if (!text?.trim()) throw new Error(`${model} returned empty response`);
      console.log(`[OR] Reply success: ${model}`);
      return { text, model };
    } catch (err) {
      const kind = classifyError(err);
      console.log(`[OR] Model failed: ${model} | ${kind} | ${err.message.slice(0, 120)}`);
      logger.warn('OR model failed', { userId, model, kind, err: err.message.slice(0, 200) });
      setCooldown(model, kind);
      lastErr = err;
    }
  }

  // All models on cooldown — clear the one expiring soonest and try once
  if (triedCount === 0) {
    const cleared = clearOldestCooldown();
    if (cleared) {
      logger.warn('All OR models on cooldown — retrying with oldest', { userId, model: cleared });
      console.log(`[OR] Selected model (emergency): ${cleared}`);
      try {
        const agent = getOrAgent(cleared);
        const text  = await agent.chat(orHistory, userText, userId);
        if (!text?.trim()) throw new Error(`${cleared} returned empty response`);
        console.log(`[OR] Reply success (emergency): ${cleared}`);
        return { text, model: cleared };
      } catch (err) {
        const kind = classifyError(err);
        console.log(`[OR] Emergency attempt failed: ${cleared} | ${kind}`);
        setCooldown(cleared, kind);
        lastErr = err;
      }
    }
    throw lastErr || new Error('All OpenRouter models exhausted (all on cooldown)');
  }

  throw lastErr || new Error('All OpenRouter models exhausted');
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
      keySet: !!process.env.OPENROUTER_API_KEY,
      models: OPENROUTER_MODELS.map((m) => ({
        model:  m,
        status: isOnCooldown(m) ? `cooldown ${cooldownRemainingMin(m)}m` : 'ready',
      })),
    },
  };
}

// ── Main: Gemini → OpenRouter chain → static fallback ─────────────────────────

async function generateReply(history, userText, userId) {
  const start    = Date.now();
  const tokenEst = Math.ceil((userText.length + 50) / 4);

  // Inject brain context (memory + tasks) as prepended history
  const brainCtx = buildBrainContext();
  const brainHistory = brainCtx
    ? [
        { role: 'user',  parts: [{ text: `[CONTEXT]\n${brainCtx}` }] },
        { role: 'model', parts: [{ text: 'รับทราบ context ปัจจุบันครับ' }] },
      ]
    : [];

  const fullHistory = [...brainHistory, ...history];

  // 1. Gemini (primary, with retry)
  try {
    const result = await callGeminiWithRetry(fullHistory, userText, userId);
    logger.info('Reply OK', { userId, model: result.model, latencyMs: Date.now() - start, tokenEst });
    return result;
  } catch (err) {
    logger.warn('Gemini failed — switching to OpenRouter', {
      userId, kind: classifyError(err), err: err.message,
    });
  }

  // 2. OpenRouter chain
  if (process.env.OPENROUTER_API_KEY && OPENROUTER_MODELS.length > 0) {
    try {
      const result = await callOpenRouter(fullHistory, userText, userId);
      logger.info('Reply OK via OpenRouter', {
        userId, model: result.model, latencyMs: Date.now() - start, tokenEst, fallback: true,
      });
      return result;
    } catch (err) {
      logger.error('All OpenRouter models failed', {
        userId, err: err.message, triedModels: OPENROUTER_MODELS,
      });
    }
  }

  // 3. Static fallback — only reached if ALL providers fail
  logger.error('All AI providers failed — static response', { userId, latencyMs: Date.now() - start });
  return {
    text:  'ขออภัยครับ ระบบ AI กำลังโหลดอยู่ ลองใหม่อีกครั้งใน 1-2 นาทีนะครับ 🙏',
    model: 'static-fallback',
  };
}

module.exports = {
  generateReply,
  getSystemStatus,
  GEMINI_MODEL,
  OPENROUTER_MODEL,
  OPENROUTER_MODELS,
};
