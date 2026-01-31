import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Loader2, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/api';

interface CampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaign?: any; // If null, create mode. If set, edit mode.
    onSuccess: () => void;
}

export default function CampaignModal({ isOpen, onClose, campaign, onSuccess }: CampaignModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image_url: '',

        // Benefit Logic
        discount_type: 'amount', // amount | percent | item
        discount_amount: 0,
        discount_percent: 0,
        reward_item: '', // New: For 'item' type
        is_stackable: false, // false = Main, true = On-Top
        is_public: true, // New: true = Public, false = Secret

        // Conditions
        start_date: '',
        end_date: '',
        valid_time_start: '',
        valid_time_end: '',
        eligible_fields: [] as number[], // [1, 2]
        payment_methods: [] as string[], // ['QR', 'CASH']
        min_spend: 0, // New
        eligible_days: [] as string[], // New: ['Mon', 'Tue']

        // Inventory
        limit_per_user: 1,
        total_quantity: 100,
        secret_codes: [] as string[], // ['CODE1', 'CODE2']
        status: 'active'
    });

    // Temp state for tag inputs
    const [secretInput, setSecretInput] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (campaign) {
                // Edit Mode
                setFormData({
                    name: campaign.name,
                    description: campaign.description || '',
                    image_url: campaign.image_url || '',

                    discount_type: campaign.reward_item ? 'item' : (campaign.discount_percent > 0 ? 'percent' : 'amount'),
                    discount_amount: campaign.discount_amount || 0,
                    discount_percent: campaign.discount_percent || 0,
                    reward_item: campaign.reward_item || '',
                    is_stackable: campaign.is_stackable || false,
                    is_public: campaign.is_public ?? true,

                    start_date: campaign.start_date ? campaign.start_date.split('T')[0] : '',
                    end_date: campaign.end_date ? campaign.end_date.split('T')[0] : '',
                    valid_time_start: campaign.valid_time_start || '',
                    valid_time_end: campaign.valid_time_end || '',
                    eligible_fields: campaign.eligible_fields || [],
                    payment_methods: campaign.payment_methods || [],
                    min_spend: campaign.min_spend || 0,
                    eligible_days: campaign.eligible_days || [],

                    limit_per_user: campaign.limit_per_user || 1,
                    total_quantity: campaign.total_quantity || 100,
                    secret_codes: campaign.secret_codes || [],
                    status: campaign.status || 'active'
                });
            } else {
                // Reset for Create Mode
                setFormData({
                    name: '',
                    description: '',
                    image_url: '',
                    discount_type: 'amount',
                    discount_amount: 0,
                    discount_percent: 0,
                    reward_item: '',
                    is_stackable: false,
                    is_public: true,
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                    valid_time_start: '',
                    valid_time_end: '',
                    eligible_fields: [],
                    payment_methods: [],
                    min_spend: 0,
                    eligible_days: [],
                    limit_per_user: 1,
                    total_quantity: 100,
                    secret_codes: [],
                    status: 'active'
                });
            }
            setError(null);
        }
    }, [isOpen, campaign]);

    if (!isOpen) return null;

    // Helper Toggles
    const toggleArrayItem = <T,>(item: T, key: keyof typeof formData) => {
        setFormData(prev => {
            const current = prev[key] as T[];
            if (current.includes(item)) {
                return { ...prev, [key]: current.filter(i => i !== item) };
            } else {
                return { ...prev, [key]: [...current, item] };
            }
        });
    };

    const addSecretCode = () => {
        if (secretInput.trim()) {
            setFormData(prev => ({
                ...prev,
                secret_codes: [...prev.secret_codes, secretInput.trim()]
            }));
            setSecretInput('');
        }
    };

    const removeSecretCode = (codeToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            secret_codes: prev.secret_codes.filter(code => code !== codeToRemove)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validation
            if (!formData.name) throw new Error('Campaign Name is required');
            if (formData.discount_type === 'amount' && formData.discount_amount <= 0) throw new Error('Invalid discount amount');
            if (formData.discount_type === 'percent' && (formData.discount_percent <= 0 || formData.discount_percent > 100)) throw new Error('Invalid discount percent');
            if (formData.discount_type === 'item' && !formData.reward_item) throw new Error('Reward Item Name is required');

            const payload = {
                name: formData.name,
                description: formData.description,
                image_url: formData.image_url,

                // Benefit Logic
                discount_amount: formData.discount_type === 'amount' ? Number(formData.discount_amount) : 0,
                discount_percent: formData.discount_type === 'percent' ? Number(formData.discount_percent) : 0,
                reward_item: formData.discount_type === 'item' ? formData.reward_item : null,
                is_stackable: formData.is_stackable,
                coupon_type: formData.is_stackable ? 'ontop' : 'main',
                is_public: formData.is_public,

                // Conditions
                min_spend: Number(formData.min_spend),
                start_date: new Date(formData.start_date).toISOString(),
                end_date: new Date(formData.end_date).toISOString(),
                valid_time_start: formData.valid_time_start || null,
                valid_time_end: formData.valid_time_end || null,
                eligible_fields: formData.eligible_fields.length > 0 ? formData.eligible_fields : null,
                payment_methods: formData.payment_methods.length > 0 ? formData.payment_methods : null,
                eligible_days: formData.eligible_days.length > 0 ? formData.eligible_days : null,

                // Inventory
                limit_per_user: Number(formData.limit_per_user),
                total_quantity: Number(formData.total_quantity),
                secret_codes: formData.secret_codes.length > 0 ? formData.secret_codes : null,
                status: formData.status,
            };

            if (campaign) {
                const { error } = await supabase.from('campaigns').update(payload).eq('id', campaign.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('campaigns').insert([payload]);
                if (error) throw error;
            }

            onSuccess();
            onClose();

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save campaign');
        } finally {
            setLoading(false);
        }
    };

    const daysOfWeek = [
        { id: 'Mon', label: 'Mon' }, { id: 'Tue', label: 'Tue' }, { id: 'Wed', label: 'Wed' },
        { id: 'Thu', label: 'Thu' }, { id: 'Fri', label: 'Fri' }, { id: 'Sat', label: 'Sat' }, { id: 'Sun', label: 'Sun' }
    ];

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">
                            {campaign ? 'Edit Campaign (V2)' : 'Create New Campaign (V2)'}
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="px-6 py-6 max-h-[80vh] overflow-y-auto bg-gray-50/30">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 shadow-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-8">

                            {/* SECTION A: Basic Info */}
                            <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">A</span>
                                    Basic Info
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Campaign Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Flash Sale 2.2"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                            rows={2}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Terms & Conditions..."
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Banner Image URL</label>
                                        <div className="mt-1 flex rounded-lg shadow-sm">
                                            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                                <ImageIcon className="w-4 h-4" />
                                            </span>
                                            <input
                                                type="text"
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 border"
                                                value={formData.image_url}
                                                onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                                placeholder="https://example.com/banner.jpg"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION B: Benefit Logic */}
                            <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">B</span>
                                    Benefit Logic
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Coupon Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Coupon Type</label>
                                        <div className="flex gap-2">
                                            <button type="button"
                                                onClick={() => setFormData({ ...formData, is_stackable: false })}
                                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border text-center ${!formData.is_stackable ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                                                🔴 Main (Exclusive)
                                            </button>
                                            <button type="button"
                                                onClick={() => setFormData({ ...formData, is_stackable: true })}
                                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border text-center ${formData.is_stackable ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                                                🔵 On-Top (Stackable)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Acquisition Method */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Acquisition Method</label>
                                        <div className="flex gap-2">
                                            <button type="button"
                                                onClick={() => setFormData({ ...formData, is_public: true })}
                                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border text-center items-center justify-center flex gap-1 ${formData.is_public ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                                                <Eye className="w-4 h-4" /> Public List
                                            </button>
                                            <button type="button"
                                                onClick={() => setFormData({ ...formData, is_public: false })}
                                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border text-center items-center justify-center flex gap-1 ${!formData.is_public ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-white border-gray-300 text-gray-600'}`}>
                                                <EyeOff className="w-4 h-4" /> Hidden (Code)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Benefit Details */}
                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Type</label>
                                            <select
                                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
                                                value={formData.discount_type}
                                                onChange={e => setFormData({ ...formData, discount_type: e.target.value })}
                                            >
                                                <option value="amount">💰 Money Discount (฿)</option>
                                                <option value="percent">Percent Discount (%)</option>
                                                <option value="item">🎁 Free Item</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            {formData.discount_type === 'amount' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount (THB)</label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">฿</span>
                                                        </div>
                                                        <input type="number" min="0" className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 sm:text-sm border-gray-300 rounded-md border p-2"
                                                            value={formData.discount_amount}
                                                            onChange={e => setFormData({ ...formData, discount_amount: parseFloat(e.target.value), discount_percent: 0 })} />
                                                    </div>
                                                </div>
                                            )}
                                            {formData.discount_type === 'percent' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percentage (%)</label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <input type="number" min="0" max="100" className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md border p-2"
                                                            value={formData.discount_percent}
                                                            onChange={e => setFormData({ ...formData, discount_percent: parseFloat(e.target.value), discount_amount: 0 })} />
                                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {formData.discount_type === 'item' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward Item Name</label>
                                                    <input type="text" className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md border p-2"
                                                        placeholder="e.g. Namthip Water 1 Pack"
                                                        value={formData.reward_item}
                                                        onChange={e => setFormData({ ...formData, reward_item: e.target.value })} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION C: Conditions */}
                            <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">C</span>
                                    Conditions
                                </h4>
                                <div className="space-y-4">
                                    {/* Min Spend */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Spend (Optional)</label>
                                        <div className="relative rounded-md shadow-sm max-w-xs">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 sm:text-sm">฿</span>
                                            </div>
                                            <input type="number" min="0" className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 sm:text-sm border-gray-300 rounded-md border p-2"
                                                value={formData.min_spend}
                                                onChange={e => setFormData({ ...formData, min_spend: parseFloat(e.target.value) })}
                                                placeholder="0" />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">Price must be greater than this to use coupon.</p>
                                    </div>

                                    {/* Eligible Days */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Eligible Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {daysOfWeek.map(day => (
                                                <button key={day.id} type="button"
                                                    onClick={() => toggleArrayItem(day.id, 'eligible_days')}
                                                    className={`w-10 h-10 rounded-full text-xs font-bold transition-colors ${formData.eligible_days.includes(day.id)
                                                        ? 'bg-indigo-600 text-white shadow-md'
                                                        : 'bg-white border border-gray-200 text-gray-400 hover:border-indigo-300'
                                                        }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                            {formData.eligible_days.length === 0 && <span className="text-xs text-gray-400 self-center ml-2">(All Days)</span>}
                                        </div>
                                    </div>

                                    {/* Fields & Payments */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Courts</label>
                                            <div className="flex flex-wrap gap-2">
                                                {[1, 2, 3, 4, 5, 6].map(id => (
                                                    <button key={id} type="button"
                                                        onClick={() => toggleArrayItem(id, 'eligible_fields')}
                                                        className={`px-3 py-1 rounded-md text-xs font-medium border ${formData.eligible_fields.includes(id)
                                                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                                            : 'bg-white text-gray-600 border-gray-300'
                                                            }`}
                                                    >
                                                        Field {id}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Methods</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['CASH', 'QR', 'TRANSFER'].map(method => (
                                                    <button key={method} type="button"
                                                        onClick={() => toggleArrayItem(method, 'payment_methods')}
                                                        className={`px-3 py-1 rounded-md text-xs font-medium border ${formData.payment_methods.includes(method)
                                                            ? 'bg-green-100 text-green-800 border-green-200'
                                                            : 'bg-white text-gray-600 border-gray-300'
                                                            }`}
                                                    >
                                                        {method}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Time Range */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Valid From (Time)</label>
                                            <input type="time" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
                                                value={formData.valid_time_start}
                                                onChange={e => setFormData({ ...formData, valid_time_start: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Valid Until (Time)</label>
                                            <input type="time" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
                                                value={formData.valid_time_end}
                                                onChange={e => setFormData({ ...formData, valid_time_end: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION D: Inventory & Limits */}
                            <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">D</span>
                                    Inventory & Limits
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Total Quantity</label>
                                        <input type="number" min="1" className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                                            value={formData.total_quantity}
                                            onChange={e => setFormData({ ...formData, total_quantity: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Limit Per User</label>
                                        <input type="number" min="1" className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                                            value={formData.limit_per_user}
                                            onChange={e => setFormData({ ...formData, limit_per_user: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                        <input type="date" required className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                                            value={formData.start_date}
                                            onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                                        <input type="date" required className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                                            value={formData.end_date}
                                            onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                    </div>
                                </div>

                                {/* Secret Codes (For Hidden Campaigns) */}
                                {!formData.is_public && (
                                    <div className="mt-6 border-t border-gray-100 pt-4 bg-yellow-50 p-4 rounded-lg">
                                        <h4 className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-2 flex items-center">
                                            <Lock className="w-3 h-3 mr-1" /> Secret Codes (Required for Hidden Campaigns)
                                        </h4>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block sm:text-sm border-yellow-300 rounded-md border p-2"
                                                placeholder="e.g. EARLYBIRD2024"
                                                value={secretInput}
                                                onChange={e => setSecretInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSecretCode())} />
                                            <button type="button" onClick={addSecretCode} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none">
                                                Add
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.secret_codes.map((code, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                    {code}
                                                    <button type="button" className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full text-yellow-500 hover:bg-yellow-200 focus:outline-none"
                                                        onClick={() => removeSecretCode(code)}>
                                                        <span className="sr-only">Remove</span>
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                            {formData.secret_codes.length === 0 && (
                                                <span className="text-xs text-red-500">* Please add at least one secret code</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>

                        </div>

                        {/* Footer Buttons */}
                        <div className="mt-6 border-t border-gray-100 pt-5 flex justify-between items-center bg-white p-4 sticky bottom-0 border shadow-lg rounded-xl">
                            <div className="flex items-center">
                                <input id="status" type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    checked={formData.status === 'active'}
                                    onChange={e => setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })} />
                                <label htmlFor="status" className="ml-2 block text-sm font-medium text-gray-900">
                                    Active Campaign
                                </label>
                            </div>

                            <div className="flex gap-3">
                                <button type="button" onClick={onClose} className="bg-white py-2 px-6 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                                    Cancel
                                </button>
                                <button type="submit" disabled={loading || (!formData.is_public && formData.secret_codes.length === 0)} className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : <Save className="-ml-1 mr-2 h-4 w-4" />}
                                    Save Campaign
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
