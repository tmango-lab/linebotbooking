# แก้ไข 401 Error - Vite ไม่อ่าน .env ใหม่

## ปัญหา
Vite dev server ยังใช้ ANON_KEY เก่าอยู่ แม้จะ restart แล้ว

## วิธีแก้ไข

### 1. Kill Process ทั้งหมด
1. ปิด Terminal ทั้งหมด
2. เปิด Task Manager (Ctrl + Shift + Esc)
3. หา process "node" หรือ "npm"
4. คลิกขวา → End Task ทั้งหมด

### 2. ลบ node_modules/.vite (cache)
```bash
rm -rf node_modules/.vite
# หรือใน Windows
rmdir /s /q node_modules\.vite
```

### 3. รัน Dev Server ใหม่
```bash
npm run dev
```

### 4. ทดสอบ
เปิด Incognito: `http://localhost:5173/wallet?userId=Ua636ab14081b483636896549d2026398`

---

## หรือใช้วิธีง่ายกว่า: Hardcode ชั่วคราว

แก้ไข `src/lib/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kyprnvazjyilthdzhqxh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

บันทึก → Vite จะ hot reload → ทดสอบใหม่

---

**แนะนำ: ใช้วิธี Hardcode ก่อน เพราะเร็วที่สุด!**
