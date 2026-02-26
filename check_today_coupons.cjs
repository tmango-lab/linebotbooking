require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const referrerId = 'Ua636ab14081b483636896549d2026398';
  console.log(`--- Checking Today's Coupons for ${referrerId} ---`);
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const { data, error } = await supabase
    .from('user_coupons')
    .select('*, campaigns(*)')
    .eq('user_id', referrerId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });
    
  if (error || !data) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`Found ${data.length} coupons today:`);
  console.log(JSON.stringify(data, null, 2));
}

check();
