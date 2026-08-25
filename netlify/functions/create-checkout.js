// netlify/functions/create-checkout.js
// Creates Stripe Checkout Session using fetch (no npm packages needed)

// APC plans that collect rics_pathway + assessment_window at checkout
const APC_PLANS = new Set(['annual', 'monthly', 'referred', 'sprint']);

// Human-readable labels stored in session metadata so the webhook can identify
// the product without expanding line_items
const PLAN_LABELS = {
  'annual':     '12-Module Programme — Annual (£497)',
  'monthly':    '12-Module Programme — Monthly (£49/mo)',
  'referred':   'Referred Candidate Recovery Programme (£397)',
  'sprint':     'APC Final Sprint (£297)',
  'year-one':   'APC Year Two Readiness Review (£127)',
  'apprentice': 'Apprenticeship Readiness Review',
  'selfpaced':  'Self-Paced Programme',
  'case-study': 'Case Study Review (£29)',
};

// Assessment windows — add future seasons here only; no logic changes required
const VALID_APC_WINDOWS = [
  'Autumn 2026', 'Spring 2027', 'Autumn 2027',
  'Spring 2028', 'Autumn 2028', 'Not yet confirmed',
];

// EPA/completion windows — mirrors APC windows
const VALID_EPA_WINDOWS = VALID_APC_WINDOWS;

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
    'annual':     { priceId: 'price_1U8GtuRkzyH1h56UqdF1bZlJ', mode: 'payment' },
    'monthly':    { priceId: 'price_1TcsBZRkzyH1h56UFH6ESfRe', mode: 'subscription' },
    'referred':   { priceId: 'price_1TcsEeRkzyH1h56UidHDLTKy', mode: 'payment' },
    'year-one':   { priceId: 'price_1TcsGcRkzyH1h56U7bJWaaBD', mode: 'payment' },
    'sprint':     { priceId: 'price_1TcsLoRkzyH1h56UOSPEAPSq', mode: 'payment' },
    'case-study': { priceId: 'price_1Tgqf1RkzyH1h56UvxEISPgl', mode: 'payment', successUrl: 'https://getcharteredai.com/index.html?cs_purchase=success&session_id={CHECKOUT_SESSION_ID}&view=dashboard' },
    'selfpaced':  { priceId: 'price_1TxOuERkzyH1h56UHzRlbS6i', mode: 'payment' },
    'apprentice': { priceId: 'price_1U56XhRkzyH1h56Uo1NRlXcm', mode: 'payment' },
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

  // ── Collect metadata fields ──────────────────────────────────────────────

  // APC plans: rics_pathway + assessment_window
  // Fields are required in the UI; we accept them here and warn if absent but
  // never block payment — checkout is not the enforcement point.
  let extraMeta = {};

  if (APC_PLANS.has(body.plan)) {
    const pathway = (body.rics_pathway || '').trim();
    const window  = (body.assessment_window || '').trim();
    if (!pathway) console.warn(`[create-checkout] rics_pathway missing for plan=${body.plan}`);
    if (!window)  console.warn(`[create-checkout] assessment_window missing for plan=${body.plan}`);
    extraMeta.rics_pathway       = pathway || '';
    extraMeta.assessment_window  = window  || '';
  }

  if (body.plan === 'apprentice') {
    const apPath  = (body.apprenticeship_pathway || '').trim();
    const stage   = (body.apprenticeship_stage   || '').trim();
    const epaWin  = (body.epa_window             || '').trim();
    if (!apPath) console.warn('[create-checkout] apprenticeship_pathway missing');
    if (!stage)  console.warn('[create-checkout] apprenticeship_stage missing');
    if (!epaWin) console.warn('[create-checkout] epa_window missing');
    extraMeta.apprenticeship_pathway = apPath  || '';
    extraMeta.apprenticeship_stage   = stage   || '';
    extraMeta.epa_window             = epaWin  || '';
  }

  // ── Build Stripe params ──────────────────────────────────────────────────

  try {
    const params = new URLSearchParams();
    params.append('mode', mode);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    const host = event.headers['x-forwarded-host'] || event.headers['host'] || 'getcharteredai.com';
    const siteUrl = `https://${host}`;
    params.append('success_url', successUrl || `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${siteUrl}/cancel.html`);
    params.append('billing_address_collection', 'auto');
    params.append('consent_collection[terms_of_service]', 'required');
    params.append('custom_text[terms_of_service_acceptance][message]', 'I agree to the [[link]] and confirm I am purchasing digital content that will be made available to me immediately.');

    if (body.plan === 'annual') {
      params.append('payment_method_types[0]', 'card');
      params.append('payment_method_types[1]', 'klarna');
    }
    if (body.plan === 'selfpaced') {
      params.append('payment_intent_data[setup_future_usage]', 'off_session');
    }
    // Ensure a Stripe Customer record is created for one-time payment plans so
    // that send-reset.js can look them up by email for the "Forgot password?" flow.
    // selfpaced is excluded — setup_future_usage already forces customer creation.
    // monthly/subscription always creates a customer automatically.
    if (['sprint', 'referred', 'annual', 'year-one'].includes(body.plan)) {
      params.append('customer_creation', 'always');
    }
    if (body.email) {
      params.append('customer_email', body.email);
    }

    // Always store plan identifier on the session for webhook reporting
    params.append('metadata[plan_key]', body.plan);
    params.append('metadata[plan_label]', PLAN_LABELS[body.plan] || body.plan);

    // Store extra fields on the session metadata (visible in Stripe Dashboard
    // under the Checkout Session and via checkout.session.completed webhook)
    for (const [k, v] of Object.entries(extraMeta)) {
      params.append(`metadata[${k}]`, v);
    }

    // Mirror fields onto the underlying payment/subscription record so they
    // are also visible when looking up by PaymentIntent or Subscription
    if (mode === 'payment') {
      for (const [k, v] of Object.entries(extraMeta)) {
        params.append(`payment_intent_data[metadata][${k}]`, v);
      }
    } else if (mode === 'subscription') {
      for (const [k, v] of Object.entries(extraMeta)) {
        params.append(`subscription_data[metadata][${k}]`, v);
      }
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

    console.log(`Checkout session created: ${session.id} plan=${body.plan}`);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error('Checkout error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
