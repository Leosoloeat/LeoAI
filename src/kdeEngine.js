'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger                 = require('./logger');

// ── KDE System Prompt ─────────────────────────────────────────────────────────

const KDE_SYSTEM_PROMPT = `You are the Knowledge Detection Engine for Leo AI.
Your role is to analyze incoming conversations and visual content, then determine whether they contain long-term reusable knowledge worth storing in the AI memory system.

The system may receive any combination of:
- Text conversations
- Screenshots / UI captures
- Images / diagrams / charts
- Error messages / logs
- Dashboards / analytics data
- Infrastructure / architecture diagrams

Analyze ALL provided inputs (text AND visual) before making a decision.

==================================================
SAVE KNOWLEDGE IF THE CONTENT CONTAINS:

- Reusable technical insight or fix
- Business strategy or decision framework
- Workflow, SOP, or operational process
- System architecture or engineering insight
- AI/automation/prompt engineering pattern
- Deployment, DevOps, or infrastructure knowledge
- API integration or backend logic
- Marketing strategy or funnel system
- Clinic or business operational intelligence
- Reusable research methods or data workflows
- Configuration settings or operational standards
- Any content likely to be useful again in the future

==================================================
IMAGE / SCREENSHOT ANALYSIS RULES

When images or screenshots are provided, extract knowledge from:
- Error messages and stack traces
- Configuration or settings panels
- API responses or backend outputs
- Dashboard or analytics data
- UI workflows or process flows
- Infrastructure or deployment diagrams
- Code screenshots or logic flows
- Automation or marketing metric screens

Increase importance_score and retrieval_priority if the image contains:
- A reusable technical fix or deployment solution
- A reusable workflow or backend configuration
- A scalable operational or business system
- A reusable process or decision pattern

==================================================
DO NOT SAVE:

- Greetings, small talk, casual chat
- Temporary emotions or reactions
- One-time questions with no reusable answer
- Generic opinions without actionable insight
- Non-reusable personal context
- Short-lived information with no future value
- Raw conversation logs without compressed insight

==================================================
MEMORY COMPRESSION RULES (CRITICAL)

1. Never store raw conversations.
   Extract and compress operational intelligence only.

2. Prefer extracting insight over preserving conversational wording.

3. Compress memories into standalone reusable intelligence
   that is fully understandable without the original conversation context.

4. A good memory should read clearly on its own —
   no back-reference needed, no "as mentioned above."

==================================================
SCORING GUIDE

importance_score (1-10):
  1-3  = Low value, marginally reusable
  4-6  = Useful reusable insight
  7-8  = Strong operational knowledge
  9-10 = Critical long-term intelligence

retrieval_priority:
  low      = Rarely needed, niche edge case
  medium   = Occasionally useful
  high     = Frequently relevant, inject proactively
  critical = Always inject when topic matches

decay_policy:
  none   = Timeless knowledge (architecture, principles)
  slow   = Stable but may eventually change (configs, SOPs)
  medium = Changes within months (benchmarks, API behavior)
  fast   = Changes within weeks (CPM rates, ad performance)

==================================================
MEMORY CLASS — RETRIEVAL BEHAVIOR GUIDE

Use memory_class to control WHEN this memory should be injected:

  fix              → inject when user encounters errors or failures
  workflow         → inject during task execution
  strategy         → inject during planning or decision-making
  reference        → inject when topic is mentioned
  configuration    → inject when setting up systems
  prompt_pattern   → inject during AI/prompt engineering tasks
  operational_rule → inject during ops or process work
  architecture     → inject during system design discussions
  research         → inject during analysis or research tasks

==================================================
IMPORTANT RULES

- Think like a long-term AI memory system
- Only save knowledge that improves future AI performance
- Compress knowledge into reusable operational intelligence
- Detect reusable systems, workflows, frameworks, fixes, and decision models
- Merge insights from BOTH text and images before deciding
- Avoid storing redundant or duplicate knowledge
- Generate concise memory optimized for retrieval systems
- deduplication_key must be a unique snake_case string describing the core topic
  Example: "n8n_webhook_auth_fix", "facebook_ads_retargeting_funnel"
- retrieval_triggers must be explicit keywords or phrases that should
  activate this memory during future conversations
- failure_pattern is ONLY required when memory_class is "fix"
  For all other classes, omit the field entirely

==================================================
RETURN JSON ONLY — NO PREAMBLE, NO EXPLANATION

{
  "should_save": true,
  "confidence": 0.0,

  "knowledge_type": "",
  "memory_class": "",
  "category": "",

  "importance_score": 0,
  "retrieval_priority": "",
  "actionability": "",
  "decay_policy": "",

  "source_types": [],

  "tags": [],
  "retrieval_triggers": [],

  "deduplication_key": "",

  "context_window_hint": "",

  "failure_pattern": {
    "symptoms": [],
    "root_cause": "",
    "resolution": ""
  },

  "summary": "",
  "raw_memory": "",
  "compressed_memory": ""
}`;

// ── Config ────────────────────────────────────────────────────────────────────

const KDE_TIMEOUT_MS     = 15_000;
const KDE_MIN_IMPORTANCE = parseInt(process.env.KDE_MIN_IMPORTANCE || '5', 10);

// ── Lazy-initialized Gemini client (separate from the Leo AI persona client) ──

let _kdeModel = null;

