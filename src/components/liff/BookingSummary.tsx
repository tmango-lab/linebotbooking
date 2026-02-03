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

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 animate-slide-up">
            <div className="flex justify-between items-center mb-3">
                <button
                    onClick={onOpenCoupons}
                    className="flex items-center space-x-2 text-sm text-gray-600 hover:text-green-600"
                >
                    <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">
                        {discount > 0 ? "COUPON APPLIED" : "ADD COUPON"}
                    </span>
                    <span className="truncate max-w-[150px] font-medium">
                        {couponName || "Select Coupon"}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <div className="text-right">
                    {discount > 0 && (
                        <div className="text-xs text-gray-400 line-through">฿{originalPrice}</div>
                    )}
                    <div className="text-xl font-bold text-gray-800">
                        ฿{finalPrice}
                    </div>
                </div>
            </div>

            <button
                onClick={onConfirm}
                className="w-full bg-[#06C755] text-white py-3 rounded-xl font-bold text-lg shadow-md active:scale-95 transition-transform"
            >
                Confirm Booking
            </button>
        </div>
    );
};

export default BookingSummary;
