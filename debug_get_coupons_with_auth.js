// Enhanced debug script with anonymous auth
// Run: node debug_get_coupons_with_auth.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3NTU3MzAsImV4cCI6MjA1MjMzMTczMH0.cYqGLqEGnPxQJCmEZfgUNnCkQVDjJXuNNXXjMKzBgdI';
const USER_ID = 'Ua636ab14081b483636896549d2026398';

async function testWithAuth() {
    console.log('🔍 Testing get-my-coupons with Anonymous Auth...\n');

    try {
        // Create Supabase client
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Sign in anonymously
        console.log('🔐 Signing in anonymously...');
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

        if (authError) {
            console.error('❌ Auth failed:', authError);
            return;
        }

        console.log('✅ Auth successful!');
        console.log('   Session ID:', authData.session.access_token.substring(0, 20) + '...');

        // Call API
        console.log('\n📡 Calling get-my-coupons API...');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-my-coupons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authData.session.access_token}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ userId: USER_ID })
        });

        console.log('📊 Response Status:', response.status, response.statusText);

        const data = await response.json();

        console.log('\n📦 Response Body:');
        console.log(JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n✅ API Success!');
            console.log(`   Main Coupons: ${data.main?.length || 0}`);
            console.log(`   On-Top Coupons: ${data.on_top?.length || 0}`);
            console.log(`   Total: ${data.total || 0}`);

            if (data.total === 0) {
                console.log('\n⚠️ No coupons returned!');
                console.log('   This means the query filters are removing all coupons.');
                console.log('   Check:');
                console.log('   1. expires_at IS NULL → filtered out');
                console.log('   2. expires_at <= NOW() → filtered out');
                console.log('   3. status != ACTIVE → filtered out');
            } else {
                console.log('\n📝 Coupons found:');
                [...(data.main || []), ...(data.on_top || [])].forEach((c, i) => {
                    console.log(`   ${i + 1}. ${c.name || 'Unnamed'}`);
                    console.log(`      Coupon ID: ${c.coupon_id}`);
                    console.log(`      Campaign ID: ${c.campaign_id}`);
                    console.log(`      Expires: ${c.expiry}`);
                });
            }
        } else {
            console.log('\n❌ API Error:', data.error);
        }

    } catch (error) {
        console.error('\n🔥 Request Failed:', error.message);
        console.error(error.stack);
    }
}

testWithAuth();
