const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUserProfile(userId) {
    console.log(`Fixing profile for: ${userId}`);

    // 1. Get latest booking
    const { data: lastBooking, error: bookingError } = await supabase
        .from('bookings')
        .select('display_name, phone_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (bookingError || !lastBooking) {
        console.error('Could not find booking for user', bookingError);
        return;
    }

    console.log('Found latest booking data:', lastBooking);

    // 2. Update Profile
    const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
            team_name: lastBooking.display_name,
            phone_number: lastBooking.phone_number,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

    if (updateError) {
        console.error('Update Profile Error:', updateError);
    } else {
        console.log('Profile updated successfully:', updatedProfile);
    }
}

const userId = 'Ub49d1e719e7bdcf3abe50da725a393b6';
fixUserProfile(userId);
