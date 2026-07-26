// netlify/functions/get-selfpaced-modules.js
// Returns the current unlocked module list for a self-paced candidate

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

  const { token } = body;
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token required' }) };

  // Decode and verify JWT
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  let payload;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error('Malformed token');
    const expectedSig = Buffer.from(`${parts[0]}.${jwtSecret}`).toString('base64').slice(0, 32);
    if (parts[1] !== expectedSig) throw new Error('Invalid signature');
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

  try {
    const store = getStore({
      name: 'selfpaced-progress',
      siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
    });

    const raw = await store.get(email);
    if (!raw) {
      // Blobs record missing — return Module 1 only as safe default
      console.warn(`get-selfpaced-modules: no Blobs record for ${email}, returning default`);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ unlockedModules: [1], nextModule: 2, totalModules: 12 })
      };
    }

    const record = JSON.parse(raw);
    const unlockedModules = record.unlockedModules || [1];
    const maxUnlocked = Math.max(...unlockedModules);
    const nextModule = maxUnlocked < 12 ? maxUnlocked + 1 : null;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ unlockedModules, nextModule, totalModules: 12 })
    };
  } catch (err) {
    console.error('get-selfpaced-modules error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not read module access. Contact info@getcharteredai.com' }) };
  }
};
