#!/usr/bin/env node
// scripts/p1-smoke-test-phase5.mjs
// Phase 5 smoke test — cohort analytics + employer dashboard
//
// Runs against the live site. Tests auth boundaries, creates a synthetic cohort,
// injects 5 minimal cohort-safe records directly (requires NETLIFY_AUTH_TOKEN +
// NETLIFY_SITE_ID), triggers analytics, reads the snapshot, and checks every
// Phase 5 privacy and rendering invariant.
//
// Required env vars:
//   P1_ADMIN_SECRET     — from /tmp/p1-admin-secret.txt
//   P1_INTERNAL_SECRET  — from Netlify env (required for trigger + analytics calls)
//   JWT_SECRET          — from Netlify env (for generating test employer token)
//   NETLIFY_AUTH_TOKEN  — for direct blob writes (synthetic cohort-safe records)
//   NETLIFY_SITE_ID     — site UUID from Netlify dashboard
//
// Usage:
//   P1_ADMIN_SECRET=... P1_INTERNAL_SECRET=... JWT_SECRET=... \
//   NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... \
//   node scripts/p1-smoke-test-phase5.mjs

import { readFileSync } from 'fs';
import crypto from 'crypto';

// ── Config ─────────────────────────────────────────────────────────────────────

const SITE_URL     = process.env.P1_SITE_URL || 'https://getcharteredai.com';
const ADMIN_SECRET = process.env.P1_ADMIN_SECRET || (() => {
  try { return readFileSync('/tmp/p1-admin-secret.txt', 'utf8').trim(); } catch { return null; }
})();
const INTERNAL_SECRET = process.env.P1_INTERNAL_SECRET;
const JWT_SECRET      = process.env.JWT_SECRET;
const NETLIFY_TOKEN   = process.env.NETLIFY_AUTH_TOKEN;
const NETLIFY_SITE    = process.env.NETLIFY_SITE_ID;

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const PASS = '✓';
const FAIL = '✗';
const SKIP = '–';

let passed = 0, failed = 0, skipped = 0;

