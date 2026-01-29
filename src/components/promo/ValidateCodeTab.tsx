// src/components/promo/ValidateCodeTab.tsx
import { useState } from 'react';
import { validatePromoCode, getFieldInfo, type PromoCode } from '../../lib/promoApi';
import { Search, CheckCircle, AlertCircle, Clock, Calendar, DollarSign, MapPin, Tag, User } from 'lucide-react';

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
                setError('ไม่พบรหัสโค้ดนี้ในระบบ');
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
                setError('โค้ดนี้ถูกใช้งานไปแล้ว');
            } else if (data.status === 'expired' || now > expiresAt) {
                setError('โค้ดนี้หมดอายุแล้ว');
            } else {
                setSuccess('โค้ดถูกต้อง พร้อมใช้งาน');
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการตรวจสอบ');
            console.error(err);
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

    const formatTime = (timeStr: string) => {
        return timeStr.substring(0, 5);
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('th-TH', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Input Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-gray-900">ตรวจสอบและใช้งานโค้ดส่วนลด</h2>
                    <p className="text-gray-500 mt-1">กรอกรหัส 6 หลักเพื่อตรวจสอบสถานะ</p>
                </div>

                <div className="max-w-md mx-auto">
                    <div className="relative">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            onKeyPress={(e) => e.key === 'Enter' && handleValidate()}
                            placeholder="กรอกรหัสโค้ด (เช่น A1B2C3)"
                            className="w-full pl-12 pr-4 py-4 text-lg bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all text-center tracking-widest font-mono uppercase"
                            maxLength={6}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                    </div>

                    <button
                        onClick={handleValidate}
                        disabled={loading || !code}
                        className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบโค้ด'}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Success Message */}
            {success && !error && !promoData?.status && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 flex items-center gap-3 text-green-700 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-medium">{success}</p>
                </div>
            )}

            {/* Promo Code Details Card */}
            {promoData && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                    <div className="border-b border-gray-100 bg-gray-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                <span className="font-mono text-2xl font-bold tracking-wider text-blue-600">{promoData.code}</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">รายละเอียดโค้ด</h3>
                                <p className="text-sm text-gray-500">สร้างเมื่อ {formatDateTime(promoData.created_at)}</p>
                            </div>
                        </div>

                        <div className={`
                            px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-1.5
                            ${promoData.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                            ${promoData.status === 'used' ? 'bg-gray-100 text-gray-700' : ''}
                            ${promoData.status === 'expired' ? 'bg-red-100 text-red-700' : ''}
                        `}>
                            <div className={`w-2 h-2 rounded-full ${promoData.status === 'active' ? 'bg-green-500' :
                                promoData.status === 'used' ? 'bg-gray-500' : 'bg-red-500'
                                }`} />
                            {promoData.status === 'active' ? 'ใช้งานได้' :
                                promoData.status === 'used' ? 'ถูกใช้แล้ว' : 'หมดอายุ'}
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">ส่วนลด</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {promoData.discount_type === 'percent'
                                                ? `${promoData.discount_value}%`
                                                : `${promoData.discount_value} บาท`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">วันที่จอง</p>
                                        <p className="font-medium text-gray-900">{formatDate(promoData.booking_date)}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">เวลา</p>
                                        <p className="font-medium text-gray-900">
                                            {formatTime(promoData.time_from)} - {formatTime(promoData.time_to)}
                                            <span className="text-gray-400 text-sm ml-2">({promoData.duration_h} ชม.)</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">สนาม</p>
                                        <p className="font-medium text-gray-900">
                                            {fieldInfo ? `${fieldInfo.label} ${fieldInfo.type}` : `สนาม #${promoData.field_id}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">สรุปราคา</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-lg font-bold text-green-600">{promoData.final_price.toLocaleString()}</span>
                                            <span className="text-gray-400 line-through text-sm">{promoData.original_price.toLocaleString()}</span>
                                            <span className="text-gray-600 text-sm">บาท</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">วันหมดอายุโค้ด</p>
                                        <p className="font-medium text-red-600">
                                            {formatDateTime(promoData.expires_at)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {promoData.status === 'used' && promoData.used_at && (
                            <div className="mt-8 bg-gray-50 rounded-lg p-4 border border-gray-100 flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900">ข้อมูลการใช้งาน</p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        ใช้โดย {promoData.used_by || 'Admin'} เมื่อ {formatDateTime(promoData.used_at)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {promoData.status === 'active' && (
                            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                <p className="text-gray-500 italic">
                                    * หน้าจอนี้สำหรับตรวจสอบสถานะเท่านั้น ไม่สามารถกดใช้สิทธิ์ได้ *
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
