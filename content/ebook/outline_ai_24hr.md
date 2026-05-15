# Ebook Outline: "AI ทำงานแทนคุณ 24 ชั่วโมง"
> ฉบับร่าง v0.1 — 2026-05-16
> Target: เจ้าของธุรกิจ SME, ร้านค้าออนไลน์, freelancer
> ความยาวเป้าหมาย: 40-60 หน้า (PDF) / ~15,000 คำไทย
> รูปแบบ: PDF + digital download

---

## POSITIONING

**Big Promise:** ตั้ง AI ให้ทำงานแทนคุณได้ใน 7 วัน โดยไม่ต้อง code แม้แต่บรรทัดเดียว

**Who It's For:**
- เจ้าของร้านออนไลน์ที่ตอบ LINE ทุกวัน
- SME ที่ทีมน้อยแต่งานเยอะ
- Freelancer ที่อยากมีเวลาให้งานที่สำคัญกว่า
- คนที่เคย "ลอง AI" แต่ไม่รู้จะใช้ยังไงจริงๆ

**What They Get:**
- Framework + checklist + templates พร้อมใช้
- ไม่มีทฤษฎีเกินจำเป็น — ทุก chapter จบด้วย action step

---

## EBOOK STRUCTURE

### INTRO: "คืนนั้นที่เปลี่ยนทุกอย่าง"
*ความยาว: 1-2 หน้า*

เปิดด้วยเรื่องเล่า: Leo ตอบ LINE ลูกค้า ตี 2 คนเดียว
→ จุดเปลี่ยน: ลองให้ AI ตอบแทน 1 คืน
→ Promise: "ถ้าคุณทำตาม 7 ขั้นตอนในเล่มนี้ คุณจะไม่ต้องนั่งตอบ LINE อีก"

---

### CHAPTER 1: ทำไม AI ถึงสำคัญกับธุรกิจคุณตอนนี้ (ไม่ใช่อีก 5 ปี)
*ความยาว: 4-5 หน้า*

**Pain Points:**
- เวลา 24 ชั่วโมงมีจำกัด แต่ลูกค้าไม่มีเวลาว่าง
- Talent shortage: หาคนดีทำงาน admin ยาก ค่าแรงสูง
- โอกาสที่หายไปทุกครั้งที่ตอบช้า

**AI กำลังเปลี่ยนเกม:**
- ไม่ใช่แค่ chatbot ธรรมดา — เป็น intelligent assistant
- ต้นทุนเริ่มลงถึงจุดที่ SME ใช้ได้จริง
- คู่แข่งของคุณกำลังเริ่มใช้อยู่ตอนนี้

**The Window:**
- 2024-2026 = ช่วงที่ Early Adopters ได้เปรียบมากที่สุด
- หลังจากนี้ทุกคนใช้ → ไม่ใช่ข้อได้เปรียบอีกต่อไป

**Action Step:**
- เขียนรายการ: "งานอะไรที่คุณทำซ้ำๆ ทุกวัน?" (checklist template ใน appendix)

---

### CHAPTER 2: AI Automation Framework — ระบบที่ทำงานแทนคุณ
*ความยาว: 6-8 หน้า*

**The 3-Layer Model:**
```
Layer 1 — CAPTURE:    รับข้อมูลจากลูกค้า (LINE, form, DM)
Layer 2 — PROCESS:    AI วิเคราะห์ + ตัดสินใจ
Layer 3 — DELIVER:    ส่งผลลัพธ์ (reply, notify, record)
```

**ระบบ Automation 5 ประเภทที่ SME ต้องมี:**
1. Customer Response Automation — ตอบ LINE อัตโนมัติ
2. Lead Capture Automation — เก็บข้อมูลลูกค้าอัตโนมัติ
3. Order Processing Automation — รับออเดอร์ + ส่ง confirm
4. Follow-up Automation — ติดตาม lead ที่ยังไม่ตัดสินใจ
5. Reporting Automation — สรุปยอด / รายงาน ส่งให้คุณเอง

**The "24/7 Rule":**
- ทุก process ที่ AI ทำได้ ให้ AI ทำ
- คุณแค่ handle สิ่งที่ AI ทำไม่ได้: เจรจาซับซ้อน, ความสัมพันธ์, strategy

**Action Step:**
- Map ธุรกิจของคุณด้วย 3-Layer Model (worksheet template ใน appendix)

---

### CHAPTER 3: LINE OA AI — ตั้งระบบตอบลูกค้าใน 1 วัน
*ความยาว: 8-10 หน้า*

*นี่คือ chapter ที่ขาย LINE OA AI service ทางอ้อม*

**ทำไม LINE OA คือจุดเริ่มต้นที่ดีที่สุด:**
- คนไทย 95% ใช้ LINE
- ลูกค้าทักมาใน LINE มากกว่า email 10 เท่า
- ROI ชัดที่สุด: ตอบเร็วกว่า = ปิดดีลได้มากกว่า

