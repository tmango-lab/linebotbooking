import React, { useState } from 'react';

// Shared Interface (could be moved to types file)
export interface Field {
    id: number;
    name: string;
    type: string;
    price_pre?: number;
    price_post?: number;
}

interface BookingGridProps {
    fields: Field[]; // Receive real fields
    onSelect: (fieldId: number, startTime: string, endTime: string) => void;
    existingBookings?: any[];
}

const TIME_SLOTS = [
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
    "22:00", "22:30", "23:00", "23:30", "00:00"
];

const BookingGrid: React.FC<BookingGridProps> = ({ fields, onSelect }) => {
    const [selection, setSelection] = useState<{
        fieldId: number | null;
        startIdx: number | null;
        endIdx: number | null;
    }>({ fieldId: null, startIdx: null, endIdx: null });

    const [isDragging, setIsDragging] = useState(false);

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
        if (selection.fieldId !== null && selection.fieldId !== fieldId) return;

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

            const startTime = TIME_SLOTS[start];
            const endTime = TIME_SLOTS[end + 1];

            console.log(`Selected: Court ${selection.fieldId}, ${startTime} - ${endTime}`);
            onSelect(selection.fieldId, startTime, endTime);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        // [Key Change] Only prevent default if we determine the user is "Selecting" (dragging horizontally on a row)
        // For now, removing absolute preventDefault to allow scrolling if needed. 
        // CAUTION: This makes "Diagonal" scrolling vs selecting tricky.
        // Quick Fix: If isDragging is true, we assume selection intent.

        if (!isDragging) return;
        if (e.cancelable) e.preventDefault(); // Lock scroll ONLY when dragging/selecting

        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element) {
            const slotData = element.getAttribute('data-slot');
            if (slotData) {
                const [fId, tIdx] = slotData.split('-').map(Number);
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
        // [Key Change] Removed 'touch-none' but kept 'overflow-x-auto'. 
        // Added 'touch-action-pan-y' or similar? No, standard overflow is fine.
        // We rely on handleTouchMove's preventDefault to stop scroll ONLY when selecting.
        <div
            className="overflow-x-auto pb-4 overscroll-x-contain select-none"
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchEnd={handleEnd}
            onTouchMove={handleTouchMove}
        >
            <div className="min-w-[800px]"> {/* Increased width to ensure scrollability is obvious */}
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
                        {/* Field Label */}
                        <div className="w-24 shrink-0 p-2 flex flex-col justify-center bg-white sticky left-0 z-10 text-xs font-semibold text-gray-700 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div>{field.name}</div>
                            <div className="text-[10px] text-green-600 font-normal">{field.type}</div>
                        </div>

                        {/* Slots */}
                        {TIME_SLOTS.slice(0, -1).map((_, i) => {
                            const isSelected =
                                selection.fieldId === field.id &&
                                selection.startIdx !== null &&
                                selection.endIdx !== null &&
                                i >= Math.min(selection.startIdx, selection.endIdx) &&
                                i <= Math.max(selection.startIdx, selection.endIdx);

                            return (
                                <div
                                    key={`${field.id}-${i}`}
                                    data-slot={`${field.id}-${i}`}
                                    className={`flex-1 min-w-[60px] cursor-pointer transition-colors duration-75
                                        ${isSelected ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-50 active:bg-green-100'}
                                        border-l border-gray-100 relative
                                    `}
                                    onMouseDown={() => handleStart(field.id, i)}
                                    onMouseEnter={() => handleMove(field.id, i)}
                                    onTouchStart={() => handleTouchStart(field.id, i)}
                                >
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
