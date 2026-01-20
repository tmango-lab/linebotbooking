
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = "https://kyprnvazjyilthdzhqxh.supabase.co";
// This is the Anon Key from the user's .env file
const ANON_KEY = "sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testFunction() {
    console.log("Testing get-bookings function...");
    const { data, error } = await supabase.functions.invoke('get-bookings', {
        body: { date: "2026-01-20" }
    });

    if (error) {
        console.error("Function Error:", error);
    } else {
        console.log("Function Success:", data);
    }
}

testFunction();
