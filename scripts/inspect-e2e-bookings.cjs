const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
    console.log('Inspecting specific failed E2E booking...');
    // Finding booking by ID from the "Booking added" log in step 662
    // ID: 33407d0e-65f7-403d-8902-45b0244c6b39

    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', '33407d0e-65f7-403d-8902-45b0244c6b39') // Note: insert returned "id" but table PK is usually booking_id?
        // Let's check if "id" from insert matches "booking_id" or if it's a different column.
        // In step 662 output: { id: '334...', booking_id: null ... }
        // This is suspicious. 'booking_id' is null?
        // If 'booking_id' is the PK and it's null, that's why cancel fails (it uses booking_id).
        // Let's query by the UUID 'id' column if it exists, or just use the user_id and recent time.
        .single();

    if (error) {
        console.log('Error fetching by ID:', error);
        // Fallback: fetch recent by user
        const { data: recent } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', 'Ua636ab14081b483636896549d2026398') // E2E User
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        console.log('Most recent booking for user:', JSON.stringify(recent, null, 2));
    } else {
        console.log('Found by ID:', JSON.stringify(booking, null, 2));
    }
}

main();
