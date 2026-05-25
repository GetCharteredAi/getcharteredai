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
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Auth not configured' }) };
    }
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
    const magicLink = `https://getcharteredai.com?token=${encodeURIComponent(token)}`;

    if (process.env.RESEND_API_KEY) {
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
            subject: 'APC Sprint — Your access is ready',
            html: `
              <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
                <div style="background:#0a0f1e;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                  <h1 style="color:#fff;font-size:20px;margin:0;font-family:Georgia,serif">Get Chartered <span style="color:#f59e0b">AI</span></h1>
                  <p style="color:rgba(255,255,255,.5);font-size:11px;margin:6px 0 0;letter-spacing:.1em;text-transform:uppercase">APC Sprint</p>
                </div>
                <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                  <h2 style="font-size:20px;color:#0f172a;margin-bottom:8px">Your sprint starts now</h2>
                  <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:20px">
                    Your APC sprint access is active. Click below to go straight to your dashboard.
                  </p>
                  <a href="${magicLink}" style="display:block;background:#f59e0b;color:#0a0f1e;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;text-align:center">
                    Start My Sprint Now →
                  </a>
                  <p style="font-size:12px;color:#94a3b8;margin-top:16px">
                    Access valid for 42 days. Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>
                  </p>
                </div>
              </div>
            `,
            text: `Your Get Chartered AI APC Sprint is ready.\n\n${magicLink}\n\nAccess valid for 42 days.`
          })
        });
      } catch (emailErr) {
        console.error('Sprint welcome email error:', emailErr.message);
      }
    }

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
