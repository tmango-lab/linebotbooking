import React, { useState } from 'react';

export interface Field {
    id: number;
    name: string;
    type: string;
    price_pre?: number;
    price_post?: number;
}

interface BookingGridProps {
    fields: Field[];
    onSelect: (fieldId: number, startTime: string, endTime: string) => void;
    existingBookings?: any[];
}

const TIME_SLOTS = [
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
    "22:00", "22:30", "23:00", "23:30", "00:00"
];

const BookingGridVertical: React.FC<BookingGridProps> = ({ fields, onSelect, existingBookings = [] }) => {
    const [selection, setSelection] = useState<{
        fieldId: number | null;
        startIdx: number | null;
        endIdx: number | null;
    }>({ fieldId: null, startIdx: null, endIdx: null });

    const isSlotOccupied = (fieldId: number, idx: number) => {
        const slotTime = TIME_SLOTS[idx];
        const slotEnd = TIME_SLOTS[idx + 1];

        return existingBookings.some(b => {
            if (b.court_id !== fieldId) return false;
            const bStart = b.time_start.split(' ')[1].substring(0, 5);
            const bEnd = b.time_end.split(' ')[1].substring(0, 5);
            const compareStart = slotTime;
            const compareEnd = slotEnd === "00:00" ? "24:00" : slotEnd;
            const bCompareEnd = bEnd === "00:00" ? "24:00" : bEnd;
            return compareStart < bCompareEnd && compareEnd > bStart;
        });
    };

    const handleSlotClick = (fieldId: number, idx: number) => {
        if (isSlotOccupied(fieldId, idx)) return;

        // Case 1: Start new selection if:
        // - Different field
        // - No start selected yet
        // - Already have a complete range (reset to new start)
        if (selection.fieldId !== fieldId || selection.startIdx === null || selection.endIdx !== null) {
            setSelection({ fieldId, startIdx: idx, endIdx: null });
            return;
        }

        // Case 2: Have a start, selecting end logic
        if (selection.fieldId === fieldId && selection.startIdx !== null) {
            // If clicked before start, reset to new start
            if (idx < selection.startIdx) {
                setSelection({ fieldId, startIdx: idx, endIdx: null });
                return;
            }

            // Check validity of range (no occupied slots in between)
            for (let i = selection.startIdx; i <= idx; i++) {
                if (isSlotOccupied(fieldId, i)) {
                    // Obstacle found, reset to be safe (or could set start to idx, but reset is clearer)
                    setSelection({ fieldId, startIdx: idx, endIdx: null });
                    return;
                }
            }

            // Valid range
            const start = selection.startIdx;
            const end = idx;
            setSelection({ fieldId, startIdx: start, endIdx: end });

            // Notify parent
            onSelect(fieldId, TIME_SLOTS[start], TIME_SLOTS[end + 1]);
        }
    };

    return (
        <div className="overflow-x-auto bg-white max-h-[85vh] overflow-y-auto relative">
            <div className="min-w-fit">
                {/* Sticky Header Row (Fields) */}
                <div className="flex border-b border-gray-200 sticky top-0 z-20 bg-white shadow-sm">
                    {/* Corner Cell (Sticky Top & Left) */}
                    <div className="w-16 shrink-0 p-3 text-xs font-bold text-gray-400 border-r border-gray-100 flex items-center justify-center bg-gray-50 sticky left-0 z-30">
                        เวลา
                    </div>
                    {/* Field Headers */}
                    <div className="flex">
                        {fields.map(field => (
                            <div key={field.id} className="w-[80px] shrink-0 p-2 text-center border-r border-gray-100 last:border-r-0 bg-white">
                                <div className="text-sm font-bold text-gray-800 truncate">{field.name.replace('สนาม ', '')}</div>
                                <div className="text-[10px] text-green-600 font-normal truncate">{field.type}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body Rows */}
                {TIME_SLOTS.slice(0, -1).map((time, i) => (
                    <div key={time} className="flex border-b border-gray-100 last:border-b-0">
                        {/* Time Column (Sticky Left) */}
                        <div className="w-16 shrink-0 p-2 text-xs text-gray-500 font-medium border-r border-gray-100 flex items-center justify-center bg-gray-50 sticky left-0 z-10">
                            {time}
                        </div>

                        {/* Slots */}
                        <div className="flex">
                            {fields.map(field => {
                                const occupied = isSlotOccupied(field.id, i);
                                const isSelected =
                                    !occupied &&
                                    selection.fieldId === field.id &&
                                    selection.startIdx !== null &&
                                    (
                                        (selection.endIdx === null && i === selection.startIdx) ||
                                        (selection.endIdx !== null && i >= selection.startIdx && i <= selection.endIdx)
                                    );

                                return (
                                    <div
                                        key={`${field.id}-${i}`}
                                        onClick={() => handleSlotClick(field.id, i)}
                                        className={`w-[80px] shrink-0 h-12 border-r border-gray-100 last:border-r-0 relative transition-all duration-200
                                            ${occupied ? 'bg-gray-100' : 'cursor-pointer active:scale-95'}
                                            ${isSelected ? 'bg-green-500 text-white shadow-inner' : (occupied ? '' : 'bg-white hover:bg-gray-50')}
                                        `}
                                    >
                                        {occupied && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                                <div className="w-full h-[1px] bg-black rotate-45"></div>
                                            </div>
                                        )}
                                        {!occupied && selection.fieldId === field.id && selection.startIdx === i && selection.endIdx === null && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                            </div>
                                        )}
                                        {isSelected && selection.startIdx === i && (
                                            <div className="absolute top-1 left-1 text-[8px] opacity-75">เริ่ม</div>
                                        )}
                                        {isSelected && selection.endIdx === i && (
                                            <div className="absolute bottom-1 right-1 text-[8px] opacity-75">จบ</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BookingGridVertical;
