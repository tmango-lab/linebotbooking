// src/pages/admin/PromoCodePage.tsx
import { useState } from 'react';
import ValidateCodeTab from '../../components/promo/ValidateCodeTab';
import SettingsTab from '../../components/promo/SettingsTab';
import HistoryTab from '../../components/promo/HistoryTab';

type TabType = 'validate' | 'settings' | 'history';

export default function PromoCodePage() {
    const [activeTab, setActiveTab] = useState<TabType>('validate');

    const tabs = [
        { id: 'validate' as TabType, label: '🔍 ตรวจสอบโค้ด', icon: '🔍' },
        { id: 'settings' as TabType, label: '⚙️ ตั้งค่า', icon: '⚙️' },
        { id: 'history' as TabType, label: '📜 ประวัติ', icon: '📜' }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6">
                        <h1 className="text-3xl font-bold text-gray-900">
                            🎁 จัดการโค้ดโปรโมชั่น
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            ตรวจสอบ ใช้งาน และจัดการโค้ดส่วนลดสำหรับลูกค้า
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-8 border-b">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                  pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'validate' && <ValidateCodeTab />}
                {activeTab === 'settings' && <SettingsTab />}
                {activeTab === 'history' && <HistoryTab />}
            </div>
        </div>
    );
}
