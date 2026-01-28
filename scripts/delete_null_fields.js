import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deleteNullFieldRecords() {
    console.log('Deleting records with NULL field_no...\n');

    const { data, error } = await supabase
        .from('bookings')
        .delete()
        .eq('source', 'MATCHDAY_IMPORT')
        .is('field_no', null)
        .select();

    if (error) {
        console.error('❌ Error:', error);
    } else {
        console.log(`✅ Deleted ${data?.length || 0} records`);
        console.log('\nDeleted records:');
        data?.forEach((r, i) => {
            console.log(`  ${i + 1}. ID: ${r.booking_id}, Date: ${r.date}, Name: ${r.display_name}`);
        });
    }
}

deleteNullFieldRecords();
