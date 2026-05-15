# GOOGLE SHEETS SCHEMA — LeoSP

> Schema ของ Google Sheets ที่เชื่อมกับ LeoSP
> Inject เข้า System Message เพื่อให้ bot ตีความข้อมูลถูกต้อง

---

## Sheet 1: Customers

| Column | Header | ความหมาย | Format | ตัวอย่าง |
|--------|--------|----------|--------|---------|
| A | timestamp | เวลาที่ติดต่อ | datetime | 2025-01-15 10:30 |
| B | line_user_id | LINE User ID | text | Uxxxxxxxx |
| C | name | ชื่อลูกค้า | text | คุณแอน |
| D | phone | เบอร์โทร | text | 081-xxx-xxxx |
| E | interest | บริการที่สนใจ | text | [ระบุ] |
| F | budget | งบประมาณ (บาท) | number | 5000 |
| G | status | สถานะ | text | new/follow/booked/closed |
| H | branch | สาขาที่สะดวก | text | [ระบุ] |
| I | notes | หมายเหตุ | text | - |

## Sheet 2: Appointments

| Column | Header | ความหมาย | Format |
|--------|--------|----------|--------|
| A | appointment_id | รหัสนัด | text (APT-001) |
| B | customer_name | ชื่อลูกค้า | text |
| C | phone | เบอร์ | text |
| D | service | บริการที่นัด | text |
| E | date | วันที่นัด | date (YYYY-MM-DD) |
| F | time | เวลานัด | time (HH:MM) |
| G | branch | สาขา | text |
| H | confirmed | ยืนยันแล้ว | boolean (TRUE/FALSE) |
| I | notes | หมายเหตุ | text |

## Sheet 3: Promotions

| Column | Header | ความหมาย | Format |
|--------|--------|----------|--------|
| A | promo_name | ชื่อโปร | text |
| B | service | บริการ | text |
| C | original_price | ราคาปกติ (บาท) | number |
| D | promo_price | ราคาโปร (บาท) | number |
| E | start_date | วันเริ่ม | date |
| F | end_date | วันหมด | date |
| G | is_active | ใช้งานอยู่ | boolean (TRUE/FALSE) |
| H | conditions | เงื่อนไข | text |

Rules: ดึงเฉพาะ is_active=TRUE และ end_date >= วันนี้
