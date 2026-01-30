
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BAD_ID = 'test_ag_1769737830027';

async function deleteBadBooking() {
    console.log(`Deleting booking ID: ${BAD_ID}...`);

    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('booking_id', BAD_ID);

    if (error) return console.error("❌ Error deleting:", error);

    console.log(`✅ Deleted successfully.`);
}

deleteBadBooking();
