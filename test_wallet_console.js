// Test get-my-coupons API directly in browser console
// Copy and paste this into browser console on the wallet page

(async function testWalletAPI() {
    console.log('🔍 Testing Wallet API...');

    const userId = 'Ua636ab14081b483636896549d2026398';
    const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwOTk4MzksImV4cCI6MjA1MjY3NTgzOX0.uqTZJWTcxWnZQqJUZqDMCLwHqGdMWPJCILSQKDJOKhY';

    try {
        // Create Supabase client
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Get session
        let { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log('📝 No session, signing in anonymously...');
            const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

            if (authError) {
                console.error('❌ Auth failed:', authError);
                return;
            }
            session = authData.session;
            console.log('✅ Anonymous session created');
        }

        const token = session.access_token;
        console.log('🔑 Token:', token.substring(0, 30) + '...');

        // Call API
        console.log('📡 Calling get-my-coupons...');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-my-coupons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ userId })
        });

        console.log('📊 Response Status:', response.status, response.statusText);

        const data = await response.json();
        console.log('📦 Response Data:', data);

        if (data.success) {
            console.log('✅ Success!');
            console.log('   Main:', data.main?.length || 0);
            console.log('   On-Top:', data.on_top?.length || 0);
            console.log('   Total:', data.total || 0);

            if (data.total > 0) {
                console.log('📝 Coupons:', [...(data.main || []), ...(data.on_top || [])]);
            } else {
                console.warn('⚠️ No coupons returned despite database having 4 coupons!');
                console.log('💡 Check:');
                console.log('   1. Is userId correct?', userId);
                console.log('   2. Are coupons ACTIVE?');
                console.log('   3. Is expires_at > NOW()?');
            }
        } else {
            console.error('❌ API Error:', data.error);
        }

    } catch (error) {
        console.error('🔥 Failed:', error);
    }
})();
