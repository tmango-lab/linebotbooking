// @ts-nocheck
// supabase/functions/webhook/flexMessages.ts

import { getActiveFields } from '../_shared/bookingService.ts';
import type { PromoCode } from '../_shared/promoService.ts';

// Helper to create Postback Action
function postbackAction(label: string, data: string) {
    return { type: 'postback', label, data };
}

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

// Helper: Format expiry time with date context (Bangkok timezone)
function formatExpiryTime(isoString: string): string {
    // Convert UTC to Bangkok time (UTC+7)
    const expiryDate = new Date(isoString);
    const bangkokTime = new Date(expiryDate.getTime() + (7 * 60 * 60 * 1000));
    const now = new Date();
    const bangkokNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));

    // Check if same day (in Bangkok timezone)
    const isSameDay = bangkokTime.getUTCDate() === bangkokNow.getUTCDate() &&
        bangkokTime.getUTCMonth() === bangkokNow.getUTCMonth() &&
        bangkokTime.getUTCFullYear() === bangkokNow.getUTCFullYear();

    const hours = bangkokTime.getUTCHours().toString().padStart(2, '0');
    const minutes = bangkokTime.getUTCMinutes().toString().padStart(2, '0');

    if (isSameDay) {
        return `วันนี้ ${hours}:${minutes} น.`;
    } else {
        // If tomorrow or later, show date
        const day = bangkokTime.getUTCDate();
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const month = monthNames[bangkokTime.getUTCMonth()];
        const year = bangkokTime.getUTCFullYear() + 543; // Convert to Buddhist year
        return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
    }
}

// Helper: Format discount display
function formatDiscount(promo: PromoCode): string {
    if (promo.discount_type === 'percent') {
        return `${promo.discount_value}%`;
    } else {
        return `${promo.discount_value} บาท`;
    }
}

// [NEW] Helper: Translate English Day to Thai
function translateDayToThai(dayEn: string): string {
    const map: Record<string, string> = {
        'Sun': 'อาทิตย์', 'Mon': 'จันทร์', 'Tue': 'อังคาร', 'Wed': 'พุธ',
        'Thu': 'พฤหัสบดี', 'Fri': 'ศุกร์', 'Sat': 'เสาร์'
    };
    // Handle specific day or full name if needed, but usually searchService uses 3 chars
    const key = dayEn.substring(0, 3);
    return map[key] || dayEn;
}

