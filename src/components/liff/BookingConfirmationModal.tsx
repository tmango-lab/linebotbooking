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
    };
    allowedPaymentMethods: string[] | null; // [new]
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
    initialProfile,
    allowedPaymentMethods
}) => {
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'field' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [teamName, setTeamName] = useState(initialProfile?.team_name || '');
    const [phoneNumber, setPhoneNumber] = useState(initialProfile?.phone_number || '');

    // Update state when initialProfile changes (e.g. first open)
    React.useEffect(() => {
        if (initialProfile) {
            setTeamName(initialProfile.team_name || '');
            setPhoneNumber(initialProfile.phone_number || '');
        }
    }, [initialProfile]);

    if (!isOpen) return null;

    // Filter payment methods based on coupon
    const allowedMethods = (allowedPaymentMethods || []).map((m: string) => m.toLowerCase());

    // Check if empty (allow all) or contains QR variations
    const showQR = !allowedPaymentMethods || allowedMethods.length === 0 ||
        allowedMethods.some((m: string) =>
            m.includes('qr') ||
            m.includes('promt') ||
            m.includes('prompt')
        );

    // Check if empty (allow all) or contains Cash variations
    const showField = !allowedPaymentMethods || allowedMethods.length === 0 ||
        allowedMethods.some((m: string) =>
            m.includes('field') ||
            m.includes('เงินสด') ||
            m.includes('cash')
        );

    const handleConfirm = () => {
        if (!teamName.trim()) {
            alert("กรุณาระบุชื่อทีม/ผู้จอง");
            return;
        }
        if (!phoneNumber.trim()) {
            alert("กรุณาระบุเบอร์โทรศัพท์");
            return;
        }
        if (!paymentMethod) {
            alert("กรุณาเลือกวิธีชำระเงิน");
            return;
        }

        setIsSubmitting(true);
        onConfirm(teamName, phoneNumber, paymentMethod);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="bg-[#06C755] p-6 text-white text-center">
                    <h2 className="text-xl font-bold">ยืนยันการจอง</h2>
                    <p className="text-green-50 text-sm opacity-90">ตรวจสอบความถูกต้องก่อนยืนยัน</p>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Input Fields */}
                    <div className="space-y-4">
                        {initialProfile ? (
                            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">ชื่อทีม / ผู้จอง</span>
                                    <span className="font-bold text-gray-800">{teamName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">เบอร์โทรศัพท์</span>
                                    <span className="font-bold text-gray-800">{phoneNumber}</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">ชื่อทีม / ผู้จอง</label>
                                    <input
                                        type="text"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                        placeholder="เช่น หมูเด้ง เอฟซี"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                        placeholder="08x-xxx-xxxx"
                                    />
                                </div>
                            </>
                        )}
                    </div>

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
                        <div className={`grid gap-3 ${(showQR && showField) ? 'grid-cols-2' : 'grid-cols-1 max-w-[200px] mx-auto'}`}>
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
                                    <span className="text-[10px] sm:text-xs">QR PromtPay</span>
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
                                    <span className="text-[10px] sm:text-xs">เงินสด (หน้าสนาม)</span>
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
