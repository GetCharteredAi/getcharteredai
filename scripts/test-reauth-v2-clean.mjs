/**
 * Focused mocked-storage tests for scripts/reauth-v2-clean.js
 *
 * Coverage:
 *   step:'request'
 *     - Input validation (email, JWT_SECRET)
 *     - Rate limiting
 *     - Email-index lookup: inactive index, inactive roster, inactive/expired agreement
 *     - Valid single employer → magic record written
 *     - Multi-employer: two valid employers → two magic records
 *     - Mixed: one valid, one inactive → one magic record
 *
 *   step:'verify' token checks
 *     - Wrong HMAC, legacySig (rejected), missing expiry, string expiry, past expiry
 *     - Wrong role, missing tokenUuid, missing magic record
 *
 *   Cross-validation (failed check must NOT consume a valid magic link)
 *     - Stored tokenUuid, email, employerKey, expiresAt mismatch → 401, no claim written
 *     - After any CV rejection, link still usable with a corrected record
 *
 *   Revocation checks (failed check must NOT consume a valid magic link)
 *     - Agreement not found, inactive, expired → 403, no claim written
 *     - Roster missing, inactive → 403, no claim written
 *     - After revocation rejection, link usable after re-activation
 *
 *   Successful verify
 *     - 200 with learningToken; correct role, email, employerKey; ~30-day expiry
 *     - Magic record deleted after claim; second verify → 409
 *
 *   Concurrent redemption
 *     - Promise.all([verify, verify]) → exactly one 200, one 409
 *
 *   Email normalisation
 *     - Uppercase email in token payload → normalised in learning token
 *
 * No production Blobs, no live email, no deployment.
 *
 * Run: node scripts/test-reauth-v2-clean.mjs
 */

import assert        from 'assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path          from 'path';
import crypto        from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

const FUNC_PATH  = path.resolve(__dirname, '../netlify/functions/p1-manager-learning-reauth.js');
const BLOBS_PATH = require.resolve('@netlify/blobs');

const TEST_SECRET = 'test-reauth-secret-xK9';

// ── Token helpers ─────────────────────────────────────────────────────────────

function makeMagicToken(payload, secret = TEST_SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

function makeLegacySigToken(payload, secret = TEST_SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const legacySig = Buffer.from(`${tokenData}.${secret}`).toString('base64').slice(0, 32);
  return `${tokenData}.${legacySig}`;
}

function decodeLearningToken(token) {
  const tokenData = token.slice(0, token.lastIndexOf('.'));
  return JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
}

function ek(email) {
  return Buffer.from(email.trim().toLowerCase()).toString('base64url');
}

// ── Mock stores ───────────────────────────────────────────────────────────────

function createMockStore(storage = {}) {
  return (nameOrOpts) => {
    const name = typeof nameOrOpts === 'string' ? nameOrOpts : nameOrOpts.name;
    return {
      get: async (key, opts) => {
        const raw = storage[`${name}::${key}`];
        if (raw === undefined) return null;
        return opts?.type === 'json' ? JSON.parse(raw) : raw;
      },
      setJSON: async (key, value, opts) => {
        const k = `${name}::${key}`;
        if (opts?.onlyIfNew && k in storage) return { modified: false, etag: '' };
        storage[k] = JSON.stringify(value);
        return { modified: true, etag: `etag-${Date.now()}` };
      },
      delete: async (key) => { delete storage[`${name}::${key}`]; },
      list: async (opts = {}) => {
        const prefix = opts.prefix || '';
        const blobs  = Object.keys(storage)
          .filter(k => k.startsWith(`${name}::${prefix}`))
          .map(k => ({ key: k.slice(name.length + 2) }));
        return { blobs, directories: [] };
      }
    };
  };
}

// ── Handler factory ───────────────────────────────────────────────────────────

function loadHandler(storage = {}, { noSecret = false } = {}) {
  delete require.cache[FUNC_PATH];
  require.cache[BLOBS_PATH] = {
    id: BLOBS_PATH, filename: BLOBS_PATH, loaded: true,
    exports: { getStore: createMockStore(storage) }
  };
  process.env.NETLIFY_BLOBS_CONTEXT = '1';
  if (noSecret) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = TEST_SECRET;
  }
  delete process.env.RESEND_API_KEY;
  return require(FUNC_PATH).handler;
}

