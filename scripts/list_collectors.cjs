
const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

async function run() {
    const fs = require('fs');
    const dotenv = require('dotenv');
    const env = dotenv.parse(fs.readFileSync('.env'));
    const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const url = env.VITE_SUPABASE_URL;

    // 1. Fetch user_coupons
    const res = await fetch(`${url}/rest/v1/user_coupons?campaign_id=eq.${campaignId}&select=user_id,status,created_at`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const coupons = await res.json();

    // 2. Fetch all unique profiles
    const userIds = [...new Set(coupons.map(c => c.user_id))];
    const profRes = await fetch(`${url}/rest/v1/profiles?user_id=in.(${userIds.join(',')})&select=user_id,team_name,phone_number`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const profiles = profRes.ok ? await profRes.json() : [];
    const profMap = profiles.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
    }, {});

    // 3. Merge
    const result = coupons.map(c => ({
        user_id: c.user_id,
        team_name: profMap[c.user_id]?.team_name || 'N/A',
        phone_number: profMap[c.user_id]?.phone_number || 'N/A',
        status: c.status,
        collected_at: c.created_at
    }));

    fs.writeFileSync('scripts/collectors_list.json', JSON.stringify(result, null, 2));
    console.log('Results saved to scripts/collectors_list.json');
}

run();
