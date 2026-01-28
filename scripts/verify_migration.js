import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyMigration() {
    console.log('=== Migration Verification ===\n');

    // 1. Total Count
    const { count: totalCount, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'MATCHDAY_IMPORT');

    if (countError) {
        console.error('Error counting:', countError);
    } else {
        console.log(`✅ Total Migrated Records: ${totalCount}`);
    }

    // 2. Count by Field
    const { data: fieldCounts, error: fieldError } = await supabase
        .from('bookings')
        .select('field_no')
        .eq('source', 'MATCHDAY_IMPORT');

    if (!fieldError && fieldCounts) {
        const counts = {};
        fieldCounts.forEach((r) => {
            counts[r.field_no] = (counts[r.field_no] || 0) + 1;
        });
        console.log('\n📊 Distribution by Field:');
        Object.entries(counts).forEach(([field, count]) => {
            console.log(`   Field ${field}: ${count} bookings`);
        });
    }

    // 3. Sample Records
    const { data: samples, error: sampleError } = await supabase
        .from('bookings')
        .select('booking_id, field_no, date, time_from, time_to, price_total_thb, display_name, status')
        .eq('source', 'MATCHDAY_IMPORT')
        .limit(5);

    if (!sampleError && samples) {
        console.log('\n📋 Sample Records:');
        samples.forEach((s, i) => {
            console.log(`\n[${i + 1}] ID: ${s.booking_id}`);
            console.log(`    Field: ${s.field_no}, Date: ${s.date}`);
            console.log(`    Time: ${s.time_from} - ${s.time_to}`);
            console.log(`    Price: ${s.price_total_thb} THB`);
            console.log(`    Name: ${s.display_name}`);
            console.log(`    Status: ${s.status}`);
        });
    }

    // 4. Check for any issues
    const { data: nullFields, error: nullError } = await supabase
        .from('bookings')
        .select('booking_id')
        .eq('source', 'MATCHDAY_IMPORT')
        .is('field_no', null);

    if (!nullError) {
        console.log(`\n⚠️  Records with NULL field_no: ${nullFields?.length || 0}`);
    }

    console.log('\n✨ Verification Complete!');
}

verifyMigration();
