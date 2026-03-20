require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function testBooking() {
    const userId = "auto_reg_test_" + Date.now();
    console.log("Testing with userId:", userId);

    const payload = {
        userId: userId,
        fieldId: 1,
        date: "2026-12-31",
        startTime: "18:00",
        endTime: "19:00",
        customerName: "Auto Test Team",
        phoneNumber: "0999999999",
        paymentMethod: "cash"
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-booking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Create Booking Response:", data);

    // Check if profile was created
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supa.from('profiles').select('*').eq('user_id', userId).single();
    console.log("Created Profile:", profile);
}

testBooking().catch(console.error);
