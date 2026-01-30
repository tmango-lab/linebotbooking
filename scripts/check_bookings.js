
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const today = '2026-01-30'; // Hardcoded to match user's screenshot date

async function checkBookings() {
    console.log(`Checking bookings for ${today}...`);

    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', today);

    if (error) return console.error("❌ Error fetching:", error);

    console.log(`Found ${bookings.length} bookings:`);
    bookings.forEach(b => {
        console.log(`- ID: ${b.booking_id} | Time: ${b.time_from}-${b.time_to} | Price: ${b.price_total_thb} | Name: ${b.display_name}`);
    });
}

checkBookings();
