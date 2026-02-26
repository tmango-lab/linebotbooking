require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('get_table_triggers', { table_name: 'affiliates' }).catch(() => ({}));
  if (error) console.log("RPC get_table_triggers not found");
  
  // Alternative: query pg_trigger if accessible via REST? Not accessible.
  // Instead, let's use the REST API to check for webhooks?
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/pg_trigger?select=*`, {
    headers: { 'apikey': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}` }
  });
  console.log(res.status, await res.text());
}
check();
