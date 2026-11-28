/**
 * Focused unit tests for draft-p1-manager-roster.js
 *
 * Coverage:
 *   - Employer JWT auth (HMAC and legacySig fallback)
 *   - Agreement checks (missing, inactive, expired)
 *   - list: empty, populated, cross-employer isolation, pagination over multiple pages
 *   - add: new manager, roster record, email index, invite token, rate limit
 *   - add: re-activating a removed manager (index set back to active:true)
 *   - add: same email added under two separate employers (multi-employer membership)
 *   - add: HTML escaping of firm name in invitation email
 *   - add: email address normalisation (uppercase → lowercase)
 *   - remove: deactivation, email index set to active:false
 *   - remove: 404 for unknown manager
 *   - email index write failure does not block roster update (add or remove)
 *
 * No production Blobs, no live email, no deployment.
 *
 * Run: node scripts/test-draft-p1-manager-roster.mjs
 */

import assert from 'assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

const FUNC_PATH  = path.resolve(__dirname, '../netlify/functions/p1-manager-roster.js');
const BLOBS_PATH = require.resolve('@netlify/blobs');

const TEST_SECRET = 'test-roster-secret';

// ── Token helpers ─────────────────────────────────────────────────────────────

function makeHmacToken(payload, secret = TEST_SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

function makeLegacyToken(payload, secret = TEST_SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const legacySig = Buffer.from(`${tokenData}.${secret}`).toString('base64').slice(0, 32);
  return `${tokenData}.${legacySig}`;
}

function makeEmployerToken(employerKey, overrides = {}) {
  return makeHmacToken({ role: 'employer', employerKey, expires: Date.now() + 60000, ...overrides });
}

function makeLegacyEmployerToken(employerKey) {
  return makeLegacyToken({ role: 'employer', employerKey, expires: Date.now() + 60000 });
}

// ── Mock stores ───────────────────────────────────────────────────────────────

// Standard in-memory mock — returns all matching blobs in one shot (no cursor).
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
        const blobs = Object.keys(storage)
          .filter(k => k.startsWith(`${name}::${prefix}`))
          .map(k => ({ key: k.slice(name.length + 2) }));
        return { blobs, directories: [] };
      }
    };
  };
}

// Paginated mock — returns at most pageSize blobs per call; cursor is a numeric string offset.
function createPaginatedMockStore(storage = {}, pageSize = 2) {
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
        const prefix   = opts.prefix || '';
        const startIdx = opts.cursor ? parseInt(opts.cursor, 10) : 0;
        const allBlobs = Object.keys(storage)
          .filter(k => k.startsWith(`${name}::${prefix}`))
          .sort()
          .map(k => ({ key: k.slice(name.length + 2) }));
        const page       = allBlobs.slice(startIdx, startIdx + pageSize);
        const nextCursor = startIdx + pageSize < allBlobs.length
          ? String(startIdx + pageSize)
          : undefined;
        return { blobs: page, directories: [], cursor: nextCursor };
      }
    };
  };
}

// Mock where the email index store (p1-mgr-by-email) throws on setJSON — simulates
// a transient write failure without affecting any other store.
function createMockStoreWithIndexFailure(storage = {}) {
  return (nameOrOpts) => {
    const name       = typeof nameOrOpts === 'string' ? nameOrOpts : nameOrOpts.name;
    const isEmailIdx = name.includes('mgr-by-email');
    return {
      get: async (key, opts) => {
        const raw = storage[`${name}::${key}`];
        if (raw === undefined) return null;
        return opts?.type === 'json' ? JSON.parse(raw) : raw;
      },
      setJSON: async (key, value, opts) => {
        if (isEmailIdx) throw new Error('Simulated index write failure');
        const k = `${name}::${key}`;
        if (opts?.onlyIfNew && k in storage) return { modified: false, etag: '' };
        storage[k] = JSON.stringify(value);
        return { modified: true, etag: `etag-${Date.now()}` };
      },
      delete: async (key) => { delete storage[`${name}::${key}`]; },
      list: async (opts = {}) => {
        const prefix = opts.prefix || '';
        const blobs = Object.keys(storage)
          .filter(k => k.startsWith(`${name}::${prefix}`))
          .map(k => ({ key: k.slice(name.length + 2) }));
        return { blobs, directories: [] };
      }
    };
  };
}

