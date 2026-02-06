
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findS2Test() {
    console.log("🔍 Searching for S2Test bookings...");
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .or('display_name.ilike.%S2Test%,user_id.ilike.%S2Test%')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    if (!bookings || bookings.length === 0) {
        console.log("❌ No bookings found for S2Test.");
        // Try to show all pending payment bookings as a fallback
        const { data: pending } = await supabase.from('bookings').select('*').eq('status', 'pending_payment').limit(5);
        console.log("Current pending bookings:", JSON.stringify(pending, null, 2));
        return;
    }

    console.log("✅ Found bookings:", JSON.stringify(bookings, null, 2));
}

findS2Test();
