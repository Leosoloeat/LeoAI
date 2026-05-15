# Chapter 6: 30-Day AI Automation Plan — เริ่มได้เลยพรุ่งนี้
> Draft v0.1 — 2026-05-16

---

ถึงตอนนี้คุณรู้แล้ว:
- ทำไม AI ถึงสำคัญตอนนี้ (Chapter 1)
- Framework ที่ใช้ auto (Chapter 2)
- วิธีตั้ง LINE OA AI (Chapter 3)
- Use cases จริงๆ (Chapter 4)
- Tools ที่ต้องใช้ (Chapter 5)

เหลือแค่อย่างเดียว: **ลงมือทำ**

30 วันข้างหน้าจะเปลี่ยนว่าธุรกิจคุณทำงานยังไง

---

## วิธีใช้ Chapter นี้

อย่าพยายามทำทุกอย่างในวันเดียว

Plan นี้ออกแบบให้ทำทีละ chunk เล็กๆ ต่อวัน

แต่ละ task ใช้เวลาไม่เกิน 30-60 นาที

Print ออกมาหรือ save ไว้ใน phone — tick ทุกวันที่ทำเสร็จ

---

## WEEK 1: Setup (วันที่ 1-7)

### วันที่ 1 — LINE Foundation
- [ ] สมัคร LINE OA ถ้ายังไม่มี (manager.line.biz)
- [ ] สมัคร Anthropic API หรือ Gemini API (อย่างใดอย่างหนึ่ง)
- [ ] สมัคร Railway.app (free tier เพียงพอ)
- [ ] เขียน: "งานที่ฉันทำซ้ำๆ ใน LINE ทุกวัน" (list ออกมา 10 อย่าง)

### วันที่ 2 — เปิด Messaging API
- [ ] ไป developers.line.biz → สร้าง Provider + Channel
- [ ] Copy Channel Access Token + Channel Secret
- [ ] เก็บไว้ใน secure note

### วันที่ 3 — เขียน AI Persona (ส่วนที่สำคัญที่สุด)
- [ ] เขียน System Prompt ร่างแรก (ใช้ template จาก Chapter 3)
- [ ] ใส่ชื่อ bot + โทน + ภาษา
- [ ] ใส่ Products/Services ทั้งหมดพร้อมราคา
- [ ] เขียน FAQ อย่างน้อย 10 ข้อ (ดูจาก LINE history เดิม)

### วันที่ 4 — Deploy
- [ ] Fork template code จาก GitHub (link ใน appendix)
- [ ] Deploy บน Railway
- [ ] ใส่ environment variables
- [ ] ตรวจว่า deploy สำเร็จ (ไป URL → ต้องเห็น "ok")

### วันที่ 5 — Connect + First Test
- [ ] ใส่ Webhook URL ใน LINE Developers Console
- [ ] Verify webhook → ต้องผ่าน
- [ ] ทักหา bot ด้วย LINE ส่วนตัว: ถาม 10 คำถามจาก FAQ
- [ ] Note: อะไรตอบดี, อะไรต้องแก้

### วันที่ 6 — Fix + Improve
- [ ] แก้ FAQ ที่ bot ตอบผิดหรือไม่ครบ
- [ ] เพิ่มคำถาม edge case ที่นึกออก
- [ ] Redeploy + ทดสอบอีกรอบ

### วันที่ 7 — Soft Launch
- [ ] บอกทีมว่า bot จะ live
- [ ] เปิด bot อย่างเป็นทางการ
- [ ] Monitor inbox ใกล้ชิด ทั้งวัน

---

## WEEK 2: Optimize (วันที่ 8-14)

### วันที่ 8-9 — Collect Failures
- [ ] เปิด LINE OA → ดู conversation ทุกอันที่ bot escalate
- [ ] เขียน list: "คำถามที่ bot ยังตอบไม่ได้"
- [ ] Categorize: ข้อมูลไม่มี / เข้าใจผิด / edge case

### วันที่ 10-11 — Improve FAQ
- [ ] เพิ่ม FAQ จาก list ที่เก็บมา
- [ ] ปรับ tone ถ้า bot ฟังดู formal เกิน
- [ ] เพิ่ม escalation phrase ถ้าต้องการ

### วันที่ 12 — เพิ่ม Use Case ที่ 2
เลือกอย่างใดอย่างหนึ่ง:
- [ ] รับออเดอร์ → Google Sheets integration
- [ ] นัดหมาย → Google Calendar integration
- [ ] ส่ง promotion → broadcast setup

### วันที่ 13 — ทดสอบ Use Case ใหม่
- [ ] Test workflow ทั้งหมดด้วยตัวเอง
- [ ] ให้คนในทีม test (หรือเพื่อน)
- [ ] Fix จุดที่สะดุด

### วันที่ 14 — Week 2 Review
- [ ] นับ: bot handle กี่ % ของ inbox ทั้งหมด
- [ ] นับ: response time เฉลี่ยเปลี่ยนไปยังไง
- [ ] เขียน: สิ่งที่ต้อง improve ใน Week 3

---

## WEEK 3: Automate Deeper (วันที่ 15-21)

