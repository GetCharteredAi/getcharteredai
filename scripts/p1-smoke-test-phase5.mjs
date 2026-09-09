#!/usr/bin/env node
// scripts/p1-smoke-test-phase5.mjs
// Phase 5 smoke test — cohort analytics + employer dashboard
//
// Runs against a deploy-preview with an isolated P1_STORE_PREFIX.
// Refuses to run without all required credentials or against production.
//
// Required env vars:
//   P1_SITE_URL         — deploy-preview URL (must NOT contain getcharteredai.com)
//   P1_STORE_PREFIX     — isolated blob prefix, must start with "smoke-"
//   P1_INTERNAL_SECRET  — internal gate secret (from deploy-preview Netlify env)
//   JWT_SECRET          — JWT signing secret  (from deploy-preview Netlify env)
//   NETLIFY_AUTH_TOKEN  — personal access token for Netlify Blobs REST API reads
//   NETLIFY_SITE_ID     — site UUID (deploy-preview shares site with main deploy)
//
// Suggested prefix: smoke-$(date +%s)

import crypto from 'crypto';

// ── Guard ─────────────────────────────────────────────────────────────────────

const SITE_URL     = process.env.P1_SITE_URL;
const STORE_PREFIX = process.env.P1_STORE_PREFIX;

if (!SITE_URL) {
  console.error('Refusing to run: P1_SITE_URL is required. Set it to a deploy-preview URL.');
  process.exit(1);
}
if (SITE_URL.includes('getcharteredai.com')) {
  console.error(`Refusing to run: P1_SITE_URL points to production (${SITE_URL}). Use a deploy-preview URL.`);
  process.exit(1);
}
if (!STORE_PREFIX) {
  console.error('Refusing to run: P1_STORE_PREFIX is required (e.g. smoke-$(date +%s)).');
  process.exit(1);
}
if (!STORE_PREFIX.startsWith('smoke-')) {
  console.error(`Refusing to run: P1_STORE_PREFIX must start with "smoke-". Got: ${STORE_PREFIX}`);
  process.exit(1);
}

const MISSING = [
  !process.env.P1_INTERNAL_SECRET && 'P1_INTERNAL_SECRET',
  !process.env.JWT_SECRET          && 'JWT_SECRET',
  !process.env.NETLIFY_AUTH_TOKEN  && 'NETLIFY_AUTH_TOKEN',
  !process.env.NETLIFY_SITE_ID     && 'NETLIFY_SITE_ID',
].filter(Boolean);
if (MISSING.length) {
  console.error(`Refusing to run: missing required variables: ${MISSING.join(', ')}`);
  process.exit(1);
}

const INTERNAL_SECRET = process.env.P1_INTERNAL_SECRET;
const JWT_SECRET      = process.env.JWT_SECRET;
const NETLIFY_TOKEN   = process.env.NETLIFY_AUTH_TOKEN;
const NETLIFY_SITE    = process.env.NETLIFY_SITE_ID;

// ── Constants ─────────────────────────────────────────────────────────────────

const PREFIX         = `${STORE_PREFIX}-`;
const COHORT_STORE   = `${PREFIX}p1-cohorts`; // snapshot polls only; writes go via p1-smoke-seed
const EMPLOYER_EMAIL = 'smoke-employer@example.com';
const STALE_MS       = 60 * 60 * 1000;

const FIVE_AREAS = [
  'Professional Behaviour & Responsibility',
  'Communication & Working With Others',
  'Learning & Applying Knowledge',
  'Judgement, Help & Escalation',
  'Feedback, Reflection & Development'
];

// ── Blob helpers ──────────────────────────────────────────────────────────────
// Key slashes are literal path separators in the REST URL — NOT encoded as %2F.
// This matches the @netlify/blobs SDK's URL construction (urlPath += '/' + key).

function blobUrl(storeName, key) {
  return `https://api.netlify.com/api/v1/blobs/${NETLIFY_SITE}/${storeName}/${key}`;
}

