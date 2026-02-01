# Debug Wallet Issue - Vercel Production

## ให้ลองทำตามนี้เพื่อหาสาเหตุ

### 1. เช็คว่า Deployment ใช้ Environment Variable ใหม่หรือยัง

เปิด Vercel Deployment Logs:
1. ไปที่ Vercel Dashboard → Deployments
2. คลิกที่ deployment ล่าสุด
3. ดูที่ส่วน **"Build Logs"**
4. หาว่ามีการใช้ `VITE_SUPABASE_ANON_KEY` ที่ถูกต้องหรือไม่

### 2. ทดสอบ API โดยตรงใน Production

เปิด Browser Console (F12) ใน LIFF app แล้ว paste:

```javascript
// Test if production API works
const PROD_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY';

fetch(`${PROD_URL}/functions/v1/get-my-coupons`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PROD_KEY}`,
    'apikey': PROD_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ userId: 'Ua636ab14081b483636896549d2026398' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Production API Response:', data);
  console.log('   Total coupons:', data.total);
})
.catch(err => console.error('❌ Error:', err));
```

### 3. เช็ค Network Tab

1. เปิด LIFF wallet ใน LINE
2. กด F12 → tab "Network"
3. Refresh หน้า wallet
4. หา request "get-my-coupons"
5. ดู:
   - Status Code (ควรเป็น 200)
   - Request Headers (ดู apikey ว่าถูกต้องหรือไม่)
   - Response (ดูว่าได้ data อะไรกลับมา)

### 4. เช็ค Console Errors

เปิด Console (F12) ดูว่ามี error อะไรหรือไม่

---

## ถ้ายังไม่ได้

ลอง **Clear LIFF Cache**:
1. ใน LINE chat กับ Bot
2. พิมพ์ข้อความอะไรก็ได้ (เช่น "สวัสดี")
3. ปิด LINE app ทั้งหมด (force close)
4. เปิด LINE ใหม่
5. ลองเข้า wallet อีกครั้ง

---

**ลองทำตามแล้วบอกผลครับ!** 
- ถ้าทดสอบ API ใน console ได้ total: 4 แสดงว่า API ทำงาน
- ถ้าได้ total: 0 แสดงว่ามีปัญหาที่ backend
