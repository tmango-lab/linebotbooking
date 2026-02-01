// Direct API test using fetch
// Run: node test_api_direct.js

const userId = 'Ua636ab14081b483636896549d2026398';
const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

async function testAPI() {
    console.log('🔍 Testing get-my-coupons with Service Role Key...\n');

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-my-coupons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'apikey': SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ userId })
        });

        console.log('📊 Status:', response.status, response.statusText);

        const data = await response.json();

        console.log('\n📦 Response:');
        console.log(JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n✅ API Works!');
            console.log(`   Total coupons: ${data.total}`);

            if (data.total === 0) {
                console.log('\n⚠️ WARNING: Database has 4 coupons but API returns 0!');
                console.log('   This means the query filter is wrong.');
            } else {
                console.log('\n🎉 SUCCESS: Coupons are being returned correctly!');
                console.log('   The issue is likely in the frontend/LIFF app.');
            }
        } else {
            console.log('\n❌ API Error:', data.error);
        }

    } catch (error) {
        console.error('\n🔥 Failed:', error.message);
    }
}

testAPI();
