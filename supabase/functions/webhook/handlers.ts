// supabase/functions/webhook/handlers.ts

import { replyMessage, pushMessage, LineEvent } from '../_shared/lineClient.ts';
import { saveUserState, getUserState, clearUserState } from '../_shared/userService.ts';
import { checkAvailability, getActiveFields } from '../_shared/bookingService.ts';
import { searchAllFieldsForSlots } from '../_shared/searchService.ts';
import { logStat } from '../_shared/statService.ts';
import { calculatePrice } from '../_shared/pricingService.ts';
import { getOrCreatePromoCode } from '../_shared/promoService.ts';
import { getProfile, upsertProfile, parseProfileInput } from '../_shared/profileService.ts';

import {
    buildSelectDateFlex,
    buildSelectTimeFlex,
    buildSelectDurationFlex,
    buildSelectFieldFlex,
    buildConfirmationFlex,
    buildSearchAllSlotsCarousel
} from './flexMessages.ts';

// Helper to parse query string style data
function parseData(data: string): any {
    const params: any = {};
    data.split('&').forEach(part => {
        const [k, v] = part.split('=');
        params[k] = decodeURIComponent(v);
    });
    return params;
}

// === Message Handler ===
export async function handleMessage(event: LineEvent) {
    const userId = event.source.userId;
    const text = event.message?.text?.trim();

    // OPTIMIZATION 3: Async logging (don't wait)
    logStat({
        user_id: userId,
        source_type: 'user',
        event_type: 'message',
        message_text: text
    }).catch(err => console.error('Log error:', err));

    // --- Onboarding Check (Priority) ---
    const userState = await getUserState(userId);

    if (userState?.step === 'onboarding') {
        const parsed = parseProfileInput(text || '');
        if (parsed) {
            await upsertProfile(userId, parsed.teamName, parsed.phoneNumber);
            await clearUserState(userId);
            await replyMessage(event.replyToken!, {
                type: 'text',
                text: `บันทึกข้อมูลเรียบร้อยครับ!\nทีม: ${parsed.teamName}\nเบอร์: ${parsed.phoneNumber}\n\nกด "จองสนาม" หรือ "ค้นหาเวลา" ได้เลยครับ 👇`,
                quickReply: {
                    items: [
                        { type: 'action', action: { type: 'message', label: 'จองสนาม', text: 'จองสนาม' } },
                        { type: 'action', action: { type: 'message', label: 'ค้นหาเวลา', text: 'ค้นหาเวลา' } }
                    ]
                }
            });
        } else {
            await replyMessage(event.replyToken!, {
                type: 'text',
                text: 'ขอโทษครับ ระบบอ่านข้อมูลไม่ชัดเจน 😅\nรบกวนพิมพ์แบบนี้ครับ: [ชื่อทีม] [เบอร์โทร]\nเช่น "หมูเด้ง เอฟซี 0812345678"'
            });
        }
        return;
    }

    // [MODIFIED] Unify 'จองสนาม' and 'ค้นหาเวลา' to trigger Search All
    if (text === 'จองสนาม' || text === 'ค้นหาเวลา') {
        // [PROFILE CHECK]
        const profile = await getProfile(userId);
        if (!profile) {
            await saveUserState(userId, { step: 'onboarding' });
            await replyMessage(event.replyToken!, {
                type: 'text',
                text: 'เพื่อให้การจองสะดวกรวดเร็ว รบกวนแจ้ง [ชื่อทีม] และ [เบอร์โทรศัพท์] ไว้หน่อยครับ 📝\n(พิมพ์ตอบกลับมาได้เลย เช่น "TeamA 0812345678")'
            });
            return;
        }

        // Trigger Search All Flow directly
        await replyMessage(event.replyToken!, {
            type: 'text',
            text: 'อยากค้นหาช่วงเวลาว่างวันไหนคะ 😊\n(ระบบจะแสดงทุกช่วงที่ว่างจนถึง 24:00)',
            quickReply: {
                items: [
                    { type: 'action', action: { type: 'postback', label: 'วันนี้', data: 'action=pickDateSearchAll&mode=today' } },
                    { type: 'action', action: { type: 'postback', label: 'พรุ่งนี้', data: 'action=pickDateSearchAll&mode=tomorrow' } },
                    { type: 'action', action: { type: 'datetimepicker', label: 'วันอื่นๆ', data: 'action=setDateSearchAll', mode: 'date' } }
                ]
            }
        });
        return;
    }

}

