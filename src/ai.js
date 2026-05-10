'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LEO_AI_SYSTEM_PROMPT }  = require('./prompts/leo-ai-system');
const logger = require('./logger');

const GEMINI_MODEL       = process.env.GEMINI_MODEL       || 'gemini-2.5-flash';
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL   || 'deepseek/deepseek-chat-v3-0324:free';
const GEMINI_TIMEOUT_MS  = 25_000;
const OPENROUTER_TIMEOUT = 30_000;
const MAX_RETRIES        = 3;

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

// ── OpenRouter (fetch-based, OpenAI-compatible) ───────────────────────────────

async function callOpenRouter(history, userText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  // Convert Gemini history format → OpenAI messages
  const messages = [
    { role: 'system', content: LEO_AI_SYSTEM_PROMPT },
    ...history.map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts[0]?.text || '',
    })),
    { role: 'user', content: userText },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://leoai-production.up.railway.app',
        'X-Title':      'Leo AI LINE OA',
      },
      body: JSON.stringify({
        model:      OPENROUTER_MODEL,
        messages,
        max_tokens:  1000,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenRouter returned empty content');
    return { text, model: OPENROUTER_MODEL };
  } finally {
    clearTimeout(timer);
  }
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
      const result = await callOpenRouter(history, userText);
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
