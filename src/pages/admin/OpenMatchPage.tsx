// src/pages/admin/OpenMatchPage.tsx
// Admin Dashboard: จัดการ Open Matches

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

interface OpenMatch {
    id: string;
    booking_id: string;
    host_user_id: string;
    host_team_size: number;
    slots_total: number;
    slots_filled: number;
    deposit_per_joiner: number;
    note: string | null;
    skill_level: string;
    status: string;
    expires_at: string;
    created_at: string;
    booking?: any;
    joiners?: any[];
    fieldLabel?: string;
}

const STATUS_COLORS: Record<string, string> = {
    open: '#06C755',
    full: '#2196F3',
    cancelled: '#F44336',
    expired: '#999',
};

const SKILL_LABELS: Record<string, string> = {
    casual: '🟢 ลำลอง',
    intermediate: '🟡 ปานกลาง',
    competitive: '🔴 จริงจัง',
};

export default function OpenMatchPage() {
    const [matches, setMatches] = useState<OpenMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState<string | null>(null);

    useEffect(() => {
        fetchMatches();
    }, []);

    async function fetchMatches() {
        setLoading(true);
        try {
            let query = supabase
                .from('open_matches')
                .select(`
                    *,
                    joiners:match_joiners(*)
                `)
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // Enrich with booking data
            const bookingIds = [...new Set((data || []).map(m => m.booking_id))];
            const { data: bookings } = await supabase
                .from('bookings')
                .select('booking_id, date, time_from, time_to, field_no, price_total_thb, display_name')
                .in('booking_id', bookingIds);

            const bookingMap: Record<string, any> = {};
            (bookings || []).forEach(b => { bookingMap[b.booking_id] = b; });

            // Enrich with field labels
            const fieldNos = [...new Set((bookings || []).map(b => b.field_no))];
            const { data: fields } = await supabase.from('fields').select('id, label').in('id', fieldNos);
            const fieldMap: Record<number, string> = {};
            (fields || []).forEach(f => { fieldMap[f.id] = f.label; });

            const enriched = (data || []).map(m => ({
                ...m,
                booking: bookingMap[m.booking_id],
                fieldLabel: fieldMap[bookingMap[m.booking_id]?.field_no] || `สนาม ${bookingMap[m.booking_id]?.field_no}`,
            }));

            setMatches(enriched);
        } catch (err) {
            console.error('Fetch matches error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleForceCancel(matchId: string) {
        if (!cancelReason.trim()) {
            alert('กรุณาระบุเหตุผลในการยกเลิก');
            return;
        }

        setCancellingId(matchId);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/open-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
                body: JSON.stringify({
                    action: 'force_cancel',
                    matchId,
                    reason: cancelReason.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error);

            alert('ยกเลิกสําเร็จ! คืนเงิน (หัก 15%) เรียบร้อย');
            setShowCancelModal(null);
            setCancelReason('');
            fetchMatches();
        } catch (err: any) {
            alert(`เกิดข้อผิดพลาด: ${err.message}`);
        } finally {
            setCancellingId(null);
        }
    }

    const filtered = statusFilter === 'all' ? matches : matches.filter(m => m.status === statusFilter);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>⚽ Open Match Management</h1>
            <p style={{ color: '#666', marginBottom: 20 }}>จัดการห้องประกาศหาทีมแจม</p>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {['all', 'open', 'full', 'cancelled', 'expired'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 20,
                            border: statusFilter === s ? '2px solid #1a1a1a' : '1px solid #ddd',
                            background: statusFilter === s ? '#1a1a1a' : '#fff',
                            color: statusFilter === s ? '#fff' : '#333',
                            fontSize: 13,
                            fontWeight: statusFilter === s ? 700 : 400,
                            cursor: 'pointer',
                        }}
                    >
                        {s === 'all' ? `ทั้งหมด (${matches.length})` : `${s} (${matches.filter(m => m.status === s).length})`}
                    </button>
                ))}
                <button onClick={fetchMatches} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #06C755', background: '#fff', color: '#06C755', cursor: 'pointer', marginLeft: 'auto' }}>
                    🔄 รีเฟรช
                </button>
            </div>

            {loading ? (
                <p>กำลังโหลด...</p>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    <p style={{ fontSize: 48 }}>📋</p>
                    <p>ไม่มีข้อมูล</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {filtered.map(match => (
                        <div key={match.id} style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: 12,
                            padding: 20,
                            background: '#fff',
                            borderLeft: `4px solid ${STATUS_COLORS[match.status] || '#999'}`,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18 }}>{match.fieldLabel}</h3>
                                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>
                                        📅 {match.booking?.date} | ⏰ {match.booking?.time_from} - {match.booking?.time_to}
                                    </p>
                                    <p style={{ margin: '4px 0 0', color: '#999', fontSize: 12 }}>
                                        Host: {match.booking?.display_name} | Booking: {match.booking_id}
                                    </p>
                                </div>
                                <span style={{
                                    padding: '4px 12px',
                                    borderRadius: 20,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#fff',
                                    background: STATUS_COLORS[match.status] || '#999',
                                }}>
                                    {match.status.toUpperCase()}
                                </span>
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                                <div style={statBox}>
                                    <div style={statLabel}>ทีม Host</div>
                                    <div style={statValue}>{match.host_team_size} คน</div>
                                </div>
                                <div style={statBox}>
                                    <div style={statLabel}>ต้องการ</div>
                                    <div style={statValue}>{match.slots_total} คน</div>
                                </div>
                                <div style={statBox}>
                                    <div style={statLabel}>เข้าร่วม</div>
                                    <div style={{ ...statValue, color: '#06C755' }}>{match.slots_filled} คน</div>
                                </div>
                                <div style={statBox}>
                                    <div style={statLabel}>มัดจำ/คน</div>
                                    <div style={{ ...statValue, color: '#FF6B35' }}>฿{match.deposit_per_joiner}</div>
                                </div>
                            </div>

                            <p style={{ fontSize: 13, color: '#666', margin: '0 0 4px' }}>
                                ระดับ: {SKILL_LABELS[match.skill_level] || match.skill_level} | 
                                รายได้จาก Joiner: ฿{(match.slots_filled * match.deposit_per_joiner).toLocaleString()}
                            </p>
                            {match.note && <p style={{ fontSize: 13, color: '#888', margin: '4px 0' }}>💬 {match.note}</p>}

                            {/* Joiners list */}
                            {match.joiners && match.joiners.length > 0 && (
                                <div style={{ marginTop: 12, background: '#f8f9fa', borderRadius: 8, padding: 12 }}>
                                    <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 8px' }}>ผู้เข้าร่วม:</p>
                                    {match.joiners.map((j: any, i: number) => (
                                        <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < match.joiners!.length - 1 ? '1px solid #e8e8e8' : 'none' }}>
                                            <span style={{ fontSize: 13 }}>#{i + 1} {j.user_id.substring(0, 10)}...</span>
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: j.status === 'joined' ? '#06C755' : j.status === 'refunded' ? '#F44336' : '#FF9800',
                                            }}>
                                                {j.status === 'joined' ? '✅ จ่ายแล้ว' : j.status === 'refunded' ? '↩️ คืนเงินแล้ว' : '⏳ รอชำระ'} | ฿{j.deposit_paid || 0}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Force Cancel button (only for active matches) */}
                            {(match.status === 'open' || match.status === 'full') && (
                                <div style={{ marginTop: 12 }}>
                                    {showCancelModal === match.id ? (
                                        <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8, border: '1px solid #ffcc80' }}>
                                            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>⚠️ ยกเลิกห้อง (เหตุสุดวิสัย)</p>
                                            <select
                                                value={cancelReason}
                                                onChange={e => setCancelReason(e.target.value)}
                                                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, marginBottom: 8 }}
                                            >
                                                <option value="">-- เลือกเหตุผล --</option>
                                                <option value="ฝนตกหนัก">ฝนตกหนัก</option>
                                                <option value="ไฟดับ">ไฟดับ</option>
                                                <option value="น้ำท่วม">น้ำท่วม</option>
                                                <option value="สนามปิดกะทันหัน">สนามปิดกะทันหัน</option>
                                            </select>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    onClick={() => handleForceCancel(match.id)}
                                                    disabled={cancellingId === match.id || !cancelReason}
                                                    style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#F44336', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: cancellingId === match.id ? 0.5 : 1 }}
                                                >
                                                    {cancellingId === match.id ? '⏳...' : '🗑️ ยืนยันยกเลิก + คืนเงิน (หัก 15%)'}
                                                </button>
                                                <button
                                                    onClick={() => { setShowCancelModal(null); setCancelReason(''); }}
                                                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                                                >
                                                    ยกเลิก
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowCancelModal(match.id)}
                                            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #F44336', background: '#fff', color: '#F44336', fontSize: 13, cursor: 'pointer' }}
                                        >
                                            🗑️ Force Cancel (เหตุสุดวิสัย)
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const statBox: React.CSSProperties = {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    textAlign: 'center',
};

const statLabel: React.CSSProperties = {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
};

const statValue: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: '#333',
};
