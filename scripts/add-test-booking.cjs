const { createClient } = require('@supabase/supabase-js');

// Config from test-campaign-conditions.cjs
const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_USER_ID = 'Ua636ab14081b483636896549d2026398'; // E2E Test Team

function generateBookingId() {
    return Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
}

async function main() {
    console.log('Adding test booking for:', TEST_USER_ID);

    // Create a booking for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { data, error } = await supabase.from('bookings').insert([{
        booking_id: generateBookingId(),
        user_id: TEST_USER_ID,
        field_no: 1, // field_no is the column name in `bookings` table
        date: dateStr,
        time_from: '18:00',
        time_to: '20:00',
        duration_h: 2,
        field_no: 1,
        status: 'confirmed',
        price_total_thb: 1200,
        payment_status: 'paid',
        is_promo: false
    }]).select();

    if (error) {
        console.error('Error adding booking:', error);
    } else {
        console.log('Booking added:', data);
    }
}

main();
