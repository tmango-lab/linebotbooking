import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Get one booking to see ALL columns
    const { data } = await supabase
        .from('bookings')
        .select('*')
        .gte('date', '2026-03-01')
        .lte('date', '2026-03-31')
        .eq('status', 'confirmed')
        .limit(1);

    if (data && data[0]) {
        console.log('ALL columns on a booking:');
        console.log(Object.keys(data[0]).join(', '));
        console.log('\nSample values:');
        console.log('discount:', data[0].discount);
        console.log('discount_amount:', data[0].discount_amount);
    }

    // Now sum ALL bookings' discount column for March
    const { data: allBookings } = await supabase
        .from('bookings')
        .select('discount, admin_note, display_name, date')
        .gte('date', '2026-03-01')
        .lte('date', '2026-03-31')
        .eq('status', 'confirmed');

    let discountColTotal = 0;
    let noteTotal = 0;
    allBookings.forEach(b => {
        if (b.discount) discountColTotal += b.discount;
        if (b.admin_note && b.admin_note.includes('(-')) {
            const match = b.admin_note.match(/\(-(\d+)\)/);
            if (match) noteTotal += parseInt(match[1]);
        }
    });
    console.log(`\n--- March 2026 (confirmed only) ---`);
    console.log(`SUM of 'discount' column: ฿${discountColTotal}`);
    console.log(`SUM from admin_note parsing: ฿${noteTotal}`);
    console.log(`Total confirmed bookings: ${allBookings.length}`);

    // Show bookings with non-zero discount column
    const withDiscount = allBookings.filter(b => b.discount && b.discount > 0);
    console.log(`\nBookings with discount column > 0: ${withDiscount.length}`);
    withDiscount.slice(0, 10).forEach(b => {
        console.log(`  ${b.date} | ${b.display_name} | discount: ${b.discount}`);
    });
}
main();
