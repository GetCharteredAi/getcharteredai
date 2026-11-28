/**
 * Focused mocked-storage tests for netlify/functions/p1-manager-learning-claim.js
 * No real Blobs, no real email, no network calls.
 */

import { createRequire } from 'module';
import path   from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import crypto from 'crypto';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const require    = createRequire(import.meta.url);

const FUNC_PATH  = path.resolve(__dirname, '../netlify/functions/p1-manager-learning-claim.js');
const BLOBS_PATH = require.resolve('@netlify/blobs');

// ── Mock store factory ─────────────────────────────────────────────────────────

function createMockBlobs(storage) {
  return {
    getStore: (nameOrOpts) => {
      const name = typeof nameOrOpts === 'string' ? nameOrOpts : nameOrOpts.name;
      return {
        setJSON: async (key, val, opts = {}) => {
          const k = `${name}::${key}`;
          if (opts.onlyIfNew && k in storage) return { modified: false };
          storage[k] = JSON.parse(JSON.stringify(val));
          return { modified: true };
        },
        get: async (key) => {
          const k = `${name}::${key}`;
          return k in storage ? JSON.parse(JSON.stringify(storage[k])) : null;
        },
        delete: async (key) => { delete storage[`${name}::${key}`]; }
      };
    }
  };
}

function loadHandler(storage) {
  delete require.cache[FUNC_PATH];
  require.cache[BLOBS_PATH] = {
    id: BLOBS_PATH, filename: BLOBS_PATH, loaded: true,
    exports: createMockBlobs(storage)
  };
  process.env.JWT_SECRET            = 'test-secret';
  process.env.P1_STORE_PREFIX       = '';
  process.env.NETLIFY_BLOBS_CONTEXT = 'dummy';
  return require(FUNC_PATH).handler;
}

function post(storage, body) {
  return loadHandler(storage)({ httpMethod: 'POST', body: JSON.stringify(body) });
}

// ── Token helpers ──────────────────────────────────────────────────────────────

const SECRET = 'test-secret';

function makeInviteToken(payload, secret = SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

function makeLegacySigToken(payload, secret = SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = Buffer.from(`${tokenData}.${secret}`).toString('base64').slice(0, 32);
  return `${tokenData}.${sig}`;
}

function decodeToken(token) {
  const lastDot = token.lastIndexOf('.');
  return JSON.parse(Buffer.from(token.slice(0, lastDot), 'base64').toString('utf8'));
}

// ── Seed helpers ───────────────────────────────────────────────────────────────

const TEST_EMAIL    = 'manager@testfirm.local';
const TEST_EMPLOYER = crypto.randomUUID();

function makeInvitePayload(overrides = {}) {
  return {
    role:        'manager-invite',
    tokenUuid:   crypto.randomUUID(),
    email:       TEST_EMAIL,
    employerKey: TEST_EMPLOYER,
    expires:     Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...overrides
  };
}

function seedValidState(storage, payload) {
  const { tokenUuid, email, employerKey } = payload;
  const emailKey  = Buffer.from(email).toString('base64url');
  const rosterKey = `${employerKey}/${emailKey}`;
  storage[`p1-employer-agreements::${employerKey}`] = {
    employerKey, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  storage[`p1-manager-roster::${rosterKey}`] = { email, employerKey, active: true };
  storage[`p1-mgr-invites::${tokenUuid}`]    = { tokenUuid, email, employerKey };
}

// ── Test runner ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result
      .then(() => { console.log(`  PASS  ${name}`); passed++; })
      .catch(e  => { console.error(`  FAIL  ${name}`); console.error(`        ${e.message}`); failed++; });
  }
  console.log(`  PASS  ${name}`);
  passed++;
  return Promise.resolve();
}

// ── Method and input validation ────────────────────────────────────────────────

console.log('\nMethod and input validation');

await test('T01 OPTIONS → 200', async () => {
  const storage = {};
  const res = await loadHandler(storage)({ httpMethod: 'OPTIONS', body: '' });
  assert.strictEqual(res.statusCode, 200);
});

await test('T02 GET → 405', async () => {
  const storage = {};
  const res = await loadHandler(storage)({ httpMethod: 'GET', body: '' });
  assert.strictEqual(res.statusCode, 405);
});

await test('T03 invalid JSON body → 400', async () => {
  const storage = {};
  const res = await loadHandler(storage)({ httpMethod: 'POST', body: 'not-json' });
  assert.strictEqual(res.statusCode, 400);
});

await test('T04 missing claimToken → 400', async () => {
  const res = await post({}, {});
  assert.strictEqual(res.statusCode, 400);
});

// ── Token verification ─────────────────────────────────────────────────────────

console.log('\nToken verification');

