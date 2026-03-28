const fs = require('fs');
const FILE_PATH = 'C:\\Users\\Tmango\\Desktop\\ระบบจองสนาม\\GAS\\matchday_history_2020_2025.json';

try {
  const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  
  const keywords = ['tmg', 'mango'];
  
  let tmgBookings = [];
  
  for(const record of data) {
      const strRaw = JSON.stringify(record).toLowerCase();
      if (keywords.some(kw => strRaw.includes(kw))) {
          tmgBookings.push(record);
      }
  }

  // หาวันที่ของแต่ละอัน
  const dateObjs = tmgBookings.map(b => {
      // API น่าจะใช้ time_start หรือ date
      const d = b.time_start || b.date;
      return { dateStr: d, raw: b };
  }).filter(x => x.dateStr);

  // เรียงลำดับตามวันที่จากเก่าไปใหม่
  dateObjs.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

  if (dateObjs.length > 0) {
      const first = dateObjs[0];
      const last = dateObjs[dateObjs.length - 1];
      
      console.log(`\nFound ${dateObjs.length} TMG bookings with dates.`);
      console.log(`\n--- First TMG booking ---`);
      console.log(`Date: ${first.dateStr}`);
      console.log(`Customer: ${first.raw.customer_name || first.raw.name}`);
      console.log(`Phone: ${first.raw.tel || first.raw.phone}`);
      console.log(`Note: ${first.raw.note || first.raw.remark}`);

      console.log(`\n--- Last TMG booking ---`);
      console.log(`Date: ${last.dateStr}`);
      
      // หาการกระจายตัว (Distribution per month)
      const monthly = {};
      dateObjs.forEach(o => {
          const monthKey = o.dateStr.substring(0, 7); // YYYY-MM
          monthly[monthKey] = (monthly[monthKey] || 0) + 1;
      });
      console.log(`\n--- Monthly Breakdown ---`);
      Object.keys(monthly).sort().forEach(k => {
          console.log(`${k} : ${monthly[k]} bookings`);
      });

  } else {
      console.log("No TMG bookings found with valid dates.");
  }

} catch(e) {
  console.error("Error:", e.message);
}
