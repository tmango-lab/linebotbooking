const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
    try {
        console.log('Checking for bookings with NULL booking_id...');
        const { count, error } = await supabase
            .from('bookings')
            .delete({ count: 'exact' })
            .is('booking_id', null);

        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log(`Cleanup finished. Deleted ${count} records.`);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    } finally {
        console.log('Exiting...');
        process.exit(0);
    }
}

main();
