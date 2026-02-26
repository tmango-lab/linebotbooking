import React from 'react';

interface BookingSummaryProps {
    originalPrice: number;
    discount: number;
    finalPrice: number;
    couponName?: string;
    onConfirm: () => void;
    onOpenCoupons: () => void;
    isVisible: boolean;
}

const BookingSummary: React.FC<BookingSummaryProps> = ({
    originalPrice,
    discount,
    finalPrice,
    couponName,
    onConfirm,
    onOpenCoupons,
    isVisible
}) => {
    if (!isVisible) return null;

    const isCouponInvalid = couponName && discount === 0;

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

            <button
                onClick={onConfirm}
                className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
                ยืนยันการจอง
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
        </div>
    );
};

export default BookingSummary;
