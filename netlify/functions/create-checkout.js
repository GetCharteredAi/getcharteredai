// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session server-side and returns the URL
// This is more reliable than client-side redirectToCheckout

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
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { priceId, mode } = body;

  if (!priceId || !mode) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing priceId or mode' }) };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://getcharteredai.com/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://getcharteredai.com/cancel.html',
      billing_address_collection: 'auto',
      customer_email: undefined, // let Stripe collect email
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Stripe session creation failed:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
