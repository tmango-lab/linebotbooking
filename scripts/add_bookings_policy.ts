// Quick script to add RLS policy to bookings table
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Execute SQL to add policy
const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
    CREATE POLICY IF NOT EXISTS "Enable all operations for service role" 
    ON public.bookings 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
  `
});

if (error) {
    console.error('Error:', error);
} else {
    console.log('Policy added successfully!');
}
