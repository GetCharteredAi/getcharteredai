// netlify/functions/p1-confirm-progress-priorities.js
// POST { token, confirmedPriorities: string[], reviewDate: 'YYYY-MM-DD' }
// Candidate token only. Requires status === 'progress-ready'.
// Candidate confirms or adjusts Michael's proposed priorities.
// Overwrites {sessionId}/agreed-priorities with new canonical active plan.
// priorities-history already holds the prior plan (written at reflection submission).
// Status → progress-complete. V1 terminal state.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

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

  const { token, confirmedPriorities, reviewDate } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'candidate') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!Array.isArray(confirmedPriorities) || confirmedPriorities.length > 3) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'confirmedPriorities must be an array of up to 3 items' }) };
  }

  const sanitised = confirmedPriorities
    .map(p => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  if (sanitised.length < 2) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Between 2 and 3 priorities are required' }) };
  }

  if (!reviewDate || !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'A valid review date is required (YYYY-MM-DD)' }) };
  }

  const { sessionId } = payload;

  try {
    const sessionStore = getSessionStore();
    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

    if (meta.status !== 'progress-ready') {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Session is not ready for priority confirmation.' }) };
    }

    const now = Date.now();

    await sessionStore.setJSON(`${sessionId}/agreed-priorities`, {
      schemaVersion: 'benchmark-v1',
      agreedPriorities: sanitised,
      reviewDate,
      agreedBy: 'candidate',
      recordedAt: now
    });

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'progress-complete',
      progressRefreshedAt: now,
      progressReviewDate: reviewDate
    });

    console.log(`[p1-confirm-progress-priorities] Priorities confirmed for session ${sessionId}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[p1-confirm-progress-priorities] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not confirm priorities' }) };
  }
};
