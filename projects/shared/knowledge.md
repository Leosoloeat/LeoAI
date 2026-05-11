# Shared Knowledge Base

## Auto-populated by knowledge extractor
## Knowledge saved here when score >= 3

## System Architecture Decisions
- ใช้ POST สำหรับทุก Apps Script request (GET มี redirect issue)
- Gemini history format: role 'model' ไม่ใช่ 'assistant'
- LINE reply ต้อง ack 200 ก่อน process async เสมอ
- Brain files hot-reload ทุก 30s — แก้ได้โดยไม่ต้อง restart

## Key Learnings
- Apps Script: deploy ต้องเป็น "Execute as Me + Anyone" ถึงจะทำงานได้
- Railway: env vars ต้องตั้งใน dashboard — ไม่ push .env
- LINE SDK: replyToken หมดอายุใน 30 วิ ใช้ได้แค่ครั้งเดียว
- OpenRouter free models มี downtime บ่อย → ต้องมี health scoring + cooldown
