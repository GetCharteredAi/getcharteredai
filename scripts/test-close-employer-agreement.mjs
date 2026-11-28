/**
 * Unit tests for close-employer-agreement.mjs
 *
 * Uses in-memory mock stores — no production connections required.
 *
 * Run: node scripts/test-close-employer-agreement.mjs
 */

import assert from 'assert/strict';
import { runClosure, listAllBlobs } from './close-employer-agreement.mjs';

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

// ── Mock store factory ────────────────────────────────────────────────────────

function createStore(storage = {}, overrides = {}) {
  return {
    get: async (key, opts) => {
      const raw = storage[key];
      if (raw === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(raw) : raw;
    },
    setJSON: overrides.setJSON ?? (async (key, value) => {
      storage[key] = JSON.stringify(value);
      return { modified: true };
    }),
    delete: async (key) => { delete storage[key]; },
    list: overrides.list ?? (async (opts = {}) => {
      const prefix = opts.prefix || '';
      // Simulate single-page response (no cursor)
      const blobs = Object.keys(storage)
        .filter(k => k.startsWith(prefix))
        .map(k => ({ key: k }));
      return { blobs, directories: [], nextCursor: null };
    })
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPLOYER_KEY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function activeAgreement() {
  return {
    employerKey:          EMPLOYER_KEY,
    firmName:             'Test Firm Ltd',
    employerContactEmail: 'admin@testfirm.com',
    serviceStartsAt:      '2026-01-01T00:00:00.000Z',
    serviceExpiresAt:     '2027-01-01T00:00:00.000Z',
    serviceActive:        true,
    createdAt:            '2026-01-01T00:00:00.000Z',
    updatedAt:            '2026-01-01T00:00:00.000Z',
    notes:                null
  };
}

function makeStores({ agreementData, rosterKeys = [], auditOverride, agreementWriteOverride } = {}) {
  const agreementStorage = {};
  if (agreementData !== undefined) {
    agreementStorage[EMPLOYER_KEY] = JSON.stringify(agreementData);
  }

  const rosterStorage = {};
  for (const k of rosterKeys) {
    rosterStorage[k] = JSON.stringify({ email: 'mgr@test.com', active: true });
  }

  const auditStorage = {};

  return {
    agreementStore: createStore(agreementStorage, {
      setJSON: agreementWriteOverride ?? (async (key, value) => {
        agreementStorage[key] = JSON.stringify(value);
        return { modified: true };
      })
    }),
    rosterStore: createStore(rosterStorage),
    auditStore:  createStore(auditStorage, {
      setJSON: auditOverride ?? (async (key, value) => {
        auditStorage[key] = JSON.stringify(value);
        return { modified: true };
      })
    }),
    // Expose storage for assertions
    _agreementStorage: agreementStorage,
    _auditStorage:     auditStorage,
    _rosterStorage:    rosterStorage
  };
}

// ── T01: dry-run — no changes, no audit writes ────────────────────────────────

await test('T01 — dry-run: returns exit 0, makes no changes, writes no audit entries', async () => {
  const stores = makeStores({ agreementData: activeAgreement() });
  const result = await runClosure({ employerKey: EMPLOYER_KEY, reason: null, confirm: false }, stores);

  assert.equal(result.exitCode, 0);
  assert.ok(result.messages.some(m => m.includes('DRY RUN')), 'Should mention DRY RUN');

  // Agreement must be unchanged
  const stored = JSON.parse(stores._agreementStorage[EMPLOYER_KEY]);
  assert.equal(stored.serviceActive, true, 'serviceActive must remain true in dry-run');

  // No audit entries
  assert.equal(Object.keys(stores._auditStorage).length, 0, 'No audit entries should be written');
});

// ── T02: agreement not found ──────────────────────────────────────────────────

await test('T02 — exit 1 when agreement not found', async () => {
  const stores = makeStores(); // no agreementData
  const result = await runClosure({ employerKey: EMPLOYER_KEY, reason: null, confirm: true }, stores);
  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('No agreement found')));
});

// ── T03: already inactive ─────────────────────────────────────────────────────

await test('T03 — exit 0 and no changes when agreement is already inactive', async () => {
  const inactive = { ...activeAgreement(), serviceActive: false, closedAt: '2026-06-01T00:00:00.000Z' };
  const stores   = makeStores({ agreementData: inactive });
  const result   = await runClosure({ employerKey: EMPLOYER_KEY, reason: null, confirm: true }, stores);

  assert.equal(result.exitCode, 0);
  assert.ok(result.messages.some(m => m.includes('already inactive')));

  // Agreement untouched
  const stored = JSON.parse(stores._agreementStorage[EMPLOYER_KEY]);
  assert.equal(stored.serviceActive, false);
  assert.equal(stored.closedAt, '2026-06-01T00:00:00.000Z', 'closedAt must not change');

  // No audit entries
  assert.equal(Object.keys(stores._auditStorage).length, 0);
});

// ── T04: successful closure ───────────────────────────────────────────────────

await test('T04 — successful closure: serviceActive=false, reason stored, two audit entries', async () => {
  const rosterKeys = [`${EMPLOYER_KEY}/mgr1`, `${EMPLOYER_KEY}/mgr2`];
  const stores     = makeStores({ agreementData: activeAgreement(), rosterKeys });
  const result     = await runClosure(
    { employerKey: EMPLOYER_KEY, reason: 'Contract ended', confirm: true },
    stores
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.messages.some(m => m.includes('Agreement closed')));

  // Agreement updated correctly
  const stored = JSON.parse(stores._agreementStorage[EMPLOYER_KEY]);
  assert.equal(stored.serviceActive, false, 'serviceActive must be false');
  assert.ok(stored.closedAt, 'closedAt must be set');
  assert.equal(stored.closedReason, 'Contract ended');
  assert.ok(!isNaN(new Date(stored.closedAt).getTime()), 'closedAt must be a valid date');

  // Two audit entries: initiated + completed
  const auditKeys = Object.keys(stores._auditStorage);
  assert.equal(auditKeys.length, 2, 'Two audit entries expected');
  const auditEntries = auditKeys.map(k => JSON.parse(stores._auditStorage[k]));
  assert.ok(auditEntries.some(e => e.type === 'agreement-closure-initiated'), 'Missing initiated entry');
  assert.ok(auditEntries.some(e => e.type === 'agreement-closure-completed'), 'Missing completed entry');

  // Roster records must be untouched
  assert.equal(Object.keys(stores._rosterStorage).length, 2, 'Roster records must be preserved');
});

// ── T05: agreement setJSON fails ──────────────────────────────────────────────

await test('T05 — exit 1 when agreement update throws; pre-audit written, failure audit written', async () => {
  const agreementWriteOverride = async () => { throw new Error('Blobs write timeout'); };
  const stores = makeStores({ agreementData: activeAgreement(), agreementWriteOverride });
  const result = await runClosure({ employerKey: EMPLOYER_KEY, reason: null, confirm: true }, stores);

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('Failed to update agreement record')));

  // Two audit entries: initiated + failed
  const auditKeys    = Object.keys(stores._auditStorage);
  assert.equal(auditKeys.length, 2, 'Two audit entries expected');
  const auditEntries = auditKeys.map(k => JSON.parse(stores._auditStorage[k]));
  assert.ok(auditEntries.some(e => e.type === 'agreement-closure-initiated'), 'Missing initiated entry');
  assert.ok(auditEntries.some(e => e.type === 'agreement-closure-failed'), 'Missing failed entry');

  // Failure audit entry must record the error message
  const failEntry = auditEntries.find(e => e.type === 'agreement-closure-failed');
  assert.ok(failEntry.error, 'Failure audit entry must include error message');
});

