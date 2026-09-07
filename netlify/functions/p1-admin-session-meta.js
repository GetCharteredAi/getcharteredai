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

  // Seed probe: copy manager-safe from a completed session into a target session and
  // advance the target metadata to manager-lapsed. Used for lapsed-route testing only.
  if (probe === 'seed-lapsed' && sessionId) {
    const SOURCE = '90d1a789-2dab-4974-a27c-6d9cb799fc2d';
    const store = getSessionStore();
    const [sourceMeta, sourceManagerSafe, sourceCandidatePrivate, targetMeta] = await Promise.all([
      store.get(`${SOURCE}/metadata`, { type: 'json' }),
      store.get(`${SOURCE}/manager-safe`, { type: 'json' }),
      store.get(`${SOURCE}/candidate-private`, { type: 'json' }),
      store.get(`${sessionId}/metadata`, { type: 'json' })
    ]);
    if (!sourceManagerSafe) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Source manager-safe not found' }) };
    if (!sourceCandidatePrivate) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Source candidate-private not found' }) };
    if (!targetMeta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Target session not found' }) };
    const now = Date.now();
    await store.setJSON(`${sessionId}/manager-safe`, sourceManagerSafe);
    await store.setJSON(`${sessionId}/candidate-private`, sourceCandidatePrivate);
    await store.setJSON(`${sessionId}/metadata`, {
      ...targetMeta,
      status: 'manager-lapsed',
      candidateCompletedAt: now,
      candidateSelectedPriority: sourceMeta?.candidateSelectedPriority || 'Feedback, Reflection & Development',
      managerInvitedAt: now - 28 * 24 * 60 * 60 * 1000
    });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, status: 'manager-lapsed' }) };
  }

  // Blob-check probe: verify whether named blob exists and its top-level keys.
  if (probe === 'check-blob' && sessionId && body.blobName) {
    const allowed = ['candidate-private', 'manager-safe', 'synthesis', 'manager-responses', 'agreed-priorities'];
    if (!allowed.includes(body.blobName)) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown blob' }) };
    const blob = await getSessionStore().get(`${sessionId}/${body.blobName}`, { type: 'json' });
    const result = { exists: blob !== null, topLevelKeys: blob ? Object.keys(blob) : [] };
    if (body.blobName === 'agreed-priorities' && blob) {
      result.agreedBy = blob.agreedBy;
      result.priorityCount = (blob.agreedPriorities || []).length;
      result.reviewDate = blob.reviewDate;
    }
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
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
