import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/api';
import { RefreshCw, ChevronLeft, ChevronRight, Clock, Calendar, Tag } from 'lucide-react';
import CalendarDropdown from '../../components/ui/CalendarDropdown';
import BookingModal from '../../components/ui/BookingModal';
import BookingDetailModal from '../../components/ui/BookingDetailModal';
import PromoCodeModal from '../../components/ui/PromoCodeModal';

interface MatchdayMatch {
    id: number;
    court_id: number;
    time_start: string;
    time_end: string;
    price: number;
    name?: string;
    tel?: string;
    remark?: string;
    [key: string]: any;
}

const COURTS = [
    { id: 2424, name: 'สนาม 1', size: '5 คน', color: 'blue', price_pre: 500, price_post: 700 }, // No 1
    { id: 2425, name: 'สนาม 2', size: '5 คน', color: 'indigo', price_pre: 500, price_post: 700 }, // No 2
    { id: 2428, name: 'สนาม 3', size: '7-8 คน', color: 'purple', price_pre: 1000, price_post: 1200 }, // No 3
    { id: 2426, name: 'สนาม 4', size: '7 คน', color: 'pink', price_pre: 800, price_post: 1000 }, // No 4
    { id: 2427, name: 'สนาม 5', size: '7 คน', color: 'rose', price_pre: 800, price_post: 1000 }, // No 5
    { id: 2429, name: 'สนาม 6', size: '7 คน (ใหม่)', color: 'orange', price_pre: 1000, price_post: 1200 }, // No 6
];

const START_HOUR = 8; // 08:00
const END_HOUR = 24;  // 00:00 (Next day)
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const PIXELS_PER_MINUTE = 1.5; // Adjust for height (1.5 = 90px per hour)
const SNAP_MINUTES = 30; // Snap to 30 minutes

function getTodayStr() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get date from URL or default to today
function getInitialDate(): string {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return dateParam;
    }

    return getTodayStr();
}

// Update URL without page reload
function updateURL(date: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('date', date);
    window.history.replaceState({}, '', url.toString());
}

