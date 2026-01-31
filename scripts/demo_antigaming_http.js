import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const BOOKING_ID = "demo-" + Date.now()

async function callUpdateBooking(payload) {
    const url = `${SUPABASE_URL}/functions/v1/update-booking`

    console.log('\n📤 Request:', JSON.stringify(payload, null, 2))

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify(payload)
    })

    console.log(`📥 Response: ${response.status} ${response.statusText}`)

    const text = await response.text()
    const json = JSON.parse(text)

    if (json.error) {
        console.log('❌ Error:', json.error)
    } else {
        console.log('✅ Success:', json.success)
        console.log('📊 Booking Price:', json.booking?.price_total_thb, 'THB')
    }

    return json
}

async function demo() {
    console.log('\n🎯 Demo: Anti-Gaming Logic with Direct HTTP\n')
    console.log('='.repeat(60))

    // Scenario 1: Create Booking
    console.log('\n📌 Scenario 1: Create Initial Booking (2 Hours)')
    console.log('-'.repeat(60))
    await callUpdateBooking({
        matchId: BOOKING_ID,
        courtId: 2428, // Field 3 (1200 THB/hour after 18:00)
        timeStart: '2026-01-31 22:00:00',
        timeEnd: '2026-02-01 00:00:00', // 2 hours
        price: 2400
    })

    // Scenario 2: Extend Booking (Fair)
    console.log('\n📌 Scenario 2: Extend to 3 Hours (Fair)')
    console.log('-'.repeat(60))
    await callUpdateBooking({
        matchId: BOOKING_ID,
        courtId: 2428,
        timeStart: '2026-01-31 22:00:00',
        timeEnd: '2026-02-01 01:00:00', // 3 hours
        price: 3600
    })

    // Scenario 3: Revert to Original (Fair Revert)
    console.log('\n📌 Scenario 3: Revert to 2 Hours (Fair Revert)')
    console.log('-'.repeat(60))
    await callUpdateBooking({
        matchId: BOOKING_ID,
        courtId: 2428,
        timeStart: '2026-01-31 22:00:00',
        timeEnd: '2026-02-01 00:00:00', // Back to 2 hours
        price: 2400
    })

    // Scenario 4: Shrink Below Original (Cheat)
    console.log('\n📌 Scenario 4: Shrink to 1 Hour (CHEAT - Should Trigger Anti-Gaming)')
    console.log('-'.repeat(60))
    const result = await callUpdateBooking({
        matchId: BOOKING_ID,
        courtId: 2428,
        timeStart: '2026-01-31 22:00:00',
        timeEnd: '2026-01-31 23:00:00', // 1 hour (CHEAT!)
        price: 1200
    })

    console.log('\n' + '='.repeat(60))
    console.log('\n🎓 Expected Behavior:')
    console.log('  - Scenarios 1-3: Should succeed normally')
    console.log('  - Scenario 4: Should charge FULL PRICE (1200 THB)')
    console.log('  - Scenario 4: Should burn any associated coupons')
    console.log('\n✅ Final Price:', result.booking?.price_total_thb, 'THB')
    console.log('   (Expected: 1200 THB - Full Price)')
}

demo().catch(console.error)
