// netlify/functions/p1-smoke-seed.js
// Smoke-test fixture seeder — feature/p1-phase5-smoke-test branch only.
// DO NOT MERGE TO MAIN.
//
// Internal-secret gated. Refuses to run unless P1_STORE_PREFIX starts with
// "smoke-" and the deployment URL is not production.
//
// POST { action, internalSecret, cohortId, ...payload }
//
// Actions
//   seed           — writes index entry, cohort/sessions list, and per-session
//                    blobs via native getStore (same namespace as other functions)
//   cleanup        — deletes all smoke-run blobs and removes the index entry
//   reset_debounce — deletes only {cohortId}/lastTriggerAt
//   set_stale      — reads current snapshot, overwrites computedAt to be stale,
//                    resets jobs/analytics so snapshot-load fires a recompute

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Guard 1: P1_STORE_PREFIX must start with 'smoke-'
  if (!process.env.P1_STORE_PREFIX?.startsWith('smoke-')) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden: not a smoke environment' }) };
  }

  // Guard 2: refuse on production
  const deployUrl = (process.env.P1_SITE_URL || process.env.URL || '').toLowerCase();
  if (deployUrl.includes('getcharteredai.com')) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden: production environment' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action, internalSecret, cohortId } = body;

  // Guard 3: internal secret
  if (!internalSecret || internalSecret !== process.env.P1_INTERNAL_SECRET) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Guard 4: known actions only
  const VALID_ACTIONS = new Set(['seed', 'cleanup', 'reset_debounce', 'set_stale']);
  if (!VALID_ACTIONS.has(action)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown action' }) };
  }

  // Guard 5: cohortId must start with 'smoke-'
  if (!cohortId || !cohortId.startsWith('smoke-')) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'cohortId must start with smoke-' }) };
  }

  const ss = getSessionStore();
  const cs = getCohortStore();

  try {

    // ── seed ──────────────────────────────────────────────────────────────────
    if (action === 'seed') {
      const { sessions, firmName, employerEmail } = body;

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessions array required for seed' }) };
      }
      for (const s of sessions) {
        if (!s.sessionId?.startsWith('smoke-') || !s.metadata || !s.cohortSafe) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Each session requires sessionId (smoke-*), metadata, cohortSafe' }) };
        }
      }
      if (!firmName || !employerEmail) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'firmName and employerEmail required for seed' }) };
      }

      const sessionIds = sessions.map(s => s.sessionId);

      // Upsert cohort index entry
      const idx = await cs.get('index', { type: 'json' }) || [];
      const fresh = idx.filter(c => c.cohortId !== cohortId);
      fresh.push({ cohortId, firmName, employerContactEmail: employerEmail, status: 'active', createdAt: Date.now() });
      await cs.setJSON('index', fresh);

      // Write cohort sessions list and per-session blobs
      await cs.setJSON(`${cohortId}/sessions`, sessionIds);
      for (const s of sessions) {
        await ss.setJSON(`${s.sessionId}/metadata`, s.metadata);
        await ss.setJSON(`${s.sessionId}/cohort-safe`, s.cohortSafe);
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ seeded: true, sessions: sessionIds.length }) };
    }

    // ── cleanup ───────────────────────────────────────────────────────────────
    if (action === 'cleanup') {
      const { sessionIds } = body;

      if (!Array.isArray(sessionIds)) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionIds array required for cleanup' }) };
      }
      for (const id of sessionIds) {
        if (!id.startsWith('smoke-')) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'All sessionIds must start with smoke-' }) };
        }
      }

      for (const id of sessionIds) {
        await ss.delete(`${id}/metadata`);
        await ss.delete(`${id}/cohort-safe`);
      }

      await cs.delete(`${cohortId}/sessions`);
      await cs.delete(`${cohortId}/snapshot`);
      await cs.delete(`${cohortId}/jobs/analytics`);
      await cs.delete(`${cohortId}/lastTriggerAt`);

      const idx = await cs.get('index', { type: 'json' }) || [];
      await cs.setJSON('index', idx.filter(c => c.cohortId !== cohortId));

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ cleaned: true }) };
    }

    // ── reset_debounce ────────────────────────────────────────────────────────
    if (action === 'reset_debounce') {
      await cs.delete(`${cohortId}/lastTriggerAt`);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ reset: true }) };
    }

    // ── set_stale ─────────────────────────────────────────────────────────────
    if (action === 'set_stale') {
      const { staleMs } = body;
      const snapshot = await cs.get(`${cohortId}/snapshot`, { type: 'json' });
      if (!snapshot) {
        return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Snapshot not found' }) };
      }
      const staleComputedAt = Date.now() - (staleMs || 2 * 60 * 60 * 1000);
      await cs.setJSON(`${cohortId}/snapshot`, { ...snapshot, computedAt: staleComputedAt });
      await cs.setJSON(`${cohortId}/jobs/analytics`, { status: 'complete', runToken: 'stale-sentinel', completedAt: staleComputedAt });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ stale: true, computedAt: staleComputedAt }) };
    }

  } catch (err) {
    console.error('[p1-smoke-seed] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
