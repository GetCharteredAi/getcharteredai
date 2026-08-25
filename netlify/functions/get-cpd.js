const { getStore } = require('@netlify/blobs');

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Invalid token format');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  if (payload.expires && Date.now() > payload.expires) throw new Error('Token expired');
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const crypto = require('crypto');
  const hmacSig = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const legacySig = Buffer.from(`${parts[0]}.${secret}`).toString('base64').slice(0, 32);
  if (parts[1] !== hmacSig && parts[1] !== legacySig) throw new Error('Invalid token');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { token } = JSON.parse(event.body);
    if (!token) return { statusCode: 400, body: JSON.stringify({ success: false }) };

    const payload = verifyToken(token);
    const email = payload.email;

    const store = getStore({ name: 'cpd-logs', siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN });

    let entries = [];
    let readError = false;
    try {
      const existing = await store.get(email);
      if (existing) entries = JSON.parse(existing);
    } catch(e) {
      console.error('CPD read failed:', e.name, e.message, 'status:', e.status);
      readError = true;
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, entries, readError }) };
  } catch(e) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