// === Postback Handler ===
export async function handlePostback(event: LineEvent) {
    const userId = event.source.userId;
    const dataStr = event.postback?.data || '';
    const params = parseData(dataStr);
    const action = params.action;

    // OPTIMIZATION 3: Async logging (don't wait)
    logStat({
        user_id: userId,
        source_type: 'user',
        event_type: 'postback',
        postback_data: dataStr,
        action: action
    }).catch(err => console.error('Log error:', err));

    switch (action) {
        case 'selectDate':
            await handleSelectDate(event, userId, params);
            break;
        case 'selectTime':
            await handleSelectTime(event, userId, params);
            break;
        case 'selectDuration':
            await handleSelectDuration(event, userId, params);
            break;
        case 'selectField':
            await handleSelectField(event, userId, params);
            break;
        case 'selectAltSlot':
            await handleSelectAltSlot(event, userId, params);
            break;
        case 'chooseSearchMode':
            await handleChooseSearchMode(event, userId, params);
            break;
        case 'pickDateSearchAll':
            await handlePickDateSearchAll(event, userId, params);
            break;
        case 'setDateSearchAll':
            await handleSetDateSearchAll(event, userId, params);
            break;
        case 'pickDurationSearchAll':
            await handlePickDurationSearchAll(event, userId, params);
            break;
        case 'checkTimeSearchAll':
            await handleCheckTimeSearchAll(event, userId, params);
            break;
        case 'reshowSearchAll':
            await handleReshowSearchAll(event, userId, params);
            break;
        // TODO: Implement Single Field Search handlers
        // case 'pickDateSearchSingle':
        //     await handlePickDateSearchSingle(event, userId, params);
        //     break;
        // case 'setDateSearchSingle':
        //     await handleSetDateSearchSingle(event, userId, params);
        //     break;
        // case 'pickFieldSearchSingle':
        //     await handlePickFieldSearchSingle(event, userId, params);
        //     break;
        // case 'pickDurationSearchSingle':
        //     await handlePickDurationSearchSingle(event, userId, params);
        //     break;
        default:
            console.warn("Unknown Action:", action);
    }
}

// --- Booking Flow Steps ---

async function handleSelectDate(event: LineEvent, userId: string, params: any) {
    let dateStr = params.mode === 'today' ? getTodayStr() :
        params.mode === 'tomorrow' ? getTomorrowStr() :
            event.postback?.params?.date;

    if (!dateStr) return;

    await saveUserState(userId, { date: dateStr, step: 'select_time' });
    const msg = buildSelectTimeFlex();
    await replyMessage(event.replyToken!, msg);
}

async function handleSelectTime(event: LineEvent, userId: string, params: any) {
    const timeFrom = params.time_from;
    await saveUserState(userId, { time_from: timeFrom, step: 'select_duration' });
    const msg = buildSelectDurationFlex();
    await replyMessage(event.replyToken!, msg);
}

async function handleSelectDuration(event: LineEvent, userId: string, params: any) {
    const dur = parseFloat(params.duration_h);
    await saveUserState(userId, { duration_h: dur, step: 'select_field' });
    const msg = await buildSelectFieldFlex();
    await replyMessage(event.replyToken!, msg);
}

