/**
 * Apply SQL migration to Supabase using the Management API
 * Usage: node scripts/run_sql_migration.cjs <path_to_sql_file>
 */
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
console.log(`Project ref: ${projectRef}`);

async function runSQL(filePath) {
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`\n📄 File: ${filePath}`);
    console.log(`📏 SQL length: ${sql.length} chars`);

    // Try Management API approach (requires access token, may not work)
    // Fallback: use supabase-js .rpc() with a helper function

    // Approach: Split SQL into individual statements and execute them via
    // a temporary SQL execution RPC
    
    // First, create a temp exec_sql function
    const createExecFn = `
        CREATE OR REPLACE FUNCTION _temp_exec_sql(sql_text text)
        RETURNS void
        LANGUAGE plpgsql SECURITY DEFINER
        AS $fn$
        BEGIN
            EXECUTE sql_text;
        END;
        $fn$;
    `;

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
        db: { schema: 'public' },
        auth: { persistSession: false }
    });

    // Try using the SQL query endpoint (available via service role in some setups)
    // Actually the most reliable way is to use the `pg` npm package with the connection string
    // But we don't have the DB URL. Let's try the REST SQL endpoint.

    // APPROACH: Use supabase-js query function if available
    // Actually let's try using the Supabase SQL API
    const sqlApiUrl = `https://${projectRef}.supabase.co/rest/v1/rpc/_temp_exec_sql`;
    
    // Step 1: Split SQL into executable blocks
    // We'll use a different approach - try to execute via direct Postgres connection
    // using the project's database URL format

    // Standard Supabase DB URL format:
    const dbUrl = `postgresql://postgres.${projectRef}:${SERVICE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
    
    console.log('Attempting direct database connection...');
    
    try {
        // Try pg module
        const { Client } = require('pg');
        const client = new Client({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        console.log('✅ Connected to database');
        
        await client.query(sql);
        console.log('✅ SQL executed successfully!');
        
        await client.end();
        return true;
    } catch (pgErr) {
        console.log(`⚠️  Direct PG connection failed: ${pgErr.message}`);
        console.log('Trying alternative approach with individual statements...');
        
        // Fallback: Try splitting statements and running them via RPC approach
        // This is tricky because we can't create RPC without DB connection
        
        // Last resort: Try the Supabase SQL API (undocumented but sometimes works)
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
                method: 'POST',
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ query: sql })
            });
            
            if (response.ok) {
                console.log('✅ SQL executed via REST API');
                return true;
            } else {
                const text = await response.text();
                console.log(`❌ REST API failed: ${response.status} - ${text}`);
            }
        } catch (fetchErr) {
            console.log(`❌ REST fetch failed: ${fetchErr.message}`);
        }
        
        return false;
    }
}

async function main() {
    const filePath = process.argv[2] || 'supabase/migrations/20260311_combined_phase1_phase2.sql';
    
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    
    const success = await runSQL(filePath);
    
    if (!success) {
        console.log('\n' + '='.repeat(60));
        console.log('⚠️  Could not auto-apply migration.');
        console.log('Please run the SQL manually in Supabase SQL Editor:');
        console.log(`  File: ${filePath}`);
        console.log('='.repeat(60));
        process.exit(1);
    }
}

main();