// [NEW] Helper: Calculate End Time
function calculateEndTime(start: string, durationH: number): string {
    const [h, m] = start.split(':').map(Number);
    const totalMin = (h * 60) + m + (durationH * 60);
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

// 1. Select Date Flex
// Helper to format date to Thai (e.g., 2026-02-05 -> พฤ. 05-02-2026)
function formatDateToThai(dateStr: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const dayName = dayNames[date.getDay()];
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${dayName} ${d}-${m}-${y}`;
}

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
            altText: "สนามว่าง จองได้เลย!",
            contents: {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "✅ สนามว่าง จองได้เลย!",
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
// 7. Coupon Flex Message (Pa-Kao)
export function buildCouponFlex(campaignId: string, secretCode: string, couponName: string, desc: string, imageUrl?: string, userId?: string) {
    const LIFF_ID = '2009013698-RcmHMN8h';
    const cleanPath = `/?userId=${encodeURIComponent(userId || '')}`;
    const collectPath = `/?action=collect&code=${encodeURIComponent(secretCode)}&id=${encodeURIComponent(campaignId)}&userId=${encodeURIComponent(userId || '')}`;

    const walletUrl = `https://liff.line.me/${LIFF_ID}${cleanPath}`;
    const collectUrl = `https://liff.line.me/${LIFF_ID}${collectPath}`;
    const coverImage = imageUrl || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop";

    return {
        type: "flex",
        altText: `🎉 คุณเจอโค้ดลับ: ${secretCode}`,
        contents: {
            type: "bubble",
            hero: {
                type: "image",
                url: coverImage,
                size: "full",
                aspectRatio: "20:13",
                aspectMode: "cover",
                action: { type: "uri", uri: collectUrl }
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "Secret Discovered! 🕵️‍♀️",
                        weight: "bold",
                        size: "xs",
                        color: "#D4AF37",
                        align: "center"
                    },
                    {
                        type: "text",
                        text: couponName,
                        weight: "bold",
                        size: "xl",
                        margin: "md",
                        align: "center",
                        color: "#333333",
                        wrap: true
                    },
                    {
                        type: "text",
                        text: desc || "สิทธิ์พิเศษสำหรับคนรู้รหัสลับ! กดรับคูปองส่วนลดพิเศษได้ทันที",
                        size: "sm",
                        color: "#666666",
                        wrap: true,
                        margin: "md",
                        align: "center"
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
                        action: {
                            type: "postback",
                            label: "🎁 รับเลย!",
                            data: `action=collectCoupon&campaignId=${campaignId}&secretCode=${secretCode}`,
                            displayText: "กำลังเก็บคูปอง..."
                        },
                        color: "#06C755",
                        height: "sm"
                    },
                    {
                        type: "button",
                        style: "link",
                        action: { type: "uri", label: "👛 ดูกระเป๋า", uri: walletUrl },
                        height: "sm"
                    },
                    {
                        type: "text",
                        text: `Code: ${secretCode}`,
                        size: "xs",
                        color: "#aaaaaa",
                        align: "center",
                        margin: "md"
                    }
                ]
            }
        }
    };
}
// 8. Booking Success Flex Message
export function buildBookingSuccessFlex(params: {
    teamName: string;
    fieldName: string;
    date: string;
    timeFrom: string;
    timeTo: string;
    price: number;
    paymentMethod: string;
}) {
    const { teamName, fieldName, date, timeFrom, timeTo, price, paymentMethod } = params;

    return {
        type: "flex",
        altText: "จองสนามสำเร็จ! ✅",
        contents: {
            type: "bubble",
            hero: (paymentMethod === 'qr') ? {
                type: "image",
                url: `https://promptpay.io/${Deno.env.get('PROMPTPAY_ID') || '0839144000'}/200.png`,
                size: "full",
                aspectRatio: "1:1",
                aspectMode: "cover",
            } : undefined,
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: paymentMethod === 'qr' ? "💳 ชำระเงินมัดจำ 200 บาท" : "✅ จองสนามสำเร็จแล้ว!",
                        weight: "bold",
                        size: "lg",
                        color: paymentMethod === 'qr' ? "#FF9800" : "#06C755"
                    },
                    {
                        type: "text",
                        text: paymentMethod === 'qr' ? "กรุณาโอนเงินมัดจำภายใน 10 นาที" : "ขอบคุณที่ใช้บริการครับ",
                        size: "sm",
                        color: "#999999",
                        margin: "xs"
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
                                    { type: "text", text: "ทีม", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: teamName, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "สนาม", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: fieldName, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                ]
                            },
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
                                    { type: "text", text: "เวลา", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: `${timeFrom} - ${timeTo}`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "ยอดรวม", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: `${price.toLocaleString()} บาท`, color: "#333333", size: "sm", flex: 5 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "ยอดโอน", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: paymentMethod === 'qr' ? "200.00 บาท" : "-", weight: "bold", color: "#FF5252", size: "sm", flex: 5 }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    { type: "text", text: "การชำระ", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: paymentMethod === 'qr' ? 'มัดจำ 200 (QR)' : 'จ่ายที่สนาม', color: "#666666", size: "sm", flex: 5 }
                                ]
                            }
                        ]
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "xl",
                        contents: paymentMethod === 'qr' ? [
                            { type: "separator" },
                            {
                                type: "text",
                                text: "📢 เมื่อโอนเงินแล้ว กรุณาส่งรูปสลิปเข้ามาในช่องแชทนี้เพื่อยืนยันการจองทันที",
                                color: "#FF5252",
                                size: "xs",
                                weight: "bold",
                                wrap: true,
                                margin: "md"
                            }
                        ] : []
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
                        style: "secondary",
                        height: "sm",
                        action: { type: "message", label: "ดูรายการจองของฉัน", text: "รายการจอง" }
                    }
                ]
            }
        }
    };
}

