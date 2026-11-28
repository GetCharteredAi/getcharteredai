/**
 * Unit tests for erase-manager-record.mjs
 *
 * Uses in-memory mock stores — no production connections required.
 *
 * Run: node scripts/test-erase-manager-record.mjs
 */

import assert        from 'assert/strict';
import { runErasure } from './erase-manager-record.mjs';

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

// ── Mock store helpers ────────────────────────────────────────────────────────

const EMPLOYER_KEY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const EMAIL        = 'mgr@testfirm.com';
const ROSTER_KEY   = `${EMPLOYER_KEY}/${Buffer.from(EMAIL).toString('base64url')}`;

function inactiveEntry() {
  return { email: EMAIL, employerKey: EMPLOYER_KEY, active: false, addedAt: '2026-01-01T00:00:00.000Z' };
}
function activeEntry() {
  return { ...inactiveEntry(), active: true };
}

function createRosterStore(entries = {}, overrides = {}) {
  const storage = {};
  for (const [k, v] of Object.entries(entries)) storage[k] = JSON.stringify(v);
  return {
    get:     async (key, opts) => {
      const raw = storage[key];
      return raw === undefined ? null : (opts?.type === 'json' ? JSON.parse(raw) : raw);
    },
    setJSON: async (key, val) => { storage[key] = JSON.stringify(val); return { modified: true }; },
    delete:  overrides.delete ?? (async (key) => { delete storage[key]; }),
    _storage: storage
  };
}

function createAuditStore(overrides = {}) {
  const storage = {};
  return {
    get:     async (key, opts) => {
      const raw = storage[key];
      return raw === undefined ? null : (opts?.type === 'json' ? JSON.parse(raw) : raw);
    },
    setJSON: overrides.setJSON ?? (async (key, val) => { storage[key] = JSON.stringify(val); return { modified: true }; }),
    delete:  async (key) => { delete storage[key]; },
    _storage: storage
  };
}

// ── T01: dry-run ──────────────────────────────────────────────────────────────

await test('T01 — dry-run: exit 0, no deletion, no audit entries', async () => {
  const rosterStore = createRosterStore({ [ROSTER_KEY]: inactiveEntry() });
  const auditStore  = createAuditStore();
  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: false },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.messages.some(m => m.includes('DRY RUN')));
  assert.ok(rosterStore._storage[ROSTER_KEY], 'Roster record must not be deleted in dry-run');
  assert.equal(Object.keys(auditStore._storage).length, 0, 'No audit entries in dry-run');
});

// ── T02: active manager refused ───────────────────────────────────────────────

await test('T02 — exit 1 and no changes when manager entry is active', async () => {
  const rosterStore = createRosterStore({ [ROSTER_KEY]: activeEntry() });
  const auditStore  = createAuditStore();
  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('Cannot erase an active manager')));
  const stored = JSON.parse(rosterStore._storage[ROSTER_KEY]);
  assert.equal(stored.active, true, 'Active record must remain untouched');
  assert.equal(Object.keys(auditStore._storage).length, 0, 'No audit entries when refusing active manager');
});

// ── T03: missing roster record ────────────────────────────────────────────────

await test('T03 — exit 1 when roster record does not exist', async () => {
  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore: createRosterStore(), auditStore: createAuditStore() }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('No roster record found')));
});

// ── T04: invalid employerKey — storage never touched ─────────────────────────

await test('T04 — exit 1 for invalid employerKey; storage never accessed', async () => {
  let storageTouched = false;
  const rosterStore  = createRosterStore();
  rosterStore.get    = async () => { storageTouched = true; return null; };
  const result = await runErasure(
    { employerKey: 'not-a-uuid', email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore: createAuditStore() }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('valid UUID')));
  assert.equal(storageTouched, false, 'Storage must not be accessed when employerKey is invalid');
});

// ── T05: invalid email — storage never touched ────────────────────────────────