// ── Handler factory ───────────────────────────────────────────────────────────

function loadHandler(storage = {}, { failEmailIdx = false, paginated = false, pageSize = 2 } = {}) {
  delete require.cache[FUNC_PATH];
  let mockFn;
  if (failEmailIdx) {
    mockFn = createMockStoreWithIndexFailure(storage);
  } else if (paginated) {
    mockFn = createPaginatedMockStore(storage, pageSize);
  } else {
    mockFn = createMockStore(storage);
  }
  require.cache[BLOBS_PATH] = {
    id: BLOBS_PATH, filename: BLOBS_PATH, loaded: true,
    exports: { getStore: mockFn }
  };
  process.env.NETLIFY_BLOBS_CONTEXT = '1';
  process.env.JWT_SECRET = TEST_SECRET;
  delete process.env.RESEND_API_KEY;
  return require(FUNC_PATH).handler;
}

function post(body) {
  return { httpMethod: 'POST', body: JSON.stringify(body) };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMP_A = crypto.randomUUID();
const EMP_B = crypto.randomUUID();
const EMAIL_1 = 'alice@acme.local';
const EMAIL_2 = 'bob@acme.local';
const EMAIL_3 = 'charlie@beta.local';

function emailKey(email) {
  return Buffer.from(email.trim().toLowerCase()).toString('base64url');
}

function makeAgreement(employerKey, overrides = {}) {
  return {
    employerKey,
    firmName:             overrides.firmName || 'Test Firm',
    serviceStartsAt:      new Date(Date.now() - 86400000).toISOString(),
    serviceExpiresAt:     overrides.serviceExpiresAt || new Date(Date.now() + 365 * 86400000).toISOString(),
    serviceActive:        overrides.serviceActive !== undefined ? overrides.serviceActive : true,
    employerContactEmail: 'admin@testfirm.local'
  };
}

function makeRosterRecord(email, employerKey, overrides = {}) {
  return {
    email:      email.toLowerCase(),
    employerKey,
    active:     overrides.active !== undefined ? overrides.active : true,
    addedAt:    overrides.addedAt || new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    claimedAt:  overrides.claimedAt || null
  };
}

function seedStorage(storage, { employers = [], rosters = [] } = {}) {
  for (const [key, val] of employers) {
    storage[`p1-employer-agreements::${key}`] = JSON.stringify(val);
  }
  for (const [key, val] of rosters) {
    storage[`p1-manager-roster::${key}`] = JSON.stringify(val);
  }
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
  const res = await handler({ httpMethod: 'OPTIONS' });
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

// ── Employer JWT auth ─────────────────────────────────────────────────────────

await test('T04 missing token returns 401', async () => {
  const handler = loadHandler();
  const res = await handler(post({ action: 'list' }));
  assert.equal(res.statusCode, 401);
});

await test('T05 tampered HMAC token returns 401', async () => {
  const handler = loadHandler();
  const token = makeEmployerToken(EMP_A);
  const tampered = token.slice(0, -3) + 'xxx';
  const res = await handler(post({ token: tampered, action: 'list' }));
  assert.equal(res.statusCode, 401);
});

await test('T06 expired HMAC token returns 401', async () => {
  const handler = loadHandler();
  const token = makeHmacToken({ role: 'employer', employerKey: EMP_A, expires: Date.now() - 1000 });
  const res = await handler(post({ token, action: 'list' }));
  assert.equal(res.statusCode, 401);
});

await test('T07 non-employer role returns 403', async () => {
  const handler = loadHandler();
  const token = makeHmacToken({ role: 'candidate', employerKey: EMP_A, expires: Date.now() + 60000 });
  const res = await handler(post({ token, action: 'list' }));
  assert.equal(res.statusCode, 403);
});

await test('T08 legacy-signed employer token is accepted', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const token = makeLegacyEmployerToken(EMP_A);
  const res = await handler(post({ token, action: 'list' }));
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(JSON.parse(res.body).managers));
});

