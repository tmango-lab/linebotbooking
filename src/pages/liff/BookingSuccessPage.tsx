
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, Copy, X, AlertCircle, Loader2, CreditCard } from 'lucide-react';
import liff from '@line/liff';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const BookingSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();

    const bookingId = searchParams.get('bookingId');
    const price = searchParams.get('price');
    const paymentMethod = searchParams.get('paymentMethod');
    const fieldName = searchParams.get('fieldName');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const userId = searchParams.get('userId');

    const isQR = paymentMethod === 'qr';

    // Stripe state
    const [stripeLoading, setStripeLoading] = useState(false);
    const [stripeError, setStripeError] = useState<string | null>(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentStarted, setPaymentStarted] = useState(false);

    // Fallback static QR (keep as backup)
    const promptPayId = "0839144000";
    const amountToPay = isQR ? 200 : price;

    useEffect(() => {
        document.title = "Booking Success";
    }, []);

    // Auto-trigger Stripe payment when QR is selected
    useEffect(() => {
        if (isQR && bookingId && !paymentStarted && !paymentSuccess) {
            handleStripePayment();
        }
    }, [isQR, bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCopy = () => {
        navigator.clipboard.writeText(promptPayId);
        alert('คัดลอกเบอร์พร้อมเพย์แล้ว');
    };

    /**
     * Initiate Stripe PromptPay payment flow
     */
    const handleStripePayment = useCallback(async () => {
        if (!bookingId) return;

        setStripeLoading(true);
        setStripeError(null);
        setPaymentStarted(true);

        try {
            // 1. Call create-payment-intent
            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ bookingId }),
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to create payment');
            }

            const { clientSecret, publicKey } = data;

            // 2. Load Stripe.js
            const stripePublicKey = publicKey || import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';
            if (!stripePublicKey) {
                throw new Error('Stripe public key not configured');
            }

            const stripe: Stripe | null = await loadStripe(stripePublicKey);
            if (!stripe) {
                throw new Error('Failed to load Stripe');
            }

            // 3. Confirm PromptPay Payment (shows QR modal)
            setStripeLoading(false);

            const result = await stripe.confirmPromptPayPayment(clientSecret, {
                payment_method: {
                    billing_details: {
                        email: `${userId || bookingId}@booking.local`,
                    },
                },
            });

            if (result.error) {
                // User cancelled or error
                if (result.error.code === 'payment_intent_unexpected_state') {
                    // Already paid
                    setPaymentSuccess(true);
                } else {
                    setStripeError(result.error.message || 'Payment cancelled');
                    setPaymentStarted(false);
                }
            } else if (result.paymentIntent?.status === 'succeeded') {
                // Payment succeeded!
                setPaymentSuccess(true);
            } else {
                // User might have closed without paying
                setStripeError('การชำระเงินถูกยกเลิก กรุณาลองใหม่');
                setPaymentStarted(false);
            }
        } catch (err: any) {
            console.error('[Stripe Payment Error]:', err);
            setStripeError(err.message || 'เกิดข้อผิดพลาด');
            setStripeLoading(false);
            setPaymentStarted(false);
        }
    }, [bookingId]);

    // If payment succeeded, show success UI
    if (paymentSuccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 pb-24">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-sm p-8 text-center animate-scale-in">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        ✅ ชำระเงินสำเร็จ!
                    </h1>
                    <p className="text-gray-500 text-sm mb-6">Booking ID: {bookingId}</p>

                    <div className="space-y-3 bg-green-50 border border-green-100 rounded-2xl p-5 mb-6 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">สนาม</span>
                            <span className="font-bold text-gray-800">{fieldName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">วันที่</span>
                            <span className="font-bold text-gray-800">{date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">เวลา</span>
                            <span className="font-bold text-gray-800">{time}</span>
                        </div>
                        <div className="border-t border-dashed border-green-200 my-2 pt-2 flex justify-between">
                            <span className="text-gray-500">ยอดชำระ</span>
                            <span className="font-bold text-green-600 text-lg">฿{price}</span>
                        </div>
                        <div className="text-center">
                            <span className="text-xs text-green-700 bg-green-100 px-3 py-1 rounded-full font-bold">
                                ชำระผ่าน Stripe PromptPay ✓
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => liff.closeWindow()}
                        className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all shadow-lg"
                    >
                        <X className="w-5 h-5" />
                        ปิดหน้าต่าง
                    </button>
                    <p className="text-xs text-gray-400 mt-4">การจองของคุณได้รับการยืนยันแล้ว</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 pb-24">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-sm p-8 text-center animate-scale-in">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    {isQR ? 'จองสำเร็จ! กรุณาชำระเงิน' : 'จองสนามสำเร็จ!'}
                </h1>
                <p className="text-gray-500 text-sm mb-6">Booking ID: {bookingId}</p>

                <div className="space-y-3 bg-gray-50 rounded-2xl p-5 mb-6 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">สนาม</span>
                        <span className="font-bold text-gray-800">{fieldName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">วันที่</span>
                        <span className="font-bold text-gray-800">{date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">เวลา</span>
                        <span className="font-bold text-gray-800">{time}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between">
                        <span className="text-gray-500">ยอดชำระสุทธิ</span>
                        <span className="font-bold text-green-600 text-lg">฿{price}</span>
                    </div>
                </div>

                {isQR ? (
                    <div className="space-y-4 mb-6">
                        {/* Stripe PromptPay Button */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                            <h3 className="text-indigo-800 font-bold mb-2 flex items-center justify-center gap-2">
                                <CreditCard className="w-5 h-5" />
                                ชำระผ่าน Stripe PromptPay
                            </h3>
                            <p className="text-indigo-500 text-xs mb-4">
                                ระบบจะแสดง QR Code สำหรับสแกนจ่ายผ่านแอปธนาคาร
                            </p>

                            <div className="bg-red-50 text-red-600 text-[11px] font-bold p-2 rounded-lg mb-4 border border-red-100 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>กรุณาชำระเงินภายใน 10 นาที มิฉะนั้นการจองจะถูกยกเลิกอัตโนมัติ</span>
                            </div>

                            {stripeError && (
                                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 border border-red-200">
                                    ⚠️ {stripeError}
                                </div>
                            )}

                            <button
                                onClick={handleStripePayment}
                                disabled={stripeLoading || paymentStarted}
                                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
                                    ${stripeLoading || paymentStarted
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                                    }`}
                            >
                                {stripeLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        กำลังโหลด...
                                    </>
                                ) : paymentStarted ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        รอการชำระ...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        สแกน QR Code ชำระเงิน
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Fallback: Manual PromptPay */}
                        <details className="bg-gray-50 border border-gray-200 rounded-2xl">
                            <summary className="p-4 text-sm text-gray-500 cursor-pointer font-medium text-center">
                                หรือ โอนเองผ่านพร้อมเพย์ (สำรอง)
                            </summary>
                            <div className="px-6 pb-6">
                                <p className="text-gray-500 text-xs mb-3">โอนเข้าบัญชีด้านล่าง แล้วส่งสลิปทางแชท</p>
                                <div className="bg-white p-3 rounded-xl shadow-sm inline-block mb-4">
                                    <img
                                        src={`https://promptpay.io/${promptPayId}/${amountToPay}.png`}
                                        alt="QR Code"
                                        className="w-40 h-40 object-contain"
                                    />
                                </div>
                                <div className="flex items-center justify-center gap-2 text-gray-600 bg-white/50 py-2 rounded-lg cursor-pointer" onClick={handleCopy}>
                                    <span className="font-mono font-bold">{promptPayId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</span>
                                    <Copy className="w-4 h-4 opacity-50" />
                                </div>
                            </div>
                        </details>
                    </div>
                ) : (
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-6">
                        <p className="text-green-800 font-bold">ชำระเงินหน้าสนาม</p>
                        <p className="text-green-600 text-xs">กรุณาแสดงหน้าจอนี้กับเจ้าหน้าที่</p>
                    </div>
                )}

                <button
                    onClick={() => liff.closeWindow()}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all shadow-lg"
                >
                    <X className="w-5 h-5" />
                    ปิดหน้าต่าง
                </button>
                <p className="text-xs text-gray-400 mt-4">กรุณากลับไปที่หน้าแชทเพื่อรอรับการยืนยัน</p>
            </div>
        </div>
    );
};

export default BookingSuccessPage;
