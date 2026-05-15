'use strict';
require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { replyToLine } = require('./services/line');
const { askClaude } = require('./services/claude');

const PORT = parseInt(process.env.PORT || '3000', 10);
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// Load all context at boot — not on every request
function loadContext() {
  const read = (relPath) => {
    try {
      return fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    } catch {
      return '';
    }
  };

  const masterPrompt  = read('prompts/LeoSP_master_prompt.md');
  const knowledgeBase = read('context/notebooklm_export.md');
  const sheetsSchema  = read('context/sheets_schema.md');
  const userProfile   = read('context/user_profile.md');

  return [
    masterPrompt,
    '---',
    '## KNOWLEDGE BASE (ใช้ข้อมูลจากนี้เท่านั้น)',
    knowledgeBase,
    '---',
    '## GOOGLE SHEETS SCHEMA',
    sheetsSchema,
    '---',
    '## BRAND PROFILE',
    userProfile,
  ].join('\n\n');
}

const SYSTEM_MESSAGE = loadContext();
const LINE_MAX_CHARS = 4900; // LINE hard limit is 5000, keep buffer

// In-memory conversation history per user (last 10 turns)
// Cleared when user sends /reset or session expires after 30 min idle
const history    = new Map();
const lastActive = new Map();
const SESSION_TTL = 30 * 60_000;

function pruneIdleSessions() {
  const now = Date.now();
  for (const [uid, ts] of lastActive) {
    if (now - ts > SESSION_TTL) {
      history.delete(uid);
      lastActive.delete(uid);
    }
  }
}
setInterval(pruneIdleSessions, 5 * 60_000);

function getHistory(userId) {
  if (!history.has(userId)) history.set(userId, []);
  return history.get(userId);
}

function pushHistory(userId, role, content) {
  const h = getHistory(userId);
  h.push({ role, content });
  if (h.length > 20) h.splice(0, 2);
  lastActive.set(userId, Date.now());
}

function resetHistory(userId) {
  history.delete(userId);
  lastActive.delete(userId);
}

function truncate(text) {
  if (text.length <= LINE_MAX_CHARS) return text;
  return text.slice(0, LINE_MAX_CHARS - 20) + '\n\n[ข้อความถูกย่อ]';
}

function verifySignature(rawBody, signature) {
  const hash = crypto
    .createHmac('sha256', LINE_SECRET)
    .update(rawBody)
    .digest('base64');
  return hash === signature;
}

const app = express();

app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.path}`);
  next();
});

// Webhook — raw body required for signature verification
app.post('/webhook', express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
  if (!LINE_SECRET || !LINE_TOKEN) {
    console.error('[webhook] missing LINE env vars');
    return res.status(200).send('not configured');
  }

  let body;
  try {
    body = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).send('bad json');
  }

  // LINE verify check sends empty events — return 200 immediately
  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) return res.status(200).send('ok');

  // Verify signature
  const signature = req.get('x-line-signature') || '';
  if (!verifySignature(req.body, signature)) {
    console.warn('[webhook] invalid signature');
    return res.status(401).send('invalid signature');
  }

  res.status(200).send('ok');

  for (const event of events) {
    if (event.type !== 'message') continue;

    const userId     = event.source?.userId || 'unknown';
    const replyToken = event.replyToken;
    const msgType    = event.message?.type;

    // Handle image messages
    if (msgType === 'image') {
      try {
        await replyToLine(LINE_TOKEN, replyToken, 'ขออภัยครับ ตอนนี้รับได้เฉพาะข้อความ กรุณาพิมพ์คำถามได้เลยครับ 😊');
      } catch {}
      continue;
    }

    if (msgType !== 'text') continue;

    const userText = event.message.text?.trim() || '';
    console.log(`[webhook] user=${userId.slice(-6)} text="${userText.slice(0, 50)}"`);

    // /reset command — clear conversation history
    if (userText === '/reset') {
      resetHistory(userId);
      try {
        await replyToLine(LINE_TOKEN, replyToken, 'รีเซ็ตการสนทนาแล้วครับ เริ่มใหม่ได้เลยครับ 😊');
      } catch {}
      continue;
    }

    const userHistory = getHistory(userId);

    try {
      const raw   = await askClaude(SYSTEM_MESSAGE, userText, userHistory);
      const reply = truncate(raw);
      pushHistory(userId, 'user',      userText);
      pushHistory(userId, 'assistant', raw);
      await replyToLine(LINE_TOKEN, replyToken, reply);
      console.log(`[webhook] replied to ${userId.slice(-6)}`);
    } catch (err) {
      console.error('[webhook] error:', err.message);
      try {
        await replyToLine(LINE_TOKEN, replyToken, 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกสักครู่นะครับ');
      } catch {}
    }
  }
});

app.get('/health', (_req, res) => res.json({
  ok:       true,
  t:        Date.now(),
  sessions: history.size,
  model:    'claude-sonnet-4-6',
}));

app.listen(PORT, () => {
  console.log(`[LeoSP] listening on port ${PORT}`);
  console.log(`[LeoSP] webhook: POST /webhook`);
  if (!LINE_SECRET || !LINE_TOKEN) console.warn('[LeoSP] WARNING: LINE credentials missing');
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[LeoSP] WARNING: ANTHROPIC_API_KEY missing');
});
