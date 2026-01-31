# 🔧 ขั้นตอนการแก้ปัญหาขั้นสุดท้าย

## สถานะปัจจุบัน

✅ Webhook ทำงานถูกต้อง - ส่ง request ไปยัง collect-coupon
✅ Campaign ID ถูกต้อง: `b75c3e67-f9e1-451a-8490-4578c854b610`
❌ collect-coupon function ไม่แสดง log `[Collect Start]`

## ปัญหาที่เหลือ

collect-coupon function ไม่ได้รับ request หรือ crash ทันทีก่อน log

## วิธีแก้ไข

### ตรวจสอบ collect-coupon logs อีกครั้ง

1. ไปที่ Supabase Dashboard → Functions → collect-coupon → Logs
2. กด Refresh
3. หา error ที่เกิดหลังเวลา **15:05:22** (เวลาที่ webhook ส่ง request)
4. ถ้ามี error ส่ง screenshot มา

### ถ้าไม่มี error เลย

แสดงว่า request ไม่ถึง function เลย อาจเป็นเพราะ:
- Network issue
- Authorization header ผิด
- CORS issue

## ทดสอบด้วยตัวเอง

รัน command นี้เพื่อทดสอบเรียก API โดยตรง:

\`\`\`bash
curl -X POST "https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/collect-coupon" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "Ua636ab14081b483636896549d2026398",
    "campaignId": "b75c3e67-f9e1-451a-8490-4578c854b610",
    "secretCode": "ป้าขาว"
  }'
\`\`\`

ดูว่าได้ response อะไรกลับมา
