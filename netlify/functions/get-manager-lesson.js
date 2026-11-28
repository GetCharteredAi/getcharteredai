// netlify/functions/get-manager-lesson.js
// Verifies manager-learning JWT, checks active agreement + roster, and returns
// only published learning topics with server-only section fields stripped.
// POST { token }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const { loadPublishedTopics } = require('./utils/lessons-loader');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

// Published topics loaded at module startup; test suites inject via require.cache.
// A LessonsLoadError is captured here and surfaced as 503 per-request rather than
// preventing the module from loading — auth checks still work if data is unavailable.
let publishedTopics = [];
let topicsLoadError = null;
try {
  publishedTopics = loadPublishedTopics();
} catch (e) {
  topicsLoadError = e;
  console.error('[get-manager-lesson] Failed to load lesson data:', e.message);
}

// Validates every published topic and its nested sections, then strips server-only
// fields before sending to the client.
// Throws if any topic or section fails structural validation — the caller returns 503
// so a corrupt data file is never silently truncated into a partial client response.
function toClientTopics(topics) {
  for (const t of topics) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' ||
        typeof t.title !== 'string' || !Array.isArray(t.sections)) {
      const msg = `[get-manager-lesson] Published topic failed structural validation: id=${t?.id ?? '(no id)'}`;
      console.error(msg);
      throw new Error(msg);
    }
    for (const s of t.sections) {
      if (!s || typeof s !== 'object' || typeof s.sectionType !== 'string') {
        const msg = `[get-manager-lesson] Topic "${t.id}" contains an invalid section`;
        console.error(msg);
        throw new Error(msg);
      }
    }
  }
  return topics.map(topic => ({
    ...topic,
    sections: topic.sections.map(({ practiceCharacter: _pc, ...rest }) => rest)
  }));
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Store helpers ─────────────────────────────────────────────────────────────

function getAgreementStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-employer-agreements`)
    : getStore({ name: `${PREFIX}p1-employer-agreements`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getRosterStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-manager-roster`)
    : getStore({ name: `${PREFIX}p1-manager-roster`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig       = token.slice(lastDot + 1);
  const hmacSig   = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  if (sig !== hmacSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (typeof payload.expires !== 'number' || !isFinite(payload.expires) || Date.now() >= payload.expires) return null;
    return payload;
  } catch { return null; }
}

// ── Error helper ──────────────────────────────────────────────────────────────

function err(statusCode, message) {
  return { statusCode, headers: HEADERS, body: JSON.stringify({ error: message }) };
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let body;
  try { body = JSON.parse(event.body); }
  catch { return err(400, 'Invalid JSON body'); }

  const { token } = body;
  if (!token || typeof token !== 'string') return err(401, 'token is required');

  let payload;
  try { payload = verifyToken(token); }
  catch { return err(500, 'Server configuration error'); }
  if (!payload) return err(401, 'Invalid or expired token');
  if (payload.role !== 'manager-learning') return err(403, 'Forbidden: manager-learning token required');

  const { email, employerKey } = payload;
  if (!employerKey || !UUID_RE.test(employerKey)) return err(403, 'Malformed token');

  // Check agreement is active
  const agreementStore = getAgreementStore();
  const agreement      = await agreementStore.get(employerKey, { type: 'json' });
  if (!agreement)               return err(403, 'Employer agreement not found');
  if (!agreement.serviceActive) return err(403, 'Employer agreement is not active');
  if (new Date(agreement.serviceExpiresAt) <= new Date()) return err(403, 'Employer agreement has expired');

  // Check manager is still active on roster
  const rosterStore = getRosterStore();
  const rosterKey   = `${employerKey}/${Buffer.from(email).toString('base64url')}`;
  const rosterEntry = await rosterStore.get(rosterKey, { type: 'json' });
  if (!rosterEntry || !rosterEntry.active) {
    return err(403, 'Manager is not on the active roster');
  }

  if (topicsLoadError) {
    return err(503, 'Learning content is temporarily unavailable');
  }

  let clientTopics;
  try {
    clientTopics = toClientTopics(publishedTopics);
  } catch {
    return err(503, 'Learning content is temporarily unavailable');
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ authorized: true, topics: clientTopics })
  };
};
