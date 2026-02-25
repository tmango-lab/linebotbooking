import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Loader2, Save, BadgeDollarSign } from 'lucide-react';

interface SystemSettings {
    id: number;
    stripe_deposit_amount: number;
    updated_at: string;
    updated_by: string | null;
}

export default function SystemSettingsPage() {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>('');

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
                // Ignore 'Row not found' if it's new, though it should exist via migration
                if (error.code !== 'PGRST116') throw error;
            }

            if (data) {
                setSettings(data);
                setDepositAmount(data.stripe_deposit_amount.toString());
            } else {
                setDepositAmount('200'); // Default fallback
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
            if (isNaN(amount) || amount < 0) {
                alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
                setSaving(false);
                return;
            }

            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    id: 1,
                    stripe_deposit_amount: amount,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            alert('บันทึกการตั้งค่าเรียบร้อยแล้ว ✅');
            await fetchSettings(); // Refresh
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

                        {settings && (
                            <div className="text-xs text-gray-400">
                                อัปเดตล่าสุด: {new Date(settings.updated_at).toLocaleString('th-TH')}
                            </div>
                        )}
                    </div>
                </div>

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
