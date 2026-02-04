import { useState, useEffect } from 'react';
import {
    getManualPromoCodes,
    createManualPromoCode,
    updateManualPromoCode,
    deleteManualPromoCode,
    type ManualPromoCode
} from '../../lib/promoApi';
import { Plus, Edit2, Trash2, X, Save, AlertCircle, Copy } from 'lucide-react';

export default function VIPCodeTab() {
    const [codes, setCodes] = useState<ManualPromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCode, setEditingCode] = useState<ManualPromoCode | null>(null);
    const [formData, setFormData] = useState<Partial<ManualPromoCode>>({
        code: '',
        discount_type: 'percent',
        discount_value: 0,
        min_price: 0,
        max_discount: 0,
        status: 'active',
        usage_limit: 0
    });
    const [error, setError] = useState('');

    useEffect(() => {
        fetchCodes();
    }, []);

    const fetchCodes = async () => {
        setLoading(true);
        const data = await getManualPromoCodes();
        setCodes(data);
        setLoading(false);
    };

    const handleOpenModal = (code: ManualPromoCode | null = null) => {
        if (code) {
            setEditingCode(code);
            setFormData({ ...code });
        } else {
            setEditingCode(null);
            setFormData({
                code: '',
                discount_type: 'percent',
                discount_value: 0,
                min_price: 0,
                max_discount: 0,
                status: 'active',
                usage_limit: 0
            });
        }
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.code || !formData.discount_value) {
            setError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        const payload: Partial<ManualPromoCode> = {
            ...formData,
            code: formData.code.toUpperCase(), // Ensure code is uppercase
            max_discount: formData.max_discount || null as any, // Handle 0/empty as null if cleaner, but 0 is fine
            usage_limit: formData.usage_limit || null as any
        };

        let result;
        if (editingCode) {
            result = await updateManualPromoCode(editingCode.id, payload);
        } else {
            result = await createManualPromoCode(payload);
        }

        if (result.success) {
            setModalOpen(false);
            fetchCodes();
        } else {
            setError(result.error || 'เกิดข้อผิดพลาด');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('ยืนยันการลบโค้ดนี้?')) return;
        const result = await deleteManualPromoCode(id);
        if (result.success) {
            fetchCodes();
        } else {
            alert('ลบไม่สำเร็จ: ' + result.error);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could show toast
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">จัดการโค้ด VIP (Manual Codes)</h2>
                    <p className="text-gray-500 text-sm">สร้างโค้ดส่วนลดพิเศษสำหรับลูกค้า VIP หรือโปรโมชั่นเฉพาะกิจ</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    สร้างโค้ดใหม่
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">กำลังโหลด...</div>
            ) : codes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                    <p className="text-gray-500">ยังไม่มีโค้ดในระบบ</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Code</th>
                                    <th className="px-6 py-4 font-semibold">ส่วนลด</th>
                                    <th className="px-6 py-4 font-semibold">ขั้นต่ำ</th>
                                    <th className="px-6 py-4 font-semibold">จำกัด</th>
                                    <th className="px-6 py-4 font-semibold">ใช้งานแล้ว</th>
                                    <th className="px-6 py-4 font-semibold">สถานะ</th>
                                    <th className="px-6 py-4 font-semibold text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {codes.map((code) => (
                                    <tr key={code.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                    {code.code}
                                                </span>
                                                <button onClick={() => copyToClipboard(code.code)} className="text-gray-400 hover:text-gray-600" title="Copy">
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-900">
                                            {code.discount_type === 'percent' ? `${code.discount_value}%` : `${code.discount_value}฿`}
                                            {code.max_discount ? <span className="text-gray-400 text-xs ml-1">(สูงสุด {code.max_discount})</span> : ''}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {code.min_price > 0 ? `${code.min_price}฿` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {code.usage_limit ? `${code.usage_limit} ครั้ง` : 'ไม่จำกัด'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {code.usage_count} ครั้ง
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${code.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {code.status === 'active' ? 'ใช้งานได้' : 'ปิดใช้งาน'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(code)}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(code.id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingCode ? 'แก้ไขโค้ดส่วนลด' : 'สร้างโค้ดใหม่'}
                            </h3>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสโค้ด (Code)</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase tracking-wide font-mono"
                                    placeholder="VIP2026"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทส่วนลด</label>
                                    <select
                                        value={formData.discount_type}
                                        onChange={e => setFormData({ ...formData, discount_type: e.target.value as 'fixed' | 'percent' })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                                        <option value="fixed">จำนวนเงิน (บาท)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">มูลค่าส่วนลด</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.discount_value}
                                        onChange={e => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ราคาขั้นต่ำ</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.min_price}
                                        onChange={e => setFormData({ ...formData, min_price: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="0 = ไม่จำกัด"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ลดสูงสุด (เฉพาะ %)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        disabled={formData.discount_type === 'fixed'}
                                        value={formData.max_discount}
                                        onChange={e => setFormData({ ...formData, max_discount: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">จำกัดจำนวนครั้ง</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.usage_limit}
                                        onChange={e => setFormData({ ...formData, usage_limit: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="0 = ไม่จำกัด"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
