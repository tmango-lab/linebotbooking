import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/api';
import BookingGrid from '../../components/liff/BookingGrid';
import BookingSummary from '../../components/liff/BookingSummary';
import CouponBottomSheet from '../../components/liff/CouponBottomSheet';
import BookingConfirmationModal from '../../components/liff/BookingConfirmationModal';

interface Field {
    id: number;
    name: string;
    type: string;
    price_pre: number;
    price_post: number;
}

interface Coupon {
    id: string; // User Coupon ID (user_coupons.id)
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

const BookingV2Page: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isReady, setIsReady] = useState(false);

    // Data State
    const [fields, setFields] = useState<Field[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [existingBookings, setExistingBookings] = useState<any[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // UI/Selection State
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

    // --- 1. Init Data ---
    useEffect(() => {
        const init = async () => {
            console.log("Initializing Booking V2...");
            setErrorMsg(null);
            const userId = searchParams.get('userId');

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

                // 2. Fetch Existing Bookings for today
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                const localDate = new Date(now.getTime() - offset);
                const today = localDate.toISOString().split('T')[0];

                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ date: today })
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

                // 3. Fetch Real Coupons & Profile
                if (userId) {
                    // Fetch Coupons
                    const couponRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify({ userId })
                    });
                    const couponData = await couponRes.json();

                    if (couponData.success) {
                        const allUserCoupons = [...(couponData.main || []), ...(couponData.on_top || [])];
                        setCoupons(allUserCoupons.map((c: any) => ({
                            id: c.coupon_id,
                            campaign_id: c.campaign_id,
                            name: c.name,
                            discount_type: c.benefit.type.toUpperCase() === 'PERCENT' ? 'PERCENT' : 'FIXED',
                            discount_value: Number(c.benefit.value) || 0,
                            min_spend: Number(c.conditions?.min_spend) || 0,
                            eligible_fields: c.conditions?.fields || null
                        })));
                    }

                    // Fetch Profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (profile) setUserProfile(profile);
                }

            } catch (err: any) {
                console.error("Unexpected error:", err);
                setErrorMsg("Unexpected system error: " + err.message);
            }

            setIsReady(true);
        };
        init();
    }, [searchParams]);

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

        if (manualCoupon && (originalPrice < manualCoupon.min_spend || (manualCoupon.eligible_fields && !manualCoupon.eligible_fields.includes(selection?.fieldId || 0)))) {
            setManualCoupon(null);
        }

    }, [originalPrice, coupons, selection, manualCoupon]);

    const appliedCoupon = manualCoupon || bestCoupon;
    const discount = appliedCoupon ? (appliedCoupon.discount_type === 'FIXED' ? appliedCoupon.discount_value : (originalPrice * appliedCoupon.discount_value) / 100) : 0;
    const finalPrice = Math.max(0, originalPrice - discount);

    const handleFinalConfirm = async (team: string, phone: string, payment: string) => {
        const userId = searchParams.get('userId');
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localDate = new Date(now.getTime() - offset);
        const today = localDate.toISOString().split('T')[0];

        // Mapping field ID back to Matchday ID for the API (Internal uses 1-6)
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
                    date: today,
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
                alert("จองสนามสำเร็จแล้วครับ! ขอบคุณที่ใช้บริการครับ 🙏");
                // Navigate to wallet or status page
                navigate(`/?userId=${userId}`);
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

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-32 font-sans">
            <header className="bg-white p-4 shadow-sm sticky top-0 z-50 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold">New Booking</h1>
                    <p className="text-xs text-gray-500">
                        Today: {new Date().toLocaleDateString('th-TH')}
                    </p>
                </div>
            </header>

            <main className="p-4 space-y-4 max-w-lg mx-auto">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-5">
                    <h2 className="mb-4 font-bold text-gray-800 text-lg">Select Court & Time</h2>
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center">
                            <span className="mr-3 text-lg">⚠️</span> {errorMsg}
                        </div>
                    )}
                    <BookingGrid
                        fields={fields}
                        existingBookings={existingBookings}
                        onSelect={(fid, start, end) => setSelection({ fieldId: fid, startTime: start, endTime: end })}
                    />
                </div>

                <div className="px-2 py-4 text-center">
                    <p className="text-xs text-gray-400">
                        {selection ? `Selected: ${selectedField?.name} at ${selection.startTime} - ${selection.endTime}` : "Choose a slot to start booking"}
                    </p>
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
                    fieldName: selectedField?.name || '',
                    date: new Date().toLocaleDateString('th-TH'),
                    startTime: selection?.startTime || '',
                    endTime: selection?.endTime || '',
                    originalPrice,
                    discount,
                    finalPrice,
                    couponName: appliedCoupon?.name
                }}
                initialProfile={userProfile ? {
                    team_name: userProfile.team_name,
                    phone_number: userProfile.phone_number
                } : null}
            />
        </div>
    );
};

export default BookingV2Page;
