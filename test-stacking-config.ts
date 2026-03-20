import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConfig() {
    console.log("=== Checking Database Configuration ===");
    const { data: cols, error: colError } = await supabase.from('campaigns').select('allow_ontop_stacking').limit(1);
    if (colError) {
        console.error("❌ ERROR: Column allow_ontop_stacking not found in campaigns!", colError.message);
    } else {
        console.log("✅ Column allow_ontop_stacking exists.");
    }
}

checkConfig();
