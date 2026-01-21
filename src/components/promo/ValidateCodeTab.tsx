// src/components/promo/ValidateCodeTab.tsx
import { useState } from 'react';
import { validatePromoCode, usePromoCode, getFieldInfo, type PromoCode } from '../../lib/promoApi';

export default function ValidateCodeTab() {
    const [code, setCode] = useState('');
    const [promoData, setPromoData] = useState<PromoCode | null>(null);
    const [fieldInfo, setFieldInfo] = useState<{ label: string; type: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleValidate = async () => {
        if (!code.trim()) {
            setError('กรุณากรอกรหัสโค้ด');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        setPromoData(null);
        setFieldInfo(null);

        try {
            const data = await validatePromoCode(code.trim());

            if (!data) {
                setError('ไม่พบรหัสโค้ดนี้');
                return;
            }

            setPromoData(data);

            // Get field info
            const field = await getFieldInfo(data.field_id);
            setFieldInfo(field);

            // Check expiry
            const now = new Date();
            const expiresAt = new Date(data.expires_at);

            if (data.status === 'used') {
                setError('โค้ดนี้ถูกใช้ไปแล้ว');
            } else if (data.status === 'expired' || now > expiresAt) {
                setError('โค้ดนี้หมดอายุแล้ว');
            } else {
                setSuccess('โค้ดถูกต้องและใช้งานได้!');
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการตรวจสอบ');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUseCode = async () => {
        console.log('handleUseCode called', promoData);

        if (!promoData) {
            console.log('No promo data');
            return;
        }

        // Confirm dialog removed - use code immediately

        console.log('Proceeding to use code...');
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const adminId = 'admin'; // TODO: Get from auth context
            console.log('Calling usePromoCode API...');
            const result = await usePromoCode(promoData.code, adminId);
            console.log('API result:', result);

            if (result) {
                setSuccess('ใช้โค้ดสำเร็จ!');
                setPromoData({ ...promoData, status: 'used' });
            } else {
                setError('ไม่สามารถใช้โค้ดได้');
            }
        } catch (err) {
            console.error('Error using code:', err);
            setError('เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatTime = (timeStr: string) => {
        return timeStr.substring(0, 5);
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        const bangkokTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));

        const hours = bangkokTime.getUTCHours().toString().padStart(2, '0');
        const minutes = bangkokTime.getUTCMinutes().toString().padStart(2, '0');

        return `วันนี้ ${hours}:${minutes} น.`;
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            active: 'bg-green-100 text-green-800',
            used: 'bg-gray-100 text-gray-800',
            expired: 'bg-red-100 text-red-800'
        };

        const labels = {
            active: 'ใช้งานได้',
            used: 'ใช้แล้ว',
            expired: 'หมดอายุ'
        };

        return (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[status as keyof typeof badges]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">🔍 ตรวจสอบและใช้โค้ดส่วนลด</h2>

            {/* Input Section */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    รหัสโค้ด
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleValidate()}
                        placeholder="กรอกรหัส 6 หลัก"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={6}
                    />
                    <button
                        onClick={handleValidate}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    ❌ {error}
                </div>
            )}

            {/* Success Message */}
            {success && !error && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                    ✅ {success}
                </div>
            )}

            {/* Promo Code Details */}
            {promoData && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-4 border-b">
                            <h3 className="text-xl font-bold">รายละเอียดโค้ด</h3>
                            {getStatusBadge(promoData.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">💳 รหัสโค้ด</p>
                                <p className="text-2xl font-bold text-blue-600">{promoData.code}</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">🎁 ส่วนลด</p>
                                <p className="text-lg font-semibold">
                                    {promoData.discount_type === 'percent'
                                        ? `${promoData.discount_value}%`
                                        : `${promoData.discount_value} บาท`}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">📅 วันที่จอง</p>
                                <p className="font-medium">{formatDate(promoData.booking_date)}</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">⏰ เวลา</p>
                                <p className="font-medium">
                                    {formatTime(promoData.time_from)} - {formatTime(promoData.time_to)}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">🏟️ สนาม</p>
                                <p className="font-medium">
                                    {fieldInfo ? `${fieldInfo.label} (${fieldInfo.type})` : `สนาม #${promoData.field_id}`}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">⏱️ ระยะเวลา</p>
                                <p className="font-medium">{promoData.duration_h} ชั่วโมง</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">💰 ราคาเดิม</p>
                                <p className="font-medium">{promoData.original_price.toLocaleString()} บาท</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">💵 ราคาหลังหัก</p>
                                <p className="text-lg font-bold text-green-600">
                                    {promoData.final_price.toLocaleString()} บาท
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">⏳ หมดอายุ</p>
                                <p className="font-medium text-red-600">
                                    {formatDateTime(promoData.expires_at)}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">📝 สร้างเมื่อ</p>
                                <p className="font-medium">{formatDateTime(promoData.created_at)}</p>
                            </div>
                        </div>

                        {promoData.status === 'active' && (
                            <button
                                onClick={handleUseCode}
                                disabled={loading}
                                className="w-full mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                            >
                                ✓ ใช้โค้ดนี้
                            </button>
                        )}

                        {promoData.status === 'used' && promoData.used_at && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">ใช้โดย: {promoData.used_by || 'ไม่ระบุ'}</p>
                                <p className="text-sm text-gray-600">เมื่อ: {formatDateTime(promoData.used_at)}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
