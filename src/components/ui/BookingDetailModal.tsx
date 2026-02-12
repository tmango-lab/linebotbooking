import { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Clock, User, Phone, AlertTriangle, Edit, Save, MessageSquare, CheckCircle2, Circle, Smartphone, Monitor, Tag, ExternalLink, QrCode, Banknote, Image as ImageIcon, ArrowRightLeft } from 'lucide-react';

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
    onReschedule?: (date: string) => void;
}

export default function BookingDetailModal({ isOpen, onClose, booking, onBookingCancelled, onBookingUpdated, onReschedule }: BookingDetailModalProps) {
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
            // Use paid_at as single source of truth (same as BookingCard)
            // For Cash bookings: paid_at is null until admin confirms → shows "Unpaid"
            // For QR bookings: paid_at is set by webhook when deposit confirmed → shows "Paid"
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
        // Use edited price if in edit mode, otherwise use booking price
        const netPrice = isEditingDetails && editPrice !== '' ? parseFloat(editPrice) : booking.price;

        let discount = 0;

        // Try to reverse engineer base price if discount exists
        const noteMatch = (booking.admin_note || '').match(/\(-(\d+)\)/);
        if (noteMatch) {
            discount = parseInt(noteMatch[1], 10);
        } else if (booking.discount) {
            discount = booking.discount;
        }

        const basePrice = netPrice + discount;

        // Deposit Logic
        const isDepositPaid = (booking.payment_method === 'qr' && (!!booking.paid_at || booking.payment_status === 'paid'));
        const depositAmount = isDepositPaid ? 200 : 0;

        // Balance Logic
        // If fully paid, balance is 0.
        // If deposit paid, balance = netPrice - deposit.
        // If unpaid, balance = netPrice.
        let balance = 0;

        if (isPaid) {
            balance = 0;
        } else if (isDepositPaid) {
            balance = Math.max(0, netPrice - depositAmount);
        } else {
            balance = netPrice;
        }

        return { basePrice, discount, netPrice, depositAmount, balance, isDepositPaid };
    };

    const { basePrice, discount, netPrice, depositAmount, balance, isDepositPaid } = getFinancials();

    const isPendingPayment = booking.status === 'pending_payment';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                📅 รายละเอียดการจอง
                            </h3>
                            {/* Status Badges */}
                            <div className="flex gap-2">
                                {(booking.source === 'line' || booking.source === 'line_bot_regular') && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800"><Smartphone className="w-3 h-3 mr-1" /> LINE</span>}
                                {booking.source === 'admin' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-800"><Monitor className="w-3 h-3 mr-1" /> Admin</span>}
                                {booking.is_promo && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-800"><Tag className="w-3 h-3 mr-1" /> Promo</span>}
                                {isPendingPayment && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 animate-pulse"><Clock className="w-3 h-3 mr-1" /> รอโอนมัดจำ</span>}
                                {booking.is_refunded && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">คืนเงินแล้ว</span>}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {!isEditingDetails && !isConfirming && (
                                <button
                                    type="button"
                                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-gray-100"
                                    onClick={() => setIsEditingDetails(true)}
                                    title="แก้ไขข้อมูล"
                                >
                                    <Edit className="h-5 w-5" />
                                </button>
                            )}
                            <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        {/* 2-Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* LEFT COLUMN: Customer & Payment Data */}
                            <div className="space-y-6">
                                {/* Customer Info Card */}
                                <div className="space-y-4">
                                    <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2 border-b pb-1">ข้อมูลลูกค้า</h4>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <User className="w-4 h-4 text-gray-400" /> ชื่อผู้จอง
                                        </label>
                                        {isEditingDetails ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                            />
                                        ) : (
                                            <div className="text-gray-900 font-medium text-base pl-1">{editName}</div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Phone className="w-4 h-4 text-gray-400" /> เบอร์โทรศัพท์
                                        </label>
                                        {isEditingDetails ? (
                                            <input
                                                type="tel"
                                                value={editTel}
                                                onChange={(e) => setEditTel(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                            />
                                        ) : (
                                            <div className="text-gray-900 font-medium text-base pl-1">{editTel || '-'}</div>
                                        )}
                                    </div>
                                </div>

                                {/* Payment Method Info */}
                                <div className="pt-4 border-t border-gray-100">
                                    <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">การชำระเงิน</h4>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`p-3 rounded-lg ${booking.payment_method === 'qr' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {booking.payment_method === 'qr' ? <QrCode className="w-6 h-6" /> : <Banknote className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900">
                                                {booking.payment_method === 'qr' ? 'โอนจ่าย (QR PromptPay)' : 'เงินสด / จ่ายหน้าสนาม'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {booking.payment_method === 'qr' ? 'มัดจำ 200 บาท' : 'ชำระเต็มจำนวนหน้าสนาม'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Slip Preview if available */}
                                    {booking.payment_slip_url && (
                                        <div className="mt-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center text-xs font-semibold text-gray-700">
                                                    <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                                                    หลักฐานการโอน (Slip)
                                                </div>
                                                <a href={booking.payment_slip_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
                                                    เปิดรูปเต็ม <ExternalLink className="w-3 h-3 ml-1" />
                                                </a>
                                            </div>
                                            <div className="relative group cursor-pointer overflow-hidden rounded-lg aspect-[3/4] bg-gray-100 flex items-center justify-center border border-gray-100">
                                                <img
                                                    src={booking.payment_slip_url}
                                                    alt="Payment Slip"
                                                    className="w-full h-full object-contain"
                                                    onClick={() => window.open(booking.payment_slip_url!, '_blank')}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeout Warning */}
                                    {isPendingPayment && booking.timeout_at && (
                                        <div className="mt-4 flex items-center bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                                            <AlertTriangle className="w-4 h-4 mr-2 text-amber-600 flex-shrink-0" />
                                            <div>
                                                <span>จะถูกยกเลิกอัตโนมัติเมื่อ: </span>
                                                <span className="font-bold block sm:inline sm:ml-1">{formatFullDateTime(booking.timeout_at)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Booking Details & Finance */}
                            <div className="space-y-6">
                                {/* Court & Time Card */}
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-bold text-indigo-900 text-lg">{booking.court_name || 'สนามไม่ระบุ'}</h4>
                                        <span className="bg-white text-indigo-600 text-xs font-bold px-2 py-1 rounded border border-indigo-200">
                                            ID: {booking.id}
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm text-indigo-800">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 opacity-70" />
                                            <span className="font-medium">{formatDate(booking.time_start)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 opacity-70" />
                                            <span className="font-medium">{formatTime(booking.time_start)} - {formatTime(booking.time_end)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Summary */}
                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                    <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">สรุปยอดเงิน</h4>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>ราคาปกติ (Base Price)</span>
                                            <span>{basePrice.toLocaleString()} ฿</span>
                                        </div>

                                        {discount > 0 && (
                                            <div className="flex justify-between text-sm text-red-600 font-medium">
                                                <span className="flex items-center"><Tag className="w-3 h-3 mr-1" /> ส่วนลด (Discount)</span>
                                                <span>- {discount.toLocaleString()} ฿</span>
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                                            <span className="font-bold text-gray-900">ยอดสุทธิ (Total)</span>
                                            {isEditingDetails ? (
                                                <div className="flex items-center">
                                                    <input
                                                        type="number"
                                                        value={editPrice}
                                                        onChange={(e) => setEditPrice(e.target.value)}
                                                        className="block w-32 rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 text-right border font-bold"
                                                    />
                                                    <span className="ml-2 text-gray-900 font-bold">฿</span>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-gray-900 text-lg">{netPrice.toLocaleString()} ฿</span>
                                            )}
                                        </div>

                                        {isDepositPaid && (
                                            <div className="flex justify-between text-sm text-green-700 font-medium bg-green-50 p-2 rounded border border-green-100">
                                                <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> จ่ายมัดจำแล้ว</span>
                                                <span>- {depositAmount.toLocaleString()} ฿</span>
                                            </div>
                                        )}

                                        <div className="pt-3 border-t-2 border-dashed border-gray-300 flex justify-between items-end mt-2">
                                            <span className="text-base font-bold text-gray-700">ยอดค้างชำระ (Balance)</span>
                                            <span className={`text-2xl font-black ${balance > 0 ? 'text-indigo-600' : 'text-green-600'}`}>
                                                {balance.toLocaleString()}
                                                <span className="text-sm font-normal text-gray-500 ml-1">฿</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Toggles */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">สถานะการชำระเงิน</label>

                                    {isPendingPayment && !isPaid ? (
                                        <button
                                            type="button"
                                            onClick={handleConfirmPayment}
                                            disabled={loading}
                                            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                        >
                                            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                            ยืนยันได้รับยอดโอน (Confirm Payment)
                                        </button>
                                    ) : (
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => setIsPaid(false)}
                                                className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all ${!isPaid ? 'bg-white text-red-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                <Circle className="w-4 h-4 mr-2" /> ยังไม่จ่าย
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsPaid(true)}
                                                className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all ${isPaid ? 'bg-white text-green-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> จ่ายแล้ว
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Internal Note */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <MessageSquare className="w-4 h-4 text-gray-400" /> Admin Note (ภายใน)
                                    </label>
                                    <textarea
                                        value={editNote}
                                        onChange={(e) => setEditNote(e.target.value)}
                                        rows={3}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                        placeholder="บันทึกช่วยจำสำหรับแอดมิน..."
                                    />
                                </div>

                                {/* Customer Remark */}
                                {booking.remark && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 italic">
                                        <span className="font-bold not-italic">Note ลูกค้า:</span> "{booking.remark}"
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-md">
                                <div className="flex">
                                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Cancellation Area (Expandable) */}
                        {isConfirming && (
                            <div className="mt-8 bg-red-50 p-6 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
                                <h4 className="text-red-800 font-bold mb-4 flex items-center">
                                    <AlertTriangle className="w-5 h-5 mr-2" /> ยืนยันการยกเลิกการจอง
                                </h4>

                                <label htmlFor="cancel_reason" className="block text-sm font-medium text-red-700 mb-2">
                                    ระบุสาเหตุ (Optional)
                                </label>
                                <input
                                    type="text"
                                    id="cancel_reason"
                                    className="block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 bg-white border"
                                    placeholder="เช่น ลูกค้าแจ้งยกเลิก, จองผิด"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                />

                                <div className="mt-4 flex items-center">
                                    <input
                                        id="refunded"
                                        type="checkbox"
                                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
                                        checked={isRefunded}
                                        onChange={(e) => setIsRefunded(e.target.checked)}
                                    />
                                    <label htmlFor="refunded" className="ml-2 block text-sm text-red-700 cursor-pointer font-medium">
                                        คืนเงินลูกค้าแล้ว (Mark confirmed refund)
                                    </label>
                                </div>

                                <div className="mt-6 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={loading}
                                        className="inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
                                    >
                                        {loading ? <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : null}
                                        ยืนยันยกเลิกทันที
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsConfirming(false)}
                                        className="inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                                    >
                                        เปลี่ยนใจ (ไม่ยกเลิก)
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        {!isConfirming && (
                            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-between gap-4">
                                <button
                                    type="button"
                                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                    onClick={() => setIsConfirming(true)}
                                >
                                    ยกเลิกการจอง
                                </button>

                                {onReschedule && (
                                    <button
                                        type="button"
                                        className="inline-flex justify-center items-center px-4 py-2 border border-indigo-200 text-sm font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                        onClick={() => onReschedule(booking.time_start)}
                                    >
                                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                                        ย้ายจอง
                                    </button>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        className="w-full sm:w-auto px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                        onClick={handleClose}
                                    >
                                        ปิด
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={loading}
                                        className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-colors disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {loading ? <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
                                        บันทึกการแก้ไข
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
