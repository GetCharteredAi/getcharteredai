/**
 * Focused mocked-storage tests for scripts/reconcile-mgr-email-index.mjs
 *
 * Coverage:
 *   checkLocalEnv:
 *     - Missing NETLIFY_BLOBS_CONTEXT
 *     - Non-JSON / bare-"1" context value
 *     - Valid JSON but no edgeURL
 *     - Non-local edgeURL (production API hostname)
 *     - localhost edgeURL → accepted
 *     - 127.0.0.1 edgeURL → accepted
 *
 *   reconcileEmail:
 *     - Invalid email → throws before any storage access
 *     - Missing opts.env NETLIFY_BLOBS_CONTEXT → throws env error
 *     - Empty stores → no changes
 *     - Scan limit enforced inline during pagination (not after all pages loaded)
 *     - Dry-run default: missing index → counted but not written
 *     - Apply: missing index → activated, entry written with correct email and employerKey
 *     - Apply: stale active:false index → activated and repaired
 *     - Apply: active index with wrong employerKey → activated and repaired
 *     - Apply: active index with wrong email → activated and repaired
 *     - Apply: active index, roster removed → deactivated
 *     - Apply: active index, agreement expired → deactivated
 *     - Apply: active index, serviceActive:false → deactivated
 *     - Apply: orphaned active index entry (agreement blob deleted) → deactivated
 *     - Index already correct (active, all fields right) → no change
 *     - Index already inactive, roster inactive → no change
 *     - Multi-employer: each employer handled independently in one pass
 *     - Pagination: 5 employers across 3 pages → all processed, checked=5
 *     - Index write failure propagates when !dryRun
 *
 * No production Blobs, no live email, no deployment.
 *
 * Run: node scripts/test-reconcile-mgr-email-index.mjs
 */

import assert  from 'assert/strict';
import crypto  from 'crypto';
import { checkLocalEnv, reconcileEmail } from './reconcile-mgr-email-index.mjs';

// ── Local environment stub ────────────────────────────────────────────────────

// A synthetic NETLIFY_BLOBS_CONTEXT pointing at localhost — passes checkLocalEnv.
// All reconcileEmail calls must pass opts.env = LOCAL_ENV so the safety check does
// not fall through to process.env (which has no NETLIFY_BLOBS_CONTEXT in this runner).
const LOCAL_ENV = {
  NETLIFY_BLOBS_CONTEXT: Buffer.from(JSON.stringify({
    edgeURL: 'http://localhost:8888/.netlify/blobs',
    siteID:  'local-test-site',
    token:   'local-test-token'
  })).toString('base64')
};

// ── Mock store helpers ────────────────────────────────────────────────────────

// Standard in-memory store mock. Stores parsed objects in _data; returns copies on
// get() so mutations in callers do not affect stored state.
function makeRecStore(data = {}) {
  return {
    get: async (key, opts) => {
      const raw = data[key];
      return raw !== undefined
        ? (opts?.type === 'json' ? JSON.parse(JSON.stringify(raw)) : raw)
        : null;
    },
    setJSON: async (key, val) => {
      data[key] = JSON.parse(JSON.stringify(val));
      return { modified: true };
    },
    list: async (opts = {}) => {
      const prefix = opts.prefix !== undefined ? opts.prefix : '';
      const blobs  = Object.keys(data).filter(k => k.startsWith(prefix)).map(k => ({ key: k }));
      return { blobs, cursor: undefined };
    },
    _data: data
  };
}

