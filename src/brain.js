'use strict';

const fs   = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', 'brain');

function readFile(name) {
  try {
    return fs.readFileSync(path.join(BRAIN_DIR, name), 'utf8').trim();
  } catch {
    return '';
  }
}

function loadBrain() {
  return {
    personality: readFile('personality.md'),
    rules:       readFile('project_rules.md'),
    memory:      readFile('memory.md'),
    tasks:       readFile('current_tasks.md'),
  };
}

// Build context string to inject into conversation
function buildBrainContext() {
  const b = loadBrain();
  const parts = [];
  if (b.memory) parts.push(`=== MEMORY ===\n${b.memory}`);
  if (b.tasks)  parts.push(`=== CURRENT TASKS ===\n${b.tasks}`);
  return parts.join('\n\n');
}

function appendMemory(entry) {
  const file = path.join(BRAIN_DIR, 'memory.md');
  const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19);
  try {
    fs.appendFileSync(file, `\n- [${ts}] ${entry}`, 'utf8');
  } catch (e) {
    console.warn('[brain] appendMemory failed:', e.message);
  }
}

function updateTasks(content) {
  try {
    fs.writeFileSync(path.join(BRAIN_DIR, 'current_tasks.md'), content, 'utf8');
  } catch (e) {
    console.warn('[brain] updateTasks failed:', e.message);
  }
}

module.exports = { loadBrain, buildBrainContext, appendMemory, updateTasks };
