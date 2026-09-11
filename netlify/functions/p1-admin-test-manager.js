// netlify/functions/p1-admin-test-manager.js
// TEMPORARY TEST UTILITY — delete after test phase is complete.
// Finds the most recent p1-test-* session at candidate-complete or
// awaiting-manager status and returns (or creates) the manager URL.
// Protected by ADMIN_TEST_KEY. Hard-refuses all non-p1-test-* sessions.
// Does not send email. Does not touch any real session.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const MANAGER_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getInviteStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-invites`)
    : getStore({ name: `${PREFIX}p1-invites`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function generateToken(payload) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: 'Method not allowed' };

  const adminKey = process.env.ADMIN_TEST_KEY;
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  if (!adminKey || body.adminKey !== adminKey) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };

  try {
    const sessionStore = getSessionStore();

    // List only p1-test-* keys, keep /metadata entries
    const { blobs } = await sessionStore.list({ prefix: 'p1-test-' });
    const metaKeys = blobs.map(b => b.key).filter(k => k.endsWith('/metadata'));
    if (!metaKeys.length) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'No test sessions found' }) };

    // Read all, filter to completed sessions, most recent first
    const metas = (await Promise.all(metaKeys.map(k => sessionStore.get(k, { type: 'json' }).catch(() => null))))
      .filter(m => m && m.sessionId?.startsWith('p1-test-') && ['candidate-complete', 'awaiting-manager'].includes(m.status))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!metas.length) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'No completed test sessions found — complete the Benchmark first' }) };

    const meta = metas[0];
    const { sessionId } = meta;

    // Hard safety guard — never operate on a real session
    if (!sessionId.startsWith('p1-test-')) return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Safety guard: not a p1-test- session' }) };

    const siteUrl = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';

    // Existing token — return URL, no writes
    if (meta.status === 'awaiting-manager' && meta.currentManagerInviteKey) {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({
        sessionId,
        status: meta.status,
        managerUrl: `${siteUrl}/professional-readiness-benchmark?token=${meta.currentManagerInviteKey}`,
        source: 'existing_token'
      })};
    }

    // No token yet — generate, write to invites, advance to awaiting-manager
    const now = Date.now();
    const managerToken = generateToken({ sessionId, role: 'manager', email: meta.managerEmail, expires: now + MANAGER_TOKEN_TTL_MS });
    const inviteStore = getInviteStore();
    await inviteStore.setJSON(managerToken, { sessionId, role: 'manager', expiresAt: now + MANAGER_TOKEN_TTL_MS, issuedAt: now });
    const fresh = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    await sessionStore.setJSON(`${sessionId}/metadata`, { ...fresh, status: 'awaiting-manager', managerInvitedAt: now, currentManagerInviteKey: managerToken });

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({
      sessionId,
      status: 'awaiting-manager',
      managerUrl: `${siteUrl}/professional-readiness-benchmark?token=${managerToken}`,
      source: 'new_token'
    })};

  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
