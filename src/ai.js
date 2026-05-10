'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LEO_AI_SYSTEM_PROMPT }  = require('./prompts/leo-ai-system');
const logger = require('./logger');

const GEMINI_MODEL       = process.env.GEMINI_MODEL       || 'gemini-2.5-flash';
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL   || 'deepseek/deepseek-chat-v3-0324:free';
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_RETRIES       = 3;

// Initialise Gemini client once at startup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: LEO_AI_SYSTEM_PROMPT,
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Map raw error messages to a clean error kind
function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  if (/429|quota|resource.has.been.exhausted|rate.?limit/i.test(msg)) return 'QUOTA';
  if (/401|403|api.?key|invalid.?key|permission.?denied/i.test(msg))  return 'AUTH';
  if (/timeout|aborted|socket.hang/i.test(msg))                        return 'TIMEOUT';
  if (/503|502|service.unavailable/i.test(msg))                        return 'UNAVAILABLE';
  return 'UNKNOWN';
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
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await callGemini(history, userText);
      return { text, model: GEMINI_MODEL };
    } catch (err) {
      lastErr = err;
      const kind = classifyError(err);
      logger.warn('Gemini attempt failed', { userId, attempt, kind, err: err.message });

      // Auth errors will never recover — bail immediately
      if (kind === 'AUTH') break;
      if (attempt === MAX_RETRIES) break;

      // Exponential backoff: 1 s → 2 s → 4 s
      await sleep(1_000 * Math.pow(2, attempt - 1));
    }
  }
  throw lastErr;
}

// ── OpenRouter Agent (via @openrouter/sdk + EventEmitter) ────────────────────

const { Agent } = require('./agent');

// Lazy-init: only create agent if key is present
let _orAgent = null;
function getOrAgent() {
  if (_orAgent) return _orAgent;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  _orAgent = new Agent({
    apiKey,
    model:        OPENROUTER_MODEL,
    systemPrompt: LEO_AI_SYSTEM_PROMPT,
    siteUrl:      'https://leoai-production.up.railway.app',
    siteName:     'Leo AI LINE OA',
  });

  // Wire agent events → logger
  _orAgent.on('thinking:start', ({ userId, model }) =>
    logger.info('OpenRouter thinking', { userId, model }),
  );
  _orAgent.on('tool:call',   ({ userId, name })   => logger.info('Tool call',   { userId, name }));
  _orAgent.on('tool:result', ({ userId, name })   => logger.info('Tool result', { userId, name }));
  _orAgent.on('error',       ({ userId, err })    => logger.error('Agent error', { userId, err }));

  return _orAgent;
}

async function callOpenRouter(history, userText, userId) {
  const agent = getOrAgent();

  // Convert Gemini history format → OpenAI messages
  const orHistory = history.map((h) => ({
    role:    h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0]?.text || '',
  }));

  const text = await agent.chat(orHistory, userText, userId);
  if (!text) throw new Error('OpenRouter returned empty content');
  return { text, model: OPENROUTER_MODEL };
}

// ── Main entry: Gemini → OpenRouter → static fallback ────────────────────────

async function generateReply(history, userText, userId) {
  const start    = Date.now();
  const tokenEst = Math.ceil((userText.length + 50) / 4);

  // 1. Gemini (with exponential-backoff retry)
  try {
    const result = await callGeminiWithRetry(history, userText, userId);
    logger.info('AI reply', { userId, model: result.model, latencyMs: Date.now() - start, tokenEst });
    return result;
  } catch (err) {
    logger.warn('Gemini exhausted — switching to OpenRouter', {
      userId, kind: classifyError(err), err: err.message,
    });
  }

  // 2. OpenRouter fallback
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const result = await callOpenRouter(history, userText, userId);
      logger.info('AI reply via OpenRouter', {
        userId, model: result.model, latencyMs: Date.now() - start, tokenEst, fallback: true,
      });
      return result;
    } catch (err) {
      logger.error('OpenRouter also failed', { userId, err: err.message });
    }
  }

  // 3. Emergency static response — keeps LINE conversation alive
  logger.error('All AI providers failed', { userId, latencyMs: Date.now() - start });
  return {
    text:  'ขออภัยครับ ระบบ AI กำลังโหลดอยู่ ลองใหม่อีกครั้งใน 1-2 นาทีนะครับ 🙏',
    model: 'static-fallback',
  };
}

module.exports = { generateReply, GEMINI_MODEL, OPENROUTER_MODEL };
