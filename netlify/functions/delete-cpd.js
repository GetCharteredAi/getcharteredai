const { getStore } = require('@netlify/blobs');

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Invalid token format');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  if (payload.expires && Date.now() > payload.expires) throw new Error('Token expired');
  const secret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  const expectedSig = Buffer.from(`${parts[0]}.${secret}`).toString('base64').slice(0, 32);
  if (parts[1] !== expectedSig) throw new Error('Invalid token');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { token, entryId } = JSON.parse(event.body);
    if (!token || !entryId) return { statusCode: 400, body: JSON.stringify({ success: false }) };

    const payload = verifyToken(token);
    const email = payload.email;

    const store = getStore({ name: 'cpd-logs', siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN });

    let entries = [];
    try {
      const existing = await store.get(email);
      if (existing) entries = JSON.parse(existing);
    } catch(e) {}

    entries = entries.filter(e => e.id !== entryId);
    await store.set(email, JSON.stringify(entries));

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch(e) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
