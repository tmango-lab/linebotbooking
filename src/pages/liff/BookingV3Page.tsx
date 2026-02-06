import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/api';
import BookingGridVertical from '../../components/liff/BookingGridVertical';
import BookingSummary from '../../components/liff/BookingSummary';
import CouponBottomSheet from '../../components/liff/CouponBottomSheet';
import BookingConfirmationModal from '../../components/liff/BookingConfirmationModal';
import DateSelectionModal from '../../components/liff/DateSelectionModal';
import { getLiffUser } from '../../lib/liff';

interface Field {
    id: number;
    name: string;
    type: string;
    price_pre: number;
    price_post: number;
}

interface Coupon {
    id: string;
    campaign_id: number;
    name: string;
    discount_type: 'FIXED' | 'PERCENT';
    discount_value: number;
    min_spend: number;
    eligible_fields: number[] | null;
}

interface UserProfile {
    user_id: string;
    team_name: string;
    phone_number: string;
}

const BookingV3Page: React.FC = () => {
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

    // --- 1. Init Data ---
    useEffect(() => {
        const init = async () => {
            console.log("Initializing Booking V3 (Vertical)...");
            setErrorMsg(null);

            // [Fix] Robust User ID Retrieval
            const liffUser = await getLiffUser();
            const currentUserId = liffUser.userId || userId; // Prefer LIFF, fallback to param

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

                // 2. Fetch Existing Bookings for selected date
                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ date: selectedDate })
                });
                const bookingData = await res.json();

                // ID MAPPING FIX
                const reverseMap: Record<number, number> = {
                    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
                };

                const normalizedBookings = (bookingData.bookings || []).map((b: any) => ({
                    ...b,
                    court_id: reverseMap[b.court_id] || b.court_id
                }));

                setExistingBookings(normalizedBookings);

                // 3. Fetch Real Coupons & Profile
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
                                eligible_fields: c.conditions?.fields || null
                            };
                        });
                        setCoupons(fetchedCoupons);

                        // [NEW] Auto-select coupon from URL
                        const urlCouponId = searchParams.get('couponId');
                        if (urlCouponId) {
                            const target = fetchedCoupons.find(c => c.id === urlCouponId);
                            if (target) {
                                console.log("Auto-applying coupon from URL:", target.name);
                                setManualCoupon(target);
                            }
                        }
                    }

                    if (couponData.profile) {
                        setUserProfile(couponData.profile);
                        console.log("Profile loaded from API:", couponData.profile);
                    }
                }
                // [REMOVED] Direct Profile Fetch (RLS Blocked)
                // const { data: profile } = await supabase...
            } catch (err: any) {
                console.error("Unexpected error:", err);
                setErrorMsg("Unexpected system error: " + err.message);
            }

            setIsReady(true);
        };
        init();
    }, [searchParams, selectedDate]);

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
            // BEST coupon must be valid
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

    // Validity Check for final calculation
    const isCouponValid = appliedCoupon &&
        (!appliedCoupon.min_spend || originalPrice >= appliedCoupon.min_spend) &&
        (!appliedCoupon.eligible_fields || appliedCoupon.eligible_fields.length === 0 || appliedCoupon.eligible_fields.includes(selection?.fieldId || 0));

    const discount = isCouponValid ? (appliedCoupon.discount_type === 'FIXED' ? appliedCoupon.discount_value : (originalPrice * appliedCoupon.discount_value) / 100) : 0;
    const finalPrice = Math.max(0, originalPrice - discount);

    const handleFinalConfirm = async (team: string, phone: string, payment: string) => {
        // const userId = searchParams.get('userId'); // Old

        const forwardMap: Record<number, number> = {
            1: 2424, 2: 2425, 3: 2428, 4: 2426, 5: 2427, 6: 2429
        };

        try {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    userId,
                    fieldId: forwardMap[selection!.fieldId] || selection!.fieldId,
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
                // Success - Navigate to Success Page
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

    if (!isReady) {
        return <div className="p-4 flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>;
    }

    const selectedField = fields.find(f => f.id === selection?.fieldId);

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

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-32">
            <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-50 flex justify-between items-center border-b border-gray-100">
                <div className="flex-1">
                    <button
                        onClick={() => setIsDateModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-2xl border border-gray-100 transition-all active:scale-95"
                    >
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">เลือกวัน</span>
                            <span className="text-sm font-extrabold text-gray-800">{getThaiDateShort(selectedDate)}</span>
                        </div>
                        <svg className="w-5 h-5 text-green-600 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
                {userProfile && (
                    <div className="text-right">
                        <div className="text-xs text-gray-400">ทีม</div>
                        <div className="text-sm font-bold text-green-600">{userProfile.team_name}</div>
                    </div>
                )}
            </header>

            <DateSelectionModal
                isOpen={isDateModalOpen}
                onClose={() => setIsDateModalOpen(false)}
                selectedDate={selectedDate}
                onSelect={(d) => {
                    setSelectedDate(d);
                    setSelection(null);
                }}
            />

            <main className="max-w-lg mx-auto">
                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center mx-4 mt-4">
                        <span className="mr-3">⚠️</span> {errorMsg}
                    </div>
                )}

                <div className="bg-white overflow-hidden border-b border-gray-200 shadow-sm">
                    <BookingGridVertical
                        key={selectedDate} // Force re-render on date change to clear internal state
                        fields={fields}
                        existingBookings={existingBookings}
                        onSelect={(fid, start, end) => setSelection({ fieldId: fid, startTime: start, endTime: end })}
                    />
                </div>
            </main>

            <BookingSummary
                originalPrice={originalPrice}
                discount={discount}
                finalPrice={finalPrice}
                couponName={appliedCoupon?.name}
                onConfirm={() => setIsConfirmModalOpen(true)}
                onOpenCoupons={() => setIsCouponSheetOpen(true)}
                isVisible={!!selection}
            />

            <CouponBottomSheet
                isOpen={isCouponSheetOpen}
                onClose={() => setIsCouponSheetOpen(false)}
                coupons={coupons}
                selectedCouponId={appliedCoupon?.id || null}
                bestCouponId={bestCoupon?.id || null}
                onSelect={(c) => {
                    if (c?.id === bestCoupon?.id) setManualCoupon(null);
                    else setManualCoupon(c);
                }}
                originalPrice={originalPrice}
            />

            <BookingConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleFinalConfirm}
                bookingDetails={{
                    fieldName: `สนาม ${(selectedField?.name || '').replace('สนาม ', '').replace('#', '').trim()}`,
                    date: getThaiDateString(selectedDate),
                    startTime: selection?.startTime || '',
                    endTime: selection?.endTime || '',
                    originalPrice,
                    discount,
                    finalPrice,
                    couponName: appliedCoupon?.name,
                    appliedCoupon: appliedCoupon
                }}
                initialProfile={userProfile ? {
                    team_name: userProfile.team_name,
                    phone_number: userProfile.phone_number
                } : null}
            />

        </div>
    );
};

export default BookingV3Page;
