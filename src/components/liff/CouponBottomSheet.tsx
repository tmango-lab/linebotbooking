import React from 'react';

interface Coupon {
    id: string;
    campaign_id: number;
    name: string;
    discount_type: 'FIXED' | 'PERCENT';
    discount_value: number;
    min_spend: number;
    eligible_fields: number[] | null;
}

interface CouponBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    coupons: Coupon[];
    selectedCouponId: string | null;
    bestCouponId: string | null;
    onSelect: (coupon: Coupon | null) => void;
    originalPrice: number;
}

const CouponBottomSheet: React.FC<CouponBottomSheetProps> = ({
    isOpen,
    onClose,
    coupons,
    selectedCouponId,
    bestCouponId,
    onSelect,
    originalPrice
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[80vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center p-3">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                <div className="px-6 pb-4 flex justify-between items-center border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">My Coupons</h2>
                    <button
                        onClick={() => { onSelect(null); onClose(); }}
                        className="text-sm font-medium text-red-500 hover:text-red-600"
                    >
                        Remove Coupon
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {coupons.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No coupons available
                        </div>
                    ) : (
                        coupons.map(coupon => {
                            const isSelected = selectedCouponId === coupon.id;
                            const isBest = bestCouponId === coupon.id;
                            const isEligible = originalPrice >= coupon.min_spend;

                            return (
                                <div
                                    key={coupon.id}
                                    onClick={() => isEligible && (onSelect(coupon), onClose())}
                                    className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer
                                        ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'}
                                        ${!isEligible ? 'opacity-50 grayscale' : ''}
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                <h3 className="font-bold text-gray-800">{coupon.name}</h3>
                                                {isBest && (
                                                    <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                        Best Choice
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {coupon.discount_type === 'FIXED'
                                                    ? `Get ฿${coupon.discount_value} OFF`
                                                    : `Get ${coupon.discount_value}% OFF`
                                                }
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-2">
                                                Min. Spend: ฿{coupon.min_spend}
                                            </p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-2xl font-black text-green-600">
                                                {coupon.discount_type === 'FIXED' ? `฿${coupon.discount_value}` : `${coupon.discount_value}%`}
                                            </div>
                                        </div>
                                    </div>

                                    {!isEligible && (
                                        <div className="mt-2 text-[10px] font-medium text-red-500">
                                            Add ฿{coupon.min_spend - originalPrice} more to use this coupon
                                        </div>
                                    )}

                                    {isSelected && (
                                        <div className="absolute top-1 right-1">
                                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full py-4 font-bold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CouponBottomSheet;
