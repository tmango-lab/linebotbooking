import { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Clock, User, Phone, FileText, AlertTriangle, Edit, Save, MessageSquare, CheckCircle2, Circle, Smartphone, Monitor, Tag } from 'lucide-react';
import { supabase } from '../../lib/api';

interface BookingDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: {
        id: number;
        name: string;
        tel: string;
        time_start: string;
        time_end: string;
        price: number;
        remark?: string;
        court_name?: string;
        admin_note?: string; // New field for internal note
        paid_at?: string | null;
        source?: string;
        is_promo?: boolean;
    } | null;
    onBookingCancelled: () => void;
    onBookingUpdated?: () => void; // New callback for updates
}

export default function BookingDetailModal({ isOpen, onClose, booking, onBookingCancelled, onBookingUpdated }: BookingDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // State for editable fields
    const [isEditingDetails, setIsEditingDetails] = useState(false); // Controls visibility of Name, Tel, Price inputs
    const [editName, setEditName] = useState('');
    const [editTel, setEditTel] = useState('');
    const [editPrice, setEditPrice] = useState<string>('');
    const [editNote, setEditNote] = useState('');
    const [isPaid, setIsPaid] = useState(false); // Local state for payment status

    // Reset state when modal opens or booking changes
    useEffect(() => {
        if (isOpen && booking) {
            setIsEditingDetails(false);
            setEditName(booking.name);
            setEditTel(booking.tel);
            setEditPrice(booking.price.toString());
            setEditNote(booking.admin_note || '');
            setIsPaid(!!booking.paid_at);

            setError(null);
            setIsConfirming(false);
            setCancelReason('');
        }
    }, [isOpen, booking]); // Ensure booking ID is key or deep compare if object ref changes

    if (!isOpen || !booking) return null;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));
        return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const updatePayload = {
                matchId: booking.id,
                // Always send current values
                price: parseInt(editPrice, 10),
                adminNote: editNote,
                isPaid: isPaid,
                customerName: editName,
                tel: editTel,
                // Pass context for Matchday updates (required by API)
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
                throw new Error(`Update failed: ${errorText}`);
            }

            await response.json();

            // Notify parent to refresh data
            if (onBookingUpdated) {
                onBookingUpdated();
            }

            // Close modal after saving
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
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    matchId: booking.id,
                    reason: cancelReason || 'Admin cancelled via Dashboard'
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

    const handleClose = () => {
        setIsConfirming(false);
        setIsEditingDetails(false);
        setCancelReason('');
        setError(null);
        onClose();
    };

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
                                {booking.source === 'line' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><Smartphone className="w-3 h-3 mr-1" />Line</span>}
                                {booking.source === 'admin' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Monitor className="w-3 h-3 mr-1" />Admin</span>}
                                {booking.is_promo && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800"><Tag className="w-3 h-3 mr-1" />Promo</span>}
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
                                            rows={3}
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
                                    <div className="mt-4 flex flex-col sm:flex-row-reverse gap-2">
                                        <button
                                            type="button"
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50"
                                            onClick={handleCancel}
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : null}
                                            ยืนยันดารยกเลิก
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
                                <div className="mt-6 flex justify-between items-center w-full">
                                    {/* Left: Cancel Booking */}
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
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