function getKdeModel() {
  if (_kdeModel) return _kdeModel;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  _kdeModel = genAI.getGenerativeModel({
    model:             process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: KDE_SYSTEM_PROMPT,
  });
  return _kdeModel;
}

// ── JSON extraction — robust against markdown fences ─────────────────────────

function parseKdeResponse(raw) {
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Surgically extract { ... } — handles leading explanation text
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object in KDE response: "${text.slice(0, 100)}"`);
  }

  return JSON.parse(text.slice(start, end + 1));
}

// ── Validate minimum required KDE fields ─────────────────────────────────────

function isValidKdeResult(parsed) {
  return (
    typeof parsed.should_save      === 'boolean' &&
    typeof parsed.importance_score === 'number'  &&
    typeof parsed.memory_class     === 'string'  &&
    typeof parsed.compressed_memory === 'string'
  );
}

// ── failure_pattern helpers ───────────────────────────────────────────────────

function hasFailurePattern(fp) {
  if (!fp || typeof fp !== 'object') return false;
  return (
    (Array.isArray(fp.symptoms)  && fp.symptoms.length > 0) ||
    (typeof fp.root_cause  === 'string' && fp.root_cause.trim()  !== '') ||
    (typeof fp.resolution  === 'string' && fp.resolution.trim()  !== '')
  );
}

function buildFailurePatternBlock(fp) {
  const lines = ['[FAILURE PATTERN]'];
  if (fp.symptoms?.length > 0)       lines.push(`Symptoms: ${fp.symptoms.join(', ')}`);
  if (fp.root_cause?.trim())         lines.push(`Root cause: ${fp.root_cause}`);
  if (fp.resolution?.trim())         lines.push(`Resolution: ${fp.resolution}`);
  return lines.join('\n');
}

// ── Build content string (fits in sheets.js 2000-char limit) ─────────────────

function buildContent(kde) {
  const parts = [];

  if (kde.summary)           parts.push(`[SUMMARY]\n${kde.summary}`);
  if (kde.compressed_memory) parts.push(`[INTELLIGENCE]\n${kde.compressed_memory}`);

  if (Array.isArray(kde.retrieval_triggers) && kde.retrieval_triggers.length > 0) {
    parts.push(`[TRIGGERS]\n${kde.retrieval_triggers.join(' | ')}`);
  }

  if (kde.memory_class === 'fix' && hasFailurePattern(kde.failure_pattern)) {
    parts.push(buildFailurePatternBlock(kde.failure_pattern));
  }

  return parts.join('\n\n');
  // sheets.js sanitizes to 2000 chars — no manual truncation needed
}

// ── Map KDE result → saveKnowledge() entry ────────────────────────────────────

function mapKdeToEntry({ kde, userId, userText, routeInfo }) {
  const knowledgeType = kde.knowledge_type || kde.memory_class || 'knowledge';
  const title         = `[${knowledgeType}] ${userText.replace(/\n/g, ' ').slice(0, 80)}`;
  const tags          = Array.isArray(kde.tags) ? kde.tags.join(',') : (kde.tags || '');

  return {
    timestamp: new Date().toISOString(),
    userId:    userId             || 'unknown',
    project:   routeInfo?.project || 'general',
    type:      kde.memory_class   || 'knowledge',
    title,
    content:   buildContent(kde),
    tags,
    score:     String(kde.importance_score),
  };
}

// ── Raw KDE Gemini call ───────────────────────────────────────────────────────

async function callKde(userText, aiText) {
  const prompt = `USER: ${userText.slice(0, 1000)}\n\nASSISTANT: ${aiText.slice(0, 3000)}`;
  const model  = getKdeModel();
  const chat   = model.startChat({ history: [] });

  return Promise.race([
    chat.sendMessage(prompt).then((r) => r.response.text()),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('KDE timeout (15s)')), KDE_TIMEOUT_MS),
    ),
  ]);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Analyze a conversation turn for knowledge value using Gemini.
 * Returns a saveKnowledge()-compatible entry, or null if not worth saving.
 * Always resolves — never throws (errors are logged and return null).
 *
 * @param {{ userId, userText, aiText, routeInfo }} params
 * @returns {Promise<object|null>}
 */
async function analyzeForKnowledge({ userId, userText, aiText, routeInfo }) {
  try {
    const raw    = await callKde(userText, aiText);
    const parsed = parseKdeResponse(raw);

    if (!isValidKdeResult(parsed)) {
      logger.warn('KDE invalid response structure', { raw: raw.slice(0, 200) });
      return null;
    }

    if (!parsed.should_save) {
      logger.info('KDE: should_save=false', { confidence: parsed.confidence });
      return null;
    }

    if (parsed.importance_score < KDE_MIN_IMPORTANCE) {
      logger.info('KDE: below min importance', {
        score: parsed.importance_score,
        min: KDE_MIN_IMPORTANCE,
      });
      return null;
    }

    const entry = mapKdeToEntry({ kde: parsed, userId, userText, routeInfo });
    logger.info('KDE: knowledge detected', {
      memory_class:     parsed.memory_class,
      importance_score: parsed.importance_score,
      retrieval_priority: parsed.retrieval_priority,
      deduplication_key:  parsed.deduplication_key,
    });
    return entry;

  } catch (err) {
    logger.warn('KDE analysis failed — skipping save', { err: err.message });
    return null;
  }
}

module.exports = { analyzeForKnowledge };
