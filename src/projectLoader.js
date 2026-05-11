'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const CACHE_TTL    = 60_000;

const _cache = new Map();

function readFile(filepath) {
  try { return fs.readFileSync(filepath, 'utf8').trim(); } catch { return ''; }
}

/**
 * Load project context + shared knowledge.
 * Always loads shared/knowledge.md, then overlays project-specific context.
 *
 * @param {string|null} project - 'line-oa' | 'leo-ai' | null
 * @returns {string} combined context string
 */
function loadProjectContext(project) {
  const key    = project || '__shared__';
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) return cached.content;

  const parts = [];

  const shared = readFile(path.join(PROJECTS_DIR, 'shared', 'knowledge.md'));
  if (shared) parts.push(`=== SHARED KNOWLEDGE ===\n${shared}`);

  if (project) {
    const ctx = readFile(path.join(PROJECTS_DIR, project, 'context.md'));
    if (ctx) parts.push(`=== PROJECT: ${project.toUpperCase()} ===\n${ctx}`);
  }

  const content = parts.join('\n\n');
  _cache.set(key, { content, loadedAt: Date.now() });
  return content;
}

function listProjects() {
  try {
    return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'shared')
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function clearProjectCache() {
  _cache.clear();
}

module.exports = { loadProjectContext, listProjects, clearProjectCache };
