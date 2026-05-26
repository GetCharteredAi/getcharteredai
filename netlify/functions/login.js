// netlify/functions/login.js
// Validates member token (no npm needed)

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
    const jwtSecret = process.env.JWT_SECRET || 'gca-secure-platform-2025-apc';
    const expectedSig = Buffer.from(`${parts[0]}.${jwtSecret}`).toString('base64').slice(0, 32);
    if (parts[1] !== expectedSig) {
      return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'Invalid token' }) };
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
