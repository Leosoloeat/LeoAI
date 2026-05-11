'use strict';

const { tavily } = require('@tavily/core');
const logger     = require('./logger');

const TIMEOUT_S   = 12;      // seconds — passed directly to SDK
const MAX_RETRIES = 2;
const MAX_RESULTS = 5;

// ── Lazy client ────────────────────────────────────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');
  _client = tavily({ apiKey });
  return _client;
}

// ── Auto-detect when user needs real-time web data ─────────────────────────────

const SEARCH_TRIGGERS = [
  // news & events
  /ข่าว|news|breaking|เหตุการณ์|สถานการณ์|ล่าสุด|ปัจจุบัน|อัพเดท|อัพเดต/i,
  // pricing & rates
  /ราคา|price|pricing|ค่าบริการ|เรท|rate|ค่าใช้จ่าย|cost|budget/i,
  // trends & viral
  /เทรนด์|trend|กระแส|ฮิต|viral|popular|นิยม|ดัง/i,
  // reviews & comparisons
  /รีวิว|review|เปรียบเทียบ|compare|comparison|ดีกว่า|\bvs\b|versus|แนะนำ/i,
  // nearby & local
  /ร้านใกล้|near me|ใกล้ฉัน|nearby|ในย่าน|แถวนี้|ใกล้เคียง/i,
  // real-time / today
  /วันนี้|today|ตอนนี้|\bright now\b|เดี๋ยวนี้|เมื่อกี้|เมื่อวาน|สัปดาห์นี้|เดือนนี้/i,
  // finance & crypto
  /หุ้น|stock|crypto|bitcoin|btc|ethereum|eth|ทอง|gold|forex|เงินดิจิตอล/i,
  // weather
  /อากาศ|weather|พยากรณ์|ฝน|rain|อุณหภูมิ/i,
  // sports
  /ผลบอล|ผลกีฬา|บอลวันนี้|ลีก|tournament|แชมป์/i,
  // AI & tech
  /เปิดตัวใหม่|launch|release|update.*version|โมเดลใหม่|model.*2024|model.*2025/i,
];

function detectSearchIntent(text) {
  return SEARCH_TRIGGERS.some((rx) => rx.test(text));
}

// ── Core search with retry ─────────────────────────────────────────────────────

async function _searchWithRetry(query, sdkOpts) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await getClient().search(query, sdkOpts);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1_000 * attempt));
      }
    }
  }
  throw lastErr;
}

// ── Public: searchWeb ──────────────────────────────────────────────────────────

async function searchWeb(query, opts = {}) {
  const start = Date.now();

  if (!process.env.TAVILY_API_KEY) {
    return { ok: false, reason: 'TAVILY_API_KEY not configured', results: [] };
  }

  try {
    const sdkOpts = {
      searchDepth:   'basic',
      maxResults:    opts.maxResults || MAX_RESULTS,
      includeAnswer: true,
      timeout:       opts.timeoutS || TIMEOUT_S,
    };

    if (opts.news) {
      sdkOpts.topic = 'news';
      sdkOpts.days  = opts.days || 3;
    }

    const data      = await _searchWithRetry(query, sdkOpts);
    const latencyMs = Date.now() - start;

    const results = (data.results || []).map((r) => ({
      title:   (r.title   || '').trim(),
      url:     (r.url     || '').trim(),
      content: (r.content || '').slice(0, 400).trim(),
      score:   r.score || 0,
    }));

    console.log(`[search] OK | query="${query.slice(0, 50)}" | hits=${results.length} | ${latencyMs}ms`);
    logger.info('Tavily search OK', {
      query:     query.slice(0, 60),
      hits:      results.length,
      latencyMs,
      news:      !!opts.news,
    });

    return { ok: true, answer: (data.answer || '').trim(), results };

  } catch (err) {
    const latencyMs = Date.now() - start;
    const reason    = err.message || 'unknown error';

    console.warn(`[search] FAIL | query="${query.slice(0, 50)}" | ${reason} | ${latencyMs}ms`);
    logger.warn('Tavily search failed', {
      query:     query.slice(0, 60),
      err:       reason,
      latencyMs,
      retries:   MAX_RETRIES,
    });

    return { ok: false, reason, results: [] };
  }
}

// ── Build AI context string (injected into history before generateReply) ───────

function buildSearchContext(query, { ok, answer, results, reason }) {
  if (!ok || results.length === 0) {
    return `[Web Search: ไม่พบข้อมูล — ${reason || 'no results'}]`;
  }

  const lines = [`[ข้อมูลจาก Web Search: "${query}"]`, ''];

  if (answer) lines.push(`สรุป: ${answer}`, '');

  lines.push('แหล่งข้อมูล:');
  results.slice(0, 5).forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`);
    if (r.content) lines.push(`   ${r.content.slice(0, 250)}`);
    lines.push(`   ${r.url}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ── Format for direct LINE reply (/search and /news commands) ─────────────────

function formatSearchResults(query, { ok, answer, results, reason }, isNews = false) {
  if (!ok) {
    return [
      isNews ? `ค้นข่าวไม่ได้ครับ` : `ค้นหาไม่ได้ครับ`,
      `เหตุผล: ${reason}`,
    ].join('\n');
  }

  const lines = [];

  lines.push(isNews ? `ข่าว: ${query}` : `ค้นหา: ${query}`);
  lines.push('');

  if (answer) {
    lines.push(answer);
    lines.push('');
  }

  if (results.length > 0) {
    const label = isNews ? `ข่าว ${results.length} รายการ:` : `แหล่งข้อมูล:`;
    lines.push(label);
    results.slice(0, 3).forEach((r, i) => {
      lines.push(`${i + 1}. ${(r.title || r.url).slice(0, 70)}`);
      lines.push(`   ${r.url}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  searchWeb,
  detectSearchIntent,
  buildSearchContext,
  formatSearchResults,
};
