
import { useState } from 'react';
import { X, Loader2, Calendar, Clock, User, Phone, FileText, AlertTriangle } from 'lucide-react';
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
    } | null;
    onBookingCancelled: () => void;
}

export default function BookingDetailModal({ isOpen, onClose, booking, onBookingCancelled }: BookingDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    if (!isOpen || !booking) return null;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));
        return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
                    <div className="absolute top-0 right-0 pt-4 pr-4">
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
                                รายละเอียดการจอง
                            </h3>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
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
                                <div className="flex items-center text-sm text-gray-600">
                                    <span className="w-4 flex justify-center mr-2 font-bold text-indigo-500">฿</span>
                                    <span className="font-medium text-gray-900">{booking.price.toLocaleString()} บาท</span>
                                </div>
                                {booking.remark && (
                                    <div className="flex items-start text-sm text-gray-600 mt-2">
                                        <FileText className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                                        <span className="italic">{booking.remark}</span>
                                    </div>
                                )}
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
                                            {loading ? (
                                                <>
                                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                                    กำลังยกเลิก...
                                                </>
                                            ) : (
                                                'ยืนยันการยกเลิก'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
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
