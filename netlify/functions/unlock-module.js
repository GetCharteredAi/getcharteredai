// netlify/functions/unlock-module.js
// Off-session charge for next self-paced module unlock (£49 per module)

const { getStore } = require('@netlify/blobs');

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

  const { token, moduleId } = body;
  if (!token || !moduleId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'token and moduleId required' }) };
  }

  const moduleNum = parseInt(moduleId, 10);
  if (isNaN(moduleNum) || moduleNum < 2 || moduleNum > 12) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'moduleId must be 2–12' }) };
  }

  // Decode and verify JWT
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  let payload;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error('Malformed token');
    const crypto = require('crypto');
    const hmacSig = crypto.createHmac('sha256', jwtSecret).update(parts[0]).digest('base64url');
    const legacySig = Buffer.from(`${parts[0]}.${jwtSecret}`).toString('base64').slice(0, 32);
    if (parts[1] !== hmacSig && parts[1] !== legacySig) throw new Error('Invalid signature');
    payload = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
  } catch {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  if (payload.plan !== 'selfpaced') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not a self-paced account' }) };
  }
  if (Date.now() > payload.expires) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token expired' }) };
  }

  const email = payload.email;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system not configured' }) };
  }

  // Read Blobs record
  const store = getStore('selfpaced-progress');

  let record;
  try {
    const raw = await store.get(email);
    if (!raw) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No self-paced record found. Contact info@getcharteredai.com' }) };
    }
    record = JSON.parse(raw);
  } catch (err) {
    console.error('Blobs read error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not read account record. Contact info@getcharteredai.com' }) };
  }

  const unlockedModules = record.unlockedModules || [1];

  // Idempotency: already unlocked
  if (unlockedModules.includes(moduleNum)) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, alreadyUnlocked: true, unlockedModules })
    };
  }

  // Sequential enforcement: can only unlock the next module in sequence
  const expectedNext = Math.max(...unlockedModules) + 1;
  if (moduleNum !== expectedNext) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: `Module ${moduleNum} is not the next module. Next available: Module ${expectedNext}` })
    };
  }

  if (!record.customerId || !record.paymentMethodId) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'No saved payment method found. Contact info@getcharteredai.com to restore your billing details.' })
    };
  }

  // Create off-session PaymentIntent
  let pi;
  try {
    const params = new URLSearchParams();
    params.append('amount', '4900'); // £49 in pence
    params.append('currency', 'gbp');
    params.append('customer', record.customerId);
    params.append('payment_method', record.paymentMethodId);
    params.append('confirm', 'true');
    params.append('off_session', 'true');
    params.append('description', `Get Chartered AI — Self-Paced Module ${moduleNum} unlock (${email})`);
    params.append('metadata[email]', email);
    params.append('metadata[moduleId]', String(moduleNum));

    const piResp = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    pi = await piResp.json();

    if (!piResp.ok) {
      console.error(`Stripe PaymentIntent error for ${email} module ${moduleNum}:`, pi.error);
      return {
        statusCode: 402, headers,
        body: JSON.stringify({ error: pi.error?.message || 'Payment failed. Check your card details or contact info@getcharteredai.com' })
      };
    }
  } catch (err) {
    console.error('Stripe request error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment request failed. Contact info@getcharteredai.com' }) };
  }

  // SCA required — return client secret for Session 3 to handle
  if (pi.status === 'requires_action') {
    console.log(`SCA required for ${email} module ${moduleNum} — pi ${pi.id}`);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        requiresAction: true,
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        moduleId: moduleNum
      })
    };
  }

  if (pi.status !== 'succeeded') {
    console.error(`Unexpected PaymentIntent status for ${email} module ${moduleNum}: ${pi.status}`);
    return {
      statusCode: 402, headers,
      body: JSON.stringify({ error: `Payment did not complete (status: ${pi.status}). Contact info@getcharteredai.com` })
    };
  }

  // Payment succeeded — update Blobs
  const updatedModules = [...unlockedModules, moduleNum].sort((a, b) => a - b);
  try {
    await store.set(email, JSON.stringify({
      ...record,
      unlockedModules: updatedModules,
      lastUnlockedAt: Date.now(),
      lastPaymentIntentId: pi.id
    }));
  } catch (blobsErr) {
    // Payment succeeded but Blobs update failed — log loudly, still return success
    // so the candidate isn't told payment failed when it actually went through.
    console.error(`CRITICAL: Blobs update failed after successful payment for ${email} module ${moduleNum}, pi ${pi.id}:`, blobsErr.message);
  }

  console.log(`Module ${moduleNum} unlocked for ${email} — pi ${pi.id}`);
  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      unlockedModules: updatedModules,
      nextModule: moduleNum < 12 ? moduleNum + 1 : null,
      paymentIntentId: pi.id
    })
  };
};
