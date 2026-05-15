# LeoSP — LINE OA Bot (Claude API)

LINE OA webhook bot สำหรับ Leo Ai
ใช้ Claude Sonnet 4.6 + Knowledge Base injection + Google Sheets

---

## Stack

- **AI:** Claude Sonnet 4.6 (claude-sonnet-4-6) — temperature 0.2
- **Prompt Caching:** เปิดอยู่ — ลด cost ~90% สำหรับ system message
- **LINE:** @line/bot-sdk v9
- **Database:** Google Sheets (customers, appointments, promotions)
- **Deploy:** Railway

---

## โครงสร้างไฟล์

```
LeoSP/
├── index.js                    ← webhook handler
├── services/
│   ├── claude.js               ← Claude API + caching + retry
│   ├── line.js                 ← LINE reply
│   └── sheets.js               ← Google Sheets integration
├── prompts/
│   └── LeoSP_master_prompt.md  ← system prompt v2.0
├── context/
│   ├── notebooklm_export.md    ← Knowledge Base (Fill ก่อน deploy)
│   ├── sheets_schema.md        ← Sheets schema reference
│   └── user_profile.md         ← Brand profile (Fill ก่อน deploy)
└── logs/
```

---

## Setup

### 1. Install

```bash
cd LeoSP
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

แก้ไข `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
GOOGLE_SHEETS_ID=...           (optional)
```

### 3. Fill Knowledge Base

แก้ `context/notebooklm_export.md`:
- ข้อมูลแบรนด์
- บริการและราคา (จริง)
- โปรโมชั่น (จริง)
- FAQ

แก้ `context/user_profile.md`:
- ชื่อธุรกิจ สาขา เวลาทำการ

### 4. Run Local

```bash
npm run dev
# webhook: POST http://localhost:3000/webhook
```

ใช้ ngrok expose:
```bash
ngrok http 3000
```

---

## Deploy บน Railway

1. Railway Dashboard → New Project → Deploy from GitHub → เลือก repo นี้ → **Root Directory: LeoSP**
2. ตั้ง Environment Variables:
   - `ANTHROPIC_API_KEY`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
3. Copy Railway URL → LINE Developers Console → Webhook URL

---

## Commands ที่รองรับ

| Command | ทำอะไร |
|---------|--------|
| `/reset` | ล้างประวัติการสนทนา |

---

## Features

- Conversation history (10 turns, expire 30 min idle)
- Prompt caching — ลด latency + cost ทุก request
- Auto-retry บน 500/529 errors
- LINE message truncation (limit 4,900 chars)
- Image message handler (graceful fallback)
- Session pruning อัตโนมัติทุก 5 นาที
- `/health` endpoint: GET /health

---

## Checklist ก่อน Deploy

```
[ ] context/notebooklm_export.md — fill ข้อมูลจริง (ราคา บริการ โปร FAQ)
[ ] context/user_profile.md — fill ชื่อแบรนด์ สาขา
[ ] ANTHROPIC_API_KEY ตั้งใน Railway
[ ] LINE credentials ตั้งใน Railway
[ ] Webhook URL ชี้มาที่ Railway
[ ] ทดสอบถามราคา → ตอบจาก KB ไม่เดา
[ ] ทดสอบ /reset → ล้าง history
```
