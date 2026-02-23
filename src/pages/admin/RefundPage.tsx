
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { RefreshCw, ExternalLink, CheckCircle, AlertTriangle, FileText, XCircle } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/date';

interface RefundBooking {
    id: number;
    booking_id: string;
    created_at: string;
    date: string;
    time_from: string;
    time_to: string;
    display_name: string;
    price_total_thb: number;
    payment_slip_url: string;
    admin_note: string;
    status: string;
    payment_status: string;
}

export default function RefundPage() {
    const [refunds, setRefunds] = useState<RefundBooking[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState<string | null>(null);

    useEffect(() => {
        fetchRefunds();
    }, []);

    const fetchRefunds = async () => {
        setLoading(true);
        try {
            // Fetch bookings that are CANCELLED but have a SLIP URL
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('status', 'cancelled')
                .not('payment_slip_url', 'is', null) // Must have a slip
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setRefunds(data || []);
        } catch (err: any) {
            console.error('Error fetching refunds:', err);
            alert('Failed to load refund list');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkRefunded = async (booking: RefundBooking) => {
        const note = prompt('ระบุหมายเหตุการคืนเงิน (อ้างอิงการโอน):', 'โอนคืนแล้ว');
        if (!note) return;

        try {
            const { error } = await supabase
                .from('bookings')
                .update({
                    // We keep status as cancelled, but maybe update admin_note to say "REFUNDED"
                    // Or add a metadata field? For now, append to admin_note is safest.
                    admin_note: (booking.admin_note || '') + ` | [REFUNDED: ${note}]`
                })
                .eq('booking_id', booking.booking_id);

            if (error) throw error;

            alert('บันทึกสถานะคืนเงินเรียบร้อย ✅');
            fetchRefunds(); // Refresh
        } catch (err: any) {
            alert('Error updating: ' + err.message);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-red-500" /> รายการรอคืนเงิน (Refund Queue)
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">รายการที่ถูกยกเลิก (Quote Full / Cancelled) แต่มีการแนบสลิปโอนเงินเข้ามา</p>
                </div>
                <button
                    onClick={fetchRefunds}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {/* Refund List */}
            <div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200">
                <ul className="divide-y divide-gray-200">
                    {loading && refunds.length === 0 ? (
                        <li className="p-8 text-center text-gray-500">Loading...</li>
                    ) : (
                        <>
                            {refunds.length === 0 ? (
                                <li className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
                                    <CheckCircle className="h-12 w-12 text-green-100 mb-2" />
                                    <p className="text-lg font-medium text-gray-900">ไม่มีรายการตกค้าง</p>
                                    <p className="text-sm">ยอดเยี่ยม! จัดการคืนเงินครบทุกรายการแล้ว</p>
                                </li>
                            ) : (
                                refunds.map((booking) => {
                                    const isAlreadyRefunded = booking.admin_note?.includes('REFUNDED');
                                    const isQuotaError = booking.admin_note?.includes('QUOTA_FULL');

                                    return (
                                        <li key={booking.booking_id} className={`p-4 hover:bg-gray-50 transition-colors ${isAlreadyRefunded ? 'bg-gray-50/50' : 'bg-red-50/10'}`}>
                                            <div className="flex flex-col sm:flex-row justify-between gap-4">
                                                {/* Left: Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-xs text-gray-400">#{booking.booking_id}</span>
                                                        {isQuotaError && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                                                QUOTA FULL
                                                            </span>
                                                        )}
                                                        {isAlreadyRefunded && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                                                                <CheckCircle className="w-3 h-3" /> REFUNDED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-gray-900">{booking.display_name}</h3>
                                                    <div className="text-sm text-gray-600 flex items-center gap-4 mt-1">
                                                        <span>🗓️ {formatDate(booking.date)}</span>
                                                        <span>⏰ {formatTime(booking.time_from)} - {formatTime(booking.time_to)}</span>
                                                        <span className="font-bold text-gray-900">฿{booking.price_total_thb}</span>
                                                    </div>
                                                    {booking.admin_note && (
                                                        <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded flex items-start gap-1">
                                                            <FileText className="w-3 h-3 mt-0.5 flex-none" />
                                                            {booking.admin_note}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex flex-col items-end gap-2">
                                                    {booking.payment_slip_url && (
                                                        <button
                                                            onClick={() => setSelectedSlip(booking.payment_slip_url)}
                                                            className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                                                        >
                                                            <ExternalLink className="w-4 h-4" /> ดูสลิป
                                                        </button>
                                                    )}

                                                    {!isAlreadyRefunded ? (
                                                        <button
                                                            onClick={() => handleMarkRefunded(booking)}
                                                            className="mt-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 shadow-sm"
                                                        >
                                                            Mark as Refunded
                                                        </button>
                                                    ) : (
                                                        <span className="mt-2 text-xs text-gray-400 italic">ดำเนินการแล้ว</span>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })
                            )}
                        </>
                    )}
                </ul>
            </div>

            {/* Slip Modal */}
            {selectedSlip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedSlip(null)}>
                    <div className="relative max-w-lg w-full bg-white rounded-lg p-2" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                            onClick={() => setSelectedSlip(null)}
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                        <img src={selectedSlip} alt="Payment Slip" className="w-full h-auto rounded" />
                        <div className="mt-2 text-center text-sm text-gray-500">
                            คลิกด้านนอกเพื่อปิด
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
