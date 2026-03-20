
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking user_coupons samples...");
    const { data, error } = await supabase.from('user_coupons').select('*').limit(1);
    if (error) console.error(error);
    else console.log(data);

    console.log("Checking campaigns schema...");
    const { data: c, error: cErr } = await supabase.from('campaigns').select('*').limit(1);
    if (cErr) console.error(cErr);
    else console.log(c);
}

checkSchema();