// ── T06: post-audit write fails after successful closure ──────────────────────

await test('T06 — exit 1 and clear warning when post-audit write fails after closure', async () => {
  let auditCallCount = 0;
  const auditOverride = async (key, value) => {
    auditCallCount++;
    if (auditCallCount === 2) throw new Error('Audit store unavailable');
    stores._auditStorage[key] = JSON.stringify(value);
    return { modified: true };
  };

  const stores = makeStores({ agreementData: activeAgreement(), auditOverride });
  // Need to set the _auditStorage ref after creation since auditOverride closes over it
  const result = await runClosure({ employerKey: EMPLOYER_KEY, reason: null, confirm: true }, stores);

  assert.equal(result.exitCode, 1, 'Must exit non-zero when post-audit write fails');

  // Warning message must be specific about the deactivated state
  const warningMsg = result.messages.find(m => m.includes('WARNING'));
  assert.ok(warningMsg, 'Must emit a WARNING message');
  const allWarnings = result.messages.filter(m => m.includes('WARNING') || result.messages.indexOf(m) > result.messages.indexOf(warningMsg));
  const fullWarning = result.messages.slice(result.messages.findIndex(m => m.includes('WARNING'))).join(' ');
  assert.ok(fullWarning.includes('deactivated') || fullWarning.includes('inactive'), 'Warning must state the agreement was deactivated');
  assert.ok(fullWarning.includes('audit'), 'Warning must mention the audit record');

  // Agreement WAS deactivated despite the audit failure
  const stored = JSON.parse(stores._agreementStorage[EMPLOYER_KEY]);
  assert.equal(stored.serviceActive, false, 'Agreement should be deactivated even though audit failed');
});

