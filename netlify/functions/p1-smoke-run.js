// netlify/functions/p1-smoke-run.js
// Temporary branch-only smoke runner — feature/p1-phase5-smoke-test ONLY — DO NOT MERGE TO MAIN.
//
// Runs the Phase 5 cohort analytics smoke test entirely within the branch-deploy runtime.
// All secrets come from the Netlify branch-deploy environment — no caller input needed.
// Analytics is fired directly at DEPLOY_PRIME_URL to bypass snapshot-load's siteUrl
// (which resolves to the production domain even on branch deploys).
//
// POST {} → { passed, failed, total, cleanedUp, cohortId, results }

'use strict';

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const FIVE_AREAS = [
  'Professional Behaviour & Responsibility',
  'Communication & Working With Others',
  'Learning & Applying Knowledge',
  'Judgement, Help & Escalation',
  'Feedback, Reflection & Development'
];

const EMPLOYER_EMAIL = 'smoke-employer@example.com';
const STALE_MS = 60 * 60 * 1000;

// ── Fixture builders ──────────────────────────────────────────────────────────

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
      developmentPriorities: [{ area: FIVE_AREAS[i % 5], gapType: GAP_TYPES[i % GAP_TYPES.length] }]
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

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Guard 1: smoke prefix
  if (!process.env.P1_STORE_PREFIX?.startsWith('smoke-')) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Not a smoke environment' }) };
  }

  // Guard 2: not production
  if ((process.env.CONTEXT || '') === 'production') {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden: production' }) };
  }

  // Guard 3: required branch-deploy secrets
  const INTERNAL_SECRET = process.env.P1_INTERNAL_SECRET;
  const JWT_SECRET      = process.env.JWT_SECRET;
  if (!INTERNAL_SECRET || !JWT_SECRET) {
    return { statusCode: 500, headers: HEADERS,
      body: JSON.stringify({ error: 'Missing P1_INTERNAL_SECRET or JWT_SECRET in branch-deploy env' }) };
  }

  // Derive the branch URL from the incoming request host — this is the exact URL the caller
  // used, so function-to-function calls on the same deploy will stay on the branch.
  // Env var fallbacks kept for local testing; DEPLOY_PRIME_URL not reliably set by Netlify.
  const requestHost = event.headers['host'] || event.headers['Host'] || '';
  const BRANCH_URL  = requestHost
    ? `https://${requestHost}`
    : (process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || '');
  if (!BRANCH_URL) {
    return { statusCode: 500, headers: HEADERS,
      body: JSON.stringify({ error: 'Cannot determine branch URL from host header or env vars' }) };
  }

  // Unique identifiers for this run
  const cohortId       = `smoke-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const groupASessions = Array.from({ length: 5 }, (_, i) => `${cohortId}-a${i}`);
  const groupBSession  = `${cohortId}-b0`;
  const allSessions    = [...groupASessions, groupBSession];

  function signJwt(payload) {
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
    return `${tokenData}.${sig}`;
  }

  const employerToken = signJwt({
    cohortId, role: 'employer', email: EMPLOYER_EMAIL, expires: Date.now() + 3600000
  });

  // HTTP POST to branch functions
  async function post(path, body) {
    const res = await fetch(`${BRANCH_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }

  // Fire analytics directly at branch URL — snapshot-load's siteUrl resolves to production
  // so we bypass its internal fire and call the background function explicitly here.
  function fireAnalyticsDirect(cohortId) {
    const runToken = crypto.randomUUID();
    fetch(`${BRANCH_URL}/.netlify/functions/p1-cohort-analytics-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cohortId, internalSecret: INTERNAL_SECRET, runToken })
    }).catch(() => {});
  }

  // Poll cohort store via native getStore (correct namespace)
  const cohortStore = getStore(`${PREFIX}p1-cohorts`);
  async function waitForSnapshot(testFn, maxMs = 18000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const s = await cohortStore.get(`${cohortId}/snapshot`, { type: 'json' });
      if (s && testFn(s)) return s;
      await new Promise(r => setTimeout(r, 1500));
    }
    return null;
  }

  // Test accumulator
  const results = [];
  function check(label, ok, detail) {
    results.push({ label, ok, ...(detail != null ? { detail: String(detail) } : {}) });
  }

  let cleanedUp = false;

  try {

    // ── 1. Auth boundaries ────────────────────────────────────────────────────

    const r_missing = await post('/.netlify/functions/p1-cohort-snapshot-load', {});
    check('snapshot-load: missing token → 400', r_missing.status === 400, `got ${r_missing.status}`);

    const r_bad = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: 'bad.token.xyz' });
    check('snapshot-load: invalid token → 401', r_bad.status === 401, `got ${r_bad.status}`);

    const r_secret = await post('/.netlify/functions/p1-cohort-snapshot-trigger',
      { sessionId: 'test', internalSecret: 'wrongsecret' });
    check('snapshot-trigger: wrong internal secret → 403', r_secret.status === 403, `got ${r_secret.status}`);

    // ── 2. Seed ───────────────────────────────────────────────────────────────

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
    check('seed: 6 sessions via p1-smoke-seed → 200', seedResult.status === 200, `got ${seedResult.status}`);
    if (seedResult.status !== 200) throw new Error('Seed failed — cannot proceed');

    // ── 3. snapshot-load: verify API response (cohort found, no snapshot yet) ──

    const r_load1 = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
    check('snapshot-load: valid employer token → 200', r_load1.status === 200, `got ${r_load1.status}`);
    check('snapshot-load: computing = true (no snapshot yet)', r_load1.json?.computing === true, `computing=${r_load1.json?.computing}`);
    check('snapshot-load: snapshot field is null', r_load1.json?.snapshot === null, `snapshot=${r_load1.json?.snapshot}`);

    // ── 4. Analytics — fire directly at branch, poll blob store ──────────────

    fireAnalyticsDirect(cohortId);
    const snapshot1 = await waitForSnapshot(s => s.schemaVersion === 'cohort-snapshot-v1');
    check('analytics: snapshot written within 18s', snapshot1 !== null);

    if (snapshot1) {

      // ── 5. Snapshot contract ────────────────────────────────────────────────

      check('schemaVersion: cohort-snapshot-v1', snapshot1.schemaVersion === 'cohort-snapshot-v1');
      check('coverage.analyticsEligible: 6', snapshot1.coverage?.analyticsEligible === 6,
        `got ${snapshot1.coverage?.analyticsEligible}`);
      check('coverage.phase4Complete: 5', snapshot1.coverage?.phase4Complete === 5,
        `got ${snapshot1.coverage?.phase4Complete}`);
      check('stateA.available: true (6 eligible ≥ 5)', snapshot1.stateA?.available === true);
      check('stateA.areaOutcomes present', typeof snapshot1.stateA?.areaOutcomes === 'object');
      check('stateA.exposureIntelligence present', typeof snapshot1.stateA?.exposureIntelligence === 'object');
      check('stateA.interventionTypes present', typeof snapshot1.stateA?.interventionTypes === 'object');
      check('stateA.perspectives.candidateSelectedPriority present',
        typeof snapshot1.stateA?.perspectives?.candidateSelectedPriority === 'object');
      check('stateA.perspectives.managerSelectedFocusAreas present',
        typeof snapshot1.stateA?.perspectives?.managerSelectedFocusAreas === 'object');
      check('stateA.perspectives.michaelBenchmarkPriorities present',
        typeof snapshot1.stateA?.perspectives?.michaelBenchmarkPriorities === 'object');
      check('stateA.perspectives.michaelSynthesisPriorities present',
        typeof snapshot1.stateA?.perspectives?.michaelSynthesisPriorities === 'object');
      check('stateB.available: true (5 phase4-complete ≥ 5)', snapshot1.stateB?.available === true);
      check('stateB.progressJudgements present', typeof snapshot1.stateB?.progressJudgements === 'object');
      check('no individual session IDs in snapshot payload',
        !allSessions.some(id => JSON.stringify(snapshot1).includes(id)));

      // ── 6. Subgroup suppression ─────────────────────────────────────────────

      const byDisc = snapshot1.stateA?.subgroups?.byDiscipline || {};
      const cre    = byDisc['Commercial Real Estate'];
      const val    = byDisc['Valuation'];

      check('CRE (5 sessions): suppressed = false', cre?.suppressed === false,
        cre ? `analyticsEligible=${cre.analyticsEligible}` : 'group absent');
      check('CRE: areaOutcomes present when not suppressed', typeof cre?.areaOutcomes === 'object');
      check('Valuation (1 session): suppressed = true', val?.suppressed === true,
        val ? `analyticsEligible=${val.analyticsEligible}` : 'group absent');
      check('Valuation: no areaOutcomes when suppressed', !val?.areaOutcomes);

      // ── 7. Employer auth ────────────────────────────────────────────────────

      const r_valid = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
      check('valid employer token → 200 + snapshot returned',
        r_valid.status === 200 && r_valid.json?.snapshot?.schemaVersion === 'cohort-snapshot-v1',
        `status=${r_valid.status}`);
      check('firmName = Smoke Test Firm', r_valid.json?.firmName === 'Smoke Test Firm', r_valid.json?.firmName);

      const candidateToken = signJwt({ role: 'candidate', email: EMPLOYER_EMAIL, expires: Date.now() + 3600000 });
      const r_role = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: candidateToken });
      check('candidate-role token → 401', r_role.status === 401, `got ${r_role.status}`);

      const badToken = signJwt({ cohortId: 'nonexistent-xyz', role: 'employer', email: EMPLOYER_EMAIL, expires: Date.now() + 3600000 });
      const r_404 = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: badToken });
      check('nonexistent cohortId → 404', r_404.status === 404, `got ${r_404.status}`);

      // ── 8. Stale snapshot detection ─────────────────────────────────────────
      // Marks snapshot as stale; verifies snapshot-load detects it and reports computing=true.
      // Does not wait for recompute to complete — stale detection is the testable property here.

      const staleResult = await post('/.netlify/functions/p1-smoke-seed', {
        action: 'set_stale',
        internalSecret: INTERNAL_SECRET,
        cohortId,
        staleMs: 2 * STALE_MS
      });
      check('set_stale → 200', staleResult.status === 200, `got ${staleResult.status}`);

      if (staleResult.status === 200) {
        const r_stale = await post('/.netlify/functions/p1-cohort-snapshot-load', { token: employerToken });
        check('stale: snapshot-load → 200', r_stale.status === 200, `got ${r_stale.status}`);
        check('stale: computing = true', r_stale.json?.computing === true, `computing=${r_stale.json?.computing}`);
        check('stale: stale snapshot returned while recomputing', r_stale.json?.snapshot != null);
      }
    }

    // ── 9. Trigger debounce ───────────────────────────────────────────────────

    const resetResult = await post('/.netlify/functions/p1-smoke-seed', {
      action: 'reset_debounce',
      internalSecret: INTERNAL_SECRET,
      cohortId
    });
    if (resetResult.status === 200) {
      const r_t1 = await post('/.netlify/functions/p1-cohort-snapshot-trigger',
        { sessionId: groupASessions[0], internalSecret: INTERNAL_SECRET });
      check('trigger: first call → 202', r_t1.status === 202, `got ${r_t1.status}`);
      check('trigger: triggered = true', r_t1.json?.triggered === true, `body=${JSON.stringify(r_t1.json)}`);

      const r_t2 = await post('/.netlify/functions/p1-cohort-snapshot-trigger',
        { sessionId: groupASessions[0], internalSecret: INTERNAL_SECRET });
      check('trigger: second call debounced → 200', r_t2.status === 200, `got ${r_t2.status}`);
      check('trigger: skipped = debounced', r_t2.json?.skipped === 'debounced', `body=${JSON.stringify(r_t2.json)}`);
    }

  } finally {
    try {
      const c = await post('/.netlify/functions/p1-smoke-seed', {
        action: 'cleanup',
        internalSecret: INTERNAL_SECRET,
        cohortId,
        sessionIds: allSessions
      });
      cleanedUp = c.status === 200;
    } catch { cleanedUp = false; }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ passed, failed, total: results.length, cleanedUp, cohortId, results }, null, 2)
  };
};
