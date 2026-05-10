'use strict';

const logger = require('./logger');

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const TIMEOUT_MS = 10_000;

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function _request(method, body, params) {
  if (!SCRIPT_URL) return { ok: false, reason: 'GOOGLE_SCRIPT_URL not configured' };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let url = SCRIPT_URL;
    if (params) url += '?' + new URLSearchParams(params).toString();

    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      body:    method === 'POST' ? JSON.stringify(body) : undefined,
      signal:  controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
    }

    return { ok: true, data: await res.json() };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Save one memory row ───────────────────────────────────────────────────────
// Fire-and-forget safe — never throws, always logs result.

async function saveMemoryToSheets(userId, memory, source = 'remember') {
  const result = await _request('POST', {
    action:    'append',
    timestamp: new Date().toISOString(),
    userId,
    memory,
    source,
  });

  if (result.ok) {
    console.log(`[sheets] Saved: userId=${userId.slice(-6)} memory="${memory.slice(0, 50)}"`);
    logger.info('Sheets save OK', { userId, source });
  } else {
    console.warn(`[sheets] Save failed (${result.reason}) — local memory still updated`);
    logger.warn('Sheets save failed', { userId, reason: result.reason });
  }

  return result;
}

// ── Load recent rows ──────────────────────────────────────────────────────────

async function loadMemoryFromSheets(limit = 20) {
  const result = await _request('GET', null, { action: 'load', limit });

  if (result.ok) {
    const rows = result.data?.rows || [];
    logger.info('Sheets load OK', { count: rows.length });
    return { ok: true, rows };
  }

  console.warn(`[sheets] Load failed (${result.reason})`);
  logger.warn('Sheets load failed', { reason: result.reason });
  return { ok: false, reason: result.reason, rows: [] };
}

module.exports = { saveMemoryToSheets, loadMemoryFromSheets };
