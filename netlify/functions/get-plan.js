// netlify/functions/get-plan.js
// Quick check of Stripe session plan type for success page display

const SELFPACED_PRICE_IDS = new Set(['price_1TxOuERkzyH1h56UHzRlbS6i']);

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No session_id' }) };

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items`, {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const session = await r.json();
    const lineItems = session.line_items?.data || [];
    const priceId = lineItems[0]?.price?.id || '';
    let plan;
    if (session.mode === 'subscription') {
      plan = 'monthly';
    } else if (SELFPACED_PRICE_IDS.has(priceId)) {
      plan = 'selfpaced';
    } else {
      plan = 'annual';
    }
    return { statusCode: 200, headers, body: JSON.stringify({ plan }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
