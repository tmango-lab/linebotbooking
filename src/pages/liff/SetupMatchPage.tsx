// src/pages/liff/SetupMatchPage.tsx
// LIFF: หน้าเปิดตี้หาทีมแจม (Host Setup)

import { useState, useEffect, useMemo } from 'react';
import { useLiff } from '../../providers/LiffProvider';
import { supabase } from '../../lib/api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface BookingInfo {
    booking_id: string;
    date: string;
    time_from: string;
    time_to: string;
    field_no: number;
    price_total_thb: number;
    display_name: string;
    deposit_amount: number;
    payment_status: string;
    payment_method: string;
    fieldLabel?: string;
}

export default function SetupMatchPage() {
    const { liffUser } = useLiff();
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const bookingId = params.get('bookingId') || '';
    const userId = liffUser?.userId || params.get('userId') || '';

    const [booking, setBooking] = useState<BookingInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Deposit gate state (สำหรับ Cash bookings ที่ยังไม่จ่ายมัดจำ)
    const [needsDeposit, setNeedsDeposit] = useState(false);
    const [depositLoading, setDepositLoading] = useState(false);

    // Form state
    const [hostTeamSize, setHostTeamSize] = useState(5);
    const [slotsTotal, setSlotsTotal] = useState(2);
    const [skillLevel, setSkillLevel] = useState('casual');
    const [note, setNote] = useState('');
    const [consent, setConsent] = useState(false);

    // Fetch booking info
    useEffect(() => {
        async function fetchBooking() {
            if (!bookingId) { setError('ไม่พบข้อมูลการจอง'); setLoading(false); return; }

            const { data, error: fetchErr } = await supabase
                .from('bookings')
                .select('booking_id, date, time_from, time_to, field_no, price_total_thb, display_name, deposit_amount, payment_status, payment_method')
                .eq('booking_id', bookingId)
                .single();

            if (fetchErr || !data) {
                setError('ไม่พบข้อมูลการจอง');
                setLoading(false);
                return;
            }

            // Get field label
            const { data: field } = await supabase.from('fields').select('label').eq('id', data.field_no).single();

            const bookingData = { ...data, fieldLabel: field?.label || `สนาม ${data.field_no}` };
            setBooking(bookingData);

            // ตรวจสอบว่า booking นี้จ่ายมัดจำผ่าน Stripe แล้วหรือยัง
            const hasDeposit = data.payment_status === 'deposit_paid' || data.payment_status === 'paid';
            if (!hasDeposit) {
                setNeedsDeposit(true);
            }

            setLoading(false);
        }
        fetchBooking();
    }, [bookingId]);

    // Handle deposit payment for Cash bookings
    const handlePayDeposit = async () => {
        setDepositLoading(true);
        setError('');

        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ bookingId }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'ไม่สามารถสร้าง QR ชำระเงินได้');

            // Redirect ไปหน้า BookingSuccess สำหรับ render QR PromptPay
            window.location.hash = `/booking-success?payment_intent_client_secret=${data.clientSecret}&bookingId=${bookingId}&returnTo=setup-match`;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDepositLoading(false);
        }
    };

    // Auto-calculated deposit
    const depositCalc = useMemo(() => {
        if (!booking) return { perPerson: 0, totalPlayers: 0, hostRemaining: 0 };
        const totalPlayers = hostTeamSize + slotsTotal;
        const perPerson = Math.ceil(booking.price_total_thb / totalPlayers);
        const joinerTotal = perPerson * slotsTotal;
        const hostPaidDeposit = booking.deposit_amount || 0;
        const hostRemaining = booking.price_total_thb - hostPaidDeposit - joinerTotal;
        return { perPerson, totalPlayers, joinerTotal, hostRemaining: Math.max(0, hostRemaining) };
    }, [booking, hostTeamSize, slotsTotal]);

    const handleSubmit = async () => {
        if (!consent) { setError('กรุณากดยอมรับเงื่อนไขก่อน'); return; }
        if (!userId) { setError('ไม่พบ LINE User ID กรุณาเข้าใช้งานผ่าน LINE'); return; }

        setSubmitting(true);
        setError('');

        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/open-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    action: 'create',
                    bookingId,
                    userId,
                    hostTeamSize,
                    slotsTotal,
                    skillLevel,
                    note: note.trim() || null,
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'เกิดข้อผิดพลาด');

            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading ─────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 mt-4 text-sm">กำลังโหลดข้อมูลการจอง...</p>
            </div>
        );
    }

    // ─── Success ────────────
    if (success) {
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4 pb-12">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-sm border border-gray-100 text-center">
                    <div className="text-6xl mb-4">⚽</div>
                    <h2 className="text-gray-800 text-2xl font-extrabold mb-1">ประกาศสำเร็จ!</h2>
                    <p className="text-gray-500 text-sm mb-6">เปิดตี้หาสมาชิกเรียบร้อยแล้ว</p>
                    
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left space-y-2 text-sm text-gray-700">
                        <p className="flex justify-between">
                            <span>💰 ค่าสนามผู้เข้าร่วม:</span>
                            <span className="font-bold text-green-700">{depositCalc.perPerson} บาท/คน</span>
                        </p>
                        <p className="flex justify-between">
                            <span>🎯 หาอีก:</span>
                            <span className="font-bold text-gray-800">{slotsTotal} คน</span>
                        </p>
                        <p className="text-green-700 font-medium pt-2 border-t border-green-100/50 mt-2 text-center text-xs">
                            📢 ระบบกำลังส่งประกาศไปหาเพื่อนเตะบอลให้คุณครับ
                        </p>
                    </div>
                    
                    <p className="text-gray-400 text-xs mt-6">
                        สามารถปิดหน้านี้ได้เลยครับ 👋
                    </p>
                </div>
            </div>
        );
    }

    // ─── Deposit Gate (Cash bookings ต้องจ่ายมัดจำก่อน) ────────────
    if (needsDeposit && booking) {
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex flex-col p-4 pb-12">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto shadow-sm border border-gray-100 mt-4">
                    <div className="text-5xl text-center mb-4">💳</div>
                    <h2 className="text-gray-800 text-xl font-extrabold text-center mb-2">จ่ายมัดจำก่อนเปิดตี้</h2>
                    <p className="text-gray-500 text-xs text-center mb-6 leading-relaxed">
                        การเปิดตี้หาทีมแจมต้องมีมัดจำในระบบก่อน<br/>เพื่อเป็นหลักประกันให้ผู้เข้าร่วม
                    </p>

                    <div className="bg-gray-50 border-l-4 border-green-500 rounded-lg p-3 mb-6">
                        <p className="text-gray-800 font-bold text-sm mb-1">{booking.fieldLabel}</p>
                        <p className="text-gray-500 text-xs mb-1">
                            📅 {booking.date} | ⏰ {booking.time_from} - {booking.time_to}
                        </p>
                        <p className="text-green-600 font-bold text-lg">
                            ฿{booking.price_total_thb?.toLocaleString()}
                        </p>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                        <p className="text-amber-600 font-bold text-xs mb-2">⚠️ สิ่งที่จะเกิดขึ้น:</p>
                        <ul className="list-disc pl-4 text-xs text-amber-800/80 space-y-1.5 leading-relaxed">
                            <li>ระบบจะให้สแกนจ่ายมัดจำ <b className="text-amber-800">200 บาท</b> ผ่าน PromptPay QR</li>
                            <li>มัดจำนี้ <b className="text-amber-800">หักจากราคาสนาม</b> ไม่ใช่จ่ายเพิ่ม</li>
                            <li>เมื่อจ่ายสำเร็จ จะสามารถเปิดตี้หาทีมแจมได้ทันที</li>
                        </ul>
                    </div>

                    {error && (
                        <p className="text-red-500 text-xs text-center mb-4 bg-red-50 py-2 rounded-lg">❌ {error}</p>
                    )}

                    <button
                        onClick={handlePayDeposit}
                        disabled={depositLoading}
                        className={`
                            w-full py-4 rounded-xl text-white font-bold text-sm
                            transition-all active:scale-[0.98]
                            bg-gradient-to-r from-green-600 to-emerald-500 hover:shadow-lg hover:shadow-green-200/50
                            ${depositLoading ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
                    >
                        {depositLoading ? '⏳ กำลังสร้าง QR...' : '💳 จ่ายมัดจำ 200 บาท → เปิดตี้'}
                    </button>

                    <p className="text-center text-gray-400 text-[10px] mt-4">
                        ชำระผ่าน PromptPay QR Code (Stripe)
                    </p>
                </div>
            </div>
        );
    }

    // ─── Form ───────────────
    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-12">
            {/* Header เหมือน BookingV3 */}
            <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-50 border-b border-gray-100 text-center relative">
                <h1 className="text-base font-extrabold text-gray-800">⚽ เปิดตี้หาสมาชิก</h1>
            </header>

            <main className="max-w-md mx-auto p-4 flex flex-col gap-5 mt-2">
                {/* Booking Summary Card */}
                {booking && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                            <p className="text-gray-800 font-extrabold text-base">{booking.fieldLabel}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-lg text-gray-600 font-medium">
                                    <span className="text-sm">📅</span> {booking.date}
                                </span>
                                <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-lg text-gray-600 font-medium">
                                    <span className="text-sm">⏰</span> {booking.time_from.substring(0, 5)} - {booking.time_to.substring(0, 5)}
                                </span>
                            </div>
                        </div>
                        <div className="text-right pl-4 pr-1 border-l border-gray-100 shrink-0">
                            <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">ราคาสนาม</p>
                            <p className="text-green-600 font-black text-2xl tracking-tighter leading-none">
                                ฿{booking.price_total_thb?.toLocaleString()}
                            </p>
                        </div>
                    </div>
                )}

                {/* Team Size Steppers */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-6">
                    {/* Host Team */}
                    <div>
                        <label className="block text-gray-700 font-bold text-sm mb-3">👥 กลุ่มของคุณมีกี่คน (รวมตัวคุณ) ?</label>
                        <div className="flex items-center justify-center gap-6">
                            <button 
                                className="w-12 h-12 rounded-full border-2 border-green-500 bg-white text-green-500 text-2xl font-bold flex items-center justify-center hover:bg-green-50 active:scale-90 transition-all focus:outline-none"
                                onClick={() => setHostTeamSize(Math.max(1, hostTeamSize - 1))}
                            >−</button>
                            <span className="w-12 text-center text-3xl font-extrabold text-gray-800">{hostTeamSize}</span>
                            <button 
                                className="w-12 h-12 rounded-full border-2 border-green-500 bg-white text-green-500 text-2xl font-bold flex items-center justify-center hover:bg-green-50 active:scale-90 transition-all focus:outline-none"
                                onClick={() => setHostTeamSize(Math.min(30, hostTeamSize + 1))}
                            >+</button>
                        </div>
                    </div>

                    {/* Target Joiners */}
                    <div>
                        <label className="block text-gray-700 font-bold text-sm mb-3">🔍 ต้องการคนเพิ่มกี่คน?</label>
                        <div className="flex items-center justify-center gap-6">
                            <button 
                                className="w-12 h-12 rounded-full border-2 border-green-500 bg-white text-green-500 text-2xl font-bold flex items-center justify-center hover:bg-green-50 active:scale-90 transition-all focus:outline-none"
                                onClick={() => setSlotsTotal(Math.max(1, slotsTotal - 1))}
                            >−</button>
                            <span className="w-12 text-center text-3xl font-extrabold text-gray-800">{slotsTotal}</span>
                            <button 
                                className="w-12 h-12 rounded-full border-2 border-green-500 bg-white text-green-500 text-2xl font-bold flex items-center justify-center hover:bg-green-50 active:scale-90 transition-all focus:outline-none"
                                onClick={() => setSlotsTotal(Math.min(20, slotsTotal + 1))}
                            >+</button>
                        </div>
                    </div>
                </div>

                {/* Calculation Result */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 shadow-sm">
                    <p className="text-gray-500 text-xs font-semibold mb-3">การคำนวณ (ระบบหารเท่ากันอัตโนมัติ)</p>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">จำนวนผู้เล่นทั้งหมด</span>
                            <span className="font-bold text-gray-800">{depositCalc.totalPlayers} คน</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">ค่าสนามผู้เข้าร่วม (ต่อคน)</span>
                            <span className="font-black text-green-600 text-xl">฿{depositCalc.perPerson}</span>
                        </div>
                        <div className="pt-3 border-t border-green-200 border-dashed flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-600">ยอดที่คุณเหลือจ่ายที่สนาม</span>
                            <span className="font-bold text-amber-600">฿{depositCalc.hostRemaining?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Skill Level Mode */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <label className="block text-gray-700 font-bold text-sm mb-3">🎮 ระดับการเล่น</label>
                    <div className="flex gap-2">
                        {[
                            { value: 'casual', label: '🟢 ลำลอง', activeColor: 'bg-green-50 border-green-500 text-green-700', inactiveColor: 'bg-white border-gray-200 text-gray-600' },
                            { value: 'intermediate', label: '🟡 ปานกลาง', activeColor: 'bg-amber-50 border-amber-500 text-amber-700', inactiveColor: 'bg-white border-gray-200 text-gray-600' },
                            { value: 'competitive', label: '🔴 จริงจัง', activeColor: 'bg-red-50 border-red-500 text-red-700', inactiveColor: 'bg-white border-gray-200 text-gray-600' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setSkillLevel(opt.value)}
                                className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${skillLevel === opt.value ? opt.activeColor : opt.inactiveColor}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <label className="block text-gray-700 font-bold text-sm mb-3">💬 ข้อความเพิ่มเติม (ไม่บังคับ)</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="เช่น หาระดับชิลๆ / มาเล่นเอาเหงื่อ / ยินดีต้อนรับทุกระดับ"
                        maxLength={200}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none h-24 placeholder-gray-400"
                    />
                </div>

                {/* Consent */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={e => { setConsent(e.target.checked); setError(''); }}
                            className="mt-1 w-5 h-5 accent-red-500 shrink-0 border-gray-300 rounded"
                        />
                        <span className="text-[11px] text-gray-700 leading-relaxed">
                            ⚠️ ยอมรับว่าเมื่อสร้างประกาศแล้ว <b className="text-red-600">จะไม่สามารถยกเลิกการจองและขอคืนเงินมัดจำได้</b>
                        </span>
                    </label>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 text-red-600 text-xs font-semibold py-3 px-4 rounded-xl text-center border border-red-100">
                        ❌ {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={!consent || submitting}
                    className={`
                        w-full py-4 rounded-2xl text-white font-extrabold text-base tracking-wide
                        transition-all active:scale-[0.98]
                        ${(!consent || submitting)
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg hover:shadow-green-200'
                        }
                    `}
                >
                    {submitting ? '⏳ กำลังสร้างประกาศ...' : '📢 ประกาศหาทีม!'}
                </button>
            </main>
        </div>
    );
}
