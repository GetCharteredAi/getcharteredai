// scripts/reauth-v2-clean.js
// Clean draft for review — do not deploy until tests pass.
// Intended to replace netlify/functions/p1-manager-learning-reauth.js.
//
// Changes from the permanent endpoint:
//   1. getMgrByEmailStore()    — email secondary index store helper
//   2. listAllBlobsForPrefix() — paginated blob list helper
//   3. esc()                   — HTML-escapes firm names in multi-employer emails
//   4. verifyToken()           — legacySig removed (all manager-magic tokens issued
//                                after 2026-10-12 HMAC fix); expiry is now required,
//                                must be a finite number, and must be in the future.
//   5. step:'request'          — replaces unbounded full-roster scan with a targeted
//                                email secondary index lookup; validates each entry
//                                against the roster (authoritative) and agreement
//                                (authoritative); issues one magic link per valid
//                                employer; JWT_SECRET pre-check to fail fast.
//                                If the index is missing or stale for a given email,
//                                run scripts/reconcile-mgr-email-index.mjs to repair
//                                it without touching the sign-in hot path.
//   6. step:'verify'           — single atomic claim write, repositioned after:
//                                (a) magic record read and cross-validation of every
//                                stored field against the signed token claims,
//                                (b) employer agreement check,
//                                (c) roster check.
//                                Requests that fail any earlier check are rejected
//                                without writing a claim marker, so the magic link
//                                remains valid for a corrected retry.
//                                Email is normalised from the token payload before use.
//                                safeToDeleteAfter added to claim markers.
//
// legacySig note — retained in p1-manager-roster.js (employer JWTs, 365-day TTL) and
// 37 pre-Build-1 functions; removal requires JWT_SECRET rotation, tracked separately.

'use strict';

const { getStore } = require('@netlify/blobs');
const crypto       = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const FROM              = 'Get Chartered AI <info@getcharteredai.com>';
const MGR_LEARNING_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const MAGIC_LINK_TTL_MS   = 15 * 60 * 1000;              // 15 minutes
const RATE_LIMIT_MS       =  5 * 60 * 1000;              //  5 minutes

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json'
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

function getMagicStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-magic`)
    : getStore({ name: `${PREFIX}p1-mgr-magic`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getClaimMarkerStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-claimed`)
    : getStore({ name: `${PREFIX}p1-mgr-claimed`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
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

// ── Crypto helpers ────────────────────────────────────────────────────────────

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig       = token.slice(lastDot + 1);
  const hmacSig   = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  // legacySig removed — all manager-magic tokens were issued after the 2026-10-12 HMAC fix.
  if (sig !== hmacSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    // Require a finite future expiry — tokens with no expiry, Infinity, or a past expiry
    // are all rejected. Manager-magic tokens have a 15-minute TTL; this ensures that
    // an omitted or corrupted expiry field is never silently treated as valid-forever.
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

// ── Email helpers ─────────────────────────────────────────────────────────────

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
  if (!apiKey) { console.log(`[p1-reauth] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) {
    console.error(`[p1-reauth] Email send failed to ${to}:`, e.message);
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

  const { step } = body;

  // ── step:'request' ────────────────────────────────────────────────────────────
  if (step === 'request') {
    const { email } = body;
    if (!email || typeof email !== 'string') return err(400, 'email is required');
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) return err(400, 'Invalid email address');

    // Rate limit — always respond {sent:true} regardless of outcome (enumeration guard).
    const emailKey = Buffer.from(normalised).toString('base64url');
    const rlStore  = getRateLimitStore();
    const rlEntry  = await rlStore.get(emailKey, { type: 'json' });
    if (rlEntry && (Date.now() - rlEntry.lastSentAt) < RATE_LIMIT_MS) {
      console.log('[p1-reauth] Rate limited request');
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
    }

    // Fail fast — no magic tokens can be issued without JWT_SECRET.
    if (!process.env.JWT_SECRET) return err(500, 'Server configuration error');

    // Targeted email index lookup: O(memberships for this email), not O(all managers).
    // p1-mgr-by-email is a convenience index; the roster and agreement remain authoritative
    // and are cross-checked independently for every entry.
    // If the index is absent or stale for this email, run reconcile-mgr-email-index.mjs.
    const emailIdxStore  = getMgrByEmailStore();
    const idxBlobs       = await listAllBlobsForPrefix(emailIdxStore, `${emailKey}/`);
    const rosterStore    = getRosterStore();
    const agreementStore = getAgreementStore();
    const validContexts  = [];

    for (const { key: idxKey } of idxBlobs) {
      const idxEntry = await emailIdxStore.get(idxKey, { type: 'json' });
      if (!idxEntry || !idxEntry.active) continue;
      const { employerKey } = idxEntry;
      if (!employerKey || !UUID_RE.test(employerKey)) continue;
      const rosterEntry = await rosterStore.get(`${employerKey}/${emailKey}`, { type: 'json' });
      if (!rosterEntry || !rosterEntry.active) continue;
      const agreement = await agreementStore.get(employerKey, { type: 'json' });
      if (!agreement || !agreement.serviceActive || new Date(agreement.serviceExpiresAt) <= new Date()) continue;
      validContexts.push({ employerKey, firmName: agreement.firmName || '' });
    }

    // No valid memberships — silent no-op (enumeration guard).
    if (validContexts.length === 0) {
      await rlStore.setJSON(emailKey, { lastSentAt: Date.now() });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
    }

    // Issue one magic link per valid employer (most managers belong to exactly one).
    const magicStore    = getMagicStore();
    const siteUrl       = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';
    const multiEmployer = validContexts.length > 1;

    for (const { employerKey, firmName } of validContexts) {
      const tokenUuid    = crypto.randomUUID();
      const magicExpires = Date.now() + MAGIC_LINK_TTL_MS;
      let magicToken;
      try {
        magicToken = generateToken({
          tokenUuid,
          role:        'manager-magic',
          email:       normalised,
          employerKey,
          expires:     magicExpires
        });
      } catch { continue; }

      await magicStore.setJSON(tokenUuid, {
        tokenUuid,
        email:     normalised,
        employerKey,
        issuedAt:  new Date().toISOString(),
        expiresAt: new Date(magicExpires).toISOString()
      });

      const authLink = `${siteUrl}/manager-learning?auth=${magicToken}`;
      const subject  = multiEmployer
        ? `Your manager learning sign-in link — ${firmName}`
        : 'Your manager learning sign-in link';
      const firmNote = multiEmployer ? ` for <strong>${esc(firmName)}</strong>` : '';

      await sendEmail(
        normalised,
        subject,
        wrap(`
          <p style="font-size:15px;color:#374151;line-height:1.7">Here is your sign-in link for manager learning${firmNote}. It expires in 15 minutes.</p>
          <div style="margin:24px 0;text-align:center">
            <a href="${authLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Sign in →</a>
          </div>
          <p style="font-size:13px;color:#94a3b8;line-height:1.6">If you did not request this link, you can ignore it safely.</p>
        `),
        `Your manager learning sign-in link${multiEmployer ? ` (${firmName})` : ''} (expires in 15 minutes):\n${authLink}\n\nIf you did not request this, ignore it.`
      );
      console.log(`[p1-reauth] Magic link sent (employer: ${employerKey})`);
    }

    await rlStore.setJSON(emailKey, { lastSentAt: Date.now() });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
  }

  // ── step:'verify' ─────────────────────────────────────────────────────────────
  if (step === 'verify') {
    const { magicToken } = body;
    if (!magicToken || typeof magicToken !== 'string') return err(400, 'magicToken is required');

    // 1. Verify HMAC signature and require a finite future expiry.
    let magicPayload;
    try { magicPayload = verifyToken(magicToken); }
    catch { return err(500, 'Server configuration error'); }
    if (!magicPayload) return err(401, 'Invalid or expired magic link');
    if (magicPayload.role !== 'manager-magic') return err(401, 'Invalid token type');

    // 2. Validate and normalise fields from the signed payload.
    const { tokenUuid, employerKey } = magicPayload;
    const email = typeof magicPayload.email === 'string'
      ? magicPayload.email.trim().toLowerCase()
      : '';
    if (!tokenUuid   || !UUID_RE.test(tokenUuid))   return err(401, 'Malformed magic token');
    if (!employerKey || !UUID_RE.test(employerKey)) return err(401, 'Malformed magic token');
    if (!email       || !EMAIL_RE.test(email))      return err(401, 'Malformed magic token');

    // 3. Read the backing magic record before any claim write.
    //    A missing record means the token was already consumed or was never validly issued.
    const magicStore  = getMagicStore();
    const magicRecord = await magicStore.get(tokenUuid, { type: 'json' });
    if (!magicRecord) return err(409, 'This sign-in link has already been used');

    // 4. Cross-validate every signed claim against the stored magic record.
    //    A mismatch indicates internal inconsistency; reject without consuming the link.
    const recordEmail = typeof magicRecord.email === 'string'
      ? magicRecord.email.trim().toLowerCase()
      : '';
    if (
      magicRecord.tokenUuid   !== tokenUuid                               ||
      recordEmail             !== email                                   ||
      magicRecord.employerKey !== employerKey                             ||
      new Date(magicRecord.expiresAt).getTime() !== magicPayload.expires
    ) {
      console.error('[p1-reauth] Magic record field mismatch — possible internal inconsistency');
      return err(401, 'Invalid or expired magic link');
    }

    // 5. Authoritative agreement check — before any claim write.
    const agreementStore = getAgreementStore();
    const agreement      = await agreementStore.get(employerKey, { type: 'json' });
    if (!agreement)               return err(403, 'Employer agreement not found');
    if (!agreement.serviceActive) return err(403, 'Employer agreement is not active');
    if (new Date(agreement.serviceExpiresAt) <= new Date()) return err(403, 'Employer agreement has expired');

    // 6. Authoritative roster check — before any claim write.
    const rosterStore = getRosterStore();
    const rosterEntry = await rosterStore.get(
      `${employerKey}/${Buffer.from(email).toString('base64url')}`,
      { type: 'json' }
    );
    if (!rosterEntry || !rosterEntry.active) return err(403, 'Manager is not on the active roster');

    // 7. Atomic single-use claim — the only claim write in this handler.
    //    All validation is complete; this gate rejects concurrent or replayed requests.
    //    safeToDeleteAfter marks when the marker can safely be removed: after that instant
    //    verifyToken's expiry check independently rejects the token.
    const claimStore  = getClaimMarkerStore();
    const claimResult = await claimStore.setJSON(tokenUuid, {
      claimedAt:         new Date().toISOString(),
      safeToDeleteAfter: new Date(magicPayload.expires).toISOString()
    }, { onlyIfNew: true });
    if (!claimResult.modified) return err(409, 'This sign-in link has already been used');

    // 8. Consume the magic record (belt-and-suspenders; claim marker is the
    //    concurrent-redemption gate for the race window between steps 3 and 7).
    await magicStore.delete(tokenUuid);

    // 9. Issue 30-day manager-learning JWT.
    let learningToken;
    try {
      learningToken = generateToken({
        role:        'manager-learning',
        email,
        employerKey,
        expires:     Date.now() + MGR_LEARNING_TTL_MS
      });
    } catch { return err(500, 'Server configuration error'); }

    console.log(`[p1-reauth] Issued manager-learning token for employer ${employerKey}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ learningToken }) };
  }

  return err(400, "step must be 'request' or 'verify'");
};
