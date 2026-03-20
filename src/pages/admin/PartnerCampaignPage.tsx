import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Store, Plus, Search, Edit2, Trash2, Tag, Award, BarChart3, Loader2, RefreshCw, X, Save, Eye, EyeOff } from 'lucide-react';

// Types
interface Merchant {
    id: string;
    name: string;
    pin_code: string;
    contact_name: string | null;
    contact_phone: string | null;
    status: string;
    created_at: string;
}

interface PartnerCampaign {
    id: string;
    name: string;
    description: string | null;
    merchant_id: string;
    point_cost: number;
    reward_item: string | null;
    total_quantity: number;
    remaining_quantity: number;
    limit_per_user: number;
    status: string;
    start_date: string;
    end_date: string;
    image_url: string | null;
    redemption_count: number;
    merchants?: Merchant;
}


export default function PartnerCampaignPage() {
    const [activeTab, setActiveTab] = useState<'merchants' | 'campaigns' | 'reports'>('merchants');

    const tabs = [
        { key: 'merchants' as const, label: 'จัดการร้านค้า', icon: Store },
        { key: 'campaigns' as const, label: 'แคมเปญร้านค้า', icon: Tag },
        { key: 'reports' as const, label: 'รายงานยอดเคลม', icon: BarChart3 },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">จัดการพาร์ทเนอร์</h1>
                <p className="text-sm text-gray-500 mt-1">บริหารร้านค้าพาร์ทเนอร์, แคมเปญแลกของรางวัล และรายงานยอดเคลม</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-6">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === tab.key
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'merchants' && <MerchantsTab />}
            {activeTab === 'campaigns' && <CampaignsTab />}
            {activeTab === 'reports' && <ReportsTab />}
        </div>
    );
}

// ============================================================
// Tab 1: Merchants Management
// ============================================================
function MerchantsTab() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);

    useEffect(() => { fetchMerchants(); }, []);

    const fetchMerchants = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error && data) setMerchants(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ลบร้านค้านี้? (แคมเปญที่ผูกจะถูกยกเลิกการเชื่อมต่อ)')) return;
        await supabase.from('merchants').delete().eq('id', id);
        fetchMerchants();
    };

    const filteredMerchants = merchants.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาร้านค้า..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <button
                    onClick={() => { setEditingMerchant(null); setIsModalOpen(true); }}
                    className="inline-flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มร้านค้า
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ร้านค้า</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">PIN Code</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ติดต่อ</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">สถานะ</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredMerchants.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                <Store className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{m.name}</div>
                                                <div className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('th-TH')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <PinDisplay pin={m.pin_code} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        <div>{m.contact_name || '-'}</div>
                                        <div className="text-xs text-gray-400">{m.contact_phone || ''}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {m.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => { setEditingMerchant(m); setIsModalOpen(true); }}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="แก้ไข">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(m.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredMerchants.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">ไม่พบร้านค้า — เริ่มเพิ่มร้านค้าพาร์ทเนอร์แรกได้เลย!</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <MerchantModal
                    merchant={editingMerchant}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => { setIsModalOpen(false); fetchMerchants(); }}
                />
            )}
        </>
    );
}

// PIN Display Component
function PinDisplay({ pin }: { pin: string }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-3 py-1 rounded-md text-sm font-mono font-bold text-gray-800 tracking-[0.3em]">
                {visible ? pin : '••••'}
            </code>
            <button onClick={() => setVisible(!visible)} className="text-gray-400 hover:text-gray-600 p-1">
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );
}

