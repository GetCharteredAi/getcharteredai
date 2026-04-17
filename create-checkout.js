// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session server-side — avoids client-side 400 errors

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { priceId, mode } = body;

  if (!priceId || !mode) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing priceId or mode' })
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode, // 'subscription' or 'payment'
      success_url: `${process.env.URL || 'https://getcharteredai.netlify.app'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://getcharteredai.netlify.app'}/cancel.html`,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id })
    };
  } catch (err) {
    console.error('Stripe session creation failed:', err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
