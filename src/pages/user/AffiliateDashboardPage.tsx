import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { useLiff } from '../../providers/LiffProvider';
import { getLiffUser } from '../../lib/liff';
import liff from '@line/liff';
import { Loader2, CheckCircle2, Share2, Users, Banknote, ArrowLeft, Gift } from 'lucide-react';
import { formatDate } from '../../utils/date';

interface AffiliateInfo {
    user_id: string;
    referral_code: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    total_referrals: number;
    total_earnings: number;
    created_at: string;
    profiles?: { team_name: string } | null;
}

interface ReferralItem {
    id: string;
    referee_id: string;
    status: string;
    reward_amount: number;
    created_at: string;
    profiles?: { team_name: string } | null;
}

interface ReferralProgram {
    id: string;
    end_date: string;
    is_active: boolean;
}

export default function AffiliateDashboardPage() {
    const { isReady, liffUser } = useLiff();
    const [userId, setUserId] = useState('');
    const [affiliate, setAffiliate] = useState<AffiliateInfo | null>(null);
    const [referrals, setReferrals] = useState<ReferralItem[]>([]);
    const [program, setProgram] = useState<ReferralProgram | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isReady) return;
        const init = async () => {
            let uid = '';

            if (liffUser?.userId) {
                uid = liffUser.userId;
            } else {
                try {
                    // Force a strict check against the LIFF API
                    if (liff.isLoggedIn()) {
                        const profile = await liff.getProfile();
                        if (profile?.userId) {
                            uid = profile.userId;
                        }
                    } else {
                        const user = await getLiffUser({ requireLogin: true });
                        if (user?.userId) uid = user.userId;
                    }
                } catch (e) {
                    console.error('Failed to get LIFF User strictly:', e);
                }
            }

            if (uid) {
                setUserId(uid);
                fetchData(uid);
            } else {
                setLoading(false);
                setError('กรุณาล็อกอินผ่าน LINE เพื่อดูข้อมูลของท่าน');
            }
        };
        init();
    }, [isReady, liffUser]);

    const [error, setError] = useState<string | null>(null);

    const fetchData = async (uid: string) => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch affiliate info
            const { data: affData, error: affError } = await supabase
                .from('affiliates')
                .select('*, profiles(team_name)')
                .eq('user_id', uid)
                .maybeSingle();

            if (affError) throw affError;

            // 2. Fetch active referral program
            const { data: progData } = await supabase
                .from('referral_programs')
                .select('id, end_date, is_active')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (progData) {
                setProgram(progData);
            }

            if (affData) {
                setAffiliate(affData);

                // 3. Fetch referrals
                const { data: refData } = await supabase
                    .from('referrals')
                    .select('*, profiles:referee_id(team_name)')
                    .eq('referrer_id', uid)
                    .order('created_at', { ascending: false });

                setReferrals((refData || []) as unknown as ReferralItem[]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้');
        } finally {
            setLoading(false);
        }
    };

    const getReferralLink = () => {
        if (!affiliate) return '';
        const liffId = import.meta.env.VITE_LIFF_ID || '';
        return `https://liff.line.me/${liffId}?redirect=booking-v3&ref=${affiliate.referral_code}`;
    };

    const handleShare = async () => {
        const link = getReferralLink();
        const text = `⚽ มาจองสนามฟุตบอลกัน!\nจองผ่านลิงก์นี้ ลด 50% เลย 🎉\n${link}`;

        // Try Web Share API first (works in LINE browser)
        if (navigator.share) {
            try {
                await navigator.share({ title: 'จองสนามฟุตบอล', text });
                return;
            } catch { /* fallback */ }
        }

        // Fallback: LINE share
        const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
        window.open(lineShareUrl, '_blank');
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <div className="bg-yellow-50 p-4 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">เข้าถึงข้อมูลไม่ได้</h2>
                <p className="text-gray-500 text-sm mb-6">{error}</p>

                {error.includes('ล็อกอิน') ? (
                    <button
                        onClick={() => {
                            if (liff.isInClient() && !liff.isLoggedIn()) {
                                const liffId = import.meta.env.VITE_LIFF_ID || '';
                                const currentSearch = window.location.search;
                                const extraParams = currentSearch ? '&' + currentSearch.substring(1) : '';
                                window.location.href = `https://liff.line.me/${liffId}?redirect=affiliate-dashboard${extraParams}`;
                            } else {
                                liff.login({ redirectUri: window.location.href });
                            }
                        }}
                        className="bg-[#06C755] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#05b34c] shadow-md flex items-center gap-2 mx-auto"
                    >
                        เข้าสู่ระบบด้วย LINE
                    </button>
                ) : (
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-800 mx-auto"
                    >
                        ลองใหม่อีกครั้ง
                    </button>
                )}
            </div>
        );
    }

    if (!affiliate) {

        return (
            <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
                    <div className="text-5xl mb-4">🎓</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">ยังไม่ได้สมัคร</h2>
                    <p className="text-gray-500 text-sm mb-6">สมัครเป็นผู้แนะนำเพื่อรับคูปอง ฿100 ทุกครั้งที่เพื่อนจองสนาม!</p>
                    <a
                        href={`#/affiliate-register?userId=${userId}`}
                        className="inline-block bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors"
                    >
                        สมัครเลย →
                    </a>
                </div>
            </div>
        );
    }

    if (affiliate.status === 'PENDING') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
                    <div className="text-5xl mb-4">⏳</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">รอการอนุมัติ</h2>
                    <p className="text-gray-500 text-sm">แอดมินกำลังตรวจสอบข้อมูลของคุณ<br />จะแจ้งผลผ่าน LINE ภายใน 1-2 วันทำการ</p>
                </div>
            </div>
        );
    }

    if (affiliate.status === 'REJECTED') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
                    <div className="text-5xl mb-4">❌</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">ถูกปฏิเสธ</h2>
                    <p className="text-gray-500 text-sm">กรุณาติดต่อแอดมินหากมีข้อสงสัย</p>
                </div>
            </div>
        );
    }

    // APPROVED Dashboard
    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-16">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md shadow-sm px-5 py-4 sticky top-0 z-30 border-b border-purple-50">
                <div className="flex items-center gap-4 mb-3">
                    <button onClick={() => window.history.back()} className="p-2 hover:bg-purple-50 rounded-xl transition-colors">
                        <ArrowLeft className="w-5 h-5 text-purple-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-extrabold text-xl text-gray-900 tracking-tight">แนะนำเพื่อน & รับรางวัล</h1>
                            <div className="bg-purple-100 p-1 rounded-lg">
                                <Gift className="w-4 h-4 text-purple-600" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Refer & Earn</p>
                    </div>
                </div>

                {/* Greeting */}
                <div className="flex items-center gap-2 pt-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {affiliate.profiles?.team_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">ยินดีต้อนรับกลับมา,</p>
                        <p className="text-sm font-bold text-gray-900">{affiliate.profiles?.team_name || 'คุณผู้แนะนำ'}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 pt-6 space-y-5">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{affiliate.total_referrals}</div>
                        <div className="text-xs text-gray-500 mt-1">แนะนำสำเร็จ</div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Banknote className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="text-2xl font-bold text-green-600">฿{affiliate.total_earnings.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 mt-1">รายได้รวม</div>
                    </div>
                </div>

                {/* Referral Code */}
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-sm font-medium opacity-80">รหัสแนะนำของคุณ</div>
                        {program?.end_date && (
                            <div className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                หมดเขต {formatDate(program.end_date)}
                            </div>
                        )}
                    </div>
                    <div className="font-mono text-2xl font-bold tracking-wider mb-4">{affiliate.referral_code}</div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleShare}
                            className="w-full bg-[#06C755] hover:bg-[#05b34c] py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-md"
                        >
                            <Share2 className="w-5 h-5" /> แชร์เลย
                        </button>
                    </div>
                </div>

                {/* How it works */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Gift className="w-4 h-4 text-purple-500" /> วิธีรับรางวัล
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-100 text-purple-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                            <p className="text-sm text-gray-600">แชร์ลิงก์ให้เพื่อน</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-100 text-purple-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                            <p className="text-sm text-gray-600">เพื่อนจองสนามผ่านลิงก์ ได้<span className="font-bold text-green-600">ลด 50%</span></p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-100 text-purple-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                            <p className="text-sm text-gray-600">เพื่อนชำระเงิน → คุณได้<span className="font-bold text-purple-600">คูปอง ฿100</span> อัตโนมัติ!</p>
                        </div>
                    </div>
                </div>

                {/* Referral History */}
                {referrals.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3">📋 ประวัติการแนะนำ</h3>
                        <div className="space-y-3">
                            {referrals.map(ref => (
                                <div key={ref.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">
                                            {ref.profiles?.team_name || 'ผู้ใช้ใหม่'}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {formatDate(ref.created_at)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${ref.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            ref.status === 'PENDING_PAYMENT' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {ref.status === 'COMPLETED' ? '✅ สำเร็จ' :
                                                ref.status === 'PENDING_PAYMENT' ? '⏳ รอชำระ' : ref.status}
                                        </span>
                                        {ref.status === 'COMPLETED' && (
                                            <div className="text-xs text-green-600 font-bold mt-1">+฿{ref.reward_amount}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
