// netlify/functions/p1-candidate-self-plan.js
// POST { token, agreedPriorities: string[], reviewDate: 'YYYY-MM-DD' }
// Candidate token only (manager-lapsed route). Requires status === 'manager-lapsed'.
// Rejects if self-plan already recorded (no-overwrite).
// Accepts exactly 2–3 non-empty priorities; >3 rejected before sanitisation.
// Writes {sessionId}/agreed-priorities with agreedBy: 'candidate'.
// Status remains 'manager-lapsed' — does NOT transition to reflection-ready.
// Sets selfPlanSetAt and progressReflectionDueAt in metadata.

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const crypto = require('crypto');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

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

  const { token, agreedPriorities, reviewDate } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'candidate') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!Array.isArray(agreedPriorities)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'agreedPriorities must be an array' }) };
  }
  if (agreedPriorities.length > 3) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'A maximum of 3 priorities may be submitted' }) };
  }

  const sanitised = agreedPriorities
    .map(p => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  if (sanitised.length < 2) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Between 2 and 3 development priorities are required' }) };
  }

  if (!reviewDate || !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'A valid review date is required (YYYY-MM-DD)' }) };
  }

  const { sessionId } = payload;

  try {
    const sessionStore = getSessionStore();
    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

    if (meta.status !== 'manager-lapsed') {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Session is not in the right state to record a self-plan.' }) };
    }

    const existing = await sessionStore.get(`${sessionId}/agreed-priorities`, { type: 'json' });
    if (existing) {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'A development plan has already been recorded for this session.' }) };
    }

    const now = Date.now();
    const progressReflectionDueAt = new Date(reviewDate + 'T00:00:00Z').getTime();

    await sessionStore.setJSON(`${sessionId}/agreed-priorities`, {
      schemaVersion: 'benchmark-v1',
      agreedPriorities: sanitised,
      reviewDate,
      agreedBy: 'candidate',
      recordedAt: now
    });

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      selfPlanSetAt: now,
      progressReflectionDueAt,
      selfPlanReviewDate: reviewDate
    });

    console.log(`[p1-candidate-self-plan] Self-plan recorded for session ${sessionId}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[p1-candidate-self-plan] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not save development plan' }) };
  }
};
