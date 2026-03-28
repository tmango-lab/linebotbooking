const fs = require('fs');
const FILE_PATH = 'C:\\Users\\Tmango\\Desktop\\ระบบจองสนาม\\GAS\\matchday_history_2020_2025.json';

try {
  const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  
  const keywords = ['tmg', 'mango'];
  
  let tmgBookings = [];
  
  for(const record of data) {
      const strRaw = JSON.stringify(record).toLowerCase();
      if (keywords.some(kw => strRaw.includes(kw))) {
          // หาหน่อยว่าคำว่า tmg มันไปซ่อนอยู่ตรง attribute ไหนกันแน่
          let foundIn = [];
          Object.keys(record).forEach(k => {
             if(record[k] && String(record[k]).toLowerCase().includes('tmg')) {
                 foundIn.push(`${k}=${record[k]}`);
             }
             if(record[k] && String(record[k]).toLowerCase().includes('mango')) {
                 foundIn.push(`${k}=${record[k]}`);
             }
          });
          
          record._match_reason = foundIn.join(' | ');
          tmgBookings.push(record);
      }
  }

  // หาวันที่ของแต่ละอัน
  const dateObjs = tmgBookings.map(b => {
      const d = b.time_start || b.date;
      return { dateStr: d, raw: b };
  }).filter(x => x.dateStr);

  dateObjs.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

  console.log(`\n--- FIRST 5 TMG RECORDS ---`);
  dateObjs.slice(0, 5).forEach((o, i) => {
      console.log(`\nRecord ${i+1} (${o.dateStr}):`);
      console.log(`Cust: ${o.raw.customer_name || o.raw.name}`);
      console.log(`Match Reason: ${o.raw._match_reason}`);
  });
  
  console.log(`\n--- RECORDS AROUND LATE 2025 (NOV-DEC) ---`);
  const late2025 = dateObjs.filter(o => o.dateStr.includes('2025-11') || o.dateStr.includes('2025-12'));
  late2025.slice(0, 3).forEach((o, i) => {
      console.log(`\nLate 2025 Record ${i+1} (${o.dateStr}):`);
      console.log(`Cust: ${o.raw.customer_name || o.raw.name}`);
      console.log(`Match Reason: ${o.raw._match_reason}`);
  });

} catch(e) {
  console.error("Error:", e.message);
}
