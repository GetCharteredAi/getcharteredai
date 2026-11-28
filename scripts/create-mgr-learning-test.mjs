/**
 * Create a local test fixture for the manager-learning page.
 *
 * Creates:
 *   1. A test employer agreement in Blobs
 *   2. A test manager roster entry in Blobs (pre-claimed, active)
 *   3. A manager-magic token + magic record for the ?auth= re-auth flow
 *   4. A manager-learning token for direct localStorage injection
 *
 * Safety constraints are enforced both here and in createTestFixture() so that
 * callers who import this module cannot bypass them.
 *
 * Usage (from within `netlify dev`):
 *   JWT_SECRET=<local-secret> node scripts/create-mgr-learning-test.mjs \
 *     --email <email> [--employer-key <UUID>] [--site-url <url>]
 *
 * Required env:
 *   NETLIFY_BLOBS_CONTEXT — must be the base64-encoded JSON set by `netlify dev`.
 *                           A bare "1" or other non-JSON value is NOT sufficient.
 *   JWT_SECRET            — must match the value used by the local dev server.
 */

import { getStore }      from '@netlify/blobs';
import crypto            from 'crypto';
import { fileURLToPath } from 'url';

const PREFIX   = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MGR_LEARNING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_LINK_TTL_MS   = 15 * 60 * 1000;

// ── Safety checks (exported for testing) ─────────────────────────────────────

/**
 * Verifies that NETLIFY_BLOBS_CONTEXT encodes a valid, locally routed context.
 *
 * The SDK (v11.1.4) base64-decodes NETLIFY_BLOBS_CONTEXT and JSON-parses the
 * result. A bare truthy value such as "1" decodes to an empty string, JSON.parse
 * throws, and the SDK falls back to an empty context {}. With an empty context
 * and NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID present, the SDK routes all Blobs
 * requests to https://api.netlify.com (production).
 *
 * Storage isolation is only confirmed when the parsed context contains an
 * edgeURL whose hostname resolves to localhost or 127.0.0.1.
 *
 * @param {object} env - process.env or a mock equivalent for testing
 * @returns {string[]|null} error lines, or null if safe
 */
export function checkBlobsContext(env = process.env) {
  const raw = env.NETLIFY_BLOBS_CONTEXT;

  if (!raw) {
    const credNote = (env.NETLIFY_AUTH_TOKEN || env.NETLIFY_SITE_ID)
      ? ' NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID is also set — without a local\n        context these would target production Blobs storage.'
      : '';
    return [
      'Safety: NETLIFY_BLOBS_CONTEXT is not set.' + (credNote ? '\n       ' + credNote : ''),
      '        Run this script from within `netlify dev`; the CLI sets',
      '        NETLIFY_BLOBS_CONTEXT automatically to a valid local context.'
    ];
  }

  // Replicate the SDK decode path: base64 → UTF-8 → JSON.
  // Buffer.from('1', 'base64') → empty buffer → empty string → JSON.parse throws.
  let ctx;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    ctx = JSON.parse(decoded);
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) throw new Error('not an object');
  } catch {
    return [
      'Safety: NETLIFY_BLOBS_CONTEXT does not contain valid base64-encoded JSON.',
      '        The SDK decodes this value before use. A bare "1" or similar',
      '        produces an empty context, after which the SDK falls back to',
      '        production API credentials (NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID).',
      '        Run this script from within `netlify dev` to obtain a valid context.'
    ];
  }

  if (!ctx.edgeURL) {
    return [
      'Safety: NETLIFY_BLOBS_CONTEXT context has no edgeURL.',
      '        Without an edgeURL the SDK routes all Blobs requests to the',
      '        production Netlify API (https://api.netlify.com).',
      '        Run this script from within `netlify dev` to obtain a local context.'
    ];
  }

  let edgeHostname;
  try {
    edgeHostname = new URL(ctx.edgeURL).hostname;
  } catch {
    return [`Safety: edgeURL "${ctx.edgeURL}" in NETLIFY_BLOBS_CONTEXT is not a valid URL.`];
  }

  if (edgeHostname !== 'localhost' && edgeHostname !== '127.0.0.1') {
    return [
      `Safety: edgeURL hostname "${edgeHostname}" is not a local address.`,
      '        The SDK routes all Blobs requests to this host. A non-local',
      '        edgeURL may target a remote or production Blobs server.',
      '        Run this script from within `netlify dev` to obtain a local context.'
    ];
  }

  // edgeURL confirmed as localhost — SDK routes to the local blob server regardless
  // of NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID values.
  return null;
}