await test('T09 valid token but missing agreement returns 404', async () => {
  const handler = loadHandler({});
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 404);
});

await test('T10 inactive agreement returns 403', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A, { serviceActive: false })]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 403);
});

await test('T11 expired agreement returns 403', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A, { serviceExpiresAt: new Date(Date.now() - 1000).toISOString() })]]
  });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 403);
});

// ── List action ───────────────────────────────────────────────────────────────

await test('T12 list: empty roster returns empty managers array', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body).managers, []);
});

await test('T13 list: returns all managers for employer (active and removed)', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)]],
    rosters: [
      [`${EMP_A}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_A, { active: true })],
      [`${EMP_A}/${emailKey(EMAIL_2)}`, makeRosterRecord(EMAIL_2, EMP_A, { active: false })]
    ]
  });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 200);
  const { managers } = JSON.parse(res.body);
  assert.equal(managers.length, 2);
  const emails = managers.map(m => m.email).sort();
  assert.deepEqual(emails, [EMAIL_1.toLowerCase(), EMAIL_2.toLowerCase()]);
});

await test('T14 list: cross-employer isolation — employer A cannot see employer B managers', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)], [EMP_B, makeAgreement(EMP_B)]],
    rosters: [
      [`${EMP_A}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_A)],
      [`${EMP_B}/${emailKey(EMAIL_3)}`, makeRosterRecord(EMAIL_3, EMP_B)]
    ]
  });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 200);
  const { managers } = JSON.parse(res.body);
  assert.equal(managers.length, 1);
  assert.equal(managers[0].email, EMAIL_1.toLowerCase());
  assert.ok(!managers.some(m => m.email === EMAIL_3.toLowerCase()), 'employer B manager must not appear');
});

await test('T15 list: pagination — all managers returned across multiple pages', async () => {
  // Uses paginated mock (pageSize=2) with 5 managers; expects all 5 returned.
  const storage = {};
  const emails = ['mgr1@test.local', 'mgr2@test.local', 'mgr3@test.local', 'mgr4@test.local', 'mgr5@test.local'];
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)]],
    rosters: emails.map(e => [`${EMP_A}/${emailKey(e)}`, makeRosterRecord(e, EMP_A)])
  });
  const handler = loadHandler(storage, { paginated: true, pageSize: 2 });
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'list' }));
  assert.equal(res.statusCode, 200);
  const { managers } = JSON.parse(res.body);
  assert.equal(managers.length, 5, `expected 5 managers across 3 pages, got ${managers.length}`);
});

// ── Add action ────────────────────────────────────────────────────────────────

await test('T16 add: creates roster record with correct fields', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A, { firmName: 'Acme Corp' })]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { sent: true });

  const record = JSON.parse(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`]);
  assert.equal(record.email, EMAIL_1.toLowerCase());
  assert.equal(record.employerKey, EMP_A);
  assert.equal(record.active, true);
  assert.ok(record.addedAt, 'addedAt must be set');
  assert.ok(record.updatedAt, 'updatedAt must be set');
});

await test('T17 add: writes email secondary index entry with active:true', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));

  const idxEntry = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`]);
  assert.equal(idxEntry.email, EMAIL_1.toLowerCase());
  assert.equal(idxEntry.employerKey, EMP_A);
  assert.equal(idxEntry.active, true);
  assert.ok(idxEntry.updatedAt, 'updatedAt must be set on index entry');
});

await test('T18 add: invite record written to mgr-invites store', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));

  const inviteKeys = Object.keys(storage).filter(k => k.startsWith('p1-mgr-invites::'));
  assert.equal(inviteKeys.length, 1, 'exactly one invite record should be created');
  const invite = JSON.parse(storage[inviteKeys[0]]);
  assert.equal(invite.email, EMAIL_1.toLowerCase());
  assert.equal(invite.employerKey, EMP_A);
  assert.ok(invite.tokenUuid, 'tokenUuid must be present');
  assert.ok(invite.expiresAt, 'expiresAt must be present');
});

