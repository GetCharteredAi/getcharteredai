// netlify/functions/get-payment-amount.js
// Returns the Stripe-verified payment amount for a completed checkout session.
// Called by success.html on page load to fire the Google Ads conversion even when
// the customer pays but does not complete account registration.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { session_id } = body;
  if (!session_id || typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid session_id' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Not configured' }) };

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const session = await r.json();

    if (!r.ok) return { statusCode: 200, headers, body: JSON.stringify({ paid: false }) };

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) return { statusCode: 200, headers, body: JSON.stringify({ paid: false }) };

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        paid: true,
        amount: session.amount_total,
        currency: (session.currency || 'gbp').toUpperCase()
      })
    };
  } catch (err) {
    console.error('get-payment-amount:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ paid: false }) };
  }
};