// ── T07: pre-audit write fails — no agreement changes ────────────────────────

await test('T07 — exit 1 and no agreement changes when pre-audit write fails', async () => {
  let agreementWriteCalled = false;
  const agreementWriteOverride = async (key, value) => {
    agreementWriteCalled = true;
    stores._agreementStorage[key] = JSON.stringify(value);
    return { modified: true };
  };

  let auditCallCount = 0;
  const auditOverride = async () => {
    auditCallCount++;
    throw new Error('Audit store unavailable');
  };

  const stores = makeStores({ agreementData: activeAgreement(), agreementWriteOverride, auditOverride });
  const result = await runClosure({ employerKey: EMPLOYER_KEY, reason: null, confirm: true }, stores);

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('pre-change audit')));
  assert.ok(result.messages.some(m => m.includes('No changes have been made')));

  // Agreement store must NOT have been written
  assert.equal(agreementWriteCalled, false, 'Agreement must not be modified when pre-audit write fails');

  // agreement remains active
  const stored = JSON.parse(stores._agreementStorage[EMPLOYER_KEY]);
  assert.equal(stored.serviceActive, true);
});

// ── T08: pagination — listAllBlobs follows cursors ────────────────────────────

await test('T08 — listAllBlobs collects all blobs across multiple pages', async () => {
  const page1 = { blobs: [{ key: 'a/1' }, { key: 'a/2' }], nextCursor: 'cursor-1' };
  const page2 = { blobs: [{ key: 'a/3' }], nextCursor: null };
  let call = 0;

  const mockStore = {
    list: async (opts) => {
      call++;
      return call === 1 ? page1 : page2;
    }
  };

  const blobs = await listAllBlobs(mockStore, 'a/');
  assert.equal(blobs.length, 3, 'Should collect blobs from both pages');
  assert.deepEqual(blobs.map(b => b.key), ['a/1', 'a/2', 'a/3']);
  assert.equal(call, 2, 'Should make exactly two list calls');
});

// ── T09: script never calls rosterStore.delete ────────────────────────────────

await test('T09 — rosterStore.delete is never called, regardless of outcome', async () => {
  for (const scenario of ['success', 'agreementFail']) {
    let deleteCallCount = 0;

    const rosterWithSpy = {
      get: async () => null,
      setJSON: async () => ({ modified: true }),
      delete: async () => { deleteCallCount++; },
      list: async () => ({ blobs: [], nextCursor: null })
    };

    const agreementStorage = { [EMPLOYER_KEY]: JSON.stringify(activeAgreement()) };
    const auditStorage = {};
    const agreementStore = {
      get:     async (key, opts) => opts?.type === 'json' ? JSON.parse(agreementStorage[key] || 'null') : null,
      setJSON: scenario === 'agreementFail'
        ? async () => { throw new Error('simulated'); }
        : async (key, val) => { agreementStorage[key] = JSON.stringify(val); return { modified: true }; },
      delete:  async () => { deleteCallCount++; }
    };
    const auditStore = {
      get: async () => null,
      setJSON: async (key, val) => { auditStorage[key] = JSON.stringify(val); return { modified: true }; },
      delete: async () => {}
    };

    await runClosure(
      { employerKey: EMPLOYER_KEY, reason: null, confirm: true },
      { agreementStore, rosterStore: rosterWithSpy, auditStore }
    );

    assert.equal(deleteCallCount, 0, `rosterStore.delete must not be called in scenario: ${scenario}`);
  }
});

// ── T10: invalid employerKey format ───────────────────────────────────────────

await test('T10 — exit 1 for invalid UUID format', async () => {
  const stores = makeStores();
  const result = await runClosure({ employerKey: 'not-a-uuid', reason: null, confirm: true }, stores);
  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('valid UUID')));
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log('\n── close-employer-agreement tests ────────────────────────────────\n');
for (const r of results) {
  if (r.ok) {
    console.log(`  ✓  ${r.name}`);
  } else {
    console.error(`  ✗  ${r.name}`);
    console.error(`       ${r.message}`);
  }
}
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
