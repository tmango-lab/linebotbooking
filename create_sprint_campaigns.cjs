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
  console.log('🚀 เริ่มสร้างแคมเปญ 9-Day Sprint (23 - 31 มี.ค.)');

  const startDate = new Date('2026-03-23T00:00:00+07:00').toISOString();
  const endDate = new Date('2026-03-31T23:59:59+07:00').toISOString();

  // 1. แคมเปญ Golden Slot 200
  const campaign1 = {
    name: 'The Golden Slot 200',
    description: 'ส่วนลด 200 บาท สำหรับสนาม 3-6 (รอบ 20:00 เป็นต้นไป)',
    coupon_type: 'MAIN',
    benefit_type: 'DISCOUNT',
    benefit_value: { amount: 200 },
    total_quantity: 40, // ประมาณ 4 สิทธิ์ต่อวัน x 9 วัน + เผื่อเหลือ
    remaining_quantity: 40,
    limit_per_user: 1, // 1 คนใช้ได้ 1 ครั้ง (เพื่อกันการเหมาจอง)
    secret_codes: ['GOLDEN200'],
    is_public: false, // ต้องพิมพ์โค้ดถึงจะเจอ
    eligible_fields: [3, 4, 5, 6],
    allowed_time_range: { start: '20:00', end: '23:59' }, // เฉพาะเวลา 20:00 ขึ้นไป
    start_date: startDate,
    end_date: endDate,
    status: 'ACTIVE'
  };

  // 2. แคมเปญ Retro Flat Price
  const campaign2 = {
    name: 'Retro Flat Price 399',
    description: 'รหัสลับเตะสนาม 5 คน ราคาเหมา 399 บาทสุทธิ',
    coupon_type: 'MAIN',
    benefit_type: 'DISCOUNT',
    benefit_value: { amount: 101 }, // (500 - 399 = 101) เพื่อให้ราคาสุทธิคือ 399 ตามข้อจำกัดของระบบปัจจุบัน
    total_quantity: 100, // ใส่เยอะๆ ไว้เพราะไม่ได้กำหนดโควต้าแน่นๆ
    remaining_quantity: 100,
    limit_per_user: 2, // ให้คนเดิมจองซ้ำได้ (กระตุ้นยอดสนาม 1-2)
    secret_codes: ['RETRO399'],
    is_public: false, // ต้องพิมพ์โค้ดถึงจะเจอ
    eligible_fields: [1, 2],
    allowed_time_range: null, // ใช้ได้ตลอดทั้งวัน
    start_date: startDate,
    end_date: endDate,
    status: 'ACTIVE'
  };

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaign1, campaign2])
      .select('name, secret_codes, benefit_type');

    if (error) throw error;
    console.log('✅ สร้างแคมเปญสำเร็จ! แคมเปญที่เพิ่มเข้าไปในระบบ:');
    console.table(data);
    
    console.log('\nแจ้งทาง Admin ให้สามารถลุย Broadcast โค้ด GOLDEN200 และ RETRO399 ได้เลยครับ!');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

main();
