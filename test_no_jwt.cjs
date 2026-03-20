require('dotenv').config();

async function test() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/process-referral-reward`;
  const bookingId = '1772071929600';

  console.log(`Testing NO JWT for ${url} for ${bookingId}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // NO Authorization header
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
