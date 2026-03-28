const fs = require('fs');
const FILE_PATH = 'C:\\Users\\Tmango\\Desktop\\ระบบจองสนาม\\GAS\\matchday_history_2020_2025.json';
const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
let out = [];
for(const record of data) {
    const strRaw = JSON.stringify(record).toLowerCase();
    if (strRaw.includes('tmg') || strRaw.includes('mango')) {
        out.push(record);
        if(out.length >= 2) break;
    }
}
fs.writeFileSync('C:\\Users\\Tmango\\Desktop\\ระบบจองสนาม\\GAS\\tmp_tmg_records.json', JSON.stringify(out, null, 2));
console.log('Saved to GAS/tmp_tmg_records.json');
