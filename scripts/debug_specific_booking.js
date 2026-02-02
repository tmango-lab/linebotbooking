
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET_DATE = '2026-02-02';
const TARGET_NAME_PART = 'AFC 38';

async function run() {
    console.log(`Searching for booking on ${TARGET_DATE} matching "${TARGET_NAME_PART}"...`);

    // 1. Find the booking
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', TARGET_DATE)
        .ilike('display_name', `%${TARGET_NAME_PART}%`);

    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }

    if (!bookings || bookings.length === 0) {
        console.log('No booking found.');
        return;
    }

    const booking = bookings[0];
    console.log(`Found Booking ID: ${booking.booking_id} (PK: ${booking.id})`);
    console.log(`Current Price: ${booking.price_total_thb}`);
    console.log(`Time: ${booking.time_from} - ${booking.time_to}`);
    console.log(`Note: ${booking.admin_note}`);

    // 2. Attempt update via API
    const NEW_PRICE = 4500; // Test price
    console.log(`\nAttempting to update price to ${NEW_PRICE} via API...`);

    const payload = {
        matchId: booking.booking_id,
        price: NEW_PRICE,
        timeStart: `${booking.date} ${booking.time_from}`,
        timeEnd: `${booking.date} ${booking.time_to}`,
        adminNote: booking.admin_note,
        customerName: booking.display_name,
        tel: booking.phone_number
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/update-booking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log('Update Result:', JSON.stringify(result, null, 2));

    // 3. Verify
    const { data: updated } = await supabase
        .from('bookings')
        .select('price_total_thb')
        .eq('booking_id', booking.booking_id)
        .single();

    console.log(`\nPrice after update: ${updated?.price_total_thb}`);

    if (updated?.price_total_thb === NEW_PRICE) {
        console.log('SUCCESS: Price updated correctly.');
    } else {
        console.log('FAILURE: Price returned to original or calc value.');
    }
}

run();
