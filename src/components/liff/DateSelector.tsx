import React, { useRef, useEffect } from 'react';

interface DateSelectorProps {
    selectedDate: string; // YYYY-MM-DD
    onSelect: (date: string) => void;
}

const DateSelector: React.FC<DateSelectorProps> = ({ selectedDate, onSelect }) => {
    const dates: { date: string; day: string; dayName: string }[] = [];
    const today = new Date();
    const daysTh = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    // Generate next 14 days
    for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        // Adjust for timezone if needed, but simple local date is usually fine for UI
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        dates.push({
            date: dateStr,
            day: String(d.getDate()),
            dayName: daysTh[d.getDay()]
        });
    }

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected date on mount/change can be nice
    useEffect(() => {
        // Implementation for auto-scroll if needed
    }, [selectedDate]);

    return (
        <div
            ref={scrollRef}
            className="flex overflow-x-auto space-x-3 p-4 bg-white border-b border-gray-200 no-scrollbar select-none"
        >
            {dates.map((item) => {
                const isSelected = item.date === selectedDate;
                return (
                    <div
                        key={item.date}
                        onClick={() => onSelect(item.date)}
                        className={`
                            flex flex-col items-center justify-center min-w-[50px] h-[70px] rounded-xl cursor-pointer transition-all duration-200
                            ${isSelected
                                ? 'bg-green-600 text-white shadow-md transform scale-105'
                                : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                            }
                        `}
                    >
                        <span className={`text-xs ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                            {item.dayName}
                        </span>
                        <span className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            {item.day}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default DateSelector;
