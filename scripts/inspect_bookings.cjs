
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching booking:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in bookings table:');
        console.log(Object.keys(data[0]));
    } else {
        console.log('No bookings found to inspect.');
    }
}

inspect();
