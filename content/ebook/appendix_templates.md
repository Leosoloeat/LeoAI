# Appendix — Templates & Checklists
> ส่วนนี้อยู่ใน ebook เป็น bonus content
> Print ออกมาหรือ save ไว้ใน Notes

---

## Appendix A: Checklist — งานอะไรที่ AI ทำแทนได้?

ทำเครื่องหมาย ✓ ทุกงานที่ทำซ้ำๆ ใน LINE ทุกสัปดาห์:

**ตอบคำถามลูกค้า**
[ ] ตอบราคาสินค้า/บริการ
[ ] ตอบเรื่องโปรโมชั่น
[ ] ตอบเรื่องการจัดส่ง/ที่อยู่
[ ] ตอบเรื่องขั้นตอนชำระเงิน
[ ] ตอบ FAQ ทั่วไป (เปิด-ปิด, บริการ, ขั้นตอน)
[ ] ตอบว่ามีสินค้าอะไรบ้าง
[ ] อธิบายความแตกต่างของสินค้า/บริการ

**รับออเดอร์ / นัดหมาย**
[ ] รับออเดอร์ + ยืนยันรายการ
[ ] ส่ง bank account / QR code
[ ] รับ slip + confirm ยอด
[ ] นัดวัน/เวลา + confirm
[ ] ส่ง reminder ก่อนนัด

**Follow-up**
[ ] ติดตาม lead ที่สนใจแต่ยังไม่ซื้อ
[ ] แจ้ง tracking number หลังส่งของ
[ ] ส่งข้อความขอบคุณหลังซื้อ
[ ] แจ้ง promotion ใหม่

**Admin**
[ ] ตอบ "ยังเปิดอยู่ไหม?" นอกเวลา
[ ] ส่ง "รับเรื่องแล้ว จะติดต่อกลับ"
[ ] บันทึกข้อมูลลูกค้าใหม่

**นับ:** ___ / 20 tasks = ___ % สามารถ automate ได้

---

## Appendix B: Worksheet — 3-Layer Automation Map

### ธุรกิจของฉัน: ____________________

**Layer 1: CAPTURE — ลูกค้าเข้ามาผ่านช่องทางไหน?**
[ ] LINE OA
[ ] Facebook Page / Group
[ ] Instagram DM
[ ] เว็บไซต์ (Form)
[ ] อีเมล
[ ] โทรศัพท์
[ ] อื่นๆ: _______________

**Layer 2: PROCESS — AI ต้องทำอะไรกับข้อมูลที่รับมา?**
[ ] ตอบคำถาม FAQ
[ ] Qualify lead (ถามข้อมูล)
[ ] รับออเดอร์ (collect ข้อมูลครบ)
[ ] นัดหมาย (confirm เวลา)
[ ] บันทึกข้อมูล
[ ] อื่นๆ: _______________

**Layer 3: DELIVER — ผลลัพธ์ส่งไปที่ไหน?**
[ ] Reply กลับหา customer ใน LINE
[ ] บันทึกใน Google Sheets
[ ] แจ้ง LINE Notify ไปทีม
[ ] ส่ง email
[ ] อัพเดท Calendar
[ ] อื่นๆ: _______________

**Priority Zone A tasks (automate ก่อน):**
1. _______________
2. _______________
3. _______________

---

## Appendix C: System Prompt Templates

### Template 1: ร้านค้าออนไลน์

```
คุณคือ [ชื่อ bot] ผู้ช่วยของร้าน [ชื่อร้าน]

IDENTITY
โทน: เป็นกันเอง ฉลาด ไม่ hard sell
ภาษา: ไทยเป็นหลัก ลงท้ายด้วย ครับ/ค่ะ เสมอ

PRODUCTS
[สินค้า 1]: ราคา [X] บาท / [รายละเอียด]
[สินค้า 2]: ราคา [X] บาท / [รายละเอียด]
[เพิ่มสินค้าทั้งหมด]

SHIPPING
ส่ง Kerry / Flash / J&T
ค่าส่ง [X] บาท ทั่วประเทศ
ออกของทุกวัน [เวลา]
ระยะเวลา [X-X] วันทำการ

PAYMENT
ธนาคาร: [ชื่อธนาคาร] เลขบัญชี [XXXXXXXXXX] ชื่อ [ชื่อ]
PromptPay: [เบอร์/เลขบัตร]

FAQ
Q: มีขนาดอะไรบ้าง?
A: [คำตอบ]

Q: สินค้ามีของแท้ไหม?
A: [คำตอบ]

[เพิ่ม FAQ ให้ครบอย่างน้อย 10 ข้อ]

RULES
- ตอบสั้น 3-5 ประโยค ต่อ reply
- จบทุก reply ด้วย 1 คำถาม
- ถ้าไม่รู้ บอก "เดี๋ยวให้ทีมติดต่อกลับภายใน 2 ชั่วโมงครับ"
- อย่าตอบเรื่องที่ไม่มีใน context นี้
```

