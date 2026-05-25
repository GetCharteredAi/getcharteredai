// netlify/functions/login.js
// Validates member tokens: NEW 2-part format + legacy JWT (jsonwebtoken)

const jwt = require('jsonwebtoken');

const ALLOWED_ORIGINS = [
  'https://getcharteredai.com',
  'https://www.getcharteredai.com',
  'https://getcharteredai.netlify.app'
];

function corsOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function validateNewToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  if (payload.expires && Date.now() > payload.expires) {
    return { error: 'Token expired. Please re-enrol.' };
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { error: 'Invalid token' };

  const expectedSig = Buffer.from(`${parts[0]}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (parts[1] !== expectedSig) {
    return { error: 'Invalid token' };
  }

  return {
    valid: true,
    email: payload.email,
    plan: payload.plan,
    activatedAt: payload.activatedAt
  };
}

function validateLegacyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return { error: 'Invalid token' };

  const decoded = jwt.verify(token, secret);
  return {
    valid: true,
    email: decoded.email,
    plan: decoded.plan,
    activatedAt: decoded.activatedAt
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { token } = body;
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'No token' }) };
  }

  const partCount = token.split('.').length;

  try {
    let result;
    if (partCount === 2) {
      result = validateNewToken(token);
    } else if (partCount === 3) {
      result = validateLegacyJwt(token);
    } else {
      return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: 'Invalid token' }) };
    }

    if (result.error) {
      return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: result.error }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        email: result.email,
        plan: result.plan,
        activatedAt: result.activatedAt
      })
    };
  } catch (err) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ valid: false, error: 'Token expired or invalid. Please re-enrol.' })
    };
  }
};
