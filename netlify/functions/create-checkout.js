// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session server-side — avoids client-side 400 errors

// Load .env for local development
try { require('dotenv').config(); } catch(e) {}

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

  // Initialize stripe INSIDE handler so env var is loaded
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY is not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error: missing Stripe key' })
    };
  }

  const stripe = require('stripe')(stripeKey);

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
      mode: mode,
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
