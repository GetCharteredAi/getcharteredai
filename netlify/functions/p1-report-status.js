// netlify/functions/p1-report-status.js
// Polling endpoint for candidate report generation.
// Called every 8s by the frontend after submitting to p1-generate-report-background.
// POST { token, runToken }

const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const JOB_TIMEOUT_MS = 10 * 60 * 1000;

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, runToken } = body;
  if (!token || !runToken) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token or runToken' }) };

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'candidate') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getSessionStore();
    const { sessionId } = payload;
    const jobKey = `${sessionId}/jobs/candidate-report`;
    const job = await store.get(jobKey, { type: 'json' });

    if (!job || job.runToken !== runToken) {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'none' }) };
    }

    if (job.status === 'pending') {
      if (Date.now() - job.startedAt > JOB_TIMEOUT_MS) {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'failed', error: 'timeout' }) };
      }
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'pending' }) };
    }

    if (job.status === 'complete') {
      const privateData = await store.get(`${sessionId}/candidate-private`, { type: 'json' });
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ status: 'complete', report: privateData?.report || null })
      };
    }

    if (job.status === 'failed') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'failed', error: job.error || 'unknown' }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'none' }) };

  } catch (err) {
    console.error('[p1-report-status] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not check status' }) };
  }
};
