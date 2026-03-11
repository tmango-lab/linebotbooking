const { createClient } = require('@supabase/supabase-js');

async function checkRLS() {
  // Also check if anon can read a coupon
  const anonSupabase = createClient(
    'https://kyprnvazjyilthdzhqxh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs'
  );
  
  const { data: coupons, error: fetchErr } = await anonSupabase.from('user_coupons').select('id, status').limit(5);
  console.log("Anon Fetch (no auth.uid()):", coupons, fetchErr);
}

checkRLS();
