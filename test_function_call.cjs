require('dotenv').config();

async function test() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/process-referral-reward`;
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const bookingId = '1772071140218';

  console.log(`Calling ${url} for booking ${bookingId}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ bookingId })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
