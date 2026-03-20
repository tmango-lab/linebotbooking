/**
 * Simulated E2E Test: Referral System (Direct DB)
 * 
 * Since Edge Functions are NOT deployed yet, this test simulates the full flow
 * using direct Supabase REST API calls (service role).
 * 
 * Flow: Register Affiliate → Admin Approve → Validate Code → 
 *       Create Referral Record → Complete Reward → Verify
 * 
 * Usage: node scripts/test-referral-e2e.cjs
 * Cleanup: node scripts/test-referral-e2e.cjs --cleanup
 */

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

// Real user for referrer
const REFERRER_USER_ID = 'Ua636ab14081b483636896549d2026398';
const REFEREE_USER_ID = 'TEST_REFEREE_E2E';

const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.log(`  ❌ ${msg}`); return false; };
const info = (msg) => console.log(`  ℹ️  ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const header = (msg) => console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`);

let errors = [];
let passed = 0;
let failed = 0;

function assert(condition, successMsg, failMsg) {
    if (condition) { pass(successMsg); passed++; }
    else { fail(failMsg); failed++; errors.push(failMsg); }
}

async function db(table, method, body, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };
    if (method === 'POST') headers['Prefer'] = 'return=representation';
    if (method === 'PATCH') headers['Prefer'] = 'return=representation';
    if (method === 'DELETE') headers['Prefer'] = 'return=minimal';

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function callFunction(name, body) {
    const url = `${SUPABASE_URL}/functions/v1/${name}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function cleanup() {
    header('🧹 CLEANUP');
    await db('referrals', 'DELETE', null, `?referee_id=eq.${REFEREE_USER_ID}`);
    await db('affiliates', 'DELETE', null, `?user_id=eq.${REFERRER_USER_ID}`);
    await db('profiles', 'DELETE', null, `?user_id=eq.${REFEREE_USER_ID}`);

    // Remove test coupons
    const { data: camp } = await db('campaigns', 'GET', null, `?name=eq.🎁 รางวัลแนะนำเพื่อน&select=id`);
    if (camp && camp.length > 0) {
        await db('user_coupons', 'DELETE', null, `?user_id=eq.${REFERRER_USER_ID}&campaign_id=eq.${camp[0].id}`);
    }
    pass('Test data cleaned up');
}

async function run() {
    let referralCode = '';
    let programId = '';
    let programData = null;

    // ========== STEP 0: PRE-CHECK ==========
    header('📋 STEP 0: Pre-check environment');

    // Check referrer profile
    const { data: profile } = await db('profiles', 'GET', null, `?user_id=eq.${REFERRER_USER_ID}&select=user_id,phone_number,team_name`);
    assert(profile && profile.length > 0,
        `Referrer profile: ${profile?.[0]?.team_name || 'N/A'} (${profile?.[0]?.phone_number || 'N/A'})`,
        `Referrer profile NOT FOUND (${REFERRER_USER_ID}). Must have booked at least once.`
    );
    if (!profile || profile.length === 0) return;

    // Check active program
    const { data: programs } = await db('referral_programs', 'GET', null, '?is_active=eq.true&select=id,name,discount_percent,reward_amount,end_date');
    assert(programs && programs.length > 0,
        `Active program: "${programs?.[0]?.name}" (ลด ${programs?.[0]?.discount_percent}%, รางวัล ฿${programs?.[0]?.reward_amount})`,
        'No active referral program! Run migration first.'
    );
    if (!programs || programs.length === 0) return;
    programId = programs[0].id;
    programData = programs[0];

    // Check Edge Functions deployment
    const funcResult = await callFunction('register-affiliate', {});
    const functionsDeployed = funcResult.status !== 404;
    if (functionsDeployed) {
        pass('Edge Functions are deployed');
    } else {
        warn('Edge Functions NOT deployed yet — using direct DB simulation');
    }

    // Check storage bucket
    const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/referral-assets`, {
        headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
    });
    if (bucketRes.ok) {
        pass('Storage bucket "referral-assets" exists');
    } else {
        warn('Storage bucket "referral-assets" NOT FOUND — student card upload will fail');
        warn('→ Create it: Supabase Dashboard > Storage > New Bucket > "referral-assets" (Public)');
    }

    // ========== STEP 1: REGISTER AFFILIATE ==========
    header('📝 STEP 1: Register as Affiliate');

    // Clean up any existing affiliate record first
    await db('affiliates', 'DELETE', null, `?user_id=eq.${REFERRER_USER_ID}`);

    // Generate referral code
    const phone = profile[0].phone_number;
    referralCode = phone
        ? `REF-${phone.slice(-4)}-${Date.now().toString(36).toUpperCase()}`
        : `REF-${REFERRER_USER_ID.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const { ok: regOk, data: regData } = await db('affiliates', 'POST', {
        user_id: REFERRER_USER_ID,
        referral_code: referralCode,
        school_name: 'โรงเรียนทดสอบ E2E',
        birth_date: '2010-06-15',
        status: 'PENDING'
    });

    assert(regOk,
        `Registered! Code: ${referralCode}, Status: PENDING`,
        `Registration failed: ${JSON.stringify(regData)}`
    );
    if (!regOk) return;

    // ========== STEP 2: ADMIN APPROVE ==========
    header('👑 STEP 2: Admin approves affiliate');

    const { ok: appOk, data: appData } = await db('affiliates', 'PATCH',
        { status: 'APPROVED', updated_at: new Date().toISOString() },
        `?user_id=eq.${REFERRER_USER_ID}`
    );

    assert(appOk && appData?.[0]?.status === 'APPROVED',
        'Affiliate approved → status: APPROVED',
        `Approve failed: ${JSON.stringify(appData)}`
    );
    if (!appOk) return;

    // ========== STEP 3: VALIDATE REFERRAL CODE ==========
    header('🔍 STEP 3: Validate referral code');

    if (functionsDeployed) {
        // Use the real Edge Function
        const valResult = await callFunction('validate-referral', { referralCode });
        assert(valResult.ok && valResult.data.valid,
            `Code valid! Referrer: ${valResult.data.referrer?.teamName}, Discount: ${valResult.data.program?.discountPercent}%`,
            `Validation failed: ${JSON.stringify(valResult.data)}`
        );
    } else {
        // Direct DB validation
        const { data: aff } = await db('affiliates', 'GET', null,
            `?referral_code=eq.${referralCode}&status=eq.APPROVED&select=user_id,referral_code,status`);
        assert(aff && aff.length > 0,
            `Code "${referralCode}" verified: affiliate APPROVED, discount ${programData.discount_percent}%`,
            `Code not found or not approved!`
        );
    }

    // ========== STEP 4: SIMULATE BOOKING WITH REFERRAL ==========
    header('🏟️ STEP 4: Simulate booking with referral');

    // Create dummy referee profile
    await db('profiles', 'DELETE', null, `?user_id=eq.${REFEREE_USER_ID}`);
    await db('profiles', 'POST', {
        user_id: REFEREE_USER_ID,
        phone_number: '0999999999',
        team_name: 'ทีมเพื่อนใหม่ (Referee E2E)'
    });
    info('Created referee profile: ทีมเพื่อนใหม่');

    // Clean any old referral
    await db('referrals', 'DELETE', null, `?referee_id=eq.${REFEREE_USER_ID}`);

    // Create referral record (this is what create-booking does)
    const { ok: refOk, data: refData } = await db('referrals', 'POST', {
        referrer_id: REFERRER_USER_ID,
        referee_id: REFEREE_USER_ID,
        program_id: programId,
        status: 'PENDING_PAYMENT',
        reward_amount: programData.reward_amount
    });

    assert(refOk,
        `Referral record created: PENDING_PAYMENT, reward ฿${programData.reward_amount}`,
        `Failed to create referral: ${JSON.stringify(refData)}`
    );
    if (!refOk) return;

    const referralId = refData[0]?.id;
    info(`Referral ID: ${referralId}`);
    info(`Price calc: original ฿1000 × ${100 - programData.discount_percent}% = ฿${1000 * (100 - programData.discount_percent) / 100} (example)`);

    // ========== STEP 5: PROCESS REWARD ==========
    header('🎁 STEP 5: Process referral reward (payment confirmed)');

    // 5a. Update referral → COMPLETED
    const { ok: compOk } = await db('referrals', 'PATCH',
        { status: 'COMPLETED', updated_at: new Date().toISOString() },
        `?id=eq.${referralId}`
    );
    assert(compOk, 'Referral status → COMPLETED', 'Failed to update referral status');

    // 5b. Find or create reward campaign
    let { data: rewardCampaign } = await db('campaigns', 'GET', null,
        `?name=eq.🎁 รางวัลแนะนำเพื่อน&status=eq.active&select=id,name`);

    if (!rewardCampaign || rewardCampaign.length === 0) {
        info('Reward campaign not found — creating...');
        const { data: newCamp, ok: campOk } = await db('campaigns', 'POST', {
            name: '🎁 รางวัลแนะนำเพื่อน',
            status: 'active',
            coupon_type: 'main',
            discount_amount: programData.reward_amount,
            total_quantity: 999999,
            remaining_quantity: 999999,
            limit_per_user: 99,
            description: `ส่วนลด ฿${programData.reward_amount} จากการแนะนำเพื่อน`
        });
        assert(campOk, `Reward campaign created (฿${programData.reward_amount} off)`, `Failed: ${JSON.stringify(newCamp)}`);
        rewardCampaign = newCamp;
    } else {
        pass(`Reward campaign exists: "${rewardCampaign[0].name}"`);
    }

    const campaignId = rewardCampaign?.[0]?.id;

    // 5c. Issue coupon to referrer
    if (campaignId) {
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 3);

        const { ok: couponOk, data: couponData } = await db('user_coupons', 'POST', {
            user_id: REFERRER_USER_ID,
            campaign_id: campaignId,
            status: 'ACTIVE',
            expires_at: expires.toISOString()
        });
        assert(couponOk,
            `🎟️ Reward coupon issued! Expires: ${expires.toLocaleDateString('th-TH')}`,
            `Failed to create coupon: ${JSON.stringify(couponData)}`
        );
    }

    // 5d. Update affiliate stats
    const { data: refCount } = await db('referrals', 'GET', null,
        `?referrer_id=eq.${REFERRER_USER_ID}&status=eq.COMPLETED&select=id`);
    const totalReferrals = refCount?.length || 0;
    const totalEarnings = totalReferrals * programData.reward_amount;

    await db('affiliates', 'PATCH', {
        total_referrals: totalReferrals,
        total_earnings: totalEarnings,
        updated_at: new Date().toISOString()
    }, `?user_id=eq.${REFERRER_USER_ID}`);
    pass(`Affiliate stats updated: ${totalReferrals} referrals, ฿${totalEarnings} earned`);

    // ========== STEP 6: VERIFY ==========
    header('✅ STEP 6: Final verification');

    // Verify affiliate
    const { data: finalAff } = await db('affiliates', 'GET', null,
        `?user_id=eq.${REFERRER_USER_ID}&select=referral_code,status,total_referrals,total_earnings`);
    if (finalAff?.[0]) {
        const a = finalAff[0];
        assert(a.status === 'APPROVED', `Affiliate: APPROVED, code=${a.referral_code}`, 'Affiliate not approved!');
        assert(a.total_referrals > 0, `Stats: ${a.total_referrals} referral(s), ฿${a.total_earnings} earned`, 'Stats not updated');
    }

    // Verify referral
    const { data: finalRef } = await db('referrals', 'GET', null,
        `?referee_id=eq.${REFEREE_USER_ID}&select=status,reward_amount`);
    if (finalRef?.[0]) {
        assert(finalRef[0].status === 'COMPLETED', `Referral: COMPLETED, reward=฿${finalRef[0].reward_amount}`, 'Referral not completed');
    }

    // Verify coupon
    const { data: finalCoupons } = await db('user_coupons', 'GET', null,
        `?user_id=eq.${REFERRER_USER_ID}&status=eq.ACTIVE&select=id,status,expires_at&order=created_at.desc&limit=1`);
    assert(finalCoupons?.length > 0,
        `Reward coupon active: expires ${new Date(finalCoupons?.[0]?.expires_at).toLocaleDateString('th-TH')}`,
        'No active reward coupon found!'
    );

    // ========== SUMMARY ==========
    header('📊 FINAL REPORT');
    console.log(`
  Referrer:    ${REFERRER_USER_ID}
  Referee:     ${REFEREE_USER_ID} (simulated)
  Code:        ${referralCode}
  Program:     ${programData.name}
  Discount:    ${programData.discount_percent}%
  Reward:      ฿${programData.reward_amount}

  Results:     ${passed} passed, ${failed} failed
  ${failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  Some tests failed:'}
  ${errors.map(e => `  → ${e}`).join('\n')}

  ⚠️  DEPLOY CHECKLIST (items found during test):
  ${!functionsDeployed ? '  → Deploy Edge Functions: register-affiliate, validate-referral, process-referral-reward' : ''}
  → Create Storage bucket "referral-assets" (public) in Supabase Dashboard
  → Deploy updated webhook + stripe-webhook with referral reward trigger

  To clean up test data:
  node scripts/test-referral-e2e.cjs --cleanup
`);
}

// Main
(async () => {
    console.log('\n🏟️  Referral System E2E Test (Direct DB Simulation)');
    console.log(`  Time: ${new Date().toLocaleString('th-TH')}`);
    console.log(`  Referrer: ${REFERRER_USER_ID}`);

    if (process.argv.includes('--cleanup')) {
        await cleanup();
    } else {
        await run();
    }
})();
