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

function isConflict(start, duration) {
    const end = start + duration;
    return bookings.some(b => start < b.end && end > b.start);
}

function runFixedSearch(duration) {
    const results = [];
    for (let start = openTime; start + duration <= closeTime; start += step) {
        if (!isConflict(start, duration)) {
            results.push(`${minuteToTime(start)} - ${minuteToTime(start + duration)}`);
        }
    }
    return results;
}

function runSmartSearch(duration) {
    const results = [];
    const usedStarts = new Set();

    // 1. Standard hourly check
    for (let start = openTime; start + duration <= closeTime; start += step) {
        if (!isConflict(start, duration)) {
            if (!usedStarts.has(start)) {
                results.push(`${minuteToTime(start)} - ${minuteToTime(start + duration)}`);
                usedStarts.add(start);
            }
        }
    }

    // 2. Gap filling check (start immediately after previous booking ends)
    bookings.forEach(b => {
        const start = b.end;
        if (start >= openTime && start + duration <= closeTime) {
            if (!isConflict(start, duration)) {
                if (!usedStarts.has(start)) {
                    // Insert in correct order? For simulation, we'll just sort later or push
                    results.push(`${minuteToTime(start)} - ${minuteToTime(start + duration)} (⭐ Gap Fill)`);
                    usedStarts.add(start);
                }
            }
        }
    });

    return results.sort();
}

console.log("=== Scenario: Bookings at 10:00-11:00, 12:30-13:30, 15:30-16:30 ===\n");

[60, 90, 120].forEach(duration => {
    console.log(`\n### Duration: ${duration / 60} Hours (${duration} mins) ###`);

    console.log(`[Fixed (Current)]`);
    const fixed = runFixedSearch(duration);
    if (fixed.length === 0) console.log("  - No slots found");
    else fixed.forEach(s => console.log(`  - ${s}`));

    console.log(`\n[Smart (Proposed)]`);
    const smart = runSmartSearch(duration);
    if (smart.length === 0) console.log("  - No slots found");
    else smart.forEach(s => console.log(`  - ${s}`));
});