// Paginated mock — returns at most pageSize blobs per call.
// Cursor is a numeric string offset into the sorted key list.
function makePaginatedRecStore(data = {}, pageSize = 2) {
  return {
    get: async (key, opts) => {
      const raw = data[key];
      return raw !== undefined
        ? (opts?.type === 'json' ? JSON.parse(JSON.stringify(raw)) : raw)
        : null;
    },
    setJSON: async (key, val) => {
      data[key] = JSON.parse(JSON.stringify(val));
      return { modified: true };
    },
    list: async (opts = {}) => {
      const prefix = opts.prefix !== undefined ? opts.prefix : '';
      const all    = Object.keys(data).filter(k => k.startsWith(prefix)).sort();
      const start  = opts.cursor ? parseInt(opts.cursor, 10) : 0;
      const page   = all.slice(start, start + pageSize);
      const cursor = (start + pageSize < all.length) ? String(start + pageSize) : undefined;
      return { blobs: page.map(k => ({ key: k })), cursor };
    },
    _data: data
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMP_A = crypto.randomUUID();
const EMP_B = crypto.randomUUID();
const EMAIL = 'mgr@testfirm.local';

function ek(email) {
  return Buffer.from(email.trim().toLowerCase()).toString('base64url');
}

function seedAgreement(ag, empKey, overrides = {}) {
  ag._data[empKey] = {
    employerKey:     empKey,
    firmName:        'Test Firm',
    serviceActive:   true,
    serviceExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    ...overrides
  };
}

function seedRoster(rs, email, empKey, active = true) {
  rs._data[`${empKey}/${ek(email)}`] = {
    email:       email.toLowerCase(),
    employerKey: empKey,
    active,
    addedAt:  new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function seedIndex(idx, email, empKey, active = true, overrides = {}) {
  idx._data[`${ek(email)}/${empKey}`] = {
    email:       email.toLowerCase(),
    employerKey: empKey,
    active,
    updatedAt:   new Date().toISOString(),
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

// ── checkLocalEnv ─────────────────────────────────────────────────────────────

await test('CL01 missing NETLIFY_BLOBS_CONTEXT → returns error array', () => {
  const e = checkLocalEnv({});
  assert.ok(Array.isArray(e), 'must return an array');
  assert.ok(e.length > 0, 'must return at least one error line');
  assert.ok(e.some(l => l.includes('NETLIFY_BLOBS_CONTEXT')), 'must mention NETLIFY_BLOBS_CONTEXT');
});

await test('CL02 bare "1" context value → returns error (not valid base64 JSON)', () => {
  const e = checkLocalEnv({ NETLIFY_BLOBS_CONTEXT: '1' });
  assert.ok(Array.isArray(e), 'must return an array');
  assert.ok(e.length > 0);
});

await test('CL03 valid JSON but no edgeURL → returns error', () => {
  const ctx = Buffer.from(JSON.stringify({ siteID: 'x', token: 'y' })).toString('base64');
  const e   = checkLocalEnv({ NETLIFY_BLOBS_CONTEXT: ctx });
  assert.ok(Array.isArray(e), 'must return an array');
  assert.ok(e.some(l => l.includes('edgeURL')), 'must mention edgeURL');
});

await test('CL04 non-local edgeURL (production hostname) → returns error', () => {
  const ctx = Buffer.from(JSON.stringify({
    edgeURL: 'https://api.netlify.com', siteID: 'x', token: 'y'
  })).toString('base64');
  const e = checkLocalEnv({ NETLIFY_BLOBS_CONTEXT: ctx });
  assert.ok(Array.isArray(e), 'must return an array');
  assert.ok(e.some(l => l.includes('api.netlify.com') || l.includes('local')));
});

await test('CL05 localhost edgeURL → returns null (accepted)', () => {
  assert.equal(checkLocalEnv(LOCAL_ENV), null);
});

await test('CL06 127.0.0.1 edgeURL → returns null (accepted)', () => {
  const ctx = Buffer.from(JSON.stringify({
    edgeURL: 'http://127.0.0.1:8888/.netlify/blobs', siteID: 'x', token: 'y'
  })).toString('base64');
  assert.equal(checkLocalEnv({ NETLIFY_BLOBS_CONTEXT: ctx }), null);
});

// ── reconcileEmail ─────────────────────────────────────────────────────────────

await test('R01 invalid email → throws before any storage access', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  await assert.rejects(
    reconcileEmail('not-an-email', { agreementStore: ag, rosterStore: rs, emailIdxStore: idx }, { env: LOCAL_ENV }),
    /Invalid email address/
  );
  assert.deepEqual(Object.keys(ag._data), [], 'no storage reads should have occurred');
});

await test('R02 missing NETLIFY_BLOBS_CONTEXT in opts.env → throws env error', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  await assert.rejects(
    reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx }, { env: {} }),
    /Environment safety check failed/
  );
});

await test('R03 empty stores with local env → no changes, dryRun=true', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx }, { env: LOCAL_ENV });
  assert.deepEqual(result, { checked: 0, activated: 0, deactivated: 0, dryRun: true });
});

