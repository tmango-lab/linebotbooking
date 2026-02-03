
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import "https://deno.land/std@0.208.0/dotenv/load.ts";

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing ENV vars");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Checking Public Access to 'fields' table...");

const { data, error } = await supabase
    .from('fields')
    .select('*')
    .limit(5);

if (error) {
    console.error("❌ Error fetching fields:", error);
} else {
    console.log(`✅ Success! Found ${data.length} fields.`);
    console.log(data);
}
