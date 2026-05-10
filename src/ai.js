'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LEO_AI_SYSTEM_PROMPT } = require('./prompts/leo-ai-system');
const { Agent }  = require('./agent');
const logger     = require('./logger');

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_MODEL      = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_RETRIES       = 3;

// Explicit list — no string manipulation, no accidental "KEY=value" prepend
function loadOpenRouterModels() {
  return [
    process.env.OPENROUTER_MODEL,
    process.env.OPENROUTER_MODEL2,
    process.env.OPENROUTER_MODEL3,
  ]
    .filter(Boolean)          // remove undefined / null / empty string
    .map((m) => m.trim());    // strip accidental whitespace
}

const OPENROUTER_MODELS = loadOpenRouterModels();

// Startup: print resolved model list so Railway logs show actual values immediately
console.log('[AI] OpenRouter models loaded:', OPENROUTER_MODELS);

// Export primary fallback model name for /health endpoint
const OPENROUTER_MODEL = OPENROUTER_MODELS[0] || 'none';

// ── Gemini client ─────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: LEO_AI_SYSTEM_PROMPT,
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  if (/429|quota|resource.has.been.exhausted|rate.?limit/i.test(msg)) return 'QUOTA';
  if (/401|403|api.?key|invalid.?key|permission.?denied/i.test(msg))  return 'AUTH';
  if (/timeout|aborted|socket.hang/i.test(msg))                        return 'TIMEOUT';
  if (/503|502|service.unavailable/i.test(msg))                        return 'UNAVAILABLE';
  return 'UNKNOWN';
}

// ── Gemini: retry with exponential backoff ────────────────────────────────────

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
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await callGemini(history, userText);
      return { text, model: GEMINI_MODEL };
    } catch (err) {
      lastErr = err;
      const kind = classifyError(err);
      logger.warn('Gemini attempt failed', { userId, attempt, kind, err: err.message });

      if (kind === 'AUTH') break;           // wrong key — no point retrying
      if (attempt === MAX_RETRIES) break;

      await sleep(1_000 * Math.pow(2, attempt - 1)); // 1s → 2s → 4s
    }
  }
  throw lastErr;
}

// ── OpenRouter: one Agent instance per model (lazy, cached) ──────────────────

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

  // Wire agent lifecycle events → structured logger
  agent.on('thinking:start', ({ userId, model: m }) =>
    logger.info('OR thinking',   { userId, model: m }),
  );
  agent.on('tool:call',   ({ userId, name })  => logger.info('OR tool call',   { userId, name }));
  agent.on('tool:result', ({ userId, name })  => logger.info('OR tool result', { userId, name }));
  agent.on('error',       ({ userId, err })   => logger.error('OR agent error', { userId, err }));

  _orAgents.set(model, agent);
  return agent;
}

// Try each OPENROUTER_MODEL* in order; log real errors at each step
async function callOpenRouter(history, userText, userId) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');
  if (OPENROUTER_MODELS.length === 0)   throw new Error('No OPENROUTER_MODEL env vars configured');

  // Convert Gemini history format → OpenAI messages
  const orHistory = history.map((h) => ({
    role:    h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0]?.text || '',
  }));

  let lastErr;
  for (const model of OPENROUTER_MODELS) {
    // console.log for Railway raw logs — visible even before JSON logger
    console.log(`[OR] Trying model: ${model}`);
    logger.info('OR trying model', { userId, model });
    try {
      const agent = getOrAgent(model);
      const text  = await agent.chat(orHistory, userText, userId);
      if (!text?.trim()) throw new Error(`${model} returned empty response`);
      console.log(`[OR] Success: ${model}`);
      return { text, model };
    } catch (err) {
      const kind = classifyError(err);
      console.log(`[OR] Failed: ${model} | ${kind} | ${err.message}`);
      logger.warn('OR model failed', { userId, model, kind, err: err.message });
      lastErr = err;
    }
  }

  throw lastErr || new Error('All OpenRouter models exhausted');
}

// ── Main: Gemini → OpenRouter chain → static fallback ────────────────────────

async function generateReply(history, userText, userId) {
  const start    = Date.now();
  const tokenEst = Math.ceil((userText.length + 50) / 4);

  // 1. Gemini (primary)
  try {
    const result = await callGeminiWithRetry(history, userText, userId);
    logger.info('Reply OK', {
      userId, model: result.model, latencyMs: Date.now() - start, tokenEst,
    });
    return result;
  } catch (err) {
    logger.warn('Gemini failed — trying OpenRouter chain', {
      userId, kind: classifyError(err), err: err.message,
    });
  }

  // 2. OpenRouter chain (model1 → model2 → …)
  if (process.env.OPENROUTER_API_KEY && OPENROUTER_MODELS.length > 0) {
    try {
      const result = await callOpenRouter(history, userText, userId);
      logger.info('Reply OK via OpenRouter', {
        userId, model: result.model, latencyMs: Date.now() - start, tokenEst, fallback: true,
      });
      return result;
    } catch (err) {
      logger.error('All OpenRouter models failed', {
        userId, err: err.message, models: OPENROUTER_MODELS,
      });
    }
  }

  // 3. Static fallback — keeps LINE conversation alive
  logger.error('All AI providers failed — static response', {
    userId, latencyMs: Date.now() - start,
  });
  return {
    text:  'ขออภัยครับ ระบบ AI กำลังโหลดอยู่ ลองใหม่อีกครั้งใน 1-2 นาทีนะครับ 🙏',
    model: 'static-fallback',
  };
}

module.exports = { generateReply, GEMINI_MODEL, OPENROUTER_MODEL, OPENROUTER_MODELS };
