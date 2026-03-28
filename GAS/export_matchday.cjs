const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// การตั้งค่าหลัก
// ============================================================================
const MATCHDAY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJkYXRhIjp7InJvbGUiOiJzdGFmZiIsImxhbmciOiJ0aCIsImxldmVsIjo0LCJpZCI6MjY4LCJlbWFpbCI6bnVsbH0sImlhdCI6MTc2MjEzODE0Nywic3ViIjoiQXJlbmEifQ.zFKiL36PXxJVjSC6JdYSnyUMsGjo4uH8vYXU01X6QSM";
const ENDPOINT_HOST = 'arena.matchday-backend.com';
const ENDPOINT_PATH = '/arena/matches';

// เปลี่ยนกลับมาเป็นความต้องการเดิม: ดึงทั้งหมดยาวๆ ตั้งแต่ต้นปี 2020 - สิ้นปี 2025
const START_YEAR = 2020;
const START_MONTH = 1;
const END_YEAR = 2025;
const END_MONTH = 12;

const OUTPUT_FILE = path.join(__dirname, 'matchday_history_2020_2025.json');
const CSV_FILE = path.join(__dirname, 'matchday_history_2020_2025.csv');
// ============================================================================

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  val = String(val).replace(/"/g, '""');
  return `"${val}"`;
}

function jsonToCsv(items) {
  if (!items || items.length === 0) return '';
  const headerSet = new Set();
  items.forEach(obj => Object.keys(obj).forEach(k => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const rows = items.map(obj => {
    return headers.map(header => escapeCsv(obj[header])).join(',');
  });

  return headers.join(',') + '\n' + rows.join('\n');
}

function fetchMonth(year, month) {
  return new Promise((resolve) => {
    const lastDay = new Date(year, month, 0).getDate();
    const startStr = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

    const payloadObj = {
      time_start: startStr,
      time_end: endStr
    };
    
    const payloadStr = JSON.stringify(payloadObj);

    const options = {
      hostname: ENDPOINT_HOST,
      path: ENDPOINT_PATH,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MATCHDAY_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://arena.matchday.co.th',
        'Referer': 'https://arena.matchday.co.th/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Length': Buffer.byteLength(payloadStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[Error] ❌ เดือน ${year}-${month} | HTTP Code: ${res.statusCode} | Data: ${data.slice(0, 50)}...`);
          return resolve([]);
        }
        try {
          let records = JSON.parse(data);
          if (records && !Array.isArray(records) && Array.isArray(records.data)) {
              records = records.data;
          }
          if (!Array.isArray(records)) {
              records = [];
          }
          resolve(records);
        } catch (e) {
          console.error(`[Parse Error] ❌ เดือน ${year}-${month} | ข้อผิดพลาด: ${e.message}`);
          resolve([]);
        }
      });
    });

    req.setTimeout(10000, () => {
      console.error(`[Timeout] ❌ เดือน ${year}-${month} | การเชื่อมต่อใช้เวลานานเกินไป`);
      req.destroy();
      resolve([]);
    });

    req.on('error', (e) => {
      console.error(`[Request Error] ❌ เดือน ${year}-${month} | ข้อผิดพลาดเครือข่าย: ${e.message}`);
      resolve([]);
    });

    req.write(payloadStr);
    req.end();
  });
}

async function startExport() {
  console.log("==================================================");
  console.log(`🚀 พร้อมลุย! กำลังดึงข้อมูลการจองแบบจัดเต็ม...`);
  console.log(`📅 ช่วงเวลา: ปี ${START_YEAR} ถึงสิ้นปี ${END_YEAR}`);
  console.log("==================================================");
  
  let allRecords = [];

  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const startM = (y === START_YEAR) ? START_MONTH : 1;
    const endM = (y === END_YEAR) ? END_MONTH : 12;

    for (let m = startM; m <= endM; m++) {
      process.stdout.write(`⏳ เดือน ${y}-${String(m).padStart(2, '0')} ... `);
      const records = await fetchMonth(y, m);
      
      if (Array.isArray(records) && records.length > 0) {
        console.log(`✅ ${records.length} รายการ`);
        allRecords = allRecords.concat(records);
      } else {
        console.log(`⏭ ข้าม (ไม่มีตารางจอง)`);
      }
      
      await new Promise(r => setTimeout(r, 2500)); // หน่วงเวลา 2.5 วินาทีเพื่อความเนียน
    }
  }

  console.log("\n==================================================");
  if (allRecords.length > 0) {
      console.log(`🎉 ดึงข้อมูลเสร็จสมบูรณ์ร้อยเปอร์เซ็นต์!`);
      console.log(`⚽ ได้มาจำนวนมหาศาลรวม: ${allRecords.length} แถว`);
      
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allRecords, null, 2), 'utf8');
      const csvStr = jsonToCsv(allRecords);
      fs.writeFileSync(CSV_FILE, csvStr, 'utf8');
      
      console.log(`\n💾 ไฟล์ Excel รอคุณอยู่ที่:\n   -> ${CSV_FILE}`);
  } else {
      console.log(`⚠️ ระบบทำงานสำเร็จ แต่แปลกที่หาข้อมูลไม่เจอเลยทั้งช่วงนี้ครับ`);
  }
}

startExport();
