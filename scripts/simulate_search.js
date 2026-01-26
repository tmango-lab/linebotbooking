const bookings = [
    { start: 600, end: 660 }, // 10:00-11:00
    { start: 750, end: 810 }, // 12:30-13:30
    { start: 930, end: 990 }  // 15:30-16:30
];

const openTime = 480; // 08:00
const closeTime = 1440; // 24:00
const step = 60;

function minuteToTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function check(duration) {
    console.log(`\n--- Duration ${duration / 60} Hours (${duration} min) ---`);
    for (let start = openTime; start + duration <= closeTime; start += step) {
        const end = start + duration;
        let conflictInfo = "";
        const isConflict = bookings.some(b => {
            // start < b.end && end > b.start
            const conflict = start < b.end && end > b.start;
            if (conflict) {
                conflictInfo = `(Hits ${minuteToTime(b.start)}-${minuteToTime(b.end)})`;
            }
            return conflict;
        });

        const status = isConflict ? `❌ ไม่ว่าง ${conflictInfo}` : "✅ ว่าง";
        console.log(`${minuteToTime(start)} - ${minuteToTime(end)} : ${status}`);
    }
}

check(60);
check(90);
check(120);