---

### Template 2: คลินิก / บริการนัดหมาย

```
คุณคือ [ชื่อ bot] ผู้ช่วยของ [ชื่อคลินิก/ร้าน]

IDENTITY
โทน: เป็นมืออาชีพ อบอุ่น ให้ข้อมูล
ภาษา: ไทย ลงท้าย ครับ/ค่ะ

SERVICES
[บริการ 1]: ราคา [X] บาท / ระยะเวลา [X] นาที
[บริการ 2]: ราคา [X] บาท / ระยะเวลา [X] นาที
[เพิ่มบริการทั้งหมด]

HOURS
เปิด [วัน] เวลา [HH:MM] - [HH:MM]

BOOKING PROCESS
1. แจ้งบริการที่ต้องการ
2. เลือกวันและเวลา
3. ยืนยัน → ได้รับ confirmation

CANCELLATION
แจ้งยกเลิกก่อน [X] ชั่วโมง ไม่มีค่าปรับ
แจ้งล่าช้ากว่านั้น [นโยบาย]

FAQ
Q: ต้องจองล่วงหน้าไหม?
A: [คำตอบ]

[เพิ่ม FAQ ให้ครบ]

RULES
- ถ้าถามนัด → ถามก่อนว่าต้องการบริการอะไร + วันเวลาที่สะดวก
- ถ้า slot เต็ม → เสนอ slot ใกล้เคียง
- ถ้าไม่รู้ → บอก "เดี๋ยวให้ทีมติดต่อกลับครับ"
```

---

### Template 3: Freelancer / Agency

```
คุณคือ [ชื่อ bot] ผู้ช่วยของ [ชื่อ] / [ชื่อ Agency]

IDENTITY
โทน: มืออาชีพ เป็นกันเอง รู้จริง
ภาษา: ไทย / English ตามที่ลูกค้าใช้

SERVICES
[บริการ 1]: เริ่มต้น [ราคา] / [รายละเอียด]
[บริการ 2]: เริ่มต้น [ราคา] / [รายละเอียด]

PROCESS
1. Discovery call 30-60 นาที (ฟรี)
2. ส่ง proposal + timeline
3. Deposit 50% เริ่มงาน
4. Deliver → Revise → Final

PORTFOLIO
[link to portfolio]

DISCOVERY CALL BOOKING
ทักมาเพื่อนัด discovery call ได้เลยครับ

FAQ
Q: ทำใน [X วัน] ได้ไหม?
A: [คำตอบตามความเป็นจริง]

Q: ถ้าไม่พอใจงานทำยังไง?
A: [นโยบาย revision]

RULES
- ก่อนบอกราคา ถามก่อนว่า scope งานเป็นยังไง
- ถ้าต้องการ spec ชัดเจน → ส่ง brief template ให้กรอก
- นัด discovery call ก่อนตกลงทุกโปรเจกต์
```

---

## Appendix D: LINE OA AI Setup Checklist

### Phase 1: Accounts Setup
- [ ] สมัคร LINE OA (manager.line.biz)
- [ ] สมัคร LINE Developers account (developers.line.biz)
- [ ] สร้าง Provider ใน LINE Developers
- [ ] สร้าง Messaging API Channel
- [ ] Copy Channel Access Token (issue ใหม่ถ้าไม่มี)
- [ ] Copy Channel Secret

### Phase 2: AI Setup
- [ ] สมัคร Anthropic API หรือ Gemini API
- [ ] Copy API Key ไว้ใน secure note
- [ ] เขียน System Prompt (ใช้ template จาก Appendix C)
- [ ] ตรวจ: FAQ ครบ 10+ ข้อไหม?
- [ ] ตรวจ: Escalation phrase มีไหม?

