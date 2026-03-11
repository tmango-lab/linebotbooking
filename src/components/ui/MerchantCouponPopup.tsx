import { useState, useEffect, useRef } from 'react';
import { X, QrCode, Clock, AlertCircle, Loader2, Copy, CheckCircle2, ShieldCheck, TicketCheck } from 'lucide-react';
import QRCode from 'qrcode';

interface MerchantCouponPopupProps {
    isOpen: boolean;
    onClose: () => void;
    couponId: string;
    couponName: string;
    rewardItem: string;
    merchantName: string;
    userId: string;
}

export default function MerchantCouponPopup({
    isOpen, onClose, couponId, couponName, rewardItem, merchantName, userId
}: MerchantCouponPopupProps) {
    const [token, setToken] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsSuccess(false);
            generateToken();
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isOpen]);

    // Polling logic to check if merchant has scanned the coupon
    useEffect(() => {
        if (!isOpen || isSuccess || timeLeft <= 0 || loading || !token) {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        const checkStatus = async () => {
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                
                // Direct fetch to bypass standard client auth issues for this specific check
                const response = await fetch(`${supabaseUrl}/rest/v1/user_coupons?id=eq.${couponId}&select=status`, {
                    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
                });
                const data = await response.json();
                
                if (data && data[0] && data[0].status === 'USED') {
                    setIsSuccess(true);
                    if (timerRef.current) clearInterval(timerRef.current);
                    if (pollRef.current) clearInterval(pollRef.current);
                    // Inform parent to refresh wallet after a delay
                    setTimeout(onClose, 4000); 
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        };

        pollRef.current = setInterval(checkStatus, 3000); // Poll every 3 seconds

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isOpen, isSuccess, timeLeft, loading, token, couponId]);

    const generateToken = async () => {
        setLoading(true);
        setError('');
        try {
            // Call Edge Function to generate and save token (bypasses RLS)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/generate-redemption-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ couponId, userId }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'ไม่สามารถสร้าง Token ได้');
            }

            const newToken = data.token;
            setToken(newToken);

            // Generate QR code
            const qrData = JSON.stringify({ couponId, token: newToken });
            const dataUrl = await QRCode.toDataURL(qrData, {
                width: 280,
                margin: 2,
                color: { dark: '#1e1b4b', light: '#ffffff' }
            });
            setQrDataUrl(dataUrl);

            // Start countdown (15 minutes)
            setTimeLeft(15 * 60);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'ไม่สามารถสร้างโค้ดได้');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToken = () => {
        if (token) {
            navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    const isExpired = timeLeft <= 0 && !loading && token;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <QrCode className="w-6 h-6" />
                        <h2 className="font-bold text-lg">ใช้สิทธิ์ที่หน้าร้าน</h2>
                    </div>
                    <p className="text-sm text-white/80">{merchantName} — {rewardItem || couponName}</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-10">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">กำลังสร้าง QR Code...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10">
                            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                            <p className="text-red-600 font-bold mb-4">{error}</p>
                            <button onClick={generateToken} className="text-indigo-600 font-bold text-sm hover:underline">ลองอีกครั้ง</button>
                        </div>
                    ) : isExpired ? (
                        <div className="text-center py-10">
                            <Clock className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                            <p className="text-orange-700 font-bold mb-2">QR Code หมดอายุแล้ว</p>
                            <p className="text-sm text-gray-500 mb-4">กรุณากดสร้างใหม่เพื่อใช้สิทธิ์ที่ร้าน</p>
                            <button onClick={generateToken}
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700">
                                สร้าง QR ใหม่
                            </button>
                        </div>
                    ) : isSuccess ? (
                        <div className="text-center py-8 animate-in zoom-in duration-300">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                                <div className="relative bg-gradient-to-tr from-green-500 to-emerald-400 w-full h-full rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                                    <TicketCheck className="w-10 h-10 text-white" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">ใช้งานสำเร็จ!</h3>
                            <p className="text-gray-500 text-sm mb-6 pb-2">ร้านค้าได้สแกนคูปองของคุณเรียบร้อยแล้ว<br/>ขอให้มีความสุขกับบริการครับ 😊</p>
                            
                            <div className="bg-emerald-50 rounded-2xl p-3 flex justify-center items-center gap-2 mb-2 border border-emerald-100">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                <span className="font-bold text-emerald-700 text-sm">คูปองถูกตัดออกจากระบบแล้ว</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* QR Code */}
                            <div className="text-center mb-4">
                                {qrDataUrl && (
                                    <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 mx-auto rounded-xl border-4 border-gray-100" />
                                )}
                            </div>

                            {/* Countdown */}
                            <div className={`text-center mb-4 ${timeLeft <= 60 ? 'text-red-600' : 'text-gray-700'}`}>
                                <div className="flex items-center justify-center gap-2">
                                    <Clock className="w-5 h-5" />
                                    <span className="text-3xl font-mono font-black tracking-wider">{formatTime(timeLeft)}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">หมดอายุใน {Math.ceil(timeLeft / 60)} นาที</p>
                            </div>

                            {/* Token Display */}
                            {token && (
                                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                                    <p className="text-center text-[10px] text-gray-400 mb-1">Redemption Token (บอกร้านค้าแทน QR ได้)</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-center text-xs font-mono text-gray-600 break-all">{token.slice(0, 8)}...{token.slice(-4)}</code>
                                        <button onClick={handleCopyToken} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                            {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <p className="text-center text-xs text-gray-400">แสดง QR Code นี้ให้พนักงานร้านค้าสแกน</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
