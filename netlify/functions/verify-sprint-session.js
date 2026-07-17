// netlify/functions/verify-sprint-session.js
// Verifies Stripe sprint payment and issues 42-day access token

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

  const { session_id, email } = body;
  if (!session_id || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing session_id or email' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system not configured' }) };
  }

  try {
    // Verify Stripe session
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    const session = await r.json();

    if (!r.ok || (session.payment_status !== 'paid' && session.status !== 'complete')) {
      return { statusCode: 402, headers, body: JSON.stringify({ error: 'Payment not confirmed. Please complete payment first.' }) };
    }

    const cleanEmail = email.toLowerCase().trim();
    const activatedAt = Date.now();
    const expires = activatedAt + (42 * 24 * 60 * 60 * 1000); // 42 days

    // Issue sprint JWT token
    const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
    const payload = {
      email: cleanEmail,
      plan: 'sprint',
      activatedAt,
      expires,
      sessionId: session_id
    };

    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
    const token = `${tokenData}.${signature}`;

    console.log(`Sprint activated: ${cleanEmail}`);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, token, email: cleanEmail })
    };

  } catch (err) {
    console.error('Sprint verify error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not verify payment. Please contact info@getcharteredai.com' }) };
  }
};
