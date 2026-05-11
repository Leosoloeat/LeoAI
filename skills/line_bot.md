# Skill: LINE OA Bot Development

## Credentials ที่ต้องมี
- Channel Access Token (long-lived) — ใช้ reply/push messages
- Channel Secret — ใช้ verify webhook signature
- Webhook URL — ต้องเป็น HTTPS, ลงท้าย /callback

## Webhook Flow
1. LINE ส่ง POST → /callback
2. verify X-Line-Signature ด้วย Channel Secret
3. ack 200 ทันที (ก่อน process)
4. process events async

## Event Types
- message.text → text message จากผู้ใช้
- follow → user เพิ่มเป็นเพื่อน (send welcome)
- unfollow → user block (log, don't reply)
- postback → user กด button/richmenu

## Reply vs Push
- replyMessage: ใช้ replyToken, ฟรี, ต้องใช้ภายใน 30 วิ
- pushMessage: ใช้ userId, เสียเครดิต, ส่งได้ทุกเมื่อ
- broadcastMessage: ส่งหาทุกคน, เสียเครดิต

## Message Types
- text: ข้อความธรรมดา (max 5000 chars)
- flex: custom layout (card, carousel, form)
- image: URL ภาพ HTTPS
- sticker: packageId + stickerId

## LINE SDK (Node.js)
```javascript
const { messagingApi } = require('@line/bot-sdk');
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
// Reply
await client.replyMessage({ replyToken, messages: [{ type: 'text', text: 'Hello' }] });
// Push
await client.pushMessage({ to: userId, messages: [{ type: 'text', text: 'Hello' }] });
```

## Common Issues
- "Invalid reply token" → token ใช้ได้แค่ครั้งเดียว + 30 วิ
- "The request body has 1 error(s)" → message format ผิด
- "Signature validation failed" → Channel Secret ผิด หรือ body ถูก parse ก่อน verify
- Webhook ไม่ response → ต้องส่ง 200 ก่อน process async

## Rich Menu Setup
- สร้างผ่าน LINE Official Account Manager
- หรือ API: POST /richmenu + link to user/all
- Size: 2500x843 (full) หรือ 2500x422 (half)

## LIFF (LINE Front-end Framework)
- Web app ที่เปิดในหน้าต่าง LINE
- ได้ข้อมูล userId, displayName จาก liff.getProfile()
- ใช้สำหรับ form, payment, booking
