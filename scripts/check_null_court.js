import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkNullCourtId() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', '2026-01-29')
        .is('field_no', null);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data?.length || 0} records with NULL field_no on 2026-01-29:`);
        data?.forEach(r => {
            console.log(`\nID: ${r.booking_id}`);
            console.log(`Time: ${r.time_from} - ${r.time_to}`);
            console.log(`Name: ${r.display_name}`);
            console.log(`Source: ${r.source}`);
        });
    }
}

checkNullCourtId();
