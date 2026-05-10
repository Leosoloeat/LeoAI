'use strict';

require('dotenv').config();

const express = require('express');
const {
  middleware,
  messagingApi,
  SignatureValidationFailed,
  JSONParseError,
} = require('@line/bot-sdk');

const {
  generateReply,
  getSystemStatus,
  GEMINI_MODEL,
  OPENROUTER_MODELS,
} = require('./src/ai');
const { loadBrain, reloadBrain, appendMemory } = require('./src/brain');
const { loadMemoryFromSheets }                 = require('./src/sheets');
const rateLimiter = require('./src/rateLimiter');
const logger      = require('./src/logger');

// ── Startup validation ─────────────────────────────────────────────────────────
const REQUIRED = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET', 'GEMINI_API_KEY'];
const missing  = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[startup] OPENROUTER_API_KEY not set — OpenRouter fallback disabled');
}

// ── Constants ──────────────────────────────────────────────────────────────────
const LINE_MAX_TEXT       = 4_900;
const MAX_HISTORY_ENTRIES = 20;
const SESSION_TTL_MS      = 30 * 60_000;

// ── LINE client ────────────────────────────────────────────────────────────────
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ── Session store ──────────────────────────────────────────────────────────────
const sessions = new Map();

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessions) if (v.lastActive < cutoff) sessions.delete(k);
}, 5 * 60_000).unref();

function getSession(userId) {
  let s = sessions.get(userId);
  if (!s) { s = { history: [], lastActive: Date.now() }; sessions.set(userId, s); }
  return s;
}

// ── Text helpers ───────────────────────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

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
  const preview = (texts[0] || '').slice(0, 60);
  console.log(`[LINE] Sending reply: "${preview}..."`);
  try {
    await client.replyMessage({
      replyToken,
      messages: texts.slice(0, 5).map((text) => ({ type: 'text', text })),
    });
    console.log('[LINE] Reply success');
    logger.info('LINE reply sent', { chars: texts.join('').length });
  } catch (err) {
    console.log(`[LINE] Reply failed: ${err.message}`);
    logger.error('LINE reply failed', { err: err.message });
  }
}

// ── Slash command handler ──────────────────────────────────────────────────────

async function handleCommand(text, replyToken, userId) {
  const cmd = text.trim().toLowerCase().split(/\s+/)[0];
  const args = text.trim().slice(cmd.length).trim();

  switch (cmd) {
    case '/health': {
      const s = getSystemStatus();
      const orLines = s.openrouter.models.length
        ? s.openrouter.models.map((m) => `• ${m.model}: ${m.status}`).join('\n')
        : '• ไม่มี model';
      const reply = [
        `Leo AI System Health`,
        `Uptime: ${s.uptime}s | Sessions: ${sessions.size}`,
        ``,
        `Gemini: ${s.gemini.model}`,
        `Key: ${s.gemini.keySet ? 'OK' : 'MISSING'}`,
        ``,
        `OpenRouter: ${s.openrouter.keySet ? 'OK' : 'MISSING'}`,
        orLines,
      ].join('\n');
      return safeReply(replyToken, [reply]);
    }

    case '/model': {
      const s = getSystemStatus();
      const ready = s.openrouter.models.filter((m) => m.status === 'ready').map((m) => m.model);
      const cooling = s.openrouter.models.filter((m) => m.status !== 'ready').map((m) => `${m.model} (${m.status})`);
      const lines = [
        `Primary: ${GEMINI_MODEL}`,
        ``,
        `Fallback ready (${ready.length}):`,
        ...ready.map((m) => `• ${m}`),
      ];
      if (cooling.length) {
        lines.push(``, `Cooldown (${cooling.length}):`, ...cooling.map((m) => `• ${m}`));
      }
      return safeReply(replyToken, [lines.join('\n')]);
    }

    case '/debug': {
      const s = getSystemStatus();
      const out = JSON.stringify(s, null, 2);
      return safeReply(replyToken, [out.slice(0, LINE_MAX_TEXT)]);
    }

    case '/brain': {
      const b = loadBrain();
      const section = (label, val) => val ? `${label}:\n${val}` : `${label}: (empty)`;
      const lines = [
        'Brain System',
        '',
        section('Personality', b.personality),
        '',
        section('Skills', b.skills),
        '',
        section('Rules', b.rules),
        '',
        section('Style', b.style),
        '',
        section('Forbidden', b.forbidden),
        '',
        section('Memory', b.memory),
      ];
      return safeReply(replyToken, [lines.join('\n').slice(0, LINE_MAX_TEXT)]);
    }

    case '/reload': {
      const b = reloadBrain();
      const loaded = Object.entries(b).filter(([, v]) => v).map(([k]) => k).join(', ');
      return safeReply(replyToken, [`Brain reloaded\nFiles: ${loaded}`]);
    }

    case '/remember': {
      if (!args) return safeReply(replyToken, ['ใส่ข้อความที่จะจำด้วยครับ เช่น /remember ลูกค้าชอบราคาถูก']);
      appendMemory(`[${userId.slice(-6)}] ${args}`, userId);
      const sheetsNote = process.env.GOOGLE_SCRIPT_URL ? ' (บันทึก Sheets ด้วย)' : '';
      return safeReply(replyToken, [`จำไว้แล้วครับ: "${args}"${sheetsNote}`]);
    }

    case '/memory': {
      if (!process.env.GOOGLE_SCRIPT_URL) {
        const b = loadBrain();
        return safeReply(replyToken, [`Memory (local)\n\n${b.memory || '(ยังไม่มี memory)'}`]);
      }
      const { ok, rows, reason } = await loadMemoryFromSheets(15);
      if (!ok) {
        return safeReply(replyToken, [`โหลด Sheets ไม่ได้ครับ (${reason})\nลอง /brain เพื่อดู local memory`]);
      }
      if (rows.length === 0) {
        return safeReply(replyToken, ['ยังไม่มี memory ใน Google Sheets ครับ\nใช้ /remember เพื่อเพิ่ม']);
      }
      const lines = [
        `Memory (${rows.length} รายการล่าสุด)`,
        '',
        ...rows.map((r) => `• ${String(r.timestamp).slice(0, 16)} — ${r.memory}`),
      ];
      return safeReply(replyToken, [lines.join('\n').slice(0, LINE_MAX_TEXT)]);
    }

    default:
      return null; // unknown command — let AI handle it
  }
}

