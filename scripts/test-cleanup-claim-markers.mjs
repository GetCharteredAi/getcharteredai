/**
 * Focused mocked-storage tests for scripts/cleanup-claim-markers-v2-clean.mjs
 * No real Blobs, no network calls.
 */

import assert from 'assert';
import { cleanupClaimMarkers } from './cleanup-claim-markers-v2-clean.mjs';

// ── Environment fixtures ───────────────────────────────────────────────────────

const LOCAL_ENV = {
  NETLIFY_BLOBS_CONTEXT: Buffer.from(JSON.stringify({
    edgeURL:         'http://localhost:8888/.netlify/blobs',
    uncachedEdgeURL: 'http://localhost:8888/.netlify/blobs',
    siteID:          'test-site-id',
    token:           'test-token'
  })).toString('base64')
};

const PROD_ENV = {
  NETLIFY_BLOBS_CONTEXT: Buffer.from(JSON.stringify({
    edgeURL: 'https://api.netlify.com',
    siteID:  'live-site-id',
    token:   'live-token'
  })).toString('base64')
};

// ── Mock store factory ─────────────────────────────────────────────────────────

function makeClaimStore(entries = {}, { pageSize = 100, throwOnDelete = false } = {}) {
  const storage = { ...entries };
  return {
    list: async ({ cursor } = {}) => {
      const keys     = Object.keys(storage);
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      const endIdx   = Math.min(startIdx + pageSize, keys.length);
      const blobs    = keys.slice(startIdx, endIdx).map(key => ({ key }));
      const next     = endIdx < keys.length ? String(endIdx) : undefined;
      return { blobs, cursor: next };
    },
    get: async (key) => {
      return key in storage ? JSON.parse(JSON.stringify(storage[key])) : null;
    },
    delete: async (key) => {
      if (throwOnDelete) throw new Error('simulated delete failure');
      delete storage[key];
    },
    _storage: storage
  };
}

function pastMarker() {
  return {
    claimedAt:         new Date().toISOString(),
    safeToDeleteAfter: new Date(Date.now() - 1000).toISOString()
  };
}

function futureMarker() {
  return {
    claimedAt:         new Date().toISOString(),
    safeToDeleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
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

// ── Environment rejection ──────────────────────────────────────────────────────

console.log('\nEnvironment rejection');

await test('CU01 rejects production env — throws before any storage access', async () => {
  const store = makeClaimStore({ 'some-uuid': pastMarker() });
  await assert.rejects(
    () => cleanupClaimMarkers(store, { env: PROD_ENV }),
    /Environment safety check failed/
  );
});

await test('CU02 rejects empty env', async () => {
  const store = makeClaimStore();
  await assert.rejects(
    () => cleanupClaimMarkers(store, { env: {} }),
    /Environment safety check failed/
  );
});

// ── Dry-run default ────────────────────────────────────────────────────────────

console.log('\nDry-run default');

await test('CU03 dry-run is default: eligible marker counted but NOT deleted', async () => {
  const key    = 'aaaaaaaa-1001-1001-1001-100000000001';
  const store  = makeClaimStore({ [key]: pastMarker() });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV });
  assert.strictEqual(result.dryRun,   true,  'dryRun flag must be true');
  assert.strictEqual(result.eligible, 1,     'eligible count must be 1');
  assert.strictEqual(result.deleted,  0,     'deleted must be 0 in dry-run');
  assert.ok(key in store._storage,          'key must still exist — dry-run does not delete');
});

await test('CU04 dry-run reports eligible separately from deleted', async () => {
  const store  = makeClaimStore({
    'aaaaaaaa-1002-1002-1002-100000000002': pastMarker(),
    'aaaaaaaa-1003-1003-1003-100000000003': futureMarker()
  });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV });
  assert.strictEqual(result.eligible,     1, 'one eligible');
  assert.strictEqual(result.deleted,      0, 'none deleted (dry-run)');
  assert.strictEqual(result.skippedNotYet, 1, 'one future-expiry skipped');
});

// ── Skip rules ─────────────────────────────────────────────────────────────────

console.log('\nSkip rules');

await test('CU05 empty store → 0 checked, 0 eligible, 0 deleted', async () => {
  const store  = makeClaimStore();
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV });
  assert.strictEqual(result.checked,        0);
  assert.strictEqual(result.eligible,       0);
  assert.strictEqual(result.deleted,        0);
  assert.strictEqual(result.skippedNoExpiry, 0);
  assert.strictEqual(result.skippedNotYet,   0);
});

await test('CU06 marker without safeToDeleteAfter → skippedNoExpiry, never deleted', async () => {
  const key   = 'aaaaaaaa-1004-1004-1004-100000000004';
  const store = makeClaimStore({ [key]: { claimedAt: new Date().toISOString() } });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false });
  assert.strictEqual(result.skippedNoExpiry, 1);
  assert.strictEqual(result.eligible,        0);
  assert.strictEqual(result.deleted,         0);
  assert.ok(key in store._storage, 'must not be deleted');
});

await test('CU07 marker with future safeToDeleteAfter → skippedNotYet, never deleted', async () => {
  const key   = 'aaaaaaaa-1005-1005-1005-100000000005';
  const store = makeClaimStore({ [key]: futureMarker() });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false });
  assert.strictEqual(result.skippedNotYet, 1);
  assert.strictEqual(result.eligible,      0);
  assert.strictEqual(result.deleted,       0);
  assert.ok(key in store._storage, 'must not be deleted');
});

