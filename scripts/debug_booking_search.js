
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs'

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const start = '2026-02-12'
    const end = '2026-12-31'
    const searchTerm = 'ปริยัติ'

    console.log(`Checking bookings from ${start} to ${end}`)

    // 1. Count total bookings in range
    const { count, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('date', start)
        .lte('date', end)

    if (countError) {
        console.error('Count Error:', countError)
        return
    }
    console.log(`Total bookings in range: ${count}`)

    // 2. Simulate the current app logic (fetch all without explicit limit, but implicit limit applies)
    const { data: currentLogicData, error: currentError } = await supabase
        .from('bookings')
        .select('booking_id, date, display_name')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

    if (currentError) {
        console.error('Fetch Error:', currentError)
        return
    }

    console.log(`Fetched with current logic: ${currentLogicData.length} rows`)

    const foundInCurrent = currentLogicData.filter(b => b.display_name && b.display_name.includes(searchTerm))
    console.log(`Found "${searchTerm}" in current logic results: ${foundInCurrent.length}`)
    if (foundInCurrent.length > 0) {
        console.log('Sample dates:', foundInCurrent.map(b => b.date).slice(0, 5))
    }

    // 3. Search specifically for the term (Server-side filter)
    const { data: searchData, error: searchError } = await supabase
        .from('bookings')
        .select('booking_id, date, display_name')
        .gte('date', start)
        .lte('date', end)
        .ilike('display_name', `%${searchTerm}%`)
        .order('date', { ascending: false })

    if (searchError) {
        console.error('Search Error:', searchError)
        return
    }

    console.log(`\nServer-side search results: ${searchData.length} rows`)
    const febResults = searchData.filter(b => b.date.startsWith('2026-02'))
    console.log(`Found in Feb 2026: ${febResults.length}`)
    if (febResults.length > 0) {
        console.log('Feb dates:', febResults.map(b => b.date))
    }
}

run()
