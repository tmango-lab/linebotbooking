
const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs';

async function verify() {
    console.log('Testing Supabase Connection...');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=count`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            console.log('✅ Connection Successful! The API Key is VALID.');
        } else {
            console.log('❌ Connection Failed:', response.status, response.statusText);
            const text = await response.text();
            console.log('Response:', text);
        }
    } catch (err) {
        console.error('❌ Network Error:', err.message);
    }
}

verify();
