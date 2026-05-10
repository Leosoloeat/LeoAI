'use strict';

const logger = require('./logger');

const TIMEOUT_MS = 10_000;

// ── Safe HTTP helper ──────────────────────────────────────────────────────────
// Always reads body as text first, then JSON.parse — never crashes on HTML.

async function _request(method, bodyObj, params) {
  const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
  if (!SCRIPT_URL) return { ok: false, reason: 'GOOGLE_SCRIPT_URL not set in env' };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let url = SCRIPT_URL;
    if (params) url += '?' + new URLSearchParams(params).toString();

    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      body:    method === 'POST' ? JSON.stringify(bodyObj) : undefined,
      signal:  controller.signal,
    });

    // Read as text FIRST — never call .json() directly (crashes on HTML responses)
    const text = await res.text();

    // Detect HTML error page (Apps Script auth/crash returns HTML)
    if (text.trimStart().startsWith('<')) {
      const hint = text.includes('ข้อผิดพลาด') || text.includes('Error')
        ? 'Apps Script returned an error page — check deployment settings (Execute as: Me, Access: Anyone)'
        : 'Apps Script returned HTML instead of JSON';
      throw new Error(hint);
    }

    // Safe JSON parse
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      throw new Error(`Invalid JSON from Apps Script: ${text.slice(0, 120)}`);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error || text.slice(0, 100)}`);

    return { ok: true, data };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, reason: 'timeout (10s)' };
    return { ok: false, reason: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Append one memory row (fire-and-forget safe) ──────────────────────────────

async function saveMemoryToSheets(userId, memory, source = '/remember') {
  const result = await _request('POST', {
    action:    'appendMemory',
    timestamp: new Date().toISOString(),
    userId,
    memory,
    source,
  });

  if (result.ok) {
    console.log(`[sheets] Saved: user=…${userId.slice(-6)} | "${memory.slice(0, 60)}"`);
    logger.info('Sheets save OK', { userId, source });
  } else {
    console.warn(`[sheets] Save failed: ${result.reason} — local file still updated`);
    logger.warn('Sheets save failed', { userId, reason: result.reason });
  }
  return result;
}

// ── Load recent memory rows ───────────────────────────────────────────────────

async function loadMemoryFromSheets(limit = 20) {
  const result = await _request('GET', null, { action: 'getMemory', limit });

  if (result.ok) {
    const rows = result.data?.rows || [];
    console.log(`[sheets] Loaded ${rows.length} rows`);
    logger.info('Sheets load OK', { count: rows.length });
    return { ok: true, rows };
  }

  console.warn(`[sheets] Load failed: ${result.reason}`);
  logger.warn('Sheets load failed', { reason: result.reason });
  return { ok: false, reason: result.reason, rows: [] };
}

// ── Ping — check if Apps Script is alive ─────────────────────────────────────

async function pingSheets() {
  const result = await _request('GET', null, { action: 'ping' });
  return result.ok && result.data?.ok === true;
}

module.exports = { saveMemoryToSheets, loadMemoryFromSheets, pingSheets };
