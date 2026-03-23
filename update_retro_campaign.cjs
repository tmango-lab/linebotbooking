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
  console.log('🔄 กำลังแก้ไขแคมเปญ RETRO399 (บังคับใช้หลัง 18:00 น. ลด 301 บาท)...');

  try {
    const { data: campaigns, error: findError } = await supabase
      .from('campaigns')
      .select('id, name')
      .contains('secret_codes', ['RETRO399'])
      .limit(1);

    if (findError || !campaigns || campaigns.length === 0) {
      console.error('❌ ไม่พบแคมเปญ RETRO399 ในระบบ');
      return;
    }

    const retroId = campaigns[0].id;

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        benefit_value: { amount: 301 }, // 700 - 399 = 301
        allowed_time_range: { start: '18:00', end: '23:59' },
        description: 'รหัสลับเตะสนาม 5 คน ราคาเหมา 399 บาทสุทธิ (เฉพาะรอบ 18:00 เป็นต้นไป)'
      })
      .eq('id', retroId)
      .select('name, secret_codes, benefit_type, benefit_value, allowed_time_range');

    if (error) throw error;
    
    console.log('✅ แก้ไขแคมเปญสำเร็จ! ผลลัพธ์:');
    console.dir(data, { depth: null });

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

main();
