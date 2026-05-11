'use strict';

// ── Skill triggers — keywords that activate each skill module ─────────────────
const SKILL_TRIGGERS = {
  coding: [
    'code', 'bug', 'error', 'function', 'javascript', 'js', 'node', 'python',
    'api', 'webhook', 'deploy', 'git', 'npm', 'script', 'debug', 'server',
    'express', 'route', 'json', 'async', 'await', 'โค้ด', 'บัค', 'แก้ไข', 'เซิร์ฟเวอร์',
    'railway', 'github', 'import', 'require', 'module', 'package', 'install',
  ],
  marketing: [
    'marketing', 'content', 'viral', 'tiktok', 'facebook', 'ads', 'funnel',
    'content hook', 'viral hook', 'ad copy', 'headline', 'creative', 'campaign',
    'audience', 'targeting', 'conversion', 'lead gen', 'cta', 'โฆษณา', 'คอนเทนต์',
    'ไวรัล', 'กลยุทธ์', 'ขาย', 'engagement', 'reach', 'impression', 'แคมเปญ',
  ],
  line_bot: [
    'line', 'webhook', 'chatbot', 'oa', 'callback', 'channel', 'bot', 'reply',
    'flex', 'liff', 'richmenu', 'push', 'broadcast', 'message api', 'ไลน์',
    'บอท', 'แชทบอท', 'เว็บฮุค', 'token', 'line sdk', 'line channel',
  ],
  ai_agent: [
    'agent', 'gemini', 'openai', 'claude', 'gpt', 'openrouter', 'llm',
    'embedding', 'rag', 'vector', 'memory', 'context', 'inference', 'โมเดล',
    'ระบบ ai', 'ai system', 'chatgpt', 'generative', 'langchain', 'autogen',
  ],
  prompt_engineering: [
    'prompt', 'system prompt', 'instruction', 'template', 'few-shot', 'chain',
    'reasoning', 'persona', 'role', 'พรอมต์', 'คำสั่ง', 'วิธีเขียน prompt',
    'output format', 'zero-shot', 'context window',
  ],
};

// ── Project detection — which project does this message belong to? ─────────────
const PROJECT_TRIGGERS = {
  'line-oa': [
    'line', 'webhook', 'bot', 'oa', 'chatbot', 'callback', 'liff', 'ไลน์', 'บอท',
    'line oa', 'geminilinebot', 'channel access', 'line channel',
  ],
  'leo-ai': [
    'leo ai', 'leoai', 'leo agency', 'ai agency', 'our system', 'this system',
    'the system', 'ระบบของเรา', 'โปรเจคเรา',
  ],
};

// ── Knowledge scoring — detect if a message contains valuable knowledge ────────
const HIGH_VALUE_PATTERNS = [
  { pattern: /step.?by.?step|ขั้นตอน|วิธีทำ|how to/i,         score: 2 },
  { pattern: /fix|แก้|debug|solve|solution|แก้ไข|วิธีแก้/i,   score: 2 },
  { pattern: /strategy|funnel|system|workflow|กลยุทธ์|ระบบ/i,  score: 2 },
  { pattern: /deploy|setup|configure|install|ติดตั้ง|ตั้งค่า/i, score: 2 },
  { pattern: /api|webhook|endpoint|integration|เชื่อมต่อ/i,   score: 2 },
  { pattern: /prompt|template|script|แม่แบบ/i,                 score: 1 },
  { pattern: /automation|automate|อัตโนมัติ/i,                  score: 1 },
  { pattern: /\d+\.\s+\w+/,                                    score: 1 }, // numbered list
];

const LOW_VALUE_PATTERNS = [
  /^(สวัสดี|hello|hi|hey|ครับ|ค่ะ|ok|okay|thanks|ขอบคุณ|เข้าใจ|รับทราบ|โอเค|555|haha|lol)[\s!?]*$/i,
  /^.{0,20}$/, // very short (≤20 chars)
];

/**
 * Analyze a message and return routing decision.
 *
 * @param {string} text - User message text
 * @returns {{
 *   skills: string[],
 *   project: string|null,
 *   knowledgeScore: number,
 *   isLowValue: boolean
 * }}
 */
function route(text) {
  const lower = text.toLowerCase();

  // ── Detect relevant skills ─────────────────────────────────────────────────
  const skills = [];
  for (const [skill, triggers] of Object.entries(SKILL_TRIGGERS)) {
    if (triggers.some((t) => lower.includes(t))) skills.push(skill);
  }

  // ── Detect project context ─────────────────────────────────────────────────
  let project = null;
  for (const [proj, triggers] of Object.entries(PROJECT_TRIGGERS)) {
    if (triggers.some((t) => lower.includes(t))) { project = proj; break; }
  }

  // ── Score knowledge value ──────────────────────────────────────────────────
  const isLowValue = LOW_VALUE_PATTERNS.some((r) => r.test(text.trim()));
  let knowledgeScore = 0;

  if (!isLowValue) {
    for (const { pattern, score } of HIGH_VALUE_PATTERNS) {
      if (pattern.test(text)) knowledgeScore += score;
    }
    if (skills.length > 0)    knowledgeScore++;       // bonus for topic match
    if (text.length > 200)    knowledgeScore++;       // longer = more content
    if (text.length > 500)    knowledgeScore++;
  }

  return { skills, project, knowledgeScore, isLowValue };
}

module.exports = { route };
