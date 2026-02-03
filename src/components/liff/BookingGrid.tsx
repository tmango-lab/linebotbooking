import React, { useState } from 'react';

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
    // const gridRef = useRef<HTMLDivElement>(null); // Unused

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

            const startTime = TIME_SLOTS[start];
            // End Time is the slot *after* the last selected block
            const endTime = TIME_SLOTS[end + 1];

            console.log(`Selected: Court ${selection.fieldId}, ${startTime} - ${endTime}`);
            onSelect(selection.fieldId, startTime, endTime);
        }
    };

    // Touch support helper 
    // Touch move doesn't fire "enter" events, so we must calculate element under finger.
    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault(); // Prevent scrolling while dragging
        if (!isDragging) return;

        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element) {
            // Check if we are over a slot
            const slotData = element.getAttribute('data-slot'); // "fieldId-timeIdx"
            if (slotData) {
                const [fId, tIdx] = slotData.split('-').map(Number);

                // Only allow drag if same field
                if (selection.fieldId === fId) {
                    setSelection(prev => ({
                        ...prev,
                        endIdx: tIdx
                    }));
                }
            }
        }
    };

    const handleTouchStart = (fieldId: number, timeIdx: number) => {
        setIsDragging(true);
        setSelection({
            fieldId,
            startIdx: timeIdx,
            endIdx: timeIdx
        });
    };

    return (
        <div
            className="overflow-x-auto pb-4 overscroll-none touch-none"
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchEnd={handleEnd}
            onTouchMove={handleTouchMove}
        >
            <div className="min-w-[600px] select-none">
                {/* Header Row */}
                <div className="flex">
                    <div className="w-24 shrink-0 p-2 font-bold text-gray-500 bg-white sticky left-0 z-10 border-b">
                        Field
                    </div>
                    {TIME_SLOTS.slice(0, -1).map((time, _) => ( // Use _ for unused param
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
                        {TIME_SLOTS.slice(0, -1).map((_, i) => { // Use _ for unused param time
                            const isSelected =
                                selection.fieldId === field.id &&
                                selection.startIdx !== null &&
                                selection.endIdx !== null &&
                                i >= Math.min(selection.startIdx, selection.endIdx) &&
                                i <= Math.max(selection.startIdx, selection.endIdx);

                            return (
                                <div
                                    key={`${field.id}-${i}`}
                                    data-slot={`${field.id}-${i}`} // Needed for touch detection
                                    className={`flex-1 min-w-[60px] cursor-pointer transition-colors duration-75
                                        ${isSelected ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-50 active:bg-green-100'}
                                        border-l border-gray-100 relative
                                    `}
                                    onMouseDown={() => handleStart(field.id, i)}
                                    onMouseEnter={() => handleMove(field.id, i)}
                                    onTouchStart={() => handleTouchStart(field.id, i)}
                                >
                                    {/* Helper text for start/end visual */}
                                    {isSelected && i === Math.min(selection.startIdx!, selection.endIdx!) && (
                                        <div className="absolute top-1 left-1 text-[8px] opacity-75">Start</div>
                                    )}
                                    {isSelected && i === Math.max(selection.startIdx!, selection.endIdx!) && (
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
