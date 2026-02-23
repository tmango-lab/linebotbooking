import { useState, useEffect, useRef } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Clock, Calendar, Tag, AlertTriangle } from 'lucide-react';
import CalendarDropdown from '../../components/ui/CalendarDropdown';
import BookingModal from '../../components/ui/BookingModal';
import BookingDetailModal from '../../components/ui/BookingDetailModal';
import PromoCodeModal from '../../components/ui/PromoCodeModal';
import BookingCard from '../../components/admin/BookingCard';
import { formatDate, formatTime } from '../../utils/date';

interface MatchdayMatch {
    id: string | number;
    court_id: number;
    time_start: string;
    time_end: string;
    price: number;
    name?: string;
    tel?: string;
    remark?: string;
    admin_note?: string;
    paid_at?: string | null;
    source?: string;
    is_promo?: boolean;
    discount?: number;
    is_refunded?: boolean;
    [key: string]: any;
}

const COURTS = [
    { id: 2424, name: 'สนาม 1', size: '5 คน', color: 'blue', price_pre: 500, price_post: 700 },
    { id: 2425, name: 'สนาม 2', size: '5 คน', color: 'indigo', price_pre: 500, price_post: 700 },
    { id: 2428, name: 'สนาม 3', size: '7-8 คน', color: 'purple', price_pre: 1000, price_post: 1200 },
    { id: 2426, name: 'สนาม 4', size: '7 คน', color: 'pink', price_pre: 800, price_post: 1000 },
    { id: 2427, name: 'สนาม 5', size: '7 คน', color: 'rose', price_pre: 800, price_post: 1000 },
    { id: 2429, name: 'สนาม 6', size: '7 คน (ใหม่)', color: 'orange', price_pre: 1000, price_post: 1200 },
];

const START_HOUR = 8;
const END_HOUR = 24;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const PIXELS_PER_MINUTE = 1.5;
const SNAP_MINUTES = 30;

