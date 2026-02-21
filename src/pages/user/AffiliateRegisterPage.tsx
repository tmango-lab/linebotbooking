import { useState, useEffect } from 'react';
import { useLiff } from '../../providers/LiffProvider';
import { getLiffUser } from '../../lib/liff';
import liff from '@line/liff';
import { Loader2, Camera, GraduationCap, Calendar, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function AffiliateRegisterPage() {
    const { isReady, liffUser } = useLiff();
    const [userId, setUserId] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [existingStatus, setExistingStatus] = useState<string | null>(null);

    // Form State
    const [schoolName, setSchoolName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [studentCardFile, setStudentCardFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isReady) return;
        const init = async () => {
            let uid = '';

            // ใช้ userId จากคนที่ล็อกอิน LIFF เท่านั้น เพื่อความปลอดภัย
            if (liffUser?.userId) {
                uid = liffUser.userId;
            } else {
                try {
                    const user = await getLiffUser({ requireLogin: true });
                    if (user?.userId) uid = user.userId;
                } catch (e) {
                    console.error('Failed to get LIFF User:', e);
                }
            }

            if (uid) {
                setUserId(uid);
                checkExisting(uid);
            } else {
                setError('กรุณาล็อกอินผ่าน LINE เพื่อทำรายการต่อ');
            }
        };
        init();
    }, [isReady, liffUser]);

    const checkExisting = async (uid: string) => {
        try {
            const token = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/affiliates?user_id=eq.${uid}&select=status`, {
                headers: { 'apikey': token, 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data?.[0]?.status) {
                setExistingStatus(data[0].status);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                setError('ไฟล์ใหญ่เกินไป (สูงสุด 10MB)');
                return;
            }
            setStudentCardFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError('');
        }
    };

    // Compress image using Canvas API — resize to max 800px, JPEG quality 0.6
    const compressImage = (file: File, maxDim = 800, quality = 0.6): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                // Scale down if larger than maxDim
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, width, height);
                // Convert to JPEG with quality
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const base64 = dataUrl.split(',')[1];
                const sizeKB = Math.round((base64.length * 3) / 4 / 1024);
                console.log(`[Image Compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${sizeKB}KB (${width}×${height}, q=${quality})`);
                resolve(base64);
            };
            img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
            img.src = URL.createObjectURL(file);
        });
    };

    const handleSubmit = async () => {
        if (!userId) return;
        if (!schoolName.trim()) { setError('กรุณากรอกชื่อโรงเรียน/มหาวิทยาลัย'); return; }
        if (!birthDate) { setError('กรุณาเลือกวันเกิด'); return; }
        if (!studentCardFile) { setError('กรุณาถ่ายรูปบัตรนักเรียน/นักศึกษา'); return; }

        setLoading(true);
        setError('');

        try {
            // Compress image before converting to base64
            const base64 = await compressImage(studentCardFile);

            const token = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-affiliate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId,
                    schoolName: schoolName.trim(),
                    birthDate,
                    studentCardBase64: base64,
                    studentCardMimeType: 'image/jpeg'
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');

            setStep('success');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (error && error.includes('ล็อกอิน')) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <div className="bg-yellow-50 p-4 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">เข้าถึงข้อมูลไม่ได้</h2>
                <p className="text-gray-500 text-sm mb-6">{error}</p>
                <button
                    onClick={() => liff.login()}
                    className="bg-[#06C755] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#05b34c] shadow-md flex items-center gap-2 mx-auto"
                >
                    เข้าสู่ระบบด้วย LINE
                </button>
            </div>
        );
    }

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    // Already registered
    if (existingStatus) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
                    {existingStatus === 'PENDING' && (
                        <>
                            <div className="text-5xl mb-4">⏳</div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">รอการอนุมัติ</h2>
                            <p className="text-gray-500 text-sm">ข้อมูลของคุณกำลังรอแอดมินตรวจสอบ<br />จะแจ้งผลผ่าน LINE ภายใน 1-2 วันทำการ</p>
                        </>
                    )}
                    {existingStatus === 'APPROVED' && (
                        <>
                            <div className="text-5xl mb-4">✅</div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">คุณเป็นผู้แนะนำแล้ว!</h2>
                            <p className="text-gray-500 text-sm mb-4">ไปดู Dashboard และแชร์ลิงก์ได้เลย</p>
                            <a
                                href={`#/affiliate-dashboard?userId=${userId}`}
                                className="inline-block bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors"
                            >
                                ไปหน้า Dashboard →
                            </a>
                        </>
                    )}
                    {existingStatus === 'REJECTED' && (
                        <>
                            <div className="text-5xl mb-4">❌</div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">ถูกปฏิเสธ</h2>
                            <p className="text-gray-500 text-sm">กรุณาติดต่อแอดมิน หากมีข้อสงสัย</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Success
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full animate-in zoom-in-95">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">สมัครสำเร็จ! 🎉</h2>
                    <p className="text-gray-500 text-sm mb-1">ข้อมูลของคุณถูกส่งไปยังแอดมินแล้ว</p>
                    <p className="text-gray-400 text-xs">จะแจ้งผลอนุมัติผ่าน LINE ภายใน 1-2 วันทำการ</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-16">
            {/* Header */}
            <div className="bg-white shadow-sm px-5 py-4 flex items-center gap-3 sticky top-0 z-30">
                <button onClick={() => window.history.back()} className="p-1 hover:bg-gray-100 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="font-bold text-gray-900">สมัครเป็นผู้แนะนำ</h1>
                    <p className="text-xs text-gray-400">Affiliate Registration</p>
                </div>
            </div>

            {/* Hero */}
            <div className="px-6 py-8 text-center">
                <div className="text-4xl mb-3">🎓</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">สิทธิ์พิเศษสำหรับนักเรียน/นักศึกษา</h2>
                <p className="text-gray-500 text-sm">แนะนำเพื่อนมาจองสนาม รับคูปอง ฿100 ทุกครั้ง!</p>
            </div>

            {/* Form */}
            <div className="px-5 space-y-5">
                {/* Student Card Upload */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                        <Camera className="w-4 h-4 text-purple-500" />
                        รูปบัตรนักเรียน/นักศึกษา *
                    </label>
                    {previewUrl ? (
                        <div className="relative">
                            <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-xl border" />
                            <button
                                onClick={() => { setStudentCardFile(null); setPreviewUrl(null); }}
                                className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold"
                            >
                                ลบ
                            </button>
                        </div>
                    ) : (
                        <label className="border-2 border-dashed border-purple-200 rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all">
                            <Camera className="w-8 h-8 text-purple-300 mb-2" />
                            <span className="text-sm text-purple-400 font-medium">แตะเพื่อถ่ายรูปหรือเลือกไฟล์</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                        </label>
                    )}
                </div>

                {/* School Name */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                        <GraduationCap className="w-4 h-4 text-purple-500" />
                        ชื่อโรงเรียน/มหาวิทยาลัย *
                    </label>
                    <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="เช่น มหาวิทยาลัยเกษตรศาสตร์"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                </div>

                {/* Birth Date */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        วันเกิด *
                    </label>
                    <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                        ⚠️ {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-purple-200 hover:bg-purple-700 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</>
                    ) : (
                        'สมัครเป็นผู้แนะนำ ✨'
                    )}
                </button>

                {/* Terms */}
                <p className="text-center text-xs text-gray-400 pb-4">
                    การสมัครถือว่ายอมรับ<a href="#" className="text-purple-500 underline">เงื่อนไขการใช้งาน</a>
                </p>
            </div>
        </div>
    );
}
