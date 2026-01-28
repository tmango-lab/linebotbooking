import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU'; // Value from .env
const BASE_URL = 'https://arena.matchday-backend.com';
const START_DATE = '2026-01-29'; // Start from tomorrow
const END_DATE = '2026-02-05';   // Check 1 week

// --- Mapping Configuration ---
const COURT_MAP = {
    2424: 2424,
    2425: 2425,
    2428: 2428,
    2426: 2426,
    2427: 2427,
    2429: 2429
};

// --- Helper Functions ---
function getNextDay(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

async function fetchMatchdayMatches(startStr, endStr) {
    const url = `${BASE_URL}/arena/matches`;
    console.log(`[Fetch] Range: ${startStr} to ${endStr}`);

    const body = {
        time_start: `${startStr} 00:00:00`,
        time_end: `${endStr} 00:00:00`
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${TOKEN}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.error(`Error: ${res.status} ${res.statusText}`);
            console.error(await res.text());
            return [];
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Fetch Failed:', e);
        return [];
    }
}

function mapToLocal(match) {
    // Parse Time (Bangkok Time from Matchday)
    // Format: "2026-01-28 17:30:00"
    const [d, t] = match.time_start.split(' ');
    const [_, endTimeStr] = match.time_end.split(' ');
    const timeFrom = t.slice(0, 5); // "17:30"
    const timeTo = endTimeStr.slice(0, 5); // "18:30"

    // Calculate duration
    const startH = parseInt(timeFrom.split(':')[0]) + parseInt(timeFrom.split(':')[1]) / 60;
    const endH = parseInt(timeTo.split(':')[0]) + parseInt(timeTo.split(':')[1]) / 60;
    const duration = endH - startH;

    // Price
    // Matchday has multiple price fields, prioritize `total_price` > `price` > `fixed_price`
    const price = match.total_price || match.price || match.fixed_price || 0;

    return {
        booking_id: String(match.id),
        field_no: match.court_id, // Store direct ID
        date: d,
        time_from: timeFrom,
        time_to: timeTo,
        duration_h: duration.toFixed(1),
        price: price,
        customer_name: match.name || match.description || 'Unknown',
        tel: match.tel || match.phone_number || '',
        status: match.cancel ? 'cancelled' : 'confirmed',
        source: 'MATCHDAY_IMPORT'
    };
}

// --- Main Execution ---
async function runDryRun() {
    console.log('--- Starting Migration Dry Run ---');

    // 1. Fetch
    const matches = await fetchMatchdayMatches(START_DATE, END_DATE);
    console.log(`\nFound ${matches.length} matches in Matchday.`);

    // 2. Map & Verify
    const mapped = matches.map(mapToLocal);

    // 3. Print Samples
    const samples = mapped.slice(0, 5); // Show first 5

    console.log('\n--- Sample Transformed Records ---');
    samples.forEach((r, i) => {
        console.log(`\n[Record ${i + 1}] ID: ${r.booking_id}`);
        console.log(`Original: ${matches[i].time_start} (Court ${matches[i].court_id})`);
        console.log(`Mapped:   Date=${r.date}, Time=${r.time_from}-${r.time_to}, Field=${r.field_no}`);
        console.log(`Details:  Name="${r.customer_name}", Price=${r.price}, Status=${r.status}`);
    });

    // 4. Analysis
    const courtCounts = {};
    matches.forEach(m => {
        courtCounts[m.court_id] = (courtCounts[m.court_id] || 0) + 1;
    });

    console.log('\n--- Analysis ---');
    console.log('Court Distribution:', courtCounts);

    console.log('\n--- Dry Run Complete ---');
}

runDryRun();
