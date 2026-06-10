// netlify/functions/verify-case-study.js
// Verifies a completed Stripe payment for the Case Study Review add-on

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { session_id } = body;
  if (!session_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing session_id' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system not configured' }) };
  }

  const CASE_STUDY_PRICE_ID = 'price_1TgqRWRkzyH1h56UUABcQsTH';

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=line_items`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    const session = await r.json();

    if (!r.ok || (session.payment_status !== 'paid' && session.status !== 'complete')) {
      return { statusCode: 402, headers, body: JSON.stringify({ error: 'Payment not confirmed.' }) };
    }

    const lineItems = session.line_items?.data || [];
    const priceId = lineItems[0]?.price?.id || '';
    if (priceId !== CASE_STUDY_PRICE_ID) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Session does not match Case Study Review product.' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Verify case study error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not verify payment. Please contact support.' }) };
  }
};
