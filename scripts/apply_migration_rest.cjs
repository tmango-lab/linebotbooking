const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

async function runSQL(filePath) {
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`\nApplying: ${filePath}`);
    console.log(`SQL length: ${sql.length} chars`);

    // Use the SQL Editor endpoint
    const sqlRes = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });

    if (sqlRes.ok) {
        console.log(`✅ Applied successfully`);
        return true;
    } else {
        const text = await sqlRes.text();
        console.error(`❌ Failed: ${sqlRes.status}`);
        console.error(text);
        return false;
    }
}

async function main() {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.log('Usage: node scripts/apply_migration_rest.cjs <file1.sql> [file2.sql] ...');
        process.exit(1);
    }
    for (const f of files) {
        const ok = await runSQL(f);
        if (!ok) {
            console.error(`Stopping due to error in ${f}`);
            process.exit(1);
        }
    }
    console.log('\n✅ All migrations applied.');
}

main();
