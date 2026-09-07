// netlify/functions/p1-admin-progress-probe.js
// Test scaffold only — read-only Phase 4 safety probe.
// POST { adminSecret, probe: 'check-phase4-eligible' }
// Lists sessions at reflection-ready / manager-lapsed and reports Phase 4 eligibility.
// Does not mutate any session. DELETE BEFORE MERGE TO MAIN.

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

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
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }
  const { adminSecret, probe } = body;
  if (!adminSecret || adminSecret !== process.env.P1_ADMIN_SECRET) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  if (probe === 'check-phase4-eligible') {
    const cohortStore = getCohortStore();
    const sessionStore = getSessionStore();
    const cohorts = await cohortStore.get('index', { type: 'json' }) || [];
    const now = Date.now();
    const ELIGIBLE_STATUSES = ['reflection-ready', 'manager-lapsed'];
    const results = [];

    for (const cohort of cohorts) {
      const sessionIds = await cohortStore.get(`${cohort.cohortId}/sessions`, { type: 'json' }) || [];
      for (const sessionId of sessionIds) {
        const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
        if (!meta || !ELIGIBLE_STATUSES.includes(meta.status)) continue;
        const dueAt = meta.progressReflectionDueAt || null;
        const reviewDateTs = meta.agreedReviewDate
          ? new Date(meta.agreedReviewDate + 'T00:00:00Z').getTime()
          : (meta.selfPlanReviewDate ? new Date(meta.selfPlanReviewDate + 'T00:00:00Z').getTime() : null);
        const effectiveDue = dueAt || reviewDateTs;
        results.push({
          sessionId,
          status: meta.status,
          firmName: meta.firmName || '(unknown)',
          progressReflectionDueAt: dueAt,
          agreedReviewDate: meta.agreedReviewDate || null,
          selfPlanReviewDate: meta.selfPlanReviewDate || null,
          effectiveDueAt: effectiveDue,
          dueAtHuman: effectiveDue ? new Date(effectiveDue).toISOString().slice(0, 10) : null,
          isEligibleNow: effectiveDue ? effectiveDue <= now : false,
          progressReflectionOpenedAt: meta.progressReflectionOpenedAt || null
        });
      }
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ probe: 'check-phase4-eligible', asOf: new Date().toISOString(), count: results.length, sessions: results }) };
  }

  return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown probe' }) };
};
