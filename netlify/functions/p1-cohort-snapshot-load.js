// netlify/functions/p1-cohort-snapshot-load.js
// Returns the pre-computed cohort intelligence snapshot for an employer token.
// Fires background recompute if snapshot is missing, stale (>1 hour), or last job failed.
// POST { token }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const STALE_MS = 60 * 60 * 1000; // 1 hour

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

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function fireAnalytics(cohortId) {
  const siteUrl = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';
  const runToken = crypto.randomUUID();
  fetch(`${siteUrl}/.netlify/functions/p1-cohort-analytics-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cohortId, internalSecret: process.env.P1_INTERNAL_SECRET, runToken })
  }).catch(() => {});
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };

  let payload;
  try { payload = verifyToken(token); }
  catch { return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Token verification failed' }) }; }

  if (!payload || payload.role !== 'employer') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { cohortId } = payload;

  try {
    const cohortStore = getCohortStore();

    // Verify employer owns this cohort
    const index = await cohortStore.get('index', { type: 'json' }) || [];
    const cohort = index.find(c => c.cohortId === cohortId);
    if (!cohort) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Cohort not found' }) };
    if (cohort.employerContactEmail !== payload.email) {
      return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const [snapshot, jobStatus] = await Promise.all([
      cohortStore.get(`${cohortId}/snapshot`, { type: 'json' }),
      cohortStore.get(`${cohortId}/jobs/analytics`, { type: 'json' })
    ]);

    const isAlreadyPending = jobStatus?.status === 'pending';
    const isStale = !snapshot || (Date.now() - (snapshot.computedAt || 0)) > STALE_MS;
    const lastJobFailed = jobStatus?.status === 'failed';

    const shouldFire = (isStale || lastJobFailed) && !isAlreadyPending;
    if (shouldFire) fireAnalytics(cohortId);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        snapshot: snapshot || null,
        computing: isAlreadyPending || shouldFire,
        cohortId,
        firmName: cohort.firmName
      })
    };

  } catch (err) {
    console.error('[p1-cohort-snapshot-load] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not load snapshot' }) };
  }
};
