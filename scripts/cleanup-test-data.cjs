const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MICK_ZAB_ID = 'U12fda49f054fdb1a6ba45af9aa0a0814';

async function main() {
    console.log('Searching for E2E Test Team...');
    const { data: e2eUsers, error: e2eError } = await supabase
        .from('profiles')
        .select('user_id, team_name')
        .ilike('team_name', '%E2E%');

    if (e2eError) console.error('Error searching E2E:', e2eError);
    else console.log('Found E2E Users:', e2eUsers);

    console.log('Cleaning up Mick Zab test bookings...');
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    // Find bookings created recently for Mick Zab
    const { data: badBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', MICK_ZAB_ID)
        .gt('created_at', oneHourAgo); // Safety check: only delete very recent ones

    console.log(`Found ${badBookings?.length || 0} recent bookings for Mick Zab.`);

    if (badBookings && badBookings.length > 0) {
        for (const b of badBookings) {
            console.log(`Deleting booking ${b.booking_id} (${b.date} ${b.time_from})`);
            await supabase.from('bookings').delete().eq('booking_id', b.booking_id);
        }
        console.log('Cleanup complete.');
    } else {
        console.log('No recent bad bookings found.');
    }
}

main();
