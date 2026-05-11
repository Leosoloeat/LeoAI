# Skill: Prompt Engineering

## System Prompt Structure
```
[Identity] — ใครคือ AI นี้
[Expertise] — ชำนาญเรื่องอะไร
[Rules] — ห้ามทำอะไร / ต้องทำอะไร
[Style] — ตอบยังไง (tone, format, length)
[Context] — ข้อมูลเพิ่มเติมที่ AI ต้องรู้
```

## Effective Prompt Patterns

### Role + Goal
"คุณคือ [role] ที่ชำนาญด้าน [domain] 
เป้าหมายคือ [goal]
ตอบเป็น [language] และ [style]"

### Few-Shot (ตัวอย่างการตอบ)
"Q: [ตัวอย่างคำถาม]
A: [ตัวอย่างคำตอบที่ต้องการ]

Q: [คำถามจริง]
A:"

### Chain of Thought
"คิดทีละขั้นตอน:
1. วิเคราะห์ปัญหา
2. หาวิธีแก้
3. ตรวจสอบ
4. ตอบ"

### Output Format Control
"ตอบในรูปแบบนี้เท่านั้น:
- หัวข้อ: [X]
- วิธีแก้: [Y]
- ผลลัพธ์ที่คาดหวัง: [Z]"

## Prompt Engineering Rules
- Specific > Vague: "เขียน hook 10 คำ สำหรับ คนที่เสียเงินโฆษณา" ดีกว่า "เขียน hook"
- Context matters: ให้ข้อมูล audience, goal, constraint เสมอ
- Negative instructions ช่วยได้: "ห้ามใช้ jargon", "ห้ามพูดว่า 'แน่นอน'"
- Temperature: creative task = 0.8-1.0, factual = 0.1-0.3
- Test & iterate: ปรับ 1 ตัวแปรต่อครั้ง

## LINE OA Bot Prompt Tips
- ห้ามใช้ markdown (* ** # --- `) เพราะ LINE ไม่แสดง
- ใช้ bullet จุด • แทน -
- ย่อหน้าสั้น เว้นบรรทัด mobile-friendly
- ลงท้าย "ครับ" เสมอ
- ตอบกระชับก่อน ขยายเมื่อถูกถาม

## Anti-Patterns (อย่าทำ)
- "ตอบทุกอย่างที่รู้เกี่ยวกับ..." → context overload
- Instructions ขัดแย้งกัน
- ไม่บอก format → AI ตอบมั่ว
- Prompt ยาวเกิน context window → cut off
