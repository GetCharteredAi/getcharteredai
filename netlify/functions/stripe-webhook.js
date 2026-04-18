// netlify/functions/stripe-webhook.js
// Handles all Stripe payment events

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const type = stripeEvent.type;
  console.log(`Stripe event: ${type}`);

  // ── NEW PAYMENT ────────────────────────────────────────────────────────────
  if (type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const email = session.customer_details?.email || session.customer_email;
    const plan = session.mode === "subscription" ? "monthly" : "annual";
    console.log(`New payment: ${email} — ${plan}`);
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  // ── MONTHLY RENEWAL OK ─────────────────────────────────────────────────────
  if (type === "invoice.payment_succeeded") {
    const invoice = stripeEvent.data.object;
    if (invoice.billing_reason === "subscription_cycle") {
      console.log(`Monthly renewal OK: ${invoice.customer_email}`);
      // Access continues — JWT re-issued on next login via verify-session
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  // ── PAYMENT FAILED ─────────────────────────────────────────────────────────
  if (type === "invoice.payment_failed") {
    const invoice = stripeEvent.data.object;
    const email = invoice.customer_email;
    console.log(`Payment FAILED: ${email}`);

    // Send payment failed email
    if (process.env.RESEND_API_KEY && email) {
      await sendEmail(
        email,
        "Action required — payment failed for Get Chartered AI",
        `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
          <h2 style="color:#dc2626">Payment failed</h2>
          <p style="color:#64748b;font-size:15px;line-height:1.7">We were unable to process your monthly payment for Get Chartered AI.</p>
          <p style="color:#64748b;font-size:15px;line-height:1.7">Stripe will automatically retry. If the retry fails your access will be suspended.</p>
          <p style="color:#64748b;font-size:15px;line-height:1.7">To keep your access please update your payment details, or contact us at <a href="mailto:contact@getcharteredai.com">contact@getcharteredai.com</a>.</p>
          <a href="https://getcharteredai.netlify.app" style="display:inline-block;margin-top:20px;background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Go to Get Chartered AI</a>
        </div>`,
        "Your Get Chartered AI payment has failed. Please update your payment details or contact contact@getcharteredai.com",
      );
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  // ── SUBSCRIPTION CANCELLED ─────────────────────────────────────────────────
  if (type === "customer.subscription.deleted") {
    const sub = stripeEvent.data.object;
    try {
      const customer = await stripe.customers.retrieve(sub.customer);
      const email = customer.email;
      console.log(`Subscription cancelled: ${email}`);

      if (process.env.RESEND_API_KEY && email) {
        await sendEmail(
          email,
          "Your Get Chartered AI subscription has ended",
          `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
            <h2 style="color:#0f172a">Subscription ended</h2>
            <p style="color:#64748b;font-size:15px;line-height:1.7">Your Get Chartered AI subscription has been cancelled and your access has now ended.</p>
            <p style="color:#64748b;font-size:15px;line-height:1.7">We hope the course supported your APC preparation. You are welcome back at any time.</p>
            <a href="https://getcharteredai.netlify.app" style="display:inline-block;margin-top:20px;background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Re-enrol</a>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px">Questions? <a href="mailto:contact@getcharteredai.com" style="color:#2563EB">contact@getcharteredai.com</a></p>
          </div>`,
          "Your Get Chartered AI subscription has ended. Re-enrol at https://getcharteredai.netlify.app",
        );
      }
    } catch (err) {
      console.error("Could not retrieve customer:", err);
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// Helper — send email via Resend
async function sendEmail(to, subject, html, text) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Get Chartered AI <welcome@getcharteredai.com>",
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const d = await r.json();
    console.log(`Email sent to ${to}:`, d.id || d);
  } catch (err) {
    console.error("Email send failed:", err);
  }
}