// 9. Regular Booking Summary Flex
export function buildRegularBookingSummaryFlex(params: {
    startDate: string;
    endDate: string;
    targetDay: string;
    time: string;
    duration: number;
    slots: { date: string, available: boolean, reason?: string, price?: number }[]; // [NEW] Added price
    price: number; // Total Base Price
    fieldName: string; // [NEW] Display Field Name
    promoCode?: { code: string; discount_amount: number; final_price: number } | null;
}) {
    const { startDate, endDate, targetDay, time, duration, slots, price, fieldName, promoCode } = params;

    const slotRows = slots.map(slot => ({
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
            { type: "text", text: formatDateToThai(slot.date), color: "#666666", size: "sm", flex: 4 }, // Increased flex
            ...(slot.price ? [{
                type: "text",
                text: `${slot.price.toLocaleString()}฿`,
                color: "#333333",
                size: "sm",
                flex: 2,
                align: "end"
            }] : []),
            {
                type: "text",
                text: slot.available ? "✅" : "❌", // Shorten status to icon for space
                color: slot.available ? "#06C755" : "#FF5252",
                size: "sm",
                flex: 1,
                align: "end"
            }
        ]
    }));

    // Only show first 50 slots to avoid Flex limits (Box contents max 50)
    // If more, show "..."
    const displayRows = slotRows.length > 50 ? [...slotRows.slice(0, 50), { type: "text", text: `...และอีก ${slotRows.length - 50} วัน`, size: "xs", color: "#999999", align: "center", margin: "xs" }] : slotRows;

    const availableCount = slots.filter(s => s.available).length;
    const totalCount = slots.length;

    return {
        type: "flex",
        altText: "สรุปการจองประจำ",
        contents: {
            type: "bubble",
            size: "giga",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "📅 สรุปการจองประจำ", weight: "bold", size: "xl", color: "#333333" },
                    { type: "text", text: `${formatDateToThai(startDate)} - ${formatDateToThai(endDate)}`, size: "xs", color: "#999999", margin: "xs" },
                    { type: "separator", margin: "md" },

                    // Info Section
                    // Info Section
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                contents: [
                                    { type: "text", text: `วัน: ${translateDayToThai(targetDay)}`, size: "sm", color: "#333333", flex: 3 },
                                    { type: "text", text: `เวลา: ${time} - ${calculateEndTime(time, duration)} น.`, size: "sm", color: "#333333", flex: 4, align: "end" }
                                ]
                            },
                            { type: "text", text: `สนาม: ${fieldName}`, size: "sm", color: "#333333", weight: "bold" },
                            { type: "text", text: `จำนวน: ${availableCount}/${totalCount} ครั้งที่จองได้`, size: "sm", color: availableCount === totalCount ? "#06C755" : "#FF9800", weight: "bold", margin: "xs" }
                        ]
                    },

                    // Slots List (Scrollable if needed, but Flex body scrolls naturally if long?)
                    // Flex message Bubble body doesn't scroll separately. The whole message scrolls.
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "xs",
                        contents: displayRows
                    },

                    { type: "separator", margin: "lg" },

                    // Price Section
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        spacing: "sm",
                        contents: [
                            { type: "separator", margin: "sm" },
                            {
                                type: "box",
                                layout: "baseline",
                                contents: [
                                    { type: "text", text: "ราคาเต็ม", color: "#aaaaaa", size: "sm", flex: 2 },
                                    { type: "text", text: `${price.toLocaleString()} ฿`, color: "#333333", size: "sm", flex: 3, align: "end" }
                                ]
                            },
                            ...(promoCode ? [
                                {
                                    type: "box",
                                    layout: "baseline",
                                    contents: [
                                        { type: "text", text: `ส่วนลด (${promoCode.code})`, color: "#FF5252", size: "sm", flex: 3 },
                                        { type: "text", text: `-${promoCode.discount_amount.toLocaleString()} ฿`, color: "#FF5252", size: "sm", flex: 2, align: "end" }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    contents: [
                                        { type: "text", text: "สุทธิ", weight: "bold", color: "#333333", size: "md", flex: 2 },
                                        { type: "text", text: `${promoCode.final_price.toLocaleString()} ฿`, weight: "bold", color: "#06C755", size: "xl", flex: 3, align: "end" }
                                    ]
                                },
                                { type: "text", text: `(เฉลี่ยวันละ ${(promoCode.final_price / availableCount).toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท)`, size: "xs", color: "#999999", align: "end", margin: "xs" }
                            ] : [
                                {
                                    type: "box",
                                    layout: "baseline",
                                    contents: [
                                        { type: "text", text: "สุทธิ", weight: "bold", color: "#333333", size: "md", flex: 2 },
                                        { type: "text", text: `${price.toLocaleString()} ฿`, weight: "bold", color: "#333333", size: "xl", flex: 3, align: "end" }
                                    ]
                                }
                            ])
                        ]
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    ...(availableCount > 0 ? [{
                        type: "button",
                        style: "primary",
                        color: "#06C755",
                        action: postbackAction(`✅ ยืนยันการจอง (${availableCount} วัน)`, "action=confirmRegularBooking")
                    }] : []),
                    {
                        type: "button",
                        style: "link",
                        height: "sm",
                        action: { type: "message", label: "ยกเลิก / เริ่มใหม่", text: "จองประจำล่วงหน้า" }
                    }
                ]
            }
        }
    };
}
