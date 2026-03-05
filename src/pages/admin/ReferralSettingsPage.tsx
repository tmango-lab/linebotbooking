import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/api';
import { Loader2, Save, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/date';

interface ReferralProgram {
    id: string;
    name: string;
    is_active: boolean;
    start_date: string;
    end_date: string;
    discount_percent: number;
    reward_amount: number;
    allow_ontop_stacking: boolean;
    allowed_payment_methods: string[] | null;
    require_term_consent: boolean;
    term_consent_message: string | null;
    created_at: string;
}

interface PendingAffiliate {
    user_id: string;
    school_name: string;
    created_at: string;
    profiles?: {
        team_name: string;
        phone_number: string;
    };
}

export default function ReferralSettingsPage() {
    const navigate = useNavigate();
    const [program, setProgram] = useState<ReferralProgram | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState({ totalAffiliates: 0, pendingApprovals: 0, totalReferrals: 0, totalRewards: 0 });
    const [pendingAffiliates, setPendingAffiliates] = useState<PendingAffiliate[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Get active referral program
            const { data: programs } = await supabase
                .from('referral_programs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1);

            if (programs && programs.length > 0) {
                setProgram(programs[0]);
            }

            // 2. Get stats & Pending List
            // Note: Use stored procedure or raw queries if needed, but here simple selects work thanks to RLS policy update
            const [affResult, pendingResult, refResult] = await Promise.all([
                supabase.from('affiliates').select('*', { count: 'exact', head: true }),
                supabase.from('affiliates')
                    .select('user_id, school_name, created_at, profiles(team_name, phone_number)')
                    .eq('status', 'PENDING')
                    .order('created_at', { ascending: true }),
                supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
            ]);

            // Total rewards
            const { data: rewardData } = await supabase
                .from('affiliates')
                .select('total_earnings');

            const totalRewards = (rewardData || []).reduce((sum, a) => sum + (a.total_earnings || 0), 0);

            const pendingList = (pendingResult.data || []) as unknown as PendingAffiliate[];
            setPendingAffiliates(pendingList);

            setStats({
                totalAffiliates: affResult.count || 0,
                pendingApprovals: pendingList.length, // Use actual list length
                totalReferrals: refResult.count || 0,
                totalRewards
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        if (!program) return;
        const newVal = !program.is_active;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('referral_programs')
                .update({ is_active: newVal })
                .eq('id', program.id);
            if (error) throw error;
            setProgram({ ...program, is_active: newVal });
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!program) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('referral_programs')
                .update({
                    name: program.name,
                    end_date: program.end_date,
                    discount_percent: program.discount_percent,
                    reward_amount: program.reward_amount,
                    allow_ontop_stacking: program.allow_ontop_stacking,
                    allowed_payment_methods: program.allowed_payment_methods,
                    require_term_consent: program.require_term_consent,
                    term_consent_message: program.term_consent_message
                })
                .eq('id', program.id);
            if (error) throw error;
            alert('บันทึกเรียบร้อยแล้ว ✅');
        } catch (err: any) {
            alert('Error: ' + err.message);
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
                <h1 className="text-2xl font-bold text-gray-900">Referral Settings</h1>
                <p className="text-gray-500 text-sm mt-1">จัดการโปรแกรมแนะนำเพื่อน</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
                    <div className="text-xs text-gray-500 mb-1">ผู้แนะนำทั้งหมด</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalAffiliates}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-yellow-200 text-center">
                    <div className="text-xs text-yellow-600 mb-1">รออนุมัติ</div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.pendingApprovals}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200 text-center">
                    <div className="text-xs text-green-600 mb-1">แนะนำสำเร็จ</div>
                    <div className="text-2xl font-bold text-green-600">{stats.totalReferrals}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200 text-center">
                    <div className="text-xs text-purple-600 mb-1">รางวัลรวม</div>
                    <div className="text-2xl font-bold text-purple-600">฿{stats.totalRewards.toLocaleString()}</div>
                </div>
            </div>

            {/* Pending Approvals List */}
            {pendingAffiliates.length > 0 && (
                <div className="mb-8 bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-yellow-100 bg-yellow-50 flex items-center justify-between">
                        <h2 className="font-bold text-yellow-900 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                            </span>
                            รอการอนุมัติ ({pendingAffiliates.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {pendingAffiliates.map((aff) => (
                            <div key={aff.user_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">
                                        {aff.profiles?.team_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">{aff.profiles?.team_name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span>{aff.profiles?.phone_number}</span>
                                            <span>•</span>
                                            <span>{aff.school_name}</span>
                                            <span>•</span>
                                            <span>{formatDate(aff.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/admin/customers/${aff.user_id}`)}
                                    className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    ตรวจสอบ <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!program ? (
                <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
                    <p className="text-gray-500">ไม่พบ Referral Program</p>
                    <p className="text-gray-400 text-sm mt-1">กรุณาสร้างผ่าน Database Migration</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Toggle */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-gray-900">สถานะโปรแกรม</h2>
                                <p className="text-sm text-gray-500">เปิด/ปิดโปรแกรมแนะนำเพื่อน</p>
                            </div>
                            <button
                                onClick={handleToggle}
                                disabled={saving}
                                className="transition-colors"
                            >
                                {program.is_active ? (
                                    <ToggleRight className="w-12 h-12 text-green-500" />
                                ) : (
                                    <ToggleLeft className="w-12 h-12 text-gray-300" />
                                )}
                            </button>
                        </div>
                        <div className={`mt-3 px-3 py-1.5 rounded-lg text-sm font-medium inline-block ${program.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {program.is_active ? '🟢 กำลังใช้งาน' : '⚪ ปิดอยู่'}
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-5">
                        <h2 className="font-bold text-gray-900">ตั้งค่าโปรแกรม</h2>

                        <div>
                            <label className="text-sm font-medium text-gray-700">ชื่อโปรแกรม</label>
                            <input
                                type="text"
                                value={program.name}
                                onChange={(e) => setProgram({ ...program, name: e.target.value })}
                                className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">วันสิ้นสุด</label>
                                <input
                                    type="date"
                                    value={program.end_date?.split('T')[0] || ''}
                                    onChange={(e) => setProgram({ ...program, end_date: e.target.value })}
                                    className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">ส่วนลดผู้ถูกแนะนำ (%)</label>
                                <input
                                    type="number"
                                    value={program.discount_percent}
                                    onChange={(e) => setProgram({ ...program, discount_percent: Number(e.target.value) })}
                                    min={0} max={100}
                                    className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">รางวัลผู้แนะนำ (฿)</label>
                                <input
                                    type="number"
                                    value={program.reward_amount}
                                    onChange={(e) => setProgram({ ...program, reward_amount: Number(e.target.value) })}
                                    min={0}
                                    className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Stacking Setting */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">สิทธิ์การใช้ร่วมกับคูปองเสริม</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    ลูกค้าที่ได้รับสิทธิ์นี้ จะสามารถนำรหัสไปกรอกพร้อมกับคูปองลดเพิ่มอื่นๆ (On-top) ได้หรือไม่?
                                </p>
                            </div>
                            <button
                                onClick={() => setProgram({ ...program, allow_ontop_stacking: !program.allow_ontop_stacking })}
                                disabled={saving}
                                className={`transition-colors flex-shrink-0 ${saving ? 'opacity-50' : ''}`}
                            >
                                {program.allow_ontop_stacking ? (
                                    <ToggleRight className="w-10 h-10 text-indigo-600" />
                                ) : (
                                    <ToggleLeft className="w-10 h-10 text-gray-300" />
                                )}
                            </button>
                        </div>
                        <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 ${program.allow_ontop_stacking ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-600'}`}>
                            {program.allow_ontop_stacking ? '🔵 อนุญาตให้ใช้ร่วมกันได้' : '🔴 ไม่อนุญาตให้ใช้พ่วงกับคูปองเสริมเด็ดขาด'}
                        </div>

                        {/* Payment Methods */}
                        <div className="pt-4 border-t border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">ช่องทางการชำระเงินที่อนุญาต</h3>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!program.allowed_payment_methods || program.allowed_payment_methods.includes('qr')}
                                        onChange={(e) => {
                                            const current = program.allowed_payment_methods || ['qr', 'field'];
                                            const next = e.target.checked
                                                ? [...current, 'qr']
                                                : current.filter(m => m !== 'qr');
                                            setProgram({ ...program, allowed_payment_methods: next });
                                        }}
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-900 block">สแกนจ่าย QR (PromptPay)</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!program.allowed_payment_methods || program.allowed_payment_methods.includes('field')}
                                        onChange={(e) => {
                                            const current = program.allowed_payment_methods || ['qr', 'field'];
                                            const next = e.target.checked
                                                ? [...current, 'field']
                                                : current.filter(m => m !== 'field');
                                            setProgram({ ...program, allowed_payment_methods: next });
                                        }}
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-900 block">ชำระเงินสด (หน้าสนาม)</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Terms and Conditions */}
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">บังคับกดยอมรับเงื่อนไข</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        ลูกค้าต้องกดยอมรับเงื่อนไขเหล่านี้ก่อนทำการจองด้วยส่วนลด
                                    </p>
                                </div>
                                <button
                                    onClick={() => setProgram({ ...program, require_term_consent: !program.require_term_consent })}
                                    disabled={saving}
                                    className={`transition-colors flex-shrink-0 ${saving ? 'opacity-50' : ''}`}
                                >
                                    {program.require_term_consent ? (
                                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-300" />
                                    )}
                                </button>
                            </div>

                            {program.require_term_consent && (
                                <div className="mt-3">
                                    <label className="text-sm font-medium text-gray-700">ข้อความเงื่อนไข (สิ่งที่ลูกค้าจะเห็น)</label>
                                    <textarea
                                        value={program.term_consent_message || ''}
                                        onChange={(e) => setProgram({ ...program, term_consent_message: e.target.value })}
                                        placeholder="เช่น ข้าพเจ้ายอมรับว่าโปรโมชั่นนี้ไม่สามารถเปลี่ยงแปลงเวลาและคืนเงินได้"
                                        rows={3}
                                        className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            บันทึก
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
