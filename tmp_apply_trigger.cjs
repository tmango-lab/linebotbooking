const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL in .env');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const sql = fs.readFileSync('supabase/scripts/fix_trigger_points.sql', 'utf8');

        await client.query(sql);
        console.log('Trigger fixed successfully.');

    } catch (err) {
        console.error('Error applying SQL:', err);
    } finally {
        await client.end();
    }
}

main();
