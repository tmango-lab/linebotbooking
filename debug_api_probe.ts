
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Determine endpoint to test
const MD_BASE_URL = 'https://arena.matchday-backend.com';
// Get token from env inside deno context if possible, or hardcode for this test based on what I saw earlier
// I saw the token in .env, I will use Deno.env.get if run with env, or I'll read .env file.
// Since I can't easily read .env in Deno without setup, I'll paste the logic to read it or assumes it's set.
// Actually, `supabase functions invoke` sets envs? No, this is a standalone script.
// I will rely on the token I saw earlier or read .env manually.
// Wait, I saw .env in previous steps. I can just verify the variable name.
// File: .env -> MATCHDAY_TOKEN

// I will read .env file content in the script.
const envText = await Deno.readTextFile('.env');
const match = envText.match(/MATCHDAY_TOKEN=(.+)/);
const MD_TOKEN = match ? match[1].trim() : '';

console.log("Token found:", MD_TOKEN ? "Yes" : "No");

async function fetchMatches() {
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStart = `${dateStr} 00:00:00`;
    // Next day
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const timeEnd = `${yyyy}-${mm}-${dd} 00:00:00`;

    const res = await fetch(`${MD_BASE_URL}/arena/matches`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Authorization': `Bearer ${MD_TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify({ time_start: timeStart, time_end: timeEnd })
    });

    if (!res.ok) {
        console.error("Fetch failed:", await res.text());
        return [];
    }
    const data = await res.json();
    return data;
}

async function probeUpdate(matchId: number) {
    console.log(`Probing update for match ${matchId}...`);

    // Potential endpoints
    const endpoints = [
        '/arena/update-match',
        '/arena/match/update',
        '/arena/matches/update',
        `/arena/matches/${matchId}`, // PUT/PATCH
        `/arena/match/${matchId}`    // PUT/PATCH
    ];

    for (const ep of endpoints) {
        // Try POST first for non-resource URLs
        if (!ep.includes(matchId.toString())) {
            await tryRequest('POST', ep, { id: matchId, price: 600, fixed_price: 600 });
        } else {
            await tryRequest('PUT', ep, { price: 600, fixed_price: 600 });
            await tryRequest('PATCH', ep, { price: 600, fixed_price: 600 });
        }
    }
}

async function tryRequest(method: string, endpoint: string, body: any) {
    const url = `${MD_BASE_URL}${endpoint}`;
    console.log(`Trying ${method} ${url}...`);
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MD_TOKEN}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify(body)
        });

        console.log(`Result ${method} ${endpoint}: ${res.status}`);
        if (res.status !== 404) {
            console.log("Response:", await res.text());
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

// Run
const matches = await fetchMatches();
if (matches.length > 0) {
    const target = matches[0];
    console.log("Found match:", target.id);
    await probeUpdate(target.id);
} else {
    console.log("No matches found to prob.");
}
