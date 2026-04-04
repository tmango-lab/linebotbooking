// src/pages/liff/MatchBoardPage.tsx
// LIFF: กระดานหาทีมแจม (Match Board สำหรับ Joiner)
// Theme: Light — ให้ตรงกับ BookingV3Page

import { useState, useEffect } from 'react';
import { useLiff } from '../../providers/LiffProvider';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface MatchItem {
    id: string;
    booking_id: string;
    host_team_size: number;
    slots_total: number;
    slots_filled: number;
    deposit_per_joiner: number;
    skill_level: string;
    note: string | null;
    status: string;
    expires_at: string;
    fieldLabel: string;
    booking: {
        date: string;
        time_from: string;
        time_to: string;
        field_no: number;
        price_total_thb: number;
        display_name: string;
    };
}

const SKILL_MAP: Record<string, { label: string; color: string; bg: string }> = {
    casual: { label: '🟢 ลำลอง', color: '#16a34a', bg: '#f0fdf4' },
    intermediate: { label: '🟡 ปานกลาง', color: '#d97706', bg: '#fffbeb' },
    competitive: { label: '🔴 จริงจัง', color: '#dc2626', bg: '#fef2f2' },
};

export default function MatchBoardPage() {
    const { liffUser } = useLiff();
    const userId = liffUser?.userId || '';

    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Join state
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [joinConsent, setJoinConsent] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [paymentUrl, setPaymentUrl] = useState('');

    useEffect(() => { fetchMatches(); }, []);

    async function fetchMatches() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/open-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ action: 'list' }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            setMatches(data.matches || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleJoin(matchId: string) {
        if (!joinConsent) {
            setJoinError('กรุณากดยอมรับเงื่อนไขก่อน');
            return;
        }
        if (!userId) {
            setJoinError('กรุณาเข้าใช้งานผ่าน LINE');
            return;
        }

        setJoinError('');
        setJoiningId(matchId);

        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/join-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ matchId, userId }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'ไม่สามารถเข้าร่วมได้');

            if (data.clientSecret && data.paymentIntentId) {
                setPaymentUrl(`/booking-success?payment_intent_client_secret=${data.clientSecret}&type=match_join&matchId=${matchId}&amount=${data.amount}`);
                setJoinSuccess(true);
            } else {
                throw new Error('ไม่สามารถสร้าง QR ชำระเงินได้');
            }
        } catch (err: any) {
            setJoinError(err.message);
            setJoiningId(null);
        }
    }

    // ─── Redirect to payment ────────
    if (joinSuccess && paymentUrl) {
        window.location.hash = paymentUrl;
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
                    <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500 mt-4 text-sm">กำลังพาไปหน้าชำระเงิน...</p>
                </div>
            </div>
        );
    }

    // ─── Loading ──────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 mt-4 text-sm">กำลังค้นหาห้องเตะบอล...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-8">
            {/* Header — ตรงกับ BookingV3 */}
            <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-50 border-b border-gray-100">
                <div className="max-w-lg mx-auto flex items-center gap-3">
                    <span className="text-2xl">⚽</span>
                    <div>
                        <h1 className="text-base font-extrabold text-gray-800 leading-tight">หาทีมแจม</h1>
                        <p className="text-[11px] text-gray-400 font-medium">เลือกห้องที่สนใจแล้วกดเข้าร่วมได้เลย!</p>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 mt-4">
                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Empty State */}
                {matches.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                        <div className="text-5xl mb-3">🏟️</div>
                        <p className="text-gray-600 font-semibold text-sm">ยังไม่มีห้องที่เปิดรับตอนนี้</p>
                        <p className="text-gray-400 text-xs mt-1">ลองเข้ามาดูใหม่ภายหลังนะครับ</p>
                        <button
                            onClick={fetchMatches}
                            className="mt-5 px-6 py-2.5 rounded-xl border-2 border-green-500 text-green-600 font-bold text-sm hover:bg-green-50 active:scale-95 transition-all"
                        >
                            🔄 รีเฟรช
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {matches.map(match => {
                            const skill = SKILL_MAP[match.skill_level] || SKILL_MAP.casual;
                            const slotsLeft = match.slots_total - match.slots_filled;
                            const isJoining = joiningId === match.id;
                            const fillPercent = (match.slots_filled / match.slots_total) * 100;

                            return (
                                <div
                                    key={match.id}
                                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
                                >
                                    {/* Card Header — สนาม + ระดับ */}
                                    <div className="px-5 pt-5 pb-3 flex justify-between items-center">
                                        <span className="text-base font-bold text-gray-800">{match.fieldLabel}</span>
                                        <span
                                            className="text-xs font-semibold px-3 py-1 rounded-full"
                                            style={{ backgroundColor: skill.bg, color: skill.color }}
                                        >
                                            {skill.label}
                                        </span>
                                    </div>

                                    {/* Info Grid */}
                                    <div className="px-5 pb-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">📅</span>
                                            <span>{match.booking?.date}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">⏰</span>
                                            <span>{match.booking?.time_from} - {match.booking?.time_to}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">👥</span>
                                            <span>ขาดอีก <b className="text-green-600">{slotsLeft}</b> คน</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">💰</span>
                                            <span>มัดจำ <b className="text-green-600 text-lg">฿{match.deposit_per_joiner}</b></span>
                                        </div>
                                    </div>

                                    {/* Note */}
                                    {match.note && (
                                        <div className="mx-5 mb-3 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500 border border-gray-100">
                                            💬 {match.note}
                                        </div>
                                    )}

                                    {/* Slots Progress Bar */}
                                    <div className="mx-5 mb-1">
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                                                style={{ width: `${fillPercent}%` }}
                                            />
                                        </div>
                                        <p className="text-center text-[11px] text-gray-400 mt-1">
                                            เข้าร่วมแล้ว {match.slots_filled}/{match.slots_total} คน
                                        </p>
                                    </div>

                                    {/* Consent + CTA */}
                                    <div className="px-5 pb-5 pt-2">
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                                            <label className="flex items-start gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={joinConsent}
                                                    onChange={e => { setJoinConsent(e.target.checked); setJoinError(''); }}
                                                    className="mt-0.5 w-4 h-4 accent-red-500 shrink-0"
                                                />
                                                <span className="text-[11px] text-gray-700 leading-relaxed">
                                                    ⚠️ ยอมรับว่ามัดจำ {match.deposit_per_joiner} บาท (ค่าสนามหารเท่ากัน){' '}
                                                    <b className="text-red-500">ไม่สามารถยกเลิก หรือขอคืนเงินได้ทุกกรณี</b>
                                                </span>
                                            </label>
                                        </div>

                                        {joinError && joiningId === match.id && (
                                            <p className="text-red-500 text-xs text-center mb-2">❌ {joinError}</p>
                                        )}

                                        <button
                                            onClick={() => handleJoin(match.id)}
                                            disabled={isJoining || slotsLeft <= 0}
                                            className={`
                                                w-full py-3.5 rounded-xl text-white font-bold text-sm
                                                transition-all active:scale-[0.98]
                                                ${slotsLeft <= 0
                                                    ? 'bg-gray-300 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-green-600 to-green-500 hover:shadow-lg hover:shadow-green-200'
                                                }
                                                ${isJoining ? 'opacity-50 cursor-wait' : ''}
                                            `}
                                        >
                                            {isJoining
                                                ? '⏳ กำลังเข้าร่วม...'
                                                : slotsLeft <= 0
                                                    ? '🔒 เต็มแล้ว'
                                                    : `🤝 เข้าร่วมและชำระเงิน ฿${match.deposit_per_joiner}`}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
