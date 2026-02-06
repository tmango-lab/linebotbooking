
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using Anon key (Function should allow it if perms are right, or use Service Role if needed)

async function invokeCron() {
    console.log('--- Invoking Cron Job ---');
    const endpoint = `${supabaseUrl}/functions/v1/cron-cancel-unpaid`;

    console.log(`Endpoint: ${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Error: ${response.status} - ${text}`);
            return;
        }

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

invokeCron();