/**
 * Verifies that siteUrl is an explicitly permitted local address using HTTP.
 *
 * Permitted hosts: localhost, 127.0.0.1, *.local
 * Required protocol: http (HTTPS is not needed for local dev; its presence
 * may indicate a production, staging or tunnelled endpoint).
 *
 * @param {string} siteUrl
 * @returns {string[]|null} error lines, or null if safe
 */
export function checkLocalSiteUrl(siteUrl) {
  let parsed;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return [`Safety: --site-url "${siteUrl}" is not a valid URL.`];
  }

  const { hostname, protocol } = parsed;

  const isPermittedHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  if (!isPermittedHost) {
    return [
      `Safety: --site-url hostname "${hostname}" is not a permitted local address.`,
      '        Permitted: localhost, 127.0.0.1, *.local.',
      '        Test tokens must not be associated with non-local endpoints.'
    ];
  }

  if (protocol !== 'http:') {
    return [
      `Safety: --site-url uses "${protocol.slice(0, -1)}" but only "http" is accepted.`,
      '        HTTPS is not required for a local dev server and may indicate',
      '        a production, staging or tunnelled URL.',
      '        Use http://localhost:8888 or similar.'
    ];
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStores() {
  const s = (name) => process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}${name}`)
    : getStore({ name: `${PREFIX}${name}`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  return {
    agreementStore: s('p1-employer-agreements'),
    rosterStore:    s('p1-manager-roster'),
    magicStore:     s('p1-mgr-magic'),
    emailIdxStore:  s('p1-mgr-by-email')
  };
}

function generateToken(payload, jwtSecret) {
  if (!jwtSecret) throw new Error('JWT_SECRET is not set');
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  return {
    email:       get('--email'),
    employerKey: get('--employer-key'),
    siteUrl:     get('--site-url') || 'http://localhost:8888'
  };
}

// ── Core logic (exported for testing) ────────────────────────────────────────

/**
 * Creates a manager-learning test fixture and returns signed tokens.
 *
 * Safety constraints run before any storage write, so library callers that
 * import this function directly cannot bypass them.
 *
 * Token claims and magic record format are verified against the actual
 * p1-manager-learning-reauth.js step:'verify' implementation:
 *   - magic JWT:    { tokenUuid, role:'manager-magic', email, employerKey, expires }
 *   - magic record: { tokenUuid, email, employerKey, issuedAt, expiresAt } at p1-mgr-magic/{tokenUuid}
 *   - learning JWT: { role:'manager-learning', email, employerKey, expires }
 *   - MAGIC_LINK_TTL_MS  = 15 min  (matches endpoint constant)
 *   - MGR_LEARNING_TTL_MS = 30 days (matches endpoint constant)
 *
 * @param {{ email, employerKey?, siteUrl, jwtSecret, env? }} opts
 * @param {{ agreementStore, rosterStore, magicStore }} stores
 * @returns {Promise<{ exitCode: number, messages: string[] }>}
 */
export async function createTestFixture(
  { email, employerKey: suppliedKey, siteUrl, jwtSecret, env = process.env },
  { agreementStore, rosterStore, magicStore, emailIdxStore }
) {
  // Safety checks before any storage access
  const blobsErr   = checkBlobsContext(env);
  const siteUrlErr = checkLocalSiteUrl(siteUrl);
  for (const e of [blobsErr, siteUrlErr]) {
    if (e) return { exitCode: 1, messages: e };
  }

  // Input validation
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return { exitCode: 1, messages: ['Error: --email must be a valid email address'] };
  }
  if (suppliedKey !== undefined && suppliedKey !== null && !UUID_RE.test(suppliedKey)) {
    return { exitCode: 1, messages: ['Error: --employer-key must be a valid UUID'] };
  }
  if (!jwtSecret) {
    return { exitCode: 1, messages: ['Error: JWT_SECRET is not set'] };
  }

  const normalised  = email.trim().toLowerCase();
  const employerKey = suppliedKey || crypto.randomUUID();
  const now         = new Date().toISOString();

  // 1. Create test employer agreement
  await agreementStore.setJSON(employerKey, {
    employerKey,
    firmName:             'Test Firm (Local)',
    employerContactEmail: 'admin@testfirm.local',
    serviceStartsAt:      new Date(Date.now() - 86400000).toISOString(),
    serviceExpiresAt:     new Date(Date.now() + 365 * 86400000).toISOString(),
    serviceActive:        true,
    createdAt:            now,
    updatedAt:            now,
    notes:                'Created by create-mgr-learning-test.mjs'
  });

  // 2. Create test roster entry (pre-claimed, active — simulates a manager who
  //    has already completed the invitation flow)
  const rosterKey = `${employerKey}/${Buffer.from(normalised).toString('base64url')}`;
  await rosterStore.setJSON(rosterKey, {
    email:      normalised,
    employerKey,
    active:     true,
    addedAt:    now,
    updatedAt:  now,
    claimedAt:  now
  });

  // 2b. Write email secondary index entry
  const emailKey = Buffer.from(normalised).toString('base64url');
  await emailIdxStore.setJSON(`${emailKey}/${employerKey}`, {
    email:       normalised,
    employerKey,
    active:      true,
    updatedAt:   now
  });

  // 3. Magic token for the ?auth= re-auth flow (step:'verify').
  //    p1-manager-learning-reauth.js verifies:
  //      magicPayload.role === 'manager-magic'
  //      UUID_RE.test(magicPayload.tokenUuid)
  //      UUID_RE.test(magicPayload.employerKey)
  //    Then reads the backing record from p1-mgr-magic keyed by tokenUuid and
  //    checks { tokenUuid, email, employerKey, issuedAt, expiresAt }.
  const tokenUuid    = crypto.randomUUID();
  const magicExpires = Date.now() + MAGIC_LINK_TTL_MS;
  const magicToken   = generateToken({
    tokenUuid,
    role:        'manager-magic',
    email:       normalised,
    employerKey,
    expires:     magicExpires
  }, jwtSecret);

  await magicStore.setJSON(tokenUuid, {
    tokenUuid,
    email:     normalised,
    employerKey,
    issuedAt:  now,
    expiresAt: new Date(magicExpires).toISOString()
  });

  // 4. Learning token for direct localStorage injection — bypasses the sign-in
  //    flow entirely. For use in a local browser console only.
  const learningToken = generateToken({
    role:        'manager-learning',
    email:       normalised,
    employerKey,
    expires:     Date.now() + MGR_LEARNING_TTL_MS
  }, jwtSecret);

  return {
    exitCode: 0,
    messages: [
      '── Test fixture created ──────────────────────────────────────────',
      `  Email:       ${normalised}`,
      `  EmployerKey: ${employerKey}`,
      '',
      '  Option A — test the full magic-link re-auth flow (expires in 15 min):',
      `  ${siteUrl}/manager-learning?auth=${magicToken}`,
      '',
      '  Option B — inject a 30-day session directly (local browser console only):',
      `  localStorage.setItem('gca_mgr_learning_token', '${learningToken}')`,
      `  Then open: ${siteUrl}/manager-learning`,
      '',
      '  For local testing only. Do not use with production credentials.'
    ]
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { email, employerKey, siteUrl } = parseArgs();

  // Early safety check for immediate CLI feedback before any work starts.
  // createTestFixture() repeats this check before any storage write.
  const blobsErr   = checkBlobsContext(process.env);
  const siteUrlErr = checkLocalSiteUrl(siteUrl);
  for (const e of [blobsErr, siteUrlErr]) {
    if (e) { for (const line of e) console.error(line); process.exit(1); }
  }

  const result = await createTestFixture(
    { email, employerKey, siteUrl, jwtSecret: process.env.JWT_SECRET, env: process.env },
    makeStores()
  );
  for (const msg of result.messages) console.log(msg);
  process.exit(result.exitCode);
}
