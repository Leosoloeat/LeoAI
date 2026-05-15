# Chapter 4: Automation ที่ใช้ได้จริง — 5 Use Cases สำหรับธุรกิจไทย
> Draft v0.1 — 2026-05-16
> Note: Case studies ด้านล่างเป็น composite examples จากธุรกิจในหลายอุตสาหกรรม
> ตัวเลขเป็นค่าเฉลี่ย ผลลัพธ์จริงขึ้นอยู่กับธุรกิจแต่ละราย

---

มาถึงตรงนี้คุณรู้แล้วว่า AI ทำอะไรได้

ตอนนี้เรามาดูว่า **ธุรกิจจริงๆ ใช้มันยังไง**

Use cases ด้านล่างไม่ใช่ทฤษฎี — เป็น pattern ที่เห็นซ้ำๆ จากธุรกิจหลายประเภทที่ implement ระบบ AI LINE OA แล้วเห็นผลจริง

---

## Use Case 1: ร้านขายของออนไลน์ / E-commerce

**Pain เดิม:**
เจ้าของร้านขายเสื้อผ้า online 1 คน
รับออเดอร์ผ่าน LINE, FB, IG พร้อมกัน
วันๆ หนึ่งตอบข้อความ 150-250 รายการ
80% เป็นคำถามซ้ำกัน: ราคา, ไซส์, ส่งไหน, จ่ายยังไง

**ผลที่เกิด:**
- ตอบช้า → ลูกค้าหาย
- ตอบผิด (เพราะเหนื่อย) → return + review แย่
- ไม่มีเวลาทำ content → acquisition ติด

**Solution ที่ implement:**

LINE OA AI ที่รู้จัก:
- สินค้าทั้งหมด 200+ รายการ (ผ่าน Google Sheets sync)
- ราคา + stock realtime
- โปรโมชั่นประจำสัปดาห์
- ขั้นตอนสั่งซื้อ + ธนาคาร
- ระยะเวลาจัดส่ง + tracking

Bot workflow:
```
ลูกค้าทัก → Bot ถามว่าอยากรู้อะไร
ถามราคา → Bot ตอบ + แนะนำ bundle
อยากสั่ง → Bot collect: ชื่อ, ที่อยู่, สินค้า
confirm → Bot ส่ง bank info + slip slot
ชำระ → Bot บันทึก order ใน Google Sheets
จัดส่ง → Bot ส่ง tracking number auto
```

**ผลลัพธ์หลัง 30 วัน:**
- Bot handle 85% ของ inbox โดยไม่ต้องให้คนช่วย
- Response time: 45 นาที → 3 วินาที
- Missed orders: 8-12/สัปดาห์ → 0-1/สัปดาห์
- เวลาที่ได้คืน: 4-5 ชั่วโมง/วัน → ใช้ไปทำ content
- Conversion rate เพิ่ม 23% จาก response ที่เร็วขึ้น

**เหมาะกับ:** ร้านขายเสื้อผ้า, เครื่องสำอาง, อาหารเสริม, สินค้า handmade

---

## Use Case 2: คลินิก / ร้านบริการนัดหมาย

**Pain เดิม:**
คลินิกนวด/สปา ทีม 3 คน
รับนัดผ่าน LINE + โทรศัพท์
ปัญหา: คิวซ้อน, no-show 30%, นัดผิดเวลา

**ผลที่เกิด:**
- โต๊ะว่างเปล่าเพราะลูกค้า no-show
- Admin ใช้เวลา 3 ชม./วันกับการโทรนัด-ยืนยัน
- ลูกค้าใหม่โทรมาช่วง rush hour — ไม่มีคนรับ

**Solution ที่ implement:**

LINE OA AI + Google Calendar integration:
```
ลูกค้าทัก → Bot แสดง slot ว่างของสัปดาห์
เลือกวัน/เวลา → Bot จอง + confirm ทันที
1 วันก่อนนัด → Bot ส่ง reminder อัตโนมัติ
ลูกค้า confirm → Bot บันทึก ✅
ลูกค้าขอเลื่อน → Bot เปิด slot ใหม่ + re-book
ไม่ตอบใน 2 ชั่วโมง → ทีม follow-up
```

