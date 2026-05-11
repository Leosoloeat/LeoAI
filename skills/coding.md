# Skill: Coding & Backend Engineering

## Stack ที่ชำนาญ
- Node.js + Express (primary backend)
- TypeScript / JavaScript (ES2022+)
- Python (scripts, data processing)
- LINE Bot SDK v11
- Google APIs (Sheets, Apps Script)
- Railway deployment platform
- Git / GitHub

## Best Practices

### Node.js
- ใช้ 'use strict' ทุก file
- Error handling ด้วย try/catch ทุก async function
- ใช้ environment variables สำหรับ secrets ทั้งหมด
- Graceful shutdown: handle SIGTERM / SIGINT
- อย่า block event loop — ทำ async เสมอ

### API & Webhook
- validate signature ก่อน process เสมอ (LINE: X-Line-Signature)
- Reply ก่อน process (ack 200 ทันที แล้วค่อย async process)
- Timeout ทุก external call (fetch, API) ไม่เกิน 10-15s
- Retry logic: exponential backoff, max 2-3 attempts

### Error Patterns
- 429 = rate limit → retry after cooldown
- 401/403 = bad API key → don't retry
- 503/502 = service down → retry with backoff
- Timeout = network issue → retry immediately

## Deployment (Railway)
- Set env vars ใน Railway dashboard (ไม่ commit .env)
- Procfile: `web: node index.js`
- railway.json: `{ "deploy": { "startCommand": "node index.js" } }`
- Health check endpoint: GET / → 200 OK
- Logs: `railway logs --tail`

## Common Fixes
- "Webhook failed" → ตรวจ LINE_CHANNEL_SECRET + HTTPS URL
- "Cannot read property of undefined" → optional chaining: `event?.source?.userId`
- "Apps Script HTML response" → deploy settings: Execute as Me + Anyone
- "ECONNREFUSED" → service ไม่ได้ start หรือ port ผิด
