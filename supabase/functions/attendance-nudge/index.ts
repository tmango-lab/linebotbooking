
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
            .select('*, profiles(line_user_id)') // Join to get LINE User ID
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

        // 2. Loop and send Flex messages
        let successCount = 0
        let failCount = 0

        for (const booking of bookings) {
            const lineUserId = booking.profiles?.line_user_id || booking.user_id // Fallback to user_id if valid line id

            if (!lineUserId) {
                console.warn(`[Skip] Booking ${booking.booking_id} has no LINE User ID`)
                continue
            }

            try {
                const flexMsg = buildAttendanceNudgeFlex(booking)
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
function buildAttendanceNudgeFlex(booking: any) {
    // Format field name (e.g. "Field 1 (7-a-side)")
    // Note: In real app, might need to fetch field details or use booking.field_id logic if `field_label` isn't in booking
    // Assuming we can derive or it's simple. Let's send a generic "สนาม" or try to map if possible.
    // For now, let's keep it simple or use a helper if we had access to field data. 
    // Since this is a standalone function, we might not have all context. 
    // Let's use booking.field_no or similar if available, else just "สนามฟุตบอล"

    const timeRange = `${booking.time_from.substring(0, 5)} - ${booking.time_to.substring(0, 5)}`

    return {
        type: "flex",
        altText: "⚽️ ยืนยันนัดหมายวันนี้",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "⚽️ ยืนยันนัดหมายวันนี้",
                        weight: "bold",
                        size: "lg",
                        color: "#1DB446"
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
                                    { type: "text", text: "วันที่", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: formatThaiDate(booking.date), wrap: true, color: "#666666", size: "sm", flex: 5 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "เวลา", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: timeRange, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "สนาม", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: `สนาม ${booking.field_id}`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                ]
                            }
                        ]
                    },
                    {
                        type: "text",
                        text: "⚠️ หากแจ้งยกเลิกหลัง 12.00 หรือลดเวลา อาจเสียสิทธิประโยชน์ได้",
                        size: "xs",
                        color: "#FF0000",
                        wrap: true,
                        margin: "md"
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
                        action: {
                            type: "postback",
                            label: "ไปแน่นอน ✅",
                            data: `action=confirm_attendance&booking_id=${booking.booking_id}`,
                            displayText: "ยืนยัน: ไปแน่นอนครับ"
                        }
                    },
                    {
                        type: "button",
                        style: "secondary",
                        color: "#FF6B6B",
                        action: {
                            type: "postback",
                            label: "ติดธุระ ขอยกเลิก ❌",
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
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${day} ${thaiMonths[date.getMonth()]} ${year + 543}`;
}
