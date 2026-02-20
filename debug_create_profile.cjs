const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCreateProfile(userId) {
    console.log(`Trying to create profile for: ${userId}`);

    // Mock data similar to what the edge function uses
    const displayName = `Debug-User-${userId.slice(0, 4)}`;
    const phoneNumber = null;

    const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
            user_id: userId,
            team_name: displayName,
            phone_number: phoneNumber,
            //            role: 'customer', // Commenting out role just in case, or keep it? Let's keep it if we think it exists, but team_name is the critical fix.
            // Actually, let's try to minimal insert first.
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Create Profile Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Profile created successfully:', newProfile);
    }
}

// Get userId from command line arg
const userId = process.argv[2];
if (!userId) {
    console.log('Usage: node debug_create_profile.cjs <userId>');
} else {
    debugCreateProfile(userId);
}
