// TESTING ONLY — DELETE BEFORE PRODUCTION

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
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email, secret } = body;
  const testSecret = process.env.TEST_SECRET;

  if (!testSecret || secret !== testSecret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email required' }) };
  }

  const activatedAt = Date.now();
  const payload = {
    email: email.toLowerCase().trim(),
    plan: 'year-one',
    activatedAt,
    expires: activatedAt + 30 * 24 * 60 * 60 * 1000
  };

  const jwtSecret = process.env.JWT_SECRET || 'gca-secure-platform-2025-apc';
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  const token = `${tokenData}.${signature}`;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, token, email: payload.email, plan: 'year-one' })
  };
};
