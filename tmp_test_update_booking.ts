import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testUpdateBooking() {
    const token = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    const updatePayload = {
        matchId: "1772869027806",
        price: 2000,
        adminNote: "",
        isPaid: true,
        customerName: "ปั่ง-น้ำ",
        tel: "0610541143",
        timeStart: "2026-03-07 20:00:00",
        timeEnd: "2026-03-07 22:00:00",
        paymentStatus: "paid",
        status: "confirmed"
    };

    console.log("Sending payload:", updatePayload);

    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/update-booking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
    });

    console.log(`Response Status: ${response.status}`);
    const data = await response.text();
    console.log('Response Body:', data);
}

testUpdateBooking().catch(console.error);
