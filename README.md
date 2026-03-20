# ระบบจองสนามฟุตบอล (Football Field Booking System)

ระบบจัดการการจองสนามฟุตบอลผ่าน LINE Bot และ Admin Dashboard พร้อมระบบโค้ดโปรโมชั่น

## 🎯 ฟีเจอร์หลัก

### 1. LINE Bot Integration
- ค้นหาเวลาว่าง (ทีละสนาม / ทั้งหมด)
- จองสนามผ่าน LINE
- **Stripe PromptPay QR**: ระบบชำระเงินมัดจำ 200 บาทอัตโนมัติ (ไม่ต้องแนบสลิป)
- สร้างโค้ดโปรโมชั่นอัตโนมัติ (ส่วนลด 10%)
- แสดงราคาตามช่วงเวลา (ก่อน/หลัง 18:00)

### 2. Admin Dashboard
- ดูตารางการจองแบบ Calendar View
- จองสนามผ่าน UI
- ใช้โค้ดโปรโมชั่นที่ลูกค้าได้รับจาก LINE
- ยกเลิกการจอง
- **Promo Lock**: ระบบล็อกการยืดเวลาและย้ายสนามสำหรับรายการที่มีโปรโมชั่น เพื่อป้องกันความผิดพลาดทางบัญชี
- จัดการข้อมูลสนาม
- **Tag Management & Broadcast**: ระบบแบ่งกลุ่มลูกค้า (Tags) และส่งข้อความตามกลุ่มเป้าหมาย (Broadcasting)
- **Member Management**: เพิ่มข้อมูลลูกค้าแมนนวล และรองรับการดึงข้อมูลมาเชื่อมกับ LINE อัตโนมัติ
- **Auto-link Users (NEW)**: เมื่อแอดมินสร้างการจองผ่าน Dashboard ระบบจะดึงข้อมูล LINE User จากเบอร์โทรศัพท์เพื่อผูกการจองและส่งการแจ้งเตือนอัตโนมัติ

### 3. Promo Code & Campaign System
- สร้างโค้ด 6 หลักอัตโนมัติ
- ส่วนลด 10% หรือจำนวนเงินคงที่
- ระบบ Campaign สำหรับสร้างคอนเทนต์ Flex Message
- **Targeted Broadcasting**: ส่ง Campaign หาลูกค้าตาม Tag ที่ระบุ

### 5. Regular Booking (VIP Only) [[NEW]](ARCHITECTURE.md#12-regular-booking-vip-implementation)
- **Secret Booking Flow**: พิมพ์รหัสลับ (เช่น "จองประจำ") เพื่อเข้าสู่โหมดจองพิเศษ
- **VIP Validation**: เฉพาะ user ที่มีแท็ก `vip` ในตาราง `profiles`
- **Manual Promo Codes**: ใช้โค้ดส่วนลดพิเศษ (เช่น "TMG100") ที่สร้างจาก Admin Dashboard
- **Usage Tracking**: บันทึกจำนวนการใช้โค้ดและจำกัดสิทธิ์การใช้งาน

### 6. Multi-App Architecture & Performance
- **Smart Routing**: รองรับการแยก App บน Vercel โดยใช้ Git Repo เดียวกัน
    - `linebotbooking-chi.vercel.app` -> Admin App (Default)
    - `app-booking-sand.vercel.app` -> Customer App (Booking Mode)
- **Performance Optimization**:
    - **Instant Load**: หน้า Wallet และ Booking ถูกโหลดแบบ Static Import เพื่อความลื่นไหลสูงสุด
    - **Parallel Data Fetching**: ดึงข้อมูลสนาม, ตารางจอง, และคูปอง พร้อมกัน (เร็วขึ้น 40%)
    - **Branded Loader**: หน้าโหลดแบบ Custom UI ลดความรู้สึกว่ารอนาน

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase PostgreSQL
- **External API**: Matchday Arena API
- **Messaging**: LINE Messaging API

## 📁 โครงสร้างโปรเจค

