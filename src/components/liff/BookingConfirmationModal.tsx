import React, { useState, useEffect } from 'react';

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
    const [teamName, setTeamName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'field' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialProfile) {
            setTeamName(initialProfile.team_name || '');
            setPhoneNumber(initialProfile.phone_number || '');
        }
    }, [initialProfile, isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!teamName.trim() || !phoneNumber.trim()) {
            alert("Please provide both Team Name and Phone Number");
            return;
        }
        if (!/^0\d{8,9}$/.test(phoneNumber.trim().replace(/-/g, ''))) {
            alert("Please provide a valid Thai phone number (e.g. 0812345678)");
            return;
        }
        if (!paymentMethod) {
            alert("Please select a payment method");
            return;
        }
        setIsSubmitting(true);
        onConfirm(teamName.trim(), phoneNumber.trim(), paymentMethod);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="bg-green-600 p-6 text-white">
                    <h2 className="text-xl font-bold">Confirm Booking</h2>
                    <p className="text-green-100 text-sm opacity-90">Please review your details</p>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Booking Details Summary */}
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Court</span>
                            <span className="font-bold text-gray-800">{bookingDetails.fieldName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Date</span>
                            <span className="font-bold text-gray-800">{bookingDetails.date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Time</span>
                            <span className="font-bold text-gray-800">{bookingDetails.startTime} - {bookingDetails.endTime}</span>
                        </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-2 px-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Original Price</span>
                            <span className="text-gray-800 font-medium">฿{bookingDetails.originalPrice}</span>
                        </div>
                        {bookingDetails.discount > 0 && (
                            <div className="flex justify-between text-sm text-green-600 font-medium">
                                <span>Discount ({bookingDetails.couponName || 'Coupon'})</span>
                                <span>-฿{bookingDetails.discount}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between items-center">
                            <span className="font-bold text-gray-800">Total Price</span>
                            <span className="text-2xl font-black text-green-600">฿{bookingDetails.finalPrice}</span>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Profile Verification */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Contact Information</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Team Name</label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all font-medium"
                                    placeholder="e.g. Red Dragons"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all font-medium"
                                    placeholder="e.g. 0812345678"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Payment Method */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Payment Method</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentMethod('transfer')}
                                className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center space-y-1 ${paymentMethod === 'transfer'
                                    ? 'border-green-500 bg-green-50 text-green-600'
                                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                <span>Transfer</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('field')}
                                className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center space-y-1 ${paymentMethod === 'field'
                                    ? 'border-green-500 bg-green-50 text-green-600'
                                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                <span>Pay at Field</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className={`flex-[2] bg-[#06C755] text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all
                            ${isSubmitting ? 'opacity-50 grayscale' : 'hover:bg-green-600'}
                        `}
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm & Book'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingConfirmationModal;
