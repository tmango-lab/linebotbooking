
import React from 'react';

interface DateSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    onSelect: (date: string) => void;
}

const DateSelectionModal: React.FC<DateSelectionModalProps> = ({ isOpen, onClose, selectedDate, onSelect }) => {
    if (!isOpen) return null;

    const dates: { date: string; day: string; dayName: string; monthName: string; isToday: boolean }[] = [];
    const today = new Date();
    const daysTh = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const monthsTh = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        dates.push({
            date: dateStr,
            day: String(d.getDate()),
            dayName: daysTh[d.getDay()],
            monthName: monthsTh[d.getMonth()],
            isToday: i === 0
        });
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-800">เลือกวันที่ต้องการจอง</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 grid grid-cols-4 gap-3">
                    {dates.map((item) => {
                        const isSelected = item.date === selectedDate;
                        return (
                            <button
                                key={item.date}
                                onClick={() => {
                                    onSelect(item.date);
                                    onClose();
                                }}
                                className={`
                                    flex flex-col items-center justify-center p-2 rounded-xl border transition-all
                                    ${isSelected
                                        ? 'bg-green-600 border-green-600 text-white shadow-md'
                                        : 'bg-white border-gray-100 text-gray-700 hover:border-green-200 hover:bg-green-50'
                                    }
                                `}
                            >
                                <span className={`text-[10px] uppercase font-medium ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                                    {item.isToday ? 'วันนี้' : item.dayName}
                                </span>
                                <span className="text-lg font-bold leading-none my-1">{item.day}</span>
                                <span className={`text-[10px] ${isSelected ? 'text-green-100' : 'text-gray-500'}`}>
                                    {item.monthName}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-3 bg-gray-50 text-center">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-500 font-medium hover:text-gray-700"
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DateSelectionModal;
