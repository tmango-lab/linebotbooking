// src/pages/admin/PromoCodePage.tsx
import { useState } from 'react';
import ValidateCodeTab from '../../components/promo/ValidateCodeTab';
import SettingsTab from '../../components/promo/SettingsTab';
import HistoryTab from '../../components/promo/HistoryTab';
import VIPCodeTab from '../../components/promo/VIPCodeTab'; // [NEW]
import { Search, Settings, History, Tag, Key } from 'lucide-react';

type TabType = 'validate' | 'settings' | 'history' | 'vip_codes';

export default function PromoCodePage() {
    const [activeTab, setActiveTab] = useState<TabType>('validate');

    const tabs = [
        { id: 'validate' as TabType, label: 'ตรวจสอบโค้ด', icon: Search },
        { id: 'vip_codes' as TabType, label: 'โค้ดลับ VIP', icon: Key }, // [NEW]
        { id: 'settings' as TabType, label: 'ตั้งค่าระบบ', icon: Settings },
        { id: 'history' as TabType, label: 'ประวัติการใช้งาน', icon: History }
    ];

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between py-6 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Tag className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                    จัดการโค้ดส่วนลด
                                </h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    ตรวจสอบและจัดการโปรโมชั่นทั้งหมด
                                </p>
                            </div>
                        </div>

                        {/* Modern Tabs */}
                        <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-xl">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                                            ${isActive
                                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                            }
                                        `}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="transition-all duration-300 ease-in-out">
                    {activeTab === 'validate' && <ValidateCodeTab />}
                    {activeTab === 'vip_codes' && <VIPCodeTab />} {/* [NEW] */}
                    {activeTab === 'settings' && <SettingsTab />}
                    {activeTab === 'history' && <HistoryTab />}
                </div>
            </div>
        </div>
    );
}
