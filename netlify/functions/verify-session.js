// netlify/functions/verify-session.js
// Verifies Stripe payment and issues access token (no npm needed)
const { getStore } = require('@netlify/blobs');

// Price ID sets — keep in sync with create-checkout.js
// Any price ID change there requires a matching change here.
const SELFPACED_PRICE_IDS = new Set(['price_1TxOuERkzyH1h56UHzRlbS6i']);
const REFERRED_PRICE_IDS  = new Set([
  'price_1TcsEeRkzyH1h56UidHDLTKy', // current (create-checkout.js)
  'price_1TaFxDRkzyH1h56URvfFhEbr', // legacy
]);
const SPRINT_PRICE_IDS = new Set([
  'price_1TcsLoRkzyH1h56UOSPEAPSq', // current (create-checkout.js)
  'price_1SdEf0RkzyH1h56UQZUOtebL', // legacy
]);
const YEAR_TWO_PRICE_IDS = new Set([
  'price_1TcsGcRkzyH1h56U7bJWaaBD', // Year Two Readiness Review (current)
]);
const CASE_STUDY_PRICE_IDS = new Set([
  'price_1Tgqf1RkzyH1h56UvxEISPgl', // Case Study Review add-on (current)
]);

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

    // Detect plan by price ID — price ID sets defined at module level above.
    const lineItems = session.line_items?.data || [];
    const priceId = lineItems[0]?.price?.id || session.metadata?.priceId || '';

    let plan;
    if (session.mode === 'subscription') {
      plan = 'monthly';
    } else if (REFERRED_PRICE_IDS.has(priceId)) {
      plan = 'referred';
    } else if (SPRINT_PRICE_IDS.has(priceId)) {
      plan = 'sprint';
    } else if (YEAR_TWO_PRICE_IDS.has(priceId)) {
      plan = 'year-one';
    } else if (SELFPACED_PRICE_IDS.has(priceId)) {
      plan = 'selfpaced';
    } else if (CASE_STUDY_PRICE_IDS.has(priceId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Case Study Review is an add-on, not a programme subscription. Please use the dedicated verification link.' }) };
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
        plan === 'annual'    ? 548 * 24 * 60 * 60 * 1000 :
        plan === 'selfpaced' ? 548 * 24 * 60 * 60 * 1000 :
        plan === 'referred'  ?  90 * 24 * 60 * 60 * 1000 :
        plan === 'sprint'    ?  49 * 24 * 60 * 60 * 1000 :
        plan === 'year-one'  ? 183 * 24 * 60 * 60 * 1000 :
        60 * 24 * 60 * 60 * 1000
      )
    };

    // ── Self-paced: write initial progress record to Netlify Blobs ─────────
    if (plan === 'selfpaced') {
      try {
        // Get the PaymentIntent to extract the saved PaymentMethod ID
        const customerId = session.customer || null;
        let paymentMethodId = null;
        if (session.payment_intent) {
          const piResp = await fetch(`https://api.stripe.com/v1/payment_intents/${session.payment_intent}`, {
            headers: { 'Authorization': `Bearer ${secretKey}` }
          });
          if (piResp.ok) {
            const pi = await piResp.json();
            paymentMethodId = pi.payment_method || null;
          }
        }
        const store = getStore('selfpaced-progress');
        await store.set(cleanEmail, JSON.stringify({
          customerId,
          paymentMethodId,
          unlockedModules: [1],
          createdAt: activatedAt
        }));
        console.log(`Self-paced progress created: ${cleanEmail} — customer ${customerId}, pm ${paymentMethodId}`);
      } catch (blobsErr) {
        // Non-fatal: JWT still issued. Module unlock record can be recovered in Session 2.
        console.error('Self-paced Blobs write error:', blobsErr.message);
      }
    }

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
