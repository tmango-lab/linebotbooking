
// scripts/debug_db_query.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
    console.log("Testing DB Query for 'ป้าขาว'...");
    const text = "ป้าขาว";

    const startTime = Date.now();
    try {
        const { data, error } = await supabase
            .from('campaigns')
            .select('id, name, image_url, secret_codes')
            .contains('secret_codes', [text])
            .eq('status', 'ACTIVE')
            .maybeSingle();

        const duration = Date.now() - startTime;
        console.log(`Query Time: ${duration}ms`);

        if (error) {
            console.error("Query Error:", error);
        } else {
            console.log("Query Result:", data);
        }
    } catch (err) {
        console.error("Exception:", err);
    }
}

testQuery();
