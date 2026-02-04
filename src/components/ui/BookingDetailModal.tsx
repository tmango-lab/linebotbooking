import { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Clock, User, Phone, FileText, AlertTriangle, Edit, Save, MessageSquare, CheckCircle2, Circle, Smartphone, Monitor, Tag, ExternalLink, QrCode, Banknote, Image as ImageIcon } from 'lucide-react';

interface BookingDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: {
        id: string | number;
        name?: string;
        tel?: string;
        time_start: string;
        time_end: string;
        price: number;
        remark?: string;
        court_name?: string;
        admin_note?: string;
        paid_at?: string | null;
        source?: string;
        is_promo?: boolean;
        is_refunded?: boolean;
        discount?: number;
        status?: string;
        payment_method?: string;
        payment_status?: string;
        payment_slip_url?: string | null;
        timeout_at?: string | null;
    } | null;
    onBookingCancelled: () => void;
    onBookingUpdated?: () => void;
}

export default function BookingDetailModal({ isOpen, onClose, booking, onBookingCancelled, onBookingUpdated }: BookingDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [isRefunded, setIsRefunded] = useState(false);

    // State for editable fields
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editName, setEditName] = useState('');
    const [editTel, setEditTel] = useState('');
    const [editPrice, setEditPrice] = useState<string>('');
    const [editNote, setEditNote] = useState('');
    const [isPaid, setIsPaid] = useState(false);

    // Reset state when modal opens or booking changes
    useEffect(() => {
        if (isOpen && booking) {
            setIsEditingDetails(false);
            setEditName(booking.name || '');
            setEditTel(booking.tel || '');
            setEditPrice(booking.price?.toString() || '0');
            setEditNote(booking.admin_note || '');
            setIsPaid(!!booking.paid_at);

            setError(null);
            setIsConfirming(false);
            setCancelReason('');
        }
    }, [isOpen, booking?.id]);

    if (!isOpen || !booking) return null;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));
        return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const formatFullDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

            const updatePayload: any = {
                matchId: booking.id,
                price: parseInt(editPrice, 10),
                adminNote: editNote,
                isPaid: isPaid,
                customerName: editName,
                tel: editTel,
                timeStart: booking.time_start,
                timeEnd: booking.time_end,
            };

            // If manually marking as paid and it was pending_payment, update status to confirmed
            if (isPaid && booking.status === 'pending_payment') {
                updatePayload.status = 'confirmed';
                updatePayload.paymentStatus = 'paid';
            }

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatePayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Update failed: ${errorText}`);
            }

            await response.json();

            if (onBookingUpdated) {
                onBookingUpdated();
            }

            onClose();

        } catch (err: any) {
            console.error('Update failed:', err);
            setError(err.message || 'Failed to update booking');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    matchId: booking.id,
                    reason: cancelReason || 'Admin cancelled via Dashboard',
                    isRefunded: isRefunded
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            onBookingCancelled();
            handleClose();

        } catch (err: any) {
            console.error('Cancellation failed:', err);
            setError(err.message || 'Failed to cancel booking');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPayment = async () => {
        setIsPaid(true);
        // We will call handleSave which now handles the status update
        // But for better UX, let's trigger the save immediately
        setLoading(true);
        setError(null);

        try {
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

            const updatePayload = {
                matchId: booking.id,
                price: booking.price,
                adminNote: (booking.admin_note ? booking.admin_note + ' | ' : '') + '[Admin Confirm Payment]',
                isPaid: true,
                status: 'confirmed',
                paymentStatus: 'paid',
                customerName: booking.name,
                tel: booking.tel,
                timeStart: booking.time_start,
                timeEnd: booking.time_end,
            };

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatePayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Payment confirmation failed: ${errorText}`);
            }

            if (onBookingUpdated) onBookingUpdated();
            onClose();

        } catch (err: any) {
            setError(err.message || 'Failed to confirm payment');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setIsConfirming(false);
        setIsEditingDetails(false);
        setCancelReason('');
        setIsRefunded(false);
        setError(null);
        onClose();
    };

    const getFinancials = () => {
        const netPrice = booking.price;
        let discount = 0;

        const noteMatch = (booking.admin_note || '').match(/\(-(\d+)\)/);
        if (noteMatch) {
            discount = parseInt(noteMatch[1], 10);
        } else if (booking.discount) {
            discount = booking.discount;
        }

        const basePrice = netPrice + discount;

        // [NEW] Deposit and Balance logic
        // If payment_method is qr and it's paid (either confirmed status or has paid_at), 
        // we consider the 200 THB deposit as completed.
        const isDepositPaid = (booking.payment_method === 'qr' && (!!booking.paid_at || booking.payment_status === 'paid'));
        const depositAmount = isDepositPaid ? 200 : 0;
        const balance = netPrice - depositAmount;

        return { basePrice, discount, netPrice, depositAmount, balance, isDepositPaid };
    };

    const { basePrice, discount, netPrice, depositAmount, balance, isDepositPaid } = getFinancials();

    const isPendingPayment = booking.status === 'pending_payment';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="absolute top-0 right-0 pt-4 pr-4 flex gap-2">
                        {!isEditingDetails && !isConfirming && (
                            <button
                                type="button"
                                className="bg-white rounded-md text-gray-400 hover:text-indigo-600 focus:outline-none"
                                onClick={() => setIsEditingDetails(true)}
                                title="แก้ไขข้อมูล"
                            >
                                <span className="sr-only">Edit</span>
                                <Edit className="h-5 w-5" aria-hidden="true" />
                            </button>
                        )}
                        <button
                            type="button"
                            className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                            onClick={handleClose}
                        >
                            <span className="sr-only">Close</span>
                            <X className="h-6 w-6" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="sm:flex sm:items-start w-full">
                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center gap-2" id="modal-title">
                                <span>รายละเอียดการจอง</span>
                                {(booking.source === 'line' || booking.source === 'line_bot_regular') && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><Smartphone className="w-3 h-3 mr-1" />Line</span>}
                                {booking.source === 'admin' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Monitor className="w-3 h-3 mr-1" />Admin</span>}
                                {booking.is_promo && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800"><Tag className="w-3 h-3 mr-1" />Promo</span>}
                                {isPendingPayment && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 animate-pulse"><Clock className="w-3 h-3 mr-1" />รอจ่ายมัดจำ</span>}
                            </h3>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                {/* Time & Court Info */}
                                <div className="flex items-center text-sm text-gray-600">
                                    <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                                    <span className="font-medium text-gray-900">{formatDate(booking.time_start)}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <Clock className="w-4 h-4 mr-2 text-indigo-500" />
                                    <span className="font-medium text-gray-900">
                                        {formatTime(booking.time_start)} - {formatTime(booking.time_end)}
                                    </span>
                                </div>
                                {booking.court_name && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Monitor className="w-4 h-4 mr-2 text-indigo-500" />
                                        <span className="font-medium text-gray-900">สนาม: {booking.court_name}</span>
                                    </div>
                                )}

                                <div className="border-t border-gray-200 pt-3 mt-3 space-y-3">
                                    {/* Customer Name */}
                                    <div className="flex items-center text-sm text-gray-600">
                                        <User className="w-4 h-4 mr-2 text-indigo-500 flex-shrink-0" />
                                        {isEditingDetails ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border"
                                                placeholder="ชื่อลูกค้า"
                                            />
                                        ) : (
                                            <span className="font-medium text-gray-900">{editName}</span>
                                        )}
                                    </div>

                                    {/* Tel */}
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Phone className="w-4 h-4 mr-2 text-indigo-500 flex-shrink-0" />
                                        {isEditingDetails ? (
                                            <input
                                                type="tel"
                                                value={editTel}
                                                onChange={(e) => setEditTel(e.target.value)}
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border"
                                                placeholder="เบอร์โทรศัพท์"
                                            />
                                        ) : (
                                            <span>{editTel || '-'}</span>
                                        )}
                                    </div>

                                    {/* Payment Method & Status */}
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="flex items-center text-xs text-gray-500 bg-white p-2 rounded-md border border-gray-200">
                                            {booking.payment_method === 'qr' ? (
                                                <QrCode className="w-4 h-4 mr-2 text-green-600" />
                                            ) : (
                                                <Banknote className="w-4 h-4 mr-2 text-blue-600" />
                                            )}
                                            <span className="font-medium">{booking.payment_method === 'qr' ? 'มัดจำ 200 (QR)' : 'จ่ายหน้าสนาม'}</span>
                                        </div>
                                        <div className={`flex items-center text-xs p-2 rounded-md border border-gray-200 ${booking.paid_at ? 'bg-green-50 text-green-700 border-green-200' : (isPendingPayment ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-600')}`}>
                                            <CheckCircle2 className={`w-4 h-4 mr-2 ${booking.paid_at ? 'text-green-500' : 'text-gray-300'}`} />
                                            <span className="font-bold">{booking.paid_at ? 'ชำระแล้ว' : (isPendingPayment ? 'รอโอน' : 'ยังไม่ชำระ')}</span>
                                        </div>
                                    </div>

                                    {/* Timeout Info for Pending Payment */}
                                    {isPendingPayment && booking.timeout_at && (
                                        <div className="flex items-center bg-amber-50 p-2 rounded-md border border-amber-100 text-[11px] text-amber-800">
                                            <AlertTriangle className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                            <span>จะถูกยกเลิกอัตโนมัติหากไม่ชำระภายใน: </span>
                                            <span className="font-bold ml-1">{formatFullDateTime(booking.timeout_at)}</span>
                                        </div>
                                    )}

                                    {/* Price */}
                                    <div className="flex items-center text-sm text-gray-600">
                                        <span className="w-4 flex justify-center mr-2 font-bold text-indigo-500 flex-shrink-0">฿</span>
                                        <span className="min-w-[40px]">ราคา:</span>
                                        {isEditingDetails ? (
                                            <input
                                                type="number"
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                                className="ml-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border"
                                            />
                                        ) : (
                                            <span className="font-medium text-gray-900 ml-2">{parseInt(editPrice || '0').toLocaleString()} บาท</span>
                                        )}
                                    </div>

                                    {/* Payment Slip Preview */}
                                    {booking.payment_slip_url && (
                                        <div className="mt-3 bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center text-xs font-semibold text-gray-700">
                                                    <ImageIcon className="w-3 h-3 mr-1 text-indigo-500" />
                                                    สลิปมัดจำจาก LINE
                                                </div>
                                                <a
                                                    href={booking.payment_slip_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-indigo-600 hover:underline flex items-center"
                                                >
                                                    เปิดรูปเต็ม <ExternalLink className="w-2.5 h-2.5 ml-1" />
                                                </a>
                                            </div>
                                            <div className="relative group cursor-pointer overflow-hidden rounded-md border border-gray-100 aspect-[3/4] max-h-48 bg-gray-50 flex items-center justify-center">
                                                <img
                                                    src={booking.payment_slip_url}
                                                    alt="Payment Slip"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    onClick={() => window.open(booking.payment_slip_url!, '_blank')}
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                                                    <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Actions for Pending Payment */}
                                    {isPendingPayment && (
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                onClick={handleConfirmPayment}
                                                disabled={loading}
                                                className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-sm font-bold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                            >
                                                {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                แอดมินยืนยันได้รับเงินแล้ว (QR)
                                            </button>
                                        </div>
                                    )}

                                    {/* Payment Status (Always Editable Button Group) */}
                                    <div className="flex items-center text-sm text-gray-600 mt-2">
                                        <span className="w-4 flex justify-center mr-2 mt-0.5">
                                            {isPaid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                        </span>
                                        <span className="min-w-[40px] font-medium text-gray-900 mr-2">สถานะ:</span>
                                        <span className="relative z-0 inline-flex shadow-sm rounded-md">
                                            <button
                                                type="button"
                                                onClick={() => setIsPaid(false)}
                                                className={`relative inline-flex items-center px-3 py-1 text-xs font-medium rounded-l-md border ${!isPaid
                                                    ? 'bg-red-50 text-red-700 border-red-300 z-10'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                    } focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`}
                                            >
                                                ยังไม่จ่าย
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsPaid(true)}
                                                className={`relative -ml-px inline-flex items-center px-3 py-1 text-xs font-medium rounded-r-md border ${isPaid
                                                    ? 'bg-green-50 text-green-700 border-green-300 z-10'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                    } focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`}
                                            >
                                                จ่ายแล้ว
                                            </button>
                                        </span>
                                    </div>

                                    {/* Internal Note (Always Editable) */}
                                    <div className="flex flex-col items-start text-sm text-gray-600 mt-2">
                                        <div className="flex items-center mb-1">
                                            <MessageSquare className="w-4 h-4 mr-2 text-indigo-500 mt-0.5" />
                                            <span className="font-medium text-indigo-900">Note (ภายใน):</span>
                                        </div>
                                        <textarea
                                            value={editNote}
                                            onChange={(e) => setEditNote(e.target.value)}
                                            rows={2}
                                            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder="บันทึกข้อความถึงทีมงาน..."
                                        />
                                    </div>

                                    {/* Original Remark (Matchday Note) - Always Read Only */}
                                    {booking.remark && (
                                        <div className="flex items-start text-sm text-gray-400 mt-2">
                                            <FileText className="w-4 h-4 mr-2 mt-0.5 opacity-70" />
                                            <span className="italic text-xs">Note ลูกค้า: {booking.remark}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-red-700">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions Footer */}
                            {isConfirming ? (
                                <div className="mt-6 border-t border-gray-100 pt-4">
                                    <label htmlFor="cancel_reason" className="block text-sm font-medium text-gray-700 mb-2">
                                        สาเหตุการยกเลิก (ระบุหรือไม่ก็ได้)
                                    </label>
                                    <input
                                        type="text"
                                        id="cancel_reason"
                                        className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                        placeholder="เช่น ลูกค้าแจ้งยกเลิก"
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                    />

                                    {/* Refund Checkbox */}
                                    <div className="mt-4 flex items-center">
                                        <input
                                            id="refunded"
                                            type="checkbox"
                                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
                                            checked={isRefunded}
                                            onChange={(e) => setIsRefunded(e.target.checked)}
                                        />
                                        <label htmlFor="refunded" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                                            คืนเงินลูกค้าแล้ว (Mark as Refunded)
                                        </label>
                                    </div>

                                    <div className="mt-4 flex flex-col sm:flex-row-reverse gap-2">
                                        <button
                                            type="button"
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50"
                                            onClick={handleCancel}
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : null}
                                            ยืนยันการยกเลิก
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm"
                                            onClick={() => setIsConfirming(false)}
                                            disabled={loading}
                                        >
                                            กลับ
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-6 flex flex-col gap-4">
                                    {/* Financial Breakdown (View Only) */}
                                    {!isEditingDetails && (discount > 0 || isDepositPaid) && (
                                        <div className="bg-green-50 rounded-md p-3 border border-green-100 mb-2">
                                            <h4 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">สรุปยอดชำระ (Financial Summary)</h4>

                                            {discount > 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm text-gray-600">
                                                        <span>ราคาเต็ม (Base Price):</span>
                                                        <span>{basePrice.toLocaleString()} บ.</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm text-red-600 font-medium">
                                                        <span>ส่วนลด (Discount):</span>
                                                        <span>-{discount.toLocaleString()} บ.</span>
                                                    </div>
                                                </>
                                            )}

                                            <div className={`flex justify-between text-sm font-bold ${isDepositPaid ? 'text-gray-600' : 'text-gray-900'} ${discount > 0 ? 'border-t border-green-200 mt-1 pt-1' : ''}`}>
                                                <span>ยอดสุทธิ (Total):</span>
                                                <span>{netPrice.toLocaleString()} บ.</span>
                                            </div>

                                            {isDepositPaid && (
                                                <>
                                                    <div className="flex justify-between text-sm text-green-700 font-medium mt-1">
                                                        <span>จ่ายมัดจำแล้ว (Paid Deposit):</span>
                                                        <span>-{depositAmount.toLocaleString()} บ.</span>
                                                    </div>
                                                    <div className="border-t border-green-300 mt-1 pt-1 flex justify-between text-base font-extrabold text-indigo-700">
                                                        <span>คงค้างหน้าสนาม (Balance):</span>
                                                        <span>{balance.toLocaleString()} บ.</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Refund Status */}
                                    {booking.is_refunded && (
                                        <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm font-bold border border-red-200 text-center">
                                            💰 ได้รับการคืนเงินแล้ว (Refunded)
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center w-full">
                                        {/* Left: Cancel Booking using existing code */}
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                            onClick={() => setIsConfirming(true)}
                                        >
                                            ยกเลิกการจอง
                                        </button>


                                        {/* Right: Save & Close */}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm"
                                                onClick={handleClose}
                                            >
                                                ปิด
                                            </button>
                                            <button
                                                type="button"
                                                className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm disabled:opacity-50"
                                                onClick={handleSave}
                                                disabled={loading}
                                            >
                                                {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                บันทึก
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
