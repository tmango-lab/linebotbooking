import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/api';
import { useLiff } from '../../providers/LiffProvider';
import { getLiffUser } from '../../lib/liff';
import { Loader2, Ticket, Lock, Clock, History, AlertCircle, Share2 } from 'lucide-react';
import CouponDetailModal from '../../components/ui/CouponDetailModal';
import { formatDate } from '../../utils/date';

interface Coupon {
    coupon_id: string; // user_coupon_id
    campaign_id: string;
    name: string;
    description?: string | null;
    expiry: string;
    status: string; // ACTIVE, USED, EXPIRED
    image?: string | null;
    benefit: {
        type: 'DISCOUNT' | 'REWARD';
        value: any;
    };
    conditions: any;
}

interface Wallet {
    main: Coupon[];
    on_top: Coupon[];
}

export default function WalletPage() {
    // State
    const [userId, setUserId] = useState('');
    const [wallet, setWallet] = useState<Wallet>({ main: [], on_top: [] }); // Active Coupons
    const [historyCoupons, setHistoryCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'my_coupons' | 'market'>('my_coupons');
    const [showHistory, setShowHistory] = useState(false);
    const [selectedCoupon, setSelectedCoupon] = useState<Coupon | any | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Collect Logic
    const [collectDetails, setCollectDetails] = useState({ secretCode: '' });
    const [isRedeemOpen, setIsRedeemOpen] = useState(false);
    const [collecting, setCollecting] = useState(false);
    const collectingRef = useRef(false);

    // Market
    const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([]);

    const { isReady, liffUser } = useLiff();

    // Init
    useEffect(() => {
        if (!isReady) return;

        const initUser = async () => {
            let params = new URLSearchParams(window.location.search);
            if (window.location.hash.includes('?')) {
                const hashQuery = window.location.hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQuery);
                hashParams.forEach((val, key) => params.append(key, val));
            }

            let uid = params.get('userId');
            const action = params.get('action');
            const code = params.get('code') || '';
            const cid = params.get('id') || params.get('campaignId');

            if (!uid && liffUser?.userId) uid = liffUser.userId;

            if (!uid) {
                console.log("Wallet: No User ID found, enforcing LIFF login...");
                const user = await getLiffUser({ requireLogin: true });
                if (user.userId) uid = user.userId;
            }

            if (uid) {
                setUserId(uid);
                fetchWallet(uid);

                if (action === 'collect' && cid && !collectingRef.current) {
                    collectingRef.current = true;
                    doAutoCollect(uid, cid, code);
                }
            }
        };

        initUser();
    }, [isReady, liffUser]);

    // Data Fetching
    const fetchWallet = async (uid: string) => {
        if (!uid) return;
        setLoading(true);
        try {
            const token = import.meta.env.VITE_SUPABASE_ANON_KEY;

            // 1. Fetch Active
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: uid, filter: 'active' })
            });

            if (res.ok) {
                const data = await res.json();
                setWallet(data);

                // Fetch Market (Available)
                const { data: campaigns } = await supabase
                    .from('campaigns')
                    .select('*')
                    .eq('is_public', true)
                    .eq('status', 'active')
                    .gt('end_date', new Date().toISOString())
                    .lte('start_date', new Date().toISOString());

                if (campaigns) {
                    const myCoupons = [...data.main, ...data.on_top];

                    const availableToCollect = campaigns.filter(c => {
                        // Count how many ACTIVE coupons of this campaign the user already has
                        const collectedCount = myCoupons.filter(userCoupon => userCoupon.campaign_id === c.id).length;
                        // Allow displaying if collected count is less than the campaign limit
                        return collectedCount < (c.limit_per_user || 1);
                    });

                    setAvailableCampaigns(availableToCollect);
                }
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const token = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, filter: 'history' })
            });

            if (res.ok) {
                const data = await res.json();
                // Merge main and on_top for history view
                setHistoryCoupons([...data.main, ...data.on_top]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Actions
    const doAutoCollect = async (uid: string, cid: string, code: string) => {
        setCollecting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect-coupon`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ userId: uid, campaignId: cid, secretCode: code })
            });

            const data = await res.json();
            if (!res.ok) {
                if (!data.error?.includes('already collected') && !data.error?.includes('Limit reached')) {
                    throw new Error(data.error || 'Failed to collect');
                }
            } else {
                alert(`🎉 ยินดีด้วย! เก็บคูปองเรียบร้อยแล้วครับ!`);
            }

            // Cleanup URL
            const hashValue = window.location.hash || '#/wallet';
            const cleanHash = hashValue.split('?')[0];
            const newUrl = `${window.location.pathname}${cleanHash}?userId=${uid}`;
            window.history.replaceState({}, '', newUrl);

            fetchWallet(uid);
        } catch (error: any) {
            alert(`เสียใจด้วยครับ 😅\n${error.message}`);
        } finally {
            setCollecting(false);
        }
    };

    const handleRedeemCode = async () => {
        if (!userId || !collectDetails.secretCode) return;
        await doAutoCollect(userId, '', collectDetails.secretCode);
        setCollectDetails({ secretCode: '' });
        setIsRedeemOpen(false);
    };

    const handleUseCoupon = (e: React.MouseEvent, coupon: Coupon) => {
        e.stopPropagation(); // Don't open detail modal
        const target = `/booking-v3?userId=${userId}&couponId=${coupon.coupon_id}`;
        window.location.hash = `#${target}`;
    };

    const openDetail = (item: any) => {
        setSelectedCoupon(item);
        setIsDetailOpen(true);
    };

    // Components
    const CouponCard = ({ coupon, type, isHistory = false }: { coupon: Coupon, type: 'Main' | 'On-top', isHistory?: boolean }) => {
        const isMain = type === 'Main';
        const isExpiring = !isHistory && coupon.expiry &&
            (new Date(coupon.expiry).getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000); // 3 days

        const bgClass = isHistory
            ? 'bg-gray-100 border-gray-200 text-gray-500 grayscale opacity-80'
            : isMain
                ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
                : 'bg-white border border-gray-100 text-gray-900';

        const borderClass = isMain && !isHistory ? 'border border-gray-700' : 'border border-gray-200';
        const iconColor = isHistory ? 'text-gray-400' : (isMain ? 'text-yellow-400' : 'text-indigo-500');
        const badgeClass = isHistory ? 'bg-gray-200 text-gray-500' : (isMain ? 'bg-yellow-500 text-black' : 'bg-indigo-100 text-indigo-700');

        return (
            <div
                onClick={() => openDetail(coupon)}
                className={`relative p-5 rounded-2xl shadow-sm ${bgClass} ${borderClass} overflow-hidden transition-all active:scale-[0.98] cursor-pointer`}
            >
                {/* Background Decor */}
                {!isHistory && (
                    <>
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
                        <div className="absolute top-10 -left-10 w-24 h-24 bg-current opacity-5 rounded-full blur-xl"></div>
                    </>
                )}

                <div className="relative z-10 flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${badgeClass}`}>
                                {isHistory ? coupon.status : type}
                            </span>
                            {isExpiring && (
                                <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                    <Clock className="w-3 h-3" /> Expiring
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-lg leading-tight mb-1">{coupon.name}</h3>
                        <p className={`text-sm ${isMain && !isHistory ? 'text-gray-400' : 'text-gray-500'}`}>
                            {coupon.benefit?.type === 'DISCOUNT'
                                ? (coupon.benefit?.value?.amount ? `Save ฿${coupon.benefit.value.amount}` : `Save ${coupon.benefit?.value?.percent ?? 0}%`)
                                : `Free ${coupon.benefit?.value?.item ?? 'Reward'}`
                            }
                        </p>
                    </div>
                    <div className={`p-3 rounded-full ${isMain && !isHistory ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <Ticket className={`w-6 h-6 ${iconColor}`} />
                    </div>
                </div>

                <div className={`my-4 border-t border-dashed ${isMain && !isHistory ? 'border-gray-700' : 'border-gray-300'}`}></div>

                <div className="flex justify-between items-end">
                    <div className="text-xs opacity-60">
                        <p>Exp: {coupon.expiry ? formatDate(coupon.expiry) : 'No Expiry'}</p>
                    </div>
                    {!isHistory && (
                        <button
                            onClick={(e) => handleUseCoupon(e, coupon)}
                            className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${isMain ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
                        >
                            Use Now
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            {/* Header */}
            <div className="bg-white pt-8 px-6 pb-4 shadow-sm rounded-b-[2rem] mb-4 sticky top-0 z-40">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Wallet</h1>
                        <p className="text-gray-500 text-xs">Your Rewards & Coupons</p>
                    </div>
                    <button
                        onClick={() => setIsRedeemOpen(!isRedeemOpen)}
                        className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                        <Lock className="w-3 h-3" />
                        Redeem Code
                    </button>
                </div>

                {/* Redeem Input (Collapsible) */}
                {isRedeemOpen && (
                    <div className="mb-4 animate-in slide-in-from-top-2">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-gray-100 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Enter secret code..."
                                value={collectDetails.secretCode}
                                onChange={(e) => setCollectDetails({ secretCode: e.target.value })}
                            />
                            <button
                                onClick={handleRedeemCode}
                                disabled={!collectDetails.secretCode || collecting}
                                className="bg-indigo-600 text-white px-4 rounded-xl font-bold shadow-md hover:bg-indigo-700"
                            >
                                {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('my_coupons')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'my_coupons' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        My Coupons
                    </button>
                    <button
                        onClick={() => setActiveTab('market')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'market' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Coupon Center
                    </button>
                </div>
            </div>

            <div className="px-5 space-y-6">
                {/* Invite Friend CTA */}
                {userId && (
                    <div
                        onClick={() => { window.location.hash = `#/affiliate-dashboard?userId=${userId}`; }}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-bold text-sm">🎓 แนะนำเพื่อน รับ ฿100</div>
                                <div className="text-xs opacity-80 mt-0.5">เพื่อนได้ลด 50% คุณได้คูปอง!</div>
                            </div>
                            <div className="bg-white/20 rounded-full p-2">
                                <Share2 className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                )}
                {/* 1. My Coupons Tab */}
                {activeTab === 'my_coupons' && (
                    <>
                        {/* Toggle History */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    if (!showHistory && historyCoupons.length === 0) fetchHistory();
                                    setShowHistory(!showHistory);
                                }}
                                className="flex items-center gap-1 text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors"
                            >
                                <History className="w-3 h-3" />
                                {showHistory ? 'Hide History' : 'View History'}
                            </button>
                        </div>

                        {loading && wallet.main.length === 0 ? (
                            <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300 mx-auto" /></div>
                        ) : (
                            <div className="space-y-4">
                                {showHistory && (
                                    <div className="space-y-4 mb-6">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">History</h3>
                                        {historyCoupons.length === 0 && !loading ? (
                                            <p className="text-center text-xs text-gray-400 italic">No history found</p>
                                        ) : (
                                            historyCoupons.map(c => <CouponCard key={c.coupon_id} coupon={c} type="Main" isHistory={true} />)
                                        )}
                                        <div className="border-b border-dashed border-gray-200 my-4"></div>
                                    </div>
                                )}

                                {!showHistory && (
                                    <>
                                        {(() => {
                                            // Group main coupons by campaign_id
                                            const mainGroups = new Map<string, { coupon: Coupon; count: number }>();
                                            wallet.main.forEach(c => {
                                                const key = c.campaign_id;
                                                if (mainGroups.has(key)) {
                                                    mainGroups.get(key)!.count++;
                                                } else {
                                                    mainGroups.set(key, { coupon: c, count: 1 });
                                                }
                                            });
                                            // Group on_top coupons by campaign_id
                                            const ontopGroups = new Map<string, { coupon: Coupon; count: number }>();
                                            wallet.on_top.forEach(c => {
                                                const key = c.campaign_id;
                                                if (ontopGroups.has(key)) {
                                                    ontopGroups.get(key)!.count++;
                                                } else {
                                                    ontopGroups.set(key, { coupon: c, count: 1 });
                                                }
                                            });
                                            return (
                                                <>
                                                    {Array.from(mainGroups.values()).map(({ coupon, count }) => (
                                                        <div key={coupon.coupon_id} className="relative">
                                                            {count > 1 && (
                                                                <div className="absolute -top-2 -right-2 z-20 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                                                                    x{count}
                                                                </div>
                                                            )}
                                                            <CouponCard coupon={coupon} type="Main" />
                                                        </div>
                                                    ))}
                                                    {Array.from(ontopGroups.values()).map(({ coupon, count }) => (
                                                        <div key={coupon.coupon_id} className="relative">
                                                            {count > 1 && (
                                                                <div className="absolute -top-2 -right-2 z-20 bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                                                                    x{count}
                                                                </div>
                                                            )}
                                                            <CouponCard coupon={coupon} type="On-top" />
                                                        </div>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                        {wallet.main.length === 0 && wallet.on_top.length === 0 && (
                                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Ticket className="w-8 h-8 text-gray-300" />
                                                </div>
                                                <h3 className="text-gray-900 font-medium">No Active Coupons</h3>
                                                <p className="text-gray-400 text-sm mt-1">Check "Coupon Center" to get more.</p>
                                                <button
                                                    onClick={() => setActiveTab('market')}
                                                    className="mt-4 text-indigo-600 text-sm font-bold hover:underline"
                                                >
                                                    Go to Coupon Center
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* 2. Market Tab */}
                {activeTab === 'market' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h2 className="font-bold text-gray-900">Available for you</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {availableCampaigns.length > 0 ? availableCampaigns.map(camp => (
                                <div
                                    key={camp.id}
                                    onClick={() => openDetail({ campaign: camp })} // Open detail for campaigns too
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer active:scale-[0.99] transition-transform"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${camp.is_stackable ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                                                {camp.is_stackable ? 'On-Top' : 'Main'}
                                            </span>
                                            {camp.remaining_quantity !== null && camp.remaining_quantity < 50 && (
                                                <span className="text-[10px] text-orange-500 font-bold flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Only {camp.remaining_quantity} left
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-900">{camp.name}</h3>
                                        <p className="text-sm text-gray-500 line-clamp-1">{camp.description}</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            doAutoCollect(userId, camp.id, '');
                                        }}
                                        disabled={collecting}
                                        className="ml-3 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200 whitespace-nowrap"
                                    >
                                        Get
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-12">
                                    <p className="text-gray-400 text-sm">No new coupons available at the moment.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <CouponDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                coupon={selectedCoupon}
            />
        </div>
    );
}
