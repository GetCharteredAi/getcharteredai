// netlify/functions/verify-session.js
// Called by success page with Stripe session_id
// Verifies payment is real, returns signed JWT granting access

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "https://getcharteredai.netlify.app",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }

  const { session_id, email, password } = body;

  if (!session_id || !email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing session_id, email or password" }),
    };
  }

  // Verify the Stripe session is real and paid
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch (err) {
    console.error("Failed to retrieve Stripe session:", err);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Could not verify payment. Please contact support.",
      }),
    };
  }

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return {
      statusCode: 402,
      headers,
      body: JSON.stringify({
        error: "Payment not confirmed. Please complete payment first.",
      }),
    };
  }

  const stripeEmail = session.customer_details?.email || session.customer_email;
  const plan = session.mode === "subscription" ? "monthly" : "annual";

  // Issue a signed JWT — this is the member's access token
  // Stored in localStorage, verified on each page load
  const token = jwt.sign(
    {
      email: email.toLowerCase().trim(),
      stripeEmail: stripeEmail,
      plan: plan,
      sessionId: session_id,
      activatedAt: Date.now(),
    },
    process.env.JWT_SECRET,
    { expiresIn: plan === "annual" ? "366d" : "35d" },
  );

  console.log(`Account activated: ${email} — ${plan}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      token,
      email: email.toLowerCase().trim(),
      plan,
    }),
  };
};