// Merchant Create/Edit Modal
function MerchantModal({ merchant, onClose, onSuccess }: { merchant: Merchant | null; onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState(merchant?.name || '');
    const [pinCode, setPinCode] = useState(merchant?.pin_code || '');
    const [contactName, setContactName] = useState(merchant?.contact_name || '');
    const [contactPhone, setContactPhone] = useState(merchant?.contact_phone || '');
    const [status, setStatus] = useState(merchant?.status || 'active');
    const [saving, setSaving] = useState(false);

    const generatePin = () => {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        setPinCode(pin);
    };

    useEffect(() => {
        if (!merchant && !pinCode) generatePin();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { alert('กรุณากรอกชื่อร้านค้า'); return; }
        if (!pinCode || pinCode.length < 4) { alert('PIN Code ต้องมีอย่างน้อย 4 หลัก'); return; }

        setSaving(true);
        try {
            const payload = { name: name.trim(), pin_code: pinCode.trim(), contact_name: contactName.trim() || null, contact_phone: contactPhone.trim() || null, status, updated_at: new Date().toISOString() };

            if (merchant) {
                const { error } = await supabase.from('merchants').update(payload).eq('id', merchant.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('merchants').insert([{ ...payload, created_at: new Date().toISOString() }]);
                if (error) throw error;
            }
            onSuccess();
        } catch (err: any) {
            alert('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">{merchant ? 'แก้ไขร้านค้า' : 'เพิ่มร้านค้าใหม่'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">ชื่อร้านค้า *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="เช่น ร้านเจ๊ติ๋ม" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">PIN Code (สำหรับเข้าระบบ) *</label>
                        <div className="flex gap-2">
                            <input type="text" value={pinCode} onChange={e => setPinCode(e.target.value)} required maxLength={6}
                                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono tracking-[0.3em] text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="1234" />
                            <button type="button" onClick={generatePin}
                                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors" title="สุ่ม PIN ใหม่">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">ชื่อผู้ติดต่อ</label>
                            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="คุณสมชาย" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">เบอร์โทร</label>
                            <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="08x-xxx-xxxx" />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">สถานะ</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setStatus('active')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold border ${status === 'active' ? 'bg-green-50 border-green-200 text-green-700' : 'border-gray-200 text-gray-400'}`}>
                                เปิดใช้งาน
                            </button>
                            <button type="button" onClick={() => setStatus('inactive')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold border ${status === 'inactive' ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-400'}`}>
                                ปิดใช้งาน
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                        <button type="submit" disabled={saving}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            บันทึก
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================
// Tab 2: Partner Campaign Management
// ============================================================
function CampaignsTab() {
    const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<PartnerCampaign | null>(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [campRes, merchRes] = await Promise.all([
            supabase.from('campaigns').select('*, merchants(name)').not('merchant_id', 'is', null).order('created_at', { ascending: false }),
            supabase.from('merchants').select('*').eq('status', 'active').order('name')
        ]);
        if (campRes.data) setCampaigns(campRes.data);
        if (merchRes.data) setMerchants(merchRes.data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ลบแคมเปญร้านค้านี้?')) return;
        await supabase.from('campaigns').delete().eq('id', id);
        fetchData();
    };

    const filtered = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.merchants as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="ค้นหาแคมเปญหรือร้านค้า..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <button onClick={() => { setEditingCampaign(null); setIsModalOpen(true); }}
                    className="inline-flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    สร้างแคมเปญร้านค้า
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((c) => (
                        <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                            <Award className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase">
                                                {(c.merchants as any)?.name || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {c.status === 'active' ? 'เปิดใช้งาน' : 'ปิด'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{c.name}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{c.description || 'ไม่มีคำอธิบาย'}</p>

                                <div className="space-y-1.5 text-xs text-gray-600">
                                    <div className="flex justify-between">
                                        <span>⭐ แต้มที่ใช้แลก</span>
                                        <span className="font-bold text-orange-600">{c.point_cost} แต้ม</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>📦 ของรางวัล</span>
                                        <span className="font-bold">{c.reward_item || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>📊 จำนวนคงเหลือ</span>
                                        <span className="font-bold">{c.remaining_quantity} / {c.total_quantity}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>🎯 ใช้ไปแล้ว</span>
                                        <span className="font-bold text-red-600">{c.redemption_count || 0}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                                    <button onClick={() => { setEditingCampaign(c); setIsModalOpen(true); }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(c.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full text-center py-16 text-gray-400">
                            <Award className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                            <p className="font-medium">ยังไม่มีแคมเปญร้านค้า</p>
                            <p className="text-sm mt-1">สร้างแคมเปญแรกเพื่อให้ลูกค้าแลกแต้มรับของรางวัล</p>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <PartnerCampaignModal
                    campaign={editingCampaign}
                    merchants={merchants}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => { setIsModalOpen(false); fetchData(); }}
                />
            )}
        </>
    );
}

// Partner Campaign Create/Edit Modal
function PartnerCampaignModal({ campaign, merchants, onClose, onSuccess }: {
    campaign: PartnerCampaign | null;
    merchants: Merchant[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: campaign?.name || '',
        description: campaign?.description || '',
        merchant_id: campaign?.merchant_id || (merchants[0]?.id || ''),
        point_cost: campaign?.point_cost || 100,
        reward_item: campaign?.reward_item || '',
        total_quantity: campaign?.total_quantity || 50,
        limit_per_user: campaign?.limit_per_user || 1,
        start_date: campaign?.start_date ? campaign.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
        end_date: campaign?.end_date ? campaign.end_date.split('T')[0] : new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        image_url: campaign?.image_url || '',
        status: campaign?.status || 'active',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { alert('กรุณากรอกชื่อแคมเปญ'); return; }
        if (!form.merchant_id) { alert('กรุณาเลือกร้านค้า'); return; }
        if (!form.reward_item.trim()) { alert('กรุณากรอกชื่อของรางวัล'); return; }
        if (form.point_cost <= 0) { alert('จำนวนแต้มต้องมากกว่า 0'); return; }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                merchant_id: form.merchant_id,
                point_cost: form.point_cost,
                reward_item: form.reward_item.trim(),
                total_quantity: form.total_quantity,
                remaining_quantity: campaign ? undefined : form.total_quantity, // Only set on create
                limit_per_user: form.limit_per_user,
                start_date: new Date(form.start_date).toISOString(),
                end_date: new Date(form.end_date).toISOString(),
                image_url: form.image_url.trim() || null,
                status: form.status,
                // Partner campaigns are always 'item' type reward
                benefit_type: 'REWARD',
                discount_amount: 0,
                discount_percent: 0,
                is_stackable: false,
                coupon_type: 'main',
                is_public: true,
            };

            if (campaign) {
                // Don't override remaining_quantity on edit
                delete payload.remaining_quantity;
                const { error } = await supabase.from('campaigns').update(payload).eq('id', campaign.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('campaigns').insert([payload]);
                if (error) throw error;
            }
            onSuccess();
        } catch (err: any) {
            alert('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center sticky top-0 z-10">
                    <h3 className="font-bold text-gray-900">{campaign ? 'แก้ไขแคมเปญร้านค้า' : 'สร้างแคมเปญร้านค้าใหม่'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Merchant Select */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">เลือกร้านค้า *</label>
                        <select value={form.merchant_id} onChange={e => setForm({ ...form, merchant_id: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                            {merchants.length === 0 && <option value="">-- กรุณาเพิ่มร้านค้าก่อน --</option>}
                            {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    {/* Campaign Name */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">ชื่อแคมเปญ *</label>
                        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="เช่น แลกข้าวฟรี ร้านเจ๊ติ๋ม" />
                    </div>

                    {/* Reward Item */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">ของรางวัล *</label>
                        <input type="text" value={form.reward_item} onChange={e => setForm({ ...form, reward_item: e.target.value })} required
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="เช่น ข้าวผัดกระเพราหมูสับ 1 จาน" />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">คำอธิบาย</label>
                        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="เงื่อนไขเพิ่มเติม..." />
                    </div>

                    {/* Point Cost */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">แต้มที่ต้องใช้แลก *</label>
                        <div className="relative max-w-xs">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500">⭐</span>
                            <input type="number" value={form.point_cost} onChange={e => setForm({ ...form, point_cost: parseInt(e.target.value) || 0 })} min={1}
                                className="w-full pl-9 pr-16 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">แต้ม</span>
                        </div>
                    </div>

                    {/* Quantity & Limits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">จำนวนทั้งหมด</label>
                            <input type="number" value={form.total_quantity} onChange={e => setForm({ ...form, total_quantity: parseInt(e.target.value) || 1 })} min={1}
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">จำกัดต่อคน</label>
                            <input type="number" value={form.limit_per_user} onChange={e => setForm({ ...form, limit_per_user: parseInt(e.target.value) || 1 })} min={1}
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">วันเริ่ม</label>
                            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">วันสิ้นสุด</label>
                            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>

                    {/* Image URL */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">URL รูปภาพ (ถ้ามี)</label>
                        <input type="text" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..." />
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-4 border-t">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={form.status === 'active'} onChange={e => setForm({ ...form, status: e.target.checked ? 'active' : 'inactive' })}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            เปิดใช้งาน
                        </label>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                            <button type="submit" disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                บันทึก
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================
// Tab 3: Claim Reports
// ============================================================
function ReportsTab() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchReports(); }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            // Get all used coupons for partner campaigns
            const { data: usedCoupons, error } = await supabase
                .from('user_coupons')
                .select(`
                    id, used_at,
                    campaigns!inner (
                        id, name, merchant_id, reward_item,
                        merchants!inner (id, name)
                    )
                `)
                .eq('status', 'USED')
                .not('campaigns.merchant_id', 'is', null)
                .order('used_at', { ascending: false });

            if (error) throw error;

            // Aggregate by merchant + month
            const grouped = new Map<string, { merchant_name: string; month: string; count: number; items: string[] }>();

            (usedCoupons || []).forEach((uc: any) => {
                const merchantName = uc.campaigns?.merchants?.name || 'Unknown';
                const usedDate = uc.used_at ? new Date(uc.used_at) : new Date();
                const monthKey = `${usedDate.getFullYear()}-${String(usedDate.getMonth() + 1).padStart(2, '0')}`;
                const key = `${merchantName}|${monthKey}`;

                if (grouped.has(key)) {
                    grouped.get(key)!.count++;
                } else {
                    grouped.set(key, {
                        merchant_name: merchantName,
                        month: monthKey,
                        count: 1,
                        items: [uc.campaigns?.reward_item || '-']
                    });
                }
            });

            setReports(Array.from(grouped.values()).sort((a, b) => b.month.localeCompare(a.month)));
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatMonth = (m: string) => {
        const [year, month] = m.split('-');
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        return `${months[parseInt(month) - 1]} ${parseInt(year) + 543}`;
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    สรุปยอดเคลมรายเดือน
                </h2>
                <button onClick={fetchReports} className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" /> รีเฟรช
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
            ) : reports.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ร้านค้า</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">เดือน</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">จำนวนคูปองที่ใช้</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reports.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Store className="w-4 h-4 text-indigo-500" />
                                            <span className="font-bold text-gray-900">{r.merchant_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{formatMonth(r.month)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-lg font-bold text-indigo-600">{r.count}</span>
                                        <span className="text-xs text-gray-400 ml-1">ใบ</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 font-medium">ยังไม่มียอดเคลม</p>
                    <p className="text-sm text-gray-300 mt-1">เมื่อร้านค้าสแกนคูปองลูกค้าสำเร็จ จะปรากฏที่นี่</p>
                </div>
            )}
        </>
    );
}
