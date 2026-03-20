
import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Search, Tag, CreditCard, User, Phone, FileText } from 'lucide-react';
import { supabase } from '../../lib/api';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { name: string; phone: string; note: string; paymentMethod: string; campaignId?: string }) => Promise<void>;
    bookingDetails: {
        courtName: string;
        date: string;
        startTime: string;
        endTime: string;
        price?: number;
    } | null;
}

export default function BookingModal({ isOpen, onClose, onConfirm, bookingDetails }: BookingModalProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('field');
    const [campaignId, setCampaignId] = useState('');
    const [searchCode, setSearchCode] = useState(''); // For manual code entry
    const [isCampaignsOpen, setIsCampaignsOpen] = useState(false); // Toggle campaign list

    // Campaign Data
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset and Fetch Campaigns when opening
    useEffect(() => {
        if (isOpen) {
            setName('');
            setPhone('');
            setNote('');
            setPaymentMethod('field');
            setCampaignId('');
            setSearchCode('');
            setIsCampaignsOpen(false);
            setError(null);
            setLoading(false);
            fetchCampaigns();
        }
    }, [isOpen]);

    const fetchCampaigns = async () => {
        setLoadingCampaigns(true);
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .select('id, name, code, discount_amount, discount_percent, reward_item, min_spend, start_date, end_date')
                .eq('status', 'active')
                .gt('end_date', new Date().toISOString())
                .lte('start_date', new Date().toISOString());

            if (error) throw error;
            setCampaigns(data || []);
        } catch (err) {
            console.error('Error fetching campaigns:', err);
        } finally {
            setLoadingCampaigns(false);
        }
    };

    // --- Calculations ---
    const originalPrice = bookingDetails?.price || 0;

    const selectedCampaign = useMemo(() => {
        return campaigns.find(c => c.id === campaignId);
    }, [campaignId, campaigns]);

    const discount = useMemo(() => {
        if (!selectedCampaign) return 0;

        // 1. Check Min Spend
        if (selectedCampaign.min_spend && originalPrice < selectedCampaign.min_spend) {
            return 0;
        }

        // 2. Calculate
        if (selectedCampaign.reward_item) return 0; // Free item, no price discount
        if (selectedCampaign.discount_amount) return selectedCampaign.discount_amount;
        if (selectedCampaign.discount_percent) return Math.floor((originalPrice * selectedCampaign.discount_percent) / 100);

        return 0;
    }, [selectedCampaign, originalPrice]);

    const finalPrice = Math.max(0, originalPrice - discount);

    // --- Search Filter ---
    const filteredCampaigns = useMemo(() => {
        if (!searchCode) return campaigns;
        const lower = searchCode.toLowerCase();
        return campaigns.filter(c =>
            c.code.toLowerCase().includes(lower) ||
            c.name.toLowerCase().includes(lower)
        );
    }, [campaigns, searchCode]);


    const handleAutoSelectCode = (code: string) => {
        const found = campaigns.find(c => c.code.toLowerCase() === code.trim().toLowerCase());
        if (found) {
            setCampaignId(found.id);
            setIsCampaignsOpen(false);
            setSearchCode(''); // Clear search after selection
        }
    };

    if (!isOpen || !bookingDetails) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone) {
            setError('กรุณากรอกชื่อและเบอร์โทรศัพท์');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onConfirm({
                name,
                phone,
                note,
                paymentMethod,
                campaignId: campaignId || undefined
            });
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'เกิดข้อผิดพลาดในการจอง');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Background backdrop */}
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            📅 สร้างการจองใหม่
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="px-6 py-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                {/* LEFT COLUMN: Customer Info */}
                                <div className="space-y-6">
                                    <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2 border-b pb-1">ข้อมูลลูกค้า</h4>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                                <User className="w-4 h-4 text-gray-400" /> ชื่อผู้จอง <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                id="name"
                                                required
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                                placeholder="ระบุชื่อลูกค้า / ทีม"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                                <Phone className="w-4 h-4 text-gray-400" /> เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                id="phone"
                                                required
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                                placeholder="0XX-XXX-XXXX"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                                <FileText className="w-4 h-4 text-gray-400" /> หมายเหตุ
                                            </label>
                                            <textarea
                                                id="note"
                                                rows={3}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                                placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: Booking & Payment */}
                                <div className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                                    <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2 border-b pb-1">รายละเอียดการชำระเงิน</h4>

                                    {/* Booking Summary Card */}
                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-gray-900 text-lg">{bookingDetails.courtName}</p>
                                                <p className="text-sm text-gray-500">{bookingDetails.date}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                    {bookingDetails.startTime} - {bookingDetails.endTime}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coupon Section */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Tag className="w-4 h-4 text-gray-400" /> โค้ดส่วนลด / โปรโมชั่น
                                        </label>

                                        <div className="flex gap-2 mb-2">
                                            <div className="relative flex-grow">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Search className="h-4 w-4 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
                                                    placeholder="ค้นหาโค้ด หรือ เลือกจากรายการ"
                                                    value={searchCode}
                                                    onChange={(e) => {
                                                        setSearchCode(e.target.value);
                                                        setIsCampaignsOpen(true);
                                                    }}
                                                    onFocus={() => setIsCampaignsOpen(true)}
                                                    onBlur={() => {
                                                        handleAutoSelectCode(searchCode);
                                                        // Delay to allow click on item
                                                        setTimeout(() => setIsCampaignsOpen(false), 200);
                                                    }}
                                                />
                                            </div>
                                            {campaignId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCampaignId('');
                                                        setSearchCode('');
                                                    }}
                                                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                                                >
                                                    ยกเลิก
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown List */}
                                        {isCampaignsOpen && (
                                            <div className="absolute z-10 w-80 bg-white shadow-lg max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                                {loadingCampaigns ? (
                                                    <div className="p-4 text-center text-gray-500">กำลังโหลด...</div>
                                                ) : filteredCampaigns.length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500">ไม่พบโปรโมชั่น</div>
                                                ) : (
                                                    filteredCampaigns.map((c) => (
                                                        <div
                                                            key={c.id}
                                                            className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50 ${campaignId === c.id ? 'bg-indigo-50 text-indigo-900' : 'text-gray-900'}`}
                                                            onClick={() => {
                                                                setCampaignId(c.id);
                                                                setSearchCode(c.code); // Show selected code
                                                                setIsCampaignsOpen(false);
                                                            }}
                                                            onMouseDown={(e) => e.preventDefault()} // Prevent blur
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-medium block truncate">{c.code}</span>
                                                                {c.reward_item ? (
                                                                    <span className="text-green-600 text-xs font-bold border border-green-200 bg-green-50 px-2 py-0.5 rounded-full">ฟรี {c.reward_item}</span>
                                                                ) : (
                                                                    <span className="text-indigo-600 text-xs font-bold bg-indigo-100 px-2 py-0.5 rounded-full">
                                                                        {c.discount_percent ? `-${c.discount_percent}%` : `-${c.discount_amount}฿`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-gray-500 text-xs block truncate pr-2">{c.name}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {/* Selected Campaign Info */}
                                        {selectedCampaign && (
                                            <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100 text-sm">
                                                <div className="flex justify-between text-green-800 font-medium">
                                                    <span>✅ ใช้โค้ด: {selectedCampaign.code}</span>
                                                    {discount > 0 ? <span>- {discount.toLocaleString()}฿</span> : <span>ของแถม: {selectedCampaign.reward_item}</span>}
                                                </div>
                                                <div className="text-green-600 text-xs mt-1">{selectedCampaign.name}</div>
                                                {selectedCampaign.min_spend > originalPrice && (
                                                    <div className="text-red-500 text-xs mt-1 font-bold">⚠️ ยอดขั้นต่ำ {selectedCampaign.min_spend} บาท (ส่วนลดจะไม่ถูกนำมาคำนวณ)</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Method - Admin bookings are always cash */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <CreditCard className="w-4 h-4 text-gray-400" /> วิธีชำระเงิน
                                        </label>
                                        <div className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 sm:text-sm rounded-lg border bg-gray-50 text-gray-700 font-medium">
                                            💵 เงินสด / จ่ายหน้าสนาม
                                        </div>
                                    </div>

                                    {/* Price Breakdown */}
                                    <div className="border-t border-gray-200 pt-4 space-y-2">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>ราคาปกติ</span>
                                            <span>{originalPrice.toLocaleString()} บาท</span>
                                        </div>
                                        {discount > 0 && (
                                            <div className="flex justify-between text-sm text-red-600 font-medium">
                                                <span>ส่วนลด</span>
                                                <span>- {discount.toLocaleString()} บาท</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-end pt-2 border-t border-dashed border-gray-300">
                                            <span className="text-base font-bold text-gray-900">ยอดชำระสุทธิ</span>
                                            <span className="text-2xl font-bold text-indigo-600">{finalPrice.toLocaleString()} <span className="text-sm font-normal text-gray-500">บาท</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                                    <p className="font-bold">เกิดข้อผิดพลาด</p>
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                                <button
                                    type="button"
                                    className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                    onClick={onClose}
                                    disabled={loading}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-200 transition-colors disabled:opacity-50 flex justify-center items-center"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        'ยืนยันการจอง'
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

