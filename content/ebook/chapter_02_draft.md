# Chapter 2: AI Automation Framework — ระบบที่ทำงานแทนคุณ
> Draft v0.1 — 2026-05-16

---

## ก่อนเริ่ม: ข้อเท็จจริงที่ต้องรู้

AI ไม่ได้แทนที่คุณ — มันแทนที่งาน

คุณยังต้องอยู่เพื่อ: strategy, ความสัมพันธ์ลึกๆ, การตัดสินใจที่ซับซ้อน, creative direction

แต่งานอีก 60-70% ของวันทำงานของเจ้าของธุรกิจส่วนใหญ่คือ... งาน repeat ที่ AI ทำได้ดีกว่าและถูกกว่า

---

## The 3-Layer Automation Model

คิดถึงธุรกิจคุณเป็น 3 ชั้น:

```
┌─────────────────────────────────────┐
│ LAYER 3: DELIVER                    │
│ ส่งผลลัพธ์ให้ลูกค้าหรือทีม          │
│ (reply, notification, record, bill) │
├─────────────────────────────────────┤
│ LAYER 2: PROCESS                    │
│ วิเคราะห์ + ตัดสินใจ               │
│ (AI อ่าน intent, เลือก response)   │
├─────────────────────────────────────┤
│ LAYER 1: CAPTURE                    │
│ รับข้อมูลจากภายนอก                 │
│ (LINE message, form, DM, email)    │
└─────────────────────────────────────┘
```

**ทุก automation ต้องผ่านทั้ง 3 ชั้น**

ระบบที่ดีคือระบบที่ทำชั้น 1-3 ได้โดยอัตโนมัติ โดยมีคนเข้ามา handle เฉพาะ exception

---

## ทำแผนผัง "AI-able" tasks ของธุรกิจคุณ

**ก่อน implement ใดๆ ให้ทำ exercise นี้ก่อน:**

เขียน list งานทั้งหมดที่คุณหรือทีมทำใน 1 สัปดาห์ แล้ว categorize ตามกฎนี้:

### Zone A: AI ทำได้ 100% (Automate ทันที)
- คำตอบเดิมซ้ำๆ ทุกครั้ง
- ข้อมูลที่ fixed ไม่เปลี่ยน (ราคา, ที่อยู่, เวลาเปิด)
- Process ที่มี rules ชัดเจน (รับออเดอร์ตาม template)
- Notification ที่ trigger ตาม event

ตัวอย่าง Zone A:
✅ ตอบ FAQ (ราคา, โปร, การจัดส่ง)
✅ Confirm order รับ
✅ ส่ง payment info
✅ Reminder ก่อนนัด
✅ Welcome message ผู้ติดตามใหม่
✅ "เราปิดแล้ว จะตอบวันพรุ่งนี้" (นอกเวลา)

### Zone B: AI ช่วยได้บางส่วน (Augment)
- งานที่ต้องการ human judgment บางส่วน
- AI เตรียมข้อมูล คน decide ขั้นสุดท้าย
- Draft + Human Review

ตัวอย่าง Zone B:
🔶 คอมเพลน (AI รับทราบ + บันทึก, คน resolve)
🔶 Negotiate ราคา (AI ส่ง value pitch, คน approve ส่วนลด)
🔶 Custom order (AI เก็บ spec, คน confirm ทำได้ไหม)
🔶 Content creation (AI draft, คน edit + publish)

### Zone C: Human ต้องทำเอง (Keep Human)
- ความสัมพันธ์ที่ต้องการ empathy ลึก
- Decision ที่มี risk สูง
- Creative strategy
- Legal/ethical judgment

ตัวอย่าง Zone C:
❌ คุยกับลูกค้า VIP ที่ไม่พอใจหนัก
❌ ตัดสินใจ pricing ใหม่
❌ เจรจา partnership
❌ Brand strategy
❌ Creative direction

---

## Workshop: Map ธุรกิจของคุณ

ใช้ตารางนี้กรอก task ของคุณ:

| Task | Zone | เหตุผล | Priority |
|---|---|---|---|
| [กรอกงานของคุณ] | A/B/C | [เหตุผล] | High/Med/Low |

**เริ่ม automate จาก Zone A Priority High ก่อนเสมอ**

เพราะ:
- ผลเห็นเร็วที่สุด
- ความเสี่ยงต่ำที่สุด
- เรียนรู้ workflow ก่อนทำส่วนซับซ้อน

---

## 5 ประเภท Automation ที่ SME ต้องมี

### Type 1: Customer Response Automation
**ทำอะไร:** ตอบข้อความลูกค้าอัตโนมัติ 24/7

**ตัวอย่าง trigger → action:**
```
ลูกค้าถามราคา → AI ตอบราคา + value + CTA
ลูกค้าทักครั้งแรก → Welcome flow + qualify question
ลูกค้าบ่น → รับทราบ + notify ทีม
```

**Tools:** LINE OA + Gemini/Claude API

**ผลลัพธ์ที่คาดหวัง:**
- Response time: ชั่วโมง → วินาที
- Coverage: 9am-6pm → 24/7
- Consistency: แตกต่างตาม mood → เหมือนกันทุกครั้ง

---

### Type 2: Lead Capture Automation
**ทำอะไร:** เก็บข้อมูลลูกค้าใหม่โดยอัตโนมัติ

