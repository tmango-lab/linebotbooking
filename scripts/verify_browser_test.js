
// Verification script for April 2nd (Browser Test Fallback)
// Usage: node scripts/verify_browser_test.js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV'; // Anon Key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DATE = '2026-04-02';

async function run() {
    console.log(`--- Checking Bookings for Browser Test Date: ${DATE} ---`);
    console.log('Fetching from Matchday via get-bookings...');

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
    const bookings = getData.bookings || [];

    if (bookings.length === 0) {
        console.log('No bookings found for this date yet.');
    } else {
        bookings.forEach(b => {
            console.log(`Booking ID: ${b.id} | Name: ${b.name} | Desc: ${b.description}`);
            console.log(`Total Price: ${b.total_price} | Match Price: ${b.match_price}`);
            console.log(`Payment Detail:`, JSON.stringify(b.payment_detail));
            console.log('------------------------------------------------');
        });
    }
}

run();
