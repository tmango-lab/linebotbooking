import { CheckCircle2, Clock, Tag, QrCode, Banknote, UserCheck, UserX } from 'lucide-react';

interface BookingCardProps {
    booking: {
        id: string | number;
        name?: string;
        tel?: string;
        time_start: string;
        time_end: string;
        price: number;
        paid_at?: string | null;
        source?: string;
        is_promo?: boolean;
        status?: string;
        payment_method?: string;
        payment_status?: string;
        attendance_status?: 'confirmed' | 'cancel_requested' | null;
    };
    top: number;
    height: number;
    isDragging?: boolean;
    onClick: (e: React.MouseEvent) => void;
    onMoveStart: (e: React.MouseEvent) => void;
    onResizeStart: (e: React.MouseEvent, direction: 'TOP' | 'BOTTOM') => void;
}

export default function BookingCard({
    booking,
    top,
    height,
    isDragging,
    onClick,
    onMoveStart,
    onResizeStart
}: BookingCardProps) {
    const formatTime = (dateTimeStr: string) => {
        if (!dateTimeStr) return '';
        const date = new Date(dateTimeStr.replace(' ', 'T'));
        const hours = date.getHours();
        let minutes = date.getMinutes();

        // Visual adjustment
        if (minutes === 1) minutes = 0;
        if (minutes === 31) minutes = 30;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Stop bubbling so we don't trigger grid creation
        e.stopPropagation();
        // If left click, trigger move
        if (e.button === 0) {
            onMoveStart(e);
        }
    };

    const handleResizeStart = (e: React.MouseEvent, direction: 'TOP' | 'BOTTOM') => {
        e.stopPropagation(); // Stop bubbling to card move or grid create
        if (e.button === 0) {
            onResizeStart(e, direction);
        }
    };

    const isPendingPayment = booking.status === 'pending_payment';
    const isQR = booking.payment_method === 'qr';
    const isPaid = !!booking.paid_at;

    // Determine Card Status for Coloring
    let cardStatus: 'pending' | 'deposit_paid' | 'pay_at_field' | 'fully_paid' = 'pay_at_field';

    if (isPaid) {
        cardStatus = 'fully_paid';
    } else if (isPendingPayment) {
        cardStatus = 'pending'; // Rose/Pink (Critical 10m)
    } else if (isQR && (booking.payment_status === 'paid' || booking.payment_status === 'deposit_paid') && !isPaid) {
        // [MODIFIED] Check for 'deposit_paid' as well as 'paid'
        cardStatus = 'deposit_paid'; // Amber (Balance remaining)
    } else {
        cardStatus = 'pay_at_field'; // Blue (Cash/Field)
    }

    // [New Color Scheme]
    // 1. Pink (Rose): Pending Payment (10 mins)
    // 2. Amber: Deposit Paid (Need to collect balance)
    // 3. Blue: Pay at Field (Need to collect full)
    // 4. Emerald: Fully Paid (Done)

    let theme = '';
    let nameColor = '';
    let textColor = '';
    let iconColor = '';
    let hoverColor = '';

    switch (cardStatus) {
        case 'pending': // Pink
            theme = 'bg-rose-50 border-rose-400 hover:bg-rose-100';
            nameColor = 'text-rose-900';
            textColor = 'text-rose-800';
            iconColor = 'text-rose-500';
            hoverColor = 'hover:bg-rose-300';
            break;
        case 'deposit_paid': // Amber
            theme = 'bg-amber-50 border-amber-500 hover:bg-amber-100';
            nameColor = 'text-amber-900';
            textColor = 'text-amber-800';
            iconColor = 'text-amber-600';
            hoverColor = 'hover:bg-amber-300';
            break;
        case 'fully_paid': // Green (Emerald)
            theme = 'bg-emerald-50 border-emerald-500 hover:bg-emerald-100';
            nameColor = 'text-emerald-900';
            textColor = 'text-emerald-800';
            iconColor = 'text-emerald-600';
            hoverColor = 'hover:bg-emerald-300';
            break;
        case 'pay_at_field': // Blue (Default)
        default:
            theme = 'bg-blue-50 border-blue-600 hover:bg-blue-100';
            nameColor = 'text-blue-900';
            textColor = 'text-blue-800';
            iconColor = 'text-blue-500';
            hoverColor = 'hover:bg-blue-300';
            break;
    }

    // Attendance Status Overlay or Icon
    // Confirmed -> Green Check User
    // Cancel Request -> Red User X
    const attendanceIcon = (() => {
        if (!booking.attendance_status) return null;
        if (booking.attendance_status === 'confirmed') {
            return (
                <div className="absolute top-0.5 right-0.5 bg-white/80 rounded-full p-0.5 shadow-sm" title="ยืนยันการมาแล้ว">
                    <UserCheck className="w-3.5 h-3.5 text-green-600 fill-green-100" />
                </div>
            );
        }
        if (booking.attendance_status === 'cancel_requested') {
            return (
                <div className="absolute top-0.5 right-0.5 bg-red-100/90 rounded-full p-0.5 shadow-sm animate-pulse border border-red-200" title="ลูกค้าขอยกเลิก">
                    <UserX className="w-3.5 h-3.5 text-red-600" />
                </div>
            );
        }
        return null;
    })();

    return (
        <div
            className={`absolute inset-x-1 rounded shadow-sm border-l-[3px] px-2 py-1 text-xs transition-all z-10 group overflow-hidden select-none ${theme} ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}`}
            style={{
                top: `${top}px`,
                height: `${height}px`,
            }}
            title={`${formatTime(booking.time_start)} - ${formatTime(booking.time_end)} • ${booking.name || 'User'}`}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) onClick(e);
            }}
        >
            {/* Attendance Status Indicator */}
            {attendanceIcon}

            {/* Top Resize Handle */}
            <div
                className={`absolute top-0 left-0 right-0 h-2 cursor-n-resize z-20 hover:bg-opacity-50 transition-colors ${hoverColor}`}
                onMouseDown={(e) => handleResizeStart(e, 'TOP')}
            />

            <div className="flex flex-col h-full justify-start items-start text-left pl-2 pt-1 pb-1 pr-1 pointer-events-none">
                {/* Name */}
                <p className={`font-semibold text-xs leading-tight mb-0.5 truncate w-full ${nameColor}`}>
                    {booking.name || 'ไม่ระบุชื่อ'}
                </p>

                {/* Time range */}
                <div className={`text-[10px] font-medium opacity-90 flex items-center gap-1 ${textColor}`}>
                    {formatTime(booking.time_start)} - {formatTime(booking.time_end)}
                    {isPendingPayment && <Clock className="w-2.5 h-2.5 animate-pulse text-rose-600" />}
                </div>

                {/* Phone */}
                {booking.tel && height > 50 && (
                    <p className="text-[10px] opacity-75 mt-0.5 truncate w-full">
                        {booking.tel}
                    </p>
                )}

                {/* Status Icons - Bottom aligned */}
                {(booking.price !== undefined && booking.price !== null) && height > 40 && (
                    <div className="mt-auto pt-1 w-full flex justify-end items-center gap-1">
                        {/* Status Icons */}
                        <div className="flex items-center gap-0.5 mr-auto">
                            {booking.paid_at ? (
                                <CheckCircle2 className={`w-3 h-3 ${iconColor}`} />
                            ) : (
                                <Clock className={`w-3 h-3 ${isPendingPayment ? 'text-rose-500 animate-pulse' : 'text-gray-400'}`} />
                            )}

                            {isQR ? (
                                <QrCode className={`w-3 h-3 ${iconColor}`} />
                            ) : (
                                <Banknote className="w-3 h-3 text-gray-400" />
                            )}

                            {booking.is_promo && (
                                <Tag className="w-3 h-3 text-pink-500" />
                            )}

                            {(booking.source === 'line' || booking.source === 'line_bot_regular') && (
                                <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 ${isPaid ? 'text-green-600' : 'text-green-500'}`}>
                                    <path d="M22 10.4c0-5.7-5-10.4-10.6-10.4C5.4.1.8 4.7.8 10.4c0 4.7 3.5 8.7 8 9.9-.4 1.6-1.3 3.3-1.4 3.5-.1.3 0 .7.3.9.1.1.3.1.4.1.2 0 .5-.1.7-.3 2.9-2.5 4.6-4.9 4.7-5.1.3 0 .5.1.8.1 5.8 0 10.7-4.1 10.7-9.1zm-13.6 2.5c-.4 0-.7-.3-.7-.7V10c0-.4.3-.7.7-.7s.7.3.7.7v2.2c0 .4-.3.7-.7.7zm3.1 0c-.4 0-.7-.3-.7-.7V10c0-.4.3-.7.7-.7s.7.3.7.7v2.2c0 .4-.3.7-.7.7zm3.1 0c-.4 0-.7-.3-.7-.7V10c0-.4.3-.7.7-.7s.7.3.7.7v2.2c0 .4-.3.7-.7.7zm3.1 0c-.4 0-.7-.3-.7-.7V10c0-.4.3-.7.7-.7s.7.3.7.7v2.2c0 .4-.3.7-.7.7z" />
                                </svg>
                            )}
                        </div>

                        <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold border ${booking.paid_at
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : (cardStatus === 'pending'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : (cardStatus === 'deposit_paid'
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-blue-100 text-blue-700 border-blue-200'))
                            }`}>
                            ฿{booking.price.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Bottom Resize Handle */}
            <div
                className={`absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20 hover:bg-opacity-50 transition-colors ${hoverColor}`}
                onMouseDown={(e) => handleResizeStart(e, 'BOTTOM')}
            />
        </div>
    );
}
