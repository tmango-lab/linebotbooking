// @ts-nocheck
// supabase/functions/webhook/flexMessages.ts

import { getActiveFields } from '../_shared/bookingService.ts';
import type { PromoCode } from '../_shared/promoService.ts';

// Helper to create Postback Action
function postbackAction(label: string, data: string) {
    return { type: 'postback', label, data };
}
//test
// Helper: Convert minutes to HH:MM
function minuteToTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper: Format date to Thai format (e.g., "วันอาทิตย์ 19 มกราคม 2026")
function formatThaiDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    const dayName = thaiDays[date.getDay()];
    const monthName = thaiMonths[date.getMonth()];

    return `${dayName} ${day} ${monthName} ${year}`;
}

// Helper: Format expiry time (show time only)
function formatExpiryTime(isoString: string): string {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} น.`;
}

// Helper: Format discount display
function formatDiscount(promo: PromoCode): string {
    if (promo.discount_type === 'percent') {
        return `${promo.discount_value}%`;
    } else {
        return `${promo.discount_value} บาท`;
    }
}

// 1. Select Date Flex
export function buildSelectDateFlex() {
    return {
        type: "flex",
        altText: "เลือกวันที่จองสนาม",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    { type: "text", text: "กรุณาเลือกวันที่", weight: "bold", size: "lg" },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        contents: [
                            { type: "button", style: "secondary", action: postbackAction("วันนี้", "action=selectDate&mode=today") },
                            { type: "button", style: "secondary", action: postbackAction("พรุ่งนี้", "action=selectDate&mode=tomorrow") },
                            {
                                type: "button",
                                style: "primary",
                                action: {
                                    type: "datetimepicker",
                                    label: "วันอื่นๆ",
                                    data: "action=selectDate",
                                    mode: "date"
                                }
                            }
                        ]
                    }
                ]
            }
        }
    };
}

// 2. Select Time Flex (Carousel of time slots)
export function buildSelectTimeFlex() {
    const slots = [
        { label: "16:00 - 18:00", times: ["16:00", "16:30", "17:00", "17:30"] },
        { label: "18:00 - 20:00", times: ["18:00", "18:30", "19:00", "19:30"] },
        { label: "20:00 - 22:00", times: ["20:00", "20:30", "21:00", "21:30"] },
        { label: "22:00 - 24:00", times: ["22:00", "22:30", "23:00", "23:30"] },
    ];

    const bubbles = slots.map(slot => ({
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
                { type: "text", text: slot.label, weight: "bold", size: "lg" },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: slot.times.map(t => ({
                        type: "button",
                        style: "secondary",
                        action: postbackAction(t, `action=selectTime&time_from=${t}`)
                    }))
                }
            ]
        }
    }));

    return {
        type: "flex",
        altText: "เลือกเวลาเริ่ม",
        contents: { type: "carousel", contents: bubbles }
    };
}

// 3. Select Duration Flex
export function buildSelectDurationFlex() {
    return {
        type: "flex",
        altText: "เลือกจำนวนชั่วโมง",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    { type: "text", text: "ต้องการจองนานเท่าไหร่?", weight: "bold", size: "lg" },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        contents: [
                            { type: "button", style: "secondary", action: postbackAction("1 ชม.", "action=selectDuration&duration_h=1") },
                            { type: "button", style: "secondary", action: postbackAction("1.5 ชม.", "action=selectDuration&duration_h=1.5") },
                            { type: "button", style: "secondary", action: postbackAction("2 ชม.", "action=selectDuration&duration_h=2") },
                        ]
                    }
                ]
            }
        }
    };
}

// 4. Select Field Flex
export async function buildSelectFieldFlex() {
    const fields = await getActiveFields();

    if (!fields || fields.length === 0) {
        // Return empty flex if no fields
        return {
            type: "flex",
            altText: "ไม่พบสนาม",
            contents: {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: "ไม่พบข้อมูลสนาม", color: "#999999" }
                    ]
                }
            }
        };
    }

    const buttons = fields.map((f: any) => ({
        type: "button",
        style: "primary",
        action: postbackAction(`${f.label} (${f.type})`, `action=selectField&field_no=${f.id}`)
    }));

    return {
        type: "flex",
        altText: "เลือกสนาม",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    { type: "text", text: "กรุณาเลือกสนาม", weight: "bold", size: "lg" },
                    { type: "separator" },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        contents: buttons
                    }
                ]
            }
        }
    };
}

// 5. Confirmation Flex Message with Alternative Slots and Promo Code
export function buildConfirmationFlex(params: {
    available: boolean;
    date: string;
    fieldLabel: string;
    fieldId?: number;
    timeFrom: string;
    timeTo: string;
    durationH: number;
    price?: number;
    promoCode?: PromoCode | null;
    dailyLimitReached?: boolean;
    altSlots?: Array<{ from: string, to: string }>;
    fromSearchAll?: boolean;
}) {
    const { available, date, fieldLabel, fieldId, timeFrom, timeTo, durationH, price, promoCode, dailyLimitReached, altSlots, fromSearchAll } = params;

    if (available) {
        return {
            type: "flex",
            altText: "ช่วงเวลานี้ว่างพร้อมให้จอง",
            contents: {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "ช่วงเวลานี้ว่างพร้อมให้จอง ✅",
                            weight: "bold",
                            size: "lg",
                            color: "#06C755"
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
                                        { type: "text", text: formatThaiDate(date), wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    spacing: "sm",
                                    contents: [
                                        { type: "text", text: "สนาม", color: "#aaaaaa", size: "sm", flex: 2 },
                                        { type: "text", text: fieldLabel, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    spacing: "sm",
                                    contents: [
                                        { type: "text", text: "เวลา", color: "#aaaaaa", size: "sm", flex: 2 },
                                        { type: "text", text: `${timeFrom} - ${timeTo}`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    spacing: "sm",
                                    contents: [
                                        { type: "text", text: "ระยะเวลา", color: "#aaaaaa", size: "sm", flex: 2 },
                                        { type: "text", text: `${durationH} ชั่วโมง`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    spacing: "sm",
                                    contents: [
                                        { type: "text", text: promoCode ? "ราคาเต็ม" : "ราคา", color: "#aaaaaa", size: "sm", flex: 2 },
                                        { type: "text", text: price ? `${price.toLocaleString()} บาท` : "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                }
                            ]
                        },
                        // Promo Code Section (if exists)
                        ...(promoCode ? [{
                            type: "separator" as const,
                            margin: "md" as const
                        },
                        {
                            type: "box" as const,
                            layout: "vertical" as const,
                            backgroundColor: "#FFF9E6",
                            cornerRadius: "md" as const,
                            paddingAll: "md" as const,
                            margin: "md" as const,
                            contents: [
                                {
                                    type: "text" as const,
                                    text: "🎁 โปรโมชั่นพิเศษ!",
                                    weight: "bold" as const,
                                    size: "md" as const,
                                    color: "#FF6B6B"
                                },
                                {
                                    type: "text" as const,
                                    text: `รับส่วนลด ${formatDiscount(promoCode)}`,
                                    size: "sm" as const,
                                    margin: "xs" as const
                                },
                                {
                                    type: "separator" as const,
                                    margin: "sm" as const
                                },
                                {
                                    type: "text" as const,
                                    text: "💳 รหัสส่วนลด",
                                    size: "xs" as const,
                                    color: "#999999",
                                    margin: "md" as const
                                },
                                {
                                    type: "text" as const,
                                    text: promoCode.code,
                                    size: "xxl" as const,
                                    weight: "bold" as const,
                                    align: "center" as const,
                                    color: "#FF6B6B"
                                },
                                {
                                    type: "separator" as const,
                                    margin: "sm" as const
                                },
                                {
                                    type: "box" as const,
                                    layout: "baseline" as const,
                                    contents: [
                                        { type: "text" as const, text: "💰 ราคาหลังหัก:", size: "sm" as const, flex: 3 },
                                        { type: "text" as const, text: `${promoCode.final_price.toLocaleString()} บาท`, weight: "bold" as const, align: "end" as const, flex: 2 }
                                    ]
                                },
                                {
                                    type: "text" as const,
                                    text: `⏰ ใช้ได้ถึง: ${formatExpiryTime(promoCode.expires_at)}`,
                                    size: "xs" as const,
                                    color: "#FF6B6B",
                                    margin: "sm" as const
                                }
                            ]
                        }] : []),
                        // Daily Limit Message (if reached)
                        ...(dailyLimitReached ? [{
                            type: "separator" as const,
                            margin: "md" as const
                        },
                        {
                            type: "box" as const,
                            layout: "vertical" as const,
                            backgroundColor: "#FFF3E0",
                            cornerRadius: "md" as const,
                            paddingAll: "md" as const,
                            margin: "md" as const,
                            contents: [
                                {
                                    type: "text" as const,
                                    text: "หมดโค้ดสำหรับวันนี้แล้วค่ะ 😊",
                                    size: "sm" as const,
                                    color: "#FF9800",
                                    wrap: true
                                },
                                {
                                    type: "text" as const,
                                    text: "พรุ่งนี้จะได้โค้ดใหม่นะคะ",
                                    size: "xs" as const,
                                    color: "#999999",
                                    margin: "xs" as const
                                }
                            ]
                        }] : [])
                    ]
                },
                footer: {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        ...(promoCode ? [{
                            type: "text" as const,
                            text: "📞 โทรจองที่: 083-914-4000",
                            weight: "bold" as const,
                            align: "center" as const,
                            margin: "sm" as const
                        },
                        {
                            type: "text" as const,
                            text: "(แจ้งรหัสเพื่อรับส่วนลด)",
                            size: "xs" as const,
                            color: "#999999",
                            align: "center" as const,
                            margin: "xs" as const
                        },
                        {
                            type: "separator" as const,
                            margin: "md" as const
                        }] : []),
                        {
                            type: "button",
                            style: "primary",
                            color: "#06C755",
                            action: { type: "uri", label: "โทรหาแอดมินเพื่อจอง", uri: "tel:0839144000" }
                        },
                        {
                            type: "button",
                            style: "secondary",
                            action: fromSearchAll
                                ? postbackAction("เลือกเวลาใหม่", `action=reshowSearchAll&date=${date}&duration=${durationH * 60}`)
                                : { type: "message", label: "เลือกเวลาใหม่", text: "จองสนาม" }
                        }
                    ]
                }
            }
        };
    } else {
        const altButtons = (altSlots || []).map(slot => ({
            type: "button",
            style: "secondary",
            action: postbackAction(`${slot.from} - ${slot.to}`, `action=selectAltSlot&date=${date}&field=${fieldId}&time_from=${slot.from}&time_to=${slot.to}`)
        }));

        const altContents = altButtons.length > 0 ? altButtons : [
            { type: "text", text: "ไม่มีเวลาใกล้เคียงที่ว่างในช่วงนี้", size: "sm", color: "#999999" }
        ];

        return {
            type: "flex",
            altText: "ช่วงเวลานี้มีคิวแล้ว",
            contents: {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "ช่วงเวลานี้มีคิวแล้ว ❌",
                            weight: "bold",
                            size: "lg",
                            color: "#FF0000"
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
                                        { type: "text", text: formatThaiDate(date), wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    spacing: "sm",
                                    contents: [
                                        { type: "text", text: "สนาม", color: "#aaaaaa", size: "sm", flex: 2 },
                                        { type: "text", text: fieldLabel, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    spacing: "sm",
                                    contents: [
                                        { type: "text", text: "เวลา", color: "#aaaaaa", size: "sm", flex: 2 },
                                        { type: "text", text: `${timeFrom} - ${timeTo}`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                    ]
                                }
                            ]
                        },
                        {
                            type: "text",
                            text: "เวลาใกล้เคียงที่ยังว่าง 🔍",
                            weight: "bold",
                            size: "sm",
                            margin: "md"
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            spacing: "sm",
                            contents: altContents
                        }
                    ]
                },
                footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "button",
                            style: "secondary",
                            action: { type: "message", label: "เลือกเวลาใหม่", text: "จองสนาม" }
                        }
                    ]
                }
            }
        };
    }
}

// 6. Search All Slots Carousel
export function buildSearchAllSlotsCarousel(
    dateStr: string,
    durationMin: number,
    resultsByField: Record<number, Array<{ start: number, end: number }>>,
    fields: any[]
) {
    const bubbles = fields.map(field => {
        const slots = resultsByField[field.id] || [];

        const slotContents = slots.length > 0
            ? slots.map(slot => ({
                type: 'button',
                style: 'secondary',
                action: postbackAction(
                    `${minuteToTime(slot.start)} - ${minuteToTime(slot.end)}`,
                    `action=checkTimeSearchAll&field=${field.id}&date=${dateStr}&start=${minuteToTime(slot.start)}&duration=${durationMin}`
                )
            }))
            : [{
                type: 'text',
                text: 'ช่วงเวลานี้เต็มแล้วค่ะ 😢',
                color: '#999999',
                size: 'sm'
            }];

        return {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: field.label, weight: 'bold', size: 'lg' },
                    { type: 'text', text: `ประเภท ${field.type}`, size: 'sm', color: '#666666' },
                    { type: 'text', text: `วันที่ ${dateStr}`, size: 'sm' },
                    { type: 'text', text: `ระยะเวลา ${durationMin / 60} ชั่วโมง`, size: 'sm' },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'sm',
                        margin: 'md',
                        contents: slotContents
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [{
                    type: 'button',
                    style: 'secondary',
                    action: { type: 'message', label: 'ค้นหาใหม่', text: 'ค้นหาเวลา' }
                }]
            }
        };
    });

    return {
        type: 'flex',
        altText: 'ค้นทุกช่วงเวลาว่าง',
        contents: {
            type: 'carousel',
            contents: bubbles
        }
    };
}
