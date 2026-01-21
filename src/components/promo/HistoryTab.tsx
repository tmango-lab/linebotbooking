// src/components/promo/HistoryTab.tsx
import { useState, useEffect } from 'react';
import { getPromoHistory, getPromoStats, getFieldInfo, type PromoCode, type PromoStats, type HistoryFilters } from '../../lib/promoApi';

export default function HistoryTab() {
    const [codes, setCodes] = useState<PromoCode[]>([]);
    const [stats, setStats] = useState<PromoStats | null>(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<HistoryFilters>({
        page: 1,
        pageSize: 20
    });

    const [fieldCache, setFieldCache] = useState<Record<number, { label: string; type: string }>>({});

    useEffect(() => {
        loadData();
    }, [filters]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [historyData, statsData] = await Promise.all([
                getPromoHistory(filters),
                getPromoStats()
            ]);

            setCodes(historyData.data);
            setTotal(historyData.total);
            setStats(statsData);

            // Load field info for all codes
            const fieldIds = [...new Set(historyData.data.map(c => c.field_id))];
            for (const fieldId of fieldIds) {
                if (!fieldCache[fieldId]) {
                    const fieldInfo = await getFieldInfo(fieldId);
                    if (fieldInfo) {
                        setFieldCache(prev => ({ ...prev, [fieldId]: fieldInfo }));
                    }
                }
            }
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short'
        });
    };

    const formatTime = (timeStr: string) => {
        return timeStr.substring(0, 5);
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            active: 'bg-green-100 text-green-800',
            used: 'bg-gray-100 text-gray-800',
            expired: 'bg-red-100 text-red-800'
        };

        const labels = {
            active: 'ใช้งานได้',
            used: 'ใช้แล้ว',
            expired: 'หมดอายุ'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    const totalPages = Math.ceil(total / (filters.pageSize || 20));

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">📜 ประวัติโค้ดส่วนลด</h2>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600">โค้ดทั้งหมด</p>
                        <p className="text-2xl font-bold">{stats.total_codes}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600">ใช้งานได้</p>
                        <p className="text-2xl font-bold text-green-600">{stats.active_codes}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600">ใช้แล้ว</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.used_codes}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600">ส่วนลดทั้งหมด</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {stats.total_discount_given.toLocaleString()} ฿
                        </p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            สถานะ
                        </label>
                        <select
                            value={filters.status || ''}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทั้งหมด</option>
                            <option value="active">ใช้งานได้</option>
                            <option value="used">ใช้แล้ว</option>
                            <option value="expired">หมดอายุ</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            ค้นหาโค้ด
                        </label>
                        <input
                            type="text"
                            value={filters.searchCode || ''}
                            onChange={(e) => setFilters({ ...filters, searchCode: e.target.value, page: 1 })}
                            placeholder="กรอกรหัสโค้ด"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ page: 1, pageSize: 20 })}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            ล้างตัวกรอง
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
                ) : codes.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">ไม่พบข้อมูล</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">โค้ด</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สนาม</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เวลา</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ส่วนลด</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {codes.map((code) => (
                                        <tr key={code.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-mono font-bold text-blue-600">{code.code}</td>
                                            <td className="px-4 py-3 text-sm">{formatDate(code.booking_date)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {fieldCache[code.field_id]?.label || `#${code.field_id}`}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {formatTime(code.time_from)}-{formatTime(code.time_to)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="text-gray-500 line-through">{code.original_price}</div>
                                                <div className="font-semibold text-green-600">{code.final_price} ฿</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-red-600">
                                                -{code.discount_amount} ฿
                                            </td>
                                            <td className="px-4 py-3">{getStatusBadge(code.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                            <div className="text-sm text-gray-700">
                                แสดง {((filters.page || 1) - 1) * (filters.pageSize || 20) + 1} - {Math.min((filters.page || 1) * (filters.pageSize || 20), total)} จาก {total} รายการ
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                                    disabled={(filters.page || 1) <= 1}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ← ก่อนหน้า
                                </button>
                                <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg">
                                    หน้า {filters.page || 1} / {totalPages}
                                </div>
                                <button
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                                    disabled={(filters.page || 1) >= totalPages}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ถัดไป →
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
