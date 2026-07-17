// netlify/functions/verify-session.js
// Verifies Stripe payment and issues access token (no npm needed)

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

  const { session_id, email, password } = body;
  if (!session_id || !email || !password) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing session_id, email or password' }) };
  }
  if (password.length < 8) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system not configured' }) };
  }

  // Verify Stripe session
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=line_items`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    const session = await r.json();

    if (!r.ok || (session.payment_status !== 'paid' && session.status !== 'complete')) {
      return { statusCode: 402, headers, body: JSON.stringify({ error: 'Payment not confirmed. Please complete payment first.' }) };
    }

    // Detect plan by price ID for one-time payments
    const REFERRED_PRICE_ID = 'price_1TaFxDRkzyH1h56URvfFhEbr';
    const SPRINT_PRICE_ID = 'price_1SdEf0RkzyH1h56UQZUOtebL';
    const lineItems = session.line_items?.data || [];
    const priceId = lineItems[0]?.price?.id || session.metadata?.priceId || '';
    
    let plan;
    if (session.mode === 'subscription') {
      plan = 'monthly';
    } else if (priceId === REFERRED_PRICE_ID) {
      plan = 'referred';
    } else if (priceId === SPRINT_PRICE_ID) {
      plan = 'sprint';
    } else {
      plan = 'annual';
    }
    const cleanEmail = email.toLowerCase().trim();
    const activatedAt = Date.now();

    // Create a simple token (base64 encoded payload + secret)
    // This avoids needing the jsonwebtoken npm package
    const payload = {
      email: cleanEmail,
      plan: plan,
      sessionId: session_id,
      activatedAt: activatedAt,
      expires: activatedAt + (
        plan === 'annual' ? 548 * 24 * 60 * 60 * 1000 :
        plan === 'referred' ? 90 * 24 * 60 * 60 * 1000 :
        plan === 'sprint' ? 42 * 24 * 60 * 60 * 1000 :
        60 * 24 * 60 * 60 * 1000
      )
    };

    const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
    const token = `${tokenData}.${signature}`;

    console.log(`Account activated: ${cleanEmail} — ${plan}`);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, token, email: cleanEmail, plan, activatedAt })
    };

  } catch (err) {
    console.error('Verify session error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not verify payment. Please contact support.' }) };
  }
};
