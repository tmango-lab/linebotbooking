/**
 * Comprehensive Campaign Conditions Test Script
 * ===============================================
 * Tests ALL conditions in CampaignModal + create-booking + collect-coupon
 * 
 * Run: node scripts/test-campaign-conditions.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const FUNC_URL = `${SUPABASE_URL}/functions/v1`;
const TEST_USER_ID = 'TEST_CAMPAIGN_AUDIT_USER';
const TEST_PREFIX = '[TEST_AUDIT]';

// Utility
const results = [];
function log(test, pass, detail = '') {
    const icon = pass ? '✅' : '❌';
    results.push({ test, pass, detail });
    console.log(`  ${icon} ${test}${detail ? ' — ' + detail : ''}`);
}

async function callFunction(name, body) {
    const res = await fetch(`${FUNC_URL}/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
            'apikey': ANON_KEY
        },
        body: JSON.stringify(body)
    });
    return res.json();
}

// ============================================================
// SETUP
// ============================================================
async function setup() {
    console.log('\n🔧 Setting up test data...\n');
    await supabase.from('profiles').upsert({
        user_id: TEST_USER_ID,
        team_name: 'Test Audit Team',
        phone_number: '0999999999'
    }, { onConflict: 'user_id' });
}

// ============================================================
// CLEANUP
// ============================================================
async function cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('user_coupons').delete().eq('user_id', TEST_USER_ID);
    const { data: campaigns } = await supabase.from('campaigns').select('id').like('name', `${TEST_PREFIX}%`);
    if (campaigns && campaigns.length > 0) {
        const ids = campaigns.map(c => c.id);
        await supabase.from('user_coupons').delete().in('campaign_id', ids);
    }
    await supabase.from('bookings').delete().eq('user_id', TEST_USER_ID);
    await supabase.from('campaigns').delete().like('name', `${TEST_PREFIX}%`);
    await supabase.from('profiles').delete().eq('user_id', TEST_USER_ID);
    console.log('  Done!\n');
}

// ============================================================
// Helper: Create campaign
// ============================================================
let campaignCounter = 0;
async function createCampaign(overrides = {}) {
    campaignCounter++;
    const base = {
        name: `${TEST_PREFIX} C${campaignCounter}`,
        description: 'Auto-test campaign',
        status: 'ACTIVE',
        discount_amount: 100,
        discount_percent: 0,
        max_discount: null,
        reward_item: null,
        coupon_type: 'MAIN',
        is_stackable: false,
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        valid_time_start: null,
        valid_time_end: null,
        eligible_fields: null,
        payment_methods: null,
        min_spend: 0,
        eligible_days: null,
        limit_per_user: 5,
        total_quantity: 100,
        remaining_quantity: 100,
        redemption_limit: null,
        redemption_count: 0,
        duration_days: null,
        secret_codes: null,
    };
    const payload = { ...base, ...overrides };
    const { data, error } = await supabase.from('campaigns').insert([payload]).select().single();
    if (error) throw new Error(`Create campaign failed: ${error.message}`);
    return data;
}

// Helper: Give user a coupon (each campaign gets its own unique coupon)
async function giveCoupon(campaignId, status = 'ACTIVE', expiresAt = null) {
    // Clean any existing coupon for this user+campaign first to avoid unique constraint
    await supabase.from('user_coupons').delete()
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', campaignId);

    const { data, error } = await supabase.from('user_coupons').insert([{
        user_id: TEST_USER_ID,
        campaign_id: campaignId,
        status: status,
        expires_at: expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
    }]).select().single();
    if (error) throw new Error(`Give coupon failed: ${error.message}`);
    return data;
}

// Helper: Attempt booking with coupon (correct field names!)
async function tryBooking(couponId, overrides = {}) {
    const base = {
        userId: TEST_USER_ID,
        fieldId: 1,                    // fieldId, not fieldNo
        date: '2026-02-20',           // Use a future date (Friday)
        startTime: '16:00',
        endTime: '18:00',
        customerName: 'Test Audit Team',
        phoneNumber: '0999999999',
        paymentMethod: 'CASH',
        couponId: couponId,
    };
    return callFunction('create-booking', { ...base, ...overrides });
}

// Helper: Clean a booking
async function cleanBooking(result) {
    if (result && result.booking && result.booking.booking_id) {
        await supabase.from('bookings').delete().eq('booking_id', result.booking.booking_id);
    }
}

// ============================================================
// TEST GROUP 1: Campaign Status & Date
// ============================================================
async function testCampaignStatusAndDate() {
    console.log('\n📋 Group 1: Campaign Status & Date Conditions\n');

    // T1.1: ACTIVE campaign should work
    const c1 = await createCampaign({ status: 'ACTIVE' });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    log('ACTIVE campaign → booking succeeds', !!r1.booking, r1.error || `ID: ${r1.booking?.booking_id}`);
    await cleanBooking(r1);

    // T1.2: INACTIVE campaign should fail
    const c2 = await createCampaign({ status: 'INACTIVE' });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id);
    log('INACTIVE campaign → booking fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // T1.3: Expired campaign (end_date in past)
    const c3 = await createCampaign({
        start_date: new Date(Date.now() - 10 * 86400000).toISOString(),
        end_date: new Date(Date.now() - 1 * 86400000).toISOString()
    });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id);
    log('Expired campaign (past end_date) → booking fails', !!r3.error, r3.error || 'SHOULD HAVE FAILED');

    // T1.4: Future campaign (start_date in future)
    const c4 = await createCampaign({
        start_date: new Date(Date.now() + 5 * 86400000).toISOString()
    });
    const coupon4 = await giveCoupon(c4.id);
    const r4 = await tryBooking(coupon4.id);
    log('Future campaign (not started) → booking fails', !!r4.error, r4.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 2: Eligible Fields
// ============================================================
async function testEligibleFields() {
    console.log('\n📋 Group 2: Eligible Fields Condition\n');

    // T2.1: Eligible field matches 
    const c1 = await createCampaign({ eligible_fields: [1, 2] });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { fieldId: 1 });
    log('Booking field 1, eligible [1,2] → succeeds', !!r1.booking, r1.error || 'OK');
    await cleanBooking(r1);

    // T2.2: Field NOT in eligible list
    const c2 = await createCampaign({ eligible_fields: [3, 4] });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { fieldId: 1 });
    log('Booking field 1, eligible [3,4] → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // T2.3: No eligible_fields (null) = all fields OK
    const c3 = await createCampaign({ eligible_fields: null });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id, { fieldId: 5 });
    log('No eligible_fields (null) → any field OK', !!r3.booking, r3.error || 'OK');
    await cleanBooking(r3);
}

// ============================================================
// TEST GROUP 3: Payment Methods
// ============================================================
async function testPaymentMethods() {
    console.log('\n📋 Group 3: Payment Methods Condition\n');

    // T3.1: Payment method matches
    const c1 = await createCampaign({ payment_methods: ['CASH'] });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { paymentMethod: 'CASH' });
    log('CASH booking, eligible [CASH] → succeeds', !!r1.booking, r1.error || 'OK');
    await cleanBooking(r1);

    // T3.2: Payment method mismatch
    const c2 = await createCampaign({ payment_methods: ['QR'] });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { paymentMethod: 'CASH' });
    log('CASH booking, eligible [QR] → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // T3.3: No restriction
    const c3 = await createCampaign({ payment_methods: null });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id, { paymentMethod: 'CASH' });
    log('No payment_methods (null) → any OK', !!r3.booking, r3.error || 'OK');
    await cleanBooking(r3);
}

// ============================================================
// TEST GROUP 4: Min Spend
// ============================================================
async function testMinSpend() {
    console.log('\n📋 Group 4: Min Spend Condition\n');

    // Field 1, 16:00-18:00 = 2h → 500+700=1200 (pre+post crossing 18:00) or 1000 pre
    // T4.1: Price >= min_spend
    const c1 = await createCampaign({ min_spend: 500 });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    log('Price >= min_spend (500) → succeeds', !!r1.booking, r1.error || `Price: ${r1.booking?.price}`);
    await cleanBooking(r1);

    // T4.2: Price < min_spend (impossibly high)
    const c2 = await createCampaign({ min_spend: 99999 });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id);
    log('Price < min_spend (99999) → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 5: Valid Time Range
// ============================================================
async function testValidTimeRange() {
    console.log('\n📋 Group 5: Valid Time Range Condition\n');

    // T5.1: Booking within valid range
    const c1 = await createCampaign({ valid_time_start: '15:00', valid_time_end: '20:00' });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { startTime: '16:00', endTime: '18:00' });
    log('Booking 16-18, valid 15-20 → succeeds', !!r1.booking, r1.error || 'OK');
    await cleanBooking(r1);

    // T5.2: Booking outside valid range
    const c2 = await createCampaign({ valid_time_start: '18:00', valid_time_end: '21:00' });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { startTime: '10:00', endTime: '12:00' });
    log('Booking 10-12, valid 18-21 → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 6: Eligible Days
// ============================================================
async function testEligibleDays() {
    console.log('\n📋 Group 6: Eligible Days Condition\n');

    // 2026-02-20 = Friday
    // T6.1: Friday booking, eligible includes Fri
    const c1 = await createCampaign({ eligible_days: ['Fri', 'Sat'] });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { date: '2026-02-20' });
    log('Friday booking, eligible [Fri,Sat] → succeeds', !!r1.booking, r1.error || 'OK');
    await cleanBooking(r1);

    // T6.2: Friday booking, eligible only Mon-Thu
    const c2 = await createCampaign({ eligible_days: ['Mon', 'Tue', 'Wed', 'Thu'] });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { date: '2026-02-20' });
    log('Friday booking, eligible [Mon-Thu] → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 7: Coupon Expiry
// ============================================================
async function testCouponExpiry() {
    console.log('\n📋 Group 7: Coupon Expiry\n');

    // T7.1: Expired coupon → FAIL
    const c1 = await createCampaign({});
    const coupon1 = await giveCoupon(c1.id, 'ACTIVE', new Date(Date.now() - 86400000).toISOString());
    const r1 = await tryBooking(coupon1.id);
    log('Expired coupon (yesterday) → fails', !!r1.error, r1.error || 'SHOULD HAVE FAILED');

    // T7.2: Valid coupon → OK (use different campaign to avoid unique constraint)
    const c2 = await createCampaign({});
    const coupon2 = await giveCoupon(c2.id, 'ACTIVE', new Date(Date.now() + 30 * 86400000).toISOString());
    const r2 = await tryBooking(coupon2.id);
    log('Valid coupon (30 days left) → succeeds', !!r2.booking, r2.error || 'OK');
    await cleanBooking(r2);
}

// ============================================================
// TEST GROUP 8: Coupon Status
// ============================================================
async function testCouponStatus() {
    console.log('\n📋 Group 8: Coupon Status\n');

    // T8.1: USED coupon → FAIL
    const c1 = await createCampaign({});
    const coupon1 = await giveCoupon(c1.id, 'USED');
    const r1 = await tryBooking(coupon1.id);
    log('USED coupon → fails', !!r1.error, r1.error || 'SHOULD HAVE FAILED');

    // T8.2: EXPIRED status coupon → FAIL
    const c2 = await createCampaign({});
    const coupon2 = await giveCoupon(c2.id, 'EXPIRED');
    const r2 = await tryBooking(coupon2.id);
    log('EXPIRED status coupon → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 9: Discount Types & max_discount
// ============================================================
async function testDiscountTypes() {
    console.log('\n📋 Group 9: Discount Types & max_discount\n');

    // T9.1: Fixed amount = 100
    const c1 = await createCampaign({ discount_amount: 100 });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    const d1 = r1.booking?.discount_amount || 0;
    log('Fixed 100 THB discount', !!r1.booking && d1 === 100, `Discount: ${d1}, Price: ${r1.booking?.price}`);
    await cleanBooking(r1);

    // T9.2: 50% discount NO cap
    const c2 = await createCampaign({ discount_amount: 0, discount_percent: 50, max_discount: null });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id);
    const d2 = r2.booking?.discount_amount || 0;
    const orig2 = r2.booking?.original_price || 0;
    const expectedDiscount2 = Math.floor(orig2 * 0.5);
    log('50% no cap → full 50% applied', !!r2.booking && d2 === expectedDiscount2, `Original: ${orig2}, Discount: ${d2}, Expected: ${expectedDiscount2}`);
    await cleanBooking(r2);

    // T9.3: 50% WITH cap 200
    const c3 = await createCampaign({ discount_amount: 0, discount_percent: 50, max_discount: 200 });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id);
    const d3 = r3.booking?.discount_amount || 0;
    log('50% cap 200 → discount ≤ 200', !!r3.booking && d3 > 0 && d3 <= 200, `Discount: ${d3} (cap: 200)`);
    await cleanBooking(r3);

    // T9.4: Reward item
    const c4 = await createCampaign({ discount_amount: 0, reward_item: 'Free Water' });
    const coupon4 = await giveCoupon(c4.id);
    const r4 = await tryBooking(coupon4.id);
    log('Reward item (Free Water) → booking works', !!r4.booking && r4.booking.reward_item === 'Free Water',
        r4.error || `Reward: ${r4.booking?.reward_item}`);
    await cleanBooking(r4);
}

// ============================================================
// TEST GROUP 10: Redemption Limit
// ============================================================
async function testRedemptionLimit() {
    console.log('\n📋 Group 10: Redemption Limit\n');

    // Campaign with limit 1
    const c1 = await createCampaign({ redemption_limit: 1, redemption_count: 0 });

    // T10.1: First redemption → OK
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    log('1st redemption (limit=1) → succeeds', !!r1.booking, r1.error || 'OK');

    // T10.2: Second redemption → FAIL (need new campaign coupon)
    // Can't create 2nd coupon for same campaign (unique constraint), so increment redemption_count
    await supabase.from('campaigns').update({ redemption_count: 1 }).eq('id', c1.id);
    const c1b = await createCampaign({ redemption_limit: 1, redemption_count: 1 });
    const coupon2 = await giveCoupon(c1b.id);
    const r2 = await tryBooking(coupon2.id);
    log('Redemption already at limit → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    await cleanBooking(r1);
}

// ============================================================
// TEST GROUP 11: Collect Coupon — Refillable Quota
// ============================================================
async function testRefillableQuota() {
    console.log('\n📋 Group 11: Collect Coupon — Refillable Quota\n');

    const c1 = await createCampaign({ limit_per_user: 1 });

    // T11.1: First collection → OK
    const r1 = await callFunction('collect-coupon', { userId: TEST_USER_ID, campaignId: c1.id });
    log('1st collection (limit=1) → succeeds', r1.success === true, r1.error || 'OK');

    // T11.2: Second collection while first ACTIVE → FAIL
    const r2 = await callFunction('collect-coupon', { userId: TEST_USER_ID, campaignId: c1.id });
    log('2nd collection (1 ACTIVE exists) → fails', r2.success !== true, r2.error || 'SHOULD HAVE FAILED');

    // T11.3: Mark as USED, collect again → OK (Refillable!)
    await supabase.from('user_coupons')
        .update({ status: 'USED' })
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', c1.id)
        .eq('status', 'ACTIVE');

    const r3 = await callFunction('collect-coupon', { userId: TEST_USER_ID, campaignId: c1.id });
    log('After USED → collect again (Refillable)', r3.success === true, r3.error || 'OK');
}

// ============================================================
// TEST GROUP 12: Lazy Expiry
// ============================================================
async function testLazyExpiry() {
    console.log('\n📋 Group 12: Lazy Expiry in get-my-coupons\n');

    const c1 = await createCampaign({});

    // Clean existing coupons first
    await supabase.from('user_coupons').delete()
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', c1.id);

    // Insert expired but still ACTIVE coupon
    await supabase.from('user_coupons').insert([{
        user_id: TEST_USER_ID,
        campaign_id: c1.id,
        status: 'ACTIVE',
        expires_at: new Date(Date.now() - 86400000).toISOString()
    }]);

    // Call get-my-coupons → triggers lazy expiry
    await callFunction('get-my-coupons', { userId: TEST_USER_ID });

    // Check DB status
    const { data: dbCoupon } = await supabase.from('user_coupons')
        .select('status')
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', c1.id)
        .single();

    log('Lazy expiry → status changed to EXPIRED in DB', dbCoupon?.status === 'EXPIRED',
        `DB status: ${dbCoupon?.status}`);
}

// ============================================================
// TEST GROUP 13: Secret Codes
// ============================================================
async function testSecretCodes() {
    console.log('\n📋 Group 13: Secret Code Collection\n');

    const c1 = await createCampaign({
        is_public: false,
        secret_codes: ['TESTCODE123'],
        limit_per_user: 5
    });

    // T13.1: Correct secret code → OK
    const r1 = await callFunction('collect-coupon', {
        userId: TEST_USER_ID,
        campaignId: c1.id,
        secretCode: 'TESTCODE123'
    });
    log('Correct secret code → collection succeeds', r1.success === true, r1.error || 'OK');

    // Clean for next test
    await supabase.from('user_coupons').delete()
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', c1.id);

    // T13.2: Wrong secret code → FAIL
    const r2 = await callFunction('collect-coupon', {
        userId: TEST_USER_ID,
        campaignId: c1.id,
        secretCode: 'WRONGCODE'
    });
    log('Wrong secret code → collection fails', r2.success !== true, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// MAIN  
// ============================================================
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   🔍 Campaign Conditions Audit Test');
    console.log('   ' + new Date().toLocaleString('th-TH'));
    console.log('═══════════════════════════════════════════════════════');

    try {
        await cleanup();
        await setup();

        await testCampaignStatusAndDate();
        await testEligibleFields();
        await testPaymentMethods();
        await testMinSpend();
        await testValidTimeRange();
        await testEligibleDays();
        await testCouponExpiry();
        await testCouponStatus();
        await testDiscountTypes();
        await testRedemptionLimit();
        await testRefillableQuota();
        await testLazyExpiry();
        await testSecretCodes();

    } catch (err) {
        console.error('\n💥 FATAL ERROR:', err.message);
    } finally {
        await cleanup();
    }

    // Summary
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`   RESULTS: ${passed}/${total} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════');

    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`   • ${r.test}: ${r.detail}`);
        });
    } else {
        console.log('\n🎉 All tests passed!');
    }

    console.log('');
}

main();
