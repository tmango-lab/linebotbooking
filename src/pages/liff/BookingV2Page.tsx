import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/api'; // Ensure this path is correct
import BookingGrid from '../../components/liff/BookingGrid';
import BookingSummary from '../../components/liff/BookingSummary';
// import CouponBottomSheet from '../../components/liff/CouponBottomSheet';

interface Field {
    id: number;
    name: string;
    type: string;
    price_pre: number;
    price_post: number;
}

interface Coupon {
    id: string; // User Coupon ID
    campaign_id: number;
    name: string; // Campaign Name
    discount_type: 'FIXED' | 'PERCENT';
    discount_value: number;
    min_spend: number;
    eligible_fields: number[] | null;
}

const BookingV2Page: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [isReady, setIsReady] = useState(false);

    // Data State
    const [fields, setFields] = useState<Field[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [existingBookings, setExistingBookings] = useState<any[]>([]);

    // Selection State
    const [selection, setSelection] = useState<{
        fieldId: number;
        startTime: string; // "18:00"
        endTime: string;   // "19:30"
    } | null>(null);

    // Calculated State
    const [originalPrice, setOriginalPrice] = useState(0);
    const [bestCoupon, setBestCoupon] = useState<Coupon | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // --- 1. Init Data ---
    useEffect(() => {
        const init = async () => {
            console.log("Initializing Booking V2...");
            setErrorMsg(null);

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
                // Use local date to match user's perspective (Thailand GMT+7)
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
                console.log("Existing Bookings loaded:", bookingData.bookings?.length);
                setExistingBookings(bookingData.bookings || []);

            } catch (err: any) {
                console.error("Unexpected error:", err);
                setErrorMsg("Unexpected system error: " + err.message);
            }

            // Fetch Coupons
            const userId = searchParams.get('userId');
            if (userId) {
                setCoupons([
                    { id: 'c1', campaign_id: 1, name: 'Welcome Discount', discount_type: 'FIXED', discount_value: 100, min_spend: 500, eligible_fields: null },
                    { id: 'c2', campaign_id: 2, name: 'Big Spender', discount_type: 'PERCENT', discount_value: 10, min_spend: 1000, eligible_fields: null }
                ]);
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

        const availableCoupons: Coupon[] = coupons;
        let best = null;
        let maxSavings = 0;

        for (const c of availableCoupons) {
            if (c.min_spend && originalPrice < c.min_spend) continue;
            if (c.eligible_fields && !c.eligible_fields.includes(selection?.fieldId || 0)) continue;

            let savings = 0;
            if (c.discount_type === 'FIXED') savings = c.discount_value;
            if (c.discount_type === 'PERCENT') savings = (originalPrice * c.discount_value) / 100;

            if (savings > maxSavings) {
                maxSavings = savings;
                best = c;
            }
        }
        setBestCoupon(best);
    }, [originalPrice, coupons, selection]);

    const handleConfirm = () => {
        alert("Booking Confirmed! (Mock)");
    };

    if (!isReady) {
        return <div className="p-4">Loading...</div>;
    }

    const discount = bestCoupon ? (bestCoupon.discount_type === 'FIXED' ? bestCoupon.discount_value : (originalPrice * bestCoupon.discount_value) / 100) : 0;
    const finalPrice = Math.max(0, originalPrice - discount);

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-32">
            <header className="bg-white p-4 shadow-sm sticky top-0 z-50">
                <h1 className="text-lg font-bold">New Booking</h1>
            </header>

            <main className="p-4 space-y-4">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden p-4">
                    <h2 className="mb-4 font-semibold">Select Slot</h2>
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
                            ⚠️ {errorMsg}
                        </div>
                    )}
                    <BookingGrid
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
                couponName={bestCoupon?.name}
                onConfirm={handleConfirm}
                onOpenCoupons={() => { }}
                isVisible={!!selection}
            />

            <div className="text-center text-xs text-gray-400 mt-4">
                Orig: {originalPrice} | Disc: {discount} | Best: {bestCoupon?.name}
            </div>
        </div>
    );
};

export default BookingV2Page;
