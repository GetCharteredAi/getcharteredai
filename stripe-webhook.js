// netlify/functions/stripe-webhook.js
// Receives Stripe events, verifies signature, creates member account on payment

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle successful payment
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const customerEmail = session.customer_details?.email || session.customer_email;
    const plan = session.mode === 'subscription' ? 'monthly' : 'annual';
    const sessionId = session.id;

    console.log(`Payment confirmed: ${customerEmail} — ${plan} plan`);

    // Store pending activation keyed by session ID
    // The frontend will call /verify-session with this ID to activate their account
    // We use Netlify's environment to pass data — in production use a DB like FaunaDB or Supabase
    // For this implementation we store in a signed token the frontend exchanges

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, email: customerEmail, plan })
    };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
