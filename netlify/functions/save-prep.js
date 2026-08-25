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
    const { token, entry } = JSON.parse(event.body);
    if (!token || !entry) return { statusCode: 400, body: JSON.stringify({ success: false }) };

    const payload = verifyToken(token);
    const email = payload.email;

    const store = getStore({ name: 'prep-entries', siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN });

    let entries = [];
    try {
      const existing = await store.get(email);
      if (existing) entries = JSON.parse(existing);
    } catch(e) {}

    let savedEntry;
    const idx = entry.id ? entries.findIndex(e => e.id === entry.id) : -1;

    if (idx !== -1) {
      entries[idx] = { ...entries[idx], ...entry };
      savedEntry = entries[idx];
    } else {
      savedEntry = {
        id: entry.id || Date.now().toString(),
        competency: entry.competency,
        level: entry.level,
        situation: entry.situation,
        decision: entry.decision,
        action: entry.action,
        outcome: entry.outcome,
        michaelFeedback: entry.michaelFeedback || null,
        createdAt: entry.createdAt || new Date().toISOString()
      };
      entries.unshift(savedEntry);
    }

    await store.set(email, JSON.stringify(entries));

    return { statusCode: 200, body: JSON.stringify({ success: true, entry: savedEntry }) };
  } catch(e) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
