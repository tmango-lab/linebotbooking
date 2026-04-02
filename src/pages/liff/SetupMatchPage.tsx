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
                .select('booking_id, date, time_from, time_to, field_no, price_total_thb, display_name, deposit_amount')
                .eq('booking_id', bookingId)
                .single();

            if (fetchErr || !data) {
                setError('ไม่พบข้อมูลการจอง');
                setLoading(false);
                return;
            }

            // Get field label
            const { data: field } = await supabase.from('fields').select('label').eq('id', data.field_no).single();

            setBooking({ ...data, fieldLabel: field?.label || `สนาม ${data.field_no}` });
            setLoading(false);
        }
        fetchBooking();
    }, [bookingId]);

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
            <div style={styles.container}>
                <div style={styles.spinner} />
                <p style={{ color: '#999', marginTop: 16 }}>กำลังโหลดข้อมูลการจอง...</p>
            </div>
        );
    }

    // ─── Success ────────────
    if (success) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ fontSize: 48, textAlign: 'center' as const }}>⚽</div>
                    <h2 style={styles.title}>ประกาศสำเร็จ!</h2>
                    <p style={styles.subtitle}>เปิดตี้หาทีมแจมเรียบร้อยแล้ว</p>
                    <div style={styles.infoBox}>
                        <p>💰 มัดจำ Joiner: <b>{depositCalc.perPerson} บาท/คน</b></p>
                        <p>🎯 หาอีก: <b>{slotsTotal} คน</b></p>
                        <p>📢 ระบบกำลังส่งประกาศไปหาเพื่อนเตะบอลให้คุณครับ</p>
                    </div>
                    <p style={{ textAlign: 'center' as const, color: '#666', fontSize: 14, marginTop: 16 }}>
                        สามารถปิดหน้านี้ได้เลยครับ 👋
                    </p>
                </div>
            </div>
        );
    }

    // ─── Form ───────────────
    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>⚽ เปิดตี้หาทีมแจม</h2>
                {booking && (
                    <div style={styles.bookingBanner}>
                        <p style={{ margin: 0, fontWeight: 600 }}>{booking.fieldLabel}</p>
                        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                            📅 {booking.date} | ⏰ {booking.time_from} - {booking.time_to}
                        </p>
                        <p style={{ margin: 0, color: '#06C755', fontWeight: 700, fontSize: 18 }}>
                            ฿{booking.price_total_thb?.toLocaleString()}
                        </p>
                    </div>
                )}

                {/* จำนวนคนกลุ่ม Host */}
                <div style={styles.field}>
                    <label style={styles.label}>👥 กลุ่มของคุณมีกี่คนแล้ว?</label>
                    <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => setHostTeamSize(Math.max(1, hostTeamSize - 1))}>−</button>
                        <span style={styles.stepValue}>{hostTeamSize}</span>
                        <button style={styles.stepBtn} onClick={() => setHostTeamSize(Math.min(30, hostTeamSize + 1))}>+</button>
                    </div>
                </div>

                {/* จำนวนคนที่ต้องการเพิ่ม */}
                <div style={styles.field}>
                    <label style={styles.label}>🔍 ต้องการคนเพิ่มกี่คน?</label>
                    <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => setSlotsTotal(Math.max(1, slotsTotal - 1))}>−</button>
                        <span style={styles.stepValue}>{slotsTotal}</span>
                        <button style={styles.stepBtn} onClick={() => setSlotsTotal(Math.min(20, slotsTotal + 1))}>+</button>
                    </div>
                </div>

                {/* สรุปผลคำนวณ */}
                <div style={styles.calcBox}>
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>ระบบหารเท่ากัน (Auto Split)</p>
                    <div style={styles.calcRow}>
                        <span>จำนวนผู้เล่นทั้งหมด</span>
                        <span style={{ fontWeight: 700 }}>{depositCalc.totalPlayers} คน</span>
                    </div>
                    <div style={styles.calcRow}>
                        <span>ค่ามัดจำ Joiner (ต่อคน)</span>
                        <span style={{ fontWeight: 700, color: '#06C755', fontSize: 20 }}>฿{depositCalc.perPerson}</span>
                    </div>
                    <div style={{ ...styles.calcRow, borderTop: '1px dashed #ddd', paddingTop: 8, marginTop: 4 }}>
                        <span>คุณเหลือจ่ายที่สนาม</span>
                        <span style={{ fontWeight: 700, color: '#FF6B35' }}>฿{depositCalc.hostRemaining?.toLocaleString()}</span>
                    </div>
                </div>

                {/* ระดับการเล่น */}
                <div style={styles.field}>
                    <label style={styles.label}>🎮 ระดับการเล่น</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[
                            { value: 'casual', label: '🟢 ลำลอง', color: '#4CAF50' },
                            { value: 'intermediate', label: '🟡 ปานกลาง', color: '#FF9800' },
                            { value: 'competitive', label: '🔴 จริงจัง', color: '#F44336' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setSkillLevel(opt.value)}
                                style={{
                                    ...styles.skillBtn,
                                    borderColor: skillLevel === opt.value ? opt.color : '#ddd',
                                    backgroundColor: skillLevel === opt.value ? `${opt.color}15` : '#fff',
                                    fontWeight: skillLevel === opt.value ? 700 : 400,
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ข้อความเพิ่มเติม */}
                <div style={styles.field}>
                    <label style={styles.label}>💬 ข้อความเพิ่มเติม (ไม่บังคับ)</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="เช่น หาระดับชิลๆ / มาเล่นเอาเหงื่อ / ยินดีต้อนรับทุกระดับ"
                        maxLength={200}
                        style={styles.textarea}
                    />
                </div>

                {/* Consent Checkbox */}
                <div style={styles.consentBox}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={e => setConsent(e.target.checked)}
                            style={{ marginTop: 3, width: 20, height: 20, accentColor: '#F44336' }}
                        />
                        <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>
                            ⚠️ ยอมรับว่าเมื่อสร้างประกาศแล้ว <b style={{ color: '#F44336' }}>จะไม่สามารถยกเลิกการจองและขอคืนเงินมัดจำได้</b>
                        </span>
                    </label>
                </div>

                {error && <p style={styles.error}>❌ {error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={!consent || submitting}
                    style={{
                        ...styles.submitBtn,
                        opacity: (!consent || submitting) ? 0.5 : 1,
                    }}
                >
                    {submitting ? '⏳ กำลังสร้างประกาศ...' : '📢 ประกาศหาทีม!'}
                </button>
            </div>
        </div>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
    },
    card: {
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    },
    title: {
        textAlign: 'center' as const,
        fontSize: 22,
        fontWeight: 800,
        margin: '0 0 16px',
        color: '#1a1a1a',
    },
    subtitle: {
        textAlign: 'center' as const,
        fontSize: 16,
        color: '#666',
        margin: '8px 0 0',
    },
    bookingBanner: {
        background: '#f8f9fa',
        borderLeft: '4px solid #06C755',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        display: 'block',
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 8,
        color: '#333',
    },
    stepper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    stepBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        border: '2px solid #06C755',
        background: '#fff',
        fontSize: 22,
        fontWeight: 700,
        color: '#06C755',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepValue: {
        fontSize: 32,
        fontWeight: 800,
        width: 60,
        textAlign: 'center' as const,
        color: '#1a1a1a',
    },
    calcBox: {
        background: 'linear-gradient(135deg, #f0fff4, #e8f5e9)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        border: '1px solid #c8e6c9',
    },
    calcRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        fontSize: 14,
    },
    skillBtn: {
        flex: 1,
        padding: '8px 4px',
        borderRadius: 8,
        border: '2px solid #ddd',
        background: '#fff',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    textarea: {
        width: '100%',
        minHeight: 70,
        borderRadius: 8,
        border: '1px solid #ddd',
        padding: 12,
        fontSize: 14,
        fontFamily: 'inherit',
        resize: 'vertical' as const,
        boxSizing: 'border-box' as const,
    },
    consentBox: {
        background: '#fff3e0',
        border: '1px solid #ffcc80',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    error: {
        color: '#d32f2f',
        fontSize: 14,
        textAlign: 'center' as const,
        marginBottom: 12,
    },
    submitBtn: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        border: 'none',
        background: 'linear-gradient(135deg, #06C755, #05a547)',
        color: '#fff',
        fontSize: 18,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    infoBox: {
        background: '#f0fff4',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        fontSize: 15,
        lineHeight: 2,
    },
    spinner: {
        width: 40,
        height: 40,
        border: '4px solid #06C755',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
};
