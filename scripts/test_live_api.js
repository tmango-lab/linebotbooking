
import dotenv from 'dotenv';
dotenv.config();

// Load keys
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing Supabase URL or Anon Key');
    process.exit(1);
}

const functionUrl = `${supabaseUrl}/functions/v1/get-my-coupons`;
const userId = 'Ua636ab14081b483636896549d2026398';

console.log(`Testing Live API: ${functionUrl}`);
console.log(`UserID: ${userId}`);

async function testApi() {
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        console.log(`Status: ${response.status}`);

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            console.log('Response JSON:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Response Text (Not JSON):', text);
        }

    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

testApi();
