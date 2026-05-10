require('dotenv').config();
const express = require('express');
const {
  middleware,
  messagingApi,
  SignatureValidationFailed,
  JSONParseError,
} = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LEO_AI_SYSTEM_PROMPT } = require('./src/prompts/leo-ai-system');

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const geminiKey = process.env.GEMINI_API_KEY;

if (!channelAccessToken || !channelSecret || !geminiKey) {
  console.error('Missing env: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, GEMINI_API_KEY');
  process.exit(1);
}

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 25_000;
const LINE_MAX_TEXT = 4_900;
const MAX_HISTORY_ENTRIES = 20;
const SESSION_TTL_MS = 30 * 60 * 1000;

const client = new messagingApi.MessagingApiClient({ channelAccessToken });
const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: LEO_AI_SYSTEM_PROMPT,
});

// In-memory session store: userId -> { history, lastActive }
const sessions = new Map();
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessions) if (v.lastActive < cutoff) sessions.delete(k);
}, 5 * 60 * 1000).unref();

function getSession(userId) {
  let s = sessions.get(userId);
  if (!s) {
    s = { history: [], lastActive: Date.now() };
    sessions.set(userId, s);
  }
  return s;
}

// LINE doesn't render markdown — strip it defensively in case Gemini ignores the system prompt
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

async function generateWithTimeout(history, userText) {
  const chat = model.startChat({ history });
  return Promise.race([
    chat.sendMessage(userText).then((r) => r.response.text()),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS),
    ),
  ]);
}

async function safeReply(replyToken, texts) {
  try {
    await client.replyMessage({
      replyToken,
      messages: texts.slice(0, 5).map((text) => ({ type: 'text', text })),
    });
  } catch (err) {
    console.error(`[reply] ${err.message}`);
  }
}

async function handleEvent(event) {
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
  const session = getSession(userId);
  session.lastActive = Date.now();

  let raw;
  try {
    raw = await generateWithTimeout(session.history, event.message.text);
  } catch (err) {
    console.error(`[gemini] ${err.message}`);
    const msg = /429|quota/i.test(err.message)
      ? 'ระบบ AI กำลังใช้งานเยอะครับ ขอลองใหม่อีก 1 นาที'
      : 'ขออภัยครับ เกิดข้อผิดพลาดชั่วคราว ลองพิมพ์ใหม่อีกครั้งได้เลย';
    return safeReply(event.replyToken, [msg]);
  }

  if (!raw || !raw.trim()) {
    return safeReply(event.replyToken, [
      'ขออภัยครับ ตอนนี้ตอบให้ไม่ได้ ลองถามอีกแบบได้ไหมครับ',
    ]);
  }

  const cleaned = stripMarkdown(raw);

  session.history.push(
    { role: 'user', parts: [{ text: event.message.text }] },
    { role: 'model', parts: [{ text: cleaned }] },
  );
  if (session.history.length > MAX_HISTORY_ENTRIES) {
    session.history.splice(0, session.history.length - MAX_HISTORY_ENTRIES);
  }

  return safeReply(event.replyToken, chunkForLine(cleaned));
}

const app = express();

app.get('/', (_req, res) => res.status(200).send('ok'));
app.get('/health', (_req, res) =>
  res.status(200).json({ ok: true, model: MODEL_NAME, sessions: sessions.size }),
);

app.post('/callback', middleware({ channelSecret }), (req, res) => {
  // Ack LINE immediately so a slow handler can't trigger webhook retries (and duplicate Gemini calls).
  // Reply tokens stay valid 60s independent of this response.
  res.status(200).end();
  Promise.allSettled((req.body.events || []).map(handleEvent)).catch((e) =>
    console.error('[events]', e),
  );
});

app.use((err, _req, res, _next) => {
  if (err instanceof SignatureValidationFailed) return res.status(401).end();
  if (err instanceof JSONParseError) return res.status(400).end();
  console.error('[unhandled]', err.message);
  res.status(500).end();
});

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () =>
  console.log(`Bot ready on :${PORT} (model=${MODEL_NAME})`),
);

function shutdown(signal) {
  console.log(`${signal} received, draining...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