function post(body) {
  return { httpMethod: 'POST', body: JSON.stringify(body) };
}

// ── Storage seed helpers ──────────────────────────────────────────────────────

function seedAgreement(storage, empKey, overrides = {}) {
  storage[`p1-employer-agreements::${empKey}`] = JSON.stringify({
    employerKey:      empKey,
    firmName:         'Test Firm',
    serviceActive:    true,
    serviceExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    ...overrides
  });
}

function seedRoster(storage, email, empKey, active = true) {
  storage[`p1-manager-roster::${empKey}/${ek(email)}`] = JSON.stringify({
    email:       email.toLowerCase(),
    employerKey: empKey,
    active,
    addedAt:  new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function seedEmailIndex(storage, email, empKey, active = true) {
  storage[`p1-mgr-by-email::${ek(email)}/${empKey}`] = JSON.stringify({
    email:       email.toLowerCase(),
    employerKey: empKey,
    active
  });
}

function seedMagicRecord(storage, tokenUuid, { email, empKey, expires }) {
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid,
    email:       email.toLowerCase(),
    employerKey: empKey,
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires).toISOString()
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMP_A = crypto.randomUUID();
const EMP_B = crypto.randomUUID();
const EMAIL = 'mgr@testfirm.local';

function validMagicPayload(tokenUuid, overrides = {}) {
  return {
    tokenUuid,
    role:        'manager-magic',
    email:       EMAIL,
    employerKey: EMP_A,
    expires:     Date.now() + 60000,
    ...overrides
  };
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ ok: true, name });
    passed++;
  } catch (e) {
    results.push({ ok: false, name, message: e.message });
    failed++;
  }
}

// ── HTTP method / body ────────────────────────────────────────────────────────

await test('T01 OPTIONS returns 200', async () => {
  const handler = loadHandler();
  const res = await handler({ httpMethod: 'OPTIONS', body: '' });
  assert.equal(res.statusCode, 200);
});

await test('T02 GET returns 405', async () => {
  const handler = loadHandler();
  const res = await handler({ httpMethod: 'GET', body: '' });
  assert.equal(res.statusCode, 405);
});

await test('T03 invalid JSON body returns 400', async () => {
  const handler = loadHandler();
  const res = await handler({ httpMethod: 'POST', body: '{bad json' });
  assert.equal(res.statusCode, 400);
});

await test('T04 unknown step returns 400', async () => {
  const handler = loadHandler();
  const res = await handler(post({ step: 'unknown' }));
  assert.equal(res.statusCode, 400);
});

// ── step:'request' — input validation ────────────────────────────────────────

await test('T05 request: missing email returns 400', async () => {
  const handler = loadHandler();
  const res = await handler(post({ step: 'request' }));
  assert.equal(res.statusCode, 400);
});

await test('T06 request: invalid email format returns 400', async () => {
  const handler = loadHandler();
  const res = await handler(post({ step: 'request', email: 'not-an-email' }));
  assert.equal(res.statusCode, 400);
});

await test('T07 request: missing JWT_SECRET returns 500', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  // loadHandler with noSecret — JWT_SECRET check fires after rate-limit guard
  const handler = loadHandler(storage, { noSecret: true });
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 500);
});

await test('T08 request: rate-limited email returns 200 sent:true without issuing link', async () => {
  const storage = {};
  // lastSentAt within 5-minute window
  storage[`p1-mgr-rl::${ek(EMAIL)}`] = JSON.stringify({ lastSentAt: Date.now() - 10000 });
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).sent, true);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 0, 'no magic record must be written when rate-limited');
});

// ── step:'request' — email index / roster / agreement guards ─────────────────

await test('T09 request: email not in index → 200 sent:true (enumeration guard)', async () => {
  const storage = {};
  // No email-index entry for this address
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).sent, true);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 0, 'no magic record when email is not indexed');
});

await test('T10 request: index entry active:false → 200 sent:true (no link)', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, false);  // inactive
  seedRoster(storage, EMAIL, EMP_A, true);
  seedAgreement(storage, EMP_A);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 0);
});

await test('T11 request: index active but roster inactive → 200 sent:true (no link)', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  seedRoster(storage, EMAIL, EMP_A, false);  // removed
  seedAgreement(storage, EMP_A);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 0);
});

