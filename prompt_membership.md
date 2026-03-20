# โครงสร้าง Prompt สำหรับสร้างระบบ Membership (คัดลอกส่วนที่อยู่ในกรอบด้านล่างไปใช้ได้เลยครับ)

---

## **Prompt สำหรับเปิดหน้าต่างใหม่ (Copy-Paste this)**

**Context:**
ฉันต้องการพัฒนาระบบ "Membership & Points System" สำหรับระบบจองสนามฟุตบอลของฉัน ซึ่งเป็น Web App (React/Vite) + Backend (Supabase Edge Functions + PostgreSQL) + LINE Bot 
ปัจจุบันระบบเป็น **Standalone Booking** แบบสมบูรณ์ (ไม่มี Matchday แล้ว) และใช้ระบบ Coupon V2 (`campaigns` & `user_coupons`) อยู่แล้ว

**เป้าหมาย:**
สร้างระบบสะสมแต้ม (Points) เมื่อลูกค้าชำระเงินสำเร็จ และสามารถนำแต้มมาจัดโปรโมชั่นหรือแลกเป็นส่วนลดได้ โดย **ต้องไม่กระทบกับ Flow สรุปการจองเดิม (Booking V2/V3) และระบบคูปอง V2 เดิมที่กำลังใช้งานอยู่**

**Architecture & Schema ปัจจุบันที่เกี่ยวข้อง (ห้ามแก้ไขโครงสร้างเดิมจนพัง):**
1. **`profiles` table**: ปัจจุบันเก็บ `user_id`, `team_name`, `phone_number`, `tags`
2. **`bookings` table**: เก็บข้อมูลการจอง มี column `payment_status` ('pending_payment', 'deposit_paid', 'paid') และ `paid_at` (มีค่าเมื่อจ่ายครบ)
3. **`campaigns` & `user_coupons`**: ระบบคูปอง V2 ที่ใช้งานอยู่ (`campaigns.benefit_type` มี 'DISCOUNT', 'REWARD')

**งานที่คุณต้องช่วยคิดและวางแผน (กรุณาทำเป็น Step-by-step):**

**Step 1: Database Setup**
ช่วยออกแบบ SQL Schema สำหรับ:
- การเพิ่ม Column `points` สะสมในตาราง `profiles` (หรือเพิ่มตารางใหม่ถ้าเหมาะสมกว่า)
- ตาราง `point_history` เพื่อเก็บ Log การได้แต้ม/เสียแต้ม (Earn/Redeem) พร้อมอ้างอิง `booking_id` หรือ `campaign_id`

**Step 2: Earn Logic (ระบบได้แต้ม)**
อัตราแลกเปลี่ยน: 100 บาท = 10 แต้ม
- ช่วยเขียน Supabase Database Trigger (หรือ Edge Function logic) ที่จะ **เพิ่มแต้มอัตโนมัติ** เมื่อ `bookings.status` และ `payment_status` ถูกอัปเดตเป็นสถานะจ่ายเงินสำเร็จ (`paid_at` is not null)
- คำนวณแต้มจาก `price_total_thb` ของ booking นั้นๆ (ซึ่งในระบบคือราคาสุทธิหลังหักส่วนลดคูปองทั้งหมดแล้ว)

**Step 3: Frontend UI Requirements (ลูกค้าดูแต้ม)**
- ช่วยออกแบบ Component / UI สำหรับแสดง "แต้มสะสมปัจจุบัน" และ "ประวัติการได้รับแต้ม" ในหน้า `WalletPage.tsx` เดิมที่มีอยู่แล้ว 

**Step 4: Redeem Logic (ระบบแลกแต้ม)**
- เสนอวิธีเชื่อมโยง Points เข้ากับระบบ `campaigns` V2 เดิม เช่น ทำฟังก์ชันให้ลูกค้ากด "ใช้ 500 แต้ม แลกคูปอง 100 บาท" (Insert ลง `user_coupons` และบันทึกลง `point_history`)

**ข้อควรระวัง (Strict Constraints):**
1. ห้ามรบกวนหรือดัดแปลง Core Logic ของ `useBookingLogic.ts` ที่จัดการคูปอง V2 (`MAIN` / `ONTOP`) 
2. การให้แต้มต้องเป็น Thread-safe / Transaction-safe ป้องกัน Race condition
3. ยึดการเขียนโค้ดสไตล์ React (Functional Components) และ Typescript

**เริ่มต้น:**
กรุณาสรุปแผนและเขียน SQL Schema สำหรับ Step 1 ให้ฉันดูก่อน

---