### วันที่ 15-16 — Connect Google Sheets
- [ ] สร้าง Google Sheet สำหรับ orders/appointments
- [ ] เชื่อม bot กับ Sheets (via Make.com หรือ n8n)
- [ ] Test: bot รับ order → ข้อมูลขึ้น Sheets

### วันที่ 17 — ตั้ง LINE Notify
- [ ] LINE Notify alert เมื่อ bot escalate
- [ ] Notify เมื่อ order ใหม่เข้า
- [ ] Test notification ทุก trigger

### วันที่ 18-19 — Follow-up Sequence
- [ ] Identify: ลูกค้าที่สนใจแต่ยังไม่ตัดสินใจ
- [ ] ตั้ง reminder ผ่าน Make: ส่ง message หลัง 2 วัน
- [ ] Message: เป็นกันเอง ไม่ hard sell (ตัวอย่างใน appendix)

### วันที่ 20-21 — Automate Reporting
- [ ] ตั้ง weekly summary: orders, response rate, escalations
- [ ] ส่งมาให้คุณทุกวันจันทร์เช้าอัตโนมัติ
- [ ] Review report ครั้งแรก

---

## WEEK 4: Measure + Plan Next (วันที่ 22-30)

### วันที่ 22-23 — วัดผล
กรอก KPI 30-day scorecard:

| KPI | ก่อน bot | หลัง bot | เปลี่ยนไป |
|---|---|---|---|
| Response time เฉลี่ย | ___ | ___ | ___ |
| % inbox ที่ bot handle | 0% | ___ | +___% |
| Missed inquiries/สัปดาห์ | ___ | ___ | -___% |
| Orders/สัปดาห์ | ___ | ___ | +___% |
| เวลาตอบ LINE/วัน (คน) | ___ | ___ | -___ชม. |

### วันที่ 24 — ROI Calculation
- [ ] เวลาที่ประหยัดได้ × ค่าเวลา/ชม. ของคุณ = value ต่อเดือน
- [ ] Revenue ที่เพิ่มขึ้น (ถ้าวัดได้)
- [ ] เทียบกับ setup cost = ROI %

### วันที่ 25-26 — แผน Month 2
จาก data ที่เก็บมา เลือก 2 อย่างที่จะ improve ใน Month 2:

Options:
- [ ] เพิ่ม channel (IG / FB ชั่วคราว)
- [ ] Upsell flow สำหรับลูกค้าเดิม
- [ ] More complex automation (payment, CRM)
- [ ] Multi-language support (ถ้า serve ลูกค้าต่างชาติ)
- [ ] Broadcast + segmentation

### วันที่ 27-28 — Improve Bot v2.0
- [ ] อัพเดท FAQ จาก 1 เดือนที่ผ่านมา
- [ ] เพิ่มรายละเอียดสินค้า/บริการใหม่
- [ ] ปรับ persona ตาม feedback ที่ได้

### วันที่ 29 — Share Results
- [ ] บอกทีมผลลัพธ์ที่เกิดขึ้น
- [ ] ถ้ามี case study ที่ดี → เก็บไว้เป็น testimonial
- [ ] ถ่ายรูป / screenshot ตัวเลขที่น่าสนใจ (สำหรับ content)

### วันที่ 30 — Celebrate + Plan Month 3
- [ ] คุณทำสำเร็จ — ธุรกิจมีระบบ AI ที่ทำงาน 24/7 แล้ว
- [ ] เขียน: สิ่งที่เรียนรู้ใน 30 วัน (3 อย่าง)
- [ ] วางแผน: อยากให้ระบบทำอะไรได้เพิ่มใน Month 3?

---

## เมื่อถึง Day 30 — คุณจะมี:

✅ LINE OA AI ที่ทำงาน 24/7 ไม่มีวันหยุด
✅ Inbox ที่จัดการได้ 70-90% โดยไม่ต้องแตะ
✅ Data ออเดอร์/appointment ที่เป็นระบบ
✅ เวลาหลายชั่วโมง/วันที่ได้คืนมา
✅ ความเข้าใจว่าจะ scale ต่อยังไง

และที่สำคัญที่สุด:

ธุรกิจที่ทำงานแม้คุณจะไม่อยู่

---

## หลังจาก 30 วัน — ขั้นตอนต่อไป

**ถ้าทำด้วยตัวเอง:**
- ต่อยอดด้วย automation เพิ่ม (Chapter 2 revisit)
- เพิ่ม channel ตาม priority (channels.md framework)
- Scale ไปที่ enterprise feature เมื่อพร้อม

**ถ้าอยากมีคนช่วย optimize:**
- ผมทำ bot audit ฟรีให้คุณ: ดูว่าระบบคุณมี gap อะไร
- ทักมาที่ LINE OA @leoai พร้อมบอกว่า "30 day done"
- เดี๋ยว review ให้ฟรีครับ

**ถ้าอยากให้คนทำทั้งหมดให้:**
- ผมรับทำ LINE OA AI setup เต็มรูปแบบ
- ดู service tiers ใน appendix G

---

*นี่คือ Chapter สุดท้ายของ ebook ครับ*
*แต่มันเป็นแค่จุดเริ่มต้นของการเปลี่ยนแปลงของธุรกิจคุณ*