await test('T12 request: index active, roster active, agreement inactive → 200 sent:true (no link)', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  seedRoster(storage, EMAIL, EMP_A, true);
  seedAgreement(storage, EMP_A, { serviceActive: false });
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 0);
});

await test('T13 request: index active, roster active, agreement expired → 200 sent:true (no link)', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  seedRoster(storage, EMAIL, EMP_A, true);
  seedAgreement(storage, EMP_A, { serviceExpiresAt: new Date(Date.now() - 1000).toISOString() });
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 0);
});

// ── step:'request' — valid paths ──────────────────────────────────────────────

await test('T14 request: valid single employer → 200 sent:true and magic record written', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  seedRoster(storage, EMAIL, EMP_A, true);
  seedAgreement(storage, EMP_A);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).sent, true);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 1, 'exactly one magic record must be written');
  const magic = JSON.parse(storage[magicKeys[0]]);
  assert.equal(magic.email, EMAIL.toLowerCase());
  assert.equal(magic.employerKey, EMP_A);
  assert.ok(magic.tokenUuid && magic.expiresAt, 'tokenUuid and expiresAt must be set');
});

await test('T15 request: multi-employer (both valid) → two magic records written', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  seedEmailIndex(storage, EMAIL, EMP_B, true);
  seedRoster(storage, EMAIL, EMP_A, true);
  seedRoster(storage, EMAIL, EMP_B, true);
  seedAgreement(storage, EMP_A, { firmName: 'Firm A' });
  seedAgreement(storage, EMP_B, { firmName: 'Firm B' });
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 2, 'two magic records must be written for two valid employers');
  const employers = magicKeys.map(k => JSON.parse(storage[k]).employerKey).sort();
  assert.deepEqual(employers, [EMP_A, EMP_B].sort());
});

await test('T16 request: mixed employers (one valid, one inactive agreement) → one magic record', async () => {
  const storage = {};
  seedEmailIndex(storage, EMAIL, EMP_A, true);
  seedEmailIndex(storage, EMAIL, EMP_B, true);
  seedRoster(storage, EMAIL, EMP_A, true);
  seedRoster(storage, EMAIL, EMP_B, true);
  seedAgreement(storage, EMP_A);
  seedAgreement(storage, EMP_B, { serviceActive: false });  // inactive
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'request', email: EMAIL }));
  assert.equal(res.statusCode, 200);
  const magicKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-magic::'));
  assert.equal(magicKeys.length, 1, 'only one magic record (EMP_A)');
  assert.equal(JSON.parse(storage[magicKeys[0]]).employerKey, EMP_A);
});

// ── step:'verify' — token validation ─────────────────────────────────────────

await test('T17 verify: missing magicToken returns 400', async () => {
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify' }));
  assert.equal(res.statusCode, 400);
});

await test('T18 verify: wrong HMAC signature returns 401', async () => {
  const tokenUuid = crypto.randomUUID();
  const token = makeMagicToken(validMagicPayload(tokenUuid), 'wrong-secret');
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T19 verify: legacySig token (old scheme) returns 401 — HMAC required', async () => {
  const tokenUuid = crypto.randomUUID();
  const token = makeLegacySigToken(validMagicPayload(tokenUuid));
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T20 verify: token with no expiry field returns 401', async () => {
  const tokenUuid = crypto.randomUUID();
  const token = makeMagicToken({ tokenUuid, role: 'manager-magic', email: EMAIL, employerKey: EMP_A });
  // expires is absent; typeof undefined !== 'number'
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T21 verify: token with string expiry returns 401', async () => {
  const tokenUuid = crypto.randomUUID();
  const token = makeMagicToken({ tokenUuid, role: 'manager-magic', email: EMAIL, employerKey: EMP_A, expires: '2099-01-01' });
  // typeof '2099-01-01' !== 'number'
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T22 verify: token with past expiry returns 401', async () => {
  const tokenUuid = crypto.randomUUID();
  const token = makeMagicToken(validMagicPayload(tokenUuid, { expires: Date.now() - 1000 }));
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T23 verify: token with wrong role returns 401', async () => {
  const tokenUuid = crypto.randomUUID();
  const token = makeMagicToken(validMagicPayload(tokenUuid, { role: 'manager-learning' }));
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T24 verify: token with missing tokenUuid returns 401', async () => {
  const token = makeMagicToken({ role: 'manager-magic', email: EMAIL, employerKey: EMP_A, expires: Date.now() + 60000 });
  const handler = loadHandler();
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
});

