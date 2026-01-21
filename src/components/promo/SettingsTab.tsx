// src/components/promo/SettingsTab.tsx
import { useState, useEffect } from 'react';
import { getPromoSettings, updatePromoSettings, type PromoSettings } from '../../lib/promoApi';

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

        if (!confirm('ยืนยันการบันทึกการตั้งค่า?')) return;

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
                <div className="text-gray-500">กำลังโหลด...</div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-500">ไม่สามารถโหลดการตั้งค่าได้</div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">⚙️ ตั้งค่าระบบโปรโมชั่น</h2>

            {/* Success/Error Messages */}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                    ✅ {success}
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    ❌ {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow p-6 space-y-6">
                {/* Enable/Disable */}
                <div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.enabled}
                            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-lg font-medium">เปิดใช้งานระบบโปรโมชั่น</span>
                    </label>
                </div>

                <hr />

                {/* Discount Configuration */}
                <div>
                    <h3 className="text-lg font-semibold mb-4">ส่วนลด</h3>

                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={settings.discount_type === 'fixed'}
                                onChange={() => setSettings({ ...settings, discount_type: 'fixed' })}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span>จำนวนเงินคงที่</span>
                            <input
                                type="number"
                                value={settings.discount_type === 'fixed' ? settings.discount_value : 50}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    discount_type: 'fixed',
                                    discount_value: Number(e.target.value)
                                })}
                                disabled={settings.discount_type !== 'fixed'}
                                className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                min="0"
                            />
                            <span>บาท</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={settings.discount_type === 'percent'}
                                onChange={() => setSettings({ ...settings, discount_type: 'percent' })}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span>เปอร์เซ็นต์</span>
                            <input
                                type="number"
                                value={settings.discount_type === 'percent' ? settings.discount_value : 10}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    discount_type: 'percent',
                                    discount_value: Number(e.target.value)
                                })}
                                disabled={settings.discount_type !== 'percent'}
                                className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                min="0"
                                max="100"
                            />
                            <span>%</span>
                        </label>
                    </div>
                </div>

                <hr />

                {/* Rules */}
                <div>
                    <h3 className="text-lg font-semibold mb-4">กฎการใช้งาน</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ราคาขั้นต่ำ (บาท)
                            </label>
                            <input
                                type="number"
                                value={settings.min_booking_price}
                                onChange={(e) => setSettings({ ...settings, min_booking_price: Number(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                min="0"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                ราคาจองขั้นต่ำที่จะได้รับโค้ดส่วนลด
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                หมดอายุภายใน (นาที)
                            </label>
                            <input
                                type="number"
                                value={settings.expiry_minutes}
                                onChange={(e) => setSettings({ ...settings, expiry_minutes: Number(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                min="1"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                โค้ดจะหมดอายุหลังจากสร้างกี่นาที
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                จำกัดต่อวัน (โค้ด/คน)
                            </label>
                            <input
                                type="number"
                                value={settings.daily_limit_per_user}
                                onChange={(e) => setSettings({ ...settings, daily_limit_per_user: Number(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                min="1"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                ผู้ใช้แต่ละคนสามารถรับโค้ดได้สูงสุดกี่โค้ดต่อวัน
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ใช้โค้ดซ้ำได้ (ชั่วโมง)
                            </label>
                            <input
                                type="number"
                                value={settings.reuse_window_hours}
                                onChange={(e) => setSettings({ ...settings, reuse_window_hours: Number(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                min="0"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                ผู้ใช้สามารถใช้โค้ดเดิมได้ภายในกี่ชั่วโมง (0 = ปิดการใช้ซ้ำ)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
            </div>
        </div>
    );
}
