// netlify/functions/p1-demo-reset.js
// ONE-SHOT JOB RESET — DELETE THIS FILE IMMEDIATELY AFTER USE.
// Resets a stuck analytics job from 'pending' to 'failed' so snapshot-load
// will re-trigger analytics on the next dashboard request.
//
// POST { "confirm": "fletcher-reset-2026", "cohortId": "<id>" }

const { getStore } = require('@netlify/blobs');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const CONFIRM_TOKEN = 'fletcher-reset-2026';
const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: '{}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }

  if (body.confirm !== CONFIRM_TOKEN || !body.cohortId) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'forbidden' }) };
  }

  const cohortStore = process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });

  const jobKey = `${body.cohortId}/jobs/analytics`;
  const existing = await cohortStore.get(jobKey, { type: 'json' });
  await cohortStore.setJSON(jobKey, { status: 'failed', error: 'manual_reset', resetAt: Date.now() });

  return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, was: existing?.status }) };
};
