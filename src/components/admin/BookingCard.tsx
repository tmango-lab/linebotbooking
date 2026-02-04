import React from 'react';
import { CheckCircle2, Clock, Tag, QrCode, Banknote } from 'lucide-react';

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

    // Theme logic
    const theme = isPendingPayment
        ? 'bg-amber-50 text-amber-700 border-amber-500 hover:bg-amber-100'
        : 'bg-blue-50 text-blue-700 border-blue-600 hover:bg-blue-100';

    const nameColor = isPendingPayment ? 'text-amber-900' : 'text-blue-900';
    const textColor = isPendingPayment ? 'text-amber-800' : 'text-blue-800';

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
            {/* Top Resize Handle */}
            <div
                className={`absolute top-0 left-0 right-0 h-2 cursor-n-resize z-20 hover:bg-opacity-50 transition-colors ${isPendingPayment ? 'hover:bg-amber-300' : 'hover:bg-blue-300'}`}
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
                    {isPendingPayment && <Clock className="w-2.5 h-2.5 animate-pulse" />}
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
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                            ) : (
                                <Clock className={`w-3 h-3 ${isPendingPayment ? 'text-amber-500' : 'text-gray-400'}`} />
                            )}

                            {isQR ? (
                                <QrCode className={`w-3 h-3 ${isPendingPayment ? 'text-amber-600' : 'text-blue-500'}`} />
                            ) : (
                                <Banknote className="w-3 h-3 text-gray-400" />
                            )}

                            {booking.is_promo && (
                                <Tag className="w-3 h-3 text-pink-500" />
                            )}
                        </div>

                        <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold border ${booking.paid_at ? 'bg-green-100 text-green-700 border-green-200' : (isPendingPayment ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200')}`}>
                            ฿{booking.price.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Bottom Resize Handle */}
            <div
                className={`absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20 hover:bg-opacity-50 transition-colors ${isPendingPayment ? 'hover:bg-amber-300' : 'hover:bg-blue-300'}`}
                onMouseDown={(e) => handleResizeStart(e, 'BOTTOM')}
            />
        </div>
    );
}