async function blobGetJSON(storeName, key) {
  const res = await fetch(blobUrl(storeName, key), {
    headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`blobGetJSON ${storeName}/${key}: ${res.status}`);
  return res.json();
}

// ── HTTP + JWT helpers ────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${SITE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

function signJwt(payload) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

// ── Fixture data ──────────────────────────────────────────────────────────────
//
// Group A — 5 sessions, all Phase 4 complete, discipline = 'Commercial Real Estate'
//   status = 'progress-ready' → ANALYTICS_ELIGIBLE + PHASE4_COMPLETE
//   byDiscipline CRE count = 5 → visible (≥ MIN_GROUP)
//
// Group B — 1 session, Phase 1 only, discipline = 'Valuation'
//   status = 'summary-ready' → ANALYTICS_ELIGIBLE only, NOT PHASE4_COMPLETE
//   byDiscipline Valuation count = 1 → suppressed (< MIN_GROUP)
//
// Result: analyticsEligible = 6, phase4Complete = 5
//   stateA.available = true (6 ≥ 5), stateB.available = true (5 ≥ 5)

function makeGroupACohortSafe(i) {
  const OUTCOMES  = ['ON TRACK', 'DEVELOPING', 'SUPPORT WOULD HELP', 'ON TRACK', 'DEVELOPING'];
  const EXPOSURES = ['relevant-exposure-identified', 'relevant-exposure-identified',
                     'confirmed-lack-of-exposure', 'not-assessed', 'relevant-exposure-identified'];
  const GAP_TYPES = ['knowledge', 'practice', 'experience', 'knowledge', 'practice'];
  return {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: Date.now(),
    benchmark: {
      areas: FIVE_AREAS.map((name, idx) => ({
        id: idx + 1, name,
        outcome: OUTCOMES[(i + idx) % OUTCOMES.length],
        exposureConfirmation: EXPOSURES[(i + idx) % EXPOSURES.length]
      })),
      candidateSelectedPriority: FIVE_AREAS[i % 5],
      developmentPriorities: [
        { area: FIVE_AREAS[i % 5], gapType: GAP_TYPES[i % GAP_TYPES.length] }
      ]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: [FIVE_AREAS[(i + 1) % 5]],
      areaRelationships: FIVE_AREAS.map(area => ({ area, relationshipType: 'aligned' })),
      michaelSynthesisPriorities: [{ area: FIVE_AREAS[(i + 2) % 5], gapType: 'practice' }]
    },
    phase4: {
      progressManagerParticipated: true,
      progressJudgements: [
        { rank: 1, progressJudgement: 'Some progress', graduated: false, area: FIVE_AREAS[i % 5] }
      ],
      proposedPriorityAreas: [FIVE_AREAS[(i + 1) % 5]]
    }
  };
}

function makeGroupAMetadata(sessionId, cohortId, i) {
  return {
    schemaVersion: 'benchmark-v1', sessionId, cohortId,
    firmName: 'Smoke Test Firm',
    candidateEmail: `smoke-a${i}@example.com`,
    managerEmail: `smoke-manager-a${i}@example.com`,
    employerEmail: EMPLOYER_EMAIL,
    discipline: 'Commercial Real Estate',
    team: 'London', office: 'HQ',
    employmentType: 'graduate', monthsInRole: 14 + i,
    status: 'progress-ready',
    candidateCompletedAt: Date.now() - (i * 86400000),
    candidateSelectedPriority: FIVE_AREAS[i % 5]
  };
}

function makeGroupBCohortSafe() {
  return {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: Date.now(),
    benchmark: {
      areas: FIVE_AREAS.map((name, idx) => ({
        id: idx + 1, name,
        outcome: 'DEVELOPING',
        exposureConfirmation: 'relevant-exposure-identified'
      })),
      candidateSelectedPriority: FIVE_AREAS[0],
      developmentPriorities: [{ area: FIVE_AREAS[0], gapType: 'practice' }]
    }
    // No phase3 or phase4 — awaiting manager
  };
}

function makeGroupBMetadata(sessionId, cohortId) {
  return {
    schemaVersion: 'benchmark-v1', sessionId, cohortId,
    firmName: 'Smoke Test Firm',
    candidateEmail: 'smoke-b0@example.com',
    managerEmail: 'smoke-manager-b@example.com',
    employerEmail: EMPLOYER_EMAIL,
    discipline: 'Valuation',
    team: 'Manchester', office: 'HQ',
    employmentType: 'graduate', monthsInRole: 8,
    status: 'summary-ready',
    candidateCompletedAt: Date.now() - 86400000,
    candidateSelectedPriority: FIVE_AREAS[0]
  };
}

// ── Test runner helpers ───────────────────────────────────────────────────────

let passed = 0, failed = 0;

function check(label, condition, detail = '') {
  const icon = condition ? '✓' : '✗';
  console.log(`  ${icon} ${label}${detail ? `  (${detail})` : ''}`);
  if (condition) passed++; else failed++;
}

async function poll(testFn, maxMs = 90000, intervalMs = 5000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const result = await testFn();
    if (result !== null) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

// ── Session IDs (declared before try so finally block can reference them) ─────

const cohortId       = `smoke-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const groupASessions = Array.from({ length: 5 }, (_, i) => `${cohortId}-a${i}`);
const groupBSession  = `${cohortId}-b0`;
const allSessions    = [...groupASessions, groupBSession];
const employerToken  = signJwt({
  cohortId, role: 'employer', email: EMPLOYER_EMAIL, expires: Date.now() + 3600000
});

// ── Banner ────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Phase 5 Smoke Test — Cohort Analytics + Dashboard');
console.log(`  Target:  ${SITE_URL}`);
console.log(`  Prefix:  ${STORE_PREFIX}`);
console.log(`  Cohort:  ${cohortId}`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Tests (try/finally guarantees cleanup even on throw) ──────────────────────

try {

  // ── 1. Auth boundaries ─────────────────────────────────────────────────────

  console.log('1. Auth boundaries\n');

  const r_missing = await post('/.netlify/functions/p1-cohort-snapshot-load', {});
  check('snapshot-load: missing token → 400', r_missing.status === 400, `got ${r_missing.status}`);

  const r_bad = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: 'bad.token.xyz' });
  check('snapshot-load: invalid token → 401', r_bad.status === 401, `got ${r_bad.status}`);

  const r_secret = await post('/.netlify/functions/p1-cohort-snapshot-trigger',
    { sessionId: 'test', internalSecret: 'wrongsecret' });
  check('snapshot-trigger: wrong internal secret → 403', r_secret.status === 403, `got ${r_secret.status}`);

  // ── 2. Routing + dashboard HTML ────────────────────────────────────────────

  console.log('\n2. Routing + dashboard HTML\n');

  const dashRes  = await fetch(`${SITE_URL}/cohort-dashboard`);
  check('/cohort-dashboard route → 200', dashRes.status === 200, `got ${dashRes.status}`);
  const dashHtml = dashRes.ok ? await dashRes.text() : '';

  check('dashboard: "Professional Readiness" present',  dashHtml.includes('Professional Readiness'));
  check('dashboard: calls p1-cohort-snapshot-load',     dashHtml.includes('p1-cohort-snapshot-load'));
  check('dashboard: subgroup suppression copy present',
    dashHtml.includes('Not enough data to show this subgroup safely'));
  check('dashboard: State B immature copy present',
    dashHtml.includes('Cohort progress insight will appear once at least 5 participants have completed their Progress Reflection'));

  // ── 3. Setup — seed synthetic sessions via p1-smoke-seed ──────────────────

  console.log('\n3. Setup: seeding 6 synthetic sessions\n');

  const seedResult = await post('/.netlify/functions/p1-smoke-seed', {
    action: 'seed',
    internalSecret: INTERNAL_SECRET,
    cohortId,
    firmName: 'Smoke Test Firm',
    employerEmail: EMPLOYER_EMAIL,
    sessions: [
      ...groupASessions.map((id, i) => ({
        sessionId: id,
        metadata: makeGroupAMetadata(id, cohortId, i),
        cohortSafe: makeGroupACohortSafe(i)
      })),
      {
        sessionId: groupBSession,
        metadata: makeGroupBMetadata(groupBSession, cohortId),
        cohortSafe: makeGroupBCohortSafe()
      }
    ]
  });
  if (seedResult.status !== 200) throw new Error(`Seed failed: ${seedResult.status} ${JSON.stringify(seedResult.json)}`);
  console.log('  ✓ 6 sessions seeded (5 Group A CRE + 1 Group B Valuation), cohort indexed');

  // ── 4. Analytics — first run via snapshot-load ─────────────────────────────

  console.log('\n4. Analytics — first run (snapshot absent → snapshot-load fires analytics)\n');

  const r_load1 = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
  check('snapshot-load: valid employer token → 200',      r_load1.status === 200,          `got ${r_load1.status}`);
  check('snapshot-load: no snapshot yet → computing:true', r_load1.json?.computing === true, `computing=${r_load1.json?.computing}`);
  check('snapshot-load: snapshot field is null initially', r_load1.json?.snapshot === null,  `snapshot=${r_load1.json?.snapshot}`);

  console.log('  Polling for snapshot (max 90s)...');
  const snapshot1 = await poll(async () => {
    const s = await blobGetJSON(COHORT_STORE, `${cohortId}/snapshot`);
    return s?.schemaVersion === 'cohort-snapshot-v1' ? s : null;
  });
  check('analytics: snapshot written within 90s', snapshot1 !== null);

  if (snapshot1) {

    // ── 5. Snapshot contract ───────────────────────────────────────────────

    console.log('\n5. Snapshot contract\n');

    check('schemaVersion: cohort-snapshot-v1',              snapshot1.schemaVersion === 'cohort-snapshot-v1');
    check('coverage.analyticsEligible: 6',                  snapshot1.coverage?.analyticsEligible === 6,  `got ${snapshot1.coverage?.analyticsEligible}`);
    check('coverage.phase4Complete: 5',                     snapshot1.coverage?.phase4Complete === 5,     `got ${snapshot1.coverage?.phase4Complete}`);
    check('stateA.available: true (6 eligible ≥ 5)',        snapshot1.stateA?.available === true);
    check('stateA.areaOutcomes present',                    typeof snapshot1.stateA?.areaOutcomes === 'object');
    check('stateA.exposureIntelligence present',            typeof snapshot1.stateA?.exposureIntelligence === 'object');
    check('stateA.interventionTypes present',               typeof snapshot1.stateA?.interventionTypes === 'object');
    check('stateA.perspectives.candidateSelectedPriority',  typeof snapshot1.stateA?.perspectives?.candidateSelectedPriority === 'object');
    check('stateA.perspectives.managerSelectedFocusAreas',  typeof snapshot1.stateA?.perspectives?.managerSelectedFocusAreas === 'object');
    check('stateA.perspectives.michaelBenchmarkPriorities', typeof snapshot1.stateA?.perspectives?.michaelBenchmarkPriorities === 'object');
    check('stateA.perspectives.michaelSynthesisPriorities', typeof snapshot1.stateA?.perspectives?.michaelSynthesisPriorities === 'object');
    check('stateB.available: true (5 phase4-complete ≥ 5)', snapshot1.stateB?.available === true);
    check('stateB.progressJudgements present',              typeof snapshot1.stateB?.progressJudgements === 'object');
    check('snapshot: no individual session IDs in payload',
      !allSessions.some(id => JSON.stringify(snapshot1).includes(id)));

    // ── 6. Subgroup visibility ─────────────────────────────────────────────

    console.log('\n6. Subgroup visibility\n');

    const byDisc = snapshot1.stateA?.subgroups?.byDiscipline || {};
    const cre    = byDisc['Commercial Real Estate'];
    const val    = byDisc['Valuation'];

    check('CRE subgroup (5 sessions): suppressed = false',
      cre?.suppressed === false, cre ? `analyticsEligible=${cre.analyticsEligible}` : 'group absent');
    check('CRE subgroup: areaOutcomes present when not suppressed',
      typeof cre?.areaOutcomes === 'object');
    check('Valuation subgroup (1 session): suppressed = true',
      val?.suppressed === true, val ? `analyticsEligible=${val.analyticsEligible}` : 'group absent');
    check('Valuation subgroup: no areaOutcomes when suppressed',
      !val?.areaOutcomes);

    // ── 7. Employer auth ───────────────────────────────────────────────────

    console.log('\n7. Employer auth\n');

    const r_valid = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
    check('valid employer token → 200 + snapshot returned',
      r_valid.status === 200 && r_valid.json?.snapshot?.schemaVersion === 'cohort-snapshot-v1',
      `status ${r_valid.status}`);
    check('snapshot-load: correct firmName returned',
      r_valid.json?.firmName === 'Smoke Test Firm', r_valid.json?.firmName);

    const candidateToken = signJwt({ role: 'candidate', email: EMPLOYER_EMAIL, expires: Date.now() + 3600000 });
    const r_role = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: candidateToken });
    check('candidate-role token → 401', r_role.status === 401, `got ${r_role.status}`);

    const badCohortToken = signJwt({ cohortId: 'nonexistent-xyz', role: 'employer', email: EMPLOYER_EMAIL, expires: Date.now() + 3600000 });
    const r_404 = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: badCohortToken });
    check('nonexistent cohortId → 404', r_404.status === 404, `got ${r_404.status}`);

    // ── 8. Stale snapshot recompute ────────────────────────────────────────

    console.log('\n8. Stale snapshot recompute\n');

    const originalComputedAt = snapshot1.computedAt;

    const staleResult = await post('/.netlify/functions/p1-smoke-seed', {
      action: 'set_stale',
      internalSecret: INTERNAL_SECRET,
      cohortId,
      staleMs: 2 * STALE_MS
    });
    if (staleResult.status !== 200) throw new Error(`set_stale failed: ${staleResult.status}`);

    const r_stale = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
    check('stale: snapshot-load → 200',          r_stale.status === 200,          `got ${r_stale.status}`);
    check('stale: computing = true',             r_stale.json?.computing === true, `computing=${r_stale.json?.computing}`);
    check('stale: stale snapshot returned while computing',
      r_stale.json?.snapshot != null && r_stale.json.snapshot.computedAt < Date.now() - STALE_MS,
      `computedAt=${r_stale.json?.snapshot?.computedAt}`);

    console.log('  Polling for refreshed snapshot (max 90s)...');
    const snapshot2 = await poll(async () => {
      const s = await blobGetJSON(COHORT_STORE, `${cohortId}/snapshot`);
      return s?.computedAt > originalComputedAt ? s : null;
    });
    check('stale recompute: new computedAt > original', snapshot2 !== null,
      snapshot2 ? `new=${snapshot2.computedAt} orig=${originalComputedAt}` : 'timeout after 90s');
  }

  // ── 9. Snapshot-trigger debounce ──────────────────────────────────────────

  console.log('\n9. Snapshot-trigger debounce\n');

  await post('/.netlify/functions/p1-smoke-seed', {
    action: 'reset_debounce',
    internalSecret: INTERNAL_SECRET,
    cohortId
  });

  const r_t1 = await post('/.netlify/functions/p1-cohort-snapshot-trigger',
    { sessionId: groupASessions[0], internalSecret: INTERNAL_SECRET });
  check('trigger: first call → 202',             r_t1.status === 202,            `got ${r_t1.status}`);
  check('trigger: first call → triggered:true',  r_t1.json?.triggered === true,  `body=${JSON.stringify(r_t1.json)}`);

  const r_t2 = await post('/.netlify/functions/p1-cohort-snapshot-trigger',
    { sessionId: groupASessions[0], internalSecret: INTERNAL_SECRET });
  check('trigger: second call → 200 debounced',      r_t2.status === 200,                `got ${r_t2.status}`);
  check('trigger: second call → skipped:debounced',  r_t2.json?.skipped === 'debounced', `body=${JSON.stringify(r_t2.json)}`);

} finally {

  // ── Cleanup — always runs ──────────────────────────────────────────────────

  console.log('\n─────────────────────────────────────────────────────');
  console.log('  Cleanup\n');

  const cleanupResult = await post('/.netlify/functions/p1-smoke-seed', {
    action: 'cleanup',
    internalSecret: INTERNAL_SECRET,
    cohortId,
    sessionIds: allSessions
  });
  if (cleanupResult.status === 200) {
    console.log(`  ↳ cleanup complete (${allSessions.length} sessions + cohort blobs removed)`);
  } else {
    console.error(`  ↳ cleanup FAILED: ${cleanupResult.status} ${JSON.stringify(cleanupResult.json)}`);
  }
}

// ── Browser-only manual checklist ─────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────');
console.log('  Manual browser checks (cannot be automated)\n');
console.log('  Open /cohort-dashboard?token=<valid-employer-token> on the deploy-preview:\n');
console.log('  □  Token stripped from URL bar after page load (history.replaceState)');
console.log('  □  Token survives page refresh (persisted to localStorage)');
console.log('  □  Computing banner renders while snapshot is being prepared');
console.log('  □  After bounded retries (15s / 30s / 60s), manual "Check again" button appears');
console.log('  □  stateA renders: area outcome bars, exposure intelligence, intervention types');
console.log('  □  CRE subgroup (5 members): discipline breakdown with areaOutcomes visible');
console.log('  □  Suppressed subgroup: "Not enough data to show this subgroup safely." (no count)');
console.log('  □  stateB renders: progress judgements, graduation rate');
console.log('  □  Employer Actions narrative renders (or gracefully absent if AI call skipped)');
console.log('  □  Page legible on 375px mobile viewport');
console.log('  □  Expired token shows clear session-expired message, not a raw error\n');

// ── Results ───────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed  ${failed} failed`);
console.log('═══════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
