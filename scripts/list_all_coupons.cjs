
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: coupons } = await supabase
        .from('user_coupons')
        .select('*, campaigns(name)');

    fs.writeFileSync('scripts/all_coupons.json', JSON.stringify(coupons, null, 2));
    console.log('Results saved to scripts/all_coupons.json');
}

check();
