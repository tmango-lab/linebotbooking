import React from 'react';

import type { Coupon } from '../../hooks/useBookingLogic';

interface CouponBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    coupons: Coupon[];
    selectedCouponId: string | null;
    bestCouponId: string | null;
    onSelect: (coupon: Coupon | null) => void;
    originalPrice: number;
    // New
    appliedMainCoupon?: Coupon | null;
    appliedOntopCoupon?: Coupon | null;
    onSelectMain?: (c: Coupon | null) => void;
    onSelectOntop?: (c: Coupon | null) => void;
}

const CouponBottomSheet: React.FC<CouponBottomSheetProps> = ({
    isOpen,
    onClose,
    coupons,
    // selectedCouponId,
    // bestCouponId,
    // onSelect,
    originalPrice,
    // New Props for Split Logic
    appliedMainCoupon,
    appliedOntopCoupon,
    onSelectMain,
    onSelectOntop
}) => {
    const [designMode, setDesignMode] = React.useState<'TABS' | 'SLOTS'>('SLOTS');
    const [activeTab, setActiveTab] = React.useState<'MAIN' | 'ONTOP'>('MAIN');

    if (!isOpen) return null;

    // Separate coupons
    const mainCoupons = coupons.filter(c => c.category === 'MAIN');
    const ontopCoupons = coupons.filter(c => c.category === 'ONTOP');

    // [NEW] Validation Logic
    const handleSelectMain = (c: Coupon | null) => {
        if (!onSelectMain) return;

        if (c) {
            // Check if switching to a main coupon that DISALLOWS stacking, 
            // but an on-top is already applied.
            if (c.allow_ontop_stacking === false && appliedOntopCoupon && onSelectOntop) {
                alert(`คูปองหลีก "${c.name}" ไม่สามารถใช้ร่วมกับคูปองเสริมได้\nระบบจะยกเลิกการใช้คูปองเสริมอัตโนมัติ`);
                onSelectOntop(null); // Clear on-top
            }
        }
        onSelectMain(c);
    };

    const handleSelectOntop = (c: Coupon | null) => {
        if (!onSelectOntop) return;

        if (c && appliedMainCoupon) {
            // Check if Main Coupon DISALLOWS stacking
            if (appliedMainCoupon.allow_ontop_stacking === false) {
                alert(`ไม่สามารถใช้คูปองเสริมได้\nเนื่องจากคูปองหลัก "${appliedMainCoupon.name}" ไม่อนุญาตให้ใช้ร่วมกับคูปองเสริม`);
                return; // Block selection
            }
        }
        onSelectOntop(c);
    };

    // Helper to render a card (reused)
    const renderCouponCard = (coupon: Coupon, isSelected: boolean, onPick: () => void) => {
        const isEligible = originalPrice >= coupon.min_spend;
        return (
            <div
                key={coupon.id}
                onClick={() => isEligible && onPick()}
                className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer mb-3
                    ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'}
                    ${!isEligible ? 'opacity-50 grayscale' : ''}
                `}
            >
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <h3 className="font-bold text-gray-800">{coupon.name}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${coupon.category === 'MAIN' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                {coupon.category}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {coupon.discount_type === 'FIXED' ? `Get ฿${coupon.discount_value} OFF` : `Get ${coupon.discount_value}% OFF`}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-2">Min. Spend: ฿{coupon.min_spend}</p>
                    </div>
                    <div className="text-right ml-4">
                        <div className="text-2xl font-black text-green-600">
                            {coupon.discount_type === 'FIXED' ? `฿${coupon.discount_value}` : `${coupon.discount_value}%`}
                        </div>
                    </div>
                </div>
                {!isEligible && (
                    <div className="mt-2 text-[10px] font-medium text-red-500">
                        Add ฿{coupon.min_spend - originalPrice} more
                    </div>
                )}
                {isSelected && (
                    <div className="absolute top-1 right-1">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">

                {/* Header with Toggle */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Select Coupons</h2>
                    <button
                        onClick={() => setDesignMode(prev => prev === 'TABS' ? 'SLOTS' : 'TABS')}
                        className="text-xs bg-gray-100 px-3 py-1 rounded-full font-bold text-gray-500 hover:bg-gray-200"
                    >
                        Switch to {designMode === 'TABS' ? 'Slots' : 'Tabs'} UI
                    </button>
                </div>

                {/* --- DESIGN A: TABS --- */}
                {designMode === 'TABS' && (
                    <>
                        <div className="flex p-2 gap-2 bg-gray-50 mx-4 mt-4 rounded-xl">
                            <button
                                onClick={() => setActiveTab('MAIN')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'MAIN' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Main Coupon
                            </button>
                            <button
                                onClick={() => setActiveTab('ONTOP')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ONTOP' ? 'bg-white shadow text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                On-top Coupon
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {activeTab === 'MAIN' ? (
                                <>
                                    <div className="mb-2 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Main Coupons</span>
                                        {appliedMainCoupon && <button onClick={() => handleSelectMain(null)} className="text-xs text-red-500 font-bold">Clear</button>}
                                    </div>
                                    {mainCoupons.length === 0 ? <p className="text-center text-gray-400 py-8">No Main Coupons</p> :
                                        mainCoupons.map(c => renderCouponCard(c, appliedMainCoupon?.id === c.id, () => handleSelectMain(c)))
                                    }
                                </>
                            ) : (
                                <>
                                    <div className="mb-2 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">On-top Coupons</span>
                                        {appliedOntopCoupon && <button onClick={() => handleSelectOntop(null)} className="text-xs text-red-500 font-bold">Clear</button>}
                                    </div>
                                    {ontopCoupons.length === 0 ? <p className="text-center text-gray-400 py-8">No On-top Coupons</p> :
                                        ontopCoupons.map(c => renderCouponCard(c, appliedOntopCoupon?.id === c.id, () => handleSelectOntop(c)))
                                    }
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* --- DESIGN C: SLOTS --- */}
                {designMode === 'SLOTS' && (
                    <>
                        {/* Slots Area */}
                        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 border-b border-gray-200">
                            {/* Slot 1: Main */}
                            <button
                                onClick={() => setActiveTab('MAIN')}
                                className={`relative p-3 rounded-xl border-2 text-left transition-all group ${activeTab === 'MAIN' ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-100' : 'border-dashed border-gray-300 hover:border-blue-300'}`}
                            >
                                <span className="absolute -top-2 left-3 bg-gray-50 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Slot 1</span>
                                <div className="mt-1">
                                    <div className="text-xs font-bold text-gray-400 mb-1">MAIN COUPON</div>
                                    {appliedMainCoupon ? (
                                        <div className="text-blue-600 font-black text-lg truncate leading-tight">{appliedMainCoupon.name}</div>
                                    ) : (
                                        <div className="text-gray-300 font-bold text-lg">Empty</div>
                                    )}
                                </div>
                                {appliedMainCoupon && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); onSelectMain && onSelectMain(null); }}
                                        className="absolute top-2 right-2 p-1 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                )}
                            </button>

                            {/* Slot 2: On-top */}
                            <button
                                onClick={() => setActiveTab('ONTOP')}
                                className={`relative p-3 rounded-xl border-2 text-left transition-all group ${activeTab === 'ONTOP' ? 'border-purple-500 bg-white shadow-md ring-2 ring-purple-100' : 'border-dashed border-gray-300 hover:border-purple-300'}`}
                            >
                                <span className="absolute -top-2 left-3 bg-gray-50 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Slot 2</span>
                                <div className="mt-1">
                                    <div className="text-xs font-bold text-gray-400 mb-1">ON-TOP</div>
                                    {appliedOntopCoupon ? (
                                        <div className="text-purple-600 font-black text-lg truncate leading-tight">{appliedOntopCoupon.name}</div>
                                    ) : (
                                        <div className="text-gray-300 font-bold text-lg">Empty</div>
                                    )}
                                </div>
                                {appliedOntopCoupon && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); onSelectOntop && onSelectOntop(null); }}
                                        className="absolute top-2 right-2 p-1 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-2 h-2 rounded-full ${activeTab === 'MAIN' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Available {activeTab === 'MAIN' ? 'Main' : 'On-top'} Coupons
                                </span>
                            </div>

                            {activeTab === 'MAIN' ? (
                                mainCoupons.length === 0 ? <p className="text-center text-gray-400 py-8 italic">No coupons found for this slot.</p> :
                                    mainCoupons.map(c => renderCouponCard(c, appliedMainCoupon?.id === c.id, () => handleSelectMain(c)))
                            ) : (
                                ontopCoupons.length === 0 ? <p className="text-center text-gray-400 py-8 italic">No coupons found for this slot.</p> :
                                    ontopCoupons.map(c => renderCouponCard(c, appliedOntopCoupon?.id === c.id, () => handleSelectOntop(c)))
                            )}
                        </div>
                    </>
                )}

                <div className="p-4 border-t border-gray-100 bg-white">
                    <button onClick={onClose} className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg shadow-gray-200 hover:bg-gray-800 transition-colors">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CouponBottomSheet;
