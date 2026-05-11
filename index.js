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
const {
  saveMemory,
  getMemory,
  searchMemory,
  forgetMemory,
  pingSheets,
  getScriptUrl,
  loadMemoryFromSheets,
  saveKnowledge,
  getKnowledge,
} = require('./src/sheets');
const {
  searchWeb,
  detectSearchIntent,
  buildSearchContext,
  formatSearchResults,
} = require('./src/search');
const { route }                           = require('./src/router');
const { listSkills }                      = require('./src/skillRetriever');
const { listProjects }                    = require('./src/projectLoader');
const { scoreKnowledge, buildKnowledgeEntry } = require('./src/knowledgeExtractor');
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

// ── Model aliases for /use command ─────────────────────────────────────────────
const MODEL_ALIASES = {
  gemini:   'gemini',
  claude:   'anthropic/claude-3-haiku',
  deepseek: 'deepseek/deepseek-chat-v3-0324:free',
  qwen:     'qwen/qwen3-32b:free',
  auto:     null,
};

// ── Per-user model preference (persists for session lifetime) ──────────────────
const userModelPrefs = new Map(); // userId → model string | null

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
      const skillList    = listSkills();
      const projectList  = listProjects();
      const sheetsOk     = !!getScriptUrl();
      const reply = [
        `Leo AI OS — System Health`,
        `Uptime: ${s.uptime}s | Sessions: ${sessions.size}`,
        ``,
        `Gemini: ${s.gemini.model}`,
        `Key: ${s.gemini.keySet ? 'OK' : 'MISSING'}`,
        ``,
        `OpenRouter: ${s.openrouter.keySet ? 'OK' : 'MISSING'}`,
        orLines,
        ``,
        `Web Search: ${process.env.TAVILY_API_KEY ? 'OK' : 'MISSING'}`,
        `Google Sheets: ${sheetsOk ? 'OK' : 'MISSING — ใส่ GOOGLE_SHEETS_WEBHOOK'}`,
        ``,
        `Skills (${skillList.length}): ${skillList.join(', ')}`,
        `Projects (${projectList.length}): ${projectList.join(', ')}`,
        ``,
        `Commands: /skills /knowledge /remember /memory /search /news /model /use`,
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

    case '/sheetstatus': {
      const sheetUrl = getScriptUrl();
      if (!sheetUrl) {
        return safeReply(replyToken, [
          'ยังไม่ได้ตั้งค่า Google Sheets ครับ\nเพิ่ม GOOGLE_SHEETS_WEBHOOK ใน Railway env',
        ]);
      }
      const alive = await pingSheets();
      return safeReply(replyToken, [
        `Google Sheets: ${alive ? 'Online' : 'Offline'}`,
        `URL: ${sheetUrl.slice(0, 70)}...`,
        ``,
        `Commands: /remember /memory /forget`,
      ].join('\n'));
    }

    case '/remember': {
      if (!args) {
        return safeReply(replyToken, [
          'รูปแบบการใช้:\n/remember ข้อความ\n/remember key: ข้อความ\n\nตัวอย่าง:\n/remember ลูกค้าชอบราคาถูก\n/remember ลูกค้า: คุณสมชาย ชอบสินค้า premium',
        ]);
      }

      // Parse optional "key: value" format
      const colonIdx = args.indexOf(':');
      let memKey, memValue;
      if (colonIdx > 0 && colonIdx < 30) {
        memKey   = args.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
        memValue = args.slice(colonIdx + 1).trim();
      } else {
        memKey   = 'note';
        memValue = args;
      }

      // 1. Write to local brain file (immediate, session-visible)
      appendMemory(`[${memKey}] ${memValue}`, userId);

      // 2. Save to Sheets (persistent, survives restart)
      const saveResult = await saveMemory(userId, memKey, memValue, '/remember');
      const dest       = saveResult.ok
        ? 'บันทึก Sheets สำเร็จครับ'
        : `บันทึก local สำเร็จ (Sheets: ${saveResult.reason})`;

      return safeReply(replyToken, [
        `จำไว้แล้วครับ\nkey: ${memKey}\nvalue: ${memValue}\n\n${dest}`,
      ]);
    }

    case '/memory': {
      const { ok: mOk, rows: mRows, fromRam } = await getMemory(userId, 15);

      if (!mOk || mRows.length === 0) {
        return safeReply(replyToken, [
          'ยังไม่มี memory ของคุณครับ\nใช้ /remember เพื่อบันทึก',
        ]);
      }

      const src   = fromRam ? ' (RAM)' : ' (Sheets)';
      const lines = [
        `Memory ของคุณ (${mRows.length} รายการ)${src}`,
        '',
        ...mRows.map((r) => {
          const ts  = String(r.timestamp).slice(0, 16);
          const mem = String(r.memory).slice(0, 80);
          return `• ${ts} — ${mem}`;
        }),
        '',
        'ใช้ /forget <key> เพื่อลบ',
      ];
      return safeReply(replyToken, [lines.join('\n').slice(0, LINE_MAX_TEXT)]);
    }

    case '/forget': {
      if (!args) {
        return safeReply(replyToken, [
          'ระบุ key ที่จะลบด้วยครับ\nเช่น /forget note\n\nดู key ได้จาก /memory',
        ]);
      }
      const { ok: fOk, deleted, reason: fReason, deletedFromRam } = await forgetMemory(userId, args.trim());
      if (fOk) {
        return safeReply(replyToken, [
          deleted === 0
            ? `ไม่พบ memory ที่มี key "${args}" ครับ\nดู key ได้จาก /memory`
            : `ลบแล้วครับ\nkey: ${args}\nลบออก ${deleted} รายการจาก Sheets`,
        ]);
      }
      const ramMsg = deletedFromRam > 0 ? ` (ลบ RAM ${deletedFromRam} รายการ)` : '';
      return safeReply(replyToken, [`Sheets ไม่ตอบสนองครับ (${fReason})${ramMsg}`]);
    }

    case '/use': {
      const alias = args.trim().toLowerCase();
      if (!alias) {
        const current = userModelPrefs.get(userId) || 'auto';
        const aliasNames = Object.keys(MODEL_ALIASES).join(' | ');
        return safeReply(replyToken, [
          `Model ปัจจุบัน: ${current}`,
          ``,
          `เปลี่ยนได้: /use ${aliasNames}`,
        ].join('\n'));
      }
      if (!(alias in MODEL_ALIASES)) {
        const aliasNames = Object.keys(MODEL_ALIASES).join(', ');
        return safeReply(replyToken, [`ไม่รู้จัก model "${alias}" ครับ\nใช้ได้: ${aliasNames}`]);
      }
      const modelId = MODEL_ALIASES[alias];
      if (modelId === null) {
        userModelPrefs.delete(userId);
        return safeReply(replyToken, [`Auto mode — ระบบเลือก model ให้อัตโนมัติครับ`]);
      }
      userModelPrefs.set(userId, modelId);
      return safeReply(replyToken, [
        `สลับไปใช้ ${alias} แล้วครับ`,
        `Model: ${modelId}`,
        ``,
        `ใช้ /use auto เพื่อกลับสู่ auto mode`,
      ].join('\n'));
    }

    case '/skills': {
      const available = listSkills();
      const projects  = listProjects();
      const lines = [
        `Leo AI — Skill Library`,
        ``,
        `Skills (${available.length}):`,
        ...available.map((s) => `• ${s}`),
        ``,
        `Projects (${projects.length}):`,
        ...projects.map((p) => `• ${p}`),
        ``,
        `Router โหลดเฉพาะ skills ที่เกี่ยวข้อง — ไม่โหลดทั้งหมด`,
      ];
      return safeReply(replyToken, [lines.join('\n')]);
    }

    case '/knowledge': {
      const kLimit = 8;
      const { ok: kOk, rows: kRows } = await getKnowledge(null, kLimit);
      if (!kOk || kRows.length === 0) {
        return safeReply(replyToken, [
          'ยังไม่มี knowledge ที่บันทึกอัตโนมัติครับ\nระบบจะบันทึกเมื่อ AI ตอบด้วย knowledge ที่มีคุณค่า',
        ]);
      }
      const lines = [
        `Knowledge Base (${kRows.length} รายการล่าสุด)`,
        '',
        ...kRows.map((r) => {
          const ts    = String(r.timestamp || '').slice(0, 16);
          const title = String(r.title || r.type || '').slice(0, 60);
          const score = r.score || '?';
          return `• [${r.type || '?'}] ${title}\n  score:${score} | ${ts}`;
        }),
        '',
        'บันทึกอัตโนมัติเมื่อ score >= 3',
      ];
      return safeReply(replyToken, [lines.join('\n').slice(0, LINE_MAX_TEXT)]);
    }

    case '/search': {
      if (!args) return safeReply(replyToken, ['ใส่คำค้นหาด้วยครับ เช่น /search ราคาทอง วันนี้']);
      if (!process.env.TAVILY_API_KEY) {
        return safeReply(replyToken, ['ยังไม่ได้ตั้งค่า TAVILY_API_KEY ครับ\nสมัครที่ tavily.com แล้วใส่ใน Railway env']);
      }
      const sr  = await searchWeb(args);
      const out = formatSearchResults(args, sr, false);
      return safeReply(replyToken, [out.slice(0, LINE_MAX_TEXT)]);
    }

    case '/news': {
      const topic = args || 'Thailand news today';
      if (!process.env.TAVILY_API_KEY) {
        return safeReply(replyToken, ['ยังไม่ได้ตั้งค่า TAVILY_API_KEY ครับ\nสมัครที่ tavily.com แล้วใส่ใน Railway env']);
      }
      const nr  = await searchWeb(topic, { news: true });
      const out = formatSearchResults(topic, nr, true);
      return safeReply(replyToken, [out.slice(0, LINE_MAX_TEXT)]);
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
  const forceModel = userModelPrefs.get(userId) || null;

  // ── Router: analyze intent — select skills + project ──────────────────────
  const routeInfo = route(msgText);
  if (routeInfo.skills.length > 0 || routeInfo.project) {
    console.log(`[router] skills=[${routeInfo.skills.join(',')}] project=${routeInfo.project || 'none'} score=${routeInfo.knowledgeScore}`);
    logger.info('Router decision', { userId, skills: routeInfo.skills, project: routeInfo.project });
  }

  try {
    // ── Auto web search: inject real-time data when query needs it ─────────────
    let historyForAI = session.history;

    if (process.env.TAVILY_API_KEY && detectSearchIntent(msgText)) {
      console.log(`[search] Auto-triggered for: "${msgText.slice(0, 60)}"`);
      logger.info('Auto search triggered', { userId, query: msgText.slice(0, 60) });

      const isNews = /ข่าว|news|breaking|สถานการณ์|ล่าสุด/i.test(msgText);
      const sr     = await searchWeb(msgText, { news: isNews });

      if (sr.ok && sr.results.length > 0) {
        const ctx = buildSearchContext(msgText, sr);
        historyForAI = [
          ...session.history,
          { role: 'user',  parts: [{ text: ctx }] },
          { role: 'model', parts: [{ text: 'รับทราบข้อมูลจาก web search ครับ จะนำมาตอบคำถามนี้' }] },
        ];
        logger.info('Search context injected', { userId, hits: sr.results.length });
      }
    }

    const { text: raw } = await generateReply(historyForAI, msgText, userId, forceModel, routeInfo);

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

    // ── Auto knowledge capture (non-blocking, fire-and-forget) ─────────────
    const { score, type, shouldSave } = scoreKnowledge(msgText, cleaned, routeInfo.skills);
    if (shouldSave && getScriptUrl()) {
      const entry = buildKnowledgeEntry({
        userId,
        userText: msgText,
        aiText:   cleaned,
        skills:   routeInfo.skills,
        project:  routeInfo.project,
        score,
        type,
      });
      // Fire and forget — never delay the reply
      saveKnowledge(entry).catch((e) =>
        logger.error('Auto knowledge save error', { err: e.message }),
      );
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
