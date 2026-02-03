
import React, { useState } from 'react';

interface DateSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    onSelect: (date: string) => void;
}

const DateSelectionModal: React.FC<DateSelectionModalProps> = ({ isOpen, onClose, selectedDate, onSelect }) => {
    // Start with the month of the currently selected date
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    if (!isOpen) return null;

    const daysTh = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const monthsTh = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    // Get first day of the month and total days
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Helper to format date string yyyy-mm-dd
    const formatDate = (year: number, month: number, day: number) => {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    };

    const handlePrevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-[340px] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Header with Month Navigation */}
                <div className="p-4 flex justify-between items-center bg-green-600 text-white">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div className="text-center">
                        <div className="text-xs uppercase font-bold tracking-widest opacity-80 mb-0.5">เลือกวันที่</div>
                        <div className="text-lg font-bold">
                            {monthsTh[currentMonth]} {currentYear + 543}
                        </div>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Calendar Body */}
                <div className="p-4 bg-white">
                    {/* Day Names Row */}
                    <div className="grid grid-cols-7 mb-2">
                        {daysTh.map(day => (
                            <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Fill empty slots before the first day */}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="p-2" />
                        ))}

                        {/* Actual Days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = formatDate(currentYear, currentMonth, day);
                            const isSelected = dateStr === selectedDate;
                            const isToday = dateStr === todayStr;
                            const dObj = new Date(dateStr);
                            const isPast = dObj < new Date(todayStr);

                            return (
                                <button
                                    key={dateStr}
                                    disabled={isPast}
                                    onClick={() => {
                                        onSelect(dateStr);
                                        onClose();
                                    }}
                                    className={`
                                        relative group flex flex-col items-center justify-center aspect-square rounded-full text-sm font-medium transition-all
                                        ${isSelected
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-200 scale-110 z-10'
                                            : isPast
                                                ? 'text-gray-200 cursor-not-allowed'
                                                : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
                                        }
                                    `}
                                >
                                    {day}
                                    {isToday && !isSelected && (
                                        <div className="absolute bottom-1 w-1 h-1 bg-green-500 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Tips */}
                <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
                    <button
                        onClick={() => {
                            onSelect(todayStr);
                            onClose();
                        }}
                        className="text-xs font-bold text-green-600 hover:text-green-700 underline underline-offset-4"
                    >
                        กลับไปวันนี้
                    </button>
                    <button
                        onClick={onClose}
                        className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DateSelectionModal;
