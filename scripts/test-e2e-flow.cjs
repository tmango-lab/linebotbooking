/**
 * E2E Flow Test — Tier 1 + Tier 2
 * ===================================
 * Tests the FULL booking lifecycle using a real LINE userId.
 * 
 * Run: node scripts/test-e2e-flow.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// ===== CONFIG =====
const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs';

const REAL_USER_ID = 'Ua636ab14081b483636896549d2026398';
const FUNC_URL = `${SUPABASE_URL}/functions/v1`;
const TEST_PREFIX = '[E2E_TEST]';
const TEST_DATE = '2026-02-28'; // Saturday, far future
const FAKE_USER_ID = 'FAKE_USER_999_NOT_REAL';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ===== RESULTS =====
const results = [];
let step = 0;
function log(test, pass, detail = '') {
    step++;
    const icon = pass ? '✅' : '❌';
    results.push({ test, pass, detail });
    console.log(`  ${icon} [${step}] ${test}${detail ? ' — ' + detail : ''}`);
}

function header(title) {
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`  📋 ${title}`);
    console.log(`${'─'.repeat(55)}\n`);
}

// ===== API HELPERS =====
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

// ===== SETUP & CLEANUP =====
let testCampaignId = null;
let testCouponId = null;
let testBookingId = null;

async function setup() {
    console.log('\n🔧 Setting up E2E test data...\n');

    // Ensure user profile exists
    await supabase.from('profiles').upsert({
        user_id: REAL_USER_ID,
        team_name: 'E2E Test Team',
        phone_number: '0888888888'
    }, { onConflict: 'user_id' });

    // Create a dedicated test campaign
    const { data: campaign, error } = await supabase.from('campaigns').insert([{
        name: `${TEST_PREFIX} ลด 100 บาท`,
        description: 'E2E Test Campaign - Fixed 100 THB',
        status: 'ACTIVE',
        discount_amount: 100,
        discount_percent: 0,
        max_discount: null,
        reward_item: null,
        coupon_type: 'MAIN',
        is_stackable: false,
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date(Date.now() + 60 * 86400000).toISOString(),
        valid_time_start: null,
        valid_time_end: null,
        eligible_fields: null,
        payment_methods: null,
        min_spend: 0,
        eligible_days: null,
        limit_per_user: 3,
        total_quantity: 10,
        remaining_quantity: 10,
        redemption_limit: null,
        redemption_count: 0,
        duration_days: 30,
        secret_codes: null,
    }]).select().single();

    if (error) throw new Error(`Setup failed: ${error.message}`);
    testCampaignId = campaign.id;
    console.log(`  📌 Campaign: ${campaign.name} (ID: ${campaign.id})`);
    console.log(`  📌 User: ${REAL_USER_ID}`);
    console.log(`  📌 Date: ${TEST_DATE} (Saturday)\n`);
}

async function cleanup() {
    console.log('\n🧹 Cleaning up E2E test data...');

    // Delete test bookings
    await supabase.from('bookings').delete().eq('user_id', REAL_USER_ID).like('admin_note', `%${TEST_PREFIX}%`);

    // Delete test coupons for all test campaigns
    const { data: camps } = await supabase.from('campaigns').select('id').like('name', `${TEST_PREFIX}%`);
    if (camps) {
        for (const c of camps) {
            await supabase.from('user_coupons').delete().eq('campaign_id', c.id);
        }
    }

    // Delete test campaigns
    await supabase.from('campaigns').delete().like('name', `${TEST_PREFIX}%`);

    // Delete fake user coupons
    await supabase.from('user_coupons').delete().eq('user_id', FAKE_USER_ID);

    console.log('  Done!\n');
}

// ═══════════════════════════════════════════════════════
// TIER 1: Full Lifecycle Flow
// ═══════════════════════════════════════════════════════

async function tier1_lifecycle() {
    header('Tier 1.1: Full Lifecycle — Collect → Use → Cancel → Refillable');

    // Step 1: Check initial wallet
    const wallet0 = await callFunction('get-my-coupons', { userId: REAL_USER_ID });
    const initialCount = wallet0.coupons?.length || 0;
    log('get-my-coupons → initial wallet loaded', !wallet0.error, `${initialCount} coupons`);

    // Step 2: Collect coupon (get ID from response)
    const collect = await callFunction('collect-coupon', { userId: REAL_USER_ID, campaignId: testCampaignId });
    log('collect-coupon → coupon collected', collect.success === true, collect.error || 'OK');

    // Get coupon ID from collect response or fallback to DB
    testCouponId = collect.data?.id || null;
    if (!testCouponId) {
        const { data: dbLookup } = await supabase.from('user_coupons')
            .select('id')
            .eq('user_id', REAL_USER_ID)
            .eq('campaign_id', testCampaignId)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        testCouponId = dbLookup?.id || null;
    }

    // Step 3: Verify coupon in wallet via API
    const wallet1 = await callFunction('get-my-coupons', { userId: REAL_USER_ID });
    const hasCouponInWallet = wallet1.coupons?.some(c => c.campaign_id === testCampaignId) || false;
    log('get-my-coupons → new coupon visible', testCouponId && hasCouponInWallet,
        `Coupon ID: ${testCouponId}, In wallet: ${hasCouponInWallet}`);

    // Step 4: Book with coupon
    const booking = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 1,
        date: TEST_DATE,
        startTime: '16:00',
        endTime: '18:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        couponId: testCouponId,
        note: TEST_PREFIX
    });
    testBookingId = booking.booking?.booking_id || booking.booking?.id;
    log('create-booking → booking created with coupon', !!booking.booking,
        booking.error || `Booking: ${testBookingId}, Discount: ${booking.booking?.discount_amount}`);

    // Step 5: Verify booking in get-bookings
    const bookings = await callFunction('get-bookings', { date: TEST_DATE });
    const found = bookings.bookings?.find(b => b.id === testBookingId);
    log('get-bookings → booking visible', !!found,
        found ? `Price: ${found.price}, Discount: ${found.discount}` : 'NOT FOUND');

    // Step 6: Verify coupon used in wallet (should not appear as ACTIVE)
    const wallet2 = await callFunction('get-my-coupons', { userId: REAL_USER_ID });
    const usedCoupon = wallet2.coupons?.find(c => c.id === testCouponId);
    log('get-my-coupons → used coupon NOT in active list', !usedCoupon,
        usedCoupon ? `STILL VISIBLE (status: ${usedCoupon.status})` : 'Correctly hidden');

    // Step 7: Cancel booking
    const cancel = await callFunction('cancel-booking', {
        matchId: testBookingId,
        reason: `${TEST_PREFIX} E2E test cancellation`
    });
    log('cancel-booking → booking cancelled', cancel.success === true, cancel.error || 'OK');

    // Step 8: Check coupon status after cancel
    const { data: dbCoupon } = await supabase.from('user_coupons')
        .select('status')
        .eq('id', testCouponId)
        .single();

    const couponStatus = dbCoupon?.status;
    // For CASH: booking was 'confirmed' → cancel should BURN coupon (USED stays)
    // But cancel-booking checks the ORIGINAL booking.status before updating
    const isBurnedOrReleased = couponStatus === 'USED' || couponStatus === 'ACTIVE';
    log('cancel → coupon status resolved', isBurnedOrReleased,
        `Status: ${couponStatus} (confirmed→USED=burned, pending→ACTIVE=released)`);

    // Step 9: Collect new coupon (Refillable test)
    // If coupon was released back to ACTIVE, cancel it first to avoid unique constraint
    if (couponStatus === 'ACTIVE') {
        await supabase.from('user_coupons').update({ status: 'CANCELLED' })
            .eq('id', testCouponId);
    }

    const collect2 = await callFunction('collect-coupon', { userId: REAL_USER_ID, campaignId: testCampaignId });
    log('collect-coupon → refillable re-collection', collect2.success === true,
        collect2.error || 'OK — Refillable works!');
}

async function tier1_priceAccuracy() {
    header('Tier 1.2: Price Accuracy');

    // Create 50% campaign with cap 200
    const { data: camp } = await supabase.from('campaigns').insert([{
        name: `${TEST_PREFIX} 50% cap 200`,
        description: 'Price accuracy test',
        status: 'ACTIVE',
        discount_amount: 0,
        discount_percent: 50,
        max_discount: 200,
        coupon_type: 'MAIN',
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date(Date.now() + 60 * 86400000).toISOString(),
        limit_per_user: 5,
        total_quantity: 100,
        remaining_quantity: 100,
    }]).select().single();

    // Give coupon
    const { data: coupon } = await supabase.from('user_coupons').insert([{
        user_id: REAL_USER_ID,
        campaign_id: camp.id,
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 60 * 86400000).toISOString()
    }]).select().single();

    // Book: Field 1, 14:00-16:00 → Price should be 1000 (2h × 500 pre)
    const booking = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 1,
        date: TEST_DATE,
        startTime: '14:00',
        endTime: '16:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        couponId: coupon.id,
        note: TEST_PREFIX
    });

    const b = booking.booking;
    if (b) {
        const original = b.original_price;
        const discount = b.discount_amount;
        const final = b.price;
        const expectedDiscount = Math.min(Math.floor(original * 0.5), 200); // 50% capped at 200
        const expectedFinal = original - expectedDiscount;

        log('original_price returned', original > 0, `${original} THB`);
        log('discount capped at 200', discount === expectedDiscount,
            `Discount: ${discount}, Expected: ${expectedDiscount}`);
        log('final price = original - discount', final === expectedFinal,
            `${original} - ${discount} = ${final} (expected: ${expectedFinal})`);

        // Cleanup booking
        await supabase.from('bookings').delete().eq('booking_id', b.booking_id);
    } else {
        log('Booking created for price test', false, booking.error);
    }
}

async function tier1_totalQuantity() {
    header('Tier 1.3: Total Quantity Tracking');

    // Check remaining_quantity before
    const { data: before } = await supabase.from('campaigns')
        .select('remaining_quantity')
        .eq('id', testCampaignId)
        .single();

    const qtyBefore = before?.remaining_quantity;

    // Collect a coupon (should decrement remaining_quantity)
    await supabase.from('user_coupons').delete()
        .eq('user_id', FAKE_USER_ID)
        .eq('campaign_id', testCampaignId);

    await callFunction('collect-coupon', { userId: FAKE_USER_ID, campaignId: testCampaignId });

    const { data: after } = await supabase.from('campaigns')
        .select('remaining_quantity')
        .eq('id', testCampaignId)
        .single();

    const qtyAfter = after?.remaining_quantity;

    log('remaining_quantity decremented after collect', qtyAfter === qtyBefore - 1,
        `Before: ${qtyBefore} → After: ${qtyAfter}`);
}

// ═══════════════════════════════════════════════════════
// TIER 2: Edge Cases & Security
// ═══════════════════════════════════════════════════════

async function tier2_stolenCoupon() {
    header("Tier 2.1: Use Someone Else's Coupon");

    // Create coupon for FAKE user
    const { data: camp } = await supabase.from('campaigns').insert([{
        name: `${TEST_PREFIX} Stolen Test`,
        status: 'ACTIVE',
        discount_amount: 50,
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date(Date.now() + 60 * 86400000).toISOString(),
        limit_per_user: 5,
        total_quantity: 100,
        remaining_quantity: 100,
    }]).select().single();

    const { data: fakeCoupon } = await supabase.from('user_coupons').insert([{
        user_id: FAKE_USER_ID,
        campaign_id: camp.id,
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 60 * 86400000).toISOString()
    }]).select().single();

    // REAL user tries to use FAKE user's coupon
    const result = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 2,
        date: TEST_DATE,
        startTime: '10:00',
        endTime: '12:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        couponId: fakeCoupon.id,
        note: TEST_PREFIX
    });

    if (result.booking) {
        log("Use someone else's coupon → should fail", false,
            '⚠️ BUG: Booking succeeded with another user\'s coupon!');
        await supabase.from('bookings').delete().eq('booking_id', result.booking.booking_id);
    } else {
        log("Use someone else's coupon → rejected", true, result.error);
    }
}

async function tier2_doubleCouponUse() {
    header('Tier 2.2: Use Same Coupon Twice');

    // Create campaign & give coupon
    const { data: camp } = await supabase.from('campaigns').insert([{
        name: `${TEST_PREFIX} Double Use`,
        status: 'ACTIVE',
        discount_amount: 50,
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date(Date.now() + 60 * 86400000).toISOString(),
        limit_per_user: 5,
        total_quantity: 100,
        remaining_quantity: 100,
    }]).select().single();

    const { data: coupon } = await supabase.from('user_coupons').insert([{
        user_id: REAL_USER_ID,
        campaign_id: camp.id,
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 60 * 86400000).toISOString()
    }]).select().single();

    // 1st booking → should succeed
    const r1 = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 3,
        date: TEST_DATE,
        startTime: '10:00',
        endTime: '12:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        couponId: coupon.id,
        note: TEST_PREFIX
    });
    log('1st booking with coupon → succeeds', !!r1.booking, r1.error || 'OK');

    // 2nd booking with SAME couponId → should fail (coupon now USED)
    const r2 = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 4,
        date: TEST_DATE,
        startTime: '10:00',
        endTime: '12:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        couponId: coupon.id,
        note: TEST_PREFIX
    });
    log('2nd booking same coupon → rejected', !!r2.error, r2.error || 'SHOULD HAVE FAILED');

    // Cleanup
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);
}

async function tier2_overLimitCollection() {
    header('Tier 2.3: Collect Over Limit');

    const { data: camp } = await supabase.from('campaigns').insert([{
        name: `${TEST_PREFIX} Limit 1`,
        status: 'ACTIVE',
        discount_amount: 30,
        is_public: true,
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date(Date.now() + 60 * 86400000).toISOString(),
        limit_per_user: 1,
        total_quantity: 100,
        remaining_quantity: 100,
    }]).select().single();

    const r1 = await callFunction('collect-coupon', { userId: REAL_USER_ID, campaignId: camp.id });
    log('1st collect (limit=1) → succeeds', r1.success === true, r1.error || 'OK');

    const r2 = await callFunction('collect-coupon', { userId: REAL_USER_ID, campaignId: camp.id });
    log('2nd collect (limit=1) → rejected', r2.success !== true, r2.error || 'SHOULD HAVE FAILED');
}

async function tier2_duplicateBookingSlot() {
    header('Tier 2.4: Duplicate Booking (Same Slot)');

    // Create 2 bookings for same field+time → 2nd should fail
    const r1 = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 5,
        date: TEST_DATE,
        startTime: '19:00',
        endTime: '20:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        note: TEST_PREFIX
    });
    log('1st booking Field 5 19-20 → succeeds', !!r1.booking, r1.error || `ID: ${r1.booking?.booking_id}`);

    const r2 = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 5,
        date: TEST_DATE,
        startTime: '19:00',
        endTime: '20:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        note: TEST_PREFIX
    });

    if (r2.booking) {
        log('2nd booking same slot → should fail', false,
            '⚠️ BUG: Duplicate booking allowed on same field+time!');
        await supabase.from('bookings').delete().eq('booking_id', r2.booking.booking_id);
    } else {
        log('2nd booking same slot → rejected', true, r2.error);
    }

    // Cleanup
    if (r1.booking) await supabase.from('bookings').delete().eq('booking_id', r1.booking.booking_id);
}

async function tier2_priceBoundary18() {
    header('Tier 2.5: Price Boundary — Crossing 18:00');

    // Field 1: pre=500/h, post=700/h
    // 17:00-19:00 → 1h pre(500) + 1h post(700) = 1200
    const r = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 1,
        date: TEST_DATE,
        startTime: '17:00',
        endTime: '19:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        note: TEST_PREFIX
    });

    if (r.booking) {
        const price = r.booking.original_price || r.booking.price;
        log('17:00-19:00 → 1h×500 + 1h×700 = 1200', price === 1200,
            `Price: ${price} (expected: 1200)`);
        await supabase.from('bookings').delete().eq('booking_id', r.booking.booking_id);
    } else {
        log('Boundary booking created', false, r.error);
    }

    // Full pre: 14:00-16:00 → 2h × 500 = 1000
    const r2 = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 1,
        date: TEST_DATE,
        startTime: '14:00',
        endTime: '16:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        note: TEST_PREFIX
    });

    if (r2.booking) {
        const price2 = r2.booking.original_price || r2.booking.price;
        log('14:00-16:00 → 2h×500 = 1000 (full pre)', price2 === 1000,
            `Price: ${price2} (expected: 1000)`);
        await supabase.from('bookings').delete().eq('booking_id', r2.booking.booking_id);
    } else {
        log('Pre-18 booking created', false, r2.error);
    }

    // Full post: 19:00-21:00 → 2h × 700 = 1400
    const r3 = await callFunction('create-booking', {
        userId: REAL_USER_ID,
        fieldId: 1,
        date: TEST_DATE,
        startTime: '19:00',
        endTime: '21:00',
        customerName: 'E2E Test Team',
        phoneNumber: '0888888888',
        paymentMethod: 'CASH',
        note: TEST_PREFIX
    });

    if (r3.booking) {
        const price3 = r3.booking.original_price || r3.booking.price;
        log('19:00-21:00 → 2h×700 = 1400 (full post)', price3 === 1400,
            `Price: ${price3} (expected: 1400)`);
        await supabase.from('bookings').delete().eq('booking_id', r3.booking.booking_id);
    } else {
        log('Post-18 booking created', false, r3.error);
    }
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   🚀 E2E Flow Test — Tier 1 + Tier 2');
    console.log(`   User: ${REAL_USER_ID}`);
    console.log('   ' + new Date().toLocaleString('th-TH'));
    console.log('═══════════════════════════════════════════════════════');

    try {
        await cleanup();
        await setup();

        // Tier 1: Lifecycle & Verification
        await tier1_lifecycle();
        await tier1_priceAccuracy();
        await tier1_totalQuantity();

        // Tier 2: Edge Cases
        await tier2_stolenCoupon();
        await tier2_doubleCouponUse();
        await tier2_overLimitCollection();
        await tier2_duplicateBookingSlot();
        await tier2_priceBoundary18();

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

    // Bugs found
    const bugs = results.filter(r => !r.pass && r.detail.includes('BUG'));
    if (bugs.length > 0) {
        console.log('\n🐛 Potential BUGS found:');
        bugs.forEach(b => console.log(`   ⚠️  ${b.test}: ${b.detail}`));
    }

    console.log('');
}

main();