await test('T19 add: rate limit — second add within 5 min returns {sent:true} without new invite', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));
  const invitesBefore = Object.keys(storage).filter(k => k.startsWith('p1-mgr-invites::')).length;

  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { sent: true });
  const invitesAfter = Object.keys(storage).filter(k => k.startsWith('p1-mgr-invites::')).length;
  assert.equal(invitesAfter, invitesBefore, 'no new invite should be created within rate limit window');
});

await test('T20 add: re-activates removed manager and sets email index to active:true', async () => {
  const storage = {};
  const addedAt = new Date(Date.now() - 86400000).toISOString();
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)]],
    rosters: [[`${EMP_A}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_A, { active: false, addedAt })]]
  });
  storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`] = JSON.stringify({
    email: EMAIL_1.toLowerCase(), employerKey: EMP_A, active: false, updatedAt: addedAt
  });

  const handler = loadHandler(storage);
  await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));

  const record = JSON.parse(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`]);
  assert.equal(record.active, true, 'roster must be active:true after re-add');
  assert.equal(record.addedAt, addedAt, 'original addedAt must be preserved on reactivation');

  const idxEntry = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`]);
  assert.equal(idxEntry.active, true, 'email index must be updated to active:true on re-add');
});

await test('T21 add: same email under two employers creates separate index entries', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)], [EMP_B, makeAgreement(EMP_B)]]
  });
  // Add EMAIL_1 to both employers in sequence
  const handler = loadHandler(storage);
  await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));
  // Clear rate limit so second add is not suppressed
  const rlKey = `p1-mgr-rl::${emailKey(EMAIL_1)}`;
  delete storage[rlKey];
  await handler(post({ token: makeEmployerToken(EMP_B), action: 'add', email: EMAIL_1 }));

  // Both roster entries should exist
  const rosterA = JSON.parse(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`]);
  const rosterB = JSON.parse(storage[`p1-manager-roster::${EMP_B}/${emailKey(EMAIL_1)}`]);
  assert.equal(rosterA.active, true);
  assert.equal(rosterB.active, true);

  // Both index entries should exist and each point to the correct employer
  const idxA = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`]);
  const idxB = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_B}`]);
  assert.equal(idxA.employerKey, EMP_A);
  assert.equal(idxB.employerKey, EMP_B);
  assert.equal(idxA.active, true);
  assert.equal(idxB.active, true);
});

await test('T22 add: removing from one employer does not affect the other employer membership', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)], [EMP_B, makeAgreement(EMP_B)]],
    rosters: [
      [`${EMP_A}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_A, { active: true })],
      [`${EMP_B}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_B, { active: true })]
    ]
  });
  storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`] = JSON.stringify({
    email: EMAIL_1.toLowerCase(), employerKey: EMP_A, active: true, updatedAt: new Date().toISOString()
  });
  storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_B}`] = JSON.stringify({
    email: EMAIL_1.toLowerCase(), employerKey: EMP_B, active: true, updatedAt: new Date().toISOString()
  });

  const handler = loadHandler(storage);
  // Remove from EMP_A only
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'remove', email: EMAIL_1 }));
  assert.equal(res.statusCode, 200);

  // EMP_A roster and index should be inactive
  const rosterA = JSON.parse(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`]);
  assert.equal(rosterA.active, false, 'EMP_A roster must be inactive after removal');
  const idxA = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`]);
  assert.equal(idxA.active, false, 'EMP_A index must be inactive after removal');

  // EMP_B roster and index must be unaffected
  const rosterB = JSON.parse(storage[`p1-manager-roster::${EMP_B}/${emailKey(EMAIL_1)}`]);
  assert.equal(rosterB.active, true, 'EMP_B roster must remain active after EMP_A removal');
  const idxB = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_B}`]);
  assert.equal(idxB.active, true, 'EMP_B index must remain active after EMP_A removal');
});

await test('T23 add: email address is normalised to lowercase', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: 'ALICE@ACME.LOCAL' }));

  const rKey = `p1-manager-roster::${EMP_A}/${emailKey('alice@acme.local')}`;
  const record = JSON.parse(storage[rKey]);
  assert.equal(record.email, 'alice@acme.local', 'stored email must be lowercase');
});

