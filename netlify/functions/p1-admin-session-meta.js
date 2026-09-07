// netlify/functions/p1-admin-session-meta.js
// Test scaffold only — retrieve session metadata for a given sessionId.
// POST { adminSecret, sessionId }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }
  const { adminSecret, sessionId, probe } = body;
  if (!adminSecret || adminSecret !== process.env.P1_ADMIN_SECRET) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Diagnostic probe: report P1_INTERNAL_SECRET presence and length without exposing value.
  if (probe === 'internal-secret') {
    const env = process.env.P1_INTERNAL_SECRET || '';
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({
      internalSecretPresent: !!process.env.P1_INTERNAL_SECRET,
      internalSecretLength: env.length,
      internalSecretTrimmedLength: env.trim().length
    }) };
  }

  // Comparison probe: test whether submitted value matches runtime secret, without exposing either.
  if (probe === 'check-internal-secret') {
    const { candidateSecret } = body;
    const env = process.env.P1_INTERNAL_SECRET || '';
    const exactMatch = candidateSecret === env;
    const trimMatch = (candidateSecret || '').trim() === env.trim();
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({
      exactMatch,
      trimMatch,
      sentLength: (candidateSecret || '').length,
      runtimeLength: env.length
    }) };
  }

  // Job-read probe: return a named job blob for a session without exposing private data.
  if (probe === 'read-job' && body.jobName && sessionId) {
    const allowed = ['synthesis', 'manager-safe', 'candidate-report', 'candidate-synthesis'];
    if (!allowed.includes(body.jobName)) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown job name' }) };
    }
    const job = await getSessionStore().get(`${sessionId}/jobs/${body.jobName}`, { type: 'json' });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ job }) };
  }

  if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };
  try {
    const meta = await getSessionStore().get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ meta }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
