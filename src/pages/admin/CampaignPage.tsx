import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Plus, Search, Calendar, Tag, Layers, Edit2, Trash2, Share2, Lock, Eye, Code, Users, Send, Gift, X, Copy } from 'lucide-react';
import { formatDate } from '../../utils/date';
import CampaignModal from '../../components/admin/CampaignModal';
import BroadcastModal from '../../components/admin/BroadcastModal';

export default function CampaignPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<any | null>(null);

    // Broadcast Modal State
    const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
    const [broadcastCampaign, setBroadcastCampaign] = useState<any | null>(null);

    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareCampaign, setShareCampaign] = useState<any | null>(null);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCampaigns(data || []);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingCampaign(null); // Create mode
        setIsModalOpen(true);
    };

    const handleEdit = (campaign: any) => {
        setEditingCampaign(campaign); // Edit mode
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) return;

        try {
            const { error } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchCampaigns();
        } catch (error: any) {
            console.error('Error deleting campaign:', error);
            alert(`ลบแคมเปญไม่สำเร็จ: ${error.message || 'โปรดตรวจสอบความสัมพันธ์ของข้อมูล'}`);
        }
    };

    const handleCopyFlexJson = (campaign: any) => {
        const walletUrl = `${window.location.origin}/#/wallet`;

        const flexMessage = {
            type: "bubble",
            hero: {
                type: "image",
                url: campaign.image_url || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop",
                size: "full",
                aspectRatio: "20:13",
                aspectMode: "cover",
                action: {
                    type: "uri",
                    uri: walletUrl
                }
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "SPECIAL REWARD",
                        weight: "bold",
                        color: "#D4AF37",
                        size: "xs"
                    },
                    {
                        type: "text",
                        text: campaign.name,
                        weight: "bold",
                        size: "xl",
                        margin: "md",
                        wrap: true
                    },
                    {
                        type: "text",
                        text: campaign.description || "Limited time offer!",
                        size: "sm",
                        color: "#999999",
                        margin: "sm",
                        wrap: true
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "Collect Coupon",
                            uri: walletUrl
                        },
                        color: "#1F2937"
                    }
                ]
            }
        };

        const jsonString = JSON.stringify(flexMessage, null, 2);
        navigator.clipboard.writeText(jsonString);
        alert("คัดลอก Flex JSON แล้ว! นำไปวางใน LINE OA Manager ได้เลย");
    };

    const handleShareClick = (campaign: any) => {
        setShareCampaign(campaign);
        setIsShareModalOpen(true);
    };

    const handleBroadcastClick = (campaign: any) => {
        setBroadcastCampaign(campaign);
        setIsBroadcastOpen(true);
    };

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">จัดการแคมเปญ (V2)</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดการกิจกรรมทางการตลาด, คูปอง และส่วนลดต่างๆ</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    สร้างแคมเปญใหม่
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        placeholder="ค้นหาแคมเปญ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Campaign Grid */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCampaigns.map((campaign) => (
                        <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            {/* Card Header & Image */}
                            <div className="relative h-32 bg-gray-100">
                                {campaign.image_url ? (
                                    <img src={campaign.image_url} alt={campaign.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                                        <Tag className="h-10 w-10 text-indigo-200" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2">
                                    {campaign.end_date && new Date(campaign.end_date) < new Date() ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            หมดอายุ
                                        </span>
                                    ) : (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {campaign.status === 'active' ? 'พร้อมใช้งาน' : 'ระงับใช้งาน'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1" title={campaign.name}>
                                        {campaign.name}
                                    </h3>
                                </div>
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px]">
                                    {campaign.description || 'ไม่มีคำอธิบาย'}
                                </p>

                                <div className="space-y-2 text-sm text-gray-600">
                                    <div className="flex items-center">
                                        <WalletIcon type={campaign.discount_amount > 0 ? 'amount' : 'percent'} hasItem={!!campaign.reward_item} />
                                        <span className="ml-2 font-medium text-indigo-700">
                                            {campaign.reward_item 
                                                ? `ของรางวัล: ${campaign.reward_item}`
                                                : (campaign.discount_amount > 0
                                                    ? `ส่วนลด ${campaign.discount_amount.toLocaleString()} บาท`
                                                    : `ส่วนลด ${campaign.discount_percent}%`)
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        {campaign.is_public ? (
                                            <>
                                                <Eye className="w-3.5 h-3.5 mr-2 text-green-500" />
                                                <span className="text-green-600 text-xs font-semibold">รายการสาธารณะ</span>
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-3.5 h-3.5 mr-2 text-yellow-500" />
                                                <span className="text-yellow-700 text-xs font-semibold">
                                                    รหัสลับ: {campaign.secret_codes?.[0] || '???'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                        <span>
                                            {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <Layers className="w-4 h-4 mr-2 text-gray-400" />
                                        <span>
                                            จำนวน: {campaign.total_quantity} | สิทธิ์ต่อคน: {campaign.limit_per_user}
                                        </span>
                                    </div>
                                    {(campaign.min_duration_minutes > 0 || campaign.min_spend > 0) && (
                                        <div className="flex items-center text-indigo-600 font-medium">
                                            <span className="w-4 h-4 mr-2 flex items-center justify-center text-xs">⚠️</span>
                                            <span className="text-xs">
                                                {campaign.min_duration_minutes > 0 && `ขั้นต่ำ ${campaign.min_duration_minutes} นาที `}
                                                {campaign.min_duration_minutes > 0 && campaign.min_spend > 0 && '| '}
                                                {campaign.min_spend > 0 && `ยอดขั้นต่ำ ฿${campaign.min_spend.toLocaleString()}`}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center text-red-600 font-medium mt-1">
                                        <Users className="w-4 h-4 mr-2" />
                                        <span>
                                            ใช้ไปแล้ว: {campaign.redemption_count || 0} / {campaign.redemption_limit ? campaign.redemption_limit : '∞'}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 -mx-5 px-5 py-3">
                                    <button
                                        onClick={() => handleCopyFlexJson(campaign)}
                                        className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md transition-all mr-2"
                                        title="คัดลอก Flex Message JSON"
                                    >
                                        <Code className="w-3 h-3 mr-1.5" />
                                        JSON
                                    </button>
                                    <button
                                        onClick={() => handleShareClick(campaign)}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <Share2 className="w-3 h-3 mr-1.5" />
                                        Share Link
                                    </button>

                                    <button
                                        onClick={() => handleBroadcastClick(campaign)}
                                        className="text-xs font-medium text-white flex items-center bg-green-600 border border-transparent rounded-lg px-3 py-1.5 shadow-sm hover:bg-green-700 transition-all ml-2"
                                    >
                                        <Send className="w-3 h-3 mr-1.5" />
                                        Broadcast
                                    </button>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(campaign)}
                                            className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-white"
                                            title="แก้ไข"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(campaign.id)}
                                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-white"
                                            title="ลบ"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredCampaigns.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            ไม่พบแคมเปญ เริ่มสร้างแคมเปญแรกได้เลย!
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            <CampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                campaign={editingCampaign}
                onSuccess={fetchCampaigns}
            />

            <BroadcastModal
                isOpen={isBroadcastOpen}
                onClose={() => setIsBroadcastOpen(false)}
                campaign={broadcastCampaign}
                onSuccess={() => { }}
            />

            {/* Share Link Modal */}
            {isShareModalOpen && shareCampaign && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b shrink-0">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                <Share2 className="w-5 h-5 mr-2 text-indigo-600" />
                                แชร์แคมเปญ: <span className="ml-2 text-gray-600 font-normal truncate max-w-[200px]" title={shareCampaign.name}>{shareCampaign.name}</span>
                            </h2>
                            <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 bg-gray-50 text-sm overflow-y-auto">
                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <h3 className="font-semibold text-green-700 flex items-center mb-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                    1. ลิงก์สำหรับส่งใน LINE (แนะนำ)
                                </h3>
                                <p className="text-gray-500 text-xs mb-3">
                                    ใช้สำหรับส่งให้ลูกค้าผ่าน LINE OA, Rich Menu หรือ Broadcast ระบบจะเปิดหน้าต่างขึ้นมาทันทีโดยไม่ต้องเข้าสู่ระบบใหม่
                                </p>
                                <div className="flex">
                                    <input 
                                        readOnly 
                                        value={(() => {
                                            const liffId = import.meta.env.VITE_LIFF_ID;
                                            const baseUrl = liffId ? `https://liff.line.me/${liffId}` : window.location.origin;
                                            let url = `${baseUrl}/#/wallet?id=${shareCampaign.id}&action=collect`;
                                            if (!shareCampaign.is_public && shareCampaign.secret_codes?.length > 0) url += `&code=${shareCampaign.secret_codes[0]}`;
                                            else if (shareCampaign.is_public) url += `&code=`;
                                            return url;
                                        })()}
                                        className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-l-lg px-3 py-2 outline-none w-0"
                                    />
                                    <button 
                                        onClick={() => {
                                            const liffId = import.meta.env.VITE_LIFF_ID;
                                            const baseUrl = liffId ? `https://liff.line.me/${liffId}` : window.location.origin;
                                            let url = `${baseUrl}/#/wallet?id=${shareCampaign.id}&action=collect`;
                                            if (!shareCampaign.is_public && shareCampaign.secret_codes?.length > 0) url += `&code=${shareCampaign.secret_codes[0]}`;
                                            else if (shareCampaign.is_public) url += `&code=`;
                                            navigator.clipboard.writeText(url);
                                            alert("คัดลอกลิงก์สำหรับ LINE แล้ว!");
                                        }}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-r-lg font-medium transition-colors flex items-center whitespace-nowrap"
                                    >
                                        <Copy className="w-4 h-4 mr-1" /> คัดลอก
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <h3 className="font-semibold text-blue-700 flex items-center mb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                    2. ลิงก์สำหรับช่องทางอื่นๆ (Messenger, FB, Web)
                                </h3>
                                <p className="text-gray-500 text-xs mb-3">
                                    สำหรับแชร์นอกแอป LINE (เช่น หน้าเพจ Facebook หรือส่งทางแชทอื่น) ลูกค้าสามารถกดเปิดผ่านบราวเซอร์ทั่วไปได้ตามปกติ
                                </p>
                                <div className="flex">
                                    <input 
                                        readOnly 
                                        value={(() => {
                                            const baseUrl = window.location.origin;
                                            let url = `${baseUrl}/#/wallet?id=${shareCampaign.id}&action=collect`;
                                            if (!shareCampaign.is_public && shareCampaign.secret_codes?.length > 0) url += `&code=${shareCampaign.secret_codes[0]}`;
                                            else if (shareCampaign.is_public) url += `&code=`;
                                            return url;
                                        })()}
                                        className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-l-lg px-3 py-2 outline-none w-0"
                                    />
                                    <button 
                                        onClick={() => {
                                            const baseUrl = window.location.origin;
                                            let url = `${baseUrl}/#/wallet?id=${shareCampaign.id}&action=collect`;
                                            if (!shareCampaign.is_public && shareCampaign.secret_codes?.length > 0) url += `&code=${shareCampaign.secret_codes[0]}`;
                                            else if (shareCampaign.is_public) url += `&code=`;
                                            navigator.clipboard.writeText(url);
                                            alert("คัดลอกลิงก์เว็บไซต์แล้ว!");
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg font-medium transition-colors flex items-center whitespace-nowrap"
                                    >
                                        <Copy className="w-4 h-4 mr-1" /> คัดลอก
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function WalletIcon({ type, hasItem }: { type: 'amount' | 'percent', hasItem?: boolean }) {
    if (hasItem) {
        return <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold"><Gift className="w-3 h-3" /></div>
    }
    if (type === 'amount') {
        return <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">฿</div>
    }
    return <div className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">%</div>
}
