'use strict';

const logger = require('./logger');

const TIMEOUT_MS = 10_000;
const MAX_RETRY  = 2;

// ── URL helper — support both env var names ────────────────────────────────────

function getScriptUrl() {
  return process.env.GOOGLE_SHEETS_WEBHOOK || process.env.GOOGLE_SCRIPT_URL || null;
}

// ── RAM fallback store (used when Sheets is unreachable) ──────────────────────
// Survives the request; lost on process restart.
// Prevents the bot from crashing when Sheets is unavailable.

const _ram = new Map(); // userId → [{ key, value, ts, source }]

function _ramSave(userId, key, value, source) {
  const list = _ram.get(userId) || [];
  list.push({ key, value, ts: new Date().toISOString(), source });
  _ram.set(userId, list);
}

function _ramToRow(userId, e) {
  return { timestamp: e.ts, userId, memory: `[${e.key}] ${e.value}`, source: e.source || 'ram' };
}

function _ramGet(userId, limit) {
  return (_ram.get(userId) || []).slice(-limit).map((e) => _ramToRow(userId, e));
}

function _ramSearch(userId, query) {
  const q = query.toLowerCase();
  return (_ram.get(userId) || [])
    .filter((e) => e.value.toLowerCase().includes(q) || e.key.toLowerCase().includes(q))
    .map((e) => _ramToRow(userId, e));
}

function _ramForget(userId, key) {
  const list   = _ram.get(userId) || [];
  const before = list.length;
  _ram.set(userId, list.filter((e) => e.key !== key));
  return before - (_ram.get(userId) || []).length;
}

// ── Safe HTTP helper — ALL requests use POST ───────────────────────────────────
// Apps Script GET requests with query params often trigger auth redirects (HTML).
// POST is more reliable across all network paths.

