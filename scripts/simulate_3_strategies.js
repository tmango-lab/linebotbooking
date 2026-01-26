const bookings = [
    { start: 600, end: 660 }, // 10:00-11:00
    { start: 750, end: 810 }, // 12:30-13:30
    { start: 930, end: 990 }  // 15:30-16:30
];

const openTime = 480; // 08:00
const closeTime = 1440; // 24:00

function minuteToTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isConflict(start, duration) {
    const end = start + duration;
    return bookings.some(b => start < b.end && end > b.start);
}

// 1. Fixed Hourly (Original)
function runFixedHourly(duration) {
    const results = [];
    const step = 60;
    for (let start = openTime; start + duration <= closeTime; start += step) {
        if (!isConflict(start, duration)) results.push(start);
    }
    return results.sort((a, b) => a - b).map(s => `${minuteToTime(s)} - ${minuteToTime(s + duration)}`);
}

// 2. Smart Gap Filling (Current)
function runSmartGap(duration) {
    const results = new Set();
    const step = 60;

    // Hourly
    for (let start = openTime; start + duration <= closeTime; start += step) {
        if (!isConflict(start, duration)) results.add(start);
    }

    // Gaps
    bookings.forEach(b => {
        const start = b.end;
        if (start >= openTime && start + duration <= closeTime) {
            if (!isConflict(start, duration)) results.add(start);
        }
    });

    return Array.from(results).sort((a, b) => a - b).map(s => `${minuteToTime(s)} - ${minuteToTime(s + duration)}`);
}

// 3. 30-Minute Grid (Proposed)
function run30MinGrid(duration) {
    const results = [];
    const step = 30; // Check every 30 mins
    for (let start = openTime; start + duration <= closeTime; start += step) {
        if (!isConflict(start, duration)) results.push(start);
    }
    return results.sort((a, b) => a - b).map(s => `${minuteToTime(s)} - ${minuteToTime(s + duration)}`);
}

console.log("=== Scenario: Bookings at 10:00-11:00, 12:30-13:30, 15:30-16:30 ===\n");

[120].forEach(duration => {
    console.log(`\n### Duration: ${duration} mins (${duration / 60} Hours) ###`);

    const fixed = runFixedHourly(duration);
    const gap = runSmartGap(duration);
    const grid30 = run30MinGrid(duration);

    // Format as table-like output
    const maxLen = Math.max(fixed.length, gap.length, grid30.length);
    console.log(`| ${"Hourly (Old)".padEnd(15)} | ${"Gap Fill (Now)".padEnd(18)} | ${"30-Min Grid (New)".padEnd(18)} |`);
    console.log(`|${"-".repeat(17)}|${"-".repeat(20)}|${"-".repeat(20)}|`);

    for (let i = 0; i < maxLen; i++) {
        const f = fixed[i] || "";
        const g = gap[i] || "";
        const n = grid30[i] || "";

        let gMark = "";
        let nMark = "";

        // Highlight unique finds
        if (g && !fixed.includes(g)) gMark = "⭐";
        if (n && !fixed.includes(n) && !gap.includes(n)) nMark = "🔥"; // Exclusive to 30-min
        if (n && !fixed.includes(n) && gap.includes(n)) nMark = "⭐";  // Same as Gap

        console.log(`| ${f.padEnd(15)} | ${(g + " " + gMark).padEnd(18)} | ${(n + " " + nMark).padEnd(18)} |`);
    }
});
