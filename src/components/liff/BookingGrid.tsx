import React, { useState, useEffect, useRef } from 'react';

interface Field {
    id: number;
    name: string;
    type: string;
}

interface BookingGridProps {
    onSelect: (fieldId: number, startTime: string, endTime: string) => void;
    existingBookings?: any[]; // Allow visual disabling
}

const TIME_SLOTS = [
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
    "22:00", "22:30", "23:00", "23:30", "00:00"
];

// Mock Fields (will replace with props later or fetch)
const MOCK_FIELDS: Field[] = [
    { id: 1, name: "Court 1", type: "7-a-side" },
    { id: 2, name: "Court 2", type: "7-a-side" },
    { id: 3, name: "Court 3", type: "7-a-side" },
    { id: 4, name: "Court 4", type: "5-a-side" },
    { id: 5, name: "Court 5", type: "5-a-side" },
    { id: 6, name: "Court 6", type: "5-a-side" },
];

const BookingGrid: React.FC<BookingGridProps> = ({ onSelect }) => {
    const [selection, setSelection] = useState<{
        fieldId: number | null;
        startIdx: number | null;
        endIdx: number | null;
    }>({ fieldId: null, startIdx: null, endIdx: null });

    const [isDragging, setIsDragging] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);

    const handleStart = (fieldId: number, timeIdx: number) => {
        setIsDragging(true);
        setSelection({
            fieldId,
            startIdx: timeIdx,
            endIdx: timeIdx
        });
    };

    const handleMove = (fieldId: number, timeIdx: number) => {
        if (!isDragging) return;
        if (selection.fieldId !== null && selection.fieldId !== fieldId) return; // Lock to same field

        setSelection(prev => ({
            ...prev,
            endIdx: timeIdx
        }));
    };

    const handleEnd = () => {
        setIsDragging(false);
        if (selection.fieldId !== null && selection.startIdx !== null && selection.endIdx !== null) {
            const start = Math.min(selection.startIdx, selection.endIdx);
            const end = Math.max(selection.startIdx, selection.endIdx);

            // Calculate duration (each slot is 30 mins)
            // Times: index 0 = 16:00.
            // visual logic: if I select 16:00 (0) to 17:00 (2), that's 2 slots? 
            // Actually, we usually select "Blocks". 
            // Let's assume the grid cells represent the *START* of the 30min block.

            const startTime = TIME_SLOTS[start];
            // End Time is the slot *after* the last selected block
            const endTime = TIME_SLOTS[end + 1];

            console.log(`Selected: Court ${selection.fieldId}, ${startTime} - ${endTime}`);
            onSelect(selection.fieldId, startTime, endTime);
        }
    };

    // Touch support helper (more complex, simplified here for now)
    // We rely on simple mouse events first, touch events need elementFromPoint or reliable touch handlers.

    return (
        <div className="overflow-x-auto pb-4" onMouseUp={handleEnd} onMouseLeave={handleEnd} onTouchEnd={handleEnd}>
            <div className="min-w-[600px] select-none">
                {/* Header Row */}
                <div className="flex">
                    <div className="w-24 shrink-0 p-2 font-bold text-gray-500 bg-white sticky left-0 z-10 border-b">
                        Field
                    </div>
                    {TIME_SLOTS.slice(0, -1).map((time, i) => (
                        <div key={time} className="flex-1 min-w-[60px] text-center text-xs text-gray-400 p-2 border-b border-l border-gray-100">
                            {time}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                {MOCK_FIELDS.map(field => (
                    <div key={field.id} className="flex h-12 border-b border-gray-100">
                        {/* Field Label */}
                        <div className="w-24 shrink-0 p-2 flex flex-col justify-center bg-white sticky left-0 z-10 text-xs font-semibold text-gray-700 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div>{field.name}</div>
                            <div className="text-[10px] text-green-600 font-normal">{field.type}</div>
                        </div>

                        {/* Slots */}
                        {TIME_SLOTS.slice(0, -1).map((time, i) => {
                            const isSelected =
                                selection.fieldId === field.id &&
                                selection.startIdx !== null &&
                                selection.endIdx !== null &&
                                i >= Math.min(selection.startIdx, selection.endIdx) &&
                                i <= Math.max(selection.startIdx, selection.endIdx);

                            return (
                                <div
                                    key={`${field.id}-${i}`}
                                    className={`flex-1 min-w-[60px] cursor-pointer transition-colors duration-75
                                        ${isSelected ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-50 active:bg-green-100'}
                                        border-l border-gray-100
                                    `}
                                    onMouseDown={() => handleStart(field.id, i)}
                                    onMouseEnter={() => handleMove(field.id, i)}
                                // Touch events would go here (touchstart, touchmove - tricky with scroll)
                                >
                                    {/* Content (e.g., price or blocked) */}
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
