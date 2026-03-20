import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { console.error('Missing credentials'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBookingReward() {
    const userId = 'Ua636ab14081b483636896549d2026398';

    // 1. Check initial points
    const { data: profilePre } = await supabase.from('profiles').select('points').eq('user_id', userId).single();
    const initialPoints = profilePre?.points || 0;
    console.log(`Initial Points: ${initialPoints}`);

    // 2. Create a mock booking
    const { data: booking, error: err1 } = await supabase.from('bookings').insert([{
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        time_from: '16:00:00',
        time_to: '17:00:00',
        duration_h: 1,
        price_total_thb: 1550, // Should give 150 points
        payment_status: 'pending',
        status: 'PENDING'
    }]).select().single();

    if (err1) { console.error('Error creating booking:', err1); return; }
    console.log(`Created mock booking: ${booking.id}`);

    // 3. Update payment status to 'paid' (trigger should fire)
    const { error: err2 } = await supabase.from('bookings')
        .update({ payment_status: 'paid', status: 'CONFIRMED' })
        .eq('id', booking.id);

    if (err2) { console.error('Error updating payment:', err2); return; }

    // Give the DB a tiny ms to let the trigger finish if it is async (it shouldn't be, but just in case)
    await new Promise(r => setTimeout(r, 500));

    // 4. Check new points (should be initial + 150)
    const { data: profilePost } = await supabase.from('profiles').select('points').eq('user_id', userId).single();
    console.log(`Final Points: ${profilePost?.points}`);
    console.log(`Points Awarded: ${profilePost?.points - initialPoints}`);

    // 5. Check point history
    const { data: history } = await supabase.from('point_history')
        .select('*')
        .eq('reference_id', String(booking.id)); // ensure it's a string
    console.log(`History Entry Created: ${history?.length > 0 ? 'YES' : 'NO'}`);

    // Cleanup
    await supabase.from('point_history').delete().eq('reference_id', String(booking.id));
    await supabase.from('bookings').delete().eq('id', booking.id);
    await supabase.from('profiles').update({ points: initialPoints }).eq('user_id', userId);
    console.log('Test cleanup done.');
}

testBookingReward();
