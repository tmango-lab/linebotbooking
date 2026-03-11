const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  const supabase = createClient(
    'https://kyprnvazjyilthdzhqxh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0'
  );
  const { data, error } = await supabase.from('user_coupons').select('*').limit(1);
  console.log("data:", data, "error:", error);
}
checkSchema();
