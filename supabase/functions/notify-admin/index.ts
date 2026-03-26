import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { pushMessage } from "../_shared/lineClient.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use the provided Admin LINE ID or fallback to env var
const LINE_ADMIN_GROUP_ID = Deno.env.get('LINE_ADMIN_GROUP_ID') || 'Ua636ab14081b483636896549d2026398';

// Helper to translate status
function translateStatus(status: string) {
    const map: Record<string, string> = {
        'pending_payment': 'รอชำระเงิน',
        'paid': 'ชำระแล้ว',
        'confirmed': 'ยืนยันแล้ว',
        'cancelled': 'ยกเลิก',
        'pending': 'รอดำเนินการ'
    };
    return map[status?.toLowerCase()] || status;
}

// Build Flex Message for Admin
function buildAdminNotificationFlex(event: string, record: any, oldRecord: any = null, fieldLabel: string = '') {
    const isInsert = event === 'INSERT';
    const isDelete = event === 'DELETE';
    const isUpdate = event === 'UPDATE';
    
    // Choose color and header
    let headerText = '🆕 มีรายการจองใหม่';
    let headerColor = '#06C755'; // Green
    
    if (isDelete || (isUpdate && record.status === 'cancelled' && oldRecord?.status !== 'cancelled')) {
        headerText = '❌ รายการจองถูกยกเลิก';
        headerColor = '#FF3B30'; // Red
    } else if (isUpdate) {
        headerText = '✏️ มีการแก้ไขรายการจอง';
        headerColor = '#FF9500'; // Orange
    }

    // Determine the data to show
    const data = isDelete ? oldRecord : record;
    const name = data.display_name || data.user_id || 'ไม่ระบุชื่อ';
    
    // Format Date and Time
    const dateStr = data.date || '-';
    const timeStr = data.time_from && data.time_to ? `${data.time_from} - ${data.time_to}` : '-';
    const priceStr = data.price_total_thb ? `${data.price_total_thb} บาท` : '-';

    const boxContents: any[] = [
        {
            type: "text",
            text: headerText,
            weight: "bold",
            size: "lg",
            color: headerColor
        },
        { type: "separator", margin: "md" },
        {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: [
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "รหัสจอง", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: data.booking_id || '-', wrap: true, color: "#666666", size: "sm", flex: 5 }
                    ]
                },
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "ชื่อลูกค้า", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: name, wrap: true, color: "#666666", size: "sm", flex: 5 }
                    ]
                },
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "เบอร์โทร", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: data.phone_number || '-', wrap: true, color: "#666666", size: "sm", flex: 5 }
                    ]
                },
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "สนาม", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: fieldLabel || `สนาม ${data.field_no || '-'}`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                    ]
                },
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "วัน-เวลา", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: `${dateStr} | ${timeStr}`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                    ]
                },
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "ราคา", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: priceStr, wrap: true, color: "#666666", size: "sm", flex: 5 }
                    ]
                },
                {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "สถานะ", color: "#aaaaaa", size: "sm", flex: 2 },
                        { type: "text", text: translateStatus(data.status), wrap: true, color: headerColor, weight: "bold", size: "sm", flex: 5 }
                    ]
                }
            ]
        }
    ];

    // Show what changed if UPDATE
    if (isUpdate && oldRecord) {
        let changedText = '';
        if (record.status !== oldRecord.status) changedText += `สถานะ: ${translateStatus(oldRecord.status)} ➡️ ${translateStatus(record.status)}\n`;
        if (record.date !== oldRecord.date || record.time_from !== oldRecord.time_from) {
            changedText += `เวลา: ${oldRecord.date} ${oldRecord.time_from} ➡️ ${record.date} ${record.time_from}\n`;
        }
        if (record.payment_status !== oldRecord.payment_status) {
            changedText += `การจ่าย: ${translateStatus(oldRecord.payment_status)} ➡️ ${translateStatus(record.payment_status)}\n`;
        }
        
        if (changedText) {
            boxContents.push(
                { type: "separator", margin: "md" },
                {
                    type: "box",
                    layout: "vertical",
                    margin: "md",
                    contents: [
                       { type: "text", text: "📋 การเปลี่ยนแปลง:", color: "#aaaaaa", size: "xs" },
                       { type: "text", text: changedText.trim(), wrap: true, size: "xs", color: "#FF9500" }
                    ]
                }
            );
        } else {
            // If nothing meaningful changed, we might not send it, but handled upstream
        }
    }

    if (data.admin_note) {
         boxContents.push(
            { type: "separator", margin: "md" },
            {
                type: "box",
                layout: "vertical",
                margin: "md",
                contents: [
                   { type: "text", text: `หมายเหตุ: ${data.admin_note}`, color: "#666666", size: "sm", wrap: true }
                ]
            }
        );
    }

    return {
        type: "flex",
        altText: headerText,
        contents: {
            type: "bubble",
            size: "kilo",
            body: {
                type: "box",
                layout: "vertical",
                contents: boxContents
            }
        }
    };
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { type, table, record, old_record } = payload;

        console.log(`[Admin Notify] Received ${type} event on ${table}`);

        if (table !== 'bookings') {
            return new Response('Ignored', { headers: corsHeaders });
        }

        // --- FILTERING LOGIC ---
        let shouldSend = false;
        
        if (type === 'INSERT') {
            shouldSend = true;
        } else if (type === 'DELETE') {
            shouldSend = true;
        } else if (type === 'UPDATE') {
            // Only send if something important changed
            if (
                record.status !== old_record.status || 
                record.date !== old_record.date || 
                record.time_from !== old_record.time_from ||
                record.payment_status !== old_record.payment_status
            ) {
                shouldSend = true;
            }
        }

        if (!shouldSend) {
            console.log('[Admin Notify] Update ignored (no critical changes)');
            return new Response('Ignored (No critical changes)', { headers: corsHeaders });
        }

        // Fetch Field Label
        let fieldLabel = '';
        try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
            const supabase = createClient(supabaseUrl, serviceRoleKey);
            
            const targetRecord = type === 'DELETE' ? old_record : record;
            if (targetRecord?.field_no) {
                const { data } = await supabase.from('fields').select('label').eq('id', targetRecord.field_no).single();
                if (data) fieldLabel = data.label;
            }
        } catch (err) {
            console.error('[Admin Notify] Failed to fetch field label', err);
        }

        // Build and Send Flex Message
        const flexMsg = buildAdminNotificationFlex(type, record, old_record, fieldLabel);
        
        await pushMessage(LINE_ADMIN_GROUP_ID, flexMsg);
        console.log(`[Admin Notify] Sent notification to ${LINE_ADMIN_GROUP_ID}`);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Admin Notify Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
