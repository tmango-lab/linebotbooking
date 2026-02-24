import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/api';
import { getLiffUser } from '../lib/liff';

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
    const [isReady, setIsReady] = useState(false);

    // Data State
    const [fields, setFields] = useState<Field[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [existingBookings, setExistingBookings] = useState<any[]>([]);
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
    const [selectedDate, setSelectedDate] = useState<string>(todayStr);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);

    const [userId, setUserId] = useState<string | null>(searchParams.get('userId'));

    // [REFERRAL] Referral code from URL
    // [REFERRAL] Referral code from URL
    const [referralCode, setReferralCode] = useState<string | null>(searchParams.get('ref'));
    const [referralDiscount, setReferralDiscount] = useState<number>(0); // e.g. 50 = 50%
    const [referralValid, setReferralValid] = useState<boolean>(false);
    const [referralError, setReferralError] = useState<string | null>(null); // [NEW] Error state
    const getThaiDateString = (dateStr?: string) => {
        const dObj = dateStr ? new Date(dateStr) : new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const d = dObj.getDate();
        const m = dObj.getMonth() + 1;
        const y = dObj.getFullYear();
        const dayName = days[dObj.getDay()];
        return `${dayName} ${d}/${m}/${y}`;
    };

    const getThaiDateShort = (dateStr: string) => {
        const dObj = new Date(dateStr);
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        if (isToday) return `วันนี้, ${dObj.getDate()} ${months[dObj.getMonth()]}`;
        return `${days[dObj.getDay()]}, ${dObj.getDate()} ${months[dObj.getMonth()]}`;
    };

    // --- 1. Init Data ---
    useEffect(() => {
        const init = async () => {
            setErrorMsg(null);
            const liffUser = await getLiffUser({ requireLogin: true }); // [MOD] Enforce login for booking
            const currentUserId = liffUser.userId || userId;

            if (!currentUserId) {
                setErrorMsg("ไม่พบข้อมูลผู้ใช้งาน (User ID Missing). กรุณาเปิดผ่าน LINE อีกครั้ง");
                setIsReady(true);
                return;
            }
            setUserId(currentUserId);

            try {
                // [OPTIMIZED] Fetch all data in parallel
                const fieldsPromise = supabase
                    .from('fields')
                    .select('*')
                    .eq('active', true)
                    .order('id');

                const bookingsPromise = fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ date: selectedDate })
                }).then(res => res.json());

                // Start fetching coupons if user exists
                let couponsPromise = Promise.resolve({ success: false, main: [], on_top: [], profile: null }) as Promise<any>;
                if (currentUserId) {
                    couponsPromise = fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify({ userId: currentUserId })
                    }).then(res => res.json());
                }

                // Wait for all
                const [fieldsResult, bookingData, couponData] = await Promise.all([
                    fieldsPromise,
                    bookingsPromise,
                    couponsPromise
                ]);

                // 1. Process Fields
                const { data: fieldsData, error: fieldsError } = fieldsResult;
                if (fieldsError) throw fieldsError;

                if (!fieldsData || fieldsData.length === 0) {
                    setErrorMsg("No active fields found.");
                } else {
                    setFields(fieldsData.map(f => ({
                        id: f.id,
                        name: f.label,
                        type: f.type,
                        price_pre: f.price_pre || 0,
                        price_post: f.price_post || 0
                    })));
                }

                // 2. Process Bookings
                const reverseMap: Record<number, number> = {
                    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
                };
                const normalizedBookings = (bookingData.bookings || []).map((b: any) => ({
                    ...b,
                    court_id: reverseMap[b.court_id] || b.court_id
                }));
                setExistingBookings(normalizedBookings);

                // 3. Process Coupons
                if (couponData.success) {
                    const allUserCoupons = [...(couponData.main || []), ...(couponData.on_top || [])];
                    const fetchedCoupons = allUserCoupons.map((c: any) => {
                        const bValue = c.benefit?.value;
                        let discountVal = 0;
                        if (bValue) {
                            if (typeof bValue === 'number') discountVal = bValue;
                            else discountVal = bValue.amount || bValue.percent || 0;
                        }
                        return {
                            id: c.coupon_id,
                            campaign_id: c.campaign_id,
                            name: c.name,
                            discount_type: (bValue?.percent ? 'PERCENT' : 'FIXED') as 'FIXED' | 'PERCENT',
                            discount_value: Number(discountVal),
                            min_spend: Number(c.conditions?.min_spend) || 0,
                            eligible_fields: c.conditions?.fields || null,
                            eligible_days: c.conditions?.days || null,
                            valid_time_start: c.conditions?.time?.start || null,
                            valid_time_end: c.conditions?.time?.end || null,
                            eligible_payments: c.conditions?.payment || null,
                            category: (c.is_stackable ? 'ONTOP' : 'MAIN') as "MAIN" | "ONTOP",
                            expiry: c.expiry, // [NEW]
                            allow_ontop_stacking: c.is_stackable ? true : (c.allow_ontop_stacking ?? true)
                        };
                    });
                    setCoupons(fetchedCoupons);

                    // Auto-select coupon from URL
                    const urlCouponId = searchParams.get('couponId');
                    if (urlCouponId) {
                        const target = fetchedCoupons.find(c => c.id === urlCouponId);
                        if (target) setManualMainCoupon(target as Coupon);
                    }
                }

                // [REFERRAL] Validate referral code if present
                const refCode = searchParams.get('ref');
                if (refCode && currentUserId) {
                    try {
                        const refRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-referral`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                            },
                            body: JSON.stringify({ referralCode: refCode, userId: currentUserId })
                        });
                        const refData = await refRes.json();

                        if (refRes.ok && refData.valid) {
                            setReferralCode(refCode);
                            // [FIX] Access correctly nested program data, fallback to 50
                            const discountPct = refData.program?.discountPercent || 50;
                            setReferralDiscount(discountPct);
                            setReferralValid(true);
                            setReferralError(null);

                            // Auto-apply Referral Coupon
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
                                eligible_payments: null,
                                category: 'MAIN',
                                expiry: '',
                                allow_ontop_stacking: true
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
                        setReferralError(refErr.message || "Validation Error");
                    }
                }

                if (couponData.profile) {
                    setUserProfile(couponData.profile);
                }

            } catch (err: any) {
                console.error("Unexpected error:", err);
                setErrorMsg("System error: " + err.message);
            }
            setIsReady(true);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

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

    // Helper: Centralized Validation Logic
    const validateCoupon = (coupon: Coupon | null) => {
        if (!coupon) return false;

        // 1. Min Spend
        if (coupon.min_spend && originalPrice < coupon.min_spend) return false;

        // 2. Eligible Fields
        if (coupon.eligible_fields && coupon.eligible_fields.length > 0) {
            if (!selection || !coupon.eligible_fields.includes(selection.fieldId)) return false;
        }

        // 3. Eligible Days
        if (coupon.eligible_days && coupon.eligible_days.length > 0) {
            const d = new Date(selectedDate);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDay = dayNames[d.getDay()];
            if (!coupon.eligible_days.includes(currentDay)) return false;
        }

        // 4. Valid Time Range
        if (selection) {
            if (coupon.valid_time_start && selection.startTime < coupon.valid_time_start) return false;
            if (coupon.valid_time_end && selection.startTime > coupon.valid_time_end) return false;
        }

        // 5. Expiry Date (Booking Date vs Coupon Expiry)
        if (coupon.expiry) {
            // Compare YYYY-MM-DD
            const bookingDate = new Date(selectedDate);
            const expiryDate = new Date(coupon.expiry);
            bookingDate.setHours(0, 0, 0, 0);
            expiryDate.setHours(0, 0, 0, 0);
            if (bookingDate > expiryDate) return false;
        }

        return true;
    };

    // Validate Main
    const isMainValid = validateCoupon(appliedMain);

    // Calculate Price after Main
    let priceAfterMain = originalPrice;
    let mainDiscount = 0;
    if (isMainValid && appliedMain) {
        if (appliedMain.discount_type === 'FIXED') mainDiscount = appliedMain.discount_value;
        else mainDiscount = (originalPrice * appliedMain.discount_value) / 100;
        priceAfterMain = Math.max(0, originalPrice - mainDiscount);
    }

    // Validate On-top
    const isOntopValid = validateCoupon(appliedOntop);

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
                    ...(referralValid && referralCode ? { referralCode } : {})
                })
            });

            const data = await res.json();
            if (data.success) {
                const params = new URLSearchParams({
                    bookingId: data.booking.id,
                    price: data.booking.price.toString(),
                    paymentMethod: payment || 'cash',
                    fieldName: `สนาม ${(selectedField?.name || '').replace('สนาม ', '').replace('#', '').trim()}`,
                    date: getThaiDateString(selectedDate),
                    time: `${selection!.startTime} - ${selection!.endTime}`,
                    userId: userId || ''
                });
                navigate(`/booking-success?${params.toString()}`);
            } else {
                throw new Error(data.error || "Booking failed");
            }
        } catch (err: any) {
            alert("❌ จองไม่สำเร็จ: " + err.message);
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
        referralError
    };
};
