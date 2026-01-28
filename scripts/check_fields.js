import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkFields() {
    const { data, error } = await supabase
        .from('fields')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Fields in database:');
        console.table(data);
    }
}

checkFields();
