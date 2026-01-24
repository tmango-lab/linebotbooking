
// Integration test to verify Price Calculation & Persistence
// Usage: node scripts/verify_price_calc.js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV'; // Anon Key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FIELD_ID = 2425; // Court 2
const DATE = '2026-04-03'; // Future date to avoid collision
const TIME_START = '17:30';
const TIME_END = '18:30';
const EXPECTED_PRICE = 700;

async function run() {
    console.log('--- Starting Price Verification Integration Test ---');
    console.log(`Creating Booking: Field ${FIELD_ID}, ${DATE} ${TIME_START}-${TIME_END}`);

    try {
        // 1. Call create-booking
        const payload = {
            fieldId: FIELD_ID,
            date: DATE,
            startTime: TIME_START,
            endTime: TIME_END,
            customerName: 'Price Verify',
            phoneNumber: '099-111-2222',
            note: 'Auto-test price'
        };

        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-booking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('Create failed:', await res.text());
            return;
        }

        const data = await res.json();
        console.log('Create Response:', JSON.stringify(data, null, 2));

        if (data.updateResult) {
            console.log('Update Result from Function:', JSON.stringify(data.updateResult, null, 2));
        } else {
            console.log('No updateResult returned from function (maybe not triggered?)');
        }

        const matchId = data.data?.matches?.[0]?.id;
        if (!matchId) {
            console.error('No match ID returned');
            return;
        }

        console.log(`Created Match ID: ${matchId}`);

        // 2. Initial Price Check from response
        const initialPrice = data.price; // Price calculated by function
        console.log(`Function Calculated Price: ${initialPrice}`);

        if (initialPrice !== EXPECTED_PRICE) {
            console.error(`❌ Function calculated wrong price! Expected ${EXPECTED_PRICE}, got ${initialPrice}`);
        } else {
            console.log(`✅ Function price calculation correct.`);
        }

        // 3. Verify Matchday Persistence (fetch back)
        // Wait a bit for propagation if needed?
        console.log('Fetching back booking details...');
        const getRes = await fetch(`${SUPABASE_URL}/functions/v1/get-bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ date: DATE })
        });

        if (!getRes.ok) {
            console.error('Get-bookings failed:', await getRes.text());
            return;
        }

        const getData = await getRes.json();
        const booking = getData.bookings?.find(b => b.id === matchId);

        if (booking) {
            console.log(`Booking Found: ID ${booking.id}`);
            console.log(`Booking Price (total_price): ${booking.total_price}`);
            console.log(`Booking Price (match_price): ${booking.match_price}`);
            console.log(`Booking Payment Detail:`, booking.payment_detail);

            if (booking.total_price === EXPECTED_PRICE) {
                console.log('✅ SUCCESS: Matchday has the correct price (700)!');
            } else {
                console.log(`❌ FAILURE: Matchday has WRONG price. Expected ${EXPECTED_PRICE}, got ${booking.total_price}`);
            }
        } else {
            console.error('Booking not found in get-bookings list');
        }

    } catch (err) {
        console.error('Exception:', err);
    }
}

run();
