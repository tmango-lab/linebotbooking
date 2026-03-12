# 📱 Wallet System & LIFF Integration

เอกสารนี้อธิบายการทำงานของระบบกระเป๋าเงิน (Wallet) ที่เชื่อมต่อกับ LINE Front-end Framework (LIFF) ตั้งแต่การตั้งค่า การทำงานเบื้องหลัง จนถึงหน้าจอใช้งานจริง

## 1. การตั้งค่า (Setup)

เพื่อให้ระบบ Wallet ใช้งานได้ ต้องมีการเชื่อมต่อ LIFF ID เข้ากับโปรเจค

### 1.1 สร้าง LIFF Channel
1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Channel ชนิด **LINE Login**
3. ในแท็บ **LIFF**, กด Add และตั้งค่า:
   - **Size**: Tall หรือ Full
   - **Endpoint URL**: ใส่ URL ของเว็บไซต์จริง (เช่น `https://your-app.vercel.app`) หรือ `https://google.com` (ถ้ายังไม่มีเว็บ)
   - **Scopes**: เลือก `profile`, `openid`
4. เมื่อสร้างเสร็จจะได้ **LIFF ID** (Format: `1657xxxxxx-xxxxxx`)

### 1.2 ตั้งค่าในโปรเจค
นำ LIFF ID ไปใส่ใน:
1. ไฟล์ `.env` (สำหรับการรัน Local):
   ```env
   VITE_LIFF_ID=your_liff_id_here
   ```
2. Supabase Function Secrets (สำหรับ Broadcast):
   ```bash
   npx supabase secrets set LIFF_ID=your_liff_id_here
   ```

---

## 2. สถาปัตยกรรมระบบ (Architecture)

เราได้ปรับปรุงระบบให้โหลดเร็วที่สุดและป้องกันปัญหา "หน้าขาว" หรือ "รีโหลดหลายรอบ" ด้วยเทคนิคดังนี้:

### 2.1 Instant Redirect (index.html)
- **ปัญหาเดิม**: รอกระบวนการ React Router ทำงาน ทำให้หน้าขาวนาน
- **วิธีแก้**: ใช้ Script ฝังใน `index.html` เพื่อดักจับ URL ย่อย (เช่น `/wallet`) และแปลงเป็น Hash Router (`/#/wallet`) **ทันที** ก่อนที่ React จะเริ่มทำงาน
- **ผลลัพธ์**: เข้าหน้า Wallet ได้แทบจะทันที (Instant Load)

### 2.2 Global LIFF Provider
- **ไฟล์**: `src/providers/LiffProvider.tsx`
- **หน้าที่**: 
  - ทำการ `liff.init()` เพียงครั้งเดียวที่จุดเริ่มต้นของแอพ
  - จัดการสถานะ `isReady` และ `liffUser` ให้ทุกหน้าเรียกใช้ได้ทันที
  - ป้องกันการเรียก `liff.login()` ซ้ำซ้อน

---

## 3. หน้าใช้งาน (User Interface)

หน้า Wallet (`src/pages/user/WalletPage.tsx`) ถูกออกแบบให้ **Clean & Simple** สำหรับลูกค้า:

### 3.1 ส่วนประกอบหลัก
1. **Header**: 
   - แสดงชื่อ "Wallet"
   - ไม่มีช่องกรอก User ID (ระบบดึงจาก LINE อัตโนมัติ)
2. **My Coupons**:
   - แสดงรายการคูปองที่มีอยู่จริง (Main / On-top)
   - เรียงลำดับสวยงาม พร้อมปุ่ม "Use Now"
3. **Marketplace (คูปองแนะนำ)**:
   - แสดงคูปองสาธารณะที่สามารถเก็บเพิ่มได้
   - ปุ่ม "เก็บ" จะทำงานทันที
4. **Secret Code (โค้ดลับ)**:
   - ช่องกรอกโค้ดสำหรับกิจกรรมพิเศษ (เช่น "ป้าขาว")
   - อยู่ด้านล่างสุด ไม่รบกวนสายตา

---

## 4. การแก้ไขปัญหา (Troubleshooting)

### 4.1 เข้า Link แล้วไม่ไปหน้า Wallet
- ตรวจสอบ `Endpoint URL` ใน LINE Developers ว่าตรงกับ URL ปัจจุบันหรือไม่
- ตรวจสอบ `LIFF_ID` ใน `.env` หรือ Vercel Environment Variables

### 4.2 หน้าเว็บรีโหลดวนไปมา
- เคลียร์ Cache ของ Browser หรือ LINE App
- ตรวจสอบว่าใน `App.tsx` ไม่มี Logic Redirect ที่ขัดแย้งกับ `LiffProvider`

### 4.3 ไม่เห็นคูปอง
- ตรวจสอบว่า User ID ใน Database (`profiles`) ตรงกับ LINE User ID ของบัญชีที่ใช้งาน
- ลองกด "Load" หรือ Refresh หน้าใหม่อีกครั้ง

---

## 5. ฟีเจอร์ "ใช้สิทธิ์หน้าร้าน" (Partner Coupons)

ใน `WalletPage.tsx` คูปองที่เป็นของพาร์ทเนอร์ (มี `merchant_id`) จะแสดงปุ่ม "ใช้ที่ร้าน" แตกต่างจากคูปองปกติที่จะแสดงปุ่ม "ใช้จองสนาม"

### 5.1 การเปิด Popup QR Code (`MerchantCouponPopup.tsx`)
1. เมื่อลูกค้ากดปุ่ม ระบบจะยิง Edge Function `generate-redemption-token` เพื่อสร้าง Token แบบใช้ครั้งเดียว (อายุ 15 นาที) (ฟังก์ชันนี้จะ Bypass RLS เพื่อให้เขียน Token ลงฐานข้อมูลได้)
2. นำ Token และ ไอดีคูปอง มาสร้างเป็น QR Code ให้ลูกค้าโชว์หน้าร้าน

### 5.2 Real-time Feedback (Polling)
- ในขณะที่เปิดหน้า QR Code ทิ้งไว้ ตัวแอพจะแอบ **เช็คสถานะคูปอง (Polling)** ส่ง API ไปที่หน้าบ้านทุกๆ 3 วินาที
- หากพนักงานร้านค้าสแกนคูปองสำเร็จ สถานะคูปองจะเปลี่ยนเป็น `USED`
- หน้าจอลูกค้าจะจับการเปลี่ยนแปลงได้ และแสดงแอนิเมชัน **"ใช้งานสำเร็จ!"** ป๊อปอัพขึ้นมาทับคิวอาร์โค้ดทันที โดยที่ลูกค้าไม่ต้องกดปุ่มใดๆ แล้วจะปิดตัวเองอัตโนมัติใน 4 วินาที
