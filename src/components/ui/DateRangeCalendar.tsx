import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerButtonProps {
    label: string;
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
}

const MONTHS_TH = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function toDateStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatThaiShort(dateStr: string) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function DatePickerButton({ label, value, onChange }: DatePickerButtonProps) {
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date(value || new Date()));
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    // Sync viewDate when value changes externally
    useEffect(() => {
        if (value) setViewDate(new Date(value));
    }, [value]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const dateArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    function handleSelect(day: number) {
        onChange(toDateStr(year, month, day));
        setOpen(false);
    }

    function handleToday() {
        const now = new Date();
        onChange(toDateStr(now.getFullYear(), now.getMonth(), now.getDate()));
        setOpen(false);
    }

    function isSelected(day: number) {
        const d = new Date(value + 'T00:00:00');
        return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    }

    function isToday(day: number) {
        const now = new Date();
        return now.getDate() === day && now.getMonth() === month && now.getFullYear() === year;
    }

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-left"
            >
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">{formatThaiShort(value)}</span>
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-[290px] select-none animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Today Button */}
                    <button
                        onClick={handleToday}
                        className="w-full mb-3 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                        วันนี้
                    </button>

                    {/* Month Header */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => setViewDate(new Date(year, month - 1, 1))}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-gray-900 font-bold text-sm">
                            {MONTHS_TH[month]} {year + 543}
                        </h2>
                        <button
                            onClick={() => setViewDate(new Date(year, month + 1, 1))}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Day Names */}
                    <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                        {DAYS_TH.map(d => (
                            <div key={d} className="text-[11px] font-medium text-gray-400 py-1">{d}</div>
                        ))}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                        {blanks.map(b => <div key={`b-${b}`} className="aspect-square" />)}
                        {dateArray.map(day => {
                            const sel = isSelected(day);
                            const today = isToday(day);
                            return (
                                <div key={day} className="aspect-square flex items-center justify-center">
                                    <button
                                        onClick={() => handleSelect(day)}
                                        className={`
                                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                                            ${sel
                                                ? 'bg-indigo-600 text-white shadow-md'
                                                : today
                                                    ? 'text-indigo-600 font-bold ring-1 ring-indigo-300 hover:bg-indigo-50'
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
            )}
        </div>
    );
}
