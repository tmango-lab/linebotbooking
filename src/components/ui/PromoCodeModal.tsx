import { useState } from 'react';
import { X, Tag, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/api';

interface PromoCodeDetails {
    code: string;
    field_id: number;
    field_label?: string;
    field_type?: string;
    booking_date: string;
    time_from: string;
    time_to: string;
    duration_h: number;
    original_price: number;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    discount_amount: number;
    final_price: number;
    expires_at: string;
    status: 'active' | 'used' | 'expired';
    profile?: {
        team_name: string;
        phone_number: string;
    };
}


interface PromoCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (bookingDate: string, timeFrom?: string) => void;
}

const COURTS = [
    { id: 2424, name: 'สนาม 1', size: '5 คน' },
    { id: 2425, name: 'สนาม 2', size: '5 คน' },
    { id: 2428, name: 'สนาม 3', size: '7-8 คน' },
    { id: 2426, name: 'สนาม 4', size: '7 คน' },
    { id: 2427, name: 'สนาม 5', size: '7 คน' },
    { id: 2429, name: 'สนาม 6', size: '7 คน (ใหม่)' },
];

export default function PromoCodeModal({ isOpen, onClose, onSuccess }: PromoCodeModalProps) {
    const [promoCode, setPromoCode] = useState('');
    const [promoDetails, setPromoDetails] = useState<PromoCodeDetails | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleClose = () => {
        setPromoCode('');
        setPromoDetails(null);
        setCustomerName('');
        setPhoneNumber('');
        setError(null);
        setSuccess(false);
        onClose();
    };

    const handleValidateCode = async () => {
        if (promoCode.length !== 6 || !/^\d+$/.test(promoCode)) {
            setError('กรุณากรอกโค้ด 6 หลัก (ตัวเลขเท่านั้น)');
            return;
        }

        setValidating(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-promo-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: promoCode })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'ไม่สามารถตรวจสอบโค้ดได้');
            }

            const data = await response.json();

            if (!data.valid) {
                setError(data.reason || 'โค้ดไม่ถูกต้อง');
                return;
            }

            // Get court info
            const court = COURTS.find(c => c.id === data.code.field_id);

            setPromoDetails({
                ...data.code,
                field_label: court?.name || `สนาม ${data.code.field_id}`,
                field_type: court?.size || ''
            });

            // Auto-fill profile if available
            if (data.code.profile) {
                setCustomerName(data.code.profile.team_name || '');
                setPhoneNumber(data.code.profile.phone_number || '');
            }


        } catch (err: any) {
            console.error('Validation error:', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบโค้ด');
        } finally {
            setValidating(false);
        }
    };

    const handleConfirmBooking = async () => {
        if (!promoDetails) return;

        if (!customerName.trim()) {
            setError('กรุณากรอกชื่อผู้จอง');
            return;
        }

        if (!phoneNumber.trim() || !/^\d{9,10}$/.test(phoneNumber)) {
            setError('กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            console.log('[PromoCodeModal] Calling use-promo-code-and-book API...');
            console.log('[PromoCodeModal] Payload:', { promoCode, customerName: customerName.trim(), phoneNumber: phoneNumber.trim() });

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/use-promo-code-and-book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    promoCode: promoCode,
                    customerName: customerName.trim(),
                    phoneNumber: phoneNumber.trim()
                })
            });

            const responseData = await response.json();
            console.log('[PromoCodeModal] API Response:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || 'ไม่สามารถสร้างการจองได้');
            }

            // Success!
            console.log('[PromoCodeModal] Booking successful!');
            if (responseData.booking) {
                console.log('[PromoCodeModal] Full Booking Object:', JSON.stringify(responseData.booking, null, 2));
            }
            setSuccess(true);
            setError(null);

            // Auto-close after 2 seconds and navigate to booking date
            setTimeout(() => {
                onSuccess(promoDetails!.booking_date, promoDetails!.time_from);
                handleClose();
            }, 2000);


        } catch (err: any) {
            console.error('Booking error:', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการจอง');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatExpiryTime = (isoString: string) => {
        const date = new Date(isoString);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes} น.`;
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Tag className="h-5 w-5 text-green-600" />
                            <h2 className="text-xl font-semibold text-gray-900">ใช้โค้ดโปรโมชั่น</h2>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-500 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        {/* Success Message */}
                        {success && (
                            <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
                                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-green-700">จองสำเร็จ!</p>
                                    <p className="text-xs text-green-600 mt-1">โค้ดถูกใช้แล้ว กำลังปิดหน้าต่าง...</p>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Promo Code Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                กรอกโค้ดโปรโมชั่น (6 หลัก)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={promoCode}
                                    onChange={(e) => {
                                        setPromoCode(e.target.value.replace(/\D/g, ''));
                                        setPromoDetails(null);
                                        setError(null);
                                    }}
                                    placeholder="123456"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg font-mono tracking-widest"
                                    disabled={validating || loading}
                                />
                                <button
                                    onClick={handleValidateCode}
                                    disabled={promoCode.length !== 6 || validating || loading}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {validating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            ตรวจสอบ...
                                        </>
                                    ) : (
                                        'ตรวจสอบ'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Promo Details */}
                        {promoDetails && (
                            <>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                                        <CheckCircle className="h-5 w-5" />
                                        <span>โค้ดถูกต้อง!</span>
                                    </div>

                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">สนาม:</span>
                                            <span className="font-medium text-gray-900">
                                                {promoDetails.field_label} ({promoDetails.field_type})
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">วันที่:</span>
                                            <span className="font-medium text-gray-900">
                                                {formatDate(promoDetails.booking_date)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">เวลา:</span>
                                            <span className="font-medium text-gray-900">
                                                {promoDetails.time_from} - {promoDetails.time_to} ({promoDetails.duration_h} ชม.)
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">ราคาเต็ม:</span>
                                            <span className="font-medium text-gray-900">
                                                {promoDetails.original_price.toLocaleString()} บาท
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-green-700">
                                            <span className="font-medium">ส่วนลด:</span>
                                            <span className="font-semibold">
                                                {promoDetails.discount_type === 'percent'
                                                    ? `${promoDetails.discount_value}%`
                                                    : `${promoDetails.discount_value} บาท`}
                                                {' '}(-{promoDetails.discount_amount.toLocaleString()} บาท)
                                            </span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-green-300">
                                            <span className="font-semibold text-gray-900">ราคาหลังหัก:</span>
                                            <span className="font-bold text-lg text-green-700">
                                                {promoDetails.final_price.toLocaleString()} บาท
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 pt-1">
                                            ⏰ หมดอายุ: {formatExpiryTime(promoDetails.expires_at)}
                                        </div>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="space-y-3 pt-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ชื่อผู้จอง
                                        </label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="ชื่อ-นามสกุล"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            เบอร์โทรศัพท์
                                        </label>
                                        <input
                                            type="tel"
                                            maxLength={10}
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                            placeholder="0812345678"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 p-6 border-t border-gray-200">
                        <button
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleConfirmBooking}
                            disabled={!promoDetails || !customerName.trim() || !phoneNumber.trim() || loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    กำลังจอง...
                                </>
                            ) : (
                                'ยืนยันและจองเลย'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
