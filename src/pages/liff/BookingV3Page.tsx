import React from 'react';
import BookingGridVertical from '../../components/liff/BookingGridVertical';
import BookingSummary from '../../components/liff/BookingSummary';
import CouponBottomSheet from '../../components/liff/CouponBottomSheet';
import BookingConfirmationModal from '../../components/liff/BookingConfirmationModal';
import DateSelectionModal from '../../components/liff/DateSelectionModal';
import { useBookingLogic } from '../../hooks/useBookingLogic';

const BookingV3Page: React.FC = () => {
    const {
        isReady,
        fields,
        coupons,
        existingBookings,
        userProfile,
        selection,
        setSelection,
        isCouponSheetOpen,
        setIsCouponSheetOpen,
        isConfirmModalOpen,
        setIsConfirmModalOpen,

        originalPrice,
        bestCoupon,
        appliedCoupon,
        discount,
        finalPrice,
        errorMsg,
        selectedDate,
        setSelectedDate,
        isDateModalOpen,
        setIsDateModalOpen,
        getThaiDateString,
        getThaiDateShort,
        handleFinalConfirm,
        appliedMainCoupon,
        appliedOntopCoupon,
        setManualMainCoupon,
        setManualOntopCoupon,
        allowedPaymentMethods // [NEW] From hook
    } = useBookingLogic();

    if (!isReady) {
        return (
            <div className="p-4 flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
        );
    }

    const selectedField = fields.find(f => f.id === selection?.fieldId);

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-32">
            <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-50 flex justify-between items-center border-b border-gray-100">
                <div className="flex-1">
                    <button
                        onClick={() => setIsDateModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-2xl border border-gray-100 transition-all active:scale-95"
                    >
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">เลือกวัน</span>
                            <span className="text-sm font-extrabold text-gray-800">{getThaiDateShort(selectedDate)}</span>
                        </div>
                        <svg className="w-5 h-5 text-green-600 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
                {userProfile && (
                    <div className="text-right">
                        <div className="text-xs text-gray-400">ทีม</div>
                        <div className="text-sm font-bold text-green-600">{userProfile.team_name}</div>
                    </div>
                )}
            </header>

            <DateSelectionModal
                isOpen={isDateModalOpen}
                onClose={() => setIsDateModalOpen(false)}
                selectedDate={selectedDate}
                onSelect={(d) => {
                    setSelectedDate(d);
                    setSelection(null);
                }}
            />

            <main className="max-w-lg mx-auto">
                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center mx-4 mt-4">
                        <span className="mr-3">⚠️</span> {errorMsg}
                    </div>
                )}

                <div className="bg-white overflow-hidden border-b border-gray-200 shadow-sm">
                    <BookingGridVertical
                        key={selectedDate}
                        fields={fields}
                        existingBookings={existingBookings}
                        onSelect={(fid, start, end) => setSelection({ fieldId: fid, startTime: start, endTime: end })}
                    />
                </div>
            </main>

            <BookingSummary
                originalPrice={originalPrice}
                discount={discount}
                finalPrice={finalPrice}
                couponName={appliedCoupon?.name}
                onConfirm={() => setIsConfirmModalOpen(true)}
                onOpenCoupons={() => setIsCouponSheetOpen(true)}
                isVisible={!!selection}
            />

            <CouponBottomSheet
                isOpen={isCouponSheetOpen}
                onClose={() => setIsCouponSheetOpen(false)}
                coupons={coupons}
                selectedCouponId={appliedCoupon?.id || null}
                bestCouponId={bestCoupon?.id || null}
                onSelect={(c) => {
                    if (c === null) {
                        setManualMainCoupon(null);
                        setManualOntopCoupon(null);
                        return;
                    }
                    if (c.category === 'ONTOP') setManualOntopCoupon(c);
                    else setManualMainCoupon(c);
                }}
                originalPrice={originalPrice}
                // Connect new props
                appliedMainCoupon={appliedMainCoupon}
                appliedOntopCoupon={appliedOntopCoupon}
                onSelectMain={setManualMainCoupon}
                onSelectOntop={setManualOntopCoupon}
            />

            <BookingConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleFinalConfirm}
                bookingDetails={{
                    fieldName: `สนาม ${(selectedField?.name || '').replace('สนาม ', '').replace('#', '').trim()}`,
                    date: getThaiDateString(selectedDate),
                    startTime: selection?.startTime || '',
                    endTime: selection?.endTime || '',
                    originalPrice,
                    discount,
                    finalPrice,
                    couponName: appliedCoupon?.name
                }}
                allowedPaymentMethods={allowedPaymentMethods} // [new]
                initialProfile={userProfile ? {
                    team_name: userProfile.team_name,
                    phone_number: userProfile.phone_number
                } : null}
            />
        </div>
    );
};

export default BookingV3Page;
