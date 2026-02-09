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
    eligible_payments: string[] | null;
    category: 'MAIN' | 'ONTOP'; // New field
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

    // Helpers
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
                            eligible_payments: c.conditions?.payment || null,
                            category: (c.is_stackable ? 'ONTOP' : 'MAIN') as "MAIN" | "ONTOP" // Explicit cast
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

    // Validate Main
    const isMainValid = appliedMain &&
        (!appliedMain.min_spend || originalPrice >= appliedMain.min_spend) &&
        (!appliedMain.eligible_fields || appliedMain.eligible_fields.length === 0 || appliedMain.eligible_fields.includes(selection?.fieldId || 0));

    // Calculate Price after Main
    let priceAfterMain = originalPrice;
    let mainDiscount = 0;
    if (isMainValid && appliedMain) {
        if (appliedMain.discount_type === 'FIXED') mainDiscount = appliedMain.discount_value;
        else mainDiscount = (originalPrice * appliedMain.discount_value) / 100;
        priceAfterMain = Math.max(0, originalPrice - mainDiscount);
    }

    // Validate On-top
    const isOntopValid = appliedOntop &&
        (!appliedOntop.min_spend || originalPrice >= appliedOntop.min_spend) && // Check against original price usually? Or price after discount? Let's stick to original for eligibility.
        (!appliedOntop.eligible_fields || appliedOntop.eligible_fields.length === 0 || appliedOntop.eligible_fields.includes(selection?.fieldId || 0));

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
    const appliedCoupon = appliedMain || appliedOntop; // Fallback for legacy UI that expects one coupon

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
                    couponId: appliedCoupon?.id,
                    paymentMethod: payment
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
        userId
    };
};