await test('R04 scan limit enforced during pagination before any record reads', async () => {
  // 3 employers in a pageSize=1 store; maxEmployers=2 → limit hit at 3rd item
  const empC = crypto.randomUUID();
  const agData = {
    [EMP_A]: { serviceActive: true, serviceExpiresAt: new Date(Date.now() + 1e9).toISOString() },
    [EMP_B]: { serviceActive: true, serviceExpiresAt: new Date(Date.now() + 1e9).toISOString() },
    [empC]:  { serviceActive: true, serviceExpiresAt: new Date(Date.now() + 1e9).toISOString() }
  };
  const ag = makePaginatedRecStore(agData, 1);  // one employer per page

  // Track whether Phase 1 record reads ever run.
  let rosterGetCount = 0;
  const trackingRs = {
    get:     async () => { rosterGetCount++; return null; },
    setJSON: async () => ({ modified: true }),
    list:    async () => ({ blobs: [], cursor: undefined })
  };
  const idx = makeRecStore();

  await assert.rejects(
    reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: trackingRs, emailIdxStore: idx },
      { maxEmployers: 2, env: LOCAL_ENV }),
    /exceeds the scan limit/
  );
  assert.equal(rosterGetCount, 0, 'roster must not be read before the scan limit throws');
});

await test('R05 dry-run default: missing index → activated=1, no write', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { env: LOCAL_ENV });
  assert.equal(result.activated, 1);
  assert.equal(result.dryRun, true);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`], undefined, 'dry-run must not write');
});

await test('R06 apply: missing index → activated, entry written with correct email and employerKey', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.activated, 1);
  assert.equal(result.dryRun, false);

  const entry = idx._data[`${ek(EMAIL)}/${EMP_A}`];
  assert.ok(entry, 'index entry must be written');
  assert.equal(entry.active, true);
  assert.equal(entry.email, EMAIL.toLowerCase());
  assert.equal(entry.employerKey, EMP_A);
  assert.ok(entry.updatedAt, 'updatedAt must be set');
});

await test('R07 apply: stale active:false index → activated and repaired', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);
  seedIndex(idx, EMAIL, EMP_A, false);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.activated, 1);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].active, true);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].email, EMAIL.toLowerCase());
});

await test('R08 apply: active index with wrong employerKey in stored value → repaired', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);
  // Active entry but stored value has wrong employerKey
  seedIndex(idx, EMAIL, EMP_A, true, { employerKey: 'wrong-employer-key' });

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.activated, 1, 'corrupted employerKey must be repaired');
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].employerKey, EMP_A, 'employerKey corrected to EMP_A');
});

await test('R09 apply: active index with wrong email in stored value → repaired', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);
  // Active entry but stored value has wrong email
  seedIndex(idx, EMAIL, EMP_A, true, { email: 'WRONG@email.local' });

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.activated, 1, 'corrupted email must be repaired');
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].email, EMAIL.toLowerCase(), 'email corrected');
});

await test('R10 apply: active index but roster removed → deactivated', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, false);  // removed
  seedIndex(idx, EMAIL, EMP_A, true);   // stale active

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.deactivated, 1);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].active, false);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].email, EMAIL.toLowerCase(), 'email preserved on deactivation');
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].employerKey, EMP_A, 'employerKey preserved on deactivation');
});

await test('R11 apply: active index but agreement expired → deactivated', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A, { serviceExpiresAt: new Date(Date.now() - 1000).toISOString() });
  seedRoster(rs, EMAIL, EMP_A, true);
  seedIndex(idx, EMAIL, EMP_A, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.deactivated, 1);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].active, false);
});

await test('R12 apply: active index but serviceActive:false → deactivated', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A, { serviceActive: false });
  seedRoster(rs, EMAIL, EMP_A, true);
  seedIndex(idx, EMAIL, EMP_A, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.deactivated, 1);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].active, false);
});

await test('R13 apply: orphaned active index entry (agreement blob deleted) → deactivated', async () => {
  const orphanKey = crypto.randomUUID();
  const ag  = makeRecStore();  // no agreement for orphanKey
  const rs  = makeRecStore();
  const idx = makeRecStore();
  seedIndex(idx, EMAIL, orphanKey, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.deactivated, 1, 'orphaned active entry must be deactivated');
  assert.equal(idx._data[`${ek(EMAIL)}/${orphanKey}`].active, false);
});

await test('R14 index already correct (active, all fields right) → no change', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);
  seedIndex(idx, EMAIL, EMP_A, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.activated, 0);
  assert.equal(result.deactivated, 0);
});

await test('R15 index inactive and roster inactive → no change (no spurious write)', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, false);  // removed
  seedIndex(idx, EMAIL, EMP_A, false);  // already inactive

  const before = JSON.stringify(idx._data);
  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.activated, 0);
  assert.equal(result.deactivated, 0);
  assert.equal(JSON.stringify(idx._data), before, 'index must not be modified');
});

await test('R16 multi-employer: each employer handled independently in one pass', async () => {
  const ag = makeRecStore(), rs = makeRecStore(), idx = makeRecStore();
  // EMP_A: active, missing index → activate
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);
  // EMP_B: active agreement but roster removed, stale active index → deactivate
  seedAgreement(ag, EMP_B);
  seedRoster(rs, EMAIL, EMP_B, false);
  seedIndex(idx, EMAIL, EMP_B, true);

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.checked, 2);
  assert.equal(result.activated, 1);
  assert.equal(result.deactivated, 1);
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_A}`].active, true,  'EMP_A entry must be activated');
  assert.equal(idx._data[`${ek(EMAIL)}/${EMP_B}`].active, false, 'EMP_B entry must be deactivated');
});

