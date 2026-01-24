
// Deep inspection of booking state during creation
// Usage: node scripts/debug_price_flow.js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV'; // Anon Key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Use a slot that definitely triggers rounding
// Court 2 (2425): 17:30-18:30 -> Calc: 700, Default: 600
const FIELD_ID = 2425;
const DATE = '2026-03-08';
const TIME_START = '17:30';
const TIME_END = '18:30';

async function run() {
    console.log('--- Debugging Price Update Flow ---');

    // 1. Create Booking
    const payload = {
        fieldId: FIELD_ID,
        date: DATE,
        startTime: TIME_START,
        endTime: TIME_END,
        customerName: 'Debug Price Flow',
        phoneNumber: '099-333-4444',
        note: 'Auto-test flow'
    };

    console.log('1. Creating Booking...');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-booking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Create Response Success:', data.success);
    console.log('Create Response Price:', data.price);
    console.log('Create Response AutoCorrected:', data.autoCorrected);

    const matchId = data.data?.matches?.[0]?.id;
    if (!matchId) {
        console.error('No match ID');
        return;
    }
    console.log('Match ID:', matchId);

    // 2. Immediate Check (Did Create accept the fixed_price?)
    // Note: get-bookings might be cached or slow, but let's try.
    console.log('2. Fetching Booking Status from Get-Bookings...');
    await checkBooking(matchId);

    // 3. Try FORCE UPDATE via debug-price-update if incorrect
    // This isolates if "create-booking update logic" is broken vs "Matchday API rejects update"
    // Since we know create-booking tries to update, if it's still wrong, the update failed.
}

async function checkBooking(matchId) {
    const getRes = await fetch(`${SUPABASE_URL}/functions/v1/get-bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ date: DATE })
    });
    const getData = await getRes.json();
    const booking = getData.bookings?.find(b => b.id === matchId);

    if (booking) {
        console.log(`[STATUS] Total Price: ${booking.total_price}`);
        console.log(`[STATUS] Match Price: ${booking.match_price}`);
        console.log(`[STATUS] Paid Amount: ${booking.paid_amount}`);
        console.log(`[STATUS] Payment Detail:`, JSON.stringify(booking.payment_detail));
    } else {
        console.log('[STATUS] Booking not found');
    }
}

run();
