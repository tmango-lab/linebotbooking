
import { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Clock, User, Phone, FileText, AlertTriangle, Edit, Save, MessageSquare } from 'lucide-react';
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
    } | null;
    onBookingCancelled: () => void;
    onBookingUpdated?: () => void; // New callback for updates
}

export default function BookingDetailModal({ isOpen, onClose, booking, onBookingCancelled, onBookingUpdated }: BookingDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editPrice, setEditPrice] = useState<string>('');
    const [editNote, setEditNote] = useState('');

    // Reset state when modal opens or booking changes
    useEffect(() => {
        if (isOpen && booking) {
            setIsEditing(false);
            setEditPrice(booking.price.toString());
            setEditNote(booking.admin_note || '');
            setError(null);
            setIsConfirming(false);
            setCancelReason('');
        }
    }, [isOpen, booking]);

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

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    matchId: booking.id,
                    price: parseInt(editPrice, 10),
                    adminNote: editNote,
                    // Pass context for Matchday updates
                    timeStart: booking.time_start,
                    timeEnd: booking.time_end,
                    customerName: booking.name,
                    tel: booking.tel
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Update failed: ${errorText}`);
            }

            await response.json();

            // Notify parent
            if (onBookingUpdated) {
                onBookingUpdated();
            }

            // Close modal (or switch back to view mode)
            // User workflow: "When edit finished, update price..." - checking results usually easier if closed or refreshed.
            // Let's close it to be simple and trigger full refresh.
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
        setIsEditing(false);
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
                        {!isEditing && !isConfirming && (
                            <button
                                type="button"
                                className="bg-white rounded-md text-gray-400 hover:text-indigo-600 focus:outline-none"
                                onClick={() => setIsEditing(true)}
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
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                                {isEditing ? 'แก้ไขการจอง' : 'รายละเอียดการจอง'}
                            </h3>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                {/* Read-Only Info */}
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
                                <div className="flex items-center text-sm text-gray-600">
                                    <User className="w-4 h-4 mr-2 text-indigo-500" />
                                    <span className="font-medium text-gray-900">{booking.name}</span>
                                </div>
                                {booking.tel && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Phone className="w-4 h-4 mr-2 text-indigo-500" />
                                        <span>{booking.tel}</span>
                                    </div>
                                )}

                                <div className="border-t border-gray-200 pt-3 mt-3">
                                    {/* Editable Price */}
                                    <div className="flex items-center text-sm text-gray-600">
                                        <span className="w-4 flex justify-center mr-2 font-bold text-indigo-500">฿</span>
                                        <span className="min-w-[40px]">ราคา:</span>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                                className="ml-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border"
                                            />
                                        ) : (
                                            <span className="font-medium text-gray-900 ml-2">{booking.price.toLocaleString()} บาท</span>
                                        )}
                                    </div>

                                    {/* Internal Note (Admin Note) */}
                                    <div className={`flex items-start text-sm text-gray-600 mt-2 ${isEditing ? 'flex-col' : ''}`}>
                                        <div className="flex items-center mb-1">
                                            <MessageSquare className="w-4 h-4 mr-2 text-indigo-500 mt-0.5" />
                                            <span className="min-w-[60px] font-medium text-indigo-900">Note (ภายใน):</span>
                                        </div>
                                        {isEditing ? (
                                            <textarea
                                                value={editNote}
                                                onChange={(e) => setEditNote(e.target.value)}
                                                rows={3}
                                                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                                placeholder="บันทึกข้อความถึงทีมงาน..."
                                            />
                                        ) : (
                                            <span className="ml-2 text-gray-800 bg-yellow-50 px-2 py-1 rounded w-full block min-h-[24px]">
                                                {booking.admin_note || '-'}
                                            </span>
                                        )}
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

                            {/* Actions */}
                            {isEditing ? (
                                <div className="mt-6 flex flex-col sm:flex-row-reverse gap-2">
                                    <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm disabled:opacity-50"
                                        onClick={handleSave}
                                        disabled={loading}
                                    >
                                        {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        บันทึก
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm"
                                        onClick={() => setIsEditing(false)}
                                        disabled={loading}
                                    >
                                        ยกเลิก
                                    </button>
                                </div>
                            ) : isConfirming ? (
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
                                <div className="mt-6 flex flex-col sm:flex-row-reverse gap-2">
                                    <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-100 text-base font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                                        onClick={() => setIsConfirming(true)}
                                    >
                                        ยกเลิกการจอง
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                                        onClick={handleClose}
                                    >
                                        ปิด
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
