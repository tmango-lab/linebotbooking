
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkPromoCodes() {
    console.log("Checking promo_codes table...");

    // Check for used codes recently
    const { data: promos, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('status', 'used')
        .order('used_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${promos.length} recently used promos:`);
    promos.forEach(p => {
        console.log(`Code: ${p.code} | Used At: ${p.used_at} | Booking ID: ${p.booking_id}`);
        console.log(`   User: ${p.user_id} | Field: ${p.field_id} | Date: ${p.booking_date} ${p.time_from}`);
    });
}

checkPromoCodes();
