const fs = require('fs');

const FILE_PATH = 'C:\\Users\\Tmango\\Desktop\\ระบบจองสนาม\\GAS\\matchday_history_2020_2025.json';

try {
  console.log("Loading data...");
  const jsonStr = fs.readFileSync(FILE_PATH, 'utf8');
  const data = JSON.parse(jsonStr);
  console.log(`Total Bookings in File: ${data.length}`);

  if (data.length === 0) {
      console.log("No data found to analyze.");
      process.exit(0);
  }

  // ดูโครงสร้างคีย์
  console.log("\n--- Data Keys Available ---");
  const keys = Object.keys(data[0]);
  console.log(keys.join(', '));

  // วิเคราะห์หา TEST / BOT
  const testKeywords = ['test', 'เทส', 'bot', 'บอท', 'tmg', 'mango', 'ทดสอบ', 'ระบบ', 'tmg_sys', 'api', 'linebot'];
  
  let potentialTests = [];
  let phoneSet = new Set();
  
  for(const record of data) {
      // ตรวจสอบจาก text ทั้งหมดใน record ดิบๆ
      const strRaw = JSON.stringify(record).toLowerCase();
      
      const isTest = testKeywords.some(kw => strRaw.includes(kw));
      // หรือโทรศัพท์ที่เป็น 0800000000
      const isFakePhone = strRaw.includes('0800000000') || strRaw.includes('0000000000') || strRaw.includes('12345678');
      
      if (isTest || isFakePhone) {
          potentialTests.push(record);
      }
  }

  console.log(`\n--- Test/Bot Analysis ---`);
  console.log(`Found ${potentialTests.length} potential test/bot bookings.`);
  
  // คัดกรองตัวอย่างบางอันให้ดูว่ามีคำว่าอะไรในนั้นบ้าง
  if (potentialTests.length > 0) {
    console.log("\n--- Sample Test Bookings (First 5) ---");
    potentialTests.slice(0, 5).forEach((b, idx) => {
       const summary = {
          date: b.time_start || b.date_start,
          customer: b.customer_name || b.name || b.title,
          phone: b.customer_phone || b.phone || b.tel,
          note: b.note || b.description || b.remark,
          source: b.source || b.channel
       };
       console.log(`${idx + 1}.`, JSON.stringify(summary));
    });

    // Group by keywords
    console.log("\n--- Breakdown grouping (rough estimation) ---");
    testKeywords.forEach(kw => {
       const count = potentialTests.filter(b => JSON.stringify(b).toLowerCase().includes(kw)).length;
       if(count > 0) console.log(`Keywords "${kw}": ${count} records`);
    });
  }

} catch(e) {
  console.error("Error analyzing:", e.message);
}
