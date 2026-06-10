// netlify/functions/create-checkout.js
// Creates Stripe Checkout Session using fetch (no npm packages needed)

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
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const PLANS = {
    'annual':     { priceId: 'price_1Tcs9lRkzyH1h56UY5JMcA7M', mode: 'payment' },
    'monthly':    { priceId: 'price_1TcsBZRkzyH1h56UFH6ESfRe', mode: 'subscription' },
    'referred':   { priceId: 'price_1TcsEeRkzyH1h56UidHDLTKy', mode: 'payment' },
    'year-one':   { priceId: 'price_1TcsGcRkzyH1h56U7bJWaaBD', mode: 'payment' },
    'sprint':     { priceId: 'price_1TcsLoRkzyH1h56UOSPEAPSq', mode: 'payment' },
    'case-study': { priceId: 'price_1Tgqf1RkzyH1h56UvxEISPgl', mode: 'payment', successUrl: 'https://getcharteredai.com/index.html?cs_purchase=success&session_id={CHECKOUT_SESSION_ID}&view=dashboard' },
  };

  const planConfig = PLANS[body.plan];
  if (!planConfig) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown plan' }) };
  }
  const { priceId, mode, successUrl } = planConfig;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system not configured' }) };
  }

  try {
    // Build form-encoded body for Stripe API
    const params = new URLSearchParams();
    params.append('mode', mode);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl || 'https://getcharteredai.com/success.html?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', 'https://getcharteredai.com/cancel.html');
    params.append('billing_address_collection', 'auto');
    if (body.email) {
      params.append('customer_email', body.email);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', session.error);
      return { statusCode: 400, headers, body: JSON.stringify({ error: session.error?.message || 'Stripe error' }) };
    }

    console.log(`Checkout session created: ${session.id}`);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error('Checkout error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
