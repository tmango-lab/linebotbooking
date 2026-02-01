# ทดสอบว่า Hardcode ทำงานหรือไม่

เปิด DevTools Console แล้ว paste โค้ดนี้:

```javascript
// Check what ANON_KEY is being used
fetch('https://kyprnvazjyilthdzhqxh.supabase.co/rest/v1/', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY'
  }
}).then(r => console.log('Status:', r.status, r.ok ? '✅ Key works!' : '❌ Key invalid'));
```

ถ้าได้ **200 OK** แสดงว่า key ถูกต้อง

---

# หรือลอง Hard Refresh

1. กด **Ctrl + Shift + Delete**
2. เลือก "Cached images and files"
3. กด "Clear data"
4. Refresh หน้าใหม่

---

# หรือดู Console Error

เปิด Console (F12) ดูว่ามี error อะไร
