const urlBookings = 'https://kyprnvazjyilthdzhqxh.supabase.co/rest/v1/bookings?booking_id=eq.1773888338380&select=booking_id,admin_note';
const urlCoupons = 'https://kyprnvazjyilthdzhqxh.supabase.co/rest/v1/user_coupons?booking_id=eq.1773888338380&select=status';
const options = {
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0'
    }
};

Promise.all([
    fetch(urlBookings, options).then(r => r.json()),
    fetch(urlCoupons, options).then(r => r.json())
]).then(([bookings, coupons]) => {
    console.log("Bookings:", bookings);
    console.log("Coupons:", coupons);
});
