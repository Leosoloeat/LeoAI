# Skill: AI Agent Architecture

## Models ที่ใช้

### Gemini (Primary)
- Model: gemini-2.5-flash (fast, cost-effective)
- API: @google/generative-ai SDK
- System instruction ผ่าน getGenerativeModel({ systemInstruction })
- History format: [{ role: 'user'|'model', parts: [{ text }] }]
- Timeout: 12s, retry: 2 attempts

### OpenRouter (Fallback Chain)
- API: OpenAI-compatible (POST /chat/completions)
- Free models: deepseek, qwen, gemma, mistral
- Health scoring per model: win/loss ratio
- Cooldown on failure: 429 = 90s, 503 = 30s, 404 = 3min
- Auto-rotate when primary fails

## Context Management

### What goes in System Prompt (static, loaded once)
- Personality
- Business rules
- Response style
- Forbidden behaviors

### What goes in Conversation History (dynamic)
- Brain context (memory + tasks)
- Skill modules (loaded per routing decision)
- Project context (loaded per routing decision)
- Search results (injected when web search triggered)

### Context Window Strategy
- ไม่โหลด context ทั้งหมดทุกครั้ง
- Router วิเคราะห์ intent → โหลดเฉพาะ skill ที่เกี่ยวข้อง
- History: max 20 entries (10 turns), TTL: 30 min
- Knowledge: แยกเก็บใน Google Sheets, ดึงเมื่อ relevant

## Knowledge Architecture
- Short-term: In-memory session history (per user)
- Mid-term: brain/memory.md (appended, hot-reloaded every 30s)
- Long-term: Google Sheets — Memory tab + Knowledge tab
- Skills: /skills/*.md (modular, hot-reloaded every 60s)
- Projects: /projects/*/context.md (hot-reloaded every 60s)

## Routing Logic
```
User Message
    ↓
Router: detect skills + project + knowledge score
    ↓
Load: personality + rules (always)
    + relevant skills (dynamic)
    + project context (dynamic)
    + memory context (always)
    ↓
Gemini → OpenRouter fallback → static fallback
    ↓
Knowledge extractor: score response
    ↓ (if score >= 3)
Auto-save to Google Sheets Knowledge tab
```

## Future Architecture (planned)
- Vector DB: Qdrant or Pinecone for semantic search
- RAG: retrieve relevant knowledge chunks before generating
- Multi-agent: separate agents per skill domain
- Memory ranking: decay + relevance scoring
