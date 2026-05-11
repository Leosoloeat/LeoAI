'use strict';

const logger = require('./logger');

// Score threshold — response must reach this to auto-save
const SAVE_THRESHOLD = 3;

// Patterns scored against the AI RESPONSE (not user text)
const RESPONSE_PATTERNS = [
  { pattern: /```[\s\S]+?```/,                       score: 3 }, // code block = high value
  { pattern: /\n\d+\.\s+/,                           score: 1 }, // numbered list
  { pattern: /ขั้นตอน|step|วิธี|how to/i,            score: 2 }, // workflow
  { pattern: /fix|แก้|debug|solution|solve/i,        score: 2 }, // debug fix
  { pattern: /strategy|funnel|system|กลยุทธ์/i,      score: 2 }, // strategy
  { pattern: /deploy|setup|install|ตั้งค่า/i,         score: 2 }, // setup guide
  { pattern: /api|webhook|endpoint|integration/i,   score: 2 }, // technical
  { pattern: /template|prompt|แม่แบบ/i,              score: 1 }, // template
  { pattern: /สำคัญ|key point|remember|note/i,       score: 1 }, // key insight
  { pattern: /automation|automate|อัตโนมัติ/i,        score: 1 }, // automation
];

function detectType(userText, aiText) {
  const all = `${userText} ${aiText}`.toLowerCase();
  if (/```/.test(aiText))                            return 'code';
  if (/fix|debug|แก้|error|bug/.test(all))           return 'fix';
  if (/step|ขั้นตอน|วิธี/.test(all))                 return 'workflow';
  if (/strategy|funnel|กลยุทธ์/.test(all))           return 'strategy';
  if (/api|webhook|endpoint/.test(all))              return 'technical';
  if (/prompt|template/.test(all))                   return 'prompt';
  if (/deploy|setup|ตั้งค่า/.test(all))              return 'setup';
  return 'knowledge';
}

function generateTitle(userText, skills) {
  const prefix = skills.length > 0 ? `[${skills[0]}] ` : '';
  const base   = userText.replace(/\n/g, ' ').slice(0, 80).trim();
  return `${prefix}${base}`;
}

/**
 * Score an AI response for knowledge value.
 * Only the AI response is scored (not the user question).
 *
 * @param {string}   userText - User question
 * @param {string}   aiText   - AI response to score
 * @param {string[]} skills   - Skills from router
 * @returns {{ score: number, type: string, shouldSave: boolean }}
 */
function scoreKnowledge(userText, aiText, skills) {
  let score = 0;

  for (const { pattern, score: s } of RESPONSE_PATTERNS) {
    if (pattern.test(aiText)) score += s;
  }

  if (skills.length > 0)    score++; // topic match bonus
  if (aiText.length > 300)  score++; // detailed response
  if (aiText.length > 800)  score++; // comprehensive
  if (aiText.length < 50)   score -= 2; // too short

  const type       = detectType(userText, aiText);
  const shouldSave = score >= SAVE_THRESHOLD;

  if (shouldSave) {
    logger.info('Knowledge auto-detected', { score, type, skills, responseLen: aiText.length });
  }

  return { score, type, shouldSave };
}

/**
 * Build a knowledge entry ready for Sheets storage.
 */
function buildKnowledgeEntry({ userId, userText, aiText, skills, project, score, type }) {
  return {
    timestamp: new Date().toISOString(),
    userId:    userId  || 'unknown',
    project:   project || 'general',
    type,
    title:     generateTitle(userText, skills),
    content:   `Q: ${userText.slice(0, 500)}\n\nA: ${aiText.slice(0, 1500)}`,
    tags:      skills.join(',') || 'general',
    score:     String(score),
  };
}

// Tier 1 gate — skip KDE entirely for low-value or trivial replies
function shouldSkipCapture(routeInfo, aiText) {
  return routeInfo.isLowValue || aiText.length < 80;
}

// Tier 2 fast-path — regex already highly confident, skip KDE call
function isHighConfidenceRegex(score, aiText) {
  return score >= 5 && /```[\s\S]+?```/.test(aiText);
}

module.exports = { scoreKnowledge, buildKnowledgeEntry, SAVE_THRESHOLD, shouldSkipCapture, isHighConfidenceRegex };
