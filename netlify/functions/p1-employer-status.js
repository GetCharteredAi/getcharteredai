// netlify/functions/p1-employer-status.js
// Returns cohort status list for an employer token.
// Reads by cohortId. Verifies token email matches employerContactEmail on cohort record.
// POST { token }

const { getStore } = require('@netlify/blobs');

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
  const crypto = require('crypto');
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
    ? getStore('p1-sessions')
    : getStore({ name: 'p1-sessions', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('p1-cohorts')
    : getStore({ name: 'p1-cohorts', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'employer') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const cohortStore  = getCohortStore();
    const sessionStore = getSessionStore();

    // Verify employer owns this cohort
    const index = await cohortStore.get('index', { type: 'json' }) || [];
    const cohort = index.find(c => c.cohortId === payload.cohortId);
    if (!cohort) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Cohort not found' }) };
    if (cohort.employerContactEmail !== payload.email) {
      return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const sessionIds = await cohortStore.get(`${payload.cohortId}/sessions`, { type: 'json' }) || [];

    const sessions = await Promise.all(
      sessionIds.map(async sid => {
        const meta = await sessionStore.get(`${sid}/metadata`, { type: 'json' });
        if (!meta) return null;
        return {
          sessionId: sid,
          candidateEmail: meta.candidateEmail,
          status: meta.status,
          createdAt: meta.createdAt,
          candidateStartedAt: meta.candidateStartedAt,
          candidateCompletedAt: meta.candidateCompletedAt,
          managerInvitedAt: meta.managerInvitedAt,
          managerCompletedAt: meta.managerCompletedAt
        };
      })
    );

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        cohortId: payload.cohortId,
        firmName: cohort.firmName,
        cohortStatus: cohort.status,
        sessions: sessions.filter(Boolean)
      })
    };

  } catch (err) {
    console.error('[p1-employer-status] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not load cohort status' }) };
  }
};
