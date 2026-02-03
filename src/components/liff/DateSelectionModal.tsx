
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

    const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Bottom Sheet Content */}
            <div className="relative bg-white w-full max-w-lg rounded-t-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out">
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* Header with Month Navigation */}
                <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-gray-50">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all active:scale-90"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div className="text-center">
                        <h3 className="text-lg font-extrabold text-gray-800">
                            {monthsTh[currentMonth]} {currentYear + 543}
                        </h3>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all active:scale-90"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="px-5 py-6">
                    <div className="grid grid-cols-7 mb-4">
                        {daysTh.map(day => (
                            <div key={day} className="text-center text-[11px] font-bold text-gray-300 uppercase tracking-tighter">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="p-2" />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = formatDate(currentYear, currentMonth, day);
                            const isSelected = dateStr === selectedDate;
                            const isToday = dateStr === todayStr;
                            const isPast = new Date(dateStr) < new Date(todayStr);

                            return (
                                <button
                                    key={dateStr}
                                    disabled={isPast}
                                    onClick={() => {
                                        onSelect(dateStr);
                                        onClose();
                                    }}
                                    className={`
                                        relative group flex flex-col items-center justify-center aspect-square rounded-2xl text-sm font-bold transition-all
                                        ${isSelected
                                            ? 'bg-green-600 text-white shadow-xl shadow-green-100 scale-105 z-10'
                                            : isPast
                                                ? 'text-gray-200 cursor-not-allowed'
                                                : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                                        }
                                    `}
                                >
                                    {day}
                                    {isToday && !isSelected && (
                                        <div className="absolute bottom-2 w-1 h-1 bg-green-500 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action Row */}
                <div className="px-6 py-6 pb-10 bg-gray-50/50 flex gap-3">
                    <button
                        onClick={() => {
                            onSelect(todayStr);
                            onClose();
                        }}
                        className="flex-1 py-4 text-sm font-bold text-green-700 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors"
                    >
                        กลับไปวันนี้
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-sm font-bold text-gray-500 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DateSelectionModal;