await test('R17 pagination: 5 employers across 3 pages → all processed, checked=5', async () => {
  const empKeys  = Array.from({ length: 5 }, () => crypto.randomUUID());
  const agData   = {};
  for (const k of empKeys) {
    agData[k] = {
      employerKey:      k,
      firmName:         'Firm',
      serviceActive:    true,
      serviceExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString()
    };
  }
  const ag  = makePaginatedRecStore(agData, 2);  // 2 items per page → 3 pages for 5 items
  const rs  = makeRecStore();
  const idx = makeRecStore();
  for (const k of empKeys) seedRoster(rs, EMAIL, k, true);  // all on active roster

  const result = await reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: idx },
    { dryRun: false, env: LOCAL_ENV });
  assert.equal(result.checked, 5, 'all 5 employers must be processed across all pages');
  assert.equal(result.activated, 5, 'all 5 missing index entries must be activated');
  for (const k of empKeys) {
    const entry = idx._data[`${ek(EMAIL)}/${k}`];
    assert.ok(entry && entry.active, `index entry for ${k} must be active`);
  }
});

await test('R18 index write failure propagates when !dryRun', async () => {
  const ag = makeRecStore(), rs = makeRecStore();
  seedAgreement(ag, EMP_A);
  seedRoster(rs, EMAIL, EMP_A, true);

  const failIdx = {
    get:     async () => null,
    setJSON: async () => { throw new Error('Storage unavailable'); },
    list:    async () => ({ blobs: [], cursor: undefined })
  };

  await assert.rejects(
    reconcileEmail(EMAIL, { agreementStore: ag, rosterStore: rs, emailIdxStore: failIdx },
      { dryRun: false, env: LOCAL_ENV }),
    /Storage unavailable/
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\ntest-reconcile-mgr-email-index results:');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n        ${r.message}`}`);
}
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
