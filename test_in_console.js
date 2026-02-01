// Test script - paste in browser console
// This will test if the hardcoded key works

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY';

// Test 1: Check if key is valid
fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': SUPABASE_ANON_KEY }
}).then(r => console.log('✅ Key test:', r.status, r.ok ? 'VALID' : 'INVALID'));

// Test 2: Call get-my-coupons directly
fetch(`${SUPABASE_URL}/functions/v1/get-my-coupons`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId: 'Ua636ab14081b483636896549d2026398' })
})
    .then(r => r.json())
    .then(data => {
        console.log('✅ API Response:', data);
        console.log('   Total coupons:', data.total);
    });
