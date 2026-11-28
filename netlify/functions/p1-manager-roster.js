// netlify/functions/p1-manager-roster.js
// Employer-authenticated endpoint: list, add, or remove managers under an employer agreement.
// POST { token, action: 'list'|'add'|'remove', email? }
// 'add' also sends a manager-learning claim invitation via Resend and writes the email index.
// 'remove' updates the email index to active:false.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const MGR_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;    // 7 days
const RATE_LIMIT_MS     = 5 * 60 * 1000;                // 5 minutes per email

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

function getMgrByEmailStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-by-email`)
    : getStore({ name: `${PREFIX}p1-mgr-by-email`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getMgrInviteStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-invites`)
    : getStore({ name: `${PREFIX}p1-mgr-invites`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getRateLimitStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-rl`)
    : getStore({ name: `${PREFIX}p1-mgr-rl`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

// ── Pagination helper ─────────────────────────────────────────────────────────

async function listAllBlobsForPrefix(store, prefix) {
  const all = [];
  let cursor;
  do {
    const result = cursor
      ? await store.list({ prefix, cursor })
      : await store.list({ prefix });
    all.push(...result.blobs);
    cursor = result.cursor;
  } while (cursor);
  return all;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig       = token.slice(lastDot + 1);
  const hmacSig   = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  // legacySig retained: this endpoint verifies 'employer' JWTs with a 365-day TTL.
  // Employers who uploaded between ~2025-10-11 and 2026-10-12 have legacy-signed tokens
  // still valid until 2026-10-11 through 2027-10-12. Removal requires JWT_SECRET rotation
  // to invalidate all pre-HMAC tokens simultaneously. Tracked in Token Legacy Removal memory.
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
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

// ── Email ─────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(content) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff">
    <div style="background:#0D0F1C;padding:20px 28px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#fff">Get Chartered <span style="color:#f59e0b">AI</span></span>
      <span style="font-size:11px;color:rgba(255,255,255,.4)">getcharteredai.com</span>
    </div>
    <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
      ${content}
    </div>
    <div style="padding:14px 28px;text-align:center">
      <p style="font-size:11px;color:#94a3b8;margin:0">Get Chartered AI &middot; <a href="https://getcharteredai.com" style="color:#94a3b8">getcharteredai.com</a></p>
    </div>
  </div>`;
}

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[p1-roster] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) {
    console.error(`[p1-roster] Email send failed to ${to}:`, e.message);
  }
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

  const { token, action, email } = body;

  // Verify employer JWT
  if (!token || typeof token !== 'string') return err(401, 'token is required');
  let payload;
  try { payload = verifyToken(token); }
  catch { return err(500, 'Server configuration error'); }
  if (!payload) return err(401, 'Invalid or expired token');
  if (payload.role !== 'employer') return err(403, 'Forbidden: employer token required');

  const { employerKey } = payload;
  if (!employerKey || !UUID_RE.test(employerKey)) {
    return err(403, 'Token does not contain a valid employerKey — re-upload required');
  }

  // Check agreement is active
  const agreementStore = getAgreementStore();
  const agreement = await agreementStore.get(employerKey, { type: 'json' });
  if (!agreement) return err(404, 'Employer agreement not found');
  if (!agreement.serviceActive) return err(403, 'Employer agreement is not active');
  if (new Date(agreement.serviceExpiresAt) <= new Date()) return err(403, 'Employer agreement has expired');

  const rosterStore = getRosterStore();

  // ── List ──────────────────────────────────────────────────────────────────────
  if (action === 'list') {
    const blobs = await listAllBlobsForPrefix(rosterStore, `${employerKey}/`);
    const managers = await Promise.all(
      blobs.map(async ({ key }) => {
        const record = await rosterStore.get(key, { type: 'json' });
        if (!record) return null;
        return {
          email:     record.email,
          active:    record.active,
          addedAt:   record.addedAt,
          claimedAt: record.claimedAt || null
        };
      })
    );
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ managers: managers.filter(Boolean) }) };
  }

  // ── Add ───────────────────────────────────────────────────────────────────────
  if (action === 'add') {
    if (!email || typeof email !== 'string') return err(400, 'email is required');
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) return err(400, 'Invalid email address');

    const emailKey  = Buffer.from(normalised).toString('base64url');
    const rosterKey = `${employerKey}/${emailKey}`;

    // Check rate limit — always return {sent:true} to prevent enumeration.
    const rlStore = getRateLimitStore();
    const rlKey   = emailKey;
    const rlEntry = await rlStore.get(rlKey, { type: 'json' });
    if (rlEntry && (Date.now() - rlEntry.lastSentAt) < RATE_LIMIT_MS) {
      console.log(`[p1-roster] Rate limited invite for ${normalised}`);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
    }

    // Upsert roster record — creates if new, re-activates if previously removed.
    const existing = await rosterStore.get(rosterKey, { type: 'json' });
    const rosterRecord = {
      email:     normalised,
      employerKey,
      active:    true,
      addedAt:   existing?.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: existing?.claimedAt || null
    };
    await rosterStore.setJSON(rosterKey, rosterRecord);

    // Write email secondary index (best-effort — roster is authoritative).
    // On re-add of a previously removed manager, this sets active:true.
    try {
      const emailIdxStore = getMgrByEmailStore();
      await emailIdxStore.setJSON(`${emailKey}/${employerKey}`, {
        email:      normalised,
        employerKey,
        active:     true,
        updatedAt:  new Date().toISOString()
      });
    } catch (e) {
      console.error(`[p1-roster] Email index write failed for ${normalised}:`, e.message);
    }

    // Issue manager invite token
    const tokenUuid = crypto.randomUUID();
    const invitePayload = {
      tokenUuid,
      role:        'manager-invite',
      email:       normalised,
      employerKey,
      expires:     Date.now() + MGR_INVITE_TTL_MS
    };
    const inviteToken = generateToken(invitePayload);

    const mgrInviteStore = getMgrInviteStore();
    await mgrInviteStore.setJSON(tokenUuid, {
      tokenUuid,
      email:       normalised,
      employerKey,
      issuedAt:    new Date().toISOString(),
      expiresAt:   new Date(Date.now() + MGR_INVITE_TTL_MS).toISOString()
    });

    // Update rate limit marker
    await rlStore.setJSON(rlKey, { lastSentAt: Date.now() });

    // Send claim email
    const siteUrl   = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';
    const claimLink = `${siteUrl}/manager-learning?claim=${inviteToken}`;

    await sendEmail(
      normalised,
      `Your manager learning access — ${agreement.firmName}`,
      wrap(`
        <p style="font-size:15px;color:#374151;line-height:1.7">You have been invited to access manager learning resources for <strong>${esc(agreement.firmName)}</strong> on Get Chartered AI.</p>
        <p style="font-size:15px;color:#374151;line-height:1.7">Use the link below to set up your access. The link is personal to you and expires in 7 days.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${claimLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Set up my access →</a>
        </div>
        <p style="font-size:13px;color:#94a3b8;line-height:1.6">If you were not expecting this invitation, you can ignore it safely.</p>
      `),
      `You have been invited to access manager learning resources for ${agreement.firmName}.\n\nSet up access here: ${claimLink}\n\nThis link expires in 7 days.`
    );

    console.log(`[p1-roster] Added manager ${normalised} to ${employerKey}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
  }

  // ── Remove ────────────────────────────────────────────────────────────────────
  if (action === 'remove') {
    if (!email || typeof email !== 'string') return err(400, 'email is required');
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) return err(400, 'Invalid email address');

    const emailKey  = Buffer.from(normalised).toString('base64url');
    const rosterKey = `${employerKey}/${emailKey}`;
    const existing  = await rosterStore.get(rosterKey, { type: 'json' });
    if (!existing) return err(404, 'Manager not found on roster');

    const updated = { ...existing, active: false, updatedAt: new Date().toISOString() };
    await rosterStore.setJSON(rosterKey, updated);

    // Update email secondary index (best-effort — roster is authoritative).
    // Reauth endpoint still cross-checks the roster before issuing a magic link,
    // so a stale index entry (e.g. index update fails here) cannot grant access.
    try {
      const emailIdxStore = getMgrByEmailStore();
      await emailIdxStore.setJSON(`${emailKey}/${employerKey}`, {
        email:      normalised,
        employerKey,
        active:     false,
        updatedAt:  new Date().toISOString()
      });
    } catch (e) {
      console.error(`[p1-roster] Email index update failed for ${normalised}:`, e.message);
    }

    console.log(`[p1-roster] Removed manager ${normalised} from ${employerKey}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ removed: true }) };
  }

  return err(400, 'action must be list, add or remove');
};
