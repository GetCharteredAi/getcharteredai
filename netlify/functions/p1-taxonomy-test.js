// netlify/functions/p1-taxonomy-test.js
// TEMPORARY — taxonomy v1 discrimination test trigger. Delete after results captured.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const TEST_TOKEN = 'taxonomy-test-cf02ea9';
const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

function getTestStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-taxonomy-test`)
    : getStore({ name: `${PREFIX}p1-taxonomy-test`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (body.testToken !== TEST_TOKEN) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };

  const runId = crypto.randomUUID();
  const store = getTestStore();
  await store.setJSON(`run/${runId}`, { status: 'pending', runId, startedAt: Date.now() });

  const siteUrl = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';
  await fetch(`${siteUrl}/.netlify/functions/p1-taxonomy-test-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, testToken: TEST_TOKEN })
  }).catch(e => console.error('[p1-taxonomy-test] Background trigger failed:', e.message));

  return { statusCode: 202, headers: HEADERS, body: JSON.stringify({ runId, status: 'pending' }) };
};
