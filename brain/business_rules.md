==================================================
OPERATIONAL RULES

- ห้ามตอบมั่ว ถ้าไม่รู้ให้บอกตรงๆ
- เน้นช่วยแก้ปัญหา ตอบ actionable เสมอ
- ถ้าลูกค้าถาม LINE OA → ถามก่อน: "มี LINE OA อยู่แล้วหรือยังครับ"
- ถ้าลูกค้าถาม AI → ถามก่อน: "ธุรกิจทำเรื่องอะไรอยู่ครับ"
- ถ้าลูกค้า escalate ปัญหา: "กำลังส่งให้ Leo ดูแลโดยตรงครับ"

==================================================
OPENROUTER ROUTING CONFIGURATION

Use specific model strings only — no wildcards.
Wildcard routing causes unpredictable costs and behavior drift.

RECOMMENDED MODEL ROSTER

Primary (speed + vision)
  Model   : gemini-2.5-flash (via Gemini API)
  Use for : general chat, image analysis, quick tasks,
            Line OA responses, skill execution

Reasoning (complex + cleanup)
  Model   : anthropic/claude-haiku-4-5
  Use for : multi-step reasoning, structured analysis,
            content editing, nuanced decisions

Code & Analysis
  Model   : deepseek/deepseek-chat-v3-0324:free
  Use for : code generation, data parsing,
            JSON/structured output, technical fixes

Fallback (cost control)
  Model   : qwen/qwen3-32b:free
  Use for : overflow when primary is unavailable,
            high-volume low-complexity requests

==================================================
ROUTING DECISION LOGIC

Route to Gemini Flash when:
  - Message is under 500 tokens
  - Image/screenshot is attached
  - Response needed under 3 seconds
  - General Q&A or skill execution

Route to Claude Haiku when:
  - Task requires multi-step reasoning
  - Output needs editing or cleanup
  - Prompt engineering or memory compression
  - Complex business analysis

Route to DeepSeek when:
  - User requests code or scripts
  - Structured JSON output required
  - Data analysis or calculation
  - Technical debugging

Route to Qwen Fallback when:
  - Primary model timeout > 5s
  - Cost budget threshold reached
  - High-volume broadcast processing

==================================================
COST CONTROL RULES

- Never auto-route to GPT-4o or Claude Opus
- Set max_tokens: 1000 for Line OA responses
- Set max_tokens: 2000 for skill analysis outputs
- Cache system prompt across sessions (same hash)
- Log model used + token count per request to Sheets
- Alert if daily cost exceeds defined threshold

==================================================
FALLBACK CHAIN

Primary (Gemini) fails → Claude Haiku → DeepSeek → Qwen
If all fail → return structured error message:
  "ขณะนี้ระบบกำลังดำเนินการ กรุณาลองใหม่อีกครั้งครับ"
