const urlCoupons = 'https://kyprnvazjyilthdzhqxh.supabase.co/rest/v1/user_coupons?booking_id=eq.1773888338380';
const options = {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0',
        'Prefer': 'return=representation'
    },
    body: JSON.stringify({
        status: 'EXPIRED'
    })
};

fetch(urlCoupons, options)
    .then(async res => {
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body:", text);
    })
    .catch(err => console.error('error:' + err));
