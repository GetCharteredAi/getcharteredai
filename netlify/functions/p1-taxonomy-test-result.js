// netlify/functions/p1-taxonomy-test-result.js
// TEMPORARY — taxonomy v1 discrimination test result poll. Delete after results captured.

const { getStore } = require('@netlify/blobs');
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
  if (!body.runId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'runId required' }) };

  try {
    const store = getTestStore();
    const result = await store.get(`run/${body.runId}`, { type: 'json' });
    if (!result) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ status: 'not-found' }) };
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
