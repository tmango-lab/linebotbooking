const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
    console.log('Cleaning up bookings with NULL booking_id...');

    // Select first to see what we are deleting
    const { data: badBookings } = await supabase
        .from('bookings')
        .select('*')
        .is('booking_id', null);

    console.log(`Found ${badBookings?.length || 0} bookings with NULL ID.`);

    if (badBookings && badBookings.length > 0) {
        // We can't delete by booking_id if it's null, so we must use the 'id' (UUID) column
        for (const b of badBookings) {
            if (b.id) {
                console.log(`Deleting booking UUID: ${b.id}`);
                const { error } = await supabase.from('bookings').delete().eq('id', b.id);
                if (error) console.error('Error deleting:', error);
                else console.log('Deleted.');
            } else {
                console.log('Cannot delete booking without UUID id:', b);
            }
        }
    }
}

main();
