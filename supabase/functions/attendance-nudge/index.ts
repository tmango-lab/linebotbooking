
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pushMessage } from '../_shared/lineClient.ts'

console.log("Hello from attendance-nudge!")

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get today's date in YYYY-MM-DD format (Bangkok Time)
        const now = new Date()
        const bangkokNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
        const todayStr = bangkokNow.toISOString().split('T')[0]

        console.log(`[Attendance Nudge] Running for date: ${todayStr}`)

        // 1. Query confirmed bookings for today
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('date', todayStr)
            .eq('status', 'confirmed')
            .is('attendance_status', null) // Only notify if not yet responded

        if (error) throw error

        console.log(`[Attendance Nudge] Found ${bookings?.length || 0} bookings to notify.`)

        if (!bookings || bookings.length === 0) {
            return new Response(JSON.stringify({ message: 'No bookings to notify', count: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // [FIX] Fetch profiles manually (PostgREST relation issue)
        const userIds = [...new Set(bookings.map((b: any) => b.user_id))];
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, line_user_id') // Assuming line_user_id is column name, or if it's user_id?
            // Wait, schema.sql says profiles has user_id, team_name, phone_number.
            // It does NOT show line_user_id.
            // Checking schema.sql again...
            // Line 66: CREATE TABLE IF NOT EXISTS public.profiles ( user_id TEXT PRIMARY KEY, team_name TEXT, phone_number TEXT, ... )
            // Does it have line_user_id?
            // If user_id IS the line_user_id (which is common in this project), then we don't need a join!
            // But let's check if 'line_user_id' exists.
            // If user_id is the LINE User ID, we can just use booking.user_id.
            .in('user_id', userIds);

        // Mapping
        const profileMap = new Map();
        if (profiles) {
            profiles.forEach((p: any) => profileMap.set(p.user_id, p));
        }

        // 2. Loop and send Flex messages
        let successCount = 0
        let failCount = 0

        for (const booking of bookings) {
            // Pass profile explicitly
            const profile = profileMap.get(booking.user_id);
            const lineUserId = profile?.line_user_id || booking.user_id;

            if (!lineUserId) {
                console.warn(`[Skip] Booking ${booking.booking_id} has no LINE User ID`)
                continue
            }

            try {
                // Use display_name from booking, fallback to team_name from profile
                const teamName = booking.display_name || profile?.team_name || "ลูกค้า";
                const flexMsg = buildAttendanceNudgeFlex(booking, teamName)
                await pushMessage(lineUserId, flexMsg)
                successCount++
                console.log(`[Sent] Nudge sent to booking ${booking.booking_id} (User: ${lineUserId})`)
            } catch (err) {
                console.error(`[Error] Failed to send nudge to ${booking.booking_id}:`, err)
                failCount++
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Process completed',
                date: todayStr,
                total: bookings.length,
                success: successCount,
                failed: failCount
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
    }
})

// Helper to build the Flex Message
// Helper to build the Flex Message
function buildAttendanceNudgeFlex(booking: any, teamName: string) {
    const fieldLabel = booking.field_no ? `สนาม ${booking.field_no}` : "สนามฟุตบอล";
    const timeRange = `${booking.time_from.substring(0, 5)} - ${booking.time_to.substring(0, 5)}`

    // Thai Date
    const dateStr = formatThaiDate(booking.date);

    return {
        type: "flex",
        altText: `⚽️ ยืนยันนัดหมาย: ${teamName}`,
        contents: {
            type: "bubble",
            size: "kilo", // Slightly wider if needed
            header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#06C755",
                paddingAll: "lg",
                contents: [
                    {
                        type: "text",
                        text: "Confirm Match ⚽",
                        color: "#FFFFFF",
                        weight: "bold",
                        size: "sm"
                    }
                ]
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: teamName,
                        weight: "bold",
                        size: "xl",
                        color: "#000000",
                        wrap: true,
                        margin: "none"
                    },
                    { type: "separator", margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "📅", flex: 1, size: "sm" },
                                    { type: "text", text: dateStr, wrap: true, color: "#333333", size: "sm", flex: 8 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "⏰", flex: 1, size: "sm" },
                                    { type: "text", text: timeRange, wrap: true, color: "#333333", size: "sm", flex: 8 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "📍", flex: 1, size: "sm" },
                                    { type: "text", text: fieldLabel, wrap: true, color: "#333333", size: "sm", flex: 8 }
                                ]
                            }
                        ]
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        color: "#06C755",
                        height: "sm",
                        action: {
                            type: "postback",
                            label: "✓  Confirm",
                            data: `action=confirm_attendance&booking_id=${booking.booking_id}`,
                            displayText: "ยืนยัน: ไปแน่นอนครับ"
                        }
                    },
                    {
                        type: "button",
                        style: "secondary",
                        color: "#DE350B", // Red
                        height: "sm",
                        action: {
                            type: "postback",
                            label: "✕  Decline",
                            data: `action=cancel_attendance&booking_id=${booking.booking_id}`,
                            displayText: "ขอยกเลิก: ติดธุระครับ"
                        }
                    }
                ]
            }
        }
    }
}

// Micro-helper for date formatting (duplicate to keep function standalone independent of shared if needed, or better use shared)
// To stay safe and single-file executable for Cron, I'll allow some duplication or I could import if I'm sure about path.
// `../_shared/` is accessible.
// Let's copy basic formatter for safety.

function formatThaiDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    return `${dayNames[date.getDay()]} ${day} ${thaiMonths[date.getMonth()]} ${year + 543}`;
}
