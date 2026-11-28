// netlify/functions/p1-manager-learning-claim.js
// Redeems a single-use manager invite token and issues a 30-day manager-learning JWT.
// POST { claimToken }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const MGR_LEARNING_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Store helpers ─────────────────────────────────────────────────────────────

function getMgrInviteStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-invites`)
    : getStore({ name: `${PREFIX}p1-mgr-invites`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getClaimMarkerStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-claimed`)
    : getStore({ name: `${PREFIX}p1-mgr-claimed`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getRosterStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-manager-roster`)
    : getStore({ name: `${PREFIX}p1-manager-roster`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getAgreementStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-employer-agreements`)
    : getStore({ name: `${PREFIX}p1-employer-agreements`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
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

function generateToken(payload) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
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

  const { claimToken } = body;
  if (!claimToken || typeof claimToken !== 'string') return err(400, 'claimToken is required');

  // Verify the invite token signature and expiry
  let invitePayload;
  try { invitePayload = verifyToken(claimToken); }
  catch { return err(500, 'Server configuration error'); }
  if (!invitePayload) return err(401, 'Invalid or expired claim token');
  if (invitePayload.role !== 'manager-invite') return err(401, 'Invalid token type');

  const { tokenUuid, email, employerKey } = invitePayload;
  if (!tokenUuid || !UUID_RE.test(tokenUuid)) return err(401, 'Malformed claim token');
  if (!employerKey || !UUID_RE.test(employerKey)) return err(401, 'Malformed claim token');

  // Atomic single-use claim — first request wins; concurrent requests return 409.
  const claimStore  = getClaimMarkerStore();
  const claimResult = await claimStore.setJSON(tokenUuid, {
    claimedAt:         new Date().toISOString(),
    safeToDeleteAfter: new Date(invitePayload.expires).toISOString()
  }, { onlyIfNew: true });
  if (!claimResult.modified) {
    return err(409, 'This invitation has already been used');
  }

  // Confirm the invite record still exists in the invite store (belt-and-suspenders).
  const mgrInviteStore = getMgrInviteStore();
  const inviteRecord   = await mgrInviteStore.get(tokenUuid, { type: 'json' });
  if (!inviteRecord) {
    // Claim marker is set but invite record is gone — treat as already used.
    return err(409, 'This invitation has already been used');
  }

  // Check agreement is active before issuing a long-lived token.
  const agreementStore = getAgreementStore();
  const agreement      = await agreementStore.get(employerKey, { type: 'json' });
  if (!agreement)              return err(403, 'Employer agreement not found');
  if (!agreement.serviceActive) return err(403, 'Employer agreement is not active');
  if (new Date(agreement.serviceExpiresAt) <= new Date()) return err(403, 'Employer agreement has expired');

  // Check manager is still on the active roster.
  const rosterStore = getRosterStore();
  const rosterKey   = `${employerKey}/${Buffer.from(email).toString('base64url')}`;
  const rosterEntry = await rosterStore.get(rosterKey, { type: 'json' });
  if (!rosterEntry || !rosterEntry.active) {
    return err(403, 'Manager is not on the active roster');
  }

  // Record claimedAt on roster entry
  await rosterStore.setJSON(rosterKey, { ...rosterEntry, claimedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

  // Delete the invite record — it is consumed
  await mgrInviteStore.delete(tokenUuid);

  // Issue 30-day manager-learning JWT
  const learningPayload = {
    role:        'manager-learning',
    email,
    employerKey,
    expires:     Date.now() + MGR_LEARNING_TTL_MS
  };
  let learningToken;
  try { learningToken = generateToken(learningPayload); }
  catch { return err(500, 'Server configuration error'); }

  console.log(`[p1-mgr-claim] Issued manager-learning token for ${email} under ${employerKey}`);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ learningToken })
  };
};
