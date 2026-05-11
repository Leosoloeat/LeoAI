# Project: LINE OA Bot (GeminiLineBot)

## Overview
LINE OA bot สำหรับ Leo's AI Agency
Deploy บน Railway: https://leoai-production.up.railway.app
Webhook: https://leoai-production.up.railway.app/callback

## Tech Stack
- Node.js + Express
- LINE Messaging API v11
- Gemini 2.5 Flash (primary AI)
- OpenRouter (fallback: deepseek, qwen, gemma, mistral)
- Google Sheets (memory + knowledge storage)
- Tavily (web search)

## Architecture
- index.js → main entry, LINE webhook handler
- src/ai.js → AI routing (Gemini → OpenRouter → fallback)
- src/brain.js → load brain files (personality, skills, rules)
- src/router.js → intent detection, skill routing
- src/sheets.js → Google Sheets CRUD
- src/knowledgeExtractor.js → auto-detect valuable knowledge
- brain/*.md → personality, rules, style (always loaded)
- skills/*.md → domain skills (loaded dynamically per intent)
- projects/*/context.md → project context (loaded dynamically)

## Slash Commands
- /health — system status
- /model — show AI models
- /brain — show loaded brain
- /reload — hot-reload brain files
- /remember key: value — save to memory
- /memory — show memory
- /forget key — delete memory
- /use gemini|claude|deepseek|auto — switch model
- /search query — web search
- /news topic — news search
- /skills — list available skills
- /knowledge — show recent auto-saved knowledge

## Google Sheets
- Sheet ID: stored in Apps Script properties
- Memory tab: timestamp, userId, memory, source
- Knowledge tab: timestamp, userId, project, type, title, content, tags, score
- Webhook: set in GOOGLE_SHEETS_WEBHOOK env var

## Environment Variables (Railway)
- LINE_CHANNEL_ACCESS_TOKEN
- LINE_CHANNEL_SECRET
- GEMINI_API_KEY
- OPENROUTER_API_KEY
- OPENROUTER_MODEL (+ MODEL2...MODEL5)
- GOOGLE_SHEETS_WEBHOOK
- TAVILY_API_KEY