await test('T25 verify: missing magic record (token not issued or already used) returns 409', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  // No magic record seeded
  const handler   = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 409);
});

// ── Cross-validation: failed check must NOT consume the magic link ────────────

await test('T26 verify: stored tokenUuid mismatch → 401, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  // Record has wrong tokenUuid in the stored VALUE
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid:   crypto.randomUUID(),  // different UUID in value
    email:       EMAIL.toLowerCase(),
    employerKey: EMP_A,
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires).toISOString()
  });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'claim must not be written on tokenUuid mismatch');
});

await test('T27 verify: stored email mismatch → 401, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid,
    email:       'different@other.local',  // wrong email in stored record
    employerKey: EMP_A,
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires).toISOString()
  });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'claim must not be written on email mismatch');
});

await test('T28 verify: stored employerKey mismatch → 401, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid,
    email:       EMAIL.toLowerCase(),
    employerKey: EMP_B,  // wrong employer in stored record
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires).toISOString()
  });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'claim must not be written on employerKey mismatch');
});

await test('T29 verify: stored expiresAt mismatch → 401, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid,
    email:       EMAIL.toLowerCase(),
    employerKey: EMP_A,
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires + 1000).toISOString()  // 1 second offset — deliberate mismatch
  });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 401);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'claim must not be written on expiresAt mismatch');
});

await test('T30 verify: after cross-validation rejection, link is still usable with a corrected record', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  // First: poison the magic record (wrong tokenUuid in value)
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid:   crypto.randomUUID(),
    email:       EMAIL.toLowerCase(),
    employerKey: EMP_A,
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires).toISOString()
  });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);

  const handler1 = loadHandler(storage);
  const res1 = await handler1(post({ step: 'verify', magicToken: token }));
  assert.equal(res1.statusCode, 401, 'poisoned record must be rejected');
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'link must not be consumed on rejection');

  // Fix the magic record — simulates correcting the stored data
  storage[`p1-mgr-magic::${tokenUuid}`] = JSON.stringify({
    tokenUuid,
    email:       EMAIL.toLowerCase(),
    employerKey: EMP_A,
    issuedAt:    new Date().toISOString(),
    expiresAt:   new Date(expires).toISOString()
  });

  const handler2 = loadHandler(storage);
  const res2 = await handler2(post({ step: 'verify', magicToken: token }));
  assert.equal(res2.statusCode, 200, 'link must succeed once the record is corrected');
});

// ── Revocation checks: failed check must NOT consume the magic link ───────────

await test('T31 verify: agreement not found → 403, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedRoster(storage, EMAIL, EMP_A, true);
  // No agreement seeded
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 403);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'claim must not be written when agreement is missing');
});

await test('T32 verify: agreement inactive → 403, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedRoster(storage, EMAIL, EMP_A, true);
  seedAgreement(storage, EMP_A, { serviceActive: false });
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 403);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage));
});

await test('T33 verify: agreement expired → 403, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedRoster(storage, EMAIL, EMP_A, true);
  seedAgreement(storage, EMP_A, { serviceExpiresAt: new Date(Date.now() - 1000).toISOString() });
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 403);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage));
});

await test('T34 verify: roster entry missing → 403, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  // No roster entry seeded
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 403);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage));
});

await test('T35 verify: roster entry inactive → 403, claim not written', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, false);  // removed
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 403);
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage));
});

await test('T36 verify: after revocation rejection, link usable once manager is re-activated', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, false);  // initially removed

  const handler1 = loadHandler(storage);
  const res1 = await handler1(post({ step: 'verify', magicToken: token }));
  assert.equal(res1.statusCode, 403, 'must be rejected while roster is inactive');
  assert.ok(!(`p1-mgr-claimed::${tokenUuid}` in storage), 'claim must not be written on revocation failure');

  // Re-activate the manager
  seedRoster(storage, EMAIL, EMP_A, true);

  const handler2 = loadHandler(storage);
  const res2 = await handler2(post({ step: 'verify', magicToken: token }));
  assert.equal(res2.statusCode, 200, 'link must succeed after re-activation');
});

// ── Successful verify ─────────────────────────────────────────────────────────

