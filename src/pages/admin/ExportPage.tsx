import { useState } from 'react';
import { Download, Calendar, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';

function getDefaultDateRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        from: firstDay.toISOString().split('T')[0],
        to: lastDay.toISOString().split('T')[0],
    };
}

export default function ExportPage() {
    const defaults = getDefaultDateRange();
    const [dateFrom, setDateFrom] = useState(defaults.from);
    const [dateTo, setDateTo] = useState(defaults.to);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleExport = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ dateFrom, dateTo }),
            });

            // Check if response is CSV (success) or JSON (error/empty)
            const contentType = res.headers.get('Content-Type') || '';

            if (contentType.includes('text/csv')) {
                // Success - download the CSV file
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bookings_${dateFrom}_to_${dateTo}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setSuccess(`ดาวน์โหลดสำเร็จ! ไฟล์ bookings_${dateFrom}_to_${dateTo}.csv`);
            } else {
                // JSON response (error or empty)
                const data = await res.json();
                if (data.error && data.count === 0) {
                    setError('ไม่พบข้อมูลการจองในช่วงวันที่ที่เลือก');
                } else if (data.error) {
                    setError(data.error);
                }
            }
        } catch (e: any) {
            setError(`เกิดข้อผิดพลาด: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Quick presets
    const setPreset = (type: 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days') => {
        const now = new Date();
        let from: Date, to: Date;

        switch (type) {
            case 'this_month':
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last_month':
                from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                to = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'last_7_days':
                to = new Date(now);
                from = new Date(now);
                from.setDate(from.getDate() - 6);
                break;
            case 'last_30_days':
                to = new Date(now);
                from = new Date(now);
                from.setDate(from.getDate() - 29);
                break;
        }

        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(to.toISOString().split('T')[0]);
    };

    return (
        <div className="p-6 md:p-10 max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <FileSpreadsheet size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Export Data</h1>
                        <p className="text-sm text-gray-500">ส่งออกข้อมูลการจองเพื่อนำไปวิเคราะห์</p>
                    </div>
                </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-6 py-4">
                    <p className="text-sm text-emerald-800 font-medium">📊 ข้อมูลที่ส่งออก</p>
                    <p className="text-xs text-emerald-600 mt-1">
                        รวม 8 ตาราง: การจอง, ลูกค้า, คูปอง, แคมเปญ, โปรโมโค้ด, สนาม, แนะนำเพื่อน, แต้มสะสม
                        — ทุกอย่างอยู่ในไฟล์เดียว พร้อมนำไปวิเคราะห์ทันที
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Quick Presets */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            ช่วงเวลาสำเร็จรูป
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: 'เดือนนี้', value: 'this_month' as const },
                                { label: 'เดือนที่แล้ว', value: 'last_month' as const },
                                { label: '7 วันล่าสุด', value: 'last_7_days' as const },
                                { label: '30 วันล่าสุด', value: 'last_30_days' as const },
                            ].map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setPreset(p.value)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                <Calendar size={14} className="inline mr-1.5 text-gray-400" />
                                วันที่เริ่มต้น
                            </label>
                            <input
                                type="date"
                                id="export-date-from"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                <Calendar size={14} className="inline mr-1.5 text-gray-400" />
                                วันที่สิ้นสุด
                            </label>
                            <input
                                type="date"
                                id="export-date-to"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Export Button */}
                    <button
                        id="export-csv-btn"
                        onClick={handleExport}
                        disabled={loading || !dateFrom || !dateTo}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-sm shadow-lg transition-all ${
                            loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl active:scale-[0.98]'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                กำลังเตรียมข้อมูล...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Export CSV
                            </>
                        )}
                    </button>

                    {/* Success Message */}
                    {success && (
                        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <Download size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-emerald-800">{success}</p>
                                <p className="text-xs text-emerald-600 mt-1">
                                    💡 นำไฟล์นี้อัปโหลดไปที่ Gemini Gems เพื่อเริ่มวิเคราะห์ได้เลย!
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
                    <p className="text-xs text-gray-400 leading-relaxed">
                        ไฟล์ CSV รองรับการเปิดด้วย Excel / Google Sheets ภาษาไทยแสดงผลถูกต้อง
                        • ข้อมูลถูก JOIN จาก 8 ตารางเป็นไฟล์เดียว พร้อมนำไปให้ AI วิเคราะห์
                    </p>
                </div>
            </div>
        </div>
    );
}
