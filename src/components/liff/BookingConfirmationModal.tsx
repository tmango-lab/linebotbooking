import React, { useState } from 'react';

interface BookingConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (teamName: string, phoneNumber: string, paymentMethod: string) => void;
    bookingDetails: {
        fieldName: string;
        date: string;
        startTime: string;
        endTime: string;
        originalPrice: number;
        discount: number;
        finalPrice: number;
        couponName?: string;
        appliedCoupon?: any; // Added appliedCoupon to access payment_methods
    };
    initialProfile: {
        team_name: string;
        phone_number: string;
    } | null;
}

const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    bookingDetails,
    initialProfile
}) => {
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'field' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    // Filter payment methods based on coupon
    const allowedMethods = bookingDetails.appliedCoupon?.campaigns?.payment_methods || [];
    const showQR = allowedMethods.length === 0 || allowedMethods.includes('qr');
    const showField = allowedMethods.length === 0 || allowedMethods.includes('field');

    const handleConfirm = () => {
        if (!paymentMethod) {
            alert("กรุณาเลือกวิธีชำระเงิน");
            return;
        }

        const team = initialProfile?.team_name || 'Guest';
        const phone = initialProfile?.phone_number || '';

        setIsSubmitting(true);
        onConfirm(team, phone, paymentMethod);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="bg-green-600 p-6 text-white text-center">
                    <h2 className="text-xl font-bold">ยืนยันการจอง</h2>
                    <p className="text-green-100 text-sm opacity-90">ตรวจสอบความถูกต้องก่อนยืนยัน</p>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">สนาม</span>
                            <span className="font-bold text-gray-800">{bookingDetails.fieldName.replace('สนาม ', '')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">วันที่</span>
                            <span className="font-bold text-gray-800">{bookingDetails.date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">เวลา</span>
                            <span className="font-bold text-gray-800">{bookingDetails.startTime} - {bookingDetails.endTime}</span>
                        </div>
                    </div>

                    <div className="space-y-2 px-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">ราคาปกติ</span>
                            <span className="text-gray-800 font-medium">฿{bookingDetails.originalPrice}</span>
                        </div>
                        {bookingDetails.discount > 0 && (
                            <div className="flex justify-between text-sm text-green-600 font-medium">
                                <span>ส่วนลด ({bookingDetails.couponName || 'คูปอง'})</span>
                                <span>-฿{bookingDetails.discount}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between items-center">
                            <span className="font-bold text-gray-800">ยอดชำระสุทธิ</span>
                            <span className="text-2xl font-black text-green-600">฿{bookingDetails.finalPrice}</span>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div className="space-y-3">
                        <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">เลือกวิธีชำระเงิน</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {showQR && (
                                <button
                                    onClick={() => setPaymentMethod('qr')}
                                    className={`py-4 px-2 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center space-y-2 ${paymentMethod === 'qr'
                                        ? 'border-green-500 bg-green-50 text-green-600'
                                        : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                        }`}
                                >
                                    {/* QR Icon */}
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 11v1m4-12h1m1 1v1m-5 9h1m1 1v1M7 4h1m-1 1v1m0 4v1m0 4v1m11-9h1m-1 1v1m0 4v1m0 4v1m-11 0h1m-1 1v1m5-9h1m-1 1v1m0 4v1m0 4v1m5-9h1m-1 1v1" />
                                        <rect x="3" y="3" width="6" height="6" rx="1" strokeWidth={2} />
                                        <rect x="15" y="3" width="6" height="6" rx="1" strokeWidth={2} />
                                        <rect x="3" y="15" width="6" height="6" rx="1" strokeWidth={2} />
                                    </svg>
                                    <span className="text-[10px] sm:text-xs">มัดจำ 200 บาท (QR)</span>
                                </button>
                            )}
                            {showField && (
                                <button
                                    onClick={() => setPaymentMethod('field')}
                                    className={`py-4 px-2 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center space-y-2 ${paymentMethod === 'field'
                                        ? 'border-green-500 bg-green-50 text-green-600'
                                        : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                        }`}
                                >
                                    {/* Cash Icon */}
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span className="text-[10px] sm:text-xs">จ่ายที่สนาม</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 flex space-x-3">
                    <button onClick={onClose} className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors">ยกเลิก</button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className={`flex-[2] bg-[#06C755] text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all
                            ${isSubmitting ? 'opacity-50 grayscale' : 'hover:bg-green-600'}
                        `}
                    >
                        {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingConfirmationModal;
