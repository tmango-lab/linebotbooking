require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.from('affiliates').select('*').limit(1);
  console.log("Checking if the table has any webhooks set up on the supabase project. We will check this by looking at the schema definition using psql if possible. But since I only have anon key, I will try to use the CLI.");
}
run();