async function handleSelectField(event: LineEvent, userId: string, params: any) {
    const fieldId = parseInt(params.field_no);

    const state = await getUserState(userId);
    if (!state.date || !state.time_from || !state.duration_h) {
        await replyMessage(event.replyToken!, { type: "text", text: "ข้อมูลไม่ครบถ้วน กรุณาเริ่มจองใหม่" });
        return;
    }

    const fields = await getActiveFields();
    if (!fields || fields.length === 0) {
        await replyMessage(event.replyToken!, { type: "text", text: "ไม่พบข้อมูลสนาม" });
        return;
    }

    const field = fields.find((f: any) => f.id === fieldId);
    if (!field) {
        await replyMessage(event.replyToken!, { type: "text", text: "ไม่พบข้อมูลสนาม" });
        return;
    }

    const startMin = timeToMinutes(state.time_from);
    const durationMin = state.duration_h * 60;
    const timeTo = addMinutesToTime(state.time_from, durationMin);

    const check = await checkAvailability(fieldId, state.date, startMin, durationMin);

    if (!check.available) {
        const flexMsg = buildConfirmationFlex({
            available: false,
            date: state.date,
            fieldLabel: `${field.label} (${field.type})`,
            fieldId: fieldId,
            timeFrom: state.time_from,
            timeTo: timeTo.substring(0, 5),
            durationH: state.duration_h,
            altSlots: check.altSlots
        });
        await replyMessage(event.replyToken!, flexMsg);

        // OPTIMIZATION 3: Async logging
        logStat({
            user_id: userId,
            source_type: 'user',
            event_type: 'booking_check',
            action: 'unavailable',
            label: `field_${fieldId}`,
            extra_json: { date: state.date, time_from: state.time_from, duration_h: state.duration_h }
        }).catch(err => console.error('Log error:', err));

        return;
    }

    const price = await calculatePrice(fieldId, state.time_from, state.duration_h);

    // Generate promo code if eligible
    const promoCode = await getOrCreatePromoCode({
        userId,
        fieldId,
        bookingDate: state.date,
        timeFrom: state.time_from,
        timeTo: timeTo.substring(0, 5),
        durationH: state.duration_h,
        originalPrice: price
    });

    const flexMsg = buildConfirmationFlex({
        available: true,
        date: state.date,
        fieldLabel: `${field.label} (${field.type})`,
        fieldId: fieldId,
        timeFrom: state.time_from,
        timeTo: timeTo.substring(0, 5),
        durationH: state.duration_h,
        price: price,
        promoCode: promoCode === 'LIMIT_REACHED' ? null : promoCode,
        dailyLimitReached: promoCode === 'LIMIT_REACHED'
    });

    await replyMessage(event.replyToken!, flexMsg);

    // OPTIMIZATION 3: Async logging
    logStat({
        user_id: userId,
        source_type: 'user',
        event_type: 'booking_check',
        action: 'available',
        label: `field_${fieldId}`,
        extra_json: {
            date: state.date,
            time_from: state.time_from,
            time_to: timeTo,
            duration_h: state.duration_h,
            price: price,
            promo_code: promoCode && promoCode !== 'LIMIT_REACHED' ? promoCode.code : null
        }
    }).catch(err => console.error('Log error:', err));

    await clearUserState(userId);
}

async function handleSelectAltSlot(event: LineEvent, userId: string, params: any) {
    const date = params.date;
    const fieldId = parseInt(params.field);
    const timeFrom = params.time_from;
    const timeTo = params.time_to;

    const startMin = timeToMinutes(timeFrom);
    const endMin = timeToMinutes(timeTo);
    const durationMin = endMin - startMin;
    const durationH = durationMin / 60;

    // Get field info
    const fields = await getActiveFields();
    if (!fields || fields.length === 0) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }

    const field = fields.find(f => f.id === fieldId);
    if (!field) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }

    // Check availability for the alternative slot
    const check = await checkAvailability(fieldId, date, startMin, durationMin);

    if (!check.available) {
        const flexMsg = buildConfirmationFlex({
            available: false,
            date: date,
            fieldLabel: `${field.label} (${field.type})`,
            fieldId: fieldId,
            timeFrom: timeFrom,
            timeTo: timeTo,
            durationH: durationH,
            altSlots: check.altSlots
        });
        await replyMessage(event.replyToken!, flexMsg);
        return;
    }

    // Calculate price
    const price = await calculatePrice(fieldId, timeFrom, durationH);

    // Generate promo code if eligible
    const promoCode = await getOrCreatePromoCode({
        userId,
        fieldId,
        bookingDate: date,
        timeFrom: timeFrom,
        timeTo: timeTo,
        durationH: durationH,
        originalPrice: price
    });

    const flexMsg = buildConfirmationFlex({
        available: true,
        date: date,
        fieldLabel: `${field.label} (${field.type})`,
        fieldId: fieldId,
        timeFrom: timeFrom,
        timeTo: timeTo,
        durationH: durationH,
        price: price,
        promoCode: promoCode === 'LIMIT_REACHED' ? null : promoCode,
        dailyLimitReached: promoCode === 'LIMIT_REACHED'
    });

    await replyMessage(event.replyToken!, flexMsg);
}

