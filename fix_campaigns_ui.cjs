require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 กำลังแก้ไขโครงสร้างข้อมูลแคมเปญให้ตรงกับระบบ Admin UI (flat columns)...');

  try {
    // 1. Fix GOLDEN200
    const { data: golden, error: goldenErr } = await supabase
      .from('campaigns')
      .update({
        discount_amount: 200,
        discount_percent: 0,
        valid_time_start: '20:00',
        valid_time_end: '23:59',
        status: 'active', // lowercase is required for UI
        coupon_type: 'main',
        is_stackable: false,
        is_public: false,
        allow_ontop_stacking: true,
        point_cost: 0,
        // clear old JSON formats just in case, though not strictly necessary
        benefit_value: null,
        allowed_time_range: null
      })
      .contains('secret_codes', ['GOLDEN200'])
      .select('name, discount_amount, valid_time_start, status');
      
    if (goldenErr) throw goldenErr;
    console.log('✅ แก้ไข GOLDEN200 สำเร็จ:', golden);

    // 2. Fix RETRO399
    const { data: retro, error: retroErr } = await supabase
      .from('campaigns')
      .update({
        discount_amount: 301,
        discount_percent: 0,
        valid_time_start: '18:00',
        valid_time_end: '23:59',
        status: 'active', // lowercase
        coupon_type: 'main',
        is_stackable: false,
        is_public: false,
        allow_ontop_stacking: true,
        point_cost: 0,
        benefit_value: null,
        allowed_time_range: null
      })
      .contains('secret_codes', ['RETRO399'])
      .select('name, discount_amount, valid_time_start, status');

    if (retroErr) throw retroErr;
    console.log('✅ แก้ไข RETRO399 สำเร็จ:', retro);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

main();
