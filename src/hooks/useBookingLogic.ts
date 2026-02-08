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
    const [manualCoupon, setManualCoupon] = useState<Coupon | null>(null);

    // Calculated State
    const [originalPrice, setOriginalPrice] = useState(0);
    const [bestCoupon, setBestCoupon] = useState<Coupon | null>(null);
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
                // 1. Fetch Fields
                const { data: fieldsData, error: fieldsError } = await supabase
                    .from('fields')
                    .select('*')
                    .eq('active', true)
                    .order('id');

                if (fieldsError) throw fieldsError;

                if (!fieldsData || fieldsData.length === 0) {
                    setErrorMsg("No active fields found in database.");
                } else {
                    setFields(fieldsData.map(f => ({
                        id: f.id,
                        name: f.label,
                        type: f.type,
                        price_pre: f.price_pre || 0,
                        price_post: f.price_post || 0
                    })));
                }

                // 2. Fetch Existing Bookings
                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ date: selectedDate })
                });
                const bookingData = await res.json();

                const reverseMap: Record<number, number> = {
                    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
                };

                const normalizedBookings = (bookingData.bookings || []).map((b: any) => ({
                    ...b,
                    court_id: reverseMap[b.court_id] || b.court_id
                }));
                setExistingBookings(normalizedBookings);

                // 3. Fetch Coupons & Profile
                if (currentUserId) {
                    const couponRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify({ userId: currentUserId })
                    });
                    const couponData = await couponRes.json();

                    if (couponData.success) {
                        const allUserCoupons = [...(couponData.main || []), ...(couponData.on_top || [])];
                        const fetchedCoupons = allUserCoupons.map((c: any) => {
                            const bType = c.benefit?.type?.toUpperCase();
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
                                discount_type: (bType === 'PERCENT' ? 'PERCENT' : 'FIXED') as 'FIXED' | 'PERCENT',
                                discount_value: Number(discountVal),
                                min_spend: Number(c.conditions?.min_spend) || 0,
                                eligible_fields: c.conditions?.fields || null,
                                eligible_payments: c.conditions?.payment || null
                            };
                        });
                        setCoupons(fetchedCoupons);

                        // Auto-select coupon from URL
                        const urlCouponId = searchParams.get('couponId');
                        if (urlCouponId) {
                            const target = fetchedCoupons.find(c => c.id === urlCouponId);
                            if (target) {
                                setManualCoupon(target);
                            }
                        }
                    }

                    if (couponData.profile) {
                        setUserProfile(couponData.profile);
                    }
                }
            } catch (err: any) {
                console.error("Unexpected error:", err);
                setErrorMsg("Unexpected system error: " + err.message);
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

    // --- 3. Auto-Coupon Logic ---
    useEffect(() => {
        if (originalPrice === 0) {
            setBestCoupon(null);
            return;
        }

        let best = null;
        let maxSavings = 0;

        for (const c of coupons) {
            if (c.min_spend && originalPrice < c.min_spend) continue;
            if (c.eligible_fields && c.eligible_fields.length > 0) {
                if (!c.eligible_fields.includes(selection?.fieldId || 0)) continue;
            }

            let savings = 0;
            if (c.discount_type === 'FIXED') savings = c.discount_value;
            else if (c.discount_type === 'PERCENT') savings = (originalPrice * c.discount_value) / 100;

            if (savings > maxSavings) {
                maxSavings = savings;
                best = c;
            }
        }
        setBestCoupon(best);
    }, [originalPrice, coupons, selection]);

    const appliedCoupon = manualCoupon || bestCoupon;

    const isCouponValid = appliedCoupon &&
        (!appliedCoupon.min_spend || originalPrice >= appliedCoupon.min_spend) &&
        (!appliedCoupon.eligible_fields || appliedCoupon.eligible_fields.length === 0 || appliedCoupon.eligible_fields.includes(selection?.fieldId || 0));

    const discount = isCouponValid ? (appliedCoupon.discount_type === 'FIXED' ? appliedCoupon.discount_value : (originalPrice * appliedCoupon.discount_value) / 100) : 0;
    const finalPrice = Math.max(0, originalPrice - discount);

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
        manualCoupon,
        setManualCoupon,
        originalPrice,
        bestCoupon,
        appliedCoupon,
        discount,
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
