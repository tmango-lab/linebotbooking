// Test get-my-coupons API directly
// Run: node debug_get_coupons.js

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3NTU3MzAsImV4cCI6MjA1MjMzMTczMH0.cYqGLqEGnPxQJCmEZfgUNnCkQVDjJXuNNXXjMKzBgdI';
const USER_ID = 'Ua636ab14081b483636896549d2026398';

async function testGetMyCoupons() {
    console.log('🔍 Testing get-my-coupons API...\n');

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-my-coupons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ userId: USER_ID })
        });

        console.log('📊 Response Status:', response.status, response.statusText);
        console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();

        console.log('\n📦 Response Body:');
        console.log(JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n✅ API Success!');
            console.log(`   Main Coupons: ${data.main?.length || 0}`);
            console.log(`   On-Top Coupons: ${data.on_top?.length || 0}`);
            console.log(`   Total: ${data.total || 0}`);

            if (data.main?.length > 0) {
                console.log('\n📝 Main Coupons:');
                data.main.forEach((c, i) => {
                    console.log(`   ${i + 1}. ${c.name}`);
                    console.log(`      ID: ${c.coupon_id}`);
                    console.log(`      Expires: ${c.expiry}`);
                });
            }

            if (data.on_top?.length > 0) {
                console.log('\n📝 On-Top Coupons:');
                data.on_top.forEach((c, i) => {
                    console.log(`   ${i + 1}. ${c.name}`);
                    console.log(`      ID: ${c.coupon_id}`);
                    console.log(`      Expires: ${c.expiry}`);
                });
            }

            if (data.total === 0) {
                console.log('\n⚠️ No coupons returned!');
                console.log('   Possible reasons:');
                console.log('   1. expires_at is NULL');
                console.log('   2. expires_at is in the past');
                console.log('   3. status is not ACTIVE');
                console.log('   4. No coupons exist for this user');
            }
        } else {
            console.log('\n❌ API Error:', data.error);
        }

    } catch (error) {
        console.error('\n🔥 Request Failed:', error.message);
    }
}

testGetMyCoupons();
