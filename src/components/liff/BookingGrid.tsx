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
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
    "22:00", "22:30", "23:00", "23:30", "00:00"
];

const BookingGrid: React.FC<BookingGridProps> = ({ fields, onSelect, existingBookings = [] }) => {
    const [selection, setSelection] = useState<{
        fieldId: number | null;
        startIdx: number | null;
        endIdx: number | null;
    }>({ fieldId: null, startIdx: null, endIdx: null });

    // Helper: Check if slot is occupied
    const isSlotOccupied = (fieldId: number, idx: number) => {
        const slotTime = TIME_SLOTS[idx]; // e.g. "16:00"
        const slotEnd = TIME_SLOTS[idx + 1];

        return existingBookings.some(b => {
            if (b.court_id !== fieldId) return false;

            // Extract HH:mm from "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
            const bStart = b.time_start.split(' ')[1].substring(0, 5);
            const bEnd = b.time_end.split(' ')[1].substring(0, 5);

            // Handle midnight for end time "00:00" -> "24:00" for comparison
            const compareStart = slotTime;
            const compareEnd = slotEnd === "00:00" ? "24:00" : slotEnd;
            const bCompareEnd = bEnd === "00:00" ? "24:00" : bEnd;

            // Overlap check: slotStart < bEnd AND slotEnd > bStart
            return compareStart < bCompareEnd && compareEnd > bStart;
        });
    };

    const handleSlotClick = (fieldId: number, idx: number) => {
        if (isSlotOccupied(fieldId, idx)) return;

        // Case A: Fresh start
        if (selection.fieldId !== fieldId || selection.startIdx === null || selection.endIdx !== null) {
            setSelection({ fieldId, startIdx: idx, endIdx: null });
            return;
        }

        // Case B: Selecting end
        if (selection.fieldId === fieldId && selection.startIdx !== null) {
            if (idx < selection.startIdx) {
                setSelection({ fieldId, startIdx: idx, endIdx: null });
                return;
            }

            // Check if ANY slot in between is occupied
            for (let i = selection.startIdx; i <= idx; i++) {
                if (isSlotOccupied(fieldId, i)) {
                    // Reset to this new start if we hit a wall
                    setSelection({ fieldId, startIdx: idx, endIdx: null });
                    return;
                }
            }

            const start = selection.startIdx;
            const end = idx;
            setSelection({ fieldId, startIdx: start, endIdx: end });

            const startTime = TIME_SLOTS[start];
            const endTime = TIME_SLOTS[end + 1];
            onSelect(fieldId, startTime, endTime);
        }
    };

    return (
        <div className="overflow-x-auto overscroll-x-contain">
            <div className="min-w-[800px] select-none">
                {/* Header Row */}
                <div className="flex">
                    <div className="w-24 shrink-0 p-2 font-bold text-gray-500 bg-white sticky left-0 z-10 border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        Field
                    </div>
                    {TIME_SLOTS.slice(0, -1).map((time) => (
                        <div key={time} className="flex-1 min-w-[60px] text-center text-xs text-gray-400 p-2 border-b border-l border-gray-100">
                            {time}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                {fields.map(field => (
                    <div key={field.id} className="flex h-12 border-b border-gray-100">
                        <div className="w-24 shrink-0 p-2 flex flex-col justify-center bg-white sticky left-0 z-10 text-xs font-semibold text-gray-700 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div>{field.name.replace('สนาม ', '')}</div>
                            <div className="text-[10px] text-green-600 font-normal">{field.type}</div>
                        </div>

                        {/* Slots */}
                        {TIME_SLOTS.slice(0, -1).map((_, i) => {
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
                                    className={`flex-1 min-w-[60px] transition-colors duration-200 relative border-l border-gray-100
                                        ${occupied ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer'}
                                        ${isSelected ? 'bg-green-500 text-white' : (occupied ? '' : 'bg-white active:bg-green-50')}
                                    `}
                                >
                                    {occupied && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                            <div className="w-full h-[1px] bg-gray-400 rotate-45"></div>
                                        </div>
                                    )}
                                    {!occupied && selection.fieldId === field.id && selection.startIdx === i && selection.endIdx === null && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-sm"></div>
                                        </div>
                                    )}
                                    {isSelected && selection.startIdx === i && (
                                        <div className="absolute top-1 left-1 text-[8px] opacity-75">Start</div>
                                    )}
                                    {isSelected && selection.endIdx === i && (
                                        <div className="absolute bottom-1 right-1 text-[8px] opacity-75">End</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BookingGrid;
