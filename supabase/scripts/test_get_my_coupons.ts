import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

async function testEdgeFunction() {
    const userId = 'Ua636ab14081b483636896549d2026398';

    const res = await fetch(`${supabaseUrl}/functions/v1/get-my-coupons`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: userId, filter: 'active' })
    });

    if (!res.ok) {
        console.error('API Error:', await res.text());
    } else {
        const data = await res.json();
        console.log(`Main Coupons: ${data.main.length}`);
        console.log(`On-Top Coupons: ${data.on_top.length}`);
        console.log(JSON.stringify(data, null, 2));
    }
}

testEdgeFunction();