await test('CU08 marker with invalid safeToDeleteAfter string → skippedNotYet, never deleted', async () => {
  const key   = 'aaaaaaaa-1006-1006-1006-100000000006';
  const store = makeClaimStore({
    [key]: { claimedAt: new Date().toISOString(), safeToDeleteAfter: 'not-a-date' }
  });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false });
  assert.strictEqual(result.skippedNotYet, 1);
  assert.strictEqual(result.eligible,      0);
  assert.strictEqual(result.deleted,       0);
  assert.ok(key in store._storage, 'must not be deleted');
});

// ── Deletion (apply mode) ─────────────────────────────────────────────────────

console.log('\nDeletion (apply mode)');

await test('CU09 past safeToDeleteAfter with dryRun:false → eligible:1 deleted:1, removed', async () => {
  const key    = 'aaaaaaaa-1007-1007-1007-100000000007';
  const store  = makeClaimStore({ [key]: pastMarker() });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false });
  assert.strictEqual(result.eligible, 1);
  assert.strictEqual(result.deleted,  1);
  assert.ok(!(key in store._storage), 'key must be removed');
});

await test('CU10 mixed markers — only eligible deleted, others preserved', async () => {
  const eligible = 'aaaaaaaa-1008-1008-1008-100000000008';
  const noExpiry = 'aaaaaaaa-1009-1009-1009-100000000009';
  const notYet   = 'aaaaaaaa-1010-1010-1010-100000000010';
  const store    = makeClaimStore({
    [eligible]: pastMarker(),
    [noExpiry]: { claimedAt: new Date().toISOString() },
    [notYet]:   futureMarker()
  });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false });
  assert.strictEqual(result.checked,        3);
  assert.strictEqual(result.eligible,       1);
  assert.strictEqual(result.deleted,        1);
  assert.strictEqual(result.skippedNoExpiry, 1);
  assert.strictEqual(result.skippedNotYet,   1);
  assert.ok(!(eligible in store._storage), 'eligible must be removed');
  assert.ok(noExpiry   in store._storage,  'noExpiry must remain');
  assert.ok(notYet     in store._storage,  'notYet must remain');
});

// ── Pagination ─────────────────────────────────────────────────────────────────

console.log('\nPagination');

await test('CU11 markers across two pages — all checked and deleted', async () => {
  const entries = {};
  for (let i = 0; i < 6; i++) {
    entries[`aaaaaaaa-200${i}-200${i}-200${i}-2000000000${String(i).padStart(2,'0')}`] = pastMarker();
  }
  const store  = makeClaimStore(entries, { pageSize: 4 });
  const result = await cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false });
  assert.strictEqual(result.checked,  6);
  assert.strictEqual(result.eligible, 6);
  assert.strictEqual(result.deleted,  6);
  assert.strictEqual(Object.keys(store._storage).length, 0, 'all markers removed');
});

// ── Scan limit ─────────────────────────────────────────────────────────────────

console.log('\nScan limit');

await test('CU12 scan limit enforced during pagination — throws before reading any markers', async () => {
  const entries = {};
  for (let i = 0; i < 6; i++) {
    entries[`aaaaaaaa-300${i}-300${i}-300${i}-3000000000${String(i).padStart(2,'0')}`] = pastMarker();
  }
  let getCallCount = 0;
  const base = makeClaimStore(entries, { pageSize: 100 });
  const countingStore = {
    list:     base.list.bind(base),
    get:      async (key) => { getCallCount++; return base.get(key); },
    delete:   base.delete.bind(base),
    _storage: base._storage
  };
  await assert.rejects(
    () => cleanupClaimMarkers(countingStore, { env: LOCAL_ENV, maxMarkers: 3 }),
    /exceeds the scan limit of 3/
  );
  assert.strictEqual(getCallCount, 0, 'get must not be called before the scan limit throws');
});

// ── Delete failure ─────────────────────────────────────────────────────────────

console.log('\nDelete failure');

await test('CU13 delete failure propagates — not silently swallowed', async () => {
  const store = makeClaimStore({
    'aaaaaaaa-4001-4001-4001-400000000001': pastMarker()
  }, { throwOnDelete: true });
  await assert.rejects(
    () => cleanupClaimMarkers(store, { env: LOCAL_ENV, dryRun: false }),
    /simulated delete failure/
  );
});

// ── maxMarkers validation ─────────────────────────────────────────────────────

console.log('\nmaxMarkers validation');

await test('CU14 fractional maxMarkers → throws before any storage access', async () => {
  const store = makeClaimStore({ 'some-uuid': pastMarker() });
  await assert.rejects(
    () => cleanupClaimMarkers(store, { env: LOCAL_ENV, maxMarkers: 3.5 }),
    /maxMarkers must be a positive integer/
  );
});

await test('CU15 zero maxMarkers → throws', async () => {
  await assert.rejects(
    () => cleanupClaimMarkers(makeClaimStore(), { env: LOCAL_ENV, maxMarkers: 0 }),
    /maxMarkers must be a positive integer/
  );
});

await test('CU16 negative maxMarkers → throws', async () => {
  await assert.rejects(
    () => cleanupClaimMarkers(makeClaimStore(), { env: LOCAL_ENV, maxMarkers: -1 }),
    /maxMarkers must be a positive integer/
  );
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
