# แก้ไข Environment Variables ใน Vercel

## ขั้นตอนการแก้ไข

### 1. เข้า Vercel Dashboard
1. ไปที่ https://vercel.com/dashboard
2. Login ด้วย account ของคุณ
3. เลือก Project ของคุณ (booking-system)

### 2. ไปที่ Settings
1. คลิกที่ tab **"Settings"** ด้านบน
2. ด้านซ้าย เลือก **"Environment Variables"**

### 3. แก้ไข VITE_SUPABASE_ANON_KEY
1. หา variable ชื่อ `VITE_SUPABASE_ANON_KEY`
2. คลิก **"Edit"** หรือ **"..."** → **"Edit"**
3. แทนที่ค่าเดิมด้วย:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs
   ```
4. เลือก Environment: **Production**, **Preview**, **Development** (ทั้ง 3 อัน)
5. คลิก **"Save"**

### 4. Redeploy
หลังแก้ไข Environment Variable แล้ว ต้อง redeploy:

**วิธีที่ 1: ผ่าน Dashboard**
1. ไปที่ tab **"Deployments"**
2. หา deployment ล่าสุด
3. คลิก **"..."** → **"Redeploy"**
4. เลือก **"Redeploy"** (ไม่ต้องเลือก "Use existing Build Cache")

**วิธีที่ 2: ผ่าน Git Push**
```bash
git add .
git commit -m "Fix ANON_KEY"
git push
```

### 5. รอ Deployment เสร็จ
- รอประมาณ 1-2 นาที
- เมื่อเสร็จจะเห็น status **"Ready"**

### 6. ทดสอบ
1. เปิด LINE Bot
2. พิมพ์ "ป้าขาว"
3. กด "🎁 รับเลย!"
4. กด "👛 ดูกระเป๋า"
5. **ควรเห็นคูปองแล้ว!**

---

## Environment Variables ที่ต้องมี

ตรวจสอบว่ามี variables เหล่านี้:

```
VITE_SUPABASE_URL=https://kyprnvazjyilthdzhqxh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0
MATCHDAY_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU
```

---

## หมายเหตุ
- **สำคัญ**: ต้อง redeploy ทุกครั้งที่แก้ไข Environment Variables
- ถ้ายังไม่เห็นคูปอง ลอง clear cache ใน LINE app (ปิดแล้วเปิดใหม่)
