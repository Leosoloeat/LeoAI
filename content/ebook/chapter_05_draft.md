# Chapter 5: Tools ที่คุณต้องรู้ (และที่ไม่ต้องรู้เลย)
> Draft v0.1 — 2026-05-16

---

นี่คือ chapter ที่คนส่วนใหญ่ตั้งใจอยากอ่าน

และมักผิดหวังที่ผมจะบอกว่า: คุณไม่จำเป็นต้องรู้ tools ทั้งหมดที่มีอยู่

คุณต้องรู้แค่ **tools ที่ถูกต้องสำหรับ stage ที่คุณอยู่**

---

## Principle ก่อนเริ่ม: The Minimal Stack

กฎที่ผมใช้กับทุก client:

**"เริ่มด้วยน้อยที่สุดที่ทำให้งานสำเร็จ"**

เพราะ:
- Tool เยอะ = complexity เยอะ = failure points เยอะ
- เรียนรู้ 1 tool ให้ลึก > รู้ 10 tool แบบผิวเผิน
- เพิ่ม tool ได้เสมอ แต่ลด complexity ยากกว่า

**Minimal Stack สำหรับ SME ไทย:**
- AI: Gemini API (ฟรี) หรือ Claude API (เสียเงินนิดหน่อย)
- Line OA: LINE Messaging API (ฟรี)
- Deploy: Railway (ฟรี tier)
- Database: Google Sheets (ฟรี)
- Automation: Make.com (ฟรี tier)

ทั้งหมดนี้ cost เฉลี่ย < 500 บาท/เดือน

---

## LAYER 1: AI Models (เลือก 1 อัน)

### Gemini 2.5 Flash — แนะนำสำหรับผู้เริ่มต้น
**ข้อดี:**
- ฟรีในระดับที่ใช้งานได้จริง (2-4 พัน requests/วัน)
- เร็วมาก — ตอบใน < 1 วินาที
- ภาษาไทยดีมาก
- Multimodal: อ่านรูปได้

**ข้อเสีย:**
- Context window เล็กกว่า Claude
- Grounding accuracy ต่ำกว่าสำหรับ Knowledge Base

**เหมาะกับ:** ร้านค้าออนไลน์, General Q&A, Volume สูง

**วิธีสมัคร:** aistudio.google.com → Get API Key → ฟรีเลย

---

### Claude Sonnet 4.6 (claude-sonnet-4-6) — แนะนำสำหรับ Knowledge Base
**ข้อดี:**
- Grounding accuracy สูงมาก (ไม่ hallucinate)
- Context window ใหญ่ — ใส่ KB ยาวๆ ได้
- Prompt Caching → ประหยัด cost 80-90%
- ภาษาไทยดีมาก

**ข้อเสีย:**
- ไม่มี free tier
- ราคาสูงกว่า Gemini (แต่ caching ช่วยได้)

**เหมาะกับ:** คลินิก, Agency, ระบบที่ต้องการความแม่นยำสูง

**Cost estimate:** ธุรกิจขนาดกลาง ~200-500 บาท/เดือน หลัง caching

---

### Claude Haiku 4.5 — สำหรับ lightweight tasks
**ข้อดี:**
- ถูกมาก (ราคาต่ำกว่า Sonnet 4-5 เท่า)
- เร็วมาก
- เหมาะกับ tasks ที่ไม่ต้องการ reasoning ซับซ้อน

**เหมาะกับ:** Admin tasks, Classification, Simple Q&A

---

### OpenRouter — Backup / Multi-model
**ข้อดี:**
- เข้าถึง models หลายตัวผ่าน 1 API
- ถ้า primary model down → switch ได้เลย
- มี DeepSeek, Qwen, Llama (ราคาต่ำมาก)

**เหมาะกับ:** Production system ที่ต้องการ reliability สูง

---

## LAYER 2: Automation Tools (ไม่ต้อง code)

### Make.com (เดิม Integromat) — แนะนำ #1
**ทำอะไรได้:**
- เชื่อม apps 1,000+ เข้าด้วยกัน
- ทำ workflow อัตโนมัติโดยไม่ต้อง code
- Visual drag-and-drop

**Free tier:** 1,000 operations/เดือน (พอสำหรับ SME เล็ก)

**Use cases ที่เหมาะ:**
- LINE → Google Sheets (รับ order)
- Sheets → LINE Notify (แจ้ง order ใหม่)
- Form → Email + LINE (lead capture)
- Weekly → LINE broadcast (report summary)

**เรียนรู้:** make.com/academy — ฟรีทั้งหมด

---

### n8n — สำหรับ Advanced Users
**ข้อดี:**
- Self-hosted = ไม่มีค่า subscription
- ยืดหยุ่นกว่า Make มาก
- เหมาะกับ developer หรือคนที่ต้องการ custom logic

**ข้อเสีย:**
- Setup ยากกว่า Make
- ต้องมี server ของตัวเอง

