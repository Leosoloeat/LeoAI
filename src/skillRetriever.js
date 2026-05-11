'use strict';

const fs   = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const CACHE_TTL  = 60_000; // refresh skill files every 60s

const _cache = new Map(); // skillName -> { content, loadedAt }

// ── Load a single skill file ──────────────────────────────────────────────────

function loadSkill(skill) {
  const hit = _cache.get(skill);
  if (hit && Date.now() - hit.loadedAt < CACHE_TTL) return hit.content;

  try {
    const content = fs.readFileSync(path.join(SKILLS_DIR, `${skill}.md`), 'utf8').trim();
    _cache.set(skill, { content, loadedAt: Date.now() });
    return content;
  } catch {
    return '';
  }
}

// ── Load multiple skills and merge into one context block ─────────────────────

function loadSkills(skills) {
  if (!skills || skills.length === 0) return '';

  const parts = [];
  for (const skill of skills) {
    const content = loadSkill(skill);
    if (content) parts.push(`=== SKILL: ${skill.toUpperCase()} ===\n${content}`);
  }
  return parts.join('\n\n');
}

// ── List available skill files ─────────────────────────────────────────────────

function listSkills() {
  try {
    return fs.readdirSync(SKILLS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''));
  } catch {
    return [];
  }
}

// ── Invalidate cache (called after /reload) ────────────────────────────────────

function clearSkillCache() {
  _cache.clear();
}

module.exports = { loadSkill, loadSkills, listSkills, clearSkillCache };
