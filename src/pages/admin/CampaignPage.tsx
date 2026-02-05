import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Plus, Search, Calendar, Tag, Layers, Edit2, Trash2, Share2, Lock, Eye, Code } from 'lucide-react';
import CampaignModal from '../../components/admin/CampaignModal';

export default function CampaignPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<any | null>(null);

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

    const handleCopyLink = (campaign: any) => {
        // Construct Deep Link
        // For Public: Link to wallet
        // For Secret: Link with auto-fill query params
        // But since we simplified WalletPage to just auto-show public ones, 
        // we can just link to wallet page generally for public, 
        // or specifically for secret code auto-fill if we want to be fancy.

        // Let's make it smart:
        // Public -> https://.../wallet
        // Secret -> https://.../wallet?code={SECRET_CODE} (Need to pick one code if multiple)

        let url = `${window.location.origin}/#/wallet`;

        if (!campaign.is_public && campaign.secret_codes && campaign.secret_codes.length > 0) {
            // Pick first secret code for convenience
            url += `?code=${campaign.secret_codes[0]}`;
        }

        navigator.clipboard.writeText(url);
        alert(`คัดลอกลิงก์แล้ว!\n${url}`);
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
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {campaign.status === 'active' ? 'พร้อมใช้งาน' : 'ระงับใช้งาน'}
                                    </span>
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
                                        <WalletIcon type={campaign.discount_amount > 0 ? 'amount' : 'percent'} />
                                        <span className="ml-2 font-medium text-indigo-700">
                                            {campaign.discount_amount > 0
                                                ? `ส่วนลด ${campaign.discount_amount.toLocaleString()} บาท`
                                                : `ส่วนลด ${campaign.discount_percent}%`
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
                                            {new Date(campaign.start_date).toLocaleDateString()} - {new Date(campaign.end_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <Layers className="w-4 h-4 mr-2 text-gray-400" />
                                        <span>
                                            จำนวน: {campaign.total_quantity} | สิทธิ์ต่อคน: {campaign.limit_per_user}
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
                                        onClick={() => handleCopyLink(campaign)}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <Share2 className="w-3 h-3 mr-1.5" />
                                        แชร์ลิงก์
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
        </div>
    );
}

function WalletIcon({ type }: { type: 'amount' | 'percent' }) {
    if (type === 'amount') {
        return <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">฿</div>
    }
    return <div className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">%</div>
}