await test('T05 — exit 1 for invalid email; storage never accessed', async () => {
  let storageTouched = false;
  const rosterStore  = createRosterStore();
  rosterStore.get    = async () => { storageTouched = true; return null; };
  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: 'not-an-email', reason: null, confirm: true },
    { rosterStore, auditStore: createAuditStore() }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('valid email')));
  assert.equal(storageTouched, false, 'Storage must not be accessed when email is invalid');
});

// ── T06: successful erasure ───────────────────────────────────────────────────

await test('T06 — successful erasure: exit 0, record deleted, 2 audit entries, email hashed not raw', async () => {
  const rosterStore = createRosterStore({ [ROSTER_KEY]: inactiveEntry() });
  const auditStore  = createAuditStore();
  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: 'Subject access request', confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.messages.some(m => m.includes('erased')));

  // Record must be gone
  assert.ok(!rosterStore._storage[ROSTER_KEY], 'Roster record must be deleted');

  // Exactly 2 audit entries: initiated + completed
  const auditKeys = Object.keys(auditStore._storage);
  assert.equal(auditKeys.length, 2, 'Two audit entries expected');
  const entries = auditKeys.map(k => JSON.parse(auditStore._storage[k]));
  assert.ok(entries.some(e => e.type === 'individual-erasure-initiated'), 'Missing initiated entry');
  assert.ok(entries.some(e => e.type === 'individual-erasure-completed'), 'Missing completed entry');

  // Raw email must not appear in audit storage
  const auditJson = JSON.stringify(Object.values(auditStore._storage));
  assert.ok(!auditJson.includes(EMAIL), 'Raw email must not appear in audit entries');
  for (const e of entries) {
    assert.ok(e.emailHash, 'emailHash must be present');
    assert.match(e.emailHash, /^[0-9a-f]{64}$/, 'emailHash must be a SHA-256 hex string');
  }
  const completed = entries.find(e => e.type === 'individual-erasure-completed');
  assert.equal(completed.erasureReason, 'Subject access request');
});

// ── T07: deletion throws ──────────────────────────────────────────────────────

await test('T07 — exit 1 when deletion throws; pre-audit written, failure audit written', async () => {
  const rosterStore = createRosterStore(
    { [ROSTER_KEY]: inactiveEntry() },
    { delete: async () => { throw new Error('Blobs delete timeout'); } }
  );
  const auditStore = createAuditStore();
  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('Failed to delete roster record')));

  const auditKeys = Object.keys(auditStore._storage);
  assert.equal(auditKeys.length, 2, 'Two audit entries expected');
  const entries = auditKeys.map(k => JSON.parse(auditStore._storage[k]));
  assert.ok(entries.some(e => e.type === 'individual-erasure-initiated'), 'Missing initiated entry');
  assert.ok(entries.some(e => e.type === 'individual-erasure-failed'), 'Missing failed entry');
  const failEntry = entries.find(e => e.type === 'individual-erasure-failed');
  assert.ok(failEntry.error, 'Failed entry must record the error message');
});

// ── T08: post-audit write fails after successful deletion ─────────────────────

await test('T08 — exit 1 and warning when post-audit write fails after successful deletion', async () => {
  const rosterStore  = createRosterStore({ [ROSTER_KEY]: inactiveEntry() });
  const auditStorage = {};
  let auditCallCount = 0;
  const auditStore   = createAuditStore({
    setJSON: async (key, val) => {
      auditCallCount++;
      if (auditCallCount === 2) throw new Error('Audit store full');
      auditStorage[key] = JSON.stringify(val);
      return { modified: true };
    }
  });
  auditStore._storage = auditStorage;

  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 1, 'Must exit non-zero');
  const fullOutput = result.messages.join(' ');
  assert.ok(fullOutput.includes('WARNING'), 'Must emit WARNING');
  assert.ok(
    fullOutput.includes('deleted') || fullOutput.includes('gone'),
    'Warning must state the record was deleted'
  );
  assert.ok(fullOutput.includes('audit'), 'Warning must mention the audit record');
  assert.ok(!rosterStore._storage[ROSTER_KEY], 'Record must be deleted even though audit failed');
});

// ── T09: pre-audit write fails — no deletion ─────────────────────────────────

