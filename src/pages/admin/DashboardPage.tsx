import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { RefreshCw, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface MatchdayMatch {
    id: number;
    court_id: number;
    time_start: string;
    time_end: string;
    price: number;
    [key: string]: any;
}

const COURTS = [
    { id: 2424, name: 'สนาม #1 (5คน)' },
    { id: 2425, name: 'สนาม #2 (5คน)' },
    { id: 2428, name: 'สนาม #3 (7-8คน)' },
    { id: 2426, name: 'สนาม #4 (7คน)' },
    { id: 2427, name: 'สนาม #5 (7คน)' },
    { id: 2429, name: 'สนาม #6 ใหม่ (7คน)' },
];

const START_HOUR = 8; // 08:00
const END_HOUR = 24;  // 00:00 (Next day)
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const PIXELS_PER_MINUTE = 2; // Adjust for height

export default function DashboardPage() {
    const [selectedDate, setSelectedDate] = useState(getTodayStr());
    const [bookings, setBookings] = useState<MatchdayMatch[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBookings(selectedDate);
    }, [selectedDate]);

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
        // timeStr format "YYYY-MM-DD HH:mm:ss"
        const date = new Date(timeStr.replace(' ', 'T'));
        const hours = date.getHours();
        const minutes = date.getMinutes();

        // Handle midnight as 24:00 for calculation if need be, 
        // but typically bookings might span into next day. 
        // For simplicity, let's assume single day view logic.

        let totalMinutesFromStart = (hours - START_HOUR) * 60 + minutes;
        if (totalMinutesFromStart < 0) totalMinutesFromStart = 0; // Clip earlier times

        return totalMinutesFromStart * PIXELS_PER_MINUTE;
    }

    function calculateHeight(startStr: string, endStr: string) {
        const start = new Date(startStr.replace(' ', 'T'));
        const end = new Date(endStr.replace(' ', 'T'));
        const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        return diffMinutes * PIXELS_PER_MINUTE;
    }

    function formatStartTime(dateTimeStr: string) {
        if (!dateTimeStr) return '';
        // Subtract 1 minute to normalize start time
        // e.g., "18:31" becomes "18:30", "18:01" becomes "18:00"
        const date = new Date(dateTimeStr.replace(' ', 'T'));
        date.setMinutes(date.getMinutes() - 1);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function formatEndTime(dateTimeStr: string) {
        if (!dateTimeStr) return '';
        // No adjustment for end time
        return dateTimeStr.split(' ')[1].substring(0, 5);
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

    return (
        <div className="p-4 h-[calc(100vh-64px)] flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">Booking Schedule</h1>
                    {loading && <RefreshCw className="animate-spin text-blue-500" size={20} />}
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <button onClick={handlePrevDay} className="p-2 hover:bg-white rounded-md transition-all">
                        <ChevronLeft size={20} className="text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2 px-2">
                        <CalendarIcon className="text-gray-500" size={18} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent outline-none text-gray-700 font-medium"
                        />
                    </div>
                    <button onClick={handleNextDay} className="p-2 hover:bg-white rounded-md transition-all">
                        <ChevronRight size={20} className="text-gray-600" />
                    </button>
                    <button
                        onClick={() => fetchBookings(selectedDate)}
                        className="ml-2 p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm border border-red-200">
                    Error: {error}
                </div>
            )}

            {/* Calendar Grid Container */}
            <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="min-w-[900px] w-full">
                    {/* Header Row (Courts) - Using Grid */}
                    <div className="sticky top-0 z-20 grid grid-cols-[60px_repeat(6,1fr)] border-b border-gray-200 bg-gray-50">
                        <div className="border-r border-gray-200"></div> {/* Time axis header */}
                        {COURTS.map(court => (
                            <div key={court.id} className="py-3 px-2 text-center border-r border-gray-200 font-semibold text-gray-700">
                                {court.name}
                            </div>
                        ))}
                    </div>

                    {/* Grid Body - Using Grid */}
                    <div className="grid grid-cols-[60px_repeat(6,1fr)]" style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px` }}>

                        {/* Time Slots (Y-Axis) */}
                        <div className="border-r border-gray-200 bg-white">
                            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                <div
                                    key={i}
                                    className="border-b border-gray-100 text-xs text-gray-400 text-right pr-2 relative"
                                    style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}
                                >
                                    <span className="-top-2 relative">{String(START_HOUR + i).padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* Court Columns */}
                        {COURTS.map(court => (
                            <div key={court.id} className="border-r border-gray-100 bg-white">
                                <div className="relative" style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px` }}>
                                    {/* Horizontal Grid Lines */}
                                    {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="border-b border-gray-50"
                                            style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}
                                        ></div>
                                    ))}

                                    {/* Bookings */}
                                    {bookings
                                        .filter(b => b.court_id === court.id)
                                        .map(booking => {
                                            const top = calculatePosition(booking.time_start);
                                            const height = calculateHeight(booking.time_start, booking.time_end);
                                            return (
                                                <div
                                                    key={booking.id}
                                                    className="absolute left-1 right-1 rounded-md p-2 text-xs text-white bg-blue-500 hover:bg-blue-600 transition-all cursor-pointer shadow-sm overflow-hidden"
                                                    style={{
                                                        top: `${top}px`,
                                                        height: `${height}px`,
                                                        zIndex: 10
                                                    }}
                                                    title={`${formatStartTime(booking.time_start)} - ${formatEndTime(booking.time_end)}`}
                                                >
                                                    <div className="font-bold">{formatStartTime(booking.time_start)} - {formatEndTime(booking.time_end)}</div>
                                                    <div className="opacity-90 truncate">{booking.name || 'Matchday User'}</div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
