// netlify/functions/p1-manager-safe-status.js
// Polls manager-safe generation job status for the admin reversal flow.
// POST { adminSecret, sessionId }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const JOB_TIMEOUT_MS = 10 * 60 * 1000;

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

  const { adminSecret, sessionId } = body;

  if (!adminSecret || adminSecret !== process.env.P1_ADMIN_SECRET) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }
  if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };

  try {
    const store = getSessionStore();
    const job = await store.get(`${sessionId}/jobs/manager-safe`, { type: 'json' });

    if (!job) return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'none' }) };

    if (job.status === 'pending') {
      if (Date.now() - job.startedAt > JOB_TIMEOUT_MS) {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'failed', error: 'timeout' }) };
      }
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'pending' }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: job.status, error: job.error }) };

  } catch (err) {
    console.error('[p1-manager-safe-status] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not check status' }) };
  }
};