function log(icon, label, detail = '') {
  console.log(`  ${icon} ${label}${detail ? `  (${detail})` : ''}`);
  if (icon === PASS) passed++;
  else if (icon === FAIL) { failed++; console.error(`    ↳ FAILED`); }
  else skipped++;
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${SITE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function blobPut(store, key, value) {
  const url = `https://api.netlify.com/api/v1/blobs/${NETLIFY_SITE}/${store}/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`Blob PUT ${key} failed: ${res.status} ${await res.text()}`);
}

async function blobGet(store, key) {
  const url = `https://api.netlify.com/api/v1/blobs/${NETLIFY_SITE}/${store}/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blob GET ${key} failed: ${res.status}`);
  return res.json();
}

function signJwt(payload) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

// ── Synthetic cohort data ─────────────────────────────────────────────────────

const FIVE_AREAS = [
  'Professional Behaviour & Responsibility',
  'Communication & Working With Others',
  'Learning & Applying Knowledge',
  'Judgement, Help & Escalation',
  'Feedback, Reflection & Development'
];

function makeCohortSafe(i) {
  // Vary outcomes so bars are non-trivial; session i=4 has a small subgroup team
  const outcomes = ['ON TRACK','DEVELOPING','SUPPORT WOULD HELP','NOT YET ENOUGH EXPOSURE'];
  const exposures = ['confirmed-lack-of-exposure','relevant-exposure-identified','not-assessed','unavailable'];
  return {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: Date.now(),
    benchmark: {
      areas: FIVE_AREAS.map((name, idx) => ({
        id: `a${idx+1}`,
        name,
        outcome: outcomes[(i + idx) % 4],
        exposureConfirmation: exposures[(i + idx) % 4]
      })),
      candidateSelectedPriority: FIVE_AREAS[i % 5],
      developmentPriorities: [
        { area: FIVE_AREAS[i % 5], gapType: ['knowledge','practice','experience','exposure'][i % 4] },
        { area: FIVE_AREAS[(i+1) % 5], gapType: ['knowledge','practice','experience','exposure'][(i+1) % 4] }
      ]
    },
    phase3: {
      managerParticipated: i % 2 === 0,
      managerSelectedFocusAreas: i % 2 === 0 ? [FIVE_AREAS[(i+1) % 5], FIVE_AREAS[(i+2) % 5]] : [],
      areaRelationships: FIVE_AREAS.map((area, idx) => ({
        area,
        relationshipType: idx === 0 && i === 0 ? 'genuine-divergence' : 'aligned'
      })),
      michaelSynthesisPriorities: [
        { area: FIVE_AREAS[(i+1) % 5], gapType: 'practice' }
      ]
    }
  };
}

function makeMetadata(sessionId, cohortId, i) {
  const statuses = ['summary-ready','progress-ready','reflection-ready','summary-ready','summary-ready'];
  return {
    sessionId, cohortId,
    status: statuses[i],
    discipline: i < 3 ? 'Residential Survey' : 'Commercial Real Estate',
    team: i < 4 ? 'London' : 'Manchester',
    office: 'HQ',
    monthsInRole: 14 + i,
    candidateCompletedAt: Date.now() - (i * 86400000),
    candidateSelectedPriority: FIVE_AREAS[i % 5]
  };
}

// ── Test runner ───────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Phase 5 Smoke Test — Cohort Analytics + Dashboard');
console.log(`  Target: ${SITE_URL}`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Section 1: Auth boundaries (no credentials needed) ────────────────────────
console.log('1. Auth boundaries\n');

const missingToken = await post('/.netlify/functions/p1-cohort-snapshot-load', {});
log(missingToken.status === 400 ? PASS : FAIL,
  'snapshot-load: missing token → 400', `got ${missingToken.status}`);

const badToken = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: 'bad.token.abc' });
log(badToken.status === 401 ? PASS : FAIL,
  'snapshot-load: invalid token → 401', `got ${badToken.status}`);

const wrongSecret = await post('/.netlify/functions/p1-cohort-snapshot-trigger', {
  sessionId: 'test', internalSecret: 'wrongsecret'
});
log(wrongSecret.status === 403 ? PASS : FAIL,
  'snapshot-trigger: wrong secret → 403', `got ${wrongSecret.status}`);

// ── Section 2: Route check ─────────────────────────────────────────────────────
console.log('\n2. Routing\n');

const dashboardRoute = await fetch(`${SITE_URL}/cohort-dashboard`);
log(dashboardRoute.status === 200 ? PASS : FAIL,
  '/cohort-dashboard route → 200', `got ${dashboardRoute.status}`);

const dashboardHtml = await dashboardRoute.text();
log(dashboardHtml.includes('Professional Readiness') ? PASS : FAIL,
  'dashboard page contains "Professional Readiness"');
log(dashboardHtml.includes('p1-cohort-snapshot-load') ? PASS : FAIL,
  'dashboard page calls p1-cohort-snapshot-load');
log(!dashboardHtml.includes('recorded). Detailed') ? PASS : FAIL,
  'suppressed subgroups: no count exposed in dashboard HTML');
log(dashboardHtml.includes('Not enough data to show this subgroup safely') ? PASS : FAIL,
  'suppressed subgroups: correct privacy message in dashboard HTML');
log(dashboardHtml.includes('Progress Reflection') ? PASS : FAIL,
  'State B immature state: correct threshold message in dashboard HTML');

// ── Section 3: Synthetic cohort test (needs credentials) ─────────────────────
console.log('\n3. Synthetic cohort (requires NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID + JWT_SECRET + P1_INTERNAL_SECRET)\n');

if (!NETLIFY_TOKEN || !NETLIFY_SITE || !JWT_SECRET || !INTERNAL_SECRET) {
  const missing = [
    !NETLIFY_TOKEN && 'NETLIFY_AUTH_TOKEN',
    !NETLIFY_SITE  && 'NETLIFY_SITE_ID',
    !JWT_SECRET    && 'JWT_SECRET',
    !INTERNAL_SECRET && 'P1_INTERNAL_SECRET'
  ].filter(Boolean).join(', ');
  console.log(`  ${SKIP} Skipping sections 3–8: missing ${missing}\n`);
  skipped += 12;
} else {
  const TEST_COHORT_ID = `smoke-test-${Date.now()}`;
  const TEST_EMAIL     = 'smoke-test@getcharteredai.com';
  const TEST_FIRM      = 'Smoke Test Firm';
  const SESSION_IDS    = Array.from({ length: 5 }, (_, i) => `smoke-sess-${TEST_COHORT_ID}-${i}`);
  const SESSION_STORE  = `${PREFIX}p1-sessions`;
  const COHORT_STORE   = `${PREFIX}p1-cohorts`;

  try {
    // Write cohort index
    const existingIndex = await blobGet(COHORT_STORE, 'index') || [];
    existingIndex.push({ cohortId: TEST_COHORT_ID, firmName: TEST_FIRM, employerContactEmail: TEST_EMAIL, status: 'active', createdAt: Date.now() });
    await blobPut(COHORT_STORE, 'index', existingIndex);

    // Write session list
    await blobPut(COHORT_STORE, `${TEST_COHORT_ID}/sessions`, SESSION_IDS);

    // Write 5 synthetic cohort-safe + metadata records
    for (let i = 0; i < 5; i++) {
      await blobPut(SESSION_STORE, `${SESSION_IDS[i]}/cohort-safe`, makeCohortSafe(i));
      await blobPut(SESSION_STORE, `${SESSION_IDS[i]}/metadata`, makeMetadata(SESSION_IDS[i], TEST_COHORT_ID, i));
    }
    log(PASS, 'Synthetic cohort + 5 cohort-safe records written');

    // ── Section 4: Trigger analytics ──────────────────────────────────────────
    console.log('\n4. Analytics trigger\n');

    // Direct analytics call (bypasses 15-min debounce for test)
    const runToken = crypto.randomUUID();
    const analyticsRes = await post('/.netlify/functions/p1-cohort-analytics-background',
      { cohortId: TEST_COHORT_ID, internalSecret: INTERNAL_SECRET, runToken });
    log(analyticsRes.status === 202 ? PASS : FAIL,
      'analytics-background: accepted with correct secret', `got ${analyticsRes.status}`);

    // Wait for background job (max 30s)
    console.log('  Waiting up to 30s for analytics to complete...');
    let snapshot = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      snapshot = await blobGet(COHORT_STORE, `${TEST_COHORT_ID}/snapshot`);
      if (snapshot) break;
    }
    log(snapshot !== null ? PASS : FAIL, 'snapshot written by analytics function');

    if (snapshot) {
      // ── Section 5: Snapshot contract verification ──────────────────────────
      console.log('\n5. Snapshot contract\n');

      log(snapshot.schemaVersion === 'cohort-snapshot-v1' ? PASS : FAIL,
        'schemaVersion: cohort-snapshot-v1', snapshot.schemaVersion);
      log(snapshot.stateA?.available === true ? PASS : FAIL,
        'stateA.available: true (5 eligible sessions)');
      log(typeof snapshot.stateA?.areaOutcomes === 'object' ? PASS : FAIL,
        'stateA.areaOutcomes present');
      log(typeof snapshot.stateA?.exposureIntelligence === 'object' ? PASS : FAIL,
        'stateA.exposureIntelligence present');
      log(typeof snapshot.stateA?.interventionTypes === 'object' ? PASS : FAIL,
        'stateA.interventionTypes present');
      log(typeof snapshot.stateA?.perspectives?.candidateSelectedPriority === 'object' ? PASS : FAIL,
        'stateA.perspectives.candidateSelectedPriority present');
      log(typeof snapshot.stateA?.perspectives?.managerSelectedFocusAreas === 'object' ? PASS : FAIL,
        'stateA.perspectives.managerSelectedFocusAreas present');
      log(typeof snapshot.stateA?.perspectives?.michaelBenchmarkPriorities === 'object' ? PASS : FAIL,
        'stateA.perspectives.michaelBenchmarkPriorities present');
      log(typeof snapshot.stateA?.perspectives?.michaelSynthesisPriorities === 'object' ? PASS : FAIL,
        'stateA.perspectives.michaelSynthesisPriorities present');
      log(snapshot.stateB?.available === false ? PASS : FAIL,
        'stateB.available: false (only 2 of 5 sessions have phase4 status)');

      // Subgroup: discipline — 3 'Residential Survey', 2 'CRE' — both ≥ 5? No: test has 3+2
      const byDisc = snapshot.stateA?.subgroups?.byDiscipline || {};
      const residentialSuppressed = byDisc['Residential Survey']?.suppressed;
      const creSuppressed = byDisc['Commercial Real Estate']?.suppressed;
      log(residentialSuppressed === true ? PASS : FAIL,
        'subgroup with 3 members: suppressed', residentialSuppressed ? 'suppressed' : 'NOT suppressed');
      log(creSuppressed === true ? PASS : FAIL,
        'subgroup with 2 members: suppressed', creSuppressed ? 'suppressed' : 'NOT suppressed');

      // Verify no session identifiers in snapshot
      const snapStr = JSON.stringify(snapshot);
      const hasSessionId = SESSION_IDS.some(id => snapStr.includes(id));
      log(!hasSessionId ? PASS : FAIL,
        'snapshot contains no individual session identifiers');

      // ── Section 6: Employer dashboard endpoint ──────────────────────────────
      console.log('\n6. Employer dashboard endpoint\n');

      const employerToken = signJwt({
        cohortId: TEST_COHORT_ID,
        role: 'employer',
        email: TEST_EMAIL,
        expires: Date.now() + 3600000
      });

      const dashRes = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
      log(dashRes.status === 200 ? PASS : FAIL,
        'snapshot-load: valid employer token → 200', `got ${dashRes.status}`);
      log(dashRes.json?.snapshot?.schemaVersion === 'cohort-snapshot-v1' ? PASS : FAIL,
        'snapshot-load: returns cohort-snapshot-v1 snapshot');
      log(dashRes.json?.firmName === TEST_FIRM ? PASS : FAIL,
        'snapshot-load: returns correct firmName', dashRes.json?.firmName);

      // Non-employer token (wrong role)
      const candidateToken = signJwt({ role: 'candidate', email: TEST_EMAIL, expires: Date.now() + 3600000 });
      const nonEmpRes = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: candidateToken });
      log(nonEmpRes.status === 401 ? PASS : FAIL,
        'snapshot-load: candidate-role token → 401', `got ${nonEmpRes.status}`);

      // Wrong cohort (different cohort ID in token)
      const wrongCohortToken = signJwt({ cohortId: 'nonexistent', role: 'employer', email: TEST_EMAIL, expires: Date.now() + 3600000 });
      const wrongCohortRes = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: wrongCohortToken });
      log(wrongCohortRes.status === 404 ? PASS : FAIL,
        'snapshot-load: non-existent cohortId → 404', `got ${wrongCohortRes.status}`);
    }

    // ── Cleanup: remove test cohort from index ──────────────────────────────
    try {
      const currentIndex = await blobGet(COHORT_STORE, 'index') || [];
      const cleaned = currentIndex.filter(c => c.cohortId !== TEST_COHORT_ID);
      await blobPut(COHORT_STORE, 'index', cleaned);
      console.log('\n  [cleanup] Test cohort removed from index');
    } catch (e) {
      console.error('\n  [cleanup] Warning: could not clean up test cohort index:', e.message);
    }

  } catch (err) {
    log(FAIL, `Synthetic cohort test error: ${err.message}`);
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed  ${failed} failed  ${skipped} skipped`);
console.log('═══════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
