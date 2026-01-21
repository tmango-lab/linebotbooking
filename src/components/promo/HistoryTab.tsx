// src/components/promo/HistoryTab.tsx
import { useState, useEffect } from 'react';
import { getPromoHistory, getPromoStats, getFieldInfo, type PromoCode, type PromoStats, type HistoryFilters } from '../../lib/promoApi';
import { Search, ChevronLeft, ChevronRight, Filter, Tag, CheckCircle, Clock } from 'lucide-react';

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
        const styles = {
            active: 'bg-green-50 text-green-700 ring-green-600/20',
            used: 'bg-gray-50 text-gray-600 ring-gray-500/10',
            expired: 'bg-red-50 text-red-700 ring-red-600/10'
        };

        const labels = {
            active: 'ใช้งานได้',
            used: 'ใช้แล้ว',
            expired: 'หมดอายุ'
        };

        return (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles[status as keyof typeof styles]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    const totalPages = Math.ceil(total / (filters.pageSize || 20));

    return (
        <div className="space-y-6">
            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">ส่วนลดทั้งหมด</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total_discount_given.toLocaleString()}</p>
                            <p className="text-xs text-gray-400 mt-1">บาท</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <Tag className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">โค้ดทั้งหมด</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total_codes}</p>
                            <p className="text-xs text-gray-400 mt-1">รายการ</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <Tag className="w-6 h-6 text-gray-600" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">ใช้งานแล้ว</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.used_codes}</p>
                            <p className="text-xs text-green-600 mt-1 flex items-center">
                                {Math.round((stats.used_codes / stats.total_codes) * 100) || 0}% conversion
                            </p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">หมดอายุ</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total_codes - stats.active_codes - stats.used_codes}</p>
                            <p className="text-xs text-red-600 mt-1">ไม่ได้ใช้งาน</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                            <Clock className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-1 gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:max-w-xs">
                            <input
                                type="text"
                                value={filters.searchCode || ''}
                                onChange={(e) => setFilters({ ...filters, searchCode: e.target.value, page: 1 })}
                                placeholder="ค้นหารหัสโค้ด..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>

                        <div className="relative min-w-[140px]">
                            <select
                                value={filters.status || ''}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none bg-white"
                            >
                                <option value="">ทุกสถานะ</option>
                                <option value="active">ใช้งานได้</option>
                                <option value="used">ใช้แล้ว</option>
                                <option value="expired">หมดอายุ</option>
                            </select>
                            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                    </div>

                    <button
                        onClick={() => setFilters({ page: 1, pageSize: 20 })}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                        ล้างตัวกรอง
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        กำลังโหลดข้อมูล...
                    </div>
                ) : codes.length === 0 ? (
                    <div className="p-16 text-center text-gray-500 flex flex-col items-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-4">
                            <Tag className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">ไม่พบรายการ</h3>
                        <p className="text-sm text-gray-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full whitespace-nowrap text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">โค้ดส่วนลด</th>
                                        <th className="px-6 py-4 font-medium">วันที่จอง</th>
                                        <th className="px-6 py-4 font-medium">สนาม</th>
                                        <th className="px-6 py-4 font-medium">เวลา</th>
                                        <th className="px-6 py-4 font-medium text-right">ราคาปกติ</th>
                                        <th className="px-6 py-4 font-medium text-right">ส่วนลด</th>
                                        <th className="px-6 py-4 font-medium text-right">สุทธิ</th>
                                        <th className="px-6 py-4 font-medium text-center">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {codes.map((code) => (
                                        <tr key={code.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                    {code.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {formatDate(code.booking_date)}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 font-medium">
                                                {fieldCache[code.field_id]?.label || `#${code.field_id}`}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                    {formatTime(code.time_from)} - {formatTime(code.time_to)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-400 line-through">
                                                {code.original_price.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-red-500 font-medium">
                                                -{code.discount_amount}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                {code.final_price.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {getStatusBadge(code.status)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                แสดง {((filters.page || 1) - 1) * (filters.pageSize || 20) + 1} - {Math.min((filters.page || 1) * (filters.pageSize || 20), total)} จาก {total} รายการ
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                                    disabled={(filters.page || 1) <= 1}
                                    className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700">
                                    หน้า {filters.page || 1} / {totalPages}
                                </div>
                                <button
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                                    disabled={(filters.page || 1) >= totalPages}
                                    className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
