// netlify/functions/p1-cohort-snapshot-trigger.js
// Debounced trigger for cohort snapshot recompute. Internal secret gate.
// Called by Phase 1–4 background functions after writing cohort-safe (once wired).
// POST { sessionId, internalSecret }
// 15-minute debounce per cohort — skips if recompute triggered recently.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const DEBOUNCE_MS = 15 * 60 * 1000;

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
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400 }; }

  const { sessionId, internalSecret } = body;
  if (!internalSecret || internalSecret !== process.env.P1_INTERNAL_SECRET) return { statusCode: 403 };
  if (!sessionId) return { statusCode: 400 };

  try {
    const sessionStore = getSessionStore();
    const cohortStore = getCohortStore();

    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta?.cohortId) return { statusCode: 200, body: JSON.stringify({ skipped: 'no_cohort' }) };

    const { cohortId } = meta;

    // Debounce: skip if triggered within the last 15 minutes
    const triggerState = await cohortStore.get(`${cohortId}/lastTriggerAt`, { type: 'json' });
    if (triggerState?.at && (Date.now() - triggerState.at) < DEBOUNCE_MS) {
      return { statusCode: 200, body: JSON.stringify({ skipped: 'debounced' }) };
    }

    await cohortStore.setJSON(`${cohortId}/lastTriggerAt`, { at: Date.now() });

    const siteUrl = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';
    const runToken = crypto.randomUUID();
    fetch(`${siteUrl}/.netlify/functions/p1-cohort-analytics-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cohortId, internalSecret: process.env.P1_INTERNAL_SECRET, runToken })
    }).catch(() => {});

    return { statusCode: 202, body: JSON.stringify({ triggered: true, cohortId }) };

  } catch (err) {
    console.error('[p1-cohort-snapshot-trigger] Error:', err.message);
    return { statusCode: 500 };
  }
};
