// src/pages/liff/MatchBoardPage.tsx
// LIFF: กระดานหาทีมแจม (Match Board สำหรับ Joiner)

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

const SKILL_MAP: Record<string, { label: string; color: string }> = {
    casual: { label: '🟢 ลำลอง', color: '#4CAF50' },
    intermediate: { label: '🟡 ปานกลาง', color: '#FF9800' },
    competitive: { label: '🔴 จริงจัง', color: '#F44336' },
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

    // Fetch open matches
    useEffect(() => {
        fetchMatches();
    }, []);

    async function fetchMatches() {
        setLoading(true);
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

            // สร้าง PromptPay QR URL สำหรับ redirect ไปจ่าย
            if (data.clientSecret && data.paymentIntentId) {
                // redirect ไปยังหน้า payment ของ Stripe
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

    // ─── Success (redirect to payment) ────────
    if (joinSuccess && paymentUrl) {
        window.location.hash = paymentUrl;
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ textAlign: 'center' as const }}>
                        <div style={styles.spinner} />
                        <p style={{ marginTop: 16, color: '#666' }}>กำลังพาไปหน้าชำระเงิน...</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Loading ──────────────
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.spinner} />
                <p style={{ color: '#aaa', marginTop: 16 }}>กำลังค้นหาห้องเตะบอล...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={{ width: '100%', maxWidth: 440 }}>
                <h2 style={styles.pageTitle}>⚽ หาทีมแจม</h2>
                <p style={styles.pageSubtitle}>เลือกห้องที่สนใจแล้วกดเข้าร่วมได้เลย!</p>

                {error && <p style={styles.errorBox}>❌ {error}</p>}

                {matches.length === 0 ? (
                    <div style={styles.emptyCard}>
                        <p style={{ fontSize: 48, margin: 0 }}>🏟️</p>
                        <p style={{ color: '#666', margin: '8px 0 0' }}>ยังไม่มีห้องที่เปิดรับตอนนี้</p>
                        <p style={{ color: '#999', fontSize: 13 }}>ลองเข้ามาดูใหม่ภายหลังนะครับ</p>
                        <button onClick={fetchMatches} style={styles.refreshBtn}>🔄 รีเฟรช</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {matches.map(match => {
                            const skill = SKILL_MAP[match.skill_level] || SKILL_MAP.casual;
                            const slotsLeft = match.slots_total - match.slots_filled;
                            const isJoining = joiningId === match.id;


                            return (
                                <div key={match.id} style={styles.matchCard}>
                                    {/* Header */}
                                    <div style={styles.matchHeader}>
                                        <span style={{ fontSize: 16, fontWeight: 700 }}>{match.fieldLabel}</span>
                                        <span style={{ ...styles.skillBadge, backgroundColor: `${skill.color}20`, color: skill.color }}>
                                            {skill.label}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div style={styles.matchInfo}>
                                        <div style={styles.infoRow}>
                                            <span>📅</span>
                                            <span>{match.booking?.date}</span>
                                        </div>
                                        <div style={styles.infoRow}>
                                            <span>⏰</span>
                                            <span>{match.booking?.time_from} - {match.booking?.time_to}</span>
                                        </div>
                                        <div style={styles.infoRow}>
                                            <span>👥</span>
                                            <span>ทีม {match.host_team_size} คน ขาดอีก <b style={{ color: '#06C755' }}>{slotsLeft}</b> คน</span>
                                        </div>
                                        <div style={styles.infoRow}>
                                            <span>💰</span>
                                            <span>มัดจำ <b style={{ color: '#06C755', fontSize: 18 }}>฿{match.deposit_per_joiner}</b></span>
                                        </div>
                                    </div>

                                    {match.note && (
                                        <div style={styles.noteBox}>
                                            <span>💬 {match.note}</span>
                                        </div>
                                    )}

                                    {/* Slots bar */}
                                    <div style={styles.slotsBar}>
                                        <div style={{ ...styles.slotsFill, width: `${(match.slots_filled / match.slots_total) * 100}%` }} />
                                    </div>
                                    <p style={{ fontSize: 12, color: '#999', textAlign: 'center' as const, margin: '4px 0 12px' }}>
                                        เข้าร่วมแล้ว {match.slots_filled}/{match.slots_total} คน
                                    </p>

                                    {/* Consent + CTA */}
                                    <div style={styles.consentBox}>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={joinConsent}
                                                onChange={e => { setJoinConsent(e.target.checked); setJoinError(''); }}
                                                style={{ marginTop: 2, width: 18, height: 18, accentColor: '#F44336' }}
                                            />
                                            <span style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>
                                                ⚠️ ยอมรับว่ามัดจำ {match.deposit_per_joiner} บาท (ซึ่งเป็นค่าสนามแบบหารเท่ากัน) <b style={{ color: '#F44336' }}>ไม่สามารถยกเลิก ถอนตัว หรือขอคืนเงินได้ทุกกรณี</b>
                                            </span>
                                        </label>
                                    </div>

                                    {joinError && joiningId === match.id && (
                                        <p style={{ color: '#d32f2f', fontSize: 13, textAlign: 'center' as const, margin: '0 0 8px' }}>❌ {joinError}</p>
                                    )}

                                    <button
                                        onClick={() => handleJoin(match.id)}
                                        disabled={isJoining || slotsLeft <= 0}
                                        style={{
                                            ...styles.joinBtn,
                                            opacity: isJoining || slotsLeft <= 0 ? 0.5 : 1,
                                            background: slotsLeft <= 0
                                                ? '#ccc'
                                                : 'linear-gradient(135deg, #06C755, #05a547)',
                                        }}
                                    >
                                        {isJoining ? '⏳ กำลังเข้าร่วม...' : slotsLeft <= 0 ? '🔒 เต็มแล้ว' : `🤝 เข้าร่วมและชำระเงิน ฿${match.deposit_per_joiner}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
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
        flexDirection: 'column',
        alignItems: 'center',
        padding: 16,
        fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
    },
    pageTitle: {
        color: '#fff',
        textAlign: 'center' as const,
        fontSize: 24,
        fontWeight: 800,
        margin: '16px 0 4px',
    },
    pageSubtitle: {
        color: '#aaa',
        textAlign: 'center' as const,
        fontSize: 14,
        margin: '0 0 20px',
    },
    errorBox: {
        color: '#ff6b6b',
        textAlign: 'center' as const,
        fontSize: 14,
        marginBottom: 12,
    },
    card: {
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 420,
    },
    emptyCard: {
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        textAlign: 'center' as const,
    },
    refreshBtn: {
        marginTop: 16,
        padding: '10px 24px',
        borderRadius: 8,
        border: '2px solid #06C755',
        background: '#fff',
        color: '#06C755',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: 14,
    },
    matchCard: {
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    },
    matchHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    skillBadge: {
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
    },
    matchInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 12,
    },
    infoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        color: '#333',
    },
    noteBox: {
        background: '#f8f9fa',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        color: '#666',
        marginBottom: 12,
    },
    slotsBar: {
        height: 8,
        background: '#e8e8e8',
        borderRadius: 4,
        overflow: 'hidden',
    },
    slotsFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #06C755, #4CAF50)',
        borderRadius: 4,
        transition: 'width 0.3s ease',
    },
    consentBox: {
        background: '#fff8e1',
        border: '1px solid #ffe082',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    joinBtn: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        border: 'none',
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
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
