import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY // CHANGED: Use Service Role Key

async function testDirectHTTP() {
    console.log('\n🔍 Testing update-booking with Direct HTTP Request\n')

    const url = `${SUPABASE_URL}/functions/v1/update-booking`

    const payload = {
        matchId: 'test-direct-123',
        timeStart: '2026-01-31 22:00:00',
        timeEnd: '2026-01-31 23:00:00',
        price: 1200
    }

    console.log('URL:', url)
    console.log('Payload:', JSON.stringify(payload, null, 2))
    console.log('\n--- Sending Request ---\n')

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY
            },
            body: JSON.stringify(payload)
        })

        console.log('Status:', response.status, response.statusText)
        console.log('Headers:', Object.fromEntries(response.headers.entries()))

        const text = await response.text()
        console.log('\n--- Raw Response Body ---')
        console.log(text)

        try {
            const json = JSON.parse(text)
            console.log('\n--- Parsed JSON ---')
            console.log(JSON.stringify(json, null, 2))
        } catch (e) {
            console.log('\n⚠️  Response is not valid JSON')
        }

    } catch (error) {
        console.error('\n❌ Request Failed:', error.message)
        console.error('Stack:', error.stack)
    }
}

testDirectHTTP()
