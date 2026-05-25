// netlify/functions/get-plan.js
// Quick check of Stripe session plan type for success page display

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No session_id' }) };

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const session = await r.json();
    const plan = session.mode === 'subscription' ? 'monthly' : 'annual';
    return { statusCode: 200, headers, body: JSON.stringify({ plan }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
