curl -v -X POST https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/cancel-booking ^
-H "Content-Type: application/json" ^
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0" ^
-d "{\"matchId\": \"1770869998464_971\", \"reason\": \"Manual Curl cmd\", \"isRefunded\": false, \"shouldReturnCoupon\": false}"
