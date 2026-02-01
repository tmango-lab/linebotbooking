# แก้ไข 401 Unauthorized Error

## ปัญหา
Browser cache ANON_KEY เก่าอยู่ แม้ว่าจะ restart dev server แล้ว

## วิธีแก้ไข

### 1. Hard Refresh Browser
1. เปิด `http://localhost:5173/wallet?userId=Ua636ab14081b483636896549d2026398`
2. กด **Ctrl + Shift + R** (Windows) หรือ **Cmd + Shift + R** (Mac)
3. หรือกด **Ctrl + F5**

### 2. Clear Browser Cache
1. กด **F12** เปิด DevTools
2. **คลิกขวา** ที่ปุ่ม Refresh
3. เลือก **"Empty Cache and Hard Reload"**

### 3. Clear Application Storage
1. กด **F12** เปิด DevTools
2. ไปที่ tab **"Application"**
3. ด้านซ้าย เลือก **"Storage"**
4. คลิก **"Clear site data"**
5. Refresh หน้าเว็บ

### 4. ใช้ Incognito Mode
1. เปิด **Incognito/Private Window** (Ctrl + Shift + N)
2. ไปที่ `http://localhost:5173/wallet?userId=Ua636ab14081b483636896549d2026398`
3. **ควรทำงานได้**

---

## ทดสอบอีกครั้ง
หลังทำตามข้างบน ควรเห็น:
- ✅ Status: 200 OK
- ✅ คูปอง 4 อัน

ลองแล้วบอกผลครับ!
