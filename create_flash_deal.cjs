require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function insertFlashDeal() {
  const flashDeal = {
    name: 'สนาม 6 Flash Deal ลด 50%',
    description: 'ลด 50% สำหรับจองสนาม 6 รอบ 17:00-22:00 วันนี้',
    coupon_type: 'main',
    benefit_type: 'DISCOUNT',
    discount_percent: 50,
    status: 'ACTIVE',
    eligible_fields: [6],
    payment_methods: ['QR'],
    is_public: false, // Hidden from general list, accessed via link/code
    secret_codes: ['FLASH6'],
    start_date: new Date().toISOString(),
    // 2026-03-20 23:59:59 +07:00
    end_date: new Date('2026-03-20T23:59:59+07:00').toISOString(), 
    valid_time_start: '17:00:00',
    valid_time_end: '22:00:00',
    duration_days: 1, // Expires in 1 day or end_date, whichever is sooner
    is_stackable: false,
    allow_ontop_stacking: true
  };

  console.log('Inserting flash deal...');
  const { data, error } = await supabase.from('campaigns').insert(flashDeal).select();
  
  if (error) {
    console.error('Error inserting flash deal:', error);
  } else {
    console.log('Success! Inserted campaign:', data);
  }
}

insertFlashDeal();