await test('T37 verify: valid token → 200 with learningToken', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.learningToken && typeof body.learningToken === 'string', 'learningToken must be a string');
});

await test('T38 verify: learningToken has correct role, email, and employerKey', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  const { learningToken } = JSON.parse(res.body);
  const payload = decodeLearningToken(learningToken);
  assert.equal(payload.role,        'manager-learning');
  assert.equal(payload.email,       EMAIL.toLowerCase());
  assert.equal(payload.employerKey, EMP_A);
});

await test('T39 verify: learningToken expires in approximately 30 days', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  const { learningToken } = JSON.parse(res.body);
  const payload = decodeLearningToken(learningToken);
  const diff = payload.expires - Date.now();
  assert.ok(diff > 29 * 86400000, 'learning token must expire at least 29 days from now');
  assert.ok(diff < 31 * 86400000, 'learning token must not expire more than 31 days from now');
});

await test('T40 verify: magic record deleted and claim marker written after successful verify', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 200);
  assert.ok(!(`p1-mgr-magic::${tokenUuid}` in storage), 'magic record must be deleted after claim');
  assert.ok(`p1-mgr-claimed::${tokenUuid}` in storage, 'claim marker must exist after successful verify');
  const claim = JSON.parse(storage[`p1-mgr-claimed::${tokenUuid}`]);
  assert.ok(claim.claimedAt,         'claimedAt must be set');
  assert.ok(claim.safeToDeleteAfter, 'safeToDeleteAfter must be set');
});

await test('T41 verify: second verify of same token → 409 (single-use claim)', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);

  const handler1 = loadHandler(storage);
  const res1 = await handler1(post({ step: 'verify', magicToken: token }));
  assert.equal(res1.statusCode, 200, 'first verify must succeed');

  // Restore magic record (the handler deleted it) to reach the claim check on second verify
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  const handler2 = loadHandler(storage);
  const res2 = await handler2(post({ step: 'verify', magicToken: token }));
  assert.equal(res2.statusCode, 409, 'second verify must be rejected (claim marker exists)');
});

// ── Concurrent redemption ─────────────────────────────────────────────────────

await test('T42 concurrent verify: exactly one request succeeds, one fails 409', async () => {
  const tokenUuid = crypto.randomUUID();
  const expires   = Date.now() + 60000;
  const token     = makeMagicToken(validMagicPayload(tokenUuid, { expires }));
  const storage   = {};
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);

  // Both handlers share the same storage object — they race on the claim marker.
  // The mock's setJSON({ onlyIfNew: true }) is synchronous, so the check-and-set
  // is effectively atomic within the JavaScript single-thread model.
  const handler = loadHandler(storage);
  const [res1, res2] = await Promise.all([
    handler(post({ step: 'verify', magicToken: token })),
    handler(post({ step: 'verify', magicToken: token }))
  ]);

  const statuses = [res1.statusCode, res2.statusCode].sort();
  assert.deepEqual(statuses, [200, 409], 'exactly one 200 and one 409 must result');

  // Claim marker is written exactly once
  assert.ok(`p1-mgr-claimed::${tokenUuid}` in storage, 'claim marker must be present');
});

// ── Email normalisation ───────────────────────────────────────────────────────

await test('T43 verify: uppercase email in token payload is normalised in learning token', async () => {
  const tokenUuid  = crypto.randomUUID();
  const expires    = Date.now() + 60000;
  const upperEmail = EMAIL.toUpperCase();  // 'MGR@TESTFIRM.LOCAL'
  const token      = makeMagicToken({ tokenUuid, role: 'manager-magic', email: upperEmail, employerKey: EMP_A, expires });
  const storage    = {};
  // Magic record and roster must use the normalised (lowercase) email to pass cross-validation
  seedMagicRecord(storage, tokenUuid, { email: EMAIL, empKey: EMP_A, expires });
  seedAgreement(storage, EMP_A);
  seedRoster(storage, EMAIL, EMP_A, true);  // keyed with normalised email
  const handler = loadHandler(storage);
  const res = await handler(post({ step: 'verify', magicToken: token }));
  assert.equal(res.statusCode, 200);
  const payload = decodeLearningToken(JSON.parse(res.body).learningToken);
  assert.equal(payload.email, EMAIL.toLowerCase(), 'learning token must contain normalised email');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\ntest-reauth-v2-clean results:');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n        ${r.message}`}`);
}
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
