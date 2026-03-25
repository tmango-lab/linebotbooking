import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getLiffUser } from '../lib/liff';
import { formatDate } from '../utils/date';
import { useFieldsQuery } from './useFieldsQuery';
import { useBookingsQuery } from './useBookingsQuery';
import { useCouponsQuery } from './useCouponsQuery';
import { queryClient } from '../providers/QueryProvider';

export interface Field {
    id: number;
    name: string;
    type: string;
    price_pre: number;
    price_post: number;
}

export interface Coupon {
    id: string;
    campaign_id: number;
    name: string;
    discount_type: 'FIXED' | 'PERCENT';
    discount_value: number;
    min_spend: number;
    eligible_fields: number[] | null;
    eligible_days: string[] | null;
    valid_time_start: string | null;
    valid_time_end: string | null;
    eligible_payments: string[] | null;
    category: 'MAIN' | 'ONTOP';
    expiry: string; // [NEW] For Date Check
    allow_ontop_stacking?: boolean; // [NEW] Stacking Rules
}

export interface UserProfile {
    user_id: string;
    team_name: string;
    phone_number: string;
    role?: string;
}

export const useBookingLogic = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // User identity state (must be resolved before queries run)
    const [userId, setUserId] = useState<string | null>(searchParams.get('userId'));
    const [userIdentified, setUserIdentified] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Selection State
    const [selection, setSelection] = useState<{
        fieldId: number;
        startTime: string;
        endTime: string;
    } | null>(null);
    const [isCouponSheetOpen, setIsCouponSheetOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // [MODIFIED] Separate coupons
    const [manualMainCoupon, setManualMainCoupon] = useState<Coupon | null>(null);
    const [manualOntopCoupon, setManualOntopCoupon] = useState<Coupon | null>(null);

    // Calculated State
    const [originalPrice, setOriginalPrice] = useState(0);
    const [bestCoupon] = useState<Coupon | null>(null); // Kept for legacy compatibility if needed, but logic will change
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Date State
    const todayStr = new Date().toISOString().split('T')[0];
    const urlDate = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState<string>(urlDate || todayStr);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);

    // [FLASH DEAL] URL Params for pre-selecting field + time
    const urlFieldId = searchParams.get('fieldId') ? Number(searchParams.get('fieldId')) : null;
    const urlStartTime = searchParams.get('startTime');
    const urlEndTime = searchParams.get('endTime');

    // [FLASH DEAL] Force payment method from URL (e.g. forcePayment=QR)
    const urlForcePayment = searchParams.get('forcePayment'); // 'QR' | 'CASH' | null

    // --- React Query Hooks ---
    const fieldsQuery = useFieldsQuery();
    const bookingsQuery = useBookingsQuery(selectedDate);
    const couponsQuery = useCouponsQuery(userIdentified ? userId : null);

    // Derive data from queries (with empty fallbacks so downstream logic never breaks)
    const fields = fieldsQuery.data ?? [];
    const existingBookings = bookingsQuery.data ?? [];
    const couponsData = couponsQuery.data;
    const coupons: Coupon[] = [
        ...(couponsData?.main ?? []),
        ...(couponsData?.on_top ?? []),
    ];

    // isReady = user identified + all queries done loading
    const isReady =
        userIdentified &&
        !fieldsQuery.isLoading &&
        !bookingsQuery.isLoading &&
        (userId ? !couponsQuery.isLoading : true);

    // [REFERRAL] Referral code from URL
    // [REFERRAL] Referral code from URL
    const [referralCode, setReferralCode] = useState<string | null>(searchParams.get('ref'));
    const [referralDiscount, setReferralDiscount] = useState<number>(0); // e.g. 50 = 50%
    const [referralValid, setReferralValid] = useState<boolean>(false);
    const [referralError, setReferralError] = useState<string | null>(null); // [NEW] Error state
    const [referralRequireTermConsent, setReferralRequireTermConsent] = useState<boolean>(false);
    const [referralTermConsentMessage, setReferralTermConsentMessage] = useState<string | null>(null);
    const getThaiDateString = (dateStr?: string) => {
        return formatDate(dateStr || new Date());
    };

    const getThaiDateShort = (dateStr: string) => {
        const dObj = new Date(dateStr);
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        if (isToday) return `วันนี้, ${dObj.getDate()} ${months[dObj.getMonth()]}`;
        return `${days[dObj.getDay()]}, ${dObj.getDate()} ${months[dObj.getMonth()]}`;
    };

    // --- 1. Identify User (LIFF Login) ---
    useEffect(() => {
        const identifyUser = async () => {
            setErrorMsg(null);
            const liffUser = await getLiffUser({ requireLogin: true });

            if (liffUser.isLoggingIn) {
                // Redirecting to LINE Login — stay on loading screen
                return;
            }

            const currentUserId = liffUser.userId || userId;

            if (!currentUserId) {
                setErrorMsg('ไม่พบข้อมูลผู้ใช้งาน (User ID Missing). กรุณาเปิดผ่าน LINE อีกครั้ง');
                setUserIdentified(true); // Mark as done so isReady can resolve
                return;
            }

            setUserId(currentUserId);
            setUserIdentified(true);
        };
        identifyUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- 2. Post-load derived effects (run after all queries resolve) ---
    // Sync userProfile from coupons result
    useEffect(() => {
        if (couponsData?.profile) {
            setUserProfile(couponsData.profile);
        }
    }, [couponsData]);

    // Auto-select coupon from URL (once coupons are available)
    useEffect(() => {
        if (!coupons.length) return;
        const urlCouponId = searchParams.get('couponId');
        if (urlCouponId) {
            const target = coupons.find(c => c.id === urlCouponId);
            if (target) {
                if (target.category === 'ONTOP') setManualOntopCoupon(target as Coupon);
                else setManualMainCoupon(target as Coupon);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [couponsQuery.dataUpdatedAt]);

    // Auto-select flash deal slot from URL (once bookings are available)
    useEffect(() => {
        if (!existingBookings.length || !fields.length) return;
        if (!urlFieldId || !urlStartTime || !urlEndTime) return;

        const fieldExists = fields.some(f => f.id === urlFieldId);
        if (!fieldExists) return;

        const isOccupied = existingBookings.some((b: any) => {
            if (b.status === 'CANCELLED') return false;
            if (Number(b.court_id) !== urlFieldId) return false;
            const rawStart = b.time_start || b.start_time || '';
            const rawEnd = b.time_end || b.end_time || '';
            if (!rawStart || !rawEnd) return false;
            const bStart = rawStart.includes(' ') ? rawStart.split(' ')[1].substring(0, 5) : rawStart.substring(0, 5);
            const bEnd = rawEnd.includes(' ') ? rawEnd.split(' ')[1].substring(0, 5) : rawEnd.substring(0, 5);
            return urlStartTime < bEnd && urlEndTime > bStart;
        });

        if (!isOccupied) {
            setSelection({ fieldId: urlFieldId, startTime: urlStartTime, endTime: urlEndTime });
            console.log(`[Flash Deal] Auto-selected: Field ${urlFieldId} | ${urlStartTime}-${urlEndTime}`);
        } else {
            console.warn('[Flash Deal] Auto-select failed: Slot is already occupied.');
            setErrorMsg('รอบที่คุณเลือกจากลิงก์ถูกจองไปแล้ว กรุณาเลือกรอบเวลาอื่น');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookingsQuery.dataUpdatedAt, fieldsQuery.dataUpdatedAt]);

    // Auto-collect promo code from URL (once user is identified)
    useEffect(() => {
        const urlPromoCode = searchParams.get('promoCode');
        if (!urlPromoCode || !userId) return;

        const doPromoCollect = async () => {
            console.log(`[Flash Deal] Auto-collecting promo code: ${urlPromoCode}`);
            try {
                const collectRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect-coupon`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                    body: JSON.stringify({ userId, secretCode: urlPromoCode })
                });
                const collectData = await collectRes.json();
                if (collectData.success && collectData.data) {
                    console.log(`[Flash Deal] Coupon collected: ${collectData.data.id}`);
                    // Invalidate coupon cache so React Query re-fetches fresh data
                    queryClient.invalidateQueries({ queryKey: ['coupons', userId] });
                } else {
                    console.warn(`[Flash Deal] Could not collect promo: ${collectData.error}`);
                }
            } catch (promoErr: any) {
                console.warn(`[Flash Deal] Promo collect error: ${promoErr.message}`);
            }
        };
        doPromoCollect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Validate referral code from URL (once user is identified)
    useEffect(() => {
        const refCode = searchParams.get('ref');
        if (!refCode || !userId) return;

        const validateRef = async () => {
            try {
                const refRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-referral`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                    body: JSON.stringify({ referralCode: refCode, userId })
                });
                const refData = await refRes.json();

                if (refRes.ok && refData.valid) {
                    setReferralCode(refCode);
                    const discountPct = refData.program?.discountPercent || 50;
                    setReferralDiscount(discountPct);
                    setReferralRequireTermConsent(refData.program?.require_term_consent || false);
                    setReferralTermConsentMessage(refData.program?.term_consent_message || null);
                    setReferralValid(true);
                    setReferralError(null);

                    const referralCoupon: Coupon = {
                        id: 'REFERRAL-' + refCode,
                        campaign_id: 0,
                        name: `ส่วนลดแนะนำเพื่อน (${discountPct}%)`,
                        discount_type: 'PERCENT',
                        discount_value: discountPct,
                        min_spend: 0,
                        eligible_fields: null,
                        eligible_days: null,
                        valid_time_start: null,
                        valid_time_end: null,
                        eligible_payments: refData.program?.allowed_payment_methods || null,
                        category: 'MAIN',
                        expiry: '',
                        allow_ontop_stacking: refData.program?.allow_ontop_stacking ?? true
                    };
                    setManualMainCoupon(referralCoupon);
                } else {
                    setReferralCode(null);
                    const errMsg = refData.error || 'Code invalid';
                    console.warn('[Referral] Invalid code:', errMsg);
                    setReferralError(errMsg);
                }
            } catch (refErr: any) {
                console.error('[Referral] Validation error:', refErr);
                setReferralCode(null);
                setReferralError(refErr.message || 'Validation Error');
            }
        };
        validateRef();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // --- 2. Calculate Price ---
    useEffect(() => {
        if (!selection || fields.length === 0) {
            setOriginalPrice(0);
            return;
        }

        const field = fields.find(f => f.id === selection.fieldId);
        if (!field) return;

        const startH = parseFloat(selection.startTime.split(':')[0]) + parseFloat(selection.startTime.split(':')[1]) / 60;
        const endH = parseFloat(selection.endTime.split(':')[0]) + parseFloat(selection.endTime.split(':')[1]) / 60;
        let duration = endH - startH;
        if (duration < 0) duration += 24;

        const cutOff = 18.0;
        const startDec = startH;
        const endDec = startH + duration;

        let preHours = 0;
        let postHours = 0;

        if (endDec <= cutOff) {
            preHours = duration;
        } else if (startDec >= cutOff) {
            postHours = duration;
        } else {
            preHours = cutOff - startDec;
            postHours = endDec - cutOff;
        }

        const costPre = Math.ceil((preHours * field.price_pre) / 100) * 100;
        const costPost = Math.ceil((postHours * field.price_post) / 100) * 100;
        setOriginalPrice(costPre + costPost);

    }, [selection, fields]);

    // --- 3. Auto-Coupon Logic (Simplified for now: Just validate manual selection) ---
    // In a real scenario, we might want to auto-select the best combination.
    // For now, let's trust manual selection or just pick best Main if none selected.

    const appliedMain = manualMainCoupon;
    const appliedOntop = manualOntopCoupon;

    // Helper: Centralized Validation Logic — returns null if valid, or a reason string
    const validateCoupon = (coupon: Coupon | null, priceToCheck: number): string | null => {
        if (!coupon) return 'ไม่มีคูปอง';

        // 1. Min Spend
        if (coupon.min_spend && priceToCheck < coupon.min_spend) return `ยอดขั้นต่ำ ฿${coupon.min_spend}`;

        // 2. Eligible Fields
        if (coupon.eligible_fields && coupon.eligible_fields.length > 0) {
            if (!selection || !coupon.eligible_fields.includes(selection.fieldId)) return 'สนามไม่ร่วมรายการ';
        }

        // 3. Eligible Days
        if (coupon.eligible_days && coupon.eligible_days.length > 0) {
            const d = new Date(selectedDate);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDay = dayNames[d.getDay()];
            if (!coupon.eligible_days.includes(currentDay)) return 'ไม่ใช่วันที่ใช้งานได้';
        }

        // 4. Valid Time Range
        if (selection) {
            const getHM = (t: string) => t.substring(0, 5);
            const selStart = getHM(selection.startTime);
            if (coupon.valid_time_start && selStart < getHM(coupon.valid_time_start)) return `ใช้ได้ตั้งแต่ ${getHM(coupon.valid_time_start)} น.`;
            if (coupon.valid_time_end && selStart > getHM(coupon.valid_time_end)) return `ใช้ได้ถึง ${getHM(coupon.valid_time_end)} น.`;
        }

        // 5. Expiry Date (Booking Date vs Coupon Expiry)
        if (coupon.expiry) {
            const bookingDate = new Date(selectedDate);
            const expiryDate = new Date(coupon.expiry);
            bookingDate.setHours(0, 0, 0, 0);
            expiryDate.setHours(0, 0, 0, 0);
            if (bookingDate > expiryDate) return 'คูปองหมดอายุ';
        }

        return null; // Valid!
    };

    // Validate Main
    const mainInvalidReason = validateCoupon(appliedMain, originalPrice);
    const isMainValid = mainInvalidReason === null;

    // Calculate Price after Main
    let priceAfterMain = originalPrice;
    let mainDiscount = 0;
    if (isMainValid && appliedMain) {
        if (appliedMain.discount_type === 'FIXED') mainDiscount = appliedMain.discount_value;
        else mainDiscount = (originalPrice * appliedMain.discount_value) / 100;
        priceAfterMain = Math.max(0, originalPrice - mainDiscount);
    }

    // Validate On-top
    const ontopInvalidReason = validateCoupon(appliedOntop, priceAfterMain);
    const isOntopValid = ontopInvalidReason === null;

    // Calculate On-top Discount (Applied on Price After Main?)
    // Usually On-top is applied on the *remaining* price or the *full* price depending on business logic. 
    // Plan said: "Price after Main Coupon -> Apply On-top Coupon".
    let ontopDiscount = 0;
    if (isOntopValid && appliedOntop) {
        if (appliedOntop.discount_type === 'FIXED') ontopDiscount = appliedOntop.discount_value;
        else ontopDiscount = (priceAfterMain * appliedOntop.discount_value) / 100;
    }

    const totalDiscount = mainDiscount + ontopDiscount;
    const finalPrice = Math.max(0, originalPrice - totalDiscount);
    const appliedCoupon = appliedMain || appliedOntop;

    // Calculate Combined Eligible Payments (Intersection)
    let allowedPaymentMethods: string[] | null = null;

    const combinePayments = (existing: string[] | null, newMethods: string[] | null) => {
        if (!existing) return newMethods; // First constraint
        if (!newMethods) return existing; // No new constraint
        // Intersection
        return existing.filter(m => newMethods.includes(m));
    };

    if (appliedMain?.eligible_payments && appliedMain.eligible_payments.length > 0) {
        allowedPaymentMethods = appliedMain.eligible_payments;
    }
    if (appliedOntop?.eligible_payments && appliedOntop.eligible_payments.length > 0) {
        allowedPaymentMethods = combinePayments(allowedPaymentMethods, appliedOntop.eligible_payments);
    }

    const handleFinalConfirm = async (team: string, phone: string, payment: string) => {
        const forwardMap: Record<number, number> = {
            1: 2424, 2: 2425, 3: 2428, 4: 2426, 5: 2427, 6: 2429
        };

        const fieldId = forwardMap[selection!.fieldId] || selection!.fieldId;
        const selectedField = fields.find(f => f.id === selection?.fieldId);

        try {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    userId,
                    fieldId,
                    date: selectedDate,
                    startTime: selection!.startTime,
                    endTime: selection!.endTime,
                    customerName: team,
                    phoneNumber: phone,
                    couponIds: [appliedMain?.id, appliedOntop?.id]
                        .filter(id => id && !id.toString().startsWith('REFERRAL-')),
                    paymentMethod: payment,
                    ...(referralValid && referralCode ? { referralCode, agreed_to_referral_terms: true } : {})
                })
            });

            const data = await res.json();
            if (data.success) {
                // Invalidate bookings & coupons cache so data is fresh after returning
                queryClient.invalidateQueries({ queryKey: ['bookings', selectedDate] });
                queryClient.invalidateQueries({ queryKey: ['coupons', userId] });

                const params = new URLSearchParams({
                    bookingId: data.booking.id,
                    price: data.booking.price.toString(),
                    paymentMethod: payment || 'cash',
                    fieldName: `สนาม ${(selectedField?.name || '').replace('สนาม ', '').replace('#', '').trim()}`,
                    date: getThaiDateString(selectedDate),
                    time: `${selection!.startTime} - ${selection!.endTime}`,
                    userId: userId || '',
                    ...(data.booking.deposit_amount ? { deposit: data.booking.deposit_amount.toString() } : {})
                });
                navigate(`/booking-success?${params.toString()}`);
            } else {
                throw new Error(data.error || 'Booking failed');
            }
        } catch (err: any) {
            alert('❌ จองไม่สำเร็จ: ' + err.message);
            setIsConfirmModalOpen(false);
        }
    };

    return {
        isReady,
        fields,
        coupons,
        existingBookings,
        userProfile,
        selection,
        setSelection,
        isCouponSheetOpen,
        setIsCouponSheetOpen,
        isConfirmModalOpen,
        setIsConfirmModalOpen,
        manualMainCoupon,
        setManualMainCoupon,
        manualOntopCoupon,
        setManualOntopCoupon,
        originalPrice,
        bestCoupon,
        appliedCoupon, // Legacy
        appliedMainCoupon: isMainValid ? appliedMain : null,
        appliedOntopCoupon: isOntopValid ? appliedOntop : null,
        discount: totalDiscount,
        finalPrice,
        couponInvalidReason: mainInvalidReason || ontopInvalidReason || null,
        errorMsg,
        selectedDate,
        setSelectedDate,
        isDateModalOpen,
        setIsDateModalOpen,
        getThaiDateString,
        getThaiDateShort,
        handleFinalConfirm,
        userId,
        allowedPaymentMethods, // [NEW] Return calculated methods
        referralCode: referralValid ? referralCode : null,
        referralDiscount,
        referralValid,
        referralError,
        referralRequireTermConsent,
        referralTermConsentMessage,
        forcePayment: urlForcePayment, // [FLASH DEAL] expose forced payment method
    };
};