// --- Search Mode Selection ---

async function handleChooseSearchMode(event: LineEvent, userId: string, params: any) {
    const mode = params.mode;

    if (mode === 'single') {
        // ค้นทีละสนาม = ใช้ฟีเจอร์ "จองสนาม" ที่มีอยู่แล้ว
        await saveUserState(userId, { step: 'select_date' });
        const msg = buildSelectDateFlex();
        await replyMessage(event.replyToken!, msg);
    } else {
        // ค้นหาทั้งหมด = ใช้ฟีเจอร์ Search All
        await replyMessage(event.replyToken!, {
            type: 'text',
            text: 'อยากค้นหาช่วงเวลาว่างวันไหนคะ 😊\n(ระบบจะแสดงทุกช่วงที่ว่างจนถึง 24:00)',
            quickReply: {
                items: [
                    { type: 'action', action: { type: 'postback', label: 'วันนี้', data: 'action=pickDateSearchAll&mode=today' } },
                    { type: 'action', action: { type: 'postback', label: 'พรุ่งนี้', data: 'action=pickDateSearchAll&mode=tomorrow' } },
                    { type: 'action', action: { type: 'datetimepicker', label: 'วันอื่นๆ', data: 'action=setDateSearchAll', mode: 'date' } }
                ]
            }
        });
    }
}

// --- Search All Flow ---

async function handlePickDateSearchAll(event: LineEvent, userId: string, params: any) {
    const dateStr = params.mode === 'today' ? getTodayStr() : getTomorrowStr();

    // [MODIFIED] Ask for duration instead of searching immediately
    await replyMessage(event.replyToken!, {
        type: 'text',
        text: 'ต้องการเล่นกี่ชั่วโมงคะ ⏱️',
        quickReply: {
            items: [
                { type: 'action', action: { type: 'postback', label: '1 ชั่วโมง', data: `action=pickDurationSearchAll&date=${dateStr}&duration=60` } },
                { type: 'action', action: { type: 'postback', label: '1.5 ชั่วโมง', data: `action=pickDurationSearchAll&date=${dateStr}&duration=90` } },
                { type: 'action', action: { type: 'postback', label: '2 ชั่วโมง', data: `action=pickDurationSearchAll&date=${dateStr}&duration=120` } }
            ]
        }
    });

    // Old code hidden:
    /*
    const durationMin = 60;
    const fields = await getActiveFields();
    if (!fields || fields.length === 0) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }
    const resultsByField = await searchAllFieldsForSlots(dateStr, durationMin);
    const carousel = buildSearchAllSlotsCarousel(dateStr, durationMin, resultsByField, fields);
    await replyMessage(event.replyToken!, carousel);
    */
}

async function handleSetDateSearchAll(event: LineEvent, userId: string, params: any) {
    const dateStr = event.postback?.params?.date;

    if (!dateStr) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'อ่านวันที่ไม่ได้ ลองเลือกใหม่อีกครั้งนะคะ 🙏' });
        return;
    }

    // [MODIFIED] Ask for duration instead of searching immediately
    await replyMessage(event.replyToken!, {
        type: 'text',
        text: 'ต้องการเล่นกี่ชั่วโมงคะ ⏱️',
        quickReply: {
            items: [
                { type: 'action', action: { type: 'postback', label: '1 ชั่วโมง', data: `action=pickDurationSearchAll&date=${dateStr}&duration=60` } },
                { type: 'action', action: { type: 'postback', label: '1.5 ชั่วโมง', data: `action=pickDurationSearchAll&date=${dateStr}&duration=90` } },
                { type: 'action', action: { type: 'postback', label: '2 ชั่วโมง', data: `action=pickDurationSearchAll&date=${dateStr}&duration=120` } }
            ]
        }
    });

    // Old code hidden:
    /*
    const durationMin = 60;
    const fields = await getActiveFields();
    if (!fields || fields.length === 0) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }
    const resultsByField = await searchAllFieldsForSlots(dateStr, durationMin);
    const carousel = buildSearchAllSlotsCarousel(dateStr, durationMin, resultsByField, fields);
    await replyMessage(event.replyToken!, carousel);
    */
}