// ── Event handler ──────────────────────────────────────────────────────────────

async function handleEvent(event) {
  if (event.type === 'follow') {
    return safeReply(event.replyToken, [
      'ขอบคุณที่เพิ่มเป็นเพื่อนครับ Leo Ai พร้อมช่วยเรื่อง LINE OA AI automation และ viral content',
      'อยากเริ่มจากเรื่องไหนครับ',
    ]);
  }

  if (event.type !== 'message') return null;

  if (event.message.type !== 'text') {
    return safeReply(event.replyToken, ['ตอนนี้รับเฉพาะข้อความตัวอักษรครับ พิมพ์เล่ามาได้เลย']);
  }

  const userId  = event.source?.userId || 'anonymous';
  const msgText = event.message.text.trim();

  // Handle slash commands first (bypass rate limiter — always fast)
  if (msgText.startsWith('/')) {
    const handled = await handleCommand(msgText, event.replyToken, userId);
    if (handled !== null) return handled;
    // null = unknown command, fall through to AI
  }

  // Rate limiting
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

  let responseSent = false;

  try {
    const { text: raw } = await generateReply(session.history, msgText, userId);

    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      if (!responseSent) {
        responseSent = true;
        return safeReply(event.replyToken, ['ขออภัยครับ ตอนนี้ตอบให้ไม่ได้ ลองถามอีกแบบได้ไหมครับ']);
      }
      return;
    }

    if (responseSent) return;
    responseSent = true;

    const cleaned = stripMarkdown(raw);

    session.history.push(
      { role: 'user',  parts: [{ text: msgText }] },
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

// ── Express app ────────────────────────────────────────────────────────────────

const app = express();

app.get('/', (_req, res) => res.status(200).send('ok'));

app.get('/health', (_req, res) => {
  const s = getSystemStatus();
  res.status(200).json({
    ok:       true,
    ts:       new Date().toISOString(),
    uptime:   s.uptime,
    sessions: sessions.size,
    models: {
      primary:   GEMINI_MODEL,
      fallbacks: s.openrouter.models,
    },
  });
});

app.post(
  '/callback',
  middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }),
  (req, res) => {
    res.status(200).end(); // ack LINE immediately
    Promise.allSettled((req.body.events || []).map(handleEvent)).catch((e) =>
      logger.error('Event processing error', { err: e.message }),
    );
  },
);

app.use((err, _req, res, _next) => {
  if (err instanceof SignatureValidationFailed) return res.status(401).end();
  if (err instanceof JSONParseError)            return res.status(400).end();
  logger.error('Unhandled express error', { err: err.message });
  res.status(500).end();
});

process.on('unhandledRejection', (r) => logger.error('unhandledRejection', { err: String(r) }));
process.on('uncaughtException',  (e) => logger.error('uncaughtException',  { err: e.message }));

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT   = process.env.PORT || 3000;
const server = app.listen(PORT, () =>
  logger.info('Bot started', { port: PORT, primary: GEMINI_MODEL, fallbacks: OPENROUTER_MODELS }),
);

function shutdown(sig) {
  logger.info(`${sig} received, draining...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
