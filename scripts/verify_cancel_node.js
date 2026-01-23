
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read .env manualy
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const tokenMatch = envContent.match(/MATCHDAY_TOKEN=(.+)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';

if (!token) {
    console.error('Error: MATCHDAY_TOKEN not found in .env');
    process.exit(1);
}

const MATCH_ID = 1456865; // From previous step
const URL = `https://arena.matchday-backend.com/arena/match/${MATCH_ID}`;

async function cancelBooking() {
    console.log(`Attempting to cancel match ${MATCH_ID}...`);

    try {
        const response = await fetch(URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify({
                cancel: 1,
                remark: "System Verification Test (Node.js)"
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log('Cancellation Successful!');
        console.log('Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Failed to cancel:', error);
    }
}

cancelBooking();