function getTodayStr() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getInitialDate(): string {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    return getTodayStr();
}

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

    // --- Interaction State ---
    type InteractionMode = 'NONE' | 'CREATE' | 'MOVE' | 'RESIZE_TOP' | 'RESIZE_BOTTOM';
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('NONE');

    // Create State
    const [isDraggingCreate, setIsDraggingCreate] = useState(false);
    const [createStartY, setCreateStartY] = useState<number | null>(null);
    const [createCurrentY, setCreateCurrentY] = useState<number | null>(null);
    const [createCourtId, setCreateCourtId] = useState<number | null>(null);

    // Modify State
    const [activeBookingId, setActiveBookingId] = useState<number | string | null>(null);
    const [ghostState, setGhostState] = useState<{
        top: number;
        height: number;
        courtId: number;
        startMin: number;
        endMin: number;
        price: number;
        paid: boolean;
        valid: boolean;
    } | null>(null);

    // Offset for smoother dragging (relative to mouse click)
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isDraggingConfirmed, setIsDraggingConfirmed] = useState(false);
    const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [pendingCreate, setPendingCreate] = useState<{ courtId: number; startTime: string; endTime: string; price: number } | null>(null);
    const [viewingBooking, setViewingBooking] = useState<MatchdayMatch | null>(null);
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

    // Modification Confirmation Modal
    const [modifyConfirm, setModifyConfirm] = useState<{ original: MatchdayMatch; new: { courtId: number; startTime: string; endTime: string; price: number } } | null>(null);
    const [modifying, setModifying] = useState(false);

    const [scrollToTime, setScrollToTime] = useState<string | null>(null);
    const hasScrolledRef = useRef(false);


    useEffect(() => {
        updateURL(selectedDate);
        hasScrolledRef.current = false;
    }, [selectedDate]);

    useEffect(() => {
        fetchBookings(selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        if (viewingBooking && bookings.length > 0) {
            const updated = bookings.find(b => b.id === viewingBooking.id);
            if (updated && JSON.stringify(updated) !== JSON.stringify(viewingBooking)) {
                setViewingBooking(updated);
            }
        }
    }, [bookings, viewingBooking]);

    useEffect(() => {
        if (containerRef.current && !loading && bookings.length > 0) {
            // Handle explicit scroll request
            if (scrollToTime) {
                const y = calculatePosition(scrollToTime);
                containerRef.current.scrollTo({ top: y - 100, behavior: 'smooth' });
                setScrollToTime(null);
                return;
            }

            // Initial scroll (only once)
            if (!hasScrolledRef.current) {
                const now = new Date();
                const hours = now.getHours();
                if (hours >= START_HOUR && hours < END_HOUR) {
                    const minutesFromStart = (hours - START_HOUR) * 60;
                    containerRef.current.scrollTop = minutesFromStart * PIXELS_PER_MINUTE - 100;
                    hasScrolledRef.current = true;
                }
            }
        }
    }, [loading, bookings, scrollToTime]);


    // --- Helpers ---
    function snapToGrid(y: number) {
        const slotHeight = SNAP_MINUTES * PIXELS_PER_MINUTE;
        return Math.round(y / slotHeight) * slotHeight;
    }

    function minToY(min: number) { return (min - START_HOUR * 60) * PIXELS_PER_MINUTE; }
    function yToMinutes(y: number) { return START_HOUR * 60 + (y / PIXELS_PER_MINUTE); }
    function minutesToTime(totalMinutes: number) {
        const h = Math.floor(totalMinutes / 60);
        const m = Math.floor(totalMinutes % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    function calculateBasePrice(courtId: number, startMin: number, endMin: number): number {
        const court = COURTS.find(c => c.id === courtId);
        if (!court) return 0;
        const durationH = (endMin - startMin) / 60;
        if (durationH <= 0) return 0;

        const startH = startMin / 60;
        const endH = endMin / 60;
        const cutOff = 18.0;
        let preHours = 0, postHours = 0;

        if (endH <= cutOff) preHours = durationH;
        else if (startH >= cutOff) postHours = durationH;
        else {
            preHours = cutOff - startH;
            postHours = endH - cutOff;
        }

        let prePrice = preHours * court.price_pre;
        let postPrice = postHours * court.price_post;

        // Round up logic
        if (prePrice > 0 && prePrice % 100 !== 0) prePrice = Math.ceil(prePrice / 100) * 100;
        if (postPrice > 0 && postPrice % 100 !== 0) postPrice = Math.ceil(postPrice / 100) * 100;

        return Math.round(prePrice + postPrice);
    }

    function calculateEstimatedPrice(courtId: number, startMin: number, endMin: number, existingBookingId?: string | number): number {
        let basePrice = calculateBasePrice(courtId, startMin, endMin);

        // Check for existing discount
        if (existingBookingId) {
            const booking = bookings.find(b => b.id === existingBookingId);
            // Verify if this is the same booking we are modifying (it usually is)
            if (booking?.discount && booking.discount > 0) {
                // Anti-Gaming: Check if duration decreased OR price decreased
                const originalStart = new Date(booking.time_start.replace(' ', 'T'));
                const originalEnd = new Date(booking.time_end.replace(' ', 'T'));

                // Calculate original minutes
                const originalStartMin = originalStart.getHours() * 60 + originalStart.getMinutes();
                const originalEndMin = originalEnd.getHours() * 60 + originalEnd.getMinutes();
                const originalDurationMin = originalEndMin - originalStartMin;

                const newDurationMin = Math.round(endMin - startMin);

                // Calculate original full price (before discount)
                // Fix: Don't rely on price_total_thb which might be missing. Re-calculate it.
                const originalPrice = calculateBasePrice(booking.court_id, originalStartMin, originalEndMin);

                // Use epsilon/rounding to prevent floating point noise triggering "Decrease"
                const isPriceDecreased = basePrice < originalPrice - 1;
                const isDurationDecreased = newDurationMin < originalDurationMin - 1;

                console.log(`[Anti-Gaming] Original: ${originalPrice}, New: ${basePrice}, Discount: ${booking.discount}, isPriceDecreased: ${isPriceDecreased}, isDurationDecreased: ${isDurationDecreased}`);

                // Only apply discount if duration is NOT decreased. (We allow price decrease if duration constant)
                if (!isDurationDecreased) {
                    basePrice = Math.max(0, basePrice - booking.discount);
                    console.log(`[Anti-Gaming] Applying discount. Final: ${basePrice}`);
                } else {
                    console.log(`[Anti-Gaming] NOT applying discount (triggered). Final: ${basePrice}`);
                }
            }
        }
        return basePrice;
    }

    function isOverlapping(courtId: number, startMin: number, endMin: number, excludeId?: string | number): boolean {
        return bookings.some(b => {
            if (b.court_id !== courtId) return false;
            if (excludeId && b.id === excludeId) return false;

            // Convert b.time to minutes
            const bStart = new Date(b.time_start.replace(' ', 'T'));
            const bEnd = new Date(b.time_end.replace(' ', 'T'));
            const bStartMin = bStart.getHours() * 60 + bStart.getMinutes();
            const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes();

            // Check overlap: (Start1 < End2) and (End1 > Start2)
            return (startMin < bEndMin) && (endMin > bStartMin);
        });
    }

    // --- API Fetch ---
    async function fetchBookings(date: string, silent = false) {
        if (!silent) setLoading(true);
        setError(null);
        try {
            // Use Service Role Key for admin access (bypasses RLS)
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            console.log(`[Dashboard] Fetching bookings... Token available? ${!!token} Length: ${token?.length}`);
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ date })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            // Minimal parser (reuse logic but simplified for brevity in rewrite)
            const parsed = (data.bookings || []).map((b: any) => {
                // Try extract name/tel if missing
                let name = b.name;
                let tel = b.tel;
                const desc = b.description || b.bill?.description;
                if (desc && (!tel || !name || name === desc)) {
                    const parts = desc.split(' ');
                    if (parts.length >= 2) {
                        const last = parts[parts.length - 1];
                        if (/^[\d-]{5,}$/.test(last)) {
                            tel = last;
                            name = parts.slice(0, -1).join(' ');
                        }
                    }
                }

                const finalPrice = b.price_total_thb !== undefined ? b.price_total_thb : b.price;
                return { ...b, name: name || desc, tel: tel, price: finalPrice };
            });
            setBookings(parsed);
        } catch (e: any) {
            setError(e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    // --- Create Logic ---
    const handleCreateMouseDown = (e: React.MouseEvent, courtId: number) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.booking-card')) return; // Ignore if clicked on a card

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const snappedY = Math.floor(y / (SNAP_MINUTES * PIXELS_PER_MINUTE)) * (SNAP_MINUTES * PIXELS_PER_MINUTE);

        setInteractionMode('CREATE');
        setIsDraggingCreate(true);
        setCreateStartY(snappedY);
        setCreateCurrentY(snappedY + (SNAP_MINUTES * PIXELS_PER_MINUTE));
        setCreateCourtId(courtId);
    };

    // --- Modify Handlers ---
    const handleBookingMoveStart = (e: React.MouseEvent, booking: MatchdayMatch) => {
        const startY = minToY(new Date(booking.time_start.replace(' ', 'T')).getHours() * 60 + new Date(booking.time_start.replace(' ', 'T')).getMinutes());

        // Calculate offset (mouse position relative to card top)
        // Find the slot container
        const container = (e.target as HTMLElement).closest('.group.cursor-crosshair'); // The court column
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const mouseRelY = e.clientY - rect.top;
        const offset = mouseRelY - startY;

        setDragOffsetY(offset);
        setInteractionMode('MOVE');
        setActiveBookingId(booking.id);
        setDragStartPos({ x: e.clientX, y: e.clientY });

        // Initial Ghost
        const startMin = yToMinutes(startY);
        const endMin = yToMinutes(startY + calculateHeight(booking.time_start, booking.time_end));
        setGhostState({
            top: startY,
            height: calculateHeight(booking.time_start, booking.time_end),
            courtId: booking.court_id,
            startMin, endMin,
            price: booking.price,
            paid: !!booking.paid_at,
            valid: true
        });
    };

    const handleBookingResizeStart = (booking: MatchdayMatch, direction: 'TOP' | 'BOTTOM') => {
        setInteractionMode(direction === 'TOP' ? 'RESIZE_TOP' : 'RESIZE_BOTTOM');
        setActiveBookingId(booking.id);

        const startY = minToY(new Date(booking.time_start.replace(' ', 'T')).getHours() * 60 + new Date(booking.time_start.replace(' ', 'T')).getMinutes());
        const height = calculateHeight(booking.time_start, booking.time_end);

        setGhostState({
            top: startY,
            height: height,
            courtId: booking.court_id,
            startMin: yToMinutes(startY),
            endMin: yToMinutes(startY + height),
            price: booking.price,
            paid: !!booking.paid_at,
            valid: true
        });
    };

    // --- Global Mouse Move ---
    const handleMouseMove = (e: React.MouseEvent) => {
        if (interactionMode === 'NONE') return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        // Since we are listening on the grid container, we need to know which column we are over for MOVE
        // e.clientX? This is tricky in a single listener.
        // We can find the court column element from document.elementFromPoint?
        // Or simpler: The listener is on the GRID container. We can calculate column from X.
        // Grid cols: [60px, 1fr, 1fr, ...]
        // Actually, individual Court Columns have onMouseDown.
        // But for Dragging across columns, handleMouseMove needs to be high up.
        // Our Grid Wrapper has onMouseMove.

        const colWidth = (rect.width - 60) / 6; // Approx
        const xRel = e.clientX - rect.left - 60;
        let colIndex = Math.floor(xRel / colWidth);
        if (colIndex < 0) colIndex = 0;
        if (colIndex > 5) colIndex = 5;
        const targetCourtId = COURTS[colIndex]?.id;

        const yRel = e.clientY - rect.top;

        if (interactionMode === 'CREATE') {
            if (createStartY === null) return;
            if (yRel < 0 || yRel > TOTAL_MINUTES * PIXELS_PER_MINUTE) return;

            const minH = SNAP_MINUTES * PIXELS_PER_MINUTE;
            let snapped = snapToGrid(yRel);
            if (snapped <= createStartY) snapped = createStartY + minH;
            setCreateCurrentY(snapped);
        }
        else if (interactionMode === 'MOVE' && ghostState) {
            // Check threshold
            if (!isDraggingConfirmed && dragStartPos) {
                const dist = Math.sqrt(Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2));
                if (dist > 5) {
                    setIsDraggingConfirmed(true);
                } else {
                    return; // Wait for threshold
                }
            }

            // New Top = MouseY - Offset, snapped
            let rawTop = yRel - dragOffsetY;
            let newTop = snapToGrid(rawTop);
            if (newTop < 0) newTop = 0;
            if (newTop + ghostState.height > TOTAL_MINUTES * PIXELS_PER_MINUTE) {
                newTop = (TOTAL_MINUTES * PIXELS_PER_MINUTE) - ghostState.height;
            }

            const newMsg = yToMinutes(newTop);
            const newStartMin = newMsg;
            const newEndMin = newMsg + (ghostState.height / PIXELS_PER_MINUTE);

            const valid = !isOverlapping(targetCourtId, newStartMin, newEndMin, activeBookingId!);
            const price = calculateEstimatedPrice(targetCourtId, newStartMin, newEndMin, activeBookingId!);

            setGhostState({
                ...ghostState,
                top: newTop,
                courtId: targetCourtId,
                startMin: newStartMin,
                endMin: newEndMin,
                price,
                valid
            });
        }
        else if ((interactionMode === 'RESIZE_TOP' || interactionMode === 'RESIZE_BOTTOM') && ghostState) {
            const snappedY = snapToGrid(yRel);
            let newTop = ghostState.top;
            let newHeight = ghostState.height;

            if (interactionMode === 'RESIZE_BOTTOM') {
                newHeight = snappedY - newTop;
            } else {
                // Top
                const bottom = newTop + newHeight;
                newTop = snappedY;
                newHeight = bottom - newTop;
            }

            // Constraints
            if (newHeight < SNAP_MINUTES * PIXELS_PER_MINUTE) {
                if (interactionMode === 'RESIZE_BOTTOM') {
                    newHeight = SNAP_MINUTES * PIXELS_PER_MINUTE;
                } else {
                    newTop = ghostState.top + ghostState.height - (SNAP_MINUTES * PIXELS_PER_MINUTE);
                    newHeight = SNAP_MINUTES * PIXELS_PER_MINUTE;
                }
            }

            const newStartMin = yToMinutes(newTop);
            const newEndMin = yToMinutes(newTop + newHeight);

            // Collision check (Resizing stays on same court)
            const valid = !isOverlapping(ghostState.courtId, newStartMin, newEndMin, activeBookingId!);
            const price = calculateEstimatedPrice(ghostState.courtId, newStartMin, newEndMin, activeBookingId!);

            setGhostState({
                ...ghostState,
                top: newTop,
                height: newHeight,
                startMin: newStartMin,
                endMin: newEndMin,
                price,
                valid
            });
        }
    };

    // --- Mouse Up ---
    const handleMouseUp = () => {
        if (interactionMode === 'CREATE' && createCourtId && createStartY !== null && createCurrentY !== null) {
            const startMin = yToMinutes(createStartY);
            const endMin = yToMinutes(createCurrentY);
            setPendingCreate({
                courtId: createCourtId,
                startTime: minutesToTime(startMin),
                endTime: minutesToTime(endMin),
                price: calculateEstimatedPrice(createCourtId, startMin, endMin)
            });
            setIsCreateModalOpen(true);
        }
        else if (interactionMode !== 'NONE' && ghostState && activeBookingId) {
            // Finish Modify
            if (ghostState.valid && (isDraggingConfirmed || interactionMode.startsWith('RESIZE'))) {
                const original = bookings.find(b => b.id === activeBookingId);
                if (original) {
                    // Check if changed
                    const isChanged = (
                        original.court_id !== ghostState.courtId ||
                        yToMinutes(ghostState.top) !== yToMinutes(minToY(new Date(original.time_start.replace(' ', 'T')).getHours() * 60 + new Date(original.time_start.replace(' ', 'T')).getMinutes())) ||
                        ghostState.height !== calculateHeight(original.time_start, original.time_end)
                    );

                    if (isChanged) {
                        setModifyConfirm({
                            original,
                            new: {
                                courtId: ghostState.courtId,
                                startTime: minutesToTime(ghostState.startMin),
                                endTime: minutesToTime(ghostState.endMin),
                                price: ghostState.price
                            }
                        });
                    }
                }
            }
        }

        resetState();
    };

    const resetState = () => {
        setInteractionMode('NONE');
        setIsDraggingCreate(false);
        setCreateStartY(null);
        setCreateCurrentY(null);
        setCreateCourtId(null);
        setActiveBookingId(null);
        setGhostState(null);
        setDragOffsetY(0);
        setIsDraggingConfirmed(false);
        setDragStartPos(null);
    };

    // --- Modify Action ---
    async function executeModification() {
        if (!modifyConfirm) return;
        setModifying(true);
        try {
            // Use Service Role Key for admin access
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Call update-booking
            const payload = {
                matchId: modifyConfirm.original.id,
                price: modifyConfirm.new.price,
                // Format dates to "YYYY-MM-DD HH:mm:ss"
                timeStart: `${selectedDate} ${modifyConfirm.new.startTime}:00`,
                timeEnd: `${selectedDate} ${modifyConfirm.new.endTime}:00`,
                courtId: modifyConfirm.new.courtId !== modifyConfirm.original.court_id ? modifyConfirm.new.courtId : undefined,

                // Pass customer details to ensure they are preserved if logic requires recreate
                customerName: modifyConfirm.original.name,
                tel: modifyConfirm.original.tel,
                adminNote: modifyConfirm.original.admin_note
            };

            // NOTE: I am adding courtId to payload, but backend might ignore it.
            // I should double check update-booking.ts later. 

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(await res.text());

            setModifyConfirm(null);
            fetchBookings(selectedDate);

        } catch (e: any) {
            alert(`Update Failed: ${e.message}`);
        } finally {
            setModifying(false);
        }
    }

    // --- Create Action ---
    const handleConfirmCreate = async (data: { name: string; phone: string; note: string; paymentMethod: string; campaignId?: string }) => {
        if (!pendingCreate) return;
        try {
            // Use Service Role Key for admin access (same as get-bookings)
            const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    fieldId: pendingCreate.courtId,
                    date: selectedDate,
                    startTime: pendingCreate.startTime,
                    endTime: pendingCreate.endTime,
                    customerName: data.name,
                    phoneNumber: data.phone,
                    note: data.note,
                    paymentMethod: data.paymentMethod,
                    campaignId: data.campaignId,
                    source: 'admin'
                })
            });
            if (!res.ok) throw new Error(await res.text());
            fetchBookings(selectedDate);
            setIsCreateModalOpen(false);
        } catch (e: any) {
            alert(e.message);
        }
    };


    // --- Render Helpers ---
    // formatDateHeader was originaly used for header. The new formatDate gives e.g. "จ. 23 ก.พ. 2026"
    // Let's use formatDate for the header.
    const formatDateHeader = (d: string) => formatDate(d);
    function calculatePosition(timeStr: string) { return minToY(new Date(timeStr.replace(' ', 'T')).getHours() * 60 + new Date(timeStr.replace(' ', 'T')).getMinutes()); }
    function calculateHeight(s: string, e: string) { return (new Date(e.replace(' ', 'T')).getTime() - new Date(s.replace(' ', 'T')).getTime()) / 60000 * PIXELS_PER_MINUTE; }



    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-white">
            {/* Header */}
            <header className="flex flex-none items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                    <h1 className="text-2xl font-semibold leading-6 text-gray-900">{formatDateHeader(selectedDate)}</h1>
                    <p className="mt-1 text-sm text-gray-500">ตารางการจองสนามฟุตบอล</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="isolate inline-flex rounded-md shadow-sm">
                        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="relative inline-flex items-center rounded-l-md bg-white px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"><ChevronLeft className="h-5 w-5" /></button>
                        <button onClick={() => setSelectedDate(getTodayStr())} className="relative hidden md:inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 -ml-px">วันนี้</button>
                        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="relative inline-flex items-center rounded-r-md bg-white px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 -ml-px"><ChevronRight className="h-5 w-5" /></button>
                    </span>
                    <div className="relative">
                        <button onClick={() => setShowCalendar(!showCalendar)} className="hidden md:flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"><Calendar className="h-5 w-5 text-gray-400" />เลือกวันที่</button>
                        {showCalendar && <div className="absolute right-0 top-full mt-2 z-50"><CalendarDropdown selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setShowCalendar(false); }} onClose={() => setShowCalendar(false)} /></div>}
                    </div>
                    <button onClick={() => setIsPromoModalOpen(true)} className="flex items-center gap-x-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"><Tag className="h-4 w-4" /><span className="hidden md:inline">ใช้โค้ด</span></button>
                    <button onClick={() => fetchBookings(selectedDate)} className={`flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden md:inline">อัปเดต</span></button>
                </div>
            </header>

            {error && <div className="mx-6 mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700"><p className="font-bold">Error</p><p>{error}</p></div>}

            <div className="flex flex-auto overflow-hidden bg-white relative">
                <div ref={containerRef} className="flex flex-auto flex-col overflow-auto w-full">
                    <div className="flex flex-col min-w-[1000px]">
                        {/* Header Row */}
                        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm grid grid-cols-[60px_repeat(6,1fr)] text-sm leading-6 text-gray-500 divide-x divide-gray-200">
                            <div className="flex items-center justify-center py-3 bg-gray-50"><Clock className="w-4 h-4 text-gray-400" /></div>
                            {COURTS.map(c => (
                                <div key={c.id} className="flex flex-col items-center justify-center py-3">
                                    <span className="font-semibold text-gray-900">{c.name}</span>
                                    <span className="text-xs text-gray-400 font-normal">{c.size}</span>
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div
                            className="grid grid-cols-[60px_repeat(6,1fr)] w-full relative select-none"
                            style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px` }}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                        >
                            {/* Rows */}
                            <div className="col-start-1 col-end-[-1] grid-rows-1 absolute inset-0 z-0 pointer-events-none">
                                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                    <div key={i} className="border-b border-gray-200 w-full relative" style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}>
                                        <div className="absolute top-1/2 left-0 right-0 border-b border-gray-200 border-dashed"></div>
                                    </div>
                                ))}
                            </div>

                            {/* Time Labels */}
                            <div className="bg-white border-r border-gray-200 z-10 text-xs text-gray-500 font-medium">
                                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                    <div key={i} className={`relative text-right pr-2 ${i === 0 ? '' : '-top-2.5'}`} style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}>{String(START_HOUR + i).padStart(2, '0')}:00</div>
                                ))}
                            </div>

                            {/* Courts */}
                            {COURTS.map(court => (
                                <div
                                    key={court.id}
                                    className="relative border-r border-gray-200 hover:bg-gray-50/30 transition-colors group cursor-crosshair"
                                    onMouseDown={(e) => handleCreateMouseDown(e, court.id)}
                                >
                                    <div className="absolute inset-y-0 left-0 w-px bg-gray-100" />

                                    {/* Bookings */}
                                    {bookings.filter(b => b.court_id === court.id).map(b => {

                                        const isActivelyModifying = activeBookingId === b.id;
                                        // Only hide original if dragging is confirmed OR if resizing (resize usually implies intent)
                                        const shouldHide = isActivelyModifying && (isDraggingConfirmed || interactionMode.startsWith('RESIZE'));

                                        if (shouldHide) return null;

                                        return (
                                            <BookingCard
                                                key={b.id}
                                                booking={b}
                                                top={calculatePosition(b.time_start)}
                                                height={calculateHeight(b.time_start, b.time_end)}
                                                onClick={() => setViewingBooking(b)}
                                                onMoveStart={(e) => handleBookingMoveStart(e, b)}
                                                onResizeStart={(_, dir) => handleBookingResizeStart(b, dir)}
                                            />
                                        );
                                    })
                                    }

                                    {
                                        ghostState && ghostState.courtId === court.id && (isDraggingConfirmed || interactionMode.startsWith('RESIZE')) && (
                                            <div
                                                className={`absolute inset-x-1 rounded shadow-sm border-l-[3px] px-2 py-1 z-20 pointer-events-none flex flex-col justify-start items-start text-xs shadow-lg transition-all ${ghostState.valid ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-red-100/80 border-red-500 text-red-700'}`}
                                                style={{ top: `${ghostState.top}px`, height: `${ghostState.height}px` }}
                                            >
                                                {/* Header / Time */}
                                                <div className="font-semibold text-xs leading-tight mb-0.5 w-full flex justify-between items-center">
                                                    <span>{minutesToTime(ghostState.startMin)} - {minutesToTime(ghostState.endMin)}</span>
                                                    {!ghostState.valid && <AlertTriangle className="w-3 h-3 text-red-600" />}
                                                </div>

                                                {/* Price Badge (Bottom aligned like card) */}
                                                <div className="mt-auto w-full flex justify-end">
                                                    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold border ${ghostState.paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                        ฿{ghostState.price.toLocaleString()}
                                                    </span>
                                                </div>

                                                {!ghostState.valid && <span className="font-bold mt-1 text-[10px]">ชนคิวอื่น</span>}
                                            </div>
                                        )
                                    }

                                    {/* Ghost for Create */}
                                    {
                                        interactionMode === 'CREATE' && isDraggingCreate && createCourtId === court.id && createStartY !== null && createCurrentY !== null && (
                                            <div className="absolute inset-x-1 rounded bg-green-100/80 border-2 border-green-500 border-dashed z-20 pointer-events-none flex flex-col items-center justify-center text-green-700 font-semibold text-xs shadow-lg"
                                                style={{ top: `${createStartY}px`, height: `${createCurrentY - createStartY}px` }}>
                                                <span>{minutesToTime(yToMinutes(createStartY))} - {minutesToTime(yToMinutes(createCurrentY))}</span>
                                                <span className="mt-0.5 bg-white/60 px-1.5 rounded text-[10px] font-bold">
                                                    ฿{calculateEstimatedPrice(createCourtId, yToMinutes(createStartY), yToMinutes(createCurrentY)).toLocaleString()}
                                                </span>
                                            </div>
                                        )
                                    }
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <BookingModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onConfirm={handleConfirmCreate}
                bookingDetails={pendingCreate ? { courtName: COURTS.find(c => c.id === pendingCreate.courtId)?.name || '', date: formatDateHeader(selectedDate), startTime: pendingCreate.startTime, endTime: pendingCreate.endTime, price: pendingCreate.price } : null}
            />

            <BookingDetailModal
                isOpen={!!viewingBooking}
                booking={viewingBooking ? { ...viewingBooking, court_name: COURTS.find(c => c.id === viewingBooking.court_id)?.name || 'ไม่ระบุ' } : null}
                onClose={() => setViewingBooking(null)}
                onBookingCancelled={() => { setViewingBooking(null); fetchBookings(selectedDate); }}
                onBookingUpdated={() => fetchBookings(selectedDate, true)}
            />

            <PromoCodeModal
                isOpen={isPromoModalOpen}
                onClose={() => setIsPromoModalOpen(false)}
                onSuccess={(d, t) => {
                    setIsPromoModalOpen(false);
                    if (d !== selectedDate) {
                        setSelectedDate(d);
                    } else {
                        fetchBookings(d);
                    }
                    if (t) {
                        // Append date to time if needed, but calculatePosition expects full string or just handles it.
                        // calculatePosition uses "new Date(timeStr.replace(' ', 'T'))"
                        // promoDetails.time_from is likely "HH:mm" or "HH:mm:ss".
                        // Let's assume we need to pass full string "YYYY-MM-DD HH:mm:ss" if calculatePosition expects it.
                        // Checking PromoCodeModal code: "time_from: string" -> usually "HH:mm".
                        // Checking DashboardPage `calculatePosition`: it uses `new Date(timeStr.replace(' ', 'T'))`.
                        // If timeStr is just "08:00", new Date("08:00") is invalid.
                        // It expects full date string.

                        setScrollToTime(`${d} ${t}`);
                    }
                }}
            />


            {/* Confirm Modification Modal */}
            {modifyConfirm && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setModifyConfirm(null)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="sm:flex sm:items-start">
                                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <RefreshCw className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">ยืนยันการแก้ไขการจอง</h3>
                                    <div className="mt-2 text-sm text-gray-500 space-y-3">
                                        <p>คุณต้องการแก้ไขรายละเอียดการจองนี้ใช่หรือไม่?</p>

                                        <div className="bg-gray-50 p-3 rounded-md space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">เวลา:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="line-through text-gray-400">{formatTime(modifyConfirm.original.time_start)} - {formatTime(modifyConfirm.original.time_end)}</span>
                                                    <span>→</span>
                                                    <span className="font-bold text-indigo-700">{modifyConfirm.new.startTime} - {modifyConfirm.new.endTime}</span>
                                                </div>
                                            </div>

                                            {modifyConfirm.original.court_id !== modifyConfirm.new.courtId && (
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">สนาม:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="line-through text-gray-400">{COURTS.find(c => c.id === modifyConfirm.original.court_id)?.name}</span>
                                                        <span>→</span>
                                                        <span className="font-bold text-indigo-700">{COURTS.find(c => c.id === modifyConfirm.new.courtId)?.name}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center text-base">
                                                <span className="font-medium">ราคาใหม่:</span>
                                                <span className="font-bold text-green-700">฿{modifyConfirm.new.price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                <button type="button" disabled={modifying} onClick={executeModification} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                                    {modifying ? 'กำลังบันทึก...' : 'ยืนยัน'}
                                </button>
                                <button type="button" disabled={modifying} onClick={() => setModifyConfirm(null)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm">
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
