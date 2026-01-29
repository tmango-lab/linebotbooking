
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseKey)

console.log("Verifying 'campaigns' table schema...")

const { data, error } = await supabase
    .from('campaigns')
    .select('id, eligible_fields, payment_methods')
    .limit(1)

if (error) {
    // If table doesn't exist, it usually errors with relation not found
    console.error("Error query campaigns:", error.message)
} else {
    console.log("Success! Table 'campaigns' exists.")
    console.log("Sample data or empty:", data)
}
