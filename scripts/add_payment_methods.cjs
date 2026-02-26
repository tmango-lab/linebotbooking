const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL');
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

        const sql = `
            ALTER TABLE referral_programs ADD COLUMN IF NOT EXISTS allowed_payment_methods text[];
            UPDATE referral_programs SET allowed_payment_methods = ARRAY['qr', 'field'] WHERE allowed_payment_methods IS NULL;
        `;

        await client.query(sql);
        console.log('Column allowed_payment_methods added successfully.');

    } catch (err) {
        console.error('Error applying SQL:', err);
    } finally {
        await client.end();
    }
}

main();