**ขั้นตอน Setup (Step-by-Step):**

Step 1: สร้าง LINE OA account (10 นาที)
- ไปที่ manager.line.biz
- เลือก Account Type: "Business"
- Verify ด้วยเบอร์โทรศัพท์

Step 2: เชื่อม Messaging API (15 นาที)
- ไป LINE Developers Console
- สร้าง Provider → Channel → Messaging API
- Copy Channel Access Token + Channel Secret

Step 3: ตั้ง AI System Prompt (30 นาที)
- เขียน persona ของ bot: ชื่อ, โทน, สิ่งที่ตอบได้/ไม่ได้
- ใส่ข้อมูลสินค้า/บริการ/ราคา
- ตัวอย่าง prompt template (ในหน้าถัดไป)

Step 4: Deploy บน Railway (20 นาที)
- Fork template code จาก GitHub (link ใน appendix)
- ตั้ง env vars: API Keys
- Webhook URL → LINE Console

Step 5: ทดสอบ + เปิดใช้งาน (10 นาที)
- ทัก bot ตัวเอง 10 คำถาม
- ตรวจว่าตอบถูกต้อง
- เปิด webhook = พร้อมใช้งาน

**System Prompt Template:**
```
คุณคือ [ชื่อ bot] ผู้ช่วยของ [ชื่อธุรกิจ]
โทน: เป็นกันเอง ฉลาด ไม่ hard sell
ภาษา: ไทยเป็นหลัก

สินค้า/บริการ: [รายการ + ราคา]

กฎการตอบ:
- ตอบสั้น 3-5 ประโยค
- ถามกลับ 1 คำถามเสมอ
- ถ้าไม่รู้ บอก "เดี๋ยวให้ทีมติดต่อกลับครับ"
```

**ประมาณการ ROI:**
- ลด admin เวลา: 2-4 ชั่วโมง/วัน
- ตอบเร็วขึ้น: 2 ชม. → 2 วินาที
- Conversion เพิ่ม: ตอบเร็ว = ปิดดีลได้เพิ่ม 20-40%

**Action Step:**
- Checklist: LINE OA AI Setup (สมบูรณ์ใน appendix)

---

### CHAPTER 4: Automation ที่ใช้ได้จริง — 5 Use Cases สำหรับ SME ไทย
*ความยาว: 8-10 หน้า*

**Use Case 1: ร้านค้าออนไลน์ (Facebook/LINE)**
- Pain: รับออเดอร์ช้า ลืม confirm ลูกค้าหาย
- Solution: Bot รับออเดอร์ + ส่ง bank account + confirm → บันทึก Google Sheets
- Tool stack: LINE OA + AI + Make/n8n + Google Sheets
- ผลลัพธ์จริง: ลด missed orders 90%

**Use Case 2: คลินิก / บริการนัดหมาย**
- Pain: โทรนัดยุ่ง เบอร์ไม่รับ ลืมนัด
- Solution: Bot รับนัด + ส่ง reminder 1 วันก่อน + confirm
- Tool stack: LINE OA + AI + Google Calendar + Sheets
- ผลลัพธ์จริง: No-show rate ลด 60%

**Use Case 3: Freelancer / Agency**
- Pain: ตอบ brief เดิมซ้ำๆ ทุกวัน
- Solution: Bot อธิบาย service + ส่ง portfolio + นัดคุย
- Tool stack: LINE OA + AI + Calendly
- ผลลัพธ์จริง: ประหยัดเวลา qualify leads 3 ชม./วัน

**Use Case 4: ร้านอาหาร / Delivery**
- Pain: รับออเดอร์ทาง LINE แล้ว chaos
- Solution: Bot รับออเดอร์ structured + ส่ง order sheet ให้ครัว
- Tool stack: LINE OA + AI + Google Sheets
- ผลลัพธ์จริง: ออเดอร์ผิดลด 80%

**Use Case 5: Property / Real Estate**
- Pain: Lead จำนวนมาก filter ช้า
- Solution: Bot qualify lead (งบ, ทำเล, เวลา) → ส่งต่อเฉพาะ hot lead ให้ทีม
- Tool stack: LINE OA + AI + CRM / Sheets
- ผลลัพธ์จริง: Sales team ประหยัดเวลา 50%

**Action Step:**
- เลือก 1 use case ที่ตรงที่สุด → ดู checklist ใน appendix

---

### CHAPTER 5: Tools ที่คุณต้องรู้ (และไม่ต้องรู้)
*ความยาว: 5-6 หน้า*

**AI Models ที่ใช้ในปี 2025:**
| Tool | ใช้ทำอะไร | ราคา |
|---|---|---|
| Gemini 2.5 Flash | ตอบ LINE OA, general Q&A | ฟรีมาก |
| Claude Sonnet | Knowledge base, grounding | ถูก, แม่นยำสูง |
| ChatGPT-4o | Content, writing | ราคาปานกลาง |
| OpenRouter | รวม models เยอะ | จ่ายตาม usage |

