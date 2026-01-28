
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkBooking() {
    // Check bookings for 2026-01-29
    const today = '2026-01-29';
    console.log(`Checking bookings for date: ${today}`);

    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', today)
        .eq('date', today);

    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }

    console.log(`Found ${data.length} bookings starting at 16:xx on ${today}:`);
    data.forEach(b => {
        console.log(`[${b.booking_id}] Field ${b.field_no}: ${b.time_from} - ${b.time_to} (Status: ${b.status})`);
        console.log(`Raw time_from: "${b.time_from}", Raw time_to: "${b.time_to}"`);
    });
}

checkBooking();
