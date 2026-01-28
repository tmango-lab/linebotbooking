
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function searchBookings() {
    console.log("Searching for specific bookings...");

    // Search for keywords mentioned by user
    const keywords = ['ไฟฟ้า', 'เปิ้ล'];

    for (const kw of keywords) {
        console.log(`\n--- Searching for "${kw}" ---`);
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .ilike('display_name', `%${kw}%`)
            .order('date', { ascending: false });

        if (error) {
            console.error(error);
            continue;
        }

        if (data.length === 0) {
            console.log("No bookings found.");
        } else {
            data.forEach(b => {
                console.log(`[${b.date} ${b.time_from}] ID: ${b.booking_id}`);
                console.log(`   Name: ${b.display_name}`);
                console.log(`   Note: ${b.admin_note}`);
                console.log(`   Is Promo: ${b.is_promo}`);
                console.log(`   Source: ${b.source}`);
                console.log('--------------------------------');
            });
        }
    }
}

searchBookings();
