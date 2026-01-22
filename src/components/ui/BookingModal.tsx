
import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { name: string; phone: string; note: string }) => Promise<void>;
    bookingDetails: {
        courtName: string;
        date: string;
        startTime: string;
        endTime: string;
        price?: number;
    } | null;
}

export default function BookingModal({ isOpen, onClose, onConfirm, bookingDetails }: BookingModalProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setName('');
            setPhone('');
            setNote('');
            setError(null);
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen || !bookingDetails) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone) {
            setError('กรุณากรอกชื่อและเบอร์โทรศัพท์');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onConfirm({ name, phone, note });
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'เกิดข้อผิดพลาดในการจอง');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Background backdrop */}
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                {/* Modal panel */}
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="absolute top-0 right-0 pt-4 pr-4">
                        <button
                            type="button"
                            className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                            onClick={onClose}
                        >
                            <span className="sr-only">Close</span>
                            <X className="h-6 w-6" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="sm:flex sm:items-start">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                สร้างการจองใหม่
                            </h3>

                            <div className="mt-4 bg-blue-50 p-4 rounded-md mb-6">
                                <p className="text-sm text-blue-800 font-semibold mb-1">{bookingDetails.courtName}</p>
                                <p className="text-sm text-blue-700">
                                    วันที่: {bookingDetails.date} <br />
                                    เวลา: {bookingDetails.startTime} - {bookingDetails.endTime}
                                </p>
                                {bookingDetails.price && (
                                    <p className="text-lg font-bold text-blue-900 mt-2">
                                        ราคา: {bookingDetails.price.toLocaleString()} บาท
                                    </p>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                        ชื่อผู้จอง <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            type="text"
                                            name="name"
                                            id="name"
                                            required
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder="ชื่อทีม หรือ ชื่อลูกค้า"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                        เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            type="tel"
                                            name="phone"
                                            id="phone"
                                            required
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder="08xxxxxxxx"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="note" className="block text-sm font-medium text-gray-700">
                                        หมายเหตุ (Matchday Note)
                                    </label>
                                    <div className="mt-1">
                                        <textarea
                                            id="note"
                                            name="note"
                                            rows={2}
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-600 text-sm mt-2">
                                        {error}
                                    </div>
                                )}

                                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                                กำลังบันทึก...
                                            </>
                                        ) : (
                                            'ยืนยันการจอง'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                                        onClick={onClose}
                                        disabled={loading}
                                    >
                                        ยกเลิก
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
