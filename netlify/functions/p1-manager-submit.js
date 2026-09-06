// netlify/functions/p1-manager-submit.js
// Receives manager's M1–M7 responses, saves them, advances status to synthesising,
// and triggers p1-synthesis-background.
// POST { token, responses: { M1, M2, M3, M4, M5, M6, M7 } }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const crypto = require('crypto');

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch { return null; }
}

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, responses } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };
  if (!responses || typeof responses !== 'object') {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing responses' }) };
  }

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'manager') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { sessionId } = payload;

  try {
    const sessionStore = getSessionStore();
    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

    if (meta.currentManagerInviteKey !== token) {
      return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'This invitation link has been superseded.' }) };
    }

    if (meta.status !== 'awaiting-manager') {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Manager input already received or session not ready.' }) };
    }

    const now = Date.now();

    // Save manager responses
    await sessionStore.setJSON(`${sessionId}/manager-responses`, {
      schemaVersion: 'benchmark-v1',
      responses: {
        M1: responses.M1 || '',
        M2: responses.M2 || '',
        M3: responses.M3 || '',
        M4: responses.M4 || '',
        M5: responses.M5 || '',
        M6: responses.M6 || '',
        M7: responses.M7 || ''
      },
      submittedAt: now
    });

    // Advance status
    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'synthesising',
      managerCompletedAt: now
    });

    // Fire-and-forget synthesis
    const siteUrl = process.env.URL || 'https://getcharteredai.com';
    const internalSecret = process.env.P1_INTERNAL_SECRET;
    if (internalSecret) {
      fetch(`${siteUrl}/.netlify/functions/p1-synthesis-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, internalSecret })
      }).catch(e => console.error('[p1-manager-submit] Synthesis trigger failed:', e.message));
    } else {
      console.warn('[p1-manager-submit] P1_INTERNAL_SECRET not set — synthesis not triggered');
    }

    console.log(`[p1-manager-submit] Manager responses saved for session ${sessionId}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[p1-manager-submit] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not save responses' }) };
  }
};