**ผลลัพธ์หลัง 30 วัน:**
- No-show rate: 30% → 8% (reminder ทำงาน)
- Admin เวลา: 3 ชม./วัน → 30 นาที
- Missed calls (ช่วง peak): หายไป — bot รับแทน
- Booking ผ่าน LINE เพิ่ม 40% (ลูกค้าชอบ chat กว่าโทร)

**เหมาะกับ:** คลินิก, ร้านนวด/สปา, ร้านตัดผม, studio ฟิตเนส, ทันตกรรม

---

## Use Case 3: Freelancer / Agency

**Pain เดิม:**
Freelancer graphic design คนเดียว
งาน inbound มาจาก LINE ตลอด
ใช้เวลา 2-3 ชม./วันกับ: ตอบ brief เดิม, ส่งราคา, อธิบาย process, ตามงาน

**ผลที่เกิด:**
- เวลาทำงานจริงน้อยลง
- ราคาเสนอช้า → โปรเจกต์หลุดไปคู่แข่ง
- Client เดิมรู้สึกว่าให้ความสำคัญน้อย

**Solution ที่ implement:**

LINE OA AI ที่ทำหน้าที่เป็น "receptionist":
```
Client ทัก → Bot ถาม: งานประเภทไหน? timeline? budget?
ตอบครบ → Bot ส่ง portfolio ที่ตรงกับงานนั้น
สนใจ → Bot แนะนำให้นัด discovery call
ระหว่างรอ → Bot ส่ง brief template ให้กรอก
หลังนัด → Bot ส่ง proposal draft timeline
```

Calendly integration สำหรับ discovery call:
- ลูกค้าจอง slot เอง
- Auto remind ก่อน 1 วัน
- หลัง call → Bot ติดตามว่าตัดสินใจยัง

**ผลลัพธ์หลัง 30 วัน:**
- ประหยัดเวลา qualify: 2.5 ชม./วัน → 20 นาที
- ราคาเสนอ: ช้า 2 วัน → ภายใน 4 ชั่วโมง (bot เก็บข้อมูลก่อน)
- Proposal rate เพิ่ม 35% (ลูกค้าได้ข้อมูลครบก่อนคุย)
- Client รู้สึก "ร้านมีระบบ" → ไว้วางใจมากขึ้น

**เหมาะกับ:** Graphic design, copywriting, photo/video, web development, consulting

---

## Use Case 4: ร้านอาหาร / Delivery

**Pain เดิม:**
ร้านอาหารที่รับสั่งผ่าน LINE + Grab + Foodpanda พร้อมกัน
ปัญหา: order LINE ผิด, จำรายละเอียดไม่ได้, chaos ช่วง lunch

**ผลที่เกิด:**
- Order ผิด → waste วัตถุดิบ + ลูกค้าไม่พอใจ
- Peak hour: คนรับ LINE ไม่ทัน → หายไป
- ไม่รู้ว่า delivery หรือมาเอง → จัดการ logistics ผิด

**Solution ที่ implement:**

LINE OA AI สำหรับรับ order:
```
ลูกค้าทัก → Bot ส่ง menu (Rich message / image)
เลือกเมนู → Bot ถาม: จำนวน, ตัวเลือก (เผ็ดมาก/น้อย)
Delivery หรือ pick-up? → ถ้า delivery ถามที่อยู่
ยืนยัน order → Bot สรุปและส่ง order form ไปที่ครัว
(Google Sheets หรือ LINE Notify ไปครัว)
รับเงิน → Bot ส่ง promptpay / บัญชีธนาคาร
เสร็จ → Bot แจ้ง ETA
```

**ผลลัพธ์หลัง 30 วัน:**
- Order ผิดลด: 15 รายการ/สัปดาห์ → 2-3 รายการ
- LINE order ช่วง peak: ไม่มีตก (bot รับแทน)
- เวลาพนักงานรับ order: ลด 60%
- Order volume ผ่าน LINE เพิ่ม 25% (เพราะ process ง่ายขึ้น)

