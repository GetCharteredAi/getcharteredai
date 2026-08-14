// netlify/functions/yr2-report-status.js
// Polling endpoint for Year Two report generation status.
// Called every 8s by the frontend after submitting to yr2-generate-report-background.

const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — background function limit is 15m

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

  const { token, runToken } = body;
  if (!token || !runToken) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token or runToken' }) };

  const payload = verifyToken(token);
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Unauthorised' }) };

  try {
    // Both job status and report data live in yr2-reports.
    // Job status key: `${email}:job` — avoids creating a new store.
    const store = getStore('yr2-reports');
    const jobKey = `${payload.email}:job`;
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
      const entry = await store.get(payload.email, { type: 'json' });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'complete', report: entry?.report || null }) };
    }

    if (job.status === 'failed') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'failed', error: job.error || 'unknown' }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: 'none' }) };

  } catch (err) {
    console.error('[yr2-report-status] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Could not check status', detail: String(err.message) }) };
  }
};
