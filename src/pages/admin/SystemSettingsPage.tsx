import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Loader2, Save, BadgeDollarSign, Star } from 'lucide-react';

interface SystemSettings {
    id: number;
    stripe_deposit_amount: number;
    point_earn_condition_thb: number;
    point_earn_reward: number;
    updated_at: string;
    updated_by: string | null;
}

export default function SystemSettingsPage() {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>('');
    const [pointCondition, setPointCondition] = useState<string>('100');
    const [pointReward, setPointReward] = useState<string>('10');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') throw error;
            }

            if (data) {
                setSettings(data);
                setDepositAmount(data.stripe_deposit_amount.toString());
                setPointCondition((data.point_earn_condition_thb || 100).toString());
                setPointReward((data.point_earn_reward || 10).toString());
            } else {
                setDepositAmount('200');
                setPointCondition('100');
                setPointReward('10');
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const amount = parseFloat(depositAmount);
            const condition = parseInt(pointCondition);
            const reward = parseInt(pointReward);

            if (isNaN(amount) || amount < 0) {
                alert('กรุณากรอกจำนวนเงินมัดจำให้ถูกต้อง');
                setSaving(false);
                return;
            }
            if (isNaN(condition) || condition <= 0) {
                alert('กรุณากรอกเงื่อนไขแต้ม (จำนวนเงิน) ให้ถูกต้อง ต้องมากกว่า 0');
                setSaving(false);
                return;
            }
            if (isNaN(reward) || reward <= 0) {
                alert('กรุณากรอกจำนวนแต้มที่ได้ให้ถูกต้อง ต้องมากกว่า 0');
                setSaving(false);
                return;
            }

            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    id: 1,
                    stripe_deposit_amount: amount,
                    point_earn_condition_thb: condition,
                    point_earn_reward: reward,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            alert('บันทึกการตั้งค่าเรียบร้อยแล้ว ✅');
            await fetchSettings();
        } catch (err: any) {
            console.error('Error saving settings:', err);
            alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    // Preview calculation
    const previewCondition = parseInt(pointCondition) || 100;
    const previewReward = parseInt(pointReward) || 10;
    const previewPrice = 850;
    const previewPoints = Math.floor(previewPrice / previewCondition) * previewReward;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                <p className="text-gray-500 text-sm mt-1">ตั้งค่าระบบทั่วไป</p>
            </div>

            <div className="space-y-6">
                {/* Stripe/Payment Settings */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <BadgeDollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900">การชำระเงิน (Payment)</h2>
                            <p className="text-sm text-gray-500">ตั้งค่าที่เกี่ยวข้องกับการจ่ายเงินและมัดจำ</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="max-w-md">
                            <label className="text-sm font-bold text-gray-700 block mb-2">
                                ยอดมัดจำเริ่มต้น (Stripe Deposit Amount)
                            </label>
                            <p className="text-xs text-gray-500 mb-3">
                                จำนวนเงินที่ลูกค้าต้องจ่ายผ่าน QR Code ทันทีที่จอง (ยอดที่เหลือจะถูกหักลบและจ่ายหน้าสนาม)
                            </p>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">฿</span>
                                <input
                                    type="number"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    min={0}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900 text-lg"
                                    placeholder="200"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Point Earning Settings */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                            <Star className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900">ตั้งค่าคะแนนสะสม (Point Earning)</h2>
                            <p className="text-sm text-gray-500">กำหนดสัดส่วนแต้มที่ลูกค้าจะได้รับเมื่อจองและชำระเงินสำเร็จ</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex-1 max-w-xs">
                                <label className="text-sm font-bold text-gray-700 block mb-2">
                                    ทุกๆ (บาท)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">฿</span>
                                    <input
                                        type="number"
                                        value={pointCondition}
                                        onChange={(e) => setPointCondition(e.target.value)}
                                        min={1}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-900 text-lg"
                                        placeholder="100"
                                    />
                                </div>
                            </div>

                            <div className="text-2xl text-gray-300 font-light hidden sm:block mt-6">→</div>

                            <div className="flex-1 max-w-xs">
                                <label className="text-sm font-bold text-gray-700 block mb-2">
                                    ได้รับ (แต้ม)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 font-medium">⭐</span>
                                    <input
                                        type="number"
                                        value={pointReward}
                                        onChange={(e) => setPointReward(e.target.value)}
                                        min={1}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-900 text-lg"
                                        placeholder="10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preview Box */}
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-2">
                            <p className="text-sm text-orange-800 font-medium">
                                📌 ตัวอย่าง: ลูกค้าจองสนามราคา <span className="font-bold">{previewPrice.toLocaleString()} บาท</span>
                            </p>
                            <p className="text-sm text-orange-700 mt-1">
                                จะได้รับ = <span className="font-bold text-orange-900">⌊{previewPrice} ÷ {previewCondition}⌋ × {previewReward} = <span className="text-lg">{previewPoints} แต้ม</span></span>
                            </p>
                        </div>

                        <p className="text-xs text-gray-400 mt-1">
                            สูตร: FLOOR(ราคาจอง ÷ เงื่อนไข) × แต้มที่ได้ — ปัดเศษลง
                        </p>
                    </div>
                </div>

                {/* Last Updated + Save */}
                {settings && (
                    <div className="text-xs text-gray-400 text-right">
                        อัปเดตล่าสุด: {new Date(settings.updated_at).toLocaleString('th-TH')}
                    </div>
                )}

                <div className="flex justify-end mt-8">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        บันทึกการตั้งค่า
                    </button>
                </div>
            </div>
        </div>
    );
}
