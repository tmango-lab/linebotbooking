import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/api';
import BookingDetailModal from '../../components/ui/BookingDetailModal';
import DatePickerButton from '../../components/ui/DateRangeCalendar';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight,
    Filter, ChevronsUpDown
} from 'lucide-react';

// Court mapping (field_no → display info)
const COURTS = [
    { field_no: 1, court_id: 2424, name: 'สนาม 1', size: '5 คน' },
    { field_no: 2, court_id: 2425, name: 'สนาม 2', size: '5 คน' },
    { field_no: 3, court_id: 2428, name: 'สนาม 3', size: '7 คน' },
    { field_no: 4, court_id: 2426, name: 'สนาม 4', size: '7 คน' },
    { field_no: 5, court_id: 2427, name: 'สนาม 5', size: '11 คน' },
    { field_no: 6, court_id: 2429, name: 'สนาม 6', size: '11 คน' },
];

// Helper functions (moved outside or defined here)
const getStatusColor = (status: string) => {
    switch (status) {
        case 'confirmed': return 'bg-green-100 text-green-800';
        case 'pending_payment': return 'bg-yellow-100 text-yellow-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        case 'completed': return 'bg-blue-100 text-blue-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const formatSource = (source: string) => {
    switch (source) {
        case 'line': return 'Liff';
        case 'line_bot_regular': return 'Line Bot';
        case 'admin': return 'Admin';
        case 'facebook': return 'Facebook';
        case 'phone': return 'Phone';
        default: return source;
    }
};



const PAGE_SIZE = 20;

function getMonthRange() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        start: now.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}

type SortKey = 'date' | 'time_from' | 'field_no' | 'display_name' | 'price_total_thb' | 'created_at';
type SortDir = 'asc' | 'desc';

interface BookingRow {
    booking_id: string;
    date: string;
    time_from: string;
    time_to: string;
    field_no: number;
    display_name: string;
    phone_number: string;
    price_total_thb: number;
    status: string;
    source: string;
    booking_source: string;
    is_promo: boolean;
    admin_note: string | null;
    paid_at: string | null;
    payment_method: string;
    payment_status: string;
    payment_slip_url: string | null;
    timeout_at: string | null;
    is_refunded: boolean;
    attendance_status: string | null;
    remark: string | null;
    discount?: number;
    created_at?: string;
}

// Helper to check if set has id
function useSelection() {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggle = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const clear = () => setSelectedIds(new Set());

    return { selectedIds, setSelectedIds, toggle, clear, count: selectedIds.size };
}

export default function BookingSearchPage() {
    const navigate = useNavigate();

    // Search & Filter state
    const [searchText, setSearchText] = useState('');
    const [dateStart, setDateStart] = useState(getMonthRange().start);
    const [dateEnd, setDateEnd] = useState(getMonthRange().end);
    const [filterCourt, setFilterCourt] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPayment, setFilterPayment] = useState<string>('all');
    const [filterSource, setFilterSource] = useState<string>('all');
    const [filterPromo, setFilterPromo] = useState<string>('all');

    // Data state
    const [bookings, setBookings] = useState<BookingRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selection
    const { selectedIds, setSelectedIds, toggle, clear, count: selectedCount } = useSelection();

    // Sort & Pagination
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);

    // Modal state
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // State to track if initial search has been done
    const [hasSearched, setHasSearched] = useState(false);

    async function fetchBookings() {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('bookings')
                .select('*')
                .gte('date', dateStart)
                .lte('date', dateEnd)
                .order('date', { ascending: false })
                .order('time_from', { ascending: true });

            const { data, error: queryError } = await query;
            if (queryError) throw queryError;

            setBookings(data || []);
            setPage(1);
            setHasSearched(true);
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(err.message || 'Failed to fetch bookings');
        } finally {
            setLoading(false);
        }
    }

    // Client-side filtering
    const filtered = useMemo(() => {
        let result = [...bookings];

        // Text search
        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            result = result.filter(b =>
                (b.display_name || '').toLowerCase().includes(q) ||
                (b.phone_number || '').toLowerCase().includes(q) ||
                (b.admin_note || '').toLowerCase().includes(q) ||
                (b.remark || '').toLowerCase().includes(q)
            );
        }

        // Court filter
        if (filterCourt !== 'all') {
            result = result.filter(b => b.field_no === parseInt(filterCourt));
        }

        // Status filter
        if (filterStatus !== 'all') {
            result = result.filter(b => b.status === filterStatus);
        }

        // Payment method filter
        if (filterPayment !== 'all') {
            result = result.filter(b => (b.payment_method || 'cash') === filterPayment);
        }

        // Source filter
        if (filterSource !== 'all') {
            result = result.filter(b => (b.source || b.booking_source || 'admin') === filterSource);
        }

        // Promo filter
        if (filterPromo === 'promo') {
            result = result.filter(b => b.is_promo);
        } else if (filterPromo === 'no_promo') {
            result = result.filter(b => !b.is_promo);
        }

        return result;
    }, [bookings, searchText, filterCourt, filterStatus, filterPayment, filterSource, filterPromo]);

    // Sorting
    const sorted = useMemo(() => {
        const arr = [...filtered];
        arr.sort((a, b) => {
            let va: any = a[sortKey];
            let vb: any = b[sortKey];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return arr;
    }, [filtered, sortKey, sortDir]);

    // Paging
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Handle Select All for CURRENT PAGE only (Safety)
    const allOnPageSelected = paged.length > 0 && paged.every(b => selectedIds.has(b.booking_id));

    const handleToggleAllPage = () => {
        const newSet = new Set(selectedIds);
        if (allOnPageSelected) {
            // Deselect all on this page
            paged.forEach(b => newSet.delete(b.booking_id));
        } else {
            // Select all on this page
            paged.forEach(b => newSet.add(b.booking_id));
        }
        setSelectedIds(newSet);
    };

    // Summary stats
    const summary = useMemo(() => {
        const confirmed = filtered.filter(b => b.status === 'confirmed');
        const cancelled = filtered.filter(b => b.status === 'cancelled');
        const revenue = confirmed.reduce((sum, b) => sum + (b.price_total_thb || 0), 0);
        let discounts = 0;
        filtered.forEach(b => {
            if (b.admin_note) {
                const match = b.admin_note.match(/\(-(\d+)\)/);
                if (match) discounts += parseInt(match[1], 10);
            }
        });
        return {
            total: filtered.length,
            confirmed: confirmed.length,
            cancelled: cancelled.length,
            revenue,
            discounts,
        };
    }, [filtered]);

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
        setPage(1);
    }

    function getCourtName(fieldNo: number) {
        const c = COURTS.find(c => c.field_no === fieldNo);
        return c ? c.name : `สนาม ${fieldNo}`;
    }


    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [bulkReturnCoupon, setBulkReturnCoupon] = useState(false);

    const handleBulkCancelClick = () => {
        if (selectedIds.size === 0) return;
        setShowBulkConfirm(true);
        setBulkReturnCoupon(false); // Reset default
    };

    const confirmBulkCancel = async () => {
        setShowBulkConfirm(false);
        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Loop delete
        for (const id of selectedIds) {
            try {
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-booking`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        matchId: id,
                        reason: 'Bulk Cancel via Admin',
                        isRefunded: false,
                        shouldReturnCoupon: bulkReturnCoupon
                    })
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                    console.error(`Failed to cancel ${id}:`, await response.text());
                }
            } catch (e) {
                failCount++;
                console.error(`Error canceling ${id}:`, e);
            }
        }

        setLoading(false);
        alert(`ดำเนินการเสร็จสิ้น\nสำเร็จ: ${successCount}\nล้มเหลว: ${failCount}`);

        clear();
        fetchBookings(); // Refresh
    };

    function openDetail(b: BookingRow) {
        setSelectedBooking({
            id: b.booking_id,
            name: b.display_name,
            tel: b.phone_number,
            time_start: `${b.date} ${b.time_from}`,
            time_end: `${b.date} ${b.time_to}`,
            price: b.price_total_thb,
            remark: b.remark,
            court_name: getCourtName(b.field_no),
            admin_note: b.admin_note,
            paid_at: b.paid_at,
            source: b.source || b.booking_source || 'admin',
            is_promo: b.is_promo,
            is_refunded: b.is_refunded,
            discount: b.discount || 0,
            status: b.status,
            payment_method: b.payment_method || 'cash',
            payment_status: b.payment_status || 'unpaid',
            payment_slip_url: b.payment_slip_url,
            timeout_at: b.timeout_at,
        });
        setModalOpen(true);
    }

    function handleReschedule(date: string) {
        setModalOpen(false);
        // Extract date from "YYYY-MM-DD HH:MM" format
        const d = date.split(' ')[0];
        navigate(`/admin/dashboard?date=${d}`);
    }

    function formatDate(dateStr: string) {
        const d = new Date(dateStr + 'T00:00:00');
        const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        const dayAbbr = dayNames[d.getDay()];
        return `${dayAbbr} ${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
    }

    function formatTime(timeStr: string) {
        return timeStr?.slice(0, 5) || '';
    }

    return (
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Search className="h-6 w-6 text-indigo-600" />
                    ค้นหาการจอง
                </h1>
                <button
                    onClick={fetchBookings}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    รีเฟรช
                </button>
            </div>

            {/* Search & Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
                {/* Text Search + Button (same row) */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, เบอร์โทร, หมายเหตุ..."
                            value={searchText}
                            onChange={e => { setSearchText(e.target.value); setPage(1); }}
                            onKeyDown={e => { if (e.key === 'Enter') fetchBookings(); }}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-gray-50 placeholder-gray-400"
                        />
                    </div>
                    <button
                        onClick={fetchBookings}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60 whitespace-nowrap"
                    >
                        <Search className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
                        ค้นหา
                    </button>
                    {hasSearched && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">พบ {filtered.length} รายการ</span>
                    )}
                </div>

                {/* Filter Row */}
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-500">
                    <Filter className="h-4 w-4" />
                    <span>ตัวกรอง</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    {/* Date Start */}
                    <DatePickerButton
                        label="วันเริ่มต้น"
                        value={dateStart}
                        onChange={setDateStart}
                    />

                    {/* Bulk Action Bar */}
                    {selectedCount > 0 && (
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-4 animate-in slide-in-from-bottom-4">
                            <span className="font-medium text-sm flex items-center">
                                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                                    {selectedCount}
                                </span>
                                รายการที่เลือก
                            </span>
                            <div className="h-4 w-px bg-gray-700"></div>
                            <button
                                onClick={handleBulkCancelClick}
                                className="text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-1 transition-colors"
                            >
                                ลบทั้งหมด (Bulk Cancel)
                            </button>
                            <div className="h-4 w-px bg-gray-700"></div>
                            <button
                                onClick={clear}
                                className="text-gray-400 hover:text-white text-xs font-medium transition-colors"
                            >
                                ยกเลิกการเลือก
                            </button>
                        </div>
                    )}

                    {/* Detail Modal */}
                    {showBulkConfirm && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
                            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">ยืนยันการลบ {selectedCount} รายการ?</h3>
                                <p className="text-gray-500 text-sm mb-4">การกระทำนี้จะเปลี่ยนสถานะเป็น "ยกเลิก" และไม่สามารถย้อนกลับได้</p>

                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-6">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={bulkReturnCoupon}
                                            onChange={e => setBulkReturnCoupon(e.target.checked)}
                                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm font-medium text-gray-700">คืนสิทธิ์คูปอง / โปรโมชันให้ลูกค้า</span>
                                    </label>
                                    <p className="text-xs text-gray-400 mt-1 ml-8">หากเลือก: คูปองจะกลับสถานะเป็น Active ให้ลูกค้าใช้ใหม่ได้</p>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowBulkConfirm(false)}
                                        className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={confirmBulkCancel}
                                        className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                                    >
                                        ยืนยันลบทั้งหมด
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Date End */}
                    <DatePickerButton
                        label="วันสิ้นสุด"
                        value={dateEnd}
                        onChange={setDateEnd}
                    />

                    {/* Court */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">สนาม</label>
                        <select
                            value={filterCourt}
                            onChange={e => { setFilterCourt(e.target.value); setPage(1); }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ทั้งหมด</option>
                            {COURTS.map(c => (
                                <option key={c.field_no} value={c.field_no}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
                        <select
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="confirmed">ยืนยันแล้ว</option>
                            <option value="cancelled">ยกเลิก</option>
                            <option value="pending_payment">รอชำระ</option>
                        </select>
                    </div>

                    {/* Payment */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">การชำระเงิน</label>
                        <select
                            value={filterPayment}
                            onChange={e => { setFilterPayment(e.target.value); setPage(1); }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="cash">เงินสด</option>
                            <option value="qr">QR โอน</option>
                        </select>
                    </div>

                    {/* Source */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">ช่องทาง</label>
                        <select
                            value={filterSource}
                            onChange={e => { setFilterSource(e.target.value); setPage(1); }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="line">LINE</option>
                            <option value="admin">Admin</option>
                            <option value="line_bot_regular">LINE Bot (ประจำ)</option>
                        </select>
                    </div>

                    {/* Promo */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">โปรโมชัน</label>
                        <select
                            value={filterPromo}
                            onChange={e => { setFilterPromo(e.target.value); setPage(1); }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="promo">ใช้โปรโม</option>
                            <option value="no_promo">ไม่ใช้โปรโม</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">จำนวนจอง</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ผลค้นหาทั้งหมด</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">รายได้รวม</p>
                    <p className="text-2xl font-bold text-green-600">฿{summary.revenue.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{summary.confirmed} ยืนยัน</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">ยกเลิก</p>
                    <p className="text-2xl font-bold text-red-500">{summary.cancelled}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {summary.total > 0 ? ((summary.cancelled / summary.total) * 100).toFixed(1) : 0}% อัตรายกเลิก
                    </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">ส่วนลดรวม</p>
                    <p className="text-2xl font-bold text-orange-500">฿{summary.discounts.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">จากโปรโม/คูปอง</p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md">
                    {error}
                </div>
            )}

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 text-gray-500">กำลังโหลด...</span>
                    </div>
                ) : !hasSearched ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Search className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-lg font-medium">เลือกเงื่อนไขแล้วกด "ค้นหา"</p>
                        <p className="text-sm mt-1">ระบุช่วงวันที่ หรือชื่อ/เบอร์โทร แล้วกดค้นหา</p>
                    </div>
                ) : paged.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Search className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-lg font-medium">ไม่พบผลลัพธ์</p>
                        <p className="text-sm mt-1">ลองเปลี่ยนเงื่อนไขการค้นหา</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                                checked={allOnPageSelected}
                                                onChange={handleToggleAllPage}
                                            />
                                        </th>
                                        <SortHeader label="วันที่" sortKey="date" currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                                        <SortHeader label="เวลา" sortKey="time_from" currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                                        <SortHeader label="สนาม" sortKey="field_no" currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                                        <SortHeader label="ลูกค้า" sortKey="display_name" currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                                        <SortHeader label="ราคา" sortKey="price_total_thb" currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ช่องทาง</th>
                                        <SortHeader label="จองเมื่อ" sortKey="created_at" currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paged.map((b) => {
                                        const isSelected = selectedIds.has(b.booking_id);
                                        return (
                                            <tr
                                                key={b.booking_id}
                                                className={`hover:bg-indigo-50/50 cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50' : ''}`}
                                                onClick={(e) => {
                                                    // If clicking checkbox, don't open detail
                                                    if ((e.target as HTMLElement).tagName === 'INPUT') return;
                                                    openDetail(b);
                                                }}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                                        checked={isSelected}
                                                        onChange={() => toggle(b.booking_id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-gray-900 font-medium">{formatDate(b.date)}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                                    {formatTime(b.time_from)} - {formatTime(b.time_to)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-gray-700">{getCourtName(b.field_no)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-gray-900 font-medium group-hover:text-indigo-600 transition-colors">
                                                        {b.display_name || '-'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{b.phone_number || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-bold text-gray-900">฿{b.price_total_thb.toLocaleString()}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(b.status)}`}>
                                                        {b.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    {formatSource(b.source || b.booking_source)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                                                    {b.created_at ? new Date(b.created_at).toLocaleString('th-TH') : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-sm text-gray-500">
                                แสดง {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, sorted.length)} จาก {sorted.length} รายการ
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm font-medium text-gray-700 px-2">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Booking Detail Modal */}
            <BookingDetailModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                booking={selectedBooking}
                onBookingCancelled={() => { setModalOpen(false); fetchBookings(); }}
                onBookingUpdated={() => { setModalOpen(false); fetchBookings(); }}
                onReschedule={handleReschedule}
            />
        </div>
    );
}

// Sortable column header component
function SortHeader({ label, sortKey, currentKey, dir: _dir, onClick }: {
    label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
    const isActive = currentKey === sortKey;
    return (
        <th
            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none transition-colors"
            onClick={() => onClick(sortKey)}
        >
            <span className="flex items-center gap-1">
                {label}
                <ChevronsUpDown className={`h-3 w-3 ${isActive ? 'text-indigo-600' : 'text-gray-300'}`} />
            </span>
        </th>
    );
}