await test('T24 add: HTML special chars in firm name are escaped in invitation email', async () => {
  const dangerousFirmName = 'Acme & <Brothers> "Corp"';
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A, { firmName: dangerousFirmName })]] });

  let capturedHtml = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('resend.com')) {
      capturedHtml = JSON.parse(opts.body).html;
      return { ok: true, json: async () => ({ id: 'mock-id' }) };
    }
    return realFetch ? realFetch(url, opts) : Promise.reject(new Error(`Unexpected fetch: ${url}`));
  };

  const handler = loadHandler(storage);
  // Set RESEND_API_KEY after loadHandler (which deletes it) so sendEmail fires
  process.env.RESEND_API_KEY = 'test-key-local-only';
  try {
    await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));
  } finally {
    delete process.env.RESEND_API_KEY;
    globalThis.fetch = realFetch;
  }

  assert.ok(capturedHtml, 'email HTML should have been captured');
  assert.ok(!capturedHtml.includes('<Brothers>'), 'unescaped < should not appear in email HTML');
  assert.ok(capturedHtml.includes('&lt;Brothers&gt;'), 'angle brackets must be HTML-escaped');
  assert.ok(capturedHtml.includes('Acme &amp;'), 'ampersand must be HTML-escaped');
});

await test('T25 add: missing email returns 400', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'add' }));
  assert.equal(res.statusCode, 400);
});

await test('T26 add: invalid email returns 400', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: 'not-an-email' }));
  assert.equal(res.statusCode, 400);
});

await test('T27 add: email index write failure does not prevent roster update', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage, { failEmailIdx: true });
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'add', email: EMAIL_1 }));
  assert.equal(res.statusCode, 200, 'roster add should succeed despite index failure');
  assert.ok(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`],
    'roster record must be written even when index write fails');
});

// ── Remove action ─────────────────────────────────────────────────────────────

await test('T28 remove: sets active:false and updates email index to active:false', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)]],
    rosters: [[`${EMP_A}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_A, { active: true })]]
  });
  storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`] = JSON.stringify({
    email: EMAIL_1.toLowerCase(), employerKey: EMP_A, active: true, updatedAt: new Date().toISOString()
  });

  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'remove', email: EMAIL_1 }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { removed: true });

  const record = JSON.parse(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`]);
  assert.equal(record.active, false, 'roster must be active:false after removal');

  const idxEntry = JSON.parse(storage[`p1-mgr-by-email::${emailKey(EMAIL_1)}/${EMP_A}`]);
  assert.equal(idxEntry.active, false, 'email index must reflect active:false after removal');
});

await test('T29 remove: manager not on roster returns 404', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'remove', email: EMAIL_2 }));
  assert.equal(res.statusCode, 404);
});

await test('T30 remove: missing email returns 400', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'remove' }));
  assert.equal(res.statusCode, 400);
});

await test('T31 remove: email index write failure does not prevent roster deactivation', async () => {
  const storage = {};
  seedStorage(storage, {
    employers: [[EMP_A, makeAgreement(EMP_A)]],
    rosters: [[`${EMP_A}/${emailKey(EMAIL_1)}`, makeRosterRecord(EMAIL_1, EMP_A, { active: true })]]
  });
  const handler = loadHandler(storage, { failEmailIdx: true });
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'remove', email: EMAIL_1 }));
  assert.equal(res.statusCode, 200, 'removal should succeed despite index failure');
  const record = JSON.parse(storage[`p1-manager-roster::${EMP_A}/${emailKey(EMAIL_1)}`]);
  assert.equal(record.active, false, 'roster must be active:false even when index write fails');
});

// ── Unknown action ────────────────────────────────────────────────────────────

await test('T32 unknown action returns 400', async () => {
  const storage = {};
  seedStorage(storage, { employers: [[EMP_A, makeAgreement(EMP_A)]] });
  const handler = loadHandler(storage);
  const res = await handler(post({ token: makeEmployerToken(EMP_A), action: 'destroy' }));
  assert.equal(res.statusCode, 400);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\ntest-draft-p1-manager-roster results:');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n        ${r.message}`}`);
}
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
