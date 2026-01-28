
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkDoubleBookings() {
    console.log("Scanning for double bookings...");

    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .neq('status', 'cancelled')
        .order('date', { ascending: true });

    if (error) {
        console.error("Error fetching bookings:", error);
        return;
    }

    console.log(`Analyzing ${bookings.length} active bookings...`);

    const conflicts: any[] = [];
    const groupedByFieldDate: Record<string, any[]> = {};

    // Group by Field + Date for efficiency
    bookings.forEach(b => {
        const key = `${b.field_no}_${b.date}`;
        if (!groupedByFieldDate[key]) groupedByFieldDate[key] = [];
        groupedByFieldDate[key].push(b);
    });

    // Check overlaps within groups
    Object.keys(groupedByFieldDate).forEach(key => {
        const group = groupedByFieldDate[key];

        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const b1 = group[i];
                const b2 = group[j];

                // Normalize times
                const start1 = new Date(`${b1.date}T${b1.time_from.substring(0, 5)}:00+07:00`);
                const end1 = new Date(`${b1.date}T${b1.time_to.substring(0, 5)}:00+07:00`);

                const start2 = new Date(`${b2.date}T${b2.time_from.substring(0, 5)}:00+07:00`);
                const end2 = new Date(`${b2.date}T${b2.time_to.substring(0, 5)}:00+07:00`);

                // Check overlap
                if (start1 < end2 && end1 > start2) {
                    conflicts.push({
                        date: b1.date,
                        field: b1.field_no,
                        booking1: {
                            id: b1.booking_id,
                            time: `${b1.time_from} - ${b1.time_to}`,
                            name: b1.display_name,
                            contact: b1.phone_number
                        },
                        booking2: {
                            id: b2.booking_id,
                            time: `${b2.time_from} - ${b2.time_to}`,
                            name: b2.display_name,
                            contact: b2.phone_number
                        }
                    });
                }
            }
        }
    });

    if (conflicts.length === 0) {
        console.log("✅ No double bookings found! The database is clean.");
    } else {
        console.log(`⚠️ FOUND ${conflicts.length} DOUBLE BOOKINGS!`);
        conflicts.forEach((c, idx) => {
            console.log(`\nConflict #${idx + 1} on ${c.date} (Field ${c.field}):`);
            console.log(`   1. [${c.booking1.id}] ${c.booking1.time} | ${c.booking1.name} (${c.booking1.contact})`);
            console.log(`   2. [${c.booking2.id}] ${c.booking2.time} | ${c.booking2.name} (${c.booking2.contact})`);
        });
    }
}

checkDoubleBookings();
