# Project: LeoSP — LINE OA Bot (Claude API)

## Overview
LINE OA bot ใช้ Claude Sonnet 4.6 + Knowledge Base injection
โฟกัสที่ grounding — ตอบจาก KB เท่านั้น ไม่ hallucinate

Location: LeoAI/LeoSP/ (subfolder in this repo)

## Tech Stack
- Node.js + Express
- LINE Messaging API v9
- Claude Sonnet 4.6 (claude-sonnet-4-6) — temperature 0.2
- Prompt Caching (ephemeral) — ~90% input token savings
- Google Sheets (customers, appointments, promotions)

## Architecture
- index.js — webhook + signature verify + conversation history (30min TTL)
- services/claude.js — Claude API + prompt caching + retry
- services/line.js — LINE reply
- services/sheets.js — Sheets CRUD
- context/notebooklm_export.md — Knowledge Base (fill ก่อน deploy)
- context/user_profile.md — Brand profile
- prompts/LeoSP_master_prompt.md — System prompt v2.0

## Features
- /reset command — ล้าง conversation history
- Session TTL 30min + auto-prune
- LINE message truncation 4900 chars
- Image message graceful fallback
- /health endpoint — sessions count + model info

## Slash Commands (user-facing)
- /reset — clear history

## Deploy Status
- [ ] context/notebooklm_export.md ยังเป็น template — ต้อง fill ก่อน
- [ ] context/user_profile.md ยังเป็น template — ต้อง fill ก่อน
- [ ] Railway deploy: New Project → GitHub → Root Directory: LeoSP
- [ ] Environment Variables needed:
  - ANTHROPIC_API_KEY
  - LINE_CHANNEL_ACCESS_TOKEN
  - LINE_CHANNEL_SECRET
  - GOOGLE_SHEETS_ID (optional)
