const booking = { start: 930, end: 990 }; // 15:30 - 16:30
const search = { start: 870, duration: 90 }; // 14:30, 90 mins -> End 960 (16:00)

const end = search.start + search.duration;

console.log(`Booking: ${booking.start}-${booking.end}`);
console.log(`Search: ${search.start}-${end}`);

const cond1 = search.start < booking.end;
const cond2 = end > booking.start;

console.log(`Start < Booking End (${search.start} < ${booking.end}): ${cond1}`);
console.log(`End > Booking Start (${end} > ${booking.start}): ${cond2}`);

const isConflict = cond1 && cond2;
console.log(`Conflict: ${isConflict}`);
