require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- Checking Referrals Foreign Keys ---');
  // Use a query that would fail if foreign key is missing
  const { data, error } = await supabase
    .from('referrals')
    .select('*, referee:profiles!referee_id(team_name)')
    .limit(1);
    
  if (error) {
    console.log('Join Failed:', error.message);
  } else {
    console.log('Join Succeeded');
  }
}

check();