await test('T09 — exit 1 and no deletion when pre-audit write fails', async () => {
  let deleteCallCount = 0;
  const rosterStore = createRosterStore(
    { [ROSTER_KEY]: inactiveEntry() },
    { delete: async () => { deleteCallCount++; } }
  );
  const auditStore = createAuditStore({
    setJSON: async () => { throw new Error('Audit unavailable'); }
  });

  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('pre-erasure audit entry')));
  assert.ok(result.messages.some(m => m.includes('No changes have been made')));
  assert.equal(deleteCallCount, 0, 'delete must not be called when pre-audit write fails');
});

// ── T10: only the specified record is deleted ─────────────────────────────────

await test('T10 — only the specified roster record is deleted; other records untouched', async () => {
  const otherKey    = `${EMPLOYER_KEY}/${Buffer.from('other@testfirm.com').toString('base64url')}`;
  const rosterStore = createRosterStore({
    [ROSTER_KEY]: inactiveEntry(),
    [otherKey]:   { email: 'other@testfirm.com', active: false }
  });
  await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore: createAuditStore() }
  );

  assert.ok(!rosterStore._storage[ROSTER_KEY], 'Target record must be deleted');
  assert.ok(rosterStore._storage[otherKey], 'Other roster record must be untouched');
});

// ── T11: concurrent reactivation detected on re-read ─────────────────────────

await test('T11 — concurrent reactivation on re-read: exit 1, no deletion, abort audit written', async () => {
  let getCallCount = 0;
  let deleteCallCount = 0;
  const rosterStore = {
    // First read (initial check): inactive. Second read (double-check): re-activated.
    get:     async () => { getCallCount++; return getCallCount === 1 ? inactiveEntry() : activeEntry(); },
    setJSON: async () => ({ modified: true }),
    delete:  async () => { deleteCallCount++; },
    _storage: {}
  };
  const auditStore = createAuditStore();

  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('re-activated') || m.includes('aborted')));
  assert.equal(deleteCallCount, 0, 'delete must not be called when re-read shows active record');

  // Both intent and abort audit entries must be present
  const auditKeys = Object.keys(auditStore._storage);
  assert.ok(auditKeys.length >= 2, 'Intent and abort audit entries expected');
  const entries = auditKeys.map(k => JSON.parse(auditStore._storage[k]));
  assert.ok(entries.some(e => e.type === 'individual-erasure-initiated'), 'Intent audit must be present');
  assert.ok(entries.some(e => e.type === 'individual-erasure-aborted'), 'Abort audit must be present');
  const abortEntry = entries.find(e => e.type === 'individual-erasure-aborted');
  assert.ok(abortEntry.abortReason, 'Abort entry must include a reason');
  assert.ok(abortEntry.intentAuditKey, 'Abort entry must reference the intent audit key');
});

// ── T12: record disappears on re-read ────────────────────────────────────────

await test('T12 — record disappears on re-read: exit 1, no deletion, abort audit written', async () => {
  let getCallCount  = 0;
  let deleteCallCount = 0;
  const rosterStore = {
    // First read: inactive. Second read: gone (deleted concurrently by another process).
    get:     async () => { getCallCount++; return getCallCount === 1 ? inactiveEntry() : null; },
    setJSON: async () => ({ modified: true }),
    delete:  async () => { deleteCallCount++; },
    _storage: {}
  };
  const auditStore = createAuditStore();

  const result = await runErasure(
    { employerKey: EMPLOYER_KEY, email: EMAIL, reason: null, confirm: true },
    { rosterStore, auditStore }
  );

  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some(m => m.includes('aborted') || m.includes('no longer exists')));
  assert.equal(deleteCallCount, 0, 'delete must not be called when re-read returns null');

  const entries = Object.keys(auditStore._storage).map(k => JSON.parse(auditStore._storage[k]));
  assert.ok(entries.some(e => e.type === 'individual-erasure-initiated'));
  assert.ok(entries.some(e => e.type === 'individual-erasure-aborted'));
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log('\n── erase-manager-record tests ────────────────────────────────────\n');
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
