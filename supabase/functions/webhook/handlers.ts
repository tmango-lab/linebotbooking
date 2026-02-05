// supabase/functions/webhook/handlers.ts

import { replyMessage, pushMessage, LineEvent, getMessageContent } from '../_shared/lineClient.ts';
import { saveUserState, getUserState, clearUserState } from '../_shared/userService.ts';
import { checkAvailability, getActiveFields } from '../_shared/bookingService.ts';
import { searchAllFieldsForSlots } from '../_shared/searchService.ts';
import { logStat } from '../_shared/statService.ts';
import { calculatePrice } from '../_shared/pricingService.ts';
import { getOrCreatePromoCode } from '../_shared/promoService.ts';
import { getProfile, upsertProfile, parseProfileInput } from '../_shared/profileService.ts';
import { supabase } from '../_shared/supabaseClient.ts';
import { verifySlip } from './slipVerification.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
    buildSelectDateFlex,
    buildSelectTimeFlex,
    buildSelectDurationFlex,
    buildSelectFieldFlex,
    buildConfirmationFlex,
    buildRegularBookingSummaryFlex,
    buildSearchAllSlotsCarousel, // [NEW] Fixed missing import
    buildCouponFlex // [NEW] Fixed missing import
} from './flexMessages.ts';
import { searchRegularBookingSlots } from '../_shared/searchService.ts'; // [NEW]
import { validateManualPromoCode, applyManualDiscount } from '../_shared/promoService.ts'; // [NEW]

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

    // [REMOVED] Old manual code input step (Now handled by silent matching)

    // PING CHECK
    if (text === 'ping') {
        await replyMessage(event.replyToken!, { type: 'text', text: 'pong' });
        return;
    }

    // [REFINED] Regular Booking Flow (VIP Only) - Supports "จองประจำ [CODE]"
    if (text === 'จองประจำล่วงหน้า' || (text && text.startsWith('จองประจำ'))) {
        const profile = await getProfile(userId);

        // 1. If no profile -> Prompt Registration
        if (!profile) {
            await saveUserState(userId, { step: 'onboarding' });
            await replyMessage(event.replyToken!, {
                type: 'text',
                text: 'ยินดีต้อนรับครับ! ⚽\nก่อนเริ่มใช้งานฟีเจอร์ "จองประจำ"\nรบกวนแจ้งข้อมูลลงทะเบียนหน่อยครับ\n\nพิมพ์: [ชื่อทีม] [เบอร์โทร]\nเช่น "หมูเด้ง เอฟซี 0812345678" ได้เลยครับ 👇'
            });
            return;
        }

        // 2. If not VIP -> Inform user
        if (profile.role !== 'vip') {
            await replyMessage(event.replyToken!, {
                type: 'text',
                text: '⚠️ ฟีเจอร์ "จองประจำล่วงหน้า" เปิดให้ใช้งานเฉพาะสมาชิก VIP เท่านั้นครับ\n\nหากสนใจสมัคร VIP กรุณาติดต่อแอดมิน 083-914-4000 หรือทักแชทแจ้งแอดมินได้เลยครับ 😊'
            });
            return;
        }

        // 3. Secret Code Detection (e.g. "จองประจำ VIP100")
        let initialCode = "";
        const parts = text.split(/\s+/);
        if (parts.length > 1) {
            const potentialCode = parts[1];
            const validation = await validateManualPromoCode(potentialCode);
            if (validation.valid && validation.code) {
                initialCode = validation.code.code;
                console.log(`[SecretFlow] Applying initial code: ${initialCode}`);
            }
        }

        // Start Flow
        await saveUserState(userId, {
            is_regular_flow: true,
            step: 'regular_start_date',
            manual_promo_code: initialCode // Save if found
        });

        await replyMessage(event.replyToken!, {
            type: "flex",
            altText: "เลือกวันเริ่มจอง",
            contents: {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                        { type: "text", text: "🗓️ เลือกวันเริ่มต้น", weight: "bold", size: "lg" },
                        { type: "text", text: initialCode ? `✨ รหัสลับ "${initialCode}" ถูกเปิดใช้งานแล้ว` : "กรุณาเลือกวันที่ต้องการเริ่มจอง", size: "sm", color: initialCode ? "#06C755" : "#666666" },
                        {
                            type: "button",
                            style: "primary",
                            action: {
                                type: "datetimepicker",
                                label: "เลือกวันเริ่มต้น",
                                data: "action=setRegularStartDate",
                                mode: "date",
                                min: new Date().toISOString().split('T')[0],
                                max: "2026-12-31"
                            }
                        }
                    ]
                }
            }
        });
        return;
    }

    // [NEW] Developer V2 Access
    if (text === '#dev_v2') {
        const liffUrl = `https://liff.line.me/${Deno.env.get('LIFF_ID') || 'YOUR_LIFF_ID'}?mode=v2&userId=${userId}`;

        await replyMessage(event.replyToken!, {
            type: 'flex',
            altText: 'Developer Mode V2',
            contents: {
                type: 'bubble',
                size: 'kilo',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        { type: 'text', text: '🛠️ Developer Mode', weight: 'bold', size: 'lg', color: '#1DB446' },
                        { type: 'text', text: 'Promotion V2 / Grid Booking', size: 'sm', color: '#666666', margin: 'sm' },
                        {
                            type: 'button',
                            style: 'primary',
                            color: '#1DB446',
                            action: { type: 'uri', label: 'Open Booking V2', uri: liffUrl },
                            margin: 'md',
                            height: 'sm'
                        }
                    ]
                }
            }
        });
        return;
    }

    // [NEW] Developer V3 Access (Vertical Grid)
    if (text === '#dev_v3') {
        const liffUrl = `https://liff.line.me/${Deno.env.get('LIFF_ID') || 'YOUR_LIFF_ID'}?mode=v3&userId=${userId}`;

        await replyMessage(event.replyToken!, {
            type: 'flex',
            altText: 'Developer Mode V3',
            contents: {
                type: 'bubble',
                size: 'kilo',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        { type: 'text', text: '🛠️ Developer Mode V3', weight: 'bold', size: 'lg', color: '#007AFF' },
                        { type: 'text', text: 'Vertical Grid Layout (Mobile Optimized)', size: 'sm', color: '#666666', margin: 'sm' },
                        {
                            type: 'button',
                            style: 'primary',
                            color: '#007AFF', // Blue for V3
                            action: { type: 'uri', label: 'Open Booking V3 (Vertical)', uri: liffUrl },
                            margin: 'md',
                            height: 'sm'
                        }
                    ]
                }
            }
        });
        return;
    }

    // [NEW] Secret Keyword Listener "The Pa-Kao Flow"
    try {
        // [DEBUG] Log entry
        console.log(`[Pa-Kao] Checking keyword: '${text}'`);

        if (text && text.length < 20) {
            // Execute DB Query (Timeout wrapper removed as DB is proven fast enough, but keep race if desired? 
            // Logs showed 1.1s local, cloud log timestamps show fast execution too: Start .060 -> Found .282 (222ms!). 
            // So DB is SUPER FAST. The "Silence" was purely the 400 Error crashing the function or LINE ignoring the invalid reply.
            // I will revert to standard async/await for cleanliness, or keep race for safety. 
            // Let's keep it simple standard await.

            const { data: campaign, error } = await supabase
                .from('campaigns')
                .select('id, name, image_url, secret_codes, status')
                .contains('secret_codes', [text])
                .or('status.eq.ACTIVE,status.eq.active')
                .maybeSingle();

            if (error) {
                console.error("[Pa-Kao] DB Error:", error);
                if (text === 'ป้าขาว' || text === 'PAKAO') {
                    await replyMessage(event.replyToken!, {
                        type: 'text',
                        text: `⚠️ Database Error: ${error.message}\nCode: ${error.code}`
                    });
                    return;
                }
            }

            if (campaign) {
                console.log(`[Pa-Kao] Match found: ${campaign.name}`);

                // Send "Secret Discovered" Flex
                const flexMsg = buildCouponFlex(
                    campaign.id,
                    text,
                    campaign.name,
                    campaign.description || 'สิทธิ์พิเศษสำหรับคนรู้รหัสลับ!',
                    campaign.image_url,
                    userId // [NEW] Pass UserID to Flex
                );
                await replyMessage(event.replyToken!, flexMsg);

                // Log Stat
                logStat({
                    user_id: userId,
                    source_type: 'user',
                    event_type: 'message',
                    action: 'secret_code_triggered',
                    label: text, // The keyword used
                    extra_json: { campaign_id: campaign.id }
                }).catch(err => console.error('Log error:', err));

                return;
            } else {
                // Not found
                if (text === 'ป้าขาว' || text === 'PAKAO') {
                    await replyMessage(event.replyToken!, {
                        type: 'text',
                        text: `❌ ไม่พบข้อมูลแคมเปญ (Not Found)\nkeyword: "${text}"\n(ตรวจสอบว่า Status=ACTIVE และ secret_codes ถูกต้อง)`
                    });
                    return;
                }
            }
        } // end if text check
    } catch (err: any) {
        console.error("Pa-Kao Flow Crash:", err);
        await replyMessage(event.replyToken!, {
            type: 'text',
            text: `🔥 System Error during Pa-Kao check: ${err.message}\nStack: ${err.stack}`
        });
        return; // Stop further processing if crashed
    }

    // [NEW] Silent Promo Detection during Regular Flow
    if (userState?.is_regular_flow && text && text.length >= 4 && text.length <= 15) {
        const validation = await validateManualPromoCode(text);
        if (validation.valid && validation.code) {
            await saveUserState(userId, { manual_promo_code: validation.code.code });
            await replyMessage(event.replyToken!, {
                type: 'text',
                text: `✨ รหัสลับถูกต้อง! คุณได้รับส่วนลดเรียบร้อยครับ\n(รหัสจะถูกนำไปใช้อัตโนมัติในขั้นตอนสรุปรายการครับ)`
            });

            // If user is at summary step or has enough info, re-show summary with updated price
            if (userState.regular_start_date && userState.regular_end_date && userState.regular_day && userState.time_from && userState.duration_h && userState.regular_field_id !== undefined) {
                await showRegularBookingSummary(event, userId);
            }
            return;
        }
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

// === Image Handler (Payment Slip) ===
export async function handleImage(event: LineEvent) {
    const userId = event.source.userId;
    const messageId = event.message!.id;

    console.log(`[Handle Image] User: ${userId}, MessageId: ${messageId}`);

    try {
        // 1. Check for the most recent pending_payment booking for this user
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending_payment')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (bookingError) throw bookingError;

        if (!booking) {
            console.log(`[Handle Image] No pending booking found for user ${userId}. Skipping slip verification.`);
            // Optional: Notify user or just ignore if it's just a random photo
            return;
        }

        // 2. Inform user we are processing
        await replyMessage(event.replyToken!, { type: 'text', text: 'กำลังตรวจสอบสลิปมัดจำสักครู่นะคะ... ⏳' });

        // 3. Fetch Image from LINE
        const imageBytes = await getMessageContent(messageId);
        if (!imageBytes) throw new Error("Failed to fetch image from LINE");

        // 4. Verify Slip (Mock)
        const verification = await verifySlip(imageBytes, 200);
        if (!verification.success) {
            await pushMessage(userId, { type: 'text', text: `❌ ตรวจสอบสลิปไม่สำเร็จ: ${verification.message}\nรบกวนตรวจสอบอีกครั้งหรือติดต่อแอดมินนะคะ` });
            return;
        }

        // 5. Upload to Supabase Storage
        const fileName = `${booking.booking_id}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment-slips')
            .upload(fileName, imageBytes, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('payment-slips')
            .getPublicUrl(fileName);

        // 6. Update Booking
        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                status: 'confirmed',
                payment_status: 'paid',
                payment_slip_url: publicUrl,
                admin_note: (booking.admin_note ? booking.admin_note + ' | ' : '') + `[Slip Verified: ${verification.message}]`,
                updated_at: new Date().toISOString()
            })
            .eq('booking_id', booking.booking_id);

        if (updateError) throw updateError;

        // 7. Success Notification
        await pushMessage(userId, {
            type: 'text',
            text: `✅ ตรวจสอบสลิปมัดจำ 200 บาท เรียบร้อยแล้วค่ะ!\n\nยืนยันการจองสนามเรียบร้อย พบกันที่สนามตามเวลานัดหมายนะคะ 🙏⚽`
        });

        console.log(`[Handle Image] Booking ${booking.booking_id} confirmed via slip.`);

    } catch (err: any) {
        console.error('[Handle Image Error]:', err.message);
        await pushMessage(userId, { type: 'text', text: `⚠️ เกิดข้อผิดพลาดในการตรวจสอบสลิป: ${err.message}` });
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
        case 'collectCoupon':
            await handleCollectCoupon(event, userId, params);
            break;
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

        // [NEW] Regular Booking Actions
        case 'setRegularStartDate':
            await handleSetRegularStartDate(event, userId, params);
            break;
        case 'setRegularEndDate':
            await handleSetRegularEndDate(event, userId, params);
            break;
        case 'setRegularDay':
            await handleSetRegularDay(event, userId, params);
            break;
        case 'regularSelectTime':
            await handleRegularSelectTime(event, userId, params);
            break;
        case 'regularSelectDuration':
            await handleRegularSelectDuration(event, userId, params);
            break;
        case 'regularSelectField': // [NEW]
            await handleRegularSelectField(event, userId, params);
            break;
        case 'regularInputCode':
            await handleRegularInputCode(event, userId, params);
            break;
        case 'confirmRegularBooking':
            await handleConfirmRegularBooking(event, userId, params);
            break;
        default:
            console.warn("Unknown Action:", action);
    }
}

// --- Coupon Collection Handler ---

async function handleCollectCoupon(event: LineEvent, userId: string, params: any) {
    const campaignId = params.campaignId;
    const secretCode = params.secretCode;

    console.log(`[Collect Coupon] User: ${userId}, Campaign: ${campaignId}, Code: ${secretCode}`);

    try {
        // Direct database access instead of calling API (to bypass JWT auth)
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? '';
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch campaign details
        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campaignError || !campaign) {
            throw new Error('Campaign not found');
        }

        // 2. Validate campaign status
        const now = new Date();
        const campaignStatus = (campaign.status || '').toString().trim().toUpperCase();
        if (campaignStatus !== 'ACTIVE') {
            throw new Error('Campaign is not active');
        }
        if (campaign.start_date && now < new Date(campaign.start_date)) {
            throw new Error('Campaign has not started yet');
        }
        if (campaign.end_date && now > new Date(campaign.end_date)) {
            throw new Error('Campaign has ended');
        }

        // 3. Check user quota
        const { count: userCount, error: countError } = await supabase
            .from('user_coupons')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('campaign_id', campaignId);

        if (countError) throw countError;

        if (userCount !== null && userCount >= (campaign.limit_per_user || 1)) {
            throw new Error('You have already collected this coupon');
        }

        // 4. Calculate expiry date (same logic as collect-coupon function)
        let expiresAt = campaign.end_date; // Default to campaign end
        if (campaign.duration_days) {
            const dynamicExpiry = new Date(now.getTime() + (campaign.duration_days * 24 * 60 * 60 * 1000));
            // Cap at campaign end_date if exists
            if (campaign.end_date && dynamicExpiry > new Date(campaign.end_date)) {
                expiresAt = campaign.end_date;
            } else {
                expiresAt = dynamicExpiry.toISOString();
            }
        }

        // 5. Insert user coupon
        const { data: newCoupon, error: insertError } = await supabase
            .from('user_coupons')
            .insert({
                user_id: userId,
                campaign_id: campaignId,
                status: 'ACTIVE',
                expires_at: expiresAt
            })
            .select()
            .single();

        if (insertError) throw insertError;

        console.log(`[Coupon Collected] ID: ${newCoupon.id}`);

        // Success - send confirmation message
        await replyMessage(event.replyToken!, {
            type: 'text',
            text: `🎉 เก็บคูปองสำเร็จแล้ว!\n\n${campaign.name}\n\n✅ เก็บเข้ากระเป๋าเรียบร้อย\n💰 ใช้ได้ทันทีเมื่อจองสนาม!`
        });

        // Log success
        logStat({
            user_id: userId,
            source_type: 'user',
            event_type: 'coupon_collected',
            action: 'postback_collect',
            label: secretCode,
            extra_json: { campaign_id: campaignId, method: 'postback' }
        }).catch(err => console.error('Log error:', err));

    } catch (error: any) {
        console.error('[Collect Coupon Error]:', error);
        await replyMessage(event.replyToken!, {
            type: 'text',
            text: `❌ ไม่สามารถเก็บคูปองได้\n\n${error.message}\n\nลองอีกครั้งหรือติดต่อแอดมินนะคะ 🙏`
        });
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

// =====================================================
// Regular Booking Handlers (VIP)
// =====================================================

async function handleSetRegularStartDate(event: LineEvent, userId: string, params: any) {
    const dateStr = event.postback?.params?.date;
    if (!dateStr) return;

    await saveUserState(userId, { regular_start_date: dateStr, step: 'regular_end_date' });

    await replyMessage(event.replyToken!, {
        type: "flex",
        altText: "เลือกวันสิ้นสุด",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    { type: "text", text: "🏁 เลือกวันสิ้นสุด", weight: "bold", size: "lg" },
                    { type: "text", text: `เริ่ม: ${dateStr}`, size: "sm", color: "#666666" },
                    {
                        type: "button",
                        style: "primary",
                        action: {
                            type: "datetimepicker",
                            label: "เลือกวันสิ้นสุด",
                            data: "action=setRegularEndDate",
                            mode: "date",
                            min: dateStr,
                            max: "2026-12-31"
                        }
                    }
                ]
            }
        }
    });
}

async function handleSetRegularEndDate(event: LineEvent, userId: string, params: any) {
    const dateStr = event.postback?.params?.date;
    if (!dateStr) return;

    await saveUserState(userId, { regular_end_date: dateStr, step: 'regular_select_day' });

    // Ask for Day of Week
    const days = [
        { label: "ทุกวันจันทร์", val: "Mon" },
        { label: "ทุกวันอังคาร", val: "Tue" },
        { label: "ทุกวันพุธ", val: "Wed" },
        { label: "ทุกวันพฤหัส", val: "Thu" },
        { label: "ทุกวันศุกร์", val: "Fri" },
        { label: "ทุกวันเสาร์", val: "Sat" },
        { label: "ทุกวันอาทิตย์", val: "Sun" },
    ];

    const buttons = days.map(d => ({
        type: "button",
        style: "secondary",
        action: postbackAction(d.label, `action=setRegularDay&day=${d.val}`)
    }));

    // Split into 2 rows logic if needed, or just list
    await replyMessage(event.replyToken!, {
        type: "flex",
        altText: "เลือกวันในสัปดาห์",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    { type: "text", text: "📅 เลือกวันเล่นประจำ", weight: "bold", size: "lg" },
                    { type: "separator", margin: "md" },
                    { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: buttons }
                ]
            }
        }
    });
}

async function handleSetRegularDay(event: LineEvent, userId: string, params: any) {
    const day = params.day;
    await saveUserState(userId, { regular_day: day, step: 'regular_select_time' });

    // Reuse Time Picker but with different action
    const timeSlots = [
        { label: "16:00 - 18:00", times: ["16:00", "16:30", "17:00", "17:30"] },
        { label: "18:00 - 20:00", times: ["18:00", "18:30", "19:00", "19:30"] },
        { label: "20:00 - 22:00", times: ["20:00", "20:30", "21:00", "21:30"] },
        { label: "22:00 - 24:00", times: ["22:00", "22:30", "23:00", "23:30"] },
    ];

    const bubbles = timeSlots.map(slot => ({
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
                        action: postbackAction(t, `action=regularSelectTime&time_from=${t}`)
                    }))
                }
            ]
        }
    }));

    await replyMessage(event.replyToken!, {
        type: "flex",
        altText: "เลือกเวลา",
        contents: { type: "carousel", contents: bubbles }
    });
}

async function handleRegularSelectTime(event: LineEvent, userId: string, params: any) {
    const timeFrom = params.time_from;
    await saveUserState(userId, { time_from: timeFrom, step: 'regular_select_duration' });

    // Reuse Duration Picker
    await replyMessage(event.replyToken!, {
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
                            { type: "button", style: "secondary", action: postbackAction("1 ชม.", "action=regularSelectDuration&duration_h=1") },
                            { type: "button", style: "secondary", action: postbackAction("1.5 ชม.", "action=regularSelectDuration&duration_h=1.5") },
                            { type: "button", style: "secondary", action: postbackAction("2 ชม.", "action=regularSelectDuration&duration_h=2") },
                        ]
                    }
                ]
            }
        }
    });
}

async function handleRegularSelectDuration(event: LineEvent, userId: string, params: any) {
    const dur = parseFloat(params.duration_h);

    // Save state
    await saveUserState(userId, { duration_h: dur, step: 'regular_select_field' });

    // Fetch Active Fields
    const fields = await getActiveFields();

    // Create Field Buttons
    const buttons = (fields || []).map((f: any) => ({
        type: "button",
        style: "secondary",
        action: postbackAction(`${f.label} (${f.type})`, `action=regularSelectField&field_id=${f.id}`)
    }));

    // Add "Any Field" option
    buttons.push({
        type: "button",
        style: "primary",
        action: postbackAction("⚡ สนามไหนก็ได้ (ว่าง)", `action=regularSelectField&field_id=0`)
    });

    // Show Field Selection
    await replyMessage(event.replyToken!, {
        type: "flex",
        altText: "เลือกสนาม",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    { type: "text", text: "🏟️ เลือกสนามที่ต้องการ", weight: "bold", size: "lg" },
                    { type: "text", text: "ระบุสนามที่ต้องการจองประจำ", size: "sm", color: "#666666" },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        margin: "md",
                        contents: buttons
                    }
                ]
            }
        }
    });
}

async function handleRegularSelectField(event: LineEvent, userId: string, params: any) {
    const fieldId = parseInt(params.field_id);
    await saveUserState(userId, { regular_field_id: fieldId }); // 0 = Any
    await showRegularBookingSummary(event, userId);
}

async function handleRegularInputCode(event: LineEvent, userId: string, params: any) {
    // Ask user to type code
    // Ideally we use a Text Message response, but since we are in postback, we can ask user to type.
    // Or simpler: Just reply with "พิมพ์โค้ดมาได้เลยครับ (ขึ้นต้นด้วย #)" -> Handler checks for # prefix?
    // Actually, user requirement says "Option to input 'Secret Promo Code'".
    // Let's use a workaround: Force user to type existing secret code logic?
    // NO, Manual Promo Codes are different table.
    // Let's listen for text input starting with "VIP:" or something?
    // User might just type the code.
    // Let's prompt: "กรุณาพิมพ์รหัสโค้ดลับ (เช่น VIP100) ตอบกลับมาได้เลยครับ"
    // And in handleMessage, check if userState.step == 'regular_input_code'.

    await saveUserState(userId, { step: 'regular_input_code' });

    await replyMessage(event.replyToken!, {
        type: 'text',
        text: '⌨️ กรุณาพิมพ์ "รหัสโค้ดลับ" ที่ได้รับจากแอดมิน ตอบกลับมาได้เลยครับ'
    });
}

// Need to update handleMessage to catch Current Step 'regular_input_code'
// But wait, handleMessage is at top. I should have added that logic there.
// I will just use a hack: Check if input looks like a code in general handleMessage? 
// Or update handleMessage later.
// For now, let's assume I missed that part in handleMessage.
// I should include it in this multi_replace.
// I'll add handleMessage logic in a separate chunk or modify the previous chunk.
// I'll stick to this flow. I will add the logic to handleMessage in a separate call or check if I can add it now.
// I used `EndLine: 216` for handleMessage modification. I can start a new chunk for handleMessage logic.

async function showRegularBookingSummary(event: LineEvent, userId: string, promoCodeStr?: string) {
    const state = await getUserState(userId);
    const { regular_start_date, regular_end_date, regular_day, time_from, duration_h, manual_promo_code, regular_field_id } = state;

    // If promoCodeStr passed, validate it
    let promoData = null;
    let validCodeStr = manual_promo_code; // Start with existing

    if (promoCodeStr) {
        // Validate
        const validation = await validateManualPromoCode(promoCodeStr);
        if (validation.valid && validation.code) {
            validCodeStr = validation.code.code;
            await saveUserState(userId, { manual_promo_code: validCodeStr });
        } else {
            // Invalid
            await replyMessage(event.replyToken!, { type: 'text', text: `❌ รหัสไม่ถูกต้อง: ${validation.reason}` });
            return;
        }
    }

    // Search Slots
    const results = await searchRegularBookingSlots(
        regular_start_date!,
        regular_end_date!,
        regular_day!,
        time_from!,
        duration_h!,
        regular_field_id && regular_field_id > 0 ? regular_field_id : undefined // [NEW] Pass specific field
    );

    // Calculate Price
    // Price = Field Price * duration * count
    // But which field?
    // Assume standard fields have same price? Usually yes or we pick Field 1 for reference.
    // Let's get price from field 1 (7-a-side) or 6 (5-a-side)?
    // Requirement didn't start Field Type.
    // Let's assume Field 1 (Standard).
    // Or better, calculatePrice(fieldId, ...)
    // Does searchRegularBookingSlots return fieldIds? Yes.
    // We can use the first available field ID to calculate price for that day.

    let totalPrice = 0;

    // Fetch base price for time/duration (assuming all fields same price or we pick one)
    const refFieldId = 1; // Default
    const basePrice = await calculatePrice(refFieldId, time_from!, duration_h!);

    let totalDiscount = 0;

    if (validCodeStr) {
        const validation = await validateManualPromoCode(validCodeStr);
        if (validation.valid && validation.code) {
            promoData = validation.code;
        }
    }

    let finalPrice = 0;

    // Process results to include prices
    const resultsWithPrice = results.map(res => {
        let dailyPrice = basePrice;
        if (res.available) {
            if (promoData) {
                const { discount, finalPrice: fp } = applyManualDiscount(dailyPrice, promoData as any);
                // We don't sum here yet to avoid double counting if map runs multiple times? No, map runs once.
                // But wait, the loop below sums it up.
                // Actually let's do calculation here.
                dailyPrice = fp;
            }
        }
        return {
            ...res,
            price: res.available ? dailyPrice : 0
        };
    });

    // Calculate Totals
    let calculatedTotalPrice = 0;

    for (const res of resultsWithPrice) {
        if (res.available) {
            calculatedTotalPrice += basePrice;
            if (promoData) {
                const { discount, finalPrice: fp } = applyManualDiscount(basePrice, promoData as any);
                totalDiscount += discount;
                finalPrice += fp;
            } else {
                finalPrice += basePrice;
            }
        }
    }

    const summaryFlex = buildRegularBookingSummaryFlex({
        startDate: regular_start_date!,
        endDate: regular_end_date!,
        targetDay: regular_day!,
        time: time_from!,
        duration: duration_h!,
        slots: resultsWithPrice, // Pass extended slots
        price: calculatedTotalPrice,
        promoCode: promoData ? {
            code: promoData.code,
            discount_amount: totalDiscount,
            final_price: finalPrice
        } : null
    });

    await replyMessage(event.replyToken!, summaryFlex);

    // Set step to summary to track current state
    await saveUserState(userId, { step: 'regular_summary' });
}

async function handleConfirmRegularBooking(event: LineEvent, userId: string, params: any) {
    const state = await getUserState(userId);
    const { regular_start_date, regular_end_date, regular_day, time_from, duration_h, manual_promo_code, regular_field_id } = state;

    await replyMessage(event.replyToken!, { type: 'text', text: '⏳ กำลังบันทึกการจอง กรุณารอสักครู่...' });

    // Re-verify availability
    const results = await searchRegularBookingSlots(regular_start_date!, regular_end_date!, regular_day!, time_from!, duration_h!, regular_field_id && regular_field_id > 0 ? regular_field_id : undefined);

    // Filter available
    const availableSlots = results.filter(s => s.available);

    if (availableSlots.length === 0) {
        await pushMessage(userId, { type: 'text', text: '❌ ขออภัย ช่วงเวลาที่เลือกเต็มหมดแล้วครับ' });
        return;
    }

    // Create Bookings
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? '';
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let successCount = 0;
    const durationMin = duration_h! * 60;
    const timeTo = addMinutesToTime(time_from!, durationMin).substring(0, 5);

    // Get Promo Data
    let promoData = null;
    if (manual_promo_code) {
        const val = await validateManualPromoCode(manual_promo_code);
        if (val.valid) promoData = val.code;
    }

    // [FIX] Fetch Profile for Name/Phone
    const profile = await getProfile(userId);
    const displayName = profile?.team_name || 'VIP Member';
    const phoneNumber = profile?.phone_number || '';

    const basePrice = await calculatePrice(1, time_from!, duration_h!);

    for (const slot of availableSlots) {
        // Pick first available field
        const fieldId = slot.availableFieldIds[0];

        // Calculate price with promo
        let price = basePrice;

        if (promoData) {
            const { finalPrice } = applyManualDiscount(basePrice, promoData as any);
            price = finalPrice;
        }

        const { error } = await supabaseAdmin
            .from('bookings')
            .insert({
                user_id: userId,
                booking_id: Date.now().toString() + '_' + Math.floor(Math.random() * 1000),
                field_no: fieldId,
                date: slot.date,
                time_from: time_from,
                time_to: timeTo,
                duration_h: duration_h,
                price_total_thb: price,
                status: 'confirmed', // Confirmed immediately (VIP)
                payment_status: 'pending', // Pay at field
                payment_method: 'cash',
                display_name: displayName,
                phone_number: phoneNumber,
                source: 'line_bot_regular',
                admin_note: Deno.env.get('VITE_ADMIN_NOTE_PREFIX') ? `${Deno.env.get('VITE_ADMIN_NOTE_PREFIX')} Regular Booking` : 'Regular Booking VIP',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error(`[RegularBooking] Failed to insert ${slot.date}:`, error);
        } else {
            successCount++;
        }
    }

    await pushMessage(userId, {
        type: 'text',
        text: `✅ จองสำเร็จ ${successCount} รายการ!\nรวมเป็นเงินทั้งสิ้น ${(successCount * (promoData ? applyManualDiscount(basePrice, promoData as any).finalPrice : basePrice)).toLocaleString()} บาท\n\nกรุณามาให้ตรงเวลา หากต้องการเลื่อนโปรดแจ้งแอดมินล่วงหน้า`
    });

    await clearUserState(userId);
}
