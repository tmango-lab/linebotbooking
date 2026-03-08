import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function invokeSetupDb() {
    const token = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    console.log("Invoking setup-db...");

    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/setup-db`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    console.log(`Response Status: ${response.status}`);
    const data = await response.text();
    console.log('Response Body:', data);
}

invokeSetupDb().catch(console.error);
