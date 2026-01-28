
const dateStr = '2026-01-29';
const timeFrom = '16:00:00';
const invalidString = `${dateStr}T${timeFrom}:00+07:00`;

console.log(`Testing parsing of: "${invalidString}"`);
const d = new Date(invalidString);
console.log('Result:', d.toString());
console.log('Is NaN?', isNaN(d.getTime()));

const validString = `${dateStr}T${timeFrom}+07:00`;
console.log(`Testing parsing of: "${validString}"`);
const d2 = new Date(validString);
console.log('Result:', d2.toString());
