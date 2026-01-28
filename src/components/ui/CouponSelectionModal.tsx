import { useState, useEffect, useMemo } from 'react';
import { X, Ticket, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/api';

interface Coupon {
    id: string; // user_coupon_id
    campaign_id: string;
    name: string;
    benefit_type: 'DISCOUNT' | 'REWARD';
    benefit_value: any;
    conditions: any;
}

interface Wallet {
    main: Coupon[];
    on_top: Coupon[];
}

interface CouponSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    totalPrice: number; // For condition check / calculation
    onConfirm: (selectedIds: string[], totalDiscount: number, finalPrice: number) => void;
}

export default function CouponSelectionModal({ isOpen, onClose, userId, totalPrice, onConfirm }: CouponSelectionModalProps) {
    const [wallet, setWallet] = useState<Wallet>({ main: [], on_top: [] });
    const [loading, setLoading] = useState(false);
    const [selectedMain, setSelectedMain] = useState<string | null>(null);
    const [selectedOnTop, setSelectedOnTop] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && userId) {
            fetchWallet();
        }
    }, [isOpen, userId]);

    const fetchWallet = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons?userId=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setWallet(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleMain = (id: string) => {
        setSelectedMain(prev => prev === id ? null : id);
    };

    const handleToggleOnTop = (id: string) => {
        setSelectedOnTop(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const calculation = useMemo(() => {
        let discount = 0;
        let rewardItems: string[] = [];

        // Apply Main
        if (selectedMain) {
            const coupon = wallet.main.find(c => c.id === selectedMain);
            if (coupon) {
                if (coupon.benefit_type === 'DISCOUNT') {
                    if (coupon.benefit_value.amount) {
                        discount += Number(coupon.benefit_value.amount);
                    } else if (coupon.benefit_value.percent) {
                        discount += (totalPrice * Number(coupon.benefit_value.percent)) / 100;
                    }
                } else {
                    rewardItems.push(coupon.benefit_value.item);
                }
            }
        }

        // Apply On-Top
        selectedOnTop.forEach(id => {
            const coupon = wallet.on_top.find(c => c.id === id);
            if (coupon) {
                if (coupon.benefit_type === 'DISCOUNT') {
                    if (coupon.benefit_value.amount) {
                        discount += Number(coupon.benefit_value.amount);
                    } else if (coupon.benefit_value.percent) {
                        // On-top percent usually applies to remaining? Or total? 
                        // Requirement says "Stackable". Usually on Total unless spec says otherwise.
                        // Let's assume on Total for simplicity unless "On Top" implies logic.
                        // Shopee usually allows 1 Store + 1 Platform.
                        // Current system: Main + Multiple On-top. 
                        // Let's add them up.
                        discount += (totalPrice * Number(coupon.benefit_value.percent)) / 100;
                    }
                } else {
                    rewardItems.push(coupon.benefit_value.item);
                }
            }
        });

        // Cap discount
        if (discount > totalPrice) discount = totalPrice;

        return {
            totalDiscount: Math.ceil(discount),
            finalPrice: Math.max(0, totalPrice - Math.ceil(discount)),
            items: rewardItems
        };
    }, [selectedMain, selectedOnTop, wallet, totalPrice]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
            <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                <div className="relative bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-bold text-gray-900">Select Coupons</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {loading ? <Loader2 className="animate-spin mx-auto my-10" /> : (
                            <>
                                {/* Main Section */}
                                {wallet.main.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Main Coupon (Select 1)</h3>
                                        <div className="space-y-2">
                                            {wallet.main.map(c => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => handleToggleMain(c.id)}
                                                    className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${selectedMain === c.id ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:border-gray-300'}`}
                                                >
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{c.name}</div>
                                                        <div className="text-sm text-gray-500">{c.benefit_type === 'DISCOUNT' ? 'Discount' : 'Reward'}</div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedMain === c.id ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                                        {selectedMain === c.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* On Top Section */}
                                {wallet.on_top.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">On-Top Coupons (Stackable)</h3>
                                        <div className="space-y-2">
                                            {wallet.on_top.map(c => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => handleToggleOnTop(c.id)}
                                                    className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${selectedOnTop.includes(c.id) ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:border-gray-300'}`}
                                                >
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{c.name}</div>
                                                        <div className="text-sm text-gray-500">{c.benefit_type === 'DISCOUNT' ? 'Discount' : 'Reward'}</div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selectedOnTop.includes(c.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                                        {selectedOnTop.includes(c.id) && <CheckCircle className="w-4 h-4 text-white" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {wallet.main.length === 0 && wallet.on_top.length === 0 && (
                                    <div className="text-center py-10 text-gray-400">
                                        <Ticket className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>No available coupons</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 bg-gray-50 rounded-b-xl">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-600">Total Discount</span>
                            <span className="font-bold text-green-600">-฿{calculation.totalDiscount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-semibold text-gray-900">Final Price</span>
                            <span className="font-bold text-xl text-gray-900">฿{calculation.finalPrice.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={() => {
                                const ids = [];
                                if (selectedMain) ids.push(selectedMain);
                                ids.push(...selectedOnTop);
                                onConfirm(ids, calculation.totalDiscount, calculation.finalPrice);
                            }}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                        >
                            Confirm Selection
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
