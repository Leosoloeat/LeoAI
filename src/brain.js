'use strict';

const fs   = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', 'brain');
const CACHE_TTL = 30_000; // hot-reload brain files every 30s

// ── File reader ───────────────────────────────────────────────────────────────

function readFile(name) {
  try {
    return fs.readFileSync(path.join(BRAIN_DIR, name), 'utf8').trim();
  } catch {
    return '';
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

let _cache     = null;
let _cacheTime = 0;

function loadBrain(force = false) {
  if (!force && _cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  _cache = {
    personality: readFile('personality.md'),
    skills:      readFile('skills.md'),
    rules:       readFile('business_rules.md'),
    style:       readFile('response_style.md'),
    memory:      readFile('memory.md'),
    forbidden:   readFile('forbidden.md'),
    tasks:       readFile('current_tasks.md'),
  };
  _cacheTime = Date.now();
  return _cache;
}

function reloadBrain() {
  _cache = null;
  return loadBrain(true);
}

// ── System prompt (personality + skills + rules + style + forbidden) ──────────
// Combined into one string used as AI system instruction.
// Re-read from cache every CACHE_TTL ms — no restart needed for memory changes.

function getSystemPrompt() {
  const b = loadBrain();
  return [
    b.personality,
    b.skills,
    b.rules,
    b.style,
    b.forbidden,
  ].filter(Boolean).join('\n\n');
}

// ── Context injected as conversation history (memory + tasks) ─────────────────
// Prepended on every request so the AI always sees latest memory.

function buildBrainContext() {
  const b = loadBrain();
  const parts = [];
  if (b.memory) parts.push(`=== MEMORY ===\n${b.memory}`);
  if (b.tasks)  parts.push(`=== TASKS ===\n${b.tasks}`);
  return parts.join('\n\n');
}

// ── Memory writer ─────────────────────────────────────────────────────────────

function appendMemory(entry) {
  const file = path.join(BRAIN_DIR, 'memory.md');
  const ts   = new Date().toISOString().replace('T', ' ').slice(0, 16);
  try {
    fs.appendFileSync(file, `\n- [${ts}] ${entry}`, 'utf8');
    _cache = null; // invalidate cache so next request picks up new memory
    console.log(`[brain] Memory updated: "${entry}"`);
  } catch (e) {
    console.warn('[brain] appendMemory failed:', e.message);
  }
}

function updateTasks(content) {
  try {
    fs.writeFileSync(path.join(BRAIN_DIR, 'current_tasks.md'), content, 'utf8');
    _cache = null;
  } catch (e) {
    console.warn('[brain] updateTasks failed:', e.message);
  }
}

// Warm the cache at startup
loadBrain();
console.log('[brain] Loaded:', Object.keys(loadBrain()).filter((k) => loadBrain()[k]).join(', '));

module.exports = { loadBrain, reloadBrain, getSystemPrompt, buildBrainContext, appendMemory, updateTasks };
