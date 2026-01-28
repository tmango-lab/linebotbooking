import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkConstraints() {
    // Check if there's a foreign key on field_no
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                conname AS constraint_name,
                contype AS constraint_type,
                pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conrelid = 'public.bookings'::regclass;
        `
    });

    if (error) {
        console.error('Error:', error);

        // Try alternative method - just try to insert with a test value
        console.log('\nTrying test insert...');
        const { error: insertError } = await supabase
            .from('bookings')
            .insert({
                booking_id: 'TEST_123',
                user_id: 'TEST',
                field_no: 2424,
                date: '2026-01-01',
                status: 'confirmed'
            });

        if (insertError) {
            console.error('Insert Error:', insertError);
        } else {
            console.log('✅ Test insert successful!');
            // Clean up
            await supabase.from('bookings').delete().eq('booking_id', 'TEST_123');
        }
    } else {
        console.log('Constraints:', data);
    }
}

checkConstraints();
