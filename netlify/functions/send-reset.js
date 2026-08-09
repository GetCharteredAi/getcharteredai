// netlify/functions/send-reset.js
// Password reset via magic link — looks up Stripe subscription by email
// then re-issues a JWT token and emails a one-click login link

// Price ID sets for one-time plans — keep in sync with verify-session.js and create-checkout.js
const REFERRED_PRICE_IDS  = new Set([
  'price_1TcsEeRkzyH1h56UidHDLTKy', // current
  'price_1TaFxDRkzyH1h56URvfFhEbr', // legacy
]);
const SPRINT_PRICE_IDS = new Set([
  'price_1TcsLoRkzyH1h56UOSPEAPSq', // current
  'price_1SdEf0RkzyH1h56UQZUOtebL', // legacy
]);
const YEAR_TWO_PRICE_IDS = new Set([
  'price_1TcsGcRkzyH1h56U7bJWaaBD', // Year Two Readiness Review (current)
]);
// Option C grandfathering: Year Two customers who purchased before the deploy date (2026-08-07)
// retain their original 548-day reset window; new purchases get the correct 183-day window.
const YEAR_TWO_DEPLOY_TS = Date.UTC(2026, 7, 7); // 2026-08-07

const REVOKED_EMAILS = [
  'samperry991@gmail.com',
];

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

  const { email } = body;
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };

  const cleanEmail = email.toLowerCase().trim();

  // Block revoked accounts — return the standard success envelope to avoid enumeration
  if (REVOKED_EMAILS.includes(cleanEmail)) {
    console.log(`Blocked magic link for revoked account: ${cleanEmail}`);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };
  }

  // Always return success to avoid email enumeration
  // Only proceed if we have the required keys
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';

  if (!stripeKey || !resendKey) {
    console.log(`Reset requested for ${cleanEmail} — missing keys`);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };
  }

  try {
    // Look up customer in Stripe by email
    const custResp = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(cleanEmail)}&limit=5`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` }
    });
    const custData = await custResp.json();

    let plan = null;
    let activatedAt = null;
    let expires = null;

    if (custData.data && custData.data.length > 0) {
      // Found customer — check for active subscription (monthly) or payment (annual)
      for (const customer of custData.data) {
        // Check subscriptions
        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=1`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` }
        });
        const subData = await subResp.json();

        if (subData.data && subData.data.length > 0) {
          plan = 'monthly';
          activatedAt = subData.data[0].start_date * 1000;
          expires = Date.now() + (60 * 24 * 60 * 60 * 1000);
          break;
        }

        // Check one-time payments — look up checkout session per payment intent to get price ID
        const payResp = await fetch(`https://api.stripe.com/v1/payment_intents?customer=${customer.id}&limit=5`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` }
        });
        const payData = await payResp.json();

        if (payData.data && payData.data.length > 0) {
          const paid = payData.data.find(p => p.status === 'succeeded');
          if (paid) {
            activatedAt = paid.created * 1000;

            // Fetch the checkout session to get the price ID for accurate plan detection
            let priceId = '';
            try {
              const csResp = await fetch(
                `https://api.stripe.com/v1/checkout/sessions?payment_intent=${paid.id}&expand[]=data.line_items&limit=1`,
                { headers: { 'Authorization': `Bearer ${stripeKey}` } }
              );
              if (csResp.ok) {
                const csData = await csResp.json();
                priceId = csData.data?.[0]?.line_items?.data?.[0]?.price?.id || '';
              }
            } catch (_) { /* fall through to annual default */ }

            if (REFERRED_PRICE_IDS.has(priceId)) {
              plan = 'referred';
              expires = activatedAt + (90 * 24 * 60 * 60 * 1000);
            } else if (SPRINT_PRICE_IDS.has(priceId)) {
              plan = 'sprint';
              expires = activatedAt + (49 * 24 * 60 * 60 * 1000);
            } else if (YEAR_TWO_PRICE_IDS.has(priceId)) {
              plan = 'year-one';
              // Option C: pre-deploy purchases keep their original 548-day reset window
              expires = activatedAt < YEAR_TWO_DEPLOY_TS
                ? activatedAt + (548 * 24 * 60 * 60 * 1000)
                : activatedAt + (183 * 24 * 60 * 60 * 1000);
            } else {
              plan = 'annual';
              expires = activatedAt + (548 * 24 * 60 * 60 * 1000);
            }
            break;
          }
        }
      }
    }

    if (!plan) {
      // No active account found — still return success but don't send
      console.log(`Reset requested for ${cleanEmail} — no active account found`);
      return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };
    }

    const planLabels = {
      'monthly':  'Monthly Subscription',
      'annual':   'Full Year Access',
      'referred': 'Referred Candidate Recovery Programme',
      'sprint':   'Sprint Programme',
      'year-one': 'APC Year Two Readiness Review',
    };
    const planLabel = planLabels[plan] || 'Full Year Access';

    // Re-issue JWT token
    const payload = {
      email: cleanEmail,
      plan,
      activatedAt,
      expires,
      resetIssued: Date.now()
    };

    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
    const token = `${tokenData}.${signature}`;

    // Build magic link
    const magicLink = `https://getcharteredai.com?token=${encodeURIComponent(token)}`;
    const linkValidityText = {
      'monthly':  '60 days',
      'annual':   '18 months',
      'referred': '90 days',
      'sprint':   '49 days',
      'year-one': '6 months',
      'selfpaced': '18 months',
    };
    const validityText = linkValidityText[plan] || '35 days';

    // Send email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Get Chartered AI <info@getcharteredai.com>',
        to: [cleanEmail],
        subject: 'Get Chartered AI — Your login link',
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
            <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:28px;text-align:center">
              <h1 style="color:#fff;font-size:20px;margin:0">Get Chartered AI</h1>
            </div>
            <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
              <h2 style="font-size:18px;color:#0f172a;margin-bottom:8px">Your login link</h2>
              <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:20px">
                Click the button below to log straight back into your Get Chartered AI dashboard. No password needed — this link logs you in directly.
              </p>
              <p style="color:#64748b;font-size:14px;margin-bottom:20px">
                <strong>Plan:</strong> ${planLabel}
              </p>
              <a href="${magicLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
                Log In to My Dashboard →
              </a>
              <p style="color:#94a3b8;font-size:12px;margin-top:24px">
                This link is valid for ${validityText}. If you did not request this, you can safely ignore this email.<br><br>
                Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>
              </p>
            </div>
          </div>
        `,
        text: `Your Get Chartered AI login link\n\nClick here to log in: ${magicLink}\n\nThis link is valid for ${validityText}.\n\nQuestions? info@getcharteredai.com`
      })
    });

    console.log(`Reset magic link sent to ${cleanEmail}`);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };

  } catch (err) {
    console.error('Reset error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };
  }
};
