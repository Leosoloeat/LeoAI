'use strict';

// ── Skill triggers — keywords that activate each skill module ─────────────────

// Business / clinic analysis skills
const SKILL_TRIGGERS = {
  analyze_clinic_ads: [
    'cpm', 'cpc', 'ctr', 'roas', 'spend', 'ad spend', 'ad result', 'ad performance',
    'โฆษณา', 'แคมเปญ', 'ผลโฆษณา', 'ยิงแอด', 'ค่าโฆษณา', 'reach', 'impression',
    'facebook ads', 'meta ads', 'ad campaign', 'clinic ads', 'performance',
  ],
  analyze_funnel: [
    'funnel', 'conversion rate', 'lead drop', 'drop-off', 'pipeline',
    'booking rate', 'consultation rate', 'treatment rate', 'close rate',
    'ฟันเนล', 'อัตราปิด', 'อัตราเปลี่ยน', 'lead', 'ลูกค้า เข้ามา', 'เข้ามา กี่คน',
    'conversion', 'ปิดการขาย', 'นัด', 'เข้าคลินิก',
  ],
  analyze_line_oa: [
    'line oa stats', 'line oa performance', 'friend count', 'broadcast rate',
    'chat rate', 'block rate', 'oa analytics', 'line analytics', 'line report',
    'ยอดเพื่อน', 'บล็อก', 'บรอดแคสต์', 'แชทเรต', 'line oa ผล', 'สถิติไลน์',
  ],
  analyze_competitor: [
    'competitor', 'คู่แข่ง', 'เทียบ', 'เปรียบเทียบ', 'competitor price',
    'competitor content', 'ราคาคู่แข่ง', 'positioning', 'differentiation',
    'market position', 'กลยุทธ์คู่แข่ง', 'วิเคราะห์คู่แข่ง',
  ],
  financial_breakdown: [
    'revenue', 'profit', 'margin', 'p&l', 'cost', 'รายได้', 'กำไร', 'ต้นทุน',
    'gross margin', 'net profit', 'financial', 'ยอดขาย', 'ค่าใช้จ่าย', 'ผลประกอบการ',
    'income', 'expense', 'break even', 'roi', 'cash flow', 'งบการเงิน',
  ],
  content_strategy: [
    'content plan', 'posting schedule', 'what to post', 'content idea',
    'engagement strategy', 'คอนเทนต์', 'ไวรัล', 'viral', 'tiktok', 'facebook',
    'content hook', 'hook', 'สคริปต์', 'script', 'ไอเดียคอนเทนต์', 'แพลน',
    'posting', '30 day', 'content calendar', 'โพสต์',
  ],

  // Technical skills — keep for bot/code queries
  coding: [
    'code', 'bug', 'error', 'function', 'javascript', 'node', 'python',
    'api', 'webhook', 'deploy', 'git', 'npm', 'script', 'debug', 'server',
    'express', 'json', 'async', 'โค้ด', 'บัค', 'เซิร์ฟเวอร์',
    'railway', 'github', 'require', 'module', 'package', 'install',
  ],
  line_bot: [
    'line bot', 'webhook', 'chatbot', 'line oa', 'callback', 'channel', 'flex',
    'liff', 'richmenu', 'push message', 'broadcast', 'message api', 'ไลน์ บอท',
    'บอท', 'แชทบอท', 'เว็บฮุค', 'line sdk', 'line channel', 'line api',
  ],
  ai_agent: [
    'agent', 'gemini', 'openai', 'claude', 'gpt', 'openrouter', 'llm',
    'embedding', 'rag', 'vector', 'inference', 'โมเดล', 'ระบบ ai', 'ai system',
    'generative', 'langchain', 'autogen', 'kde', 'knowledge engine',
  ],
  prompt_engineering: [
    'prompt', 'system prompt', 'instruction', 'few-shot', 'chain of thought',
    'persona', 'พรอมต์', 'วิธีเขียน prompt', 'output format', 'zero-shot',
  ],
};

// ── Project detection — which project does this message belong to? ─────────────
const PROJECT_TRIGGERS = {
  clinic: [
    'clinic', 'คลินิก', 'นวดหน้า', 'โบท็อกซ์', 'filler', 'ฟิลเลอร์', 'skin',
    'สกิน', 'ทรีทเมนต์', 'treatment', 'booking', 'นัดหมาย', 'patient', 'คนไข้',
  ],
  'line-oa': [
    'line bot', 'webhook', 'line oa', 'chatbot', 'callback', 'liff', 'ไลน์ บอท',
    'geminilinebot', 'channel access', 'line api',
  ],
  'leo-ai': [
    'leo ai', 'leoai', 'leo agency', 'ai agency', 'our system', 'this system',
    'ระบบของเรา', 'โปรเจคเรา',
  ],
};

// ── Knowledge scoring — detect if a message contains valuable knowledge ────────
const HIGH_VALUE_PATTERNS = [
  { pattern: /step.?by.?step|ขั้นตอน|วิธีทำ|how to/i,                score: 2 },
  { pattern: /fix|แก้|debug|solve|solution|แก้ไข|วิธีแก้/i,          score: 2 },
  { pattern: /strategy|funnel|system|workflow|กลยุทธ์|ระบบ/i,         score: 2 },
  { pattern: /deploy|setup|configure|install|ติดตั้ง|ตั้งค่า/i,       score: 2 },
  { pattern: /api|webhook|endpoint|integration|เชื่อมต่อ/i,           score: 2 },
  { pattern: /cpm|cpc|roas|ctr|conversion rate|margin|revenue/i,       score: 2 }, // business metrics
  { pattern: /funnel|pipeline|drop.?off|booking rate|close rate/i,     score: 2 }, // funnel analysis
  { pattern: /competitor|positioning|differentiation|คู่แข่ง/i,        score: 2 }, // competitive
  { pattern: /content plan|content strategy|posting schedule/i,         score: 1 },
  { pattern: /prompt|template|script|แม่แบบ/i,                          score: 1 },
  { pattern: /automation|automate|อัตโนมัติ/i,                           score: 1 },
  { pattern: /\d+\.\s+\w+/,                                             score: 1 }, // numbered list
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

  // ── Preferred model based on skill intent ─────────────────────────────────
  // deepseek   → code, structured output, technical debugging
  // claude-haiku → multi-step reasoning, complex business analysis
  // gemini     → everything else (fast, vision, general Q&A)
  let preferredModel = 'gemini';

  if (skills.some((s) => ['coding', 'ai_agent', 'prompt_engineering'].includes(s))) {
    preferredModel = 'deepseek';
  } else if (skills.some((s) => ['analyze_funnel', 'financial_breakdown', 'analyze_competitor'].includes(s))) {
    preferredModel = 'claude-haiku';
  }

  return { skills, project, knowledgeScore, isLowValue, preferredModel };
}

module.exports = { route };