```
ระบบจองสนาม/
├── src/                          # Frontend React
│   ├── App.tsx                   # Main Router & Smart Redirect Logic
│   ├── pages/
│   │   ├── admin/                # Admin Pages (Lazy Loaded)
│   │   └── liff/                 # Customer Pages (Static Loaded for Speed)
│   └── hooks/
│       └── useBookingLogic.ts    # Centralized Booking Logic (Parallel Fetching)
│
├── supabase/functions/           # Edge Functions
│   ├── webhook/                  # LINE Bot webhook
│   ├── stripe-webhook/           # [NEW] Stripe payment confirmation
│   ├── create-payment-intent/    # [NEW] Create Stripe PromptPay session
│   ├── create-booking/           # สร้างการจอง
│   ├── use-promo-code-and-book/  # จองด้วยโค้ดโปรโมชั่น
│   ├── validate-promo-code/      # ตรวจสอบโค้ด
│   ├── get-bookings/             # ดึงข้อมูลการจอง
│   ├── cancel-booking/           # ยกเลิกการจอง
│   └── _shared/                  # Shared utilities
│       ├── promoService.ts       # สร้างโค้ดโปรโมชั่น
│       ├── pricingService.ts     # คำนวณราคา
│       ├── matchdayApi.ts        # Matchday API client
│       └── lineClient.ts         # LINE API client
│
└── supabase/migrations/          # Database migrations
    └── 20260121_promo_codes.sql  # Promo code schema
```

## 🚀 การติดตั้ง

### 1. Clone Repository
```bash
git clone <repository-url>
cd ระบบจองสนาม
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_MODE=booking  # Optional: 'booking', 'wallet', or leave empty for 'admin'
```

ตั้งค่า Supabase Secrets (ใน Dashboard):
```
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
MATCHDAY_TOKEN=your_matchday_token
```

### 4. Deploy Functions
```bash
npx supabase functions deploy webhook --no-verify-jwt
npx supabase functions deploy create-booking --no-verify-jwt
npx supabase functions deploy use-promo-code-and-book --no-verify-jwt
npx supabase functions deploy validate-promo-code --no-verify-jwt
npx supabase functions deploy get-bookings --no-verify-jwt
npx supabase functions deploy cancel-booking --no-verify-jwt
```

### 5. Run Development Server
```bash
npm run dev
```

## 📖 เอกสารเพิ่มเติม

- **[System Architecture](ARCHITECTURE.md)** - สถาปัตยกรรมระบบแบบละเอียด
- **[Wallet & LIFF Guide](docs/WALLET_SYSTEM_AND_LIFF.md)** - คู่มือการติดตั้งและใช้งานระบบ Wallet/LIFF ฉบับสมบูรณ์
- **[Latest Walkthrough](file:///C:/Users/Tmango/.gemini/antigravity/brain/c8ffa421-a9bf-4e16-a497-aa71e3e060f6/walkthrough.md)** - สรุปการแก้ไขล่าสุด (Auto-link Feature)

## 🔧 การแก้ปัญหาทั่วไป

### LINE Bot ไม่ตอบกลับ
```bash
# Redeploy webhook function
npx supabase functions deploy webhook --no-verify-jwt
```

### ราคาไม่ตรงกันระหว่าง Admin และ Matchday
- ตรวจสอบว่า `use-promo-code-and-book` ใช้ pattern ที่ถูกต้อง:
  - `fixed_price: null` ในการสร้าง
  - รอ 5 วินาทีก่อน update
  - ส่ง `price`, `change_price`, `time_start`, `time_end` ใน update

### CORS Error ใน F12
- เป็นเรื่องปกติใน dev mode (`localhost:5173`)
- จะหายเมื่อ deploy production

## 🎓 สำหรับ AI/Developer

เมื่อต้องการสร้าง function ใหม่ ให้อ่าน:
1. [System Architecture](file:///c:/Users/Tmango/.gemini/antigravity/brain/4e03de1d-1d22-4cf2-a777-df27f587cbb4/system_architecture.md) - เข้าใจ flow ทั้งหมด
2. ดูตัวอย่างจาก `create-booking` หรือ `use-promo-code-and-book`
3. ใช้ proven pattern สำหรับการ update ราคาใน Matchday

## 📝 License

MIT