**แนะนำ:** เริ่ม Make ก่อน → ย้าย n8n เมื่อโตพอ

---

### Zapier — ง่ายที่สุด แต่แพงสุด
ถ้าอยากเริ่มง่ายๆ Zapier ง่ายกว่า Make แต่ free tier จำกัดมาก
และ paid plan แพงกว่า Make ชัดเจน

**แนะนำ:** ข้ามไป Make เลยครับ — ดีกว่าในระยะยาว

---

## LAYER 3: Storage / Database

### Google Sheets — Standard สำหรับ SME
**ทำอะไรได้:**
- CRM อย่างง่าย (ลูกค้า, orders, appointments)
- Dashboard real-time
- เชื่อมกับ Make ได้ตรงๆ

**Free tier:** ฟรีทุก Google account

**Template ที่ควรมี:**
- Sheet "Customers" — ชื่อ, LINE ID, ประเภทลูกค้า, last contact
- Sheet "Orders" — order ID, สินค้า, ราคา, status, วันที่
- Sheet "Appointments" — ชื่อ, เวลา, บริการ, status

---

### Notion — สำหรับ Knowledge Base / Team
**ทำอะไรได้:**
- Knowledge base สำหรับทีม
- Project management
- Database ที่ query ได้

**เหมาะกับ:** ทีมที่ต้องการ shared knowledge base

---

### Supabase — สำหรับ Scale
**ทำอะไรได้:**
- PostgreSQL database + Auth + Storage
- Real-time subscriptions
- REST API อัตโนมัติ

**เหมาะกับ:** ถ้ามี developer + ต้องการ scale จริงจัง

**ยังไม่ต้องใช้:** ถ้ายังไม่ถึง 100 concurrent users

---

## LAYER 4: Deploy / Hosting

### Railway — แนะนำสำหรับ Bot
**ข้อดี:**
- Deploy จาก GitHub ด้วย 1 click
- Free tier มี $5/เดือน credit
- Auto-restart ถ้า crash

**ข้อเสีย:**
- Free tier อาจ sleep ถ้าไม่มี traffic

**Solution:** ตั้ง health check ping ทุก 14 นาที (ผ่าน Make)

---

### Vercel — สำหรับ Web App / Landing Page
**ข้อดี:**
- Deploy Next.js / React ฟรี
- Global CDN — เร็วมาก
- Auto SSL

**เหมาะกับ:** Landing page, admin dashboard

---

## สิ่งที่ไม่ต้องรู้เลย (ณ stage นี้)

นี่คือสิ่งที่ผมเห็นผู้เริ่มต้นเสียเวลาไปโดยเปล่าประโยชน์:

**❌ ไม่ต้องรู้:**
- การ train AI model เอง (ราคาหลายแสน)
- RAG / Vector database (ก่อน 1,000 users)
- Docker / Kubernetes (ก่อน production ซับซ้อน)
- Redis / Message queue (ก่อน 100 concurrent users)
- ทุก AI model ที่มีอยู่ (เลือก 1-2 แล้วเก่งมันให้ชัด)
- Machine learning concepts (ใช้ API พร้อมใช้ได้เลย)

**กฎ:** ถ้า tool นั้นไม่ช่วยให้ serve ลูกค้าได้ดีขึ้นในเดือนนี้ → ยังไม่ต้องรู้

---

## Tool Stack สรุปตามประเภทธุรกิจ

### ร้านค้าออนไลน์ / E-commerce
```
AI: Gemini 2.5 Flash
Line OA: LINE Messaging API
Automation: Make.com
Database: Google Sheets
Deploy: Railway
Cost: ~200-400 บาท/เดือน
```

### คลินิก / บริการนัดหมาย
```
AI: Claude Sonnet 4.6
Line OA: LINE Messaging API
Calendar: Google Calendar
Database: Google Sheets
Automation: Make.com
Deploy: Railway
Cost: ~300-600 บาท/เดือน
```

### Agency / Enterprise
```
AI: Claude Sonnet 4.6 + Haiku (multi-tier)
Line OA: LINE Messaging API
Database: Supabase
Automation: n8n (self-hosted)
Deploy: Railway + Vercel
Cost: ~1,000-3,000 บาท/เดือน
```

---

## Getting Started Checklist (ทำก่อน deploy)

- [ ] Google account → Google Sheets (ฟรี)
- [ ] aistudio.google.com → Gemini API key (ฟรี)
- [ ] developers.line.biz → LINE Messaging API (ฟรี)
- [ ] railway.app → สมัคร + connect GitHub (ฟรี)
- [ ] make.com → สมัคร (free tier)

ทั้งหมดนี้ใช้เวลา < 1 ชั่วโมง และฟรีทั้งหมด

---

*บทต่อไป: Chapter 6 — 30-Day Plan: เริ่มได้เลยพรุ่งนี้*