### Phase 3: Deploy
- [ ] สมัคร Railway (railway.app)
- [ ] Fork template repo จาก GitHub
- [ ] Deploy ใน Railway → root directory ถูกไหม?
- [ ] ใส่ Environment Variables:
  - [ ] LINE_CHANNEL_ACCESS_TOKEN
  - [ ] LINE_CHANNEL_SECRET
  - [ ] ANTHROPIC_API_KEY หรือ GEMINI_API_KEY
- [ ] ตรวจ Deploy status = Success

### Phase 4: Connect
- [ ] Copy URL จาก Railway
- [ ] ไป LINE Developers → Messaging API → Webhook Settings
- [ ] ใส่ URL: `https://YOUR-APP.railway.app/callback`
- [ ] กด Verify → ต้องขึ้น Success
- [ ] Enable "Use webhook": ON
- [ ] Disable "Auto-reply messages": OFF

### Phase 5: Test
- [ ] ทัก bot ด้วย LINE ส่วนตัว
- [ ] ถาม 10 คำถามจาก FAQ
- [ ] ทดสอบ edge case: นอก FAQ, ภาษาอังกฤษ, คำหยาบ
- [ ] ทดสอบ escalation: ถาม "อยากคุยกับคนจริงๆ"
- [ ] ตรวจ response time: ต้อง < 10 วินาที

### Phase 6: Launch
- [ ] แจ้งทีมว่า bot จะ live
- [ ] เปิด bot สำหรับ LINE OA followers
- [ ] Monitor 24 ชั่วโมงแรกใกล้ชิด
- [ ] บันทึก: FAQ ที่ bot ตอบพลาด (จะ improve สัปดาห์ที่ 2)

---

## Appendix F: 30-Day Daily Checklist (ย่อ)

พิมพ์ออกมา tick ทุกวัน:

**Week 1:**
[ ] Day 1: Setup accounts (LINE OA, AI API, Railway)
[ ] Day 2: เปิด Messaging API + copy keys
[ ] Day 3: เขียน System Prompt ร่างแรก
[ ] Day 4: Deploy + ใส่ env vars
[ ] Day 5: Connect webhook + ทดสอบ
[ ] Day 6: Fix จุดที่ผิด + redeploy
[ ] Day 7: Soft launch + monitor วันแรก

**Week 2:**
[ ] Day 8-9: เก็บ failure log จาก real conversations
[ ] Day 10-11: อัพเดท FAQ + persona
[ ] Day 12-13: เพิ่ม Use Case ที่ 2
[ ] Day 14: Week 2 review + KPI check

**Week 3:**
[ ] Day 15-16: เชื่อม Google Sheets
[ ] Day 17: ตั้ง LINE Notify
[ ] Day 18-19: Follow-up sequence
[ ] Day 20-21: Reporting automation

**Week 4:**
[ ] Day 22-23: วัดผล 30 วัน (กรอก KPI scorecard)
[ ] Day 24: คำนวณ ROI
[ ] Day 25-27: แผน Month 2
[ ] Day 28-29: Bot v2.0 + อัพเดท
[ ] Day 30: Celebrate + next milestone planning

---

## Appendix G: Resource Links

**AI APIs**
- Gemini API (ฟรี): aistudio.google.com
- Anthropic Claude API: console.anthropic.com
- OpenRouter (multi-model): openrouter.ai

**LINE Developers**
- LINE OA Manager: manager.line.biz
- LINE Developers Console: developers.line.biz
- LINE Messaging API Docs: developers.line.biz/en/docs/messaging-api

**Deploy**
- Railway: railway.app
- Vercel (web): vercel.com
- GitHub (code): github.com

**Automation**
- Make.com: make.com
- n8n (self-hosted): n8n.io
- Google Sheets: sheets.google.com

**Template Code (Bot)**
- LeoSP Template: github.com/Leosoloeat/LeoAI/tree/main/LeoSP

**Contact Leo Ai**
- LINE OA: @leoai [อัพเดท]
- Email: keizaba1@gmail.com
- TikTok: @leoai [อัพเดท]