async function _post(bodyObj) {
  const url = getScriptUrl();
  if (!url) return { ok: false, reason: 'GOOGLE_SHEETS_WEBHOOK not configured' };

  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRY + 1; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method:   'POST',
        redirect: 'follow',
        headers:  { 'Content-Type': 'application/json' },
        body:     JSON.stringify(bodyObj),
        signal:   controller.signal,
      });

      const text = await res.text();

      if (text.trimStart().startsWith('<')) {
        throw new Error(
          'Apps Script returned HTML — deploy settings must be: Execute as Me + Access: Anyone'
        );
      }

      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`Invalid JSON from Apps Script: ${text.slice(0, 120)}`); }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error || text.slice(0, 80)}`);
      if (!data?.ok) throw new Error(`Apps Script error: ${data?.error || 'unknown'}`);

      return { ok: true, data };
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error('timeout (10s)') : err;
      if (attempt <= MAX_RETRY) await new Promise((r) => setTimeout(r, 600 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, reason: lastErr?.message || 'unknown error' };
}

// ── Sanitize helpers ──────────────────────────────────────────────────────────

function _sanitize(str, max) {
  return String(str || '').replace(/[\x00-\x1F]/g, ' ').trim().slice(0, max);
}

// ── saveMemory ────────────────────────────────────────────────────────────────

async function saveMemory(userId, key, value, source = 'auto') {
  const start  = Date.now();
  const safeId = _sanitize(userId, 50);
  const safeK  = _sanitize(key,    50).replace(/[\[\]]/g, '');
  const safeV  = _sanitize(value, 500);

  const result = await _post({
    action:    'appendMemory',
    timestamp: new Date().toISOString(),
    userId:    safeId,
    memory:    `[${safeK}] ${safeV}`,
    source:    _sanitize(source, 30),
  });

  const ms = Date.now() - start;

  if (result.ok) {
    console.log(`[sheets] Save OK | user=…${userId.slice(-6)} | key=${safeK} | ${ms}ms`);
    logger.info('Sheets save OK', { userId, key: safeK, source, latencyMs: ms });
  } else {
    console.warn(`[sheets] Save FAIL (${result.reason}) | ${ms}ms — RAM fallback`);
    logger.warn('Sheets save failed', { userId, key: safeK, reason: result.reason, latencyMs: ms });
    _ramSave(userId, safeK, safeV, source);
  }

  return result;
}

// Backward-compat wrapper (used by legacy code)
async function saveMemoryToSheets(userId, memory, source = '/remember') {
  return saveMemory(userId, 'note', memory, source);
}

// ── getMemory ─────────────────────────────────────────────────────────────────

async function getMemory(userId, limit = 20) {
  const start = Date.now();

  const result = await _post({ action: 'getMemoryByUser', userId, limit });

  const ms = Date.now() - start;

  if (result.ok) {
    const rows = result.data?.rows || [];
    console.log(`[sheets] Get OK | user=…${userId.slice(-6)} | rows=${rows.length} | ${ms}ms`);
    logger.info('Sheets get OK', { userId, count: rows.length, latencyMs: ms });
    return { ok: true, rows };
  }

  console.warn(`[sheets] Get FAIL (${result.reason}) | ${ms}ms — RAM fallback`);
  logger.warn('Sheets get failed', { userId, reason: result.reason, latencyMs: ms });
  return { ok: true, rows: _ramGet(userId, limit), fromRam: true };
}

// Backward-compat wrapper (returns all rows without userId filter)
async function loadMemoryFromSheets(limit = 20) {
  const result = await _post({ action: 'getMemory', limit });
  if (result.ok) return { ok: true, rows: result.data?.rows || [] };
  return { ok: false, reason: result.reason, rows: [] };
}

// ── searchMemory ──────────────────────────────────────────────────────────────

async function searchMemory(userId, query, limit = 10) {
  const start = Date.now();
  const safeQ = _sanitize(query, 200);

  const result = await _post({ action: 'searchMemory', userId, query: safeQ, limit });

  const ms = Date.now() - start;

  if (result.ok) {
    const rows = result.data?.rows || [];
    console.log(`[sheets] Search OK | user=…${userId.slice(-6)} | q="${safeQ.slice(0, 30)}" | hits=${rows.length} | ${ms}ms`);
    logger.info('Sheets search OK', { userId, query: safeQ.slice(0, 40), hits: rows.length, latencyMs: ms });
    return { ok: true, rows };
  }

  console.warn(`[sheets] Search FAIL (${result.reason}) — RAM fallback`);
  return { ok: true, rows: _ramSearch(userId, safeQ), fromRam: true };
}

// ── forgetMemory ──────────────────────────────────────────────────────────────

async function forgetMemory(userId, key) {
  const start = Date.now();
  const safeK = _sanitize(key, 50).replace(/[\[\]]/g, '');

  const result = await _post({ action: 'forgetMemory', userId, key: safeK });

  const ms = Date.now() - start;

  if (result.ok) {
    const deleted = result.data?.deleted ?? 0;
    console.log(`[sheets] Forget OK | user=…${userId.slice(-6)} | key=${safeK} | deleted=${deleted} | ${ms}ms`);
    logger.info('Sheets forget OK', { userId, key: safeK, deleted, latencyMs: ms });
    return { ok: true, deleted };
  }

  const ramDeleted = _ramForget(userId, safeK);
  console.warn(`[sheets] Forget FAIL (${result.reason}) | RAM deleted ${ramDeleted}`);
  logger.warn('Sheets forget failed', { userId, key: safeK, reason: result.reason, latencyMs: ms });
  return { ok: false, reason: result.reason, deletedFromRam: ramDeleted };
}

// ── pingSheets ────────────────────────────────────────────────────────────────

async function pingSheets() {
  const result = await _post({ action: 'ping' });
  return result.ok === true;
}

// ── saveKnowledge ─────────────────────────────────────────────────────────────
// Saves auto-detected knowledge to the Knowledge tab in Google Sheets.
// Called asynchronously after AI response — never blocks the reply.

async function saveKnowledge(entry) {
  const start = Date.now();

  const result = await _post({
    action:    'saveKnowledge',
    timestamp: entry.timestamp || new Date().toISOString(),
    userId:    _sanitize(entry.userId,  50),
    project:   _sanitize(entry.project, 50),
    type:      _sanitize(entry.type,    30),
    title:     _sanitize(entry.title,  200),
    content:   _sanitize(entry.content, 2000),
    tags:      _sanitize(entry.tags,   100),
    score:     _sanitize(entry.score,   10),
  });

  const ms = Date.now() - start;

  if (result.ok) {
    console.log(`[sheets] Knowledge saved | type=${entry.type} | score=${entry.score} | ${ms}ms`);
    logger.info('Knowledge saved to Sheets', { type: entry.type, score: entry.score, latencyMs: ms });
  } else {
    console.warn(`[sheets] Knowledge save FAIL (${result.reason}) | ${ms}ms`);
    logger.warn('Knowledge save failed', { reason: result.reason, latencyMs: ms });
  }

  return result;
}

// ── getKnowledge ──────────────────────────────────────────────────────────────

async function getKnowledge(project = null, limit = 10) {
  const start  = Date.now();
  const result = await _post({ action: 'getKnowledge', project, limit });
  const ms     = Date.now() - start;

  if (result.ok) {
    const rows = result.data?.rows || [];
    console.log(`[sheets] Knowledge get OK | project=${project || 'all'} | rows=${rows.length} | ${ms}ms`);
    return { ok: true, rows };
  }

  console.warn(`[sheets] Knowledge get FAIL (${result.reason}) | ${ms}ms`);
  return { ok: false, reason: result.reason, rows: [] };
}

// ── searchKnowledge ───────────────────────────────────────────────────────────

async function searchKnowledge(query, limit = 5) {
  const start  = Date.now();
  const safeQ  = _sanitize(query, 200);
  const result = await _post({ action: 'searchKnowledge', query: safeQ, limit });
  const ms     = Date.now() - start;

  if (result.ok) {
    const rows = result.data?.rows || [];
    console.log(`[sheets] Knowledge search OK | q="${safeQ.slice(0,30)}" | hits=${rows.length} | ${ms}ms`);
    return { ok: true, rows };
  }

  return { ok: false, reason: result.reason, rows: [] };
}

module.exports = {
  saveMemory,
  saveMemoryToSheets,
  getMemory,
  loadMemoryFromSheets,
  searchMemory,
  forgetMemory,
  pingSheets,
  getScriptUrl,
  saveKnowledge,
  getKnowledge,
  searchKnowledge,
};
