import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
    selectedDate: string; // YYYY-MM-DD
    onSelect: (date: string) => void;
    onClose: () => void;
}

export default function CalendarDropdown({ selectedDate, onSelect, onClose }: CalendarProps) {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    // Day names
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

    const handleDateClick = (day: number) => {
        // Adjust for timezone offset issues by constructing string directly
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        onSelect(`${currentYear}-${monthStr}-${dayStr}`);
    };

    const isSelected = (day: number) => {
        const checkDate = new Date(selectedDate);
        return checkDate.getDate() === day &&
            checkDate.getMonth() === currentMonth &&
            checkDate.getFullYear() === currentYear;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === currentMonth &&
            today.getFullYear() === currentYear;
    };

    // Calculate grid
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const dateArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div ref={containerRef} className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-[320px] select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-50 rounded-full text-gray-400">
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-gray-900 font-bold text-base">
                    {months[currentMonth]} {currentYear}
                </h2>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-50 rounded-full text-gray-400">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {days.map(d => (
                    <div key={d} className="text-xs font-medium text-gray-400 py-1">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
                {blanks.map(b => (
                    <div key={`blank-${b}`} />
                ))}
                {dateArray.map(day => {
                    const selected = isSelected(day);
                    const today = isToday(day);
                    return (
                        <div key={day} className="aspect-square flex items-center justify-center">
                            <button
                                onClick={() => handleDateClick(day)}
                                className={`
                                    w-8 h-8 rounded-full text-sm font-medium transition-colors
                                    ${selected
                                        ? 'bg-gray-900 text-white shadow-md'
                                        : today
                                            ? 'text-blue-600 font-bold hover:bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }
                                `}
                            >
                                {day}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
