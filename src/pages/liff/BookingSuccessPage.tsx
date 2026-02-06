
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Home, Copy } from 'lucide-react';

const BookingSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const bookingId = searchParams.get('bookingId');
    const price = searchParams.get('price');
    const paymentMethod = searchParams.get('paymentMethod');
    const fieldName = searchParams.get('fieldName');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const userId = searchParams.get('userId');

    // Default to deposit 200 if QR, else full price or logic
    // Backend seems to strictly ask for 200 deposit for QR.
    const isQR = paymentMethod === 'qr';
    const amountToPay = isQR ? 200 : price;
    const promptPayId = "0839144000"; // Fallback from backend

    useEffect(() => {
        // Optional: Liff initialize or window title
        document.title = "Booking Success";
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(promptPayId);
        alert('คัดลอกเบอร์พร้อมเพย์แล้ว');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 pb-24">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-sm p-8 text-center animate-scale-in">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-800 mb-2">จองสนามสำเร็จ!</h1>
                <p className="text-gray-500 text-sm mb-6">Booking ID: {bookingId}</p>

                <div className="space-y-3 bg-gray-50 rounded-2xl p-5 mb-6 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">สนาม</span>
                        <span className="font-bold text-gray-800">{fieldName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">วันที่</span>
                        <span className="font-bold text-gray-800">{date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">เวลา</span>
                        <span className="font-bold text-gray-800">{time}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between">
                        <span className="text-gray-500">ยอดชำระสุทธิ</span>
                        <span className="font-bold text-green-600 text-lg">฿{price}</span>
                    </div>
                </div>

                {isQR ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-6">
                        <h3 className="text-blue-800 font-bold mb-1">ชำระเงินมัดจำ</h3>
                        <p className="text-blue-600 text-xs mb-4">สแกน QR Code หรือโอนเงินภายใน 10 นาที</p>

                        <div className="bg-white p-3 rounded-xl shadow-sm inline-block mb-4">
                            <img
                                src={`https://promptpay.io/${promptPayId}/${amountToPay}.png`}
                                alt="QR Code"
                                className="w-48 h-48 object-contain"
                            />
                        </div>

                        <div className="flex items-center justify-center gap-2 text-blue-800 bg-white/50 py-2 rounded-lg cursor-pointer" onClick={handleCopy}>
                            <span className="font-mono font-bold text-lg">{promptPayId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</span>
                            <Copy className="w-4 h-4 opacity-50" />
                        </div>
                    </div>
                ) : (
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-6">
                        <p className="text-green-800 font-bold">ชำระเงินหน้าสนาม</p>
                        <p className="text-green-600 text-xs">กรุณาแสดงหน้าจอนี้กับเจ้าหน้าที่</p>
                    </div>
                )}

                <button
                    onClick={() => navigate(userId ? `/?userId=${userId}` : '/')}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all"
                >
                    <Home className="w-5 h-5" />
                    กลับหน้าหลัก
                </button>
            </div>
        </div>
    );
};

export default BookingSuccessPage;
