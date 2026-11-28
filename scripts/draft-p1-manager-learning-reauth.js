// DRAFT — verify with node --check and test-draft-p1-manager-learning-reauth.mjs
// before replacing netlify/functions/p1-manager-learning-reauth.js.
//
// Changes from Build 1 original:
//   1. getMgrByEmailStore()  — email secondary index store helper (new)
//   2. listAllBlobsForPrefix() — paginated list helper (new)
//   3. esc()                 — HTML-escapes firm names in multi-employer emails (new)
//   4. verifyToken()         — legacySig removed; this endpoint only verifies
//                              manager-magic tokens, all issued after the HMAC fix
//                              shipped on 2026-10-12. No legacy manager-magic tokens exist.
//   5. step:'request'        — replaces full roster scan with email secondary index lookup;
//                              validates each index entry against roster + agreement;
//                              issues one magic link per valid employer (multi-employer support);
//                              adds JWT_SECRET pre-check to fail fast (not silently)
//   6. step:'verify'         — adds safeToDeleteAfter to claim marker record for cleanup
//
// Email index design notes:
//   p1-mgr-by-email is a convenience index; the roster (p1-manager-roster) and employer
//   agreement (p1-employer-agreements) remain authoritative. For every index entry found,
//   the roster and agreement are re-checked independently before issuing a magic link.
//   A stale active:true index entry cannot grant access to a removed manager.
//
// Recovery for missing or stale index entries (active:false in index, active:true in roster):
//   This can occur if the index write failed during a roster add action. The manager will not
//   receive a magic link until the index is resynchronised. Recovery: the employer re-adds the
//   manager from the dashboard, which re-attempts the index write (best-effort in p1-manager-roster.js).
//   There is no indefinite lockout: re-add takes effect immediately once the index write succeeds.
//
// legacySig compatibility note:
//   legacySig is retained in p1-manager-roster.js (employer JWTs, 365-day TTL) and in 37
//   pre-Build-1 functions. Removal of those requires JWT_SECRET rotation and is tracked
//   separately. This endpoint is safe to clean because all manager-magic tokens are HMAC-signed.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const MGR_LEARNING_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const MAGIC_LINK_TTL_MS   = 15 * 60 * 1000;              // 15 minutes
const RATE_LIMIT_MS       = 5 * 60 * 1000;               // 5 minutes per email

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
  // legacySig removed: only manager-magic tokens are verified here, all issued
  // post HMAC fix (2026-10-12). No legacy-signed manager-magic tokens can exist.
  if (sig !== hmacSig) return null;
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
  if (!apiKey) { console.log(`[p1-reauth] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
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

  // ── step: request ─────────────────────────────────────────────────────────────
  if (step === 'request') {
    const { email } = body;
    if (!email || typeof email !== 'string') return err(400, 'email is required');
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) return err(400, 'Invalid email address');

    // Rate limit — always return {sent:true} regardless of outcome (enumeration protection).
    const emailKey = Buffer.from(normalised).toString('base64url');
    const rlStore  = getRateLimitStore();
    const rlKey    = emailKey;
    const rlEntry  = await rlStore.get(rlKey, { type: 'json' });
    if (rlEntry && (Date.now() - rlEntry.lastSentAt) < RATE_LIMIT_MS) {
      console.log(`[p1-reauth] Rate limited request for ${normalised}`);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
    }

    // Fail fast if JWT_SECRET is absent — no magic tokens can be generated.
    if (!process.env.JWT_SECRET) return err(500, 'Server configuration error');

    // Look up all employer memberships via the email secondary index.
    // The index is a convenience store populated by p1-manager-roster.js.
    // The roster (p1-manager-roster) and employer agreement remain authoritative:
    // each index entry is independently re-verified below before issuing any token.
    const emailIdxStore  = getMgrByEmailStore();
    const idxBlobs       = await listAllBlobsForPrefix(emailIdxStore, `${emailKey}/`);

    const rosterStore    = getRosterStore();
    const agreementStore = getAgreementStore();
    const validContexts  = [];

    for (const { key: idxKey } of idxBlobs) {
      const idxEntry = await emailIdxStore.get(idxKey, { type: 'json' });
      // Skip inactive index entries. Stale active:false (index not yet resynchronised)
      // means the manager won't receive a link until the employer re-adds them, which
      // rewrites the index entry. See recovery note in the file header.
      if (!idxEntry || !idxEntry.active) continue;
      const { employerKey } = idxEntry;
      if (!employerKey || !UUID_RE.test(employerKey)) continue;

      // Authoritative roster check: confirms the manager is still active.
      const rosterKey   = `${employerKey}/${emailKey}`;
      const rosterEntry = await rosterStore.get(rosterKey, { type: 'json' });
      if (!rosterEntry || !rosterEntry.active) continue;

      // Authoritative agreement check: confirms the employer service is current.
      const agreement = await agreementStore.get(employerKey, { type: 'json' });
      if (!agreement || !agreement.serviceActive || new Date(agreement.serviceExpiresAt) <= new Date()) continue;

      validContexts.push({ employerKey, firmName: agreement.firmName || '' });
    }

    // No valid memberships found — always return {sent:true} (enumeration protection).
    if (validContexts.length === 0) {
      await rlStore.setJSON(rlKey, { lastSentAt: Date.now() });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
    }

    // Issue one magic link per valid employer. Most managers belong to exactly one.
    const magicStore    = getMagicStore();
    const siteUrl       = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';
    const multiEmployer = validContexts.length > 1;

    for (const { employerKey, firmName } of validContexts) {
      const tokenUuid    = crypto.randomUUID();
      const magicExpires = Date.now() + MAGIC_LINK_TTL_MS;
      const magicPayload = {
        tokenUuid,
        role:        'manager-magic',
        email:       normalised,
        employerKey,
        expires:     magicExpires
      };
      let magicToken;
      try { magicToken = generateToken(magicPayload); }
      catch { continue; }

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

      console.log(`[p1-reauth] Magic link sent for ${normalised} (employer: ${employerKey})`);
    }

    await rlStore.setJSON(rlKey, { lastSentAt: Date.now() });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ sent: true }) };
  }

  // ── step: verify ──────────────────────────────────────────────────────────────
  if (step === 'verify') {
    const { magicToken } = body;
    if (!magicToken || typeof magicToken !== 'string') return err(400, 'magicToken is required');

    let magicPayload;
    try { magicPayload = verifyToken(magicToken); }
    catch { return err(500, 'Server configuration error'); }
    if (!magicPayload) return err(401, 'Invalid or expired magic link');
    if (magicPayload.role !== 'manager-magic') return err(401, 'Invalid token type');

    const { tokenUuid, email, employerKey } = magicPayload;
    if (!tokenUuid || !UUID_RE.test(tokenUuid)) return err(401, 'Malformed magic token');
    if (!employerKey || !UUID_RE.test(employerKey)) return err(401, 'Malformed magic token');

    // Atomic single-use claim. safeToDeleteAfter enables safe cleanup once the
    // original token's expiry has passed — a deleted marker cannot re-enable the token
    // because the token's own expiry check will also reject it.
    const claimStore  = getClaimMarkerStore();
    const claimResult = await claimStore.setJSON(tokenUuid, {
      claimedAt:         new Date().toISOString(),
      safeToDeleteAfter: new Date(magicPayload.expires).toISOString()
    }, { onlyIfNew: true });
    if (!claimResult.modified) {
      return err(409, 'This sign-in link has already been used');
    }

    // Belt-and-suspenders: confirm the magic record still exists.
    const magicStore  = getMagicStore();
    const magicRecord = await magicStore.get(tokenUuid, { type: 'json' });
    if (!magicRecord) return err(409, 'This sign-in link has already been used');

    // Authoritative agreement check.
    const agreementStore = getAgreementStore();
    const agreement      = await agreementStore.get(employerKey, { type: 'json' });
    if (!agreement)               return err(403, 'Employer agreement not found');
    if (!agreement.serviceActive) return err(403, 'Employer agreement is not active');
    if (new Date(agreement.serviceExpiresAt) <= new Date()) return err(403, 'Employer agreement has expired');

    // Authoritative roster check.
    const rosterStore = getRosterStore();
    const rosterKey   = `${employerKey}/${Buffer.from(email).toString('base64url')}`;
    const rosterEntry = await rosterStore.get(rosterKey, { type: 'json' });
    if (!rosterEntry || !rosterEntry.active) {
      return err(403, 'Manager is not on the active roster');
    }

    // Consume the magic record (single-use enforced by the claim marker above).
    await magicStore.delete(tokenUuid);

    // Issue 30-day manager-learning JWT.
    const learningPayload = {
      role:        'manager-learning',
      email,
      employerKey,
      expires:     Date.now() + MGR_LEARNING_TTL_MS
    };
    let learningToken;
    try { learningToken = generateToken(learningPayload); }
    catch { return err(500, 'Server configuration error'); }

    console.log(`[p1-reauth] Issued manager-learning token (re-auth) for ${email}`);
    return {
      statusCode: 200,
      headers:    HEADERS,
      body:       JSON.stringify({ learningToken })
    };
  }

  return err(400, "step must be 'request' or 'verify'");
};
