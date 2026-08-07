const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, report } = body;
  if (!token || !report) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token or report' }) };

  const payload = verifyToken(token);
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Unauthorised' }) };

  try {
    const store = getStore('yr1-reports');

    const existing = await store.get(payload.email, { type: 'json' });
    const retakeCount = (existing?.retakeCount ?? 0) + 1;

    if (retakeCount > 3) {
      return {
        statusCode: 403,
        headers: HEADERS,
        body: JSON.stringify({
          success: false,
          error: "You've used all 3 of your diagnostic attempts for this purchase. Contact support@getcharteredai.com if you need help."
        })
      };
    }

    await store.setJSON(payload.email, { report, savedAt: Date.now(), email: payload.email, retakeCount });
    console.log(`Report saved for ${payload.email} (attempt ${retakeCount} of 3)`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('save-report error:', err);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Could not save report' }) };
  }
};
