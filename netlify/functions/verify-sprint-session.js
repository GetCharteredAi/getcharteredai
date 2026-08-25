// netlify/functions/verify-sprint-session.js
// Verifies Stripe sprint payment and issues sprint access token

// Price ID sets — keep in sync with create-checkout.js and verify-session.js
const SPRINT_PRICE_IDS = new Set([
  'price_1TcsLoRkzyH1h56UOSPEAPSq', // current
  'price_1SdEf0RkzyH1h56UQZUOtebL', // legacy
]);

const SPRINT_DAYS = 70;

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
    // Verify Stripe session — expand line_items so we can check the price ID
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=line_items`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    const session = await r.json();

    if (!r.ok || (session.payment_status !== 'paid' && session.status !== 'complete')) {
      return { statusCode: 402, headers, body: JSON.stringify({ error: 'Payment not confirmed. Please complete payment first.' }) };
    }

    // Verify the session is actually for the Sprint product
    const lineItems = session.line_items?.data || [];
    const priceId = lineItems[0]?.price?.id || '';
    if (!SPRINT_PRICE_IDS.has(priceId)) {
      console.warn(`Sprint verify rejected: session ${session_id} has price ID ${priceId || '(none)'}`);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Session does not match Sprint product. Please contact info@getcharteredai.com' }) };
    }

    const cleanEmail = email.toLowerCase().trim();
    const activatedAt = Date.now();
    const expires = activatedAt + (SPRINT_DAYS * 24 * 60 * 60 * 1000);

    // Issue sprint JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET not configured');
    const payload = {
      email: cleanEmail,
      plan: 'sprint',
      activatedAt,
      expires,
      sessionId: session_id
    };

    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
    const token = `${tokenData}.${signature}`;

    console.log(`Sprint activated: ${cleanEmail}`);

    // Best-effort welcome email — failure never blocks access
    if (process.env.RESEND_API_KEY) {
      const magicLink = `https://getcharteredai.com?token=${encodeURIComponent(token)}`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Get Chartered AI <info@getcharteredai.com>',
            to: [cleanEmail],
            subject: 'APC Sprint — Your access is ready 🚀',
            html: `
              <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
                <div style="background:#0a0f1e;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                  <h1 style="color:#fff;font-size:20px;margin:0;font-family:Georgia,serif">Get Chartered <span style="color:#f59e0b">AI</span></h1>
                  <p style="color:rgba(255,255,255,.5);font-size:11px;margin:6px 0 0;letter-spacing:.1em;text-transform:uppercase">APC Sprint</p>
                </div>
                <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                  <h2 style="font-size:20px;color:#0f172a;margin-bottom:8px">Your sprint starts now 🚀</h2>
                  <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:20px">
                    Your APC sprint access is active. Click below to go straight to your dashboard — no password needed.
                  </p>
                  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px">
                    <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d97706;margin:0 0 4px">What's inside your sprint</p>
                    <p style="font-size:13px;color:#78350f;margin:0;line-height:1.6">
                      APC Framework Reset · All 11 Mandatory Competency Revision Sheets · 127+ Quiz Questions · AI Tutor (unlimited) · 60-minute Mock Interview · All 22 RICS Pathways
                    </p>
                  </div>
                  <a href="${magicLink}" style="display:block;background:#f59e0b;color:#0a0f1e;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:16px">
                    Start My Sprint Now →
                  </a>
                  <p style="font-size:12px;color:#94a3b8;margin:0">
                    Access valid for ${SPRINT_DAYS} days. If you don't pass your APC, your £297 sprint fee is credited against the full programme — you pay just £200 for all 12 modules with 18 months access. Email us after your results and we'll set it up immediately.<br><br>
                    Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>
                  </p>
                </div>
              </div>
            `,
            text: `Your Get Chartered AI APC Sprint is ready!\n\nClick here to start: ${magicLink}\n\nAccess valid for ${SPRINT_DAYS} days.\n\nIf you don't pass your APC, your £297 sprint fee is credited against the full programme — you pay just £200 for all 12 modules with 18 months access. Email us after your results and we'll set it up immediately.\n\nQuestions? info@getcharteredai.com`
          })
        });
        console.log(`Sprint welcome email sent: ${cleanEmail}`);
      } catch (emailErr) {
        console.error(`Sprint welcome email failed for ${cleanEmail} (non-fatal):`, emailErr.message);
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, token, email: cleanEmail })
    };

  } catch (err) {
    console.error('Sprint verify error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not verify payment. Please contact info@getcharteredai.com' }) };
  }
};
