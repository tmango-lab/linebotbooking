# Debug Wallet - ขั้นตอนละเอียด

## ขั้นตอนที่ 1: ทดสอบ Localhost ก่อน

### 1.1 Restart Dev Server
```bash
# กด Ctrl+C เพื่อหยุด npm run dev
# แล้วรันใหม่
npm run dev
```

### 1.2 เปิด Browser
1. เปิด **Incognito/Private Window** (Ctrl + Shift + N)
2. ไปที่: `http://localhost:5173/wallet?userId=Ua636ab14081b483636896549d2026398`

### 1.3 เปิด DevTools (F12)
1. กด **F12**
2. ไปที่ tab **"Console"**
3. ดูว่ามี **error สีแดง** หรือไม่
4. **ถ่ายภาพหน้าจอส่งมา**

### 1.4 ดู Network Tab
1. ไปที่ tab **"Network"**
2. Refresh หน้า (F5)
3. หา request **"get-my-coupons"**
4. คลิกดู → tab **"Response"**
5. **ถ่ายภาพหน้าจอส่งมา**

---

## ขั้นตอนที่ 2: ตรวจสอบ Vercel Deployment

### 2.1 เช็ค Deployment Status
1. ไปที่ https://vercel.com/dashboard
2. เลือก project ของคุณ
3. ไปที่ tab **"Deployments"**
4. ดู deployment ล่าสุด:
   - ✅ **Ready** (สีเขียว) = Deploy เสร็จแล้ว
   - ⏳ **Building** (สีเหลือง) = กำลัง deploy อยู่
   - ❌ **Error** (สีแดง) = Deploy ผิดพลาด

### 2.2 ถ้า Deploy เสร็จแล้ว
1. คลิกที่ deployment นั้น
2. คลิก **"Visit"** เพื่อเปิดเว็บ production
3. เพิ่ม `/wallet?userId=Ua636ab14081b483636896549d2026398` ท้าย URL
4. เปิด DevTools (F12) → Console
5. **ถ่ายภาพหน้าจอส่งมา**

---

## ขั้นตอนที่ 3: ทดสอบ API โดยตรง

### 3.1 ทดสอบใน Browser Console
เปิด Console (F12) แล้ว paste:

```javascript
// Test API
fetch('https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/get-my-coupons', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ userId: 'Ua636ab14081b483636896549d2026398' })
})
.then(r => r.json())
.then(data => {
  console.log('=== API Response ===');
  console.log('Total:', data.total);
  console.log('Main:', data.main.length);
  console.log('On-top:', data.on_top.length);
  console.log('Full data:', data);
});
```

**ผลที่ควรได้:**
- Total: 4
- Main: 2
- On-top: 2

**ถ้าได้ผลต่างจากนี้ → ถ่ายภาพส่งมา**

---

## ขั้นตอนที่ 4: ตรวจสอบ React State

### 4.1 เช็ค State ใน Console
Paste ใน Console:

```javascript
// Check if wallet state has data
console.log('Checking React...');
// This won't work directly, but we can check the DOM
const walletSection = document.querySelector('[class*="space-y-4"]');
console.log('Wallet section found:', !!walletSection);
console.log('Number of coupon cards:', document.querySelectorAll('[class*="rounded-2xl shadow-lg"]').length);
```

---

## สรุป: ส่งภาพหน้าจอมาให้ดู

กรุณาทำตามขั้นตอนที่ 1 และ 3 แล้วส่งภาพหน้าจอมา:

1. ✅ **Console tab** (มี error หรือไม่)
2. ✅ **Network → get-my-coupons → Response** (ได้ data อะไร)
3. ✅ **ผลการรัน API test** (total เท่าไหร่)

ผมจะวิเคราะห์ต่อจากภาพที่คุณส่งมาครับ! 🔍
