
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function testGetBookings() {
    console.log("Testing get-bookings...");
    const today = new Date().toISOString().split('T')[0];

    // Call the deployed function
    const res = await fetch(`${supabaseUrl}/functions/v1/get-bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ date: today })
    });

    if (!res.ok) {
        console.error("Error:", await res.text());
        return;
    }

    const data = await res.json();
    console.log(`Retrieved ${data.bookings.length} bookings`);

    // Filter for bookings with discount
    const withDiscount = data.bookings.filter(b => b.discount > 0);
    console.log("Bookings with discount:", JSON.stringify(withDiscount, null, 2));

    if (withDiscount.length === 0) {
        console.log("No bookings with discount found. This might be because no active V2 coupons are used today.");
    }
}

testGetBookings();