**ตัวอย่าง workflow:**
```
ลูกค้าทัก LINE → AI ถาม qualifying questions
ตอบครบ → บันทึก: ชื่อ, เบอร์, ธุรกิจ, budget, timeline
ส่งข้อมูลไป Google Sheets → ทีม Sales ดู
```

**Tools:** LINE OA + AI + Make.com + Google Sheets

**ผลลัพธ์:**
- ไม่มี lead หลุดอีก
- ทีม Sales ได้ข้อมูล qualified leads เท่านั้น
- Database ลูกค้าเพิ่มขึ้นอัตโนมัติ

---

### Type 3: Order Processing Automation
**ทำอะไร:** รับออเดอร์ + confirm + บันทึก โดยไม่ต้องคนจัดการ

**ตัวอย่าง workflow:**
```
ลูกค้าสั่งซื้อ → AI collect: สินค้า, ที่อยู่, เบอร์
Confirm order → AI ส่ง summary + bank account
ลูกค้าโอน → บันทึก order ใน Sheets
AI ส่ง "รับออเดอร์แล้ว" + ETA
```

**Tools:** LINE OA + AI + Google Sheets + LINE Notify (ไปทีม)

**ผลลัพธ์:**
- Order ถูกต้อง 100% (ไม่มีลืม/จดผิด)
- Process ชัดเจน ลูกค้า happy
- ทีมเห็น order real-time

---

### Type 4: Follow-up Automation
**ทำอะไร:** ติดตาม lead ที่ยังไม่ตัดสินใจ

**ตัวอย่าง workflow:**
```
ลูกค้าสนใจแต่ยังไม่ซื้อ → บันทึก status
3 วันผ่านไป → ส่ง follow-up: "มีคำถามเพิ่มมั้ยครับ?"
7 วันผ่านไป → ส่ง: "มีโปรสำหรับคุณโดยเฉพาะครับ"
14 วันผ่านไป → ส่ง: "ทักกลับมาได้เลยเมื่อพร้อมนะครับ"
```

**Tools:** Make.com + Google Sheets + LINE OA

**ผลลัพธ์:**
- Conversion เพิ่ม 15-30% จาก lead ที่เคย "หาย"
- ไม่ต้องจำว่าต้อง follow-up ใคร

---

### Type 5: Reporting Automation
**ทำอะไร:** สรุปข้อมูลสำคัญส่งให้คุณโดยอัตโนมัติ

**ตัวอย่าง workflow:**
```
ทุกวันจันทร์ 8:00 น. → LINE ส่งสรุป:
- จำนวน inquiry สัปดาห์ที่แล้ว: X
- Conversion rate: X%
- Orders: X รายการ
- Escalations: X ครั้ง (เรื่องอะไร)
- Top FAQ ที่ bot ตอบ
```

**Tools:** Make.com + Google Sheets + LINE Notify

**ผลลัพธ์:**
- ตัดสินใจจาก data ไม่ใช่ gut feeling
- รู้ปัญหาเร็ว ก่อนลุกลาม
- ประหยัดเวลา review งาน 2-3 ชม./สัปดาห์

---

## การจัดลำดับ: ทำอะไรก่อน

ใช้ ICE Score วิเคราะห์แต่ละ automation ก่อนตัดสินใจ:

| Automation | Impact (1-10) | Confidence (1-10) | Ease (1-10) | ICE Score |
|---|---|---|---|---|
| Customer Response | 9 | 9 | 8 | 648 |
| Lead Capture | 8 | 8 | 7 | 448 |
| Order Processing | 8 | 7 | 6 | 336 |
| Follow-up | 7 | 7 | 7 | 343 |
| Reporting | 6 | 8 | 8 | 384 |

**สำหรับธุรกิจส่วนใหญ่ เริ่มที่ Customer Response เสมอ**

เหตุผล:
- Impact สูงที่สุด (ลูกค้าเจอทุกวัน)
- Confidence สูง (pattern ชัดเจน)
- ง่ายสุด (ไม่ต้อง integrate อื่น)

---

## The "One Week Sprint" Rule

อย่าพยายาม automate ทุกอย่างพร้อมกัน

**กฎ:** ทำ 1 automation ต่อ sprint (1 สัปดาห์)

Sprint 1: Customer Response (LINE OA AI basic)
Sprint 2: เพิ่ม Order Processing
Sprint 3: เพิ่ม Lead Capture
Sprint 4: Follow-up + Reporting

**ทำไมต้องทำทีละอัน:**
- เรียนรู้ว่าอะไร work ก่อน scale
- Bug ง่ายกว่าหาตอน 1 ระบบกว่าตอน 5 ระบบ
- Momentum สำคัญ — win ทีละ sprint ดีกว่า overwhelm

---

## Action Step

ก่อนอ่าน Chapter 3 ทำสิ่งนี้:

**งาน 15 นาที:**
1. เปิด Notes / กระดาษ
2. เขียน 10 งานที่ทำซ้ำใน LINE ทุกสัปดาห์
3. ใส่แต่ละอันใน Zone A, B, หรือ C
4. Highlight 3 อันจาก Zone A ที่อยากทำก่อน

นั่นคือ roadmap automation แรก 3 สัปดาห์ของคุณ

---

*บทต่อไป: Chapter 3 — LINE OA AI: ตั้งระบบตอบลูกค้าใน 1 วัน (ไม่ต้อง code)*
