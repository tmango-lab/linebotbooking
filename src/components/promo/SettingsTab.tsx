// src/components/promo/SettingsTab.tsx
import { useState, useEffect } from 'react';
import { getPromoSettings, updatePromoSettings, type PromoSettings } from '../../lib/promoApi';
import { Save, AlertTriangle, Check, Settings as SettingsIcon, Percent, DollarSign, Clock, Users, RefreshCw } from 'lucide-react';

export default function SettingsTab() {
    const [settings, setSettings] = useState<PromoSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await getPromoSettings();
            if (data) {
                setSettings(data);
            }
        } catch (err) {
            setError('ไม่สามารถโหลดการตั้งค่าได้');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const adminId = 'admin'; // TODO: Get from auth context
            const result = await updatePromoSettings(settings, adminId);

            if (result) {
                setSuccess('บันทึกการตั้งค่าสำเร็จ!');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError('ไม่สามารถบันทึกได้');
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาด');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    ไม่สามารถโหลดการตั้งค่าได้
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900">ตั้งค่าระบบโปรโมชั่น</h2>
                <p className="text-gray-500 mt-1">กำหนดกฎและเงื่อนไขสำหรับการใช้งานโค้ดส่วนลด</p>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 z-50">
                    <Check className="w-5 h-5" />
                    {success}
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Settings Card */}
                <div className="md:col-span-2 space-y-6">
                    {/* General Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <SettingsIcon className="w-4 h-4 text-blue-500" />
                                การใช้งานทั่วไป
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-gray-900">เปิดใช้งานระบบโปรโมชั่น</label>
                                    <p className="text-sm text-gray-500">เปิด/ปิด การแจกโค้ดส่วนลดทั้งหมด</p>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${settings.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Discount Value Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-500" />
                                มูลค่าส่วนลด
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className={`
                                    relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all
                                    ${settings.discount_type === 'fixed'
                                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                                        : 'border-gray-200 hover:border-blue-200'}
                                `}>
                                    <input
                                        type="radio"
                                        name="discount-type"
                                        className="sr-only"
                                        checked={settings.discount_type === 'fixed'}
                                        onChange={() => setSettings({ ...settings, discount_type: 'fixed' })}
                                    />
                                    <span className="flex flex-1">
                                        <span className="flex flex-col">
                                            <span className="flex items-center gap-2 block text-sm font-medium text-gray-900">
                                                <DollarSign className="w-4 h-4 text-gray-500" />
                                                จำนวนเงินคงที่ (บาท)
                                            </span>
                                            <input
                                                type="number"
                                                value={settings.discount_type === 'fixed' ? settings.discount_value : 50}
                                                onChange={(e) => setSettings({
                                                    ...settings,
                                                    discount_type: 'fixed',
                                                    discount_value: Number(e.target.value)
                                                })}
                                                disabled={settings.discount_type !== 'fixed'}
                                                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                            />
                                        </span>
                                    </span>
                                    <Check className={`h-5 w-5 text-blue-600 ${settings.discount_type === 'fixed' ? 'opacity-100' : 'opacity-0'}`} />
                                </label>

                                <label className={`
                                    relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all
                                    ${settings.discount_type === 'percent'
                                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                                        : 'border-gray-200 hover:border-blue-200'}
                                `}>
                                    <input
                                        type="radio"
                                        name="discount-type"
                                        className="sr-only"
                                        checked={settings.discount_type === 'percent'}
                                        onChange={() => setSettings({ ...settings, discount_type: 'percent' })}
                                    />
                                    <span className="flex flex-1">
                                        <span className="flex flex-col">
                                            <span className="flex items-center gap-2 block text-sm font-medium text-gray-900">
                                                <Percent className="w-4 h-4 text-gray-500" />
                                                เปอร์เซ็นต์ (%)
                                            </span>
                                            <input
                                                type="number"
                                                value={settings.discount_type === 'percent' ? settings.discount_value : 10}
                                                onChange={(e) => setSettings({
                                                    ...settings,
                                                    discount_type: 'percent',
                                                    discount_value: Number(e.target.value)
                                                })}
                                                disabled={settings.discount_type !== 'percent'}
                                                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                                max="100"
                                            />
                                        </span>
                                    </span>
                                    <Check className={`h-5 w-5 text-blue-600 ${settings.discount_type === 'percent' ? 'opacity-100' : 'opacity-0'}`} />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Rules Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                เงื่อนไขและข้อจำกัด
                            </h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ราคาจองขั้นต่ำ (บาท)</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="text-gray-500 sm:text-sm">฿</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={settings.min_booking_price}
                                        onChange={(e) => setSettings({ ...settings, min_booking_price: Number(e.target.value) })}
                                        className="block w-full rounded-lg border-gray-300 pl-7 pr-3 py-2 sm:text-sm border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">อายุของโค้ด (นาที)</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="number"
                                        value={settings.expiry_minutes}
                                        onChange={(e) => setSettings({ ...settings, expiry_minutes: Number(e.target.value) })}
                                        className="block w-full rounded-lg border-gray-300 pl-10 pr-3 py-2 sm:text-sm border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">จำกัดต่อวัน (โค้ด/คน)</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Users className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="number"
                                        value={settings.daily_limit_per_user}
                                        onChange={(e) => setSettings({ ...settings, daily_limit_per_user: Number(e.target.value) })}
                                        className="block w-full rounded-lg border-gray-300 pl-10 pr-3 py-2 sm:text-sm border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">ระยะเวลาใช้โค้ดซ้ำ (ชม.)</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <RefreshCw className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="number"
                                        value={settings.reuse_window_hours}
                                        onChange={(e) => setSettings({ ...settings, reuse_window_hours: Number(e.target.value) })}
                                        className="block w-full rounded-lg border-gray-300 pl-10 pr-3 py-2 sm:text-sm border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">0 = ปิดการใช้งานซ้ำ</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar / Actions */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-sm font-medium text-gray-900 mb-4">การบันทึก</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            การเปลี่ยนแปลงทั้งหมดจะมีผลทันทีหลังจากบันทึก โปรดตรวจสอบความถูกต้อง
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    บันทึกการตั้งค่า
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
