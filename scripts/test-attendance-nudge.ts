
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

// Function URL (Standard Supabase Edge Function URL format)
// If running locally via supabase start, it might be different, but assuming production or cloud URL from .env
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/attendance-nudge`;

console.log(`🚀 Invoking: ${FUNCTION_URL}`);

async function invoke() {
    try {
        const res = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const text = await res.text();
        console.log(`📡 Status: ${res.status}`);
        try {
            console.log('📦 Response:', JSON.parse(text));
        } catch {
            console.log('📦 Response:', text);
        }

    } catch (err) {
        console.error('🔥 Error invoking function:', err);
    }
}

invoke();
