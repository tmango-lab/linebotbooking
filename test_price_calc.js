// Test price calculation for Court 2, 17:30-18:30

const PRICING = {
    2424: { pre: 500, post: 700 },  // Field 1
    2425: { pre: 500, post: 700 },  // Field 2
    2428: { pre: 1000, post: 1200 }, // Field 3
    2426: { pre: 800, post: 1000 },  // Field 4
    2427: { pre: 800, post: 1000 },  // Field 5
    2429: { pre: 1000, post: 1200 }, // Field 6
};

function calculatePrice(fieldId, startTime, durationHours) {
    const prices = PRICING[fieldId];
    if (!prices) return 0;

    const [h, m] = startTime.split(':').map(Number);
    const startH = h + (m / 60);
    const endH = startH + durationHours;
    const cutOff = 18.0;

    let preHours = 0;
    let postHours = 0;

    if (endH <= cutOff) preHours = durationHours;
    else if (startH >= cutOff) postHours = durationHours;
    else {
        preHours = cutOff - startH;
        postHours = endH - cutOff;
    }

    let prePrice = preHours * prices.pre;
    let postPrice = postHours * prices.post;

    console.log('=== Calculation Details ===');
    console.log('Field:', fieldId);
    console.log('Start Time:', startTime);
    console.log('Start Hour:', startH);
    console.log('End Hour:', endH);
    console.log('Duration:', durationHours);
    console.log('Pre-18:00 Hours:', preHours);
    console.log('Post-18:00 Hours:', postHours);
    console.log('Pre Price (before rounding):', prePrice);
    console.log('Post Price (before rounding):', postPrice);

    // Apply Rounding Rule: Both Pre and Post prices round UP to nearest 100
    if (prePrice > 0 && prePrice % 100 !== 0) {
        prePrice = Math.ceil(prePrice / 100) * 100;
    }
    if (postPrice > 0 && postPrice % 100 !== 0) {
        postPrice = Math.ceil(postPrice / 100) * 100;
    }

    console.log('Pre Price (after rounding):', prePrice);
    console.log('Post Price (after rounding):', postPrice);
    console.log('Total:', Math.round(prePrice + postPrice));
    console.log('===========================\n');

    return Math.round(prePrice + postPrice);
}

// Test Case: Court 2, 17:30-18:30
console.log('Test: Court 2, 17:31-18:30');
const result = calculatePrice(2425, '17:31', 1);
console.log('RESULT:', result, 'baht');
console.log('EXPECTED: 700 baht');
console.log('MATCH:', result === 700 ? '✅ PASS' : '❌ FAIL');
