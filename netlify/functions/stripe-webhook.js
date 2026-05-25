// netlify/functions/stripe-webhook.js
// Handles Stripe payment events (HMAC verified, no Stripe SDK)

const crypto = require('crypto');

function verifyStripeSignature(payload, signatureHeader, secret) {
  let timestamp;
  const v1Signatures = [];
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');

  for (const sig of v1Signatures) {
    const sigBuf = Buffer.from(sig, 'utf8');
    if (expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      return true;
    }
  }
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  if (!sig || !webhookSecret) {
    console.error('Missing stripe signature or webhook secret');
    return { statusCode: 400, body: 'Webhook config error' };
  }

  if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
    console.error('Webhook signature verification failed');
    return { statusCode: 400, body: 'Webhook signature invalid' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const type = stripeEvent.type;
  console.log(`Stripe event: ${type}`);

  // ── Invoice paid — check if month 12, auto-cancel if so ──────────────────
  if (type === 'invoice.paid') {
    const invoice = stripeEvent.data?.object;
    const subscriptionId = invoice?.subscription;
    const customerEmail = invoice?.customer_email;

    if (subscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        // Get all paid invoices for this subscription
        const invResp = await fetch(
          `https://api.stripe.com/v1/invoices?subscription=${subscriptionId}&status=paid&limit=20`,
          { headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
        );
        const invData = await invResp.json();
        const paidCount = invData?.data?.length || 0;

        console.log(`Subscription ${subscriptionId}: ${paidCount} paid invoices`);

        // Auto-cancel after 12th payment
        if (paidCount >= 12) {
          await fetch(
            `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: 'cancel_at_period_end=true'
            }
          );
          console.log(`Auto-cancelled subscription ${subscriptionId} at period end after 12 payments`);

          // Send completion email
          if (customerEmail && process.env.RESEND_API_KEY) {
            await sendEmail(
              customerEmail,
              'Your Get Chartered AI course is complete 🎓',
              `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
                <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                  <h1 style="color:#fff;font-size:20px;margin:0">Get Chartered AI</h1>
                </div>
                <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                  <h2 style="font-size:18px;color:#0f172a;margin-bottom:8px">You have completed all 12 modules 🎓</h2>
                  <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:16px">
                    Your monthly subscription has now automatically ended — all 12 modules have been delivered. 
                    Your access continues until the end of your current billing period.
                  </p>
                  <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:20px">
                    Use Module 12 for your final mock interview practice and revision before your APC assessment. 
                    Good luck — you have done the preparation. Now go and perform.
                  </p>
                  <a href="https://getcharteredai.com?login=1" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Go to My Dashboard →</a>
                  <p style="color:#94a3b8;font-size:12px;margin-top:24px">Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a></p>
                </div>
              </div>`,
              'You have completed all 12 Get Chartered AI modules. Your subscription has automatically ended. Good luck with your APC! info@getcharteredai.com'
            );
          }
        }
      } catch (err) {
        console.error('Auto-cancel check error:', err);
      }
    }
  }

  // ── Payment failed — notify member ───────────────────────────────────────
  if (type === 'invoice.payment_failed') {
    const email = stripeEvent.data?.object?.customer_email;
    console.log(`Payment FAILED: ${email}`);
    if (email && process.env.RESEND_API_KEY) {
      await sendEmail(
        email,
        'Action required — payment failed for Get Chartered AI',
        `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
          <div style="background:#dc2626;border-radius:12px 12px 0 0;padding:28px;text-align:center">
            <h1 style="color:#fff;font-size:20px;margin:0">Payment Failed</h1>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p style="color:#64748b;font-size:14px;line-height:1.7">
              Your monthly payment for Get Chartered AI could not be processed. 
              Please update your payment details to keep your access active.
            </p>
            <p style="color:#94a3b8;font-size:12px;margin-top:16px">
              Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>
            </p>
          </div>
        </div>`,
        'Your Get Chartered AI payment failed. Please update your payment details or contact info@getcharteredai.com'
      );
    }
  }

  // ── Subscription cancelled — notify member ───────────────────────────────
  if (type === 'customer.subscription.deleted') {
    const customerId = stripeEvent.data?.object?.customer;
    if (customerId && process.env.RESEND_API_KEY && process.env.STRIPE_SECRET_KEY) {
      try {
        const r = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
          headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
        });
        const customer = await r.json();
        if (customer.email) {
          await sendEmail(
            customer.email,
            'Your Get Chartered AI subscription has ended',
            `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                <h1 style="color:#fff;font-size:20px;margin:0">Get Chartered AI</h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <p style="color:#64748b;font-size:14px;line-height:1.7">
                  Your subscription has ended. You can re-enrol at any time to continue your APC preparation.
                </p>
                <a href="https://getcharteredai.com" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px">Re-enrol →</a>
                <p style="color:#94a3b8;font-size:12px;margin-top:24px">Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a></p>
              </div>
            </div>`,
            'Your Get Chartered AI subscription has ended. Re-enrol at https://getcharteredai.com'
          );
        }
      } catch (err) { console.error('Could not get customer:', err); }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

async function sendEmail(to, subject, html, text) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Get Chartered AI <info@getcharteredai.com>',
        to: [to], subject, html, text
      })
    });
  } catch (err) { console.error('Email error:', err); }
}
