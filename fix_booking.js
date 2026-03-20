const url = 'https://kyprnvazjyilthdzhqxh.supabase.co/rest/v1/bookings?booking_id=eq.1773888338380';
const options = {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0'
    },
    body: JSON.stringify({
        admin_note: ' [Coupon: ลด 100 บาท เมื่อจองออนไลน์] (Burned -100) [REWARD: ฟรีน้ำดื่ม 12 ขวด]'
    })
};

fetch(url, options)
    .then(async res => {
        console.log("Status:", res.status);
    })
    .catch(err => console.error('error:' + err));