await test('T05 wrong HMAC signature → 401', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload, 'wrong-secret');
  const res     = await post({}, { claimToken: token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T06 legacySig token → 401 (rejected after HMAC fix)', async () => {
  const payload = makeInvitePayload();
  const token   = makeLegacySigToken(payload);
  const res     = await post({}, { claimToken: token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T07 missing expires field → 401', async () => {
  const { expires: _, ...bare } = makeInvitePayload();
  const token = makeInviteToken(bare);
  const res   = await post({}, { claimToken: token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T08 past expiry → 401', async () => {
  const payload = makeInvitePayload({ expires: Date.now() - 1000 });
  const token   = makeInviteToken(payload);
  const res     = await post({}, { claimToken: token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T09 wrong role → 401', async () => {
  const payload = makeInvitePayload({ role: 'manager-learning' });
  const token   = makeInviteToken(payload);
  const res     = await post({}, { claimToken: token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T10 missing tokenUuid → 401', async () => {
  const { tokenUuid: _, ...bare } = makeInvitePayload();
  const token = makeInviteToken(bare);
  const res   = await post({}, { claimToken: token });
  assert.strictEqual(res.statusCode, 401);
});

// ── Single-use and state checks ────────────────────────────────────────────────

console.log('\nSingle-use and state checks');

await test('T11 already claimed → 409', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  storage[`p1-mgr-claimed::${payload.tokenUuid}`] = { claimedAt: new Date().toISOString() };
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 409);
});

await test('T12 invite record missing after claim → 409', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  // Note: invite record NOT seeded — only agreement and roster
  const emailKey  = Buffer.from(payload.email).toString('base64url');
  const rosterKey = `${payload.employerKey}/${emailKey}`;
  storage[`p1-employer-agreements::${payload.employerKey}`] = {
    employerKey: payload.employerKey, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  storage[`p1-manager-roster::${rosterKey}`] = { email: payload.email, employerKey: payload.employerKey, active: true };
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 409);
});

// ── Agreement and roster checks ────────────────────────────────────────────────

console.log('\nAgreement and roster checks');

await test('T13 agreement not found → 403', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  storage[`p1-mgr-invites::${payload.tokenUuid}`] = { tokenUuid: payload.tokenUuid };
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T14 agreement inactive → 403', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  storage[`p1-mgr-invites::${payload.tokenUuid}`]      = { tokenUuid: payload.tokenUuid };
  storage[`p1-employer-agreements::${payload.employerKey}`] = {
    employerKey: payload.employerKey, serviceActive: false,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T15 agreement expired → 403', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  storage[`p1-mgr-invites::${payload.tokenUuid}`]      = { tokenUuid: payload.tokenUuid };
  storage[`p1-employer-agreements::${payload.employerKey}`] = {
    employerKey: payload.employerKey, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() - 1000).toISOString()
  };
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T16 roster entry missing → 403', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  storage[`p1-mgr-invites::${payload.tokenUuid}`]      = { tokenUuid: payload.tokenUuid };
  storage[`p1-employer-agreements::${payload.employerKey}`] = {
    employerKey: payload.employerKey, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  // roster NOT seeded
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T17 roster entry inactive → 403', async () => {
  const payload   = makeInvitePayload();
  const token     = makeInviteToken(payload);
  const storage   = {};
  const emailKey  = Buffer.from(payload.email).toString('base64url');
  const rosterKey = `${payload.employerKey}/${emailKey}`;
  storage[`p1-mgr-invites::${payload.tokenUuid}`]      = { tokenUuid: payload.tokenUuid };
  storage[`p1-employer-agreements::${payload.employerKey}`] = {
    employerKey: payload.employerKey, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  storage[`p1-manager-roster::${rosterKey}`] = { email: payload.email, employerKey: payload.employerKey, active: false };
  const res = await post(storage, { claimToken: token });
  assert.strictEqual(res.statusCode, 403);
});

// ── Valid claim and output ─────────────────────────────────────────────────────

console.log('\nValid claim and output');

// Shared fixture for T18-T23
const validPayload  = makeInvitePayload();
const validToken    = makeInviteToken(validPayload);
const validStorage  = {};
seedValidState(validStorage, validPayload);
const validRes      = await post(validStorage, { claimToken: validToken });

await test('T18 valid claim → 200', async () => {
  assert.strictEqual(validRes.statusCode, 200);
});

await test('T19 response includes learningToken', async () => {
  const body = JSON.parse(validRes.body);
  assert.ok(typeof body.learningToken === 'string', 'learningToken missing');
});

await test('T20 learningToken: role manager-learning, correct email and employerKey', async () => {
  const { learningToken } = JSON.parse(validRes.body);
  const lp = decodeToken(learningToken);
  assert.strictEqual(lp.role,        'manager-learning');
  assert.strictEqual(lp.email,       validPayload.email);
  assert.strictEqual(lp.employerKey, validPayload.employerKey);
});

await test('T21 invite record deleted after claim', async () => {
  assert.ok(!(`p1-mgr-invites::${validPayload.tokenUuid}` in validStorage), 'invite record should be deleted');
});

await test('T22 roster entry updated with claimedAt', async () => {
  const emailKey  = Buffer.from(validPayload.email).toString('base64url');
  const rosterKey = `p1-manager-roster::${validPayload.employerKey}/${emailKey}`;
  const entry     = validStorage[rosterKey];
  assert.ok(entry, 'roster entry missing');
  assert.ok(entry.claimedAt, 'claimedAt not set on roster entry');
});

await test('T23 safeToDeleteAfter set on claim marker', async () => {
  const marker = validStorage[`p1-mgr-claimed::${validPayload.tokenUuid}`];
  assert.ok(marker, 'claim marker missing');
  assert.ok(typeof marker.safeToDeleteAfter === 'string', 'safeToDeleteAfter missing');
  const safeTime = new Date(marker.safeToDeleteAfter).getTime();
  assert.ok(Number.isFinite(safeTime), 'safeToDeleteAfter not a valid date');
  assert.ok(safeTime > Date.now(), 'safeToDeleteAfter should be in the future');
});

// ── Concurrent single-use ──────────────────────────────────────────────────────

console.log('\nConcurrent single-use');

await test('T24 concurrent claim: exactly one 200 and one 409', async () => {
  const payload = makeInvitePayload();
  const token   = makeInviteToken(payload);
  const storage = {};
  seedValidState(storage, payload);
  const handler = loadHandler(storage);
  const req     = { httpMethod: 'POST', body: JSON.stringify({ claimToken: token }) };
  const [r1, r2] = await Promise.all([handler(req), handler(req)]);
  const codes   = [r1.statusCode, r2.statusCode].sort();
  assert.deepStrictEqual(codes, [200, 409], `expected [200,409], got ${JSON.stringify(codes)}`);
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
