const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg4NDAsImV4cCI6MjA4NDA0NDg0MH0.04WXE3feJa8s2jBe6kmUPH00jufK8nvjSMvNmG_oFPs";

async function run() {
    const response = await fetch("https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/validate-promo-code", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({ code: "214383" }) // using the code from the screenshot!
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
}

run();
