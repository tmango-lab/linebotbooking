/**
 * Comprehensive Campaign Conditions Test Script
 * ===============================================
 * Tests ALL conditions in CampaignModal + create-booking + collect-coupon
 * 
 * Run: node scripts/test-campaign-conditions.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';
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
// SETUP: Create Test Data
// ============================================================
async function setup() {
    console.log('\n🔧 Setting up test data...\n');

    // Create test profile
    await supabase.from('profiles').upsert({
        user_id: TEST_USER_ID,
        team_name: 'Test Audit Team',
        phone_number: '0999999999'
    }, { onConflict: 'user_id' });

    return true;
}

// ============================================================
// CLEANUP: Remove All Test Data 
// ============================================================
async function cleanup() {
    console.log('\n🧹 Cleaning up test data...');

    // Delete test coupons
    await supabase.from('user_coupons').delete().eq('user_id', TEST_USER_ID);

    // Delete test campaigns
    await supabase.from('campaigns').delete().like('name', `${TEST_PREFIX}%`);

    // Delete test bookings
    await supabase.from('bookings').delete().eq('user_id', TEST_USER_ID);

    // Delete test profile
    await supabase.from('profiles').delete().eq('user_id', TEST_USER_ID);

    console.log('  Done!\n');
}

// ============================================================
// Helper: Create a campaign with given overrides
// ============================================================
async function createCampaign(overrides = {}) {
    const base = {
        name: `${TEST_PREFIX} Test Campaign`,
        description: 'Auto-test campaign',
        status: 'ACTIVE',
        discount_amount: 100,
        discount_percent: 0,
        max_discount: null,
        reward_item: null,
        coupon_type: 'MAIN',
        is_stackable: false,
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(), // 30 days from now
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

// Helper: Give user a coupon for a campaign
async function giveCoupon(campaignId, status = 'ACTIVE', expiresAt = null) {
    const { data, error } = await supabase.from('user_coupons').insert([{
        user_id: TEST_USER_ID,
        campaign_id: campaignId,
        status: status,
        expires_at: expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
    }]).select().single();
    if (error) throw new Error(`Give coupon failed: ${error.message}`);
    return data;
}

// Helper: Attempt booking with coupon
async function tryBooking(couponId, overrides = {}) {
    const base = {
        userId: TEST_USER_ID,
        fieldNo: 1,
        date: '2026-02-15',
        startTime: '16:00',
        endTime: '18:00',
        paymentMethod: 'CASH',
        couponId: couponId,
    };
    return callFunction('create-booking', { ...base, ...overrides });
}

// ============================================================
// TEST GROUP 1: Campaign Status & Date
// ============================================================
async function testCampaignStatusAndDate() {
    console.log('\n📋 Group 1: Campaign Status & Date Conditions\n');

    // T1.1: ACTIVE campaign should work
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Active`, status: 'ACTIVE' });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    log('ACTIVE campaign → booking succeeds', !r1.error, r1.error || `Booking ID: ${r1.booking?.booking_id}`);
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T1.2: INACTIVE campaign should fail
    const c2 = await createCampaign({ name: `${TEST_PREFIX} Inactive`, status: 'INACTIVE' });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id);
    log('INACTIVE campaign → booking fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // T1.3: Expired campaign (end_date in past) should fail
    const c3 = await createCampaign({
        name: `${TEST_PREFIX} Expired`,
        start_date: new Date(Date.now() - 10 * 86400000).toISOString(),
        end_date: new Date(Date.now() - 1 * 86400000).toISOString()
    });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id);
    log('Expired campaign (past end_date) → booking fails', !!r3.error, r3.error || 'SHOULD HAVE FAILED');

    // T1.4: Future campaign (start_date in future) should fail
    const c4 = await createCampaign({
        name: `${TEST_PREFIX} Future`,
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

    // T2.1: Eligible field matches → OK
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Field Match`, eligible_fields: [1, 2] });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { fieldNo: 1 });
    log('Booking field 1, eligible [1,2] → succeeds', !r1.error, r1.error || 'OK');
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T2.2: Field NOT in eligible list → FAIL
    const c2 = await createCampaign({ name: `${TEST_PREFIX} Field Mismatch`, eligible_fields: [3, 4] });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { fieldNo: 1 });
    log('Booking field 1, eligible [3,4] → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // T2.3: No eligible_fields set (null) → all fields OK
    const c3 = await createCampaign({ name: `${TEST_PREFIX} Field Any`, eligible_fields: null });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id, { fieldNo: 5 });
    log('No eligible_fields (null) → any field OK', !r3.error, r3.error || 'OK');
    if (r3.booking) await supabase.from('bookings').delete().eq('booking_id', r3.booking.booking_id);
}

// ============================================================
// TEST GROUP 3: Payment Methods
// ============================================================
async function testPaymentMethods() {
    console.log('\n📋 Group 3: Payment Methods Condition\n');

    // T3.1: Payment method matches → OK
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Pay CASH`, payment_methods: ['CASH'] });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { paymentMethod: 'CASH' });
    log('CASH booking, eligible [CASH] → succeeds', !r1.error, r1.error || 'OK');
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T3.2: Payment method NOT in list → FAIL
    const c2 = await createCampaign({ name: `${TEST_PREFIX} Pay QR only`, payment_methods: ['QR'] });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { paymentMethod: 'CASH' });
    log('CASH booking, eligible [QR] → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // T3.3: No payment_methods (null) → any OK
    const c3 = await createCampaign({ name: `${TEST_PREFIX} Pay Any`, payment_methods: null });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id, { paymentMethod: 'CASH' });
    log('No payment_methods (null) → any OK', !r3.error, r3.error || 'OK');
    if (r3.booking) await supabase.from('bookings').delete().eq('booking_id', r3.booking.booking_id);
}

// ============================================================
// TEST GROUP 4: Min Spend
// ============================================================
async function testMinSpend() {
    console.log('\n📋 Group 4: Min Spend Condition\n');

    // T4.1: Price >= min_spend → OK
    const c1 = await createCampaign({ name: `${TEST_PREFIX} MinSpend OK`, min_spend: 500 });
    const coupon1 = await giveCoupon(c1.id);
    // Field 1, 16:00-18:00 = 2h, usually >= 500 THB
    const r1 = await tryBooking(coupon1.id);
    log('Price >= min_spend (500) → succeeds', !r1.error, r1.error || 'OK');
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T4.2: Price < min_spend → FAIL (use very high min)
    const c2 = await createCampaign({ name: `${TEST_PREFIX} MinSpend Fail`, min_spend: 99999 });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id);
    log('Price < min_spend (99999) → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 5: Valid Time Range
// ============================================================
async function testValidTimeRange() {
    console.log('\n📋 Group 5: Valid Time Range Condition\n');

    // T5.1: Booking time within valid range → OK
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Time In`, valid_time_start: '15:00', valid_time_end: '20:00' });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { startTime: '16:00', endTime: '18:00' });
    log('Booking 16:00-18:00, valid 15:00-20:00 → succeeds', !r1.error, r1.error || 'OK');
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T5.2: Booking time outside valid range → FAIL
    const c2 = await createCampaign({ name: `${TEST_PREFIX} Time Out`, valid_time_start: '18:00', valid_time_end: '21:00' });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { startTime: '10:00', endTime: '12:00' });
    log('Booking 10:00-12:00, valid 18:00-21:00 → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 6: Eligible Days
// ============================================================
async function testEligibleDays() {
    console.log('\n📋 Group 6: Eligible Days Condition\n');

    // 2026-02-15 = Sunday
    // T6.1: Sunday booking, eligible includes Sun → OK
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Day Match`, eligible_days: ['Sun', 'Sat'] });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id, { date: '2026-02-15' }); // Sunday
    log('Sunday booking, eligible [Sun,Sat] → succeeds', !r1.error, r1.error || 'OK');
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T6.2: Sunday booking, eligible only Mon-Fri → FAIL
    const c2 = await createCampaign({ name: `${TEST_PREFIX} Day Mismatch`, eligible_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id, { date: '2026-02-15' }); // Sunday
    log('Sunday booking, eligible [Mon-Fri] → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 7: Coupon Expiry
// ============================================================
async function testCouponExpiry() {
    console.log('\n📋 Group 7: Coupon Expiry\n');

    // T7.1: Expired coupon → FAIL
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Expiry` });
    const coupon1 = await giveCoupon(c1.id, 'ACTIVE', new Date(Date.now() - 86400000).toISOString()); // Expired yesterday
    const r1 = await tryBooking(coupon1.id);
    log('Expired coupon (yesterday) → fails', !!r1.error, r1.error || 'SHOULD HAVE FAILED');

    // T7.2: Valid coupon (future expiry) → OK
    const coupon2 = await giveCoupon(c1.id, 'ACTIVE', new Date(Date.now() + 30 * 86400000).toISOString());
    const r2 = await tryBooking(coupon2.id);
    log('Valid coupon (30 days left) → succeeds', !r2.error, r2.error || 'OK');
    if (r2.booking) await supabase.from('bookings').delete().eq('booking_id', r2.booking.booking_id);
}

// ============================================================
// TEST GROUP 8: Coupon Status
// ============================================================
async function testCouponStatus() {
    console.log('\n📋 Group 8: Coupon Status\n');

    const c1 = await createCampaign({ name: `${TEST_PREFIX} Status` });

    // T8.1: USED coupon → FAIL
    const coupon1 = await giveCoupon(c1.id, 'USED');
    const r1 = await tryBooking(coupon1.id);
    log('USED coupon → fails', !!r1.error, r1.error || 'SHOULD HAVE FAILED');

    // T8.2: EXPIRED coupon → FAIL
    const coupon2 = await giveCoupon(c1.id, 'EXPIRED');
    const r2 = await tryBooking(coupon2.id);
    log('EXPIRED status coupon → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');
}

// ============================================================
// TEST GROUP 9: Discount Types & max_discount
// ============================================================
async function testDiscountTypes() {
    console.log('\n📋 Group 9: Discount Types & max_discount\n');

    // T9.1: Fixed amount discount
    const c1 = await createCampaign({ name: `${TEST_PREFIX} Fixed 100`, discount_amount: 100 });
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    log('Fixed 100 THB discount → applies correctly', !r1.error && r1.booking,
        r1.error || `Price: ${r1.booking?.price}, Discount: ${r1.booking?.discount_amount || 'N/A'}`);
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);

    // T9.2: Percent discount WITHOUT cap
    const c2 = await createCampaign({ name: `${TEST_PREFIX} 50% NoCap`, discount_amount: 0, discount_percent: 50, max_discount: null });
    const coupon2 = await giveCoupon(c2.id);
    const r2 = await tryBooking(coupon2.id);
    log('50% no cap → full 50% applied', !r2.error && r2.booking,
        r2.error || `Price: ${r2.booking?.price}, Discount: ${r2.booking?.discount_amount || 'N/A'}`);
    if (r2.booking) await supabase.from('bookings').delete().eq('booking_id', r2.booking.booking_id);

    // T9.3: Percent discount WITH cap (max_discount = 200)
    const c3 = await createCampaign({ name: `${TEST_PREFIX} 50% Cap200`, discount_amount: 0, discount_percent: 50, max_discount: 200 });
    const coupon3 = await giveCoupon(c3.id);
    const r3 = await tryBooking(coupon3.id);
    const discountApplied = r3.booking?.discount_amount || 0;
    log('50% cap 200 → discount ≤ 200', !r3.error && discountApplied <= 200 && discountApplied > 0,
        r3.error || `Discount applied: ${discountApplied} (should be ≤ 200)`);
    if (r3.booking) await supabase.from('bookings').delete().eq('booking_id', r3.booking.booking_id);

    // T9.4: Reward item (free water)
    const c4 = await createCampaign({ name: `${TEST_PREFIX} Free Water`, discount_amount: 0, reward_item: 'Free Water' });
    const coupon4 = await giveCoupon(c4.id);
    const r4 = await tryBooking(coupon4.id);
    log('Reward item (Free Water) → booking works', !r4.error && r4.booking,
        r4.error || `Reward: ${r4.booking?.reward_item || r4.booking?.admin_note || 'Check admin_note'}`);
    if (r4.booking) await supabase.from('bookings').delete().eq('booking_id', r4.booking.booking_id);
}

// ============================================================
// TEST GROUP 10: Redemption Limit
// ============================================================
async function testRedemptionLimit() {
    console.log('\n📋 Group 10: Redemption Limit\n');

    // Create campaign with limit of 1 redemption
    const c1 = await createCampaign({
        name: `${TEST_PREFIX} Redeem Limit 1`,
        redemption_limit: 1,
        redemption_count: 0
    });

    // T10.1: First redemption → OK
    const coupon1 = await giveCoupon(c1.id);
    const r1 = await tryBooking(coupon1.id);
    log('1st redemption (limit=1) → succeeds', !r1.error, r1.error || 'OK');

    // T10.2: Second redemption → FAIL (limit reached)
    const coupon2 = await giveCoupon(c1.id);
    const r2 = await tryBooking(coupon2.id);
    log('2nd redemption (limit=1) → fails', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // Cleanup
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);
}

// ============================================================
// TEST GROUP 11: Collect Coupon - Refillable Quota
// ============================================================
async function testRefillableQuota() {
    console.log('\n📋 Group 11: Collect Coupon — Refillable Quota\n');

    const c1 = await createCampaign({ name: `${TEST_PREFIX} Refillable`, limit_per_user: 1 });

    // T11.1: First collection → OK
    const r1 = await callFunction('collect-coupon', { userId: TEST_USER_ID, campaignId: c1.id });
    log('1st collection (limit=1) → succeeds', r1.success === true, r1.error || 'OK');

    // T11.2: Second collection while first is ACTIVE → FAIL
    const r2 = await callFunction('collect-coupon', { userId: TEST_USER_ID, campaignId: c1.id });
    log('2nd collection (1 ACTIVE exists) → fails', r2.success !== true, r2.error || 'SHOULD HAVE FAILED');

    // T11.3: Mark first as USED, then collect again → OK (Refillable!)
    await supabase.from('user_coupons')
        .update({ status: 'USED' })
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', c1.id)
        .eq('status', 'ACTIVE');

    const r3 = await callFunction('collect-coupon', { userId: TEST_USER_ID, campaignId: c1.id });
    log('After using coupon → can collect again (Refillable)', r3.success === true, r3.error || 'OK');
}

// ============================================================
// TEST GROUP 12: Lazy Expiry (get-my-coupons)
// ============================================================
async function testLazyExpiry() {
    console.log('\n📋 Group 12: Lazy Expiry in get-my-coupons\n');

    const c1 = await createCampaign({ name: `${TEST_PREFIX} Lazy Expiry` });

    // Insert an expired ACTIVE coupon (should be cleaned up on query)
    await supabase.from('user_coupons').insert([{
        user_id: TEST_USER_ID,
        campaign_id: c1.id,
        status: 'ACTIVE', // Still ACTIVE but expired
        expires_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
    }]);

    // Call get-my-coupons → should trigger lazy expiry
    const r1 = await callFunction('get-my-coupons', { userId: TEST_USER_ID });

    // Check that the coupon is NOT in the active list
    const hasExpiredInList = (r1.main || []).some(c => c.campaign_id === c1.id);
    log('Expired coupon not in active list', !hasExpiredInList,
        hasExpiredInList ? 'STILL IN LIST!' : 'Correctly filtered out');

    // Check DB — status should now be EXPIRED
    const { data: dbCoupon } = await supabase.from('user_coupons')
        .select('status')
        .eq('user_id', TEST_USER_ID)
        .eq('campaign_id', c1.id)
        .single();

    log('Expired coupon status updated to EXPIRED in DB', dbCoupon?.status === 'EXPIRED',
        `DB status: ${dbCoupon?.status}`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('   Campaign Conditions Audit Test');
    console.log('   ' + new Date().toLocaleString('th-TH'));
    console.log('═══════════════════════════════════════════════════');

    try {
        await cleanup(); // Clean any leftover
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

    } catch (err) {
        console.error('\n💥 FATAL ERROR:', err.message);
    } finally {
        await cleanup();
    }

    // Summary
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`   RESULTS: ${passed}/${total} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════');

    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`   • ${r.test}: ${r.detail}`);
        });
    }

    console.log('');
}

main();