async function handleReshowSearchAll(event: LineEvent, userId: string, params: any) {
    const dateStr = params.date;
    const durationMin = parseInt(params.duration);

    const fields = await getActiveFields();
    if (!fields || fields.length === 0) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }

    const resultsByField = await searchAllFieldsForSlots(dateStr, durationMin);
    const carousel = buildSearchAllSlotsCarousel(dateStr, durationMin, resultsByField, fields);
    await replyMessage(event.replyToken!, carousel);
}

async function handlePickDurationSearchAll(event: LineEvent, userId: string, params: any) {
    const dateStr = params.date;
    const durationMin = parseInt(params.duration);

    await replyMessage(event.replyToken!, {
        type: 'text',
        text: 'ได้เลยค่ะ เดี๋ยวเช็คทุกสนามให้แป๊บนะคะ 😊'
    });

    // Search all fields
    const resultsByField = await searchAllFieldsForSlots(dateStr, durationMin);
    const fields = await getActiveFields();

    if (!fields || fields.length === 0) {
        await pushMessage(userId, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }

    const carousel = buildSearchAllSlotsCarousel(dateStr, durationMin, resultsByField, fields);
    await pushMessage(userId, carousel);

    // OPTIMIZATION 3: Async logging
    logStat({
        user_id: userId,
        source_type: 'user',
        event_type: 'search_all',
        action: 'search_completed',
        label: `date_${dateStr}`,
        extra_json: { date: dateStr, duration_min: durationMin }
    }).catch(err => console.error('Log error:', err));
}

async function handleCheckTimeSearchAll(event: LineEvent, userId: string, params: any) {
    const fieldId = parseInt(params.field);
    const dateStr = params.date;
    const durationMin = parseInt(params.duration);
    const startTime = params.start;

    const startMin = timeToMinutes(startTime);
    const durationH = durationMin / 60;
    const timeTo = addMinutesToTime(startTime, durationMin);

    const check = await checkAvailability(fieldId, dateStr, startMin, durationMin);

    const fields = await getActiveFields();
    if (!fields || fields.length === 0) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }

    const field = fields.find((f: any) => f.id === fieldId);

    if (!field) {
        await replyMessage(event.replyToken!, { type: 'text', text: 'ไม่พบข้อมูลสนาม' });
        return;
    }

    if (check.available) {
        const price = await calculatePrice(fieldId, startTime, durationH);

        // Generate promo code if eligible
        const promoCode = await getOrCreatePromoCode({
            userId,
            fieldId,
            bookingDate: dateStr,
            timeFrom: startTime,
            timeTo: timeTo.substring(0, 5),
            durationH: durationH,
            originalPrice: price
        });

        const flexMsg = buildConfirmationFlex({
            available: true,
            date: dateStr,
            fieldLabel: `${field.label} (${field.type})`,
            timeFrom: startTime,
            timeTo: timeTo.substring(0, 5),
            durationH: durationH,
            price: price,
            promoCode: promoCode === 'LIMIT_REACHED' ? null : promoCode,
            dailyLimitReached: promoCode === 'LIMIT_REACHED',
            fromSearchAll: true
        });

        await replyMessage(event.replyToken!, flexMsg);
    } else {
        const flexMsg = buildConfirmationFlex({
            available: false,
            date: dateStr,
            fieldLabel: `${field.label} (${field.type})`,
            timeFrom: startTime,
            timeTo: timeTo.substring(0, 5),
            durationH: durationH,
            altSlots: check.altSlots,
            fromSearchAll: true
        });

        await replyMessage(event.replyToken!, flexMsg);
    }
}

// Helper for single field search
function postbackAction(label: string, data: string) {
    return { type: 'postback', label, data };
}

function minuteToTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// --- Utils ---
function getTodayStr() {
    const now = new Date();
    const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    return bangkokTime.toISOString().split('T')[0];
}
function getTomorrowStr() {
    const now = new Date();
    const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    bangkokTime.setDate(bangkokTime.getDate() + 1);
    return bangkokTime.toISOString().split('T')[0];
}
function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
function addMinutesToTime(t: string, mins: number) {
    const total = timeToMinutes(t) + mins;
    const hh = Math.floor(total / 60).toString().padStart(2, '0');
    const mm = (total % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:00`;
}