export default function DashboardPage() {
    const [selectedDate, setSelectedDate] = useState(getInitialDate());
    const [showCalendar, setShowCalendar] = useState(false);
    const [bookings, setBookings] = useState<MatchdayMatch[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Drag & Drop State
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartY, setDragStartY] = useState<number | null>(null);
    const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
    const [dragCourtId, setDragCourtId] = useState<number | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingBooking, setPendingBooking] = useState<{
        courtId: number;
        startTime: string; // HH:mm
        endTime: string;   // HH:mm
        price: number;
    } | null>(null);

    // Detail Modal State
    const [viewingBooking, setViewingBooking] = useState<MatchdayMatch | null>(null);

    // Promo Code Modal State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

    // Sync URL when date changes
    useEffect(() => {
        updateURL(selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        fetchBookings(selectedDate);
    }, [selectedDate]);

    // Scroll to current time on load
    useEffect(() => {
        if (containerRef.current) {
            const now = new Date();
            const hours = now.getHours();
            if (hours >= START_HOUR && hours < END_HOUR) {
                const minutesFromStart = (hours - START_HOUR) * 60;
                containerRef.current.scrollTop = minutesFromStart * PIXELS_PER_MINUTE - 100;
            }
        }
    }, [loading]);

    async function fetchBookings(date: string) {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            console.log('[DEBUG] Using Token:', token ? token.substring(0, 20) + '...' : 'null');

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ date })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const responseText = await response.text();
            console.log('[DEBUG] Raw Response:', responseText);

            if (!responseText) {
                throw new Error('Server returned empty response');
            }

            const data = JSON.parse(responseText);
            const rawBookings = data.bookings || [];

            // Parse description "Name Phone" into name and tel if native tel is missing
            const parsedBookings = rawBookings.map((b: any) => {
                let name = b.name;
                let tel = b.tel;

                // Matchday sometimes puts the description in bill.description
                const description = b.description || b.bill?.description;

                // Priority: Use description if it looks like "Name Phone"
                if (description && (!tel || !name || name === description)) {
                    // Try to split by space, where last part is phone
                    // Accept any sequence of digits (5+) as potential phone number
                    const parts = description.split(' ');
                    if (parts.length >= 2) {
                        const lastPart = parts[parts.length - 1];
                        // More lenient: accept any 5+ digit sequence, with optional hyphens
                        if (/^[\d-]{5,}$/.test(lastPart) && /\d{5,}/.test(lastPart)) {
                            tel = lastPart;
                            name = parts.slice(0, -1).join(' ');
                        }
                    }
                }

                // Extract price from note if it's a promo booking (format: "Promo: CODE | Price: 600")
                let finalPrice = b.bill?.total || b.total_price || b.price;
                const note = b.settings?.note || b.remark;
                if (note && note.includes('Promo:') && note.includes('Price:')) {
                    const priceMatch = note.match(/Price:\s*(\d+)/);
                    if (priceMatch) {
                        finalPrice = parseInt(priceMatch[1], 10);
                    }
                }

                return {
                    ...b,
                    name: name || b.name || description, // Fallback
                    tel: tel,
                    price: finalPrice  // Use extracted promo price or bill.total
                };
            });

            setBookings(parsedBookings);
        } catch (err: any) {
            console.error('Error fetching bookings:', err);
            setError(err.message || 'Failed to fetch bookings');
        } finally {
            setLoading(false);
        }
    }

    // --- Drag Interaction Logic ---

    // 1. Mouse Down: Start Dragging
    const handleMouseDown = (e: React.MouseEvent, courtId: number) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.booking-card')) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const snappedY = snapToGridStart(y); // Use Floor for Start

        setIsDragging(true);
        setDragStartY(snappedY);
        setDragCurrentY(snappedY + (SNAP_MINUTES * PIXELS_PER_MINUTE));
        setDragCourtId(courtId);
    };

    // 2. Mouse Move: Update Drag Selection
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || dragStartY === null) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;

        if (y < 0 || y > TOTAL_MINUTES * PIXELS_PER_MINUTE) return;

        const minHeight = SNAP_MINUTES * PIXELS_PER_MINUTE;
        let snappedY = snapToGrid(y); // Keep Round for End/Drag

        if (snappedY <= dragStartY) {
            snappedY = dragStartY + minHeight;
        }

        setDragCurrentY(snappedY);
    };

    // 3. Mouse Up: Finish Drag & Open Modal
    const handleMouseUp = () => {
        if (!isDragging || dragStartY === null || dragCurrentY === null || dragCourtId === null) {
            resetDrag();
            return;
        }

        const startMin = yToMinutes(dragStartY);
        const endMin = yToMinutes(dragCurrentY);
        const startTime = minutesToTime(startMin);
        const endTime = minutesToTime(endMin);
        const estimatedPrice = calculateEstimatedPrice(dragCourtId, startMin, endMin);

        setPendingBooking({
            courtId: dragCourtId,
            startTime,
            endTime,
            price: estimatedPrice
        });

        setIsModalOpen(true);
        resetDrag();
    };

    const resetDrag = () => {
        setIsDragging(false);
        setDragStartY(null);
        setDragCurrentY(null);
        setDragCourtId(null);
    };

    // --- Helpers ---

    function snapToGridStart(y: number) {
        const slotHeight = SNAP_MINUTES * PIXELS_PER_MINUTE;
        return Math.floor(y / slotHeight) * slotHeight;
    }

    function snapToGrid(y: number) {
        const slotHeight = SNAP_MINUTES * PIXELS_PER_MINUTE;
        return Math.round(y / slotHeight) * slotHeight;
    }

    function yToMinutes(y: number) {
        const totalMinutes = y / PIXELS_PER_MINUTE;
        return START_HOUR * 60 + totalMinutes;
    }

    function minutesToTime(totalMinutes: number) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Replicate basic pricing logic for immediate feedback (Matches GAS/price_calculator.gs)
    function calculateEstimatedPrice(courtId: number, startMin: number, endMin: number) {
        const court = COURTS.find(c => c.id === courtId);
        if (!court) return 0;

        const durationH = (endMin - startMin) / 60;
        const startH = startMin / 60;
        const endH = endMin / 60;

        const cutOff = 18.0;
        let preHours = 0;
        let postHours = 0;

        if (endH <= cutOff) preHours = durationH;
        else if (startH >= cutOff) postHours = durationH;
        else {
            preHours = cutOff - startH;
            postHours = endH - cutOff;
        }

        let prePrice = preHours * court.price_pre;
        let postPrice = postHours * court.price_post;

        // Apply Rounding Rule: Both Pre and Post prices round UP to nearest 100
        if (prePrice > 0 && prePrice % 100 !== 0) {
            prePrice = Math.ceil(prePrice / 100) * 100;
        }
        if (postPrice > 0 && postPrice % 100 !== 0) {
            postPrice = Math.ceil(postPrice / 100) * 100;
        }

        return Math.round(prePrice + postPrice);
    }

    // --- API Interactions ---

    const handleConfirmBooking = async (data: { name: string; phone: string; note: string }) => {
        if (!pendingBooking) return;

        try {
            // Get session
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Direct fetch
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fieldId: pendingBooking.courtId,
                    date: selectedDate,
                    startTime: pendingBooking.startTime,
                    endTime: pendingBooking.endTime,
                    customerName: data.name,
                    phoneNumber: data.phone,
                    note: data.note
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error) errorMessage = errorJson.error;
                } catch (e) {
                    errorMessage += ` - ${errorText.substring(0, 100)}`;
                }
                throw new Error(errorMessage);
            }

            // Refresh bookings
            fetchBookings(selectedDate);
            setIsModalOpen(false); // Close modal on success

        } catch (err: any) {
            console.error('Booking Error:', err);
            // Re-throw to show in Modal or Toast (Modal handles it if we don't catch here, but we need to pass it to modal?
            // Actually BookingModal checks the promise rejection?
            // No, Checking BookingModal implementation might be needed, but usually throwing here causes the caller to catch?
            // Wait, this function is passed to onConfirm. if BookingModal awaits it, it will catch.
            throw err;
        }
    };

    function calculatePosition(timeStr: string) {
        const date = new Date(timeStr.replace(' ', 'T'));
        const hours = date.getHours();
        const minutes = date.getMinutes();
        let totalMinutesFromStart = (hours - START_HOUR) * 60 + minutes;
        if (totalMinutesFromStart < 0) totalMinutesFromStart = 0;
        return totalMinutesFromStart * PIXELS_PER_MINUTE;
    }

    function calculateHeight(startStr: string, endStr: string) {
        const start = new Date(startStr.replace(' ', 'T'));
        const end = new Date(endStr.replace(' ', 'T'));
        const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        return diffMinutes * PIXELS_PER_MINUTE;
    }

    function formatTime(dateTimeStr: string) {
        if (!dateTimeStr) return '';
        const date = new Date(dateTimeStr.replace(' ', 'T'));
        const hours = date.getHours();
        let minutes = date.getMinutes();

        // Visual adjustment: Show 17:01 as 17:00, 19:31 as 19:30
        if (minutes === 1) minutes = 0;
        if (minutes === 31) minutes = 30;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).replace(/^วัน/, '').replace('ที่', ' ').replace(/\s+/g, ' ');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-white">
            {/* Header */}
            <header className="flex flex-none items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                    <h1 className="text-2xl font-semibold leading-6 text-gray-900">
                        {formatDateHeader(selectedDate)}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">ตารางการจองสนามฟุตบอล</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="isolate inline-flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={handlePrevDay}
                            className="relative inline-flex items-center rounded-l-md bg-white px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
                            title="วันก่อนหน้า"
                        >
                            <span className="sr-only">Previous day</span>
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(getTodayStr())}
                            className="relative hidden md:inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 -ml-px"
                        >
                            วันนี้
                        </button>
                        <button
                            type="button"
                            onClick={handleNextDay}
                            className="relative inline-flex items-center rounded-r-md bg-white px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 -ml-px"
                        >
                            <span className="sr-only">Next day</span>
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </span>

                    <div className="relative">
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="hidden md:flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 bg-white"
                        >
                            <Calendar className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                            เลือกวันที่
                        </button>
                        {showCalendar && (
                            <div className="absolute right-0 top-full mt-2 z-50">
                                <CalendarDropdown
                                    selectedDate={selectedDate}
                                    onSelect={(date) => {
                                        setSelectedDate(date);
                                        setShowCalendar(false);
                                    }}
                                    onClose={() => setShowCalendar(false)}
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsPromoModalOpen(true)}
                        className="flex items-center gap-x-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                    >
                        <Tag className="h-4 w-4" />
                        <span className="hidden md:inline">ใช้โค้ด</span>
                    </button>

                    <button
                        onClick={() => fetchBookings(selectedDate)}
                        className={`flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden md:inline">อัปเดต</span>
                    </button>
                </div>
            </header>

            {error && (
                <div className="mx-6 mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Calendar View */}
            <div className="flex flex-auto overflow-hidden bg-white relative">
                <div
                    ref={containerRef}
                    className="flex flex-auto flex-col overflow-auto w-full"
                >
                    {/* Width Wrapper to ensure alignment */}
                    <div className="flex flex-col min-w-[1000px]">

                        {/* Sticky Court Header */}
                        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm grid grid-cols-[60px_repeat(6,1fr)] text-sm leading-6 text-gray-500 divide-x divide-gray-200">
                            <div className="flex items-center justify-center py-3 bg-gray-50">
                                <Clock className="w-4 h-4 text-gray-400" />
                            </div>
                            {COURTS.map(court => (
                                <div key={court.id} className="flex flex-col items-center justify-center py-3">
                                    <span className="font-semibold text-gray-900">{court.name}</span>
                                    <span className="text-xs text-gray-400 font-normal">{court.size}</span>
                                </div>
                            ))}
                        </div>

                        {/* Scrollable Grid Body */}
                        <div
                            className="grid grid-cols-[60px_repeat(6,1fr)] w-full relative select-none"
                            style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px` }}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                        >
                            {/* Horizontal Grid Lines (Rows) */}
                            <div className="col-start-1 col-end-[-1] grid-rows-1 absolute inset-0 z-0 pointer-events-none">
                                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="border-b border-gray-200 w-full relative"
                                        style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}
                                    >
                                        <div className="absolute top-1/2 left-0 right-0 border-b border-gray-200 border-dashed"></div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white border-r border-gray-200 z-10 text-xs text-gray-500 font-medium">
                                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`relative text-right pr-2 ${i === 0 ? '' : '-top-2.5'}`}
                                        style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}
                                    >
                                        {String(START_HOUR + i).padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            {/* Court Columns (Vertical) */}
                            {COURTS.map((court) => (
                                <div
                                    key={court.id}
                                    className="relative border-r border-gray-200 hover:bg-gray-50/30 transition-colors group cursor-crosshair"
                                    onMouseDown={(e) => handleMouseDown(e, court.id)}
                                >
                                    {/* Vertical guide lines helper */}
                                    <div className="absolute inset-y-0 left-0 w-px bg-gray-100" />

                                    {/* Render Existing Bookings */}
                                    {bookings
                                        .filter(b => b.court_id === court.id)
                                        .map(booking => {
                                            const top = calculatePosition(booking.time_start);
                                            const height = calculateHeight(booking.time_start, booking.time_end);

                                            // Clean Blue Theme (Tailwind UI Inspired)
                                            const styleClass = 'bg-blue-50 text-blue-700 border-blue-600 hover:bg-blue-100 booking-card';

                                            return (
                                                <div
                                                    key={booking.id}
                                                    className={`absolute inset-x-1 rounded shadow-sm border-l-[3px] px-2 py-1 text-xs transition-all cursor-pointer z-10 group overflow-hidden ${styleClass}`}
                                                    style={{
                                                        top: `${top}px`,
                                                        height: `${height}px`,
                                                    }}
                                                    title={`${formatTime(booking.time_start)} - ${formatTime(booking.time_end)} • ${booking.name || 'User'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent drag start
                                                        setViewingBooking(booking);
                                                    }}
                                                >
                                                    <div className="flex flex-col h-full justify-start items-start text-left pl-2 pt-1 pb-1 pr-1">
                                                        {/* Name */}
                                                        <p className="font-semibold text-xs leading-tight mb-0.5 truncate w-full text-blue-900">
                                                            {booking.name || 'ไม่ระบุชื่อ'}
                                                        </p>

                                                        {/* Time range */}
                                                        <div className="text-[10px] font-medium opacity-90 flex items-center gap-1 text-blue-800">
                                                            {formatTime(booking.time_start)} - {formatTime(booking.time_end)}
                                                        </div>

                                                        {/* Phone */}
                                                        {booking.tel && height > 50 && (
                                                            <p className="text-[10px] opacity-75 mt-0.5 truncate w-full">
                                                                {booking.tel}
                                                            </p>
                                                        )}

                                                        {/* Price - Bottom aligned */}
                                                        {(booking.price !== undefined && booking.price !== null) && height > 40 && (
                                                            <div className="mt-auto pt-1 w-full text-right">
                                                                <span className="inline-flex items-center rounded-sm bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">
                                                                    ฿{booking.price.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    {/* Render Drag Ghost */}
                                    {isDragging && dragCourtId === court.id && dragStartY !== null && dragCurrentY !== null && (
                                        <div
                                            className="absolute inset-x-1 rounded bg-indigo-100/80 border-2 border-indigo-500 border-dashed z-20 pointer-events-none flex items-center justify-center text-indigo-700 font-semibold text-xs shadow-lg"
                                            style={{
                                                top: `${dragStartY}px`,
                                                height: `${dragCurrentY - dragStartY}px`,
                                            }}
                                        >
                                            {minutesToTime(yToMinutes(dragStartY))} - {minutesToTime(yToMinutes(dragCurrentY))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            <BookingModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmBooking}
                bookingDetails={pendingBooking ? {
                    courtName: COURTS.find(c => c.id === pendingBooking.courtId)?.name || '',
                    date: formatDateHeader(selectedDate),
                    startTime: pendingBooking.startTime,
                    endTime: pendingBooking.endTime,
                    price: pendingBooking.price
                } : null}
            />

            {/* Detail Modal */}
            <BookingDetailModal
                isOpen={!!viewingBooking}
                booking={viewingBooking ? {
                    ...viewingBooking,
                    name: viewingBooking.name || 'ไม่ระบุชื่อ',
                    tel: viewingBooking.tel || '-',
                    // Ensure required fields for modal are present
                    id: viewingBooking.id,
                    time_start: viewingBooking.time_start,
                    time_end: viewingBooking.time_end,
                    price: viewingBooking.price
                } : null}
                onClose={() => setViewingBooking(null)}
                onBookingCancelled={() => {
                    setViewingBooking(null);
                    fetchBookings(selectedDate);
                }}
            />

            {/* Promo Code Modal */}
            <PromoCodeModal
                isOpen={isPromoModalOpen}
                onClose={() => setIsPromoModalOpen(false)}
                onSuccess={(bookingDate: string) => {
                    setIsPromoModalOpen(false);

                    // If booking date is different, navigate to it
                    if (bookingDate !== selectedDate) {
                        setSelectedDate(bookingDate);
                        // fetchBookings will be called automatically via useEffect
                    } else {
                        // If booking date is same as current date, manually refresh
                        fetchBookings(bookingDate);
                    }
                }}
            />
        </div>
    );
}
