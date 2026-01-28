import fetch from 'node-fetch';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const ROUNDS = [
    { name: 'Round 1: Jan-Mar 2026', start: '2026-01-01', end: '2026-04-01' },
    { name: 'Round 2: Apr-Jun 2026', start: '2026-04-01', end: '2026-07-01' },
    { name: 'Round 3: Jul-Sep 2026', start: '2026-07-01', end: '2026-10-01' },
    { name: 'Round 4: Oct-Dec 2026', start: '2026-10-01', end: '2027-01-01' },
    { name: 'Round 5: Check 2027', start: '2027-01-01', end: '2028-01-01' }
];

async function runMigration(round, dryRun = false) {
    console.log(`\n=== ${round.name} ===`);
    console.log(`Range: ${round.start} → ${round.end}`);
    console.log(`Dry Run: ${dryRun}`);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/migrate-matchday-data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
            startDate: round.start,
            endDate: round.end,
            dryRun: dryRun
        })
    });

    if (!res.ok) {
        const error = await res.text();
        console.error(`❌ Error: ${res.status} - ${error}`);
        return null;
    }

    const result = await res.json();

    if (dryRun) {
        console.log(`✅ Dry Run Complete`);
        console.log(`Total Matches: ${result.totalMatches}`);
        console.log(`Samples:`, result.samples);
    } else {
        console.log(`✅ Migration Complete`);
        console.log(`Total Migrated: ${result.totalMigrated}`);
    }

    return result;
}

async function main() {
    console.log('🚀 Starting Migration Process...\n');

    for (let i = 0; i < ROUNDS.length; i++) {
        const round = ROUNDS[i];

        // Run migration
        const result = await runMigration(round, false);

        if (!result) {
            console.error(`\n⚠️ Migration failed for ${round.name}. Stopping.`);
            break;
        }

        // Special handling for Round 5 (2027 check)
        if (i === 4 && result.totalMigrated === 0) {
            console.log('\n📊 No data found in 2027. Stopping migration.');
            break;
        }

        // Wait between rounds
        if (i < ROUNDS.length - 1) {
            console.log('\n⏳ Waiting 2 seconds before next round...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\n✨ Migration Process Complete!');
}

main();
