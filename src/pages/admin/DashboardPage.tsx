import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/api';
import { RefreshCw, ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import CalendarDropdown from '../../components/ui/CalendarDropdown';

interface MatchdayMatch {
    id: number;
    court_id: number;
    time_start: string;
    time_end: string;
    price: number;
    [key: string]: any;
}

const COURTS = [
    { id: 2424, name: 'สนาม 1', size: '5 คน', color: 'blue' },
    { id: 2425, name: 'สนาม 2', size: '5 คน', color: 'indigo' },
    { id: 2428, name: 'สนาม 3', size: '7-8 คน', color: 'purple' },
    { id: 2426, name: 'สนาม 4', size: '7 คน', color: 'pink' },
    { id: 2427, name: 'สนาม 5', size: '7 คน', color: 'rose' },
    { id: 2429, name: 'สนาม 6', size: '7 คน (ใหม่)', color: 'orange' },
];

const START_HOUR = 8; // 08:00
const END_HOUR = 24;  // 00:00 (Next day)
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const PIXELS_PER_MINUTE = 2; // Adjust for height

export default function DashboardPage() {
    const [selectedDate, setSelectedDate] = useState(getTodayStr());
    const [showCalendar, setShowCalendar] = useState(false);
    const [bookings, setBookings] = useState<MatchdayMatch[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
    }, [loading]); // Run when loading finishes/starts

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    async function fetchBookings(date: string) {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.functions.invoke('get-bookings', {
                body: { date }
            });

            if (error) throw error;
            setBookings(data.bookings || []);
        } catch (err: any) {
            console.error('Error fetching bookings:', err);
            setError(err.message || 'Failed to fetch bookings');
        } finally {
            setLoading(false);
        }
    }

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
        // Adjust display time slightly if needed, but keeping it standard for now
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
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
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-white">
            {/* Header */}
            {/* Header */}
            {/* Header */}
            <header className="flex flex-none items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="relative">
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setShowCalendar(!showCalendar)}
                    >
                        <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                            {formatDateHeader(selectedDate)}
                            <Calendar className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                        </h1>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        ตารางการจองสนามฟุตบอล
                    </p>
                    {showCalendar && (
                        <CalendarDropdown
                            selectedDate={selectedDate}
                            onSelect={(date) => {
                                setSelectedDate(date);
                                setShowCalendar(false);
                            }}
                            onClose={() => setShowCalendar(false)}
                        />
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm">
                        <button
                            onClick={handlePrevDay}
                            className="flex items-center justify-center p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-50 border-r border-gray-300 rounded-l-lg"
                        >
                            <span className="sr-only">Previous day</span>
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div
                            className="px-4 py-2 text-sm font-medium text-gray-900 border-r border-gray-300 min-w-[120px] text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setShowCalendar(!showCalendar)}
                        >
                            {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </div>
                        <button
                            onClick={handleNextDay}
                            className="flex items-center justify-center p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-50 rounded-r-lg"
                        >
                            <span className="sr-only">Next day</span>
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    <button
                        onClick={() => setSelectedDate(getTodayStr())}
                        className="hidden md:block rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        วันนี้
                    </button>

                    <button
                        onClick={() => fetchBookings(selectedDate)}
                        className={`ml-2 p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-all ${loading ? 'animate-spin text-blue-500' : ''}`}
                    >
                        <RefreshCw className="h-5 w-5" />
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
            <div ref={containerRef} className="flex flex-auto overflow-hidden bg-white">
                <div className="flex w-full flex-col">

                    {/* Sticky Court Header */}
                    <div className="sticky top-0 z-30 flex-none bg-white ring-1 ring-black ring-opacity-5 sm:pr-8 border-b border-gray-200 shadow-sm">
                        <div className="-mr-px grid grid-cols-[60px_repeat(6,1fr)] text-sm leading-6 text-gray-500 divide-x divide-gray-100">
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
                    </div>

                    {/* Scrollable Grid */}
                    <div className="flex flex-auto overflow-y-auto">
                        <div
                            className="grid grid-cols-[60px_repeat(6,1fr)] w-full relative"
                            style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px`, minWidth: '1000px' }}
                        >
                            {/* Horizontal Grid Lines (Rows) */}
                            <div className="col-start-1 col-end-[-1] grid-rows-1 absolute inset-0 z-0 pointer-events-none">
                                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="border-b border-gray-100 w-full"
                                        style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}
                                    ></div>
                                ))}
                            </div>

                            {/* Time Column (Left Axis) */}
                            <div className="bg-white border-r border-gray-200 z-10 text-xs text-gray-400 font-medium">
                                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="relative -top-2.5 text-right pr-2"
                                        style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}
                                    >
                                        {String(START_HOUR + i).padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            {/* Court Columns (Vertical) */}
                            {COURTS.map((court, index) => (
                                <div key={court.id} className={`relative border-r border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                    {/* Vertical guide lines helper */}
                                    <div className="absolute inset-y-0 left-0 w-px bg-gray-100" />

                                    {bookings
                                        .filter(b => b.court_id === court.id)
                                        .map(booking => {
                                            const top = calculatePosition(booking.time_start);
                                            const height = calculateHeight(booking.time_start, booking.time_end);

                                            // Determine styles based on court color defined in constant
                                            const colorStyles = {
                                                blue: 'bg-blue-100 text-blue-700 border-blue-500 hover:bg-blue-200',
                                                indigo: 'bg-indigo-100 text-indigo-700 border-indigo-500 hover:bg-indigo-200',
                                                purple: 'bg-purple-100 text-purple-700 border-purple-500 hover:bg-purple-200',
                                                pink: 'bg-pink-100 text-pink-700 border-pink-500 hover:bg-pink-200',
                                                rose: 'bg-rose-100 text-rose-700 border-rose-500 hover:bg-rose-200',
                                                orange: 'bg-orange-100 text-orange-700 border-orange-500 hover:bg-orange-200',
                                            };
                                            const styleClass = colorStyles[court.color as keyof typeof colorStyles] || colorStyles.blue;

                                            return (
                                                <div
                                                    key={booking.id}
                                                    className={`absolute inset-x-1 rounded-lg border-l-4 px-2 py-1 text-xs shadow-sm transition-all cursor-pointer z-10 group overflow-hidden ${styleClass}`}
                                                    style={{
                                                        top: `${top}px`,
                                                        height: `${height}px`,
                                                    }}
                                                    title={`${formatTime(booking.time_start)} - ${formatTime(booking.time_end)} • ${booking.name || 'User'}`}
                                                >
                                                    <div className="flex flex-col h-full p-2">
                                                        {/* Time */}
                                                        <p className={`text-xs font-semibold mb-0.5 opacity-90 ${court.color === 'blue' ? 'text-blue-700' :
                                                            court.color === 'indigo' ? 'text-indigo-700' :
                                                                court.color === 'purple' ? 'text-purple-700' :
                                                                    court.color === 'pink' ? 'text-pink-700' :
                                                                        court.color === 'rose' ? 'text-rose-700' :
                                                                            'text-orange-700'
                                                            }`}>
                                                            {formatTime(booking.time_start)}
                                                        </p>

                                                        {/* Name/Title */}
                                                        <p className="font-bold text-sm leading-tight text-gray-900 mb-0.5 truncate">
                                                            {booking.name || 'ไม่ระบุชื่อ'}
                                                        </p>

                                                        {/* Details (Phone) - Only show if height allows */}
                                                        {height > 50 && booking.tel && (
                                                            <p className={`text-xs truncate opacity-80 ${court.color === 'blue' ? 'text-blue-600' :
                                                                court.color === 'indigo' ? 'text-indigo-600' :
                                                                    court.color === 'purple' ? 'text-purple-600' :
                                                                        court.color === 'pink' ? 'text-pink-600' :
                                                                            court.color === 'rose' ? 'text-rose-600' :
                                                                                'text-orange-600'
                                                                }`}>
                                                                {booking.tel}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
