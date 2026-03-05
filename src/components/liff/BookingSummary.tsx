import React from 'react';

interface BookingSummaryProps {
    originalPrice: number;
    discount: number;
    finalPrice: number;
    couponName?: string;
    isCouponInvalid?: boolean; // NEW: Explicitly pass validity
    onConfirm: () => void;
    onOpenCoupons: () => void;
    isVisible: boolean;
    // New Props for Booking Context (Time)
    selectedDate?: string;
    selectedTimeStart?: string;
    selectedTimeEnd?: string;
    selectedFieldName?: string;
}

const BookingSummary: React.FC<BookingSummaryProps> = ({
    originalPrice,
    discount,
    finalPrice,
    couponName,
    isCouponInvalid: explicitInvalid,
    onConfirm,
    onOpenCoupons,
    isVisible,
    selectedDate,
    selectedTimeStart,
    selectedTimeEnd,
    selectedFieldName
}) => {
    if (!isVisible) return null;

    const isCouponInvalid = explicitInvalid ?? Boolean(couponName && discount === 0);

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)] z-40 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={onOpenCoupons}
                    className="flex flex-col items-start group transition-all"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-colors ${discount > 0
                            ? "bg-green-100 text-green-700"
                            : isCouponInvalid ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                            }`}>
                            {discount > 0 ? "ใช้คูปองแล้ว" : isCouponInvalid ? "คูปองไม่ถูกต้อง" : "เลือกคูปอง"}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <span className={`text-sm font-bold truncate max-w-[180px] ${isCouponInvalid ? 'text-red-500' : 'text-gray-800'}`}>
                        {couponName || "แตะเพื่อเพิ่มส่วนลด"}
                    </span>
                    {isCouponInvalid && (
                        <span className="text-[10px] text-red-400 font-medium italic">ไม่ตรงเงื่อนไข (ยอดขั้นต่ำ)</span>
                    )}
                </button>

                <div className="text-right">
                    {discount > 0 && (
                        <div className="flex items-center justify-end gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">ลดไป ฿{discount}</span>
                            <span className="text-sm text-gray-400 line-through font-medium">฿{originalPrice}</span>
                        </div>
                    )}
                    <div className="text-2xl font-black text-gray-900 leading-none">
                        <span className="text-base font-bold mr-1 italic">฿</span>
                        {finalPrice.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Compact Time Display */}
            {(selectedDate && selectedTimeStart && selectedTimeEnd) && (
                <div className="mb-2 bg-indigo-50/50 rounded-lg p-2 border border-indigo-100 flex items-center justify-between shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                    <div className="flex items-center gap-2 pl-2">
                        <div className="w-7 h-7 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">เวลาที่เลือก</div>
                            <div className="font-black text-indigo-900 text-sm leading-none tracking-tight">{selectedTimeStart} - {selectedTimeEnd} น.</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-medium mb-0.5">{selectedDate}</div>
                        <div className="font-bold text-gray-600 text-[10px] bg-white border border-gray-100 px-1.5 py-0.5 rounded inline-block">{selectedFieldName || 'สนาม'}</div>
                    </div>
                </div>
            )}

            <button
                onClick={onConfirm}
                className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white shadow-green-200`}
            >
                ยืนยันการจอง
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
        </div>
    );
};

export default BookingSummary;
