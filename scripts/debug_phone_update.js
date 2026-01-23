
import fetch from 'node-fetch';

// CONFIG
const TOKEN = process.env.MATCHDAY_TOKEN;
const BASE_URL = 'https://arena.matchday-backend.com';
const TEST_DATE = '2026-01-23'; // Use today or a known date

if (!TOKEN) {
    console.error('Please set MATCHDAY_TOKEN env var');
    process.exit(1);
}

async function getMatches() {
    console.log('Fetching matches...');
    const res = await fetch(`${BASE_URL}/arena/matches`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify({
            time_start: `${TEST_DATE} 00:00:00`,
            time_end: `${TEST_DATE} 23:59:59`
        })
    });
    const data = await res.json();
    return data;
}

async function updateMatch(id, payload, label) {
    console.log(`\n--- Testing Payload: ${label} ---`);
    console.log(`PUT ${BASE_URL}/arena/match/${id}`);
    console.log('Payload:', JSON.stringify(payload));

    const res = await fetch(`${BASE_URL}/arena/match/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Update Response:', JSON.stringify(data));
    return data;
}

async function run() {
    // 1. Get a test match (or create one)
    // For safety, let's try to find a match named "PHONE_TEST" or create one if not exists?
    // Actually, finding the match we just created or any test match is better.
    // Let's assume there is at least one match, or we pick the last one.

    const matches = await getMatches();
    if (matches.length === 0) {
        console.error('No matches found to test with. Please create a dummy booking first.');
        return;
    }

    // Pick the most recent one to hold valid test data, preferably one created by us
    const targetMatch = matches[matches.length - 1];
    console.log(`Target Match ID: ${targetMatch.id}, Current Name: ${targetMatch.name || targetMatch.description}`);

    // 2. Test 1: 'tel' at root (What we implemented)
    await updateMatch(targetMatch.id, {
        tel: '0990001111',
        time_start: targetMatch.time_start, // Required fields?
        time_end: targetMatch.time_end
    }, "'tel' at root");

    // Verify
    let verify = await getMatches();
    let m = verify.find(x => x.id === targetMatch.id);
    console.log(`Result 1: tel/phone in match object?`, m.tel, m.phone, m.phone_number, m.settings?.phone_number);

    // 2. Test 2: 'phone_number' at root
    await updateMatch(targetMatch.id, {
        phone_number: '0990002222',
        time_start: targetMatch.time_start,
        time_end: targetMatch.time_end
    }, "'phone_number' at root");

    // Verify
    verify = await getMatches();
    m = verify.find(x => x.id === targetMatch.id);
    console.log(`Result 2: tel/phone in match object?`, m.tel, m.phone, m.phone_number, m.settings?.phone_number);

    // 3. Test 3: 'settings.phone_number' (Like Create)
    await updateMatch(targetMatch.id, {
        settings: { phone_number: '0990003333' },
        time_start: targetMatch.time_start,
        time_end: targetMatch.time_end
    }, "'settings.phone_number'");

    // Verify
    verify = await getMatches();
    m = verify.find(x => x.id === targetMatch.id);
    console.log(`Result 3: tel/phone in match object?`, m.tel, m.phone, m.phone_number, m.settings?.phone_number);

}

run();
