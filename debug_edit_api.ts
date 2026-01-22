
// debug_edit_api.ts

import { updateMatchdayBooking } from './supabase/functions/_shared/matchdayApi.ts';

// Using the ID from the user's screenshot/session: 1455983
const MATCH_ID = 1455983;

async function testUpdate() {
    console.log("Starting Update Test...");

    try {
        // Prepare payload - attempting to set price back to 550 or confirm 600
        // We need existing start/end times. Based on screenshot: 08:01 - 09:00
        const payload = {
            description: "ทดสอบ",
            time_start: "2026-01-22 08:01",
            time_end: "2026-01-22 09:00",
            remark: null,
            change_price: 550 // Testing resetting it to 550, or simply updating it
        };

        const result = await updateMatchdayBooking(MATCH_ID, payload);
        console.log("Update Result:", result);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testUpdate();