**เหมาะกับ:** ร้านอาหาร, คาเฟ่, เบเกอรี่, catering, cloud kitchen

---

## Use Case 5: อสังหาริมทรัพย์ / Property

**Pain เดิม:**
Agency property ทีม 4 คน
Lead จาก Facebook ads 200-300/เดือน
Qualify ช้า → ทีมใช้เวลาโทรหา lead เกือบทั้งวัน

**ผลที่เกิด:**
- Unqualified lead กินเวลา sales team มาก
- Hot lead รอนานเกินไป → ไปหา agency อื่น
- ทีมเหนื่อย + ขาด focus

**Solution ที่ implement:**

LINE OA AI สำหรับ lead qualification:
```
Lead ทัก (จาก FB ads → LINE) → Bot ทำ discovery:
"ที่พักที่สนใจอยู่แถวไหนครับ?"
"งบประมาณสำหรับที่พักอยู่ที่เท่าไหร่ครับ?"
"ซื้อเพื่ออยู่เองหรือลงทุนครับ?"
"มีความพร้อมด้านการเงินแล้วหรือยังครับ?"

Qualified (ตอบครบ + budget fit) → Bot นัด appointment กับ sales
Unqualified → Bot ส่ง content ให้ warm + follow-up ใน 30 วัน
Cold → Bot ส่ง newsletter property update รายสัปดาห์
```

**ผลลัพธ์หลัง 30 วัน:**
- Qualify เวลา: 3-4 ชม./วัน → 30 นาที/วัน
- Sales team focus: unqualified 70% → qualified 100% ของ time
- Hot lead response: 4-6 ชม. → 10 นาที (bot เริ่มก่อน)
- Appointment rate เพิ่ม 45%
- Conversion ของ sales team เพิ่ม 28%

**เหมาะกับ:** Real estate agency, ผู้พัฒนาโครงการ, ตัวแทนขายบ้าน/คอนโด

---

## Pattern ที่เห็นใน 5 Use Cases

สังเกตว่าทุก use case มี pattern เดียวกัน:

**1. Bot รับ inquiry + qualify ก่อนคนเสมอ**
คนเข้ามาหลังจากมีข้อมูลพื้นฐานครบแล้ว → เวลาคุณมีค่ามากขึ้น

**2. Bot จัดการ "งานซ้ำ" ทั้งหมด**
คำถามที่ถามซ้ำ, confirm, remind, ส่ง info — bot ทำได้ทั้งหมด

**3. Bot escalate ได้ถูกจังหวะ**
ไม่ใช่ทุกอย่างที่ bot จัดการ — แต่ bot รู้ว่าเมื่อไหร่ต้องส่งต่อคน

**4. ระบบดีขึ้นเรื่อยๆ เอง**
ทุกสัปดาห์คุณ review + เพิ่ม FAQ → bot เก่งขึ้นทุกเดือน

---

## เลือก Use Case ที่ตรงกับคุณ

ก่อนอ่าน Chapter 5 ให้ตอบคำถามนี้:

**ธุรกิจของคุณตรงกับ use case ไหนมากที่สุด?**

[ ] ร้านค้าออนไลน์ → ดู appendix E.1
[ ] คลินิก/บริการนัดหมาย → ดู appendix E.2
[ ] Freelancer/Agency → ดู appendix E.3
[ ] ร้านอาหาร/Delivery → ดู appendix E.4
[ ] Property/Real estate → ดู appendix E.5
[ ] ไม่ตรงกับใครเลย → นัดคุยฟรีเพื่อ custom solution

ใน appendix แต่ละ use case จะมี checklist เฉพาะ — workflow สำเร็จรูปที่ copy แล้วใช้ได้เลย

---

*บทต่อไป: Chapter 5 — Tools ที่คุณต้องรู้ (และไม่ต้องรู้)*
