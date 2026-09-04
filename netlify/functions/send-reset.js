// netlify/functions/send-reset.js
// Password reset via magic link — looks up Stripe subscription by email
// then re-issues a JWT token and emails a one-click login link

// Price ID sets — keep in sync with create-checkout.js and verify-sprint-session.js
// Every known plan must be listed explicitly; unknown price IDs fail rather than fall back.
const REFERRED_PRICE_IDS  = new Set([
  'price_1TcsEeRkzyH1h56UidHDLTKy', // current
  'price_1TaFxDRkzyH1h56URvfFhEbr', // legacy
]);
const SPRINT_PRICE_IDS = new Set([
  'price_1TcsLoRkzyH1h56UOSPEAPSq', // current
  'price_1SdEf0RkzyH1h56UQZUOtebL', // legacy
]);
const YEAR_TWO_PRICE_IDS = new Set([
  'price_1TcsGcRkzyH1h56U7bJWaaBD', // Apprenticeship Mid-Programme Professional Readiness Review (current)
]);
const ANNUAL_PRICE_IDS = new Set([
  'price_1Tcs9lRkzyH1h56UY5JMcA7M', // Full 12-Module Programme (current)
]);
const SELFPACED_PRICE_IDS = new Set([
  'price_1TxOuERkzyH1h56UHzRlbS6i', // Self-paced (current)
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
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');

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
    let foundPayment = false; // true when a payment is found but plan can't be confirmed

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
            foundPayment = true;

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
            } catch (_) { /* price ID stays empty; explicit-match block below will handle it */ }

            if (REFERRED_PRICE_IDS.has(priceId)) {
              plan = 'referred';
              expires = activatedAt + (90 * 24 * 60 * 60 * 1000);
            } else if (SPRINT_PRICE_IDS.has(priceId)) {
              plan = 'sprint';
              expires = activatedAt + (70 * 24 * 60 * 60 * 1000);
            } else if (YEAR_TWO_PRICE_IDS.has(priceId)) {
              plan = 'year-one';
              // Option C: pre-deploy purchases keep their original 548-day reset window
              expires = activatedAt < YEAR_TWO_DEPLOY_TS
                ? activatedAt + (548 * 24 * 60 * 60 * 1000)
                : activatedAt + (183 * 24 * 60 * 60 * 1000);
            } else if (ANNUAL_PRICE_IDS.has(priceId)) {
              plan = 'annual';
              expires = activatedAt + (548 * 24 * 60 * 60 * 1000);
            } else if (SELFPACED_PRICE_IDS.has(priceId)) {
              plan = 'selfpaced';
              expires = activatedAt + (548 * 24 * 60 * 60 * 1000);
            } else {
              // Price ID is empty or unrecognised — do not guess the plan.
              // foundPayment=true will surface a clear error below rather than silent success.
              console.warn(`[send-reset] unrecognised price ID '${priceId}' for ${cleanEmail}`);
            }
            break;
          }
        }
      }
    }

    if (!plan) {
      if (foundPayment) {
        // A payment was found but the price ID wasn't recognised — fail clearly, don't guess.
        console.log(`[send-reset] payment found but plan unconfirmed for ${cleanEmail}`);
        return { statusCode: 200, headers, body: JSON.stringify({
          sent: false,
          error: 'We found your payment but could not confirm your access level. Please email info@getcharteredai.com and we will issue your login link directly.'
        }) };
      }
      // No Stripe customer found for this email address.
      console.log(`[send-reset] no active account for ${cleanEmail}`);
      return { statusCode: 200, headers, body: JSON.stringify({
        sent: false,
        error: 'We could not find an account for that email address. Please check you are using the email you purchased with, or contact info@getcharteredai.com for help.'
      }) };
    }

    const planLabels = {
      'monthly':  'Monthly Subscription',
      'annual':   'Full Year Access',
      'referred': 'Referred Candidate Recovery Programme',
      'sprint':   'Sprint Programme',
      'year-one': 'APC Apprenticeship Mid-Programme Professional Readiness Review',
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
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
    const token = `${tokenData}.${signature}`;

    // Build magic link
    const magicLink = `https://getcharteredai.com?token=${encodeURIComponent(token)}`;
    const linkValidityText = {
      'monthly':  '60 days',
      'annual':   '18 months',
      'referred': '90 days',
      'sprint':   '70 days',
      'year-one': '6 months',
      'selfpaced': '18 months',
    };
    const validityText = linkValidityText[plan] || '35 days';

    // Send email via Resend
    const resendResp = await fetch('https://api.resend.com/emails', {
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

    if (!resendResp.ok) {
      const resendErr = await resendResp.text().catch(() => '');
      console.error(`[send-reset] Resend failed for ${cleanEmail}: ${resendResp.status} ${resendErr}`);
      return { statusCode: 200, headers, body: JSON.stringify({
        sent: false,
        error: 'We found your account but were unable to send the login email. Please try again or contact info@getcharteredai.com for help.'
      }) };
    }

    console.log(`Reset magic link sent to ${cleanEmail}`);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };

  } catch (err) {
    console.error('Reset error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({
      sent: false,
      error: 'Something went wrong on our end. Please try again or contact info@getcharteredai.com for help.'
    }) };
  }
};
