// netlify/functions/login.js
// Validates member token (no npm needed)

// Manually revoked accounts — these emails are blocked regardless of token validity
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

  const { token } = body;
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'No token' }) };

  try {
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error('Invalid token format');

    const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());

    // Check expiry
    if (payload.expires && Date.now() > payload.expires) {
      return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'Token expired. Please re-enrol.' }) };
    }

    // Verify signature
    // (denylist check below is intentionally after signature verification)
    const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
    const crypto = require('crypto');
    const hmacSig = crypto.createHmac('sha256', jwtSecret).update(parts[0]).digest('base64url');
    const legacySig = Buffer.from(`${parts[0]}.${jwtSecret}`).toString('base64').slice(0, 32);
    if (parts[1] !== hmacSig && parts[1] !== legacySig) {
      return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'Invalid token' }) };
    }

    // Denylist check — after signature verified, so forged tokens can't probe the list
    if (REVOKED_EMAILS.includes(payload.email?.toLowerCase())) {
      console.log(`Blocked revoked account: ${payload.email}`);
      const ip = event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || 'unknown';
      const ts = new Date().toUTCString();
      if (process.env.RESEND_API_KEY) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Get Chartered AI <info@getcharteredai.com>',
            to: ['support@mabehq.com'],
            subject: `Access attempt — blocked account (${payload.email})`,
            text: `A blocked account tried to access Get Chartered AI.\n\nEmail: ${payload.email}\nTime: ${ts}\nIP: ${ip}\n\nThe login was rejected. No action needed unless this repeats unusually.`
          })
        }).catch(e => console.error('Alert email failed:', e.message));
      }
      return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'Account suspended.' }) };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        valid: true,
        email: payload.email,
        plan: payload.plan,
        activatedAt: payload.activatedAt
      })
    };

  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'Invalid token' }) };
  }
};