**Automation Tools:**
| Tool | ใช้ทำอะไร | ราคา |
|---|---|---|
| Make (Integromat) | เชื่อม apps โดยไม่ต้อง code | Free tier มี |
| n8n | Self-host, ยืดหยุ่นกว่า | ฟรีถ้า self-host |
| Zapier | ง่ายที่สุด แต่แพงสุด | Free tier จำกัด |

**Storage/Database:**
| Tool | ใช้ทำอะไร |
|---|---|
| Google Sheets | CRM อย่างง่าย, ฟรี |
| Notion | Knowledge base |
| Supabase | Database ถ้าต้องการ scale |

**ไม่ต้องรู้อะไร:**
- Python / JavaScript — ไม่จำเป็น
- Server management — ใช้ Railway/Vercel
- Machine learning — ใช้ API พร้อมใช้ได้เลย

**Action Step:**
- สมัคร Make + Gemini API (ทั้งสองฟรี) — link ใน appendix

---

### CHAPTER 6: 30-Day AI Automation Plan — เริ่มได้เลยพรุ่งนี้
*ความยาว: 6-8 หน้า*

**Week 1: Setup (วันที่ 1-7)**
- Day 1: สมัคร LINE OA + Gemini API
- Day 2-3: ตั้ง system prompt + test
- Day 4-5: Deploy + webhook connect
- Day 6-7: Test + แก้จุดบกพร่อง

**Week 2: Optimize (วันที่ 8-14)**
- Day 8-9: เก็บ log คำถามที่ bot ตอบผิด
- Day 10-11: ปรับ prompt ให้แม่นยำขึ้น
- Day 12-14: เพิ่ม use case ที่ 2 (เช่น นัดหมาย)

**Week 3: Automate (วันที่ 15-21)**
- Day 15-17: เชื่อม Make → Google Sheets
- Day 18-19: ตั้ง order workflow อัตโนมัติ
- Day 20-21: ตั้ง follow-up sequence

**Week 4: Scale (วันที่ 22-30)**
- Day 22-24: วัดผล — orders, response time, conversion
- Day 25-27: เพิ่มฟีเจอร์ตามที่ลูกค้าขอ
- Day 28-30: วางแผนขั้นตอนต่อไป

**KPI ที่ควรวัดทุกสัปดาห์:**
- จำนวน messages ที่ bot ตอบ (vs ตอบเอง)
- Response time: เฉลี่ยกี่วินาที
- Escalation rate: % ที่ต้องให้คนช่วย
- Conversion rate: chat → purchase

**Action Step:**
- Print / save 30-Day Checklist (ใน appendix)

---

### CONCLUSION: ธุรกิจที่ไม่หยุดทำงานแม้คุณนอนหลับ
*ความยาว: 1-2 หน้า*

สรุป: AI ไม่ใช่เรื่องซับซ้อน — มันคือ system ที่คุณออกแบบครั้งเดียว แล้วทำงานแทนคุณตลอดไป

ขั้นตอนต่อไป:
- ถ้าอยากทำเอง: เริ่ม Week 1 checklist พรุ่งนี้เช้า
- ถ้าอยากให้ผู้เชี่ยวชาญช่วย: นัดคุย 20 นาทีกับ Leo (ฟรี, ไม่มีข้อผูกมัด)
- ถ้ายังไม่พร้อม: ติดตาม Leo Ai ที่ LINE OA / TikTok

Soft CTA: "ทักมาที่ LINE OA: @leoai (หรือลิงก์ใน QR code)"

---

## APPENDIX
- A: Checklist: งานอะไรที่ AI ทำแทนได้
- B: Worksheet: 3-Layer Automation Map
- C: System Prompt Template (3 versions: ร้านค้า / คลินิก / freelancer)
- D: LINE OA AI Setup Checklist (Step-by-step)
- E: Use Case Checklist (เลือกใช้ตาม use case)
- F: 30-Day Action Plan Checklist
- G: Resource Links (API, tools, templates)

---

## PRODUCTION NOTES

**Format:** PDF, A4, 2 columns
**Design:** Dark premium (สอดคล้อง Leo Ai brand)
**Price point:** ตั้งราคา 297-497 บาท (ถ้าขาย) หรือ free lead magnet
**Lead magnet strategy:**
- ให้ฟรีเพื่อเก็บ email + LINE → ขาย service ต่อ
- หรือขาย 297 บาท แต่ upsell ไปที่ LINE OA AI service

**Chapter ที่เขียนก่อน (เรียงตาม impact):**
1. Chapter 3 — มี how-to ชัดสุด, ช่วย convert ไป LINE OA AI service
2. Chapter 1 — สร้าง urgency + convince ให้อ่านต่อ
3. Chapter 6 — 30-Day plan, actionable มาก
4. Chapter 4 — social proof จาก use cases
5. Chapter 2, 5 — supporting framework
