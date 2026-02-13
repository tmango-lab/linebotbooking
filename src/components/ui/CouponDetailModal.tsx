import { X, Calendar, DollarSign, Clock, Info } from 'lucide-react';

interface CouponDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    coupon: any; // Can be a user coupon or a campaign object
}

export default function CouponDetailModal({ isOpen, onClose, coupon }: CouponDetailModalProps) {
    if (!isOpen || !coupon) return null;

    // Normalize data structure (handle both user_coupons and campaigns)
    // const isUserCoupon = !!coupon.coupon_id; // Unused

    const name = coupon.name || coupon.campaign?.name;
    const description = coupon.description || coupon.campaign?.description;
    const expiry = coupon.expiry || coupon.expires_at || coupon.end_date;
    const image = coupon.image || coupon.image_url || coupon.campaign?.image_url;
    const conditions = coupon.conditions || coupon.campaign?.conditions;
    const status = coupon.status; // ACTIVE, USED, EXPIRED

    // Format benefit
    const benefit = coupon.benefit || (coupon.campaign ? {
        type: coupon.campaign.benefit_type,
        value: coupon.campaign.benefit_value
    } : null);

    const getBenefitText = () => {
        if (!benefit) return '';
        if (benefit.type === 'DISCOUNT') {
            if (benefit.value?.amount) return `ส่วนลด ฿${benefit.value.amount}`;
            if (benefit.value?.percent) return `ส่วนลด ${benefit.value.percent}%`;
        }
        return `รับฟรี ${benefit.value?.item || 'ของรางวัล'}`;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header Image */}
                <div className="h-40 bg-gray-100 relative">
                    {image ? (
                        <img src={image} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                            <span className="text-white text-4xl font-black opacity-20">COUPON</span>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors backdrop-blur-md"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {status && (
                        <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg
                            ${status === 'ACTIVE' ? 'bg-green-500 text-white' :
                                status === 'USED' ? 'bg-gray-500 text-white' :
                                    'bg-red-500 text-white'}`
                        }>
                            {status === 'ACTIVE' ? 'พร้อมใช้งาน' : status === 'USED' ? 'ใช้แล้ว' : 'หมดอายุ'}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-xl font-bold text-gray-900 leading-tight">{name}</h2>
                        </div>
                        <p className="text-indigo-600 font-bold text-lg mb-1">{getBenefitText()}</p>
                        <p className="text-gray-500 text-sm">{description}</p>
                    </div>

                    <div className="space-y-4">
                        {/* Validity */}
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">ระยะเวลาใช้งาน</h4>
                                <p className="text-gray-500 text-xs mt-0.5">
                                    {expiry ? `หมดอายุ: ${new Date(expiry).toLocaleDateString('th-TH', {
                                        year: 'numeric', month: 'long', day: 'numeric'
                                    })}` : 'ไม่มีวันหมดอายุ'}
                                </p>
                            </div>
                        </div>

                        {/* Conditions */}
                        {conditions && (
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                    <Info className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-900 text-sm">เงื่อนไขเพิ่มเติม</h4>
                                    <ul className="mt-1 space-y-1">
                                        {conditions.min_spend > 0 && (
                                            <li className="text-xs text-gray-600 flex items-center gap-1">
                                                <DollarSign className="w-3 h-3" />
                                                ยอดซื้อขั้นต่ำ {conditions.min_spend} บาท
                                            </li>
                                        )}
                                        {conditions.time && (conditions.time.start || conditions.time.end) && (
                                            <li className="text-xs text-gray-600 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                เวลาที่ใช้ได้: {conditions.time.start || '00:00'} - {conditions.time.end || '23:59'}
                                            </li>
                                        )}
                                        {/* Add more conditions as needed */}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action (if needed) */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <button onClick={onClose} className="text-gray-500 text-sm font-semibold hover:text-gray-800 transition-colors">
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
}
