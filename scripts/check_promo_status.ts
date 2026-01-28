
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkPromo() {
    const code = '591270';
    console.log(`Checking promo code: ${code}`);

    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .single();

    if (error) {
        console.error('Error fetching promo code:', error);
        return;
    }

    console.log('Promo Code Status:', data);

    if (data.status === 'used') {
        console.log('Resetting promo code to active for testing...');
        const { error: updateError } = await supabase
            .from('promo_codes')
            .update({ status: 'active', booking_id: null, used_at: null })
            .eq('code', code);

        if (updateError) console.error('Error resetting promo code:', updateError);
        else console.log('Promo code reset successfully!');
    }
}

checkPromo();
