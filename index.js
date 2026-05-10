'use strict';

require('dotenv').config();

const express = require('express');
const {
  middleware,
  messagingApi,
  SignatureValidationFailed,
  JSONParseError,
} = require('@line/bot-sdk');

const { generateReply, GEMINI_MODEL, OPENROUTER_MODEL } = require('./src/ai');
const rateLimiter = require('./src/rateLimiter');
const logger      = require('./src/logger');

// ── Startup validation ────────────────────────────────────────────────────────
const REQUIRED = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET', 'GEMINI_API_KEY'];
const missing  = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[startup] OPENROUTER_API_KEY not set — OpenRouter fallback disabled');
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LINE_MAX_TEXT       = 4_900;
const MAX_HISTORY_ENTRIES = 20;
const SESSION_TTL_MS      = 30 * 60_000;

// ── LINE client ───────────────────────────────────────────────────────────────
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ── In-memory session store ───────────────────────────────────────────────────
const sessions = new Map(); // userId -> { history, lastActive }

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessions) if (v.lastActive < cutoff) sessions.delete(k);
}, 5 * 60_000).unref();

function getSession(userId) {
  let s = sessions.get(userId);
  if (!s) {
    s = { history: [], lastActive: Date.now() };
    sessions.set(userId, s);
  }
  return s;
}

// ── Text helpers ──────────────────────────────────────────────────────────────

// LINE doesn't render markdown — strip it so text reads cleanly
function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g,  '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^---+$/gm,     '')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

// Split long responses into ≤4 900-char LINE messages
function chunkForLine(text) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > LINE_MAX_TEXT && chunks.length < 4) {
    let cut = rest.lastIndexOf('\n\n', LINE_MAX_TEXT);
    if (cut < LINE_MAX_TEXT * 0.5) cut = rest.lastIndexOf('\n', LINE_MAX_TEXT);
    if (cut < LINE_MAX_TEXT * 0.5) cut = LINE_MAX_TEXT;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest.slice(0, LINE_MAX_TEXT));
  return chunks.length ? chunks : ['ขออภัยครับ ไม่มีข้อความตอบกลับ'];
}

async function safeReply(replyToken, texts) {
  try {
    await client.replyMessage({
      replyToken,
      messages: texts.slice(0, 5).map((text) => ({ type: 'text', text })),
    });
  } catch (err) {
    logger.error('LINE reply failed', { err: err.message });
  }
}

// ── Event handler ─────────────────────────────────────────────────────────────
async function handleEvent(event) {
  // New follower welcome
  if (event.type === 'follow') {
    return safeReply(event.replyToken, [
      'ขอบคุณที่เพิ่มเป็นเพื่อนครับ Leo Ai พร้อมช่วยเรื่อง LINE OA AI automation และ viral content',
      'อยากเริ่มจากเรื่องไหนครับ',
    ]);
  }

  if (event.type !== 'message') return null;

  if (event.message.type !== 'text') {
    return safeReply(event.replyToken, [
      'ตอนนี้รับเฉพาะข้อความตัวอักษรครับ พิมพ์เล่ามาได้เลย',
    ]);
  }

  const userId = event.source?.userId || 'anonymous';

  // Rate limiting — prevent spam and double-sends
  const rate = rateLimiter.check(userId);
  if (!rate.ok) {
    const msg = rate.reason === 'pending'
      ? 'กำลังประมวลผลอยู่ครับ รอแป๊บนึงนะครับ ⏳'
      : 'ส่งเร็วเกินไปครับ รอแป๊บนึงก่อนนะครับ 😊';
    return safeReply(event.replyToken, [msg]);
  }

  rateLimiter.start(userId);
  const session = getSession(userId);
  session.lastActive = Date.now();

  try {
    const { text: raw } = await generateReply(
      session.history,
      event.message.text,
      userId,
    );

    if (!raw?.trim()) {
      return safeReply(event.replyToken, [
        'ขออภัยครับ ตอนนี้ตอบให้ไม่ได้ ลองถามอีกแบบได้ไหมครับ',
      ]);
    }

    const cleaned = stripMarkdown(raw);

    // Persist conversation history for context
    session.history.push(
      { role: 'user',  parts: [{ text: event.message.text }] },
      { role: 'model', parts: [{ text: cleaned }] },
    );
    if (session.history.length > MAX_HISTORY_ENTRIES) {
      session.history.splice(0, session.history.length - MAX_HISTORY_ENTRIES);
    }

    return safeReply(event.replyToken, chunkForLine(cleaned));
  } finally {
    rateLimiter.done(userId);
  }
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

// Railway keep-alive ping
app.get('/', (_req, res) => res.status(200).send('ok'));

// Healthcheck — used by Railway and external monitors
app.get('/health', (_req, res) =>
  res.status(200).json({
    ok:      true,
    ts:      new Date().toISOString(),
    uptime:  Math.floor(process.uptime()),
    models:  { primary: GEMINI_MODEL, fallback: OPENROUTER_MODEL },
    sessions: sessions.size,
  }),
);

// LINE webhook
app.post(
  '/callback',
  middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }),
  (req, res) => {
    // Acknowledge LINE immediately — reply tokens remain valid for 60 s
    res.status(200).end();
    Promise.allSettled((req.body.events || []).map(handleEvent)).catch((e) =>
      logger.error('Event processing error', { err: e.message }),
    );
  },
);

// Error middleware
app.use((err, _req, res, _next) => {
  if (err instanceof SignatureValidationFailed) return res.status(401).end();
  if (err instanceof JSONParseError)            return res.status(400).end();
  logger.error('Unhandled express error', { err: err.message });
  res.status(500).end();
});

process.on('unhandledRejection', (r) =>
  logger.error('unhandledRejection', { err: String(r) }),
);
process.on('uncaughtException', (e) =>
  logger.error('uncaughtException', { err: e.message }),
);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 3000;
const server = app.listen(PORT, () =>
  logger.info('Bot started', { port: PORT, primary: GEMINI_MODEL, fallback: OPENROUTER_MODEL }),
);

function shutdown(sig) {
  logger.info(`${sig} received, draining...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
