// netlify/functions/p1-test-seed.js
// TEST SCAFFOLD ONLY — DELETE BEFORE MERGE TO MAIN
//
// Phase 4 seeding, triggering, and state verification.
// Refuses to operate unless P1_STORE_PREFIX === 'test'.
//
// POST { adminSecret, action, sessionId? }
//
// Actions:
//   seed-normal            seed a reflection-ready session with 3 test priorities
//   seed-lapse             seed a manager-lapsed session (lapse route)
//   trigger-phase4         open progress reflection for a session; return candidate link
//   force-manager-lapse    simulate 14-day non-response; trigger synthesis background
//   seed-graduation-path   seed strong P1–P5 + PM1–PM3 directly; trigger synthesis (skips screens 1–2)
//   reset-for-second-cycle reset progress-complete to reflection-ready; clear cycle-1 blobs
//   verify                 return all Phase 4 blobs for a session

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};
const PROGRESS_CANDIDATE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function assertTestPrefix() {
  if (process.env.P1_STORE_PREFIX !== 'test') {
    throw new Error(
      `P1_STORE_PREFIX is '${process.env.P1_STORE_PREFIX || '(unset)'}' — test scaffold requires 'test'`
    );
  }
}

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getInviteStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-invites`)
    : getStore({ name: `${PREFIX}p1-invites`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function generateToken(payload) {
  const jwtSecret = process.env.JWT_SECRET;
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

// ── Test data ────────────────────────────────────────────────────────────────
//
// Priority 1 is designed as a graduation candidate: basic client communication skill.
// Priority 2: partial progress (stakeholder conflict management — still developing).
// Priority 3: limited evidence (ethics in practice — broad ongoing priority).
//
// GRADUATION_CANDIDATE_RESPONSES / GRADUATION_MANAGER_RESPONSES are pre-composed
// realistic answers. PM3 deliberately does not state the graduation conclusion —
// Michael must infer it from the evidence. If he does not graduate, that is a
// finding about the synthesis prompt, not a seeding failure.

const TEST_PRIORITIES = [
  'Develop structured client communication skills for presenting technical findings clearly and professionally',
  'Build confidence managing conflicting stakeholder priorities and expectations within projects',
  'Deepen understanding of RICS Rules of Conduct and ethical decision-making in everyday practice'
];

const TEST_REVIEW_DATE = '2027-03-01';
const TEST_FIRM = 'GCAi Test Ltd';
const TEST_DISCIPLINE = 'Quantity Surveying';
const TEST_CANDIDATE_EMAIL = 'test-candidate@gcai.test';
const TEST_MANAGER_EMAIL = 'test-manager@gcai.test';
const TEST_LAPSE_CANDIDATE_EMAIL = 'test-candidate-lapse@gcai.test';
const TEST_LAPSE_MANAGER_EMAIL = 'test-manager-lapse@gcai.test';

function makeDummyReport() {
  return `<div style="font-family:sans-serif;max-width:720px">
    <h2 style="color:#0f1729">Professional Readiness Benchmark Report</h2>
    <p style="color:#64748b"><em>Test session — seeded for Phase 4 testing</em></p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:12px 0;border:1px solid #e2e8f0">
      <p><strong>Summary:</strong> This candidate demonstrates solid foundational knowledge across core Quantity Surveying competencies.
      Client communication skills are developing well, with recent examples of presenting cost plans directly to clients.
      Stakeholder management is an area of active growth. Ethical awareness is present but would benefit from
      more deliberate practice in complex scenarios.</p>
    </div>
    <h3>Agreed development priorities</h3>
    <ol>
      <li>Client communication and presenting technical findings</li>
      <li>Managing conflicting stakeholder priorities</li>
      <li>Applying RICS Rules of Conduct in practice</li>
    </ol>
    <p style="font-size:12px;color:#94a3b8">This is a seeded test report for Phase 4 infrastructure testing.</p>
  </div>`;
}

function makeDummySynthesis(candidateOnly = false) {
  return {
    schemaVersion: 'benchmark-v1',
    summary: 'This candidate is on a solid development trajectory. Communication skills are progressing well with emerging confidence in client-facing contexts. Stakeholder management is developing but needs more consistent practice. Ethics awareness is present and foundational, requiring more deliberate application in complex scenarios.',
    prioritisedDevelopmentAreas: TEST_PRIORITIES.map((p, i) => ({
      rank: i + 1,
      area: p,
      rationale: [
        'Strong foundation; ready to apply consistently in client-facing contexts with greater autonomy.',
        'Exposure is growing but consistency under pressure is still needed.',
        'Awareness present; practical application in ethically complex situations needs development.'
      ][i]
    })),
    alignmentSummary: candidateOnly
      ? null
      : 'Manager and candidate broadly aligned on development priorities. Manager noted particular strength in technical knowledge and enthusiasm for client work.',
    managerThemes: candidateOnly ? [] : ['Client communication confidence', 'Technical rigour', 'Stakeholder awareness'],
    agreedByLabel: candidateOnly
      ? 'Your own assessment (manager did not respond)'
      : 'Agreed with your manager'
  };
}

function makeBaseMetadata(sessionId, overrides = {}) {
  const now = Date.now();
  return {
    schemaVersion: 'benchmark-v1',
    sessionId,
    cohortId: `test-cohort-${sessionId.slice(0, 8)}`,
    firmName: TEST_FIRM,
    candidateEmail: TEST_CANDIDATE_EMAIL,
    managerEmail: TEST_MANAGER_EMAIL,
    employerEmail: 'test-employer@gcai.test',
    employmentType: 'graduate',
    discipline: TEST_DISCIPLINE,
    employmentStartDate: '2024-09-01',
    monthsInRole: 24,
    createdAt: now - 90 * 24 * 60 * 60 * 1000,
    candidateStartedAt: now - 89 * 24 * 60 * 60 * 1000,
    candidateCompletedAt: now - 80 * 24 * 60 * 60 * 1000,
    managerInvitedAt: now - 80 * 24 * 60 * 60 * 1000,
    managerCompletedAt: now - 75 * 24 * 60 * 60 * 1000,
    synthesisStartedAt: now - 75 * 24 * 60 * 60 * 1000,
    synthesisCompletedAt: now - 75 * 24 * 60 * 60 * 1000,
    selfPlanSetAt: null,
    selfPlanReviewDate: null,
    agreedReviewDate: null,
    progressReflectionDueAt: null,
    progressReflectionOpenedAt: null,
    progressReflectionSentAt: null,
    candidateInviteKey: null,
    currentManagerInviteKey: null,
    reminderEmail2SentAt: null,
    reminderEmail4SentAt: null,
    ...overrides
  };
}

// Pre-composed responses for seed-graduation-path.
// Written as a real 2-year QS graduate with genuine strong progress on Priority 1.
const GRADUATION_CANDIDATE_RESPONSES = {
  P1: "Definitely client communication. At the start of this year I was still relying on my line manager to handle technical questions in meetings. I now lead cost reporting presentations for two live projects independently — my manager only attends the more complex discussions. I've also put together a standard format for cost plan summaries that the team has started using.",
  P2: "I prepare a written one-page summary before every client meeting — findings and cost implications written so a non-QS can follow it. Previously I'd pull up the spreadsheet and talk through it. I also send a short follow-up email after each meeting confirming what was discussed and any agreed actions, which clients seem to value.",
  P3: "In May I presented a Stage 3 cost plan for a £3.2m healthcare fit-out to the client's board — six people, none from a construction background. My manager wasn't in the room. I'd prepared a one-page summary and walked them through the main cost drivers and where we sat against budget. They had several questions about provisional sums which I answered fully. The client's project lead emailed afterwards to say it was the clearest cost presentation they'd had on the project.",
  P4: "Managing conflicting stakeholder priorities. I can handle straightforward cases but when the client's brief is shifting and the contractor is pushing back on costs at the same time I find it hard to know how to prioritise and who to escalate to. I've been on two projects recently where both were happening at once and I felt out of my depth.",
  P5: "Being in the room for contractor negotiations would help — at the moment I prepare the cost data but my manager takes the lead in the actual meeting. Even observing a few of those conversations would help me understand when to hold firm and when to move. On ethics, a case study session on how the team has handled specific dilemmas on past projects would be more useful than RICS webinars."
};

const GRADUATION_MANAGER_RESPONSES = {
  PM1: "The improvement in client-facing presentation has been marked. Six months ago I would always lead in client meetings; now I'm comfortable letting them run cost plan presentations independently. The written summaries they prepare have become a template we use across the team. Feedback from clients has been consistently positive.",
  PM2: "Stakeholder management under pressure is still developing. When a project gets into dispute territory or client instructions change significantly mid-stage, they're not yet confident about how to manage competing demands or when to escalate. The ethics piece is present at a basic level but I haven't seen it applied in a genuinely difficult situation.",
  PM3: "The client communication work has come on considerably — they're ready for something more stretching in that area, perhaps taking commercial lead on a project or involvement in a dispute or negotiation situation. The stakeholder management and ethics priorities should continue."
};

// ── Actions ──────────────────────────────────────────────────────────────────

async function seedNormal(sessionStore) {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const pastDueAt = now - 2 * 24 * 60 * 60 * 1000; // 2 days ago

  await sessionStore.setJSON(`${sessionId}/metadata`, makeBaseMetadata(sessionId, {
    status: 'reflection-ready',
    agreedReviewDate: TEST_REVIEW_DATE,
    progressReflectionDueAt: pastDueAt
  }));

  await sessionStore.setJSON(`${sessionId}/candidate-private`, {
    report: makeDummyReport(),
    contextAnswers: { employmentType: 'graduate', discipline: TEST_DISCIPLINE, monthsInRole: 24 }
  });

  await sessionStore.setJSON(`${sessionId}/synthesis`, {
    synthesis: makeDummySynthesis(false)
  });

  await sessionStore.setJSON(`${sessionId}/agreed-priorities`, {
    schemaVersion: 'benchmark-v1',
    agreedPriorities: TEST_PRIORITIES,
    reviewDate: TEST_REVIEW_DATE,
    agreedBy: 'manager',
    recordedAt: now - 74 * 24 * 60 * 60 * 1000
  });

  return { sessionId };
}

async function seedLapse(sessionStore) {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const pastDueAt = now - 2 * 24 * 60 * 60 * 1000;

  await sessionStore.setJSON(`${sessionId}/metadata`, makeBaseMetadata(sessionId, {
    candidateEmail: TEST_LAPSE_CANDIDATE_EMAIL,
    managerEmail: TEST_LAPSE_MANAGER_EMAIL,
    status: 'manager-lapsed',
    managerCompletedAt: null,
    createdAt: now - 120 * 24 * 60 * 60 * 1000,
    candidateStartedAt: now - 119 * 24 * 60 * 60 * 1000,
    candidateCompletedAt: now - 110 * 24 * 60 * 60 * 1000,
    managerInvitedAt: now - 110 * 24 * 60 * 60 * 1000,
    synthesisStartedAt: now - 96 * 24 * 60 * 60 * 1000,
    synthesisCompletedAt: now - 96 * 24 * 60 * 60 * 1000,
    selfPlanSetAt: now - 95 * 24 * 60 * 60 * 1000,
    selfPlanReviewDate: TEST_REVIEW_DATE,
    progressReflectionDueAt: pastDueAt
  }));

  await sessionStore.setJSON(`${sessionId}/candidate-private`, {
    report: makeDummyReport(),
    contextAnswers: { employmentType: 'graduate', discipline: TEST_DISCIPLINE, monthsInRole: 24 }
  });

  await sessionStore.setJSON(`${sessionId}/synthesis`, {
    synthesis: makeDummySynthesis(true)
  });

  await sessionStore.setJSON(`${sessionId}/agreed-priorities`, {
    schemaVersion: 'benchmark-v1',
    agreedPriorities: TEST_PRIORITIES,
    reviewDate: TEST_REVIEW_DATE,
    agreedBy: 'candidate',
    recordedAt: now - 95 * 24 * 60 * 60 * 1000
  });

  return { sessionId };
}

async function triggerPhase4(sessionStore, inviteStore, sessionId) {
  const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
  if (!meta) throw new Error('Session not found');

  const ELIGIBLE = ['reflection-ready', 'manager-lapsed'];
  if (!ELIGIBLE.includes(meta.status)) {
    throw new Error(`Status is '${meta.status}'; expected reflection-ready or manager-lapsed`);
  }
  if (meta.progressReflectionOpenedAt) {
    throw new Error('Progress reflection already opened — use verify to read existing token');
  }

  const now = Date.now();
  const progressCandidatePayload = {
    sessionId,
    role: 'candidate',
    email: meta.candidateEmail,
    expires: now + PROGRESS_CANDIDATE_TOKEN_TTL_MS
  };
  const progressCandidateToken = generateToken(progressCandidatePayload);

  await inviteStore.setJSON(progressCandidateToken, {
    sessionId,
    role: 'candidate',
    expiresAt: now + PROGRESS_CANDIDATE_TOKEN_TTL_MS,
    issuedAt: now
  });

  await sessionStore.setJSON(`${sessionId}/metadata`, {
    ...meta,
    status: 'progress-reflection-open',
    progressReflectionOpenedAt: now,
    progressCandidateInviteKey: progressCandidateToken
  });

  const siteUrl = process.env.URL || 'https://getcharteredai.com';
  return {
    sessionId,
    candidateProgressToken: progressCandidateToken,
    candidateProgressLink: `${siteUrl}/professional-readiness-benchmark?token=${progressCandidateToken}`
  };
}

async function forceManagerLapse(sessionStore, sessionId) {
  const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
  if (!meta) throw new Error('Session not found');

  if (meta.status !== 'progress-manager-invited') {
    throw new Error(`Status is '${meta.status}'; expected progress-manager-invited`);
  }

  const now = Date.now();
  await sessionStore.setJSON(`${sessionId}/metadata`, {
    ...meta,
    status: 'progress-manager-lapsed',
    progressManagerLapsedAt: now
  });

  const internalSecret = process.env.P1_INTERNAL_SECRET;
  const siteUrl = process.env.URL || 'https://getcharteredai.com';
  const runToken = crypto.randomUUID();

  if (internalSecret) {
    fetch(`${siteUrl}/.netlify/functions/p1-progress-synthesis-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, internalSecret, runToken })
    }).catch(e => console.error('[p1-test-seed] Synthesis trigger error:', e.message));
  } else {
    console.warn('[p1-test-seed] P1_INTERNAL_SECRET not set — synthesis not triggered');
  }

  return {
    status: 'progress-manager-lapsed',
    synthesisTriggered: !!internalSecret,
    jobKey: `${sessionId}/jobs/progress-synthesis`,
    runToken
  };
}

async function seedGraduationPath(sessionStore, sessionId) {
  const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
  if (!meta) throw new Error('Session not found');

  if (meta.status !== 'progress-reflection-open') {
    throw new Error(`Status is '${meta.status}'; expected progress-reflection-open`);
  }

  const now = Date.now();

  // Archive agreed-priorities → priorities-history (mirrors p1-progress-candidate)
  const currentPlan = await sessionStore.get(`${sessionId}/agreed-priorities`, { type: 'json' });
  if (currentPlan) {
    const existingHistory = await sessionStore.get(`${sessionId}/priorities-history`, { type: 'json' }) || [];
    existingHistory.push({
      version: existingHistory.length + 1,
      archivedAt: now,
      agreedBy: currentPlan.agreedBy,
      agreedPriorities: currentPlan.agreedPriorities,
      reviewDate: currentPlan.reviewDate,
      recordedAt: currentPlan.recordedAt
    });
    await sessionStore.setJSON(`${sessionId}/priorities-history`, existingHistory);
  }

  // Seed pre-composed candidate and manager responses directly
  await sessionStore.setJSON(`${sessionId}/progress-responses`, {
    responses: GRADUATION_CANDIDATE_RESPONSES,
    submittedAt: now
  });
  await sessionStore.setJSON(`${sessionId}/progress-manager-responses`, {
    responses: GRADUATION_MANAGER_RESPONSES,
    submittedAt: now + 1000
  });

  // Advance metadata to progress-synthesising before triggering background
  const runToken = crypto.randomUUID();
  await sessionStore.setJSON(`${sessionId}/metadata`, {
    ...meta,
    status: 'progress-synthesising',
    candidateProgressSubmittedAt: now,
    progressManagerInvitedAt: now,
    progressManagerCompletedAt: now + 1000,
    progressSynthesisStartedAt: now + 2000
  });

  const internalSecret = process.env.P1_INTERNAL_SECRET;
  const siteUrl = process.env.URL || 'https://getcharteredai.com';
  if (internalSecret) {
    fetch(`${siteUrl}/.netlify/functions/p1-progress-synthesis-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, internalSecret, runToken })
    }).catch(e => console.error('[p1-test-seed] Graduation synthesis trigger error:', e.message));
  } else {
    console.warn('[p1-test-seed] P1_INTERNAL_SECRET not set — synthesis not triggered');
  }

  return {
    sessionId,
    synthesisTriggered: !!internalSecret,
    jobKey: `${sessionId}/jobs/progress-synthesis`,
    runToken,
    note: 'Poll verify until status is progress-ready, then give candidate the progress-review link'
  };
}

async function resetForSecondCycle(sessionStore, sessionId) {
  const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
  if (!meta) throw new Error('Session not found');

  if (meta.status !== 'progress-complete') {
    throw new Error(`Status is '${meta.status}'; expected progress-complete`);
  }

  const now = Date.now();
  const pastDueAt = now - 2 * 24 * 60 * 60 * 1000;

  // Reset metadata — preserve agreed-priorities (cycle-1 confirmed plan stays in place
  // and will be archived to priorities-history when the cycle-2 candidate reflection is submitted)
  await sessionStore.setJSON(`${sessionId}/metadata`, {
    ...meta,
    status: 'reflection-ready',
    progressReflectionDueAt: pastDueAt,
    progressReflectionOpenedAt: null,
    progressCandidateInviteKey: null,
    candidateProgressSubmittedAt: null,
    progressManagerInvitedAt: null,
    currentProgressManagerInviteKey: null,
    progressManagerCompletedAt: null,
    progressManagerLapsedAt: null,
    progressSynthesisStartedAt: null,
    progressSynthesisCompletedAt: null,
    progressRefreshedAt: null,
    progressReviewDate: null
  });

  // Clear cycle-1 Phase 4 blobs so no-overwrite guards pass on cycle 2
  await sessionStore.delete(`${sessionId}/progress-responses`);
  await sessionStore.delete(`${sessionId}/progress-manager-responses`);
  await sessionStore.delete(`${sessionId}/progress-review`);
  await sessionStore.delete(`${sessionId}/jobs/progress-synthesis`);

  // priorities-history is deliberately NOT cleared — it must carry forward from cycle 1

  return { sessionId, resetTo: 'reflection-ready', note: 'priorities-history preserved; cycle-1 blobs cleared' };
}

async function verify(sessionStore, sessionId) {
  const [
    meta,
    candidatePrivate,
    agreedPriorities,
    prioritiesHistory,
    progressResponses,
    progressManagerResponses,
    progressReview,
    jobStatus
  ] = await Promise.all([
    sessionStore.get(`${sessionId}/metadata`, { type: 'json' }),
    sessionStore.get(`${sessionId}/candidate-private`, { type: 'json' }),
    sessionStore.get(`${sessionId}/agreed-priorities`, { type: 'json' }),
    sessionStore.get(`${sessionId}/priorities-history`, { type: 'json' }),
    sessionStore.get(`${sessionId}/progress-responses`, { type: 'json' }),
    sessionStore.get(`${sessionId}/progress-manager-responses`, { type: 'json' }),
    sessionStore.get(`${sessionId}/progress-review`, { type: 'json' }),
    sessionStore.get(`${sessionId}/jobs/progress-synthesis`, { type: 'json' })
  ]);

  return {
    meta: meta ? {
      status: meta.status,
      progressReflectionDueAt: meta.progressReflectionDueAt,
      progressReflectionOpenedAt: meta.progressReflectionOpenedAt,
      candidateProgressSubmittedAt: meta.candidateProgressSubmittedAt,
      progressManagerInvitedAt: meta.progressManagerInvitedAt,
      progressManagerCompletedAt: meta.progressManagerCompletedAt,
      progressManagerLapsedAt: meta.progressManagerLapsedAt,
      progressSynthesisStartedAt: meta.progressSynthesisStartedAt,
      progressSynthesisCompletedAt: meta.progressSynthesisCompletedAt,
      progressRefreshedAt: meta.progressRefreshedAt,
      progressReviewDate: meta.progressReviewDate,
      currentProgressManagerInviteKey: meta.currentProgressManagerInviteKey ? '[set]' : null
    } : null,
    hasCandidatePrivate: !!candidatePrivate?.report,
    agreedPriorities: agreedPriorities || null,
    prioritiesHistory: prioritiesHistory
      ? prioritiesHistory.map(h => ({
          version: h.version,
          agreedBy: h.agreedBy,
          priorityCount: h.agreedPriorities?.length,
          archivedAt: h.archivedAt
        }))
      : null,
    progressResponses: progressResponses
      ? {
          hasP1: !!progressResponses.responses?.P1,
          hasP2: !!progressResponses.responses?.P2,
          hasP3: !!progressResponses.responses?.P3,
          hasP4: !!progressResponses.responses?.P4,
          hasP5: !!progressResponses.responses?.P5,
          submittedAt: progressResponses.submittedAt
        }
      : null,
    progressManagerResponses: progressManagerResponses
      ? {
          hasPM1: !!progressManagerResponses.responses?.PM1,
          hasPM2: !!progressManagerResponses.responses?.PM2,
          hasPM3: !!progressManagerResponses.responses?.PM3,
          submittedAt: progressManagerResponses.submittedAt
        }
      : null,
    progressReview: progressReview?.review
      ? {
          candidateOnly: progressReview.review.candidateOnly,
          priorityCount: progressReview.review.progressAgainstPriorities?.length,
          graduatedPriorities: (progressReview.review.progressAgainstPriorities || [])
            .filter(p => p.graduated)
            .map(p => ({ rank: p.rank, priority: p.priority, progressJudgement: p.progressJudgement })),
          proposedPriorities: (progressReview.review.proposedPriorities || []).map(p => ({
            rank: p.rank,
            priority: p.priority,
            continuedFrom: p.continuedFrom,
            graduatedFrom: p.graduatedFrom
          })),
          progressJudgements: (progressReview.review.progressAgainstPriorities || []).map(p => ({
            rank: p.rank,
            progressJudgement: p.progressJudgement,
            graduated: !!p.graduated
          }))
        }
      : null,
    synthJobStatus: jobStatus || null
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { adminSecret, action, sessionId } = body;

  // Diagnostic — branch only, remove before merge
  if (action === 'diag-secret') {
    const envAdmin    = process.env.P1_ADMIN_SECRET    || '';
    const envInternal = process.env.P1_INTERNAL_SECRET || '';
    const submitted   = (adminSecret || '').trim();
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        P1_ADMIN_SECRET_present:    !!envAdmin,
        P1_ADMIN_SECRET_length:     envAdmin.length,
        P1_INTERNAL_SECRET_present: !!envInternal,
        P1_INTERNAL_SECRET_length:  envInternal.length,
        submittedLength:            submitted.length,
        matchesAdmin:    submitted === envAdmin.trim(),
        matchesInternal: submitted === envInternal.trim()
      })
    };
  }

  if (!adminSecret || adminSecret.trim() !== (process.env.P1_ADMIN_SECRET || '').trim()) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    assertTestPrefix();
  } catch (e) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
  }

  const sessionStore = getSessionStore();
  const inviteStore = getInviteStore();

  try {
    if (action === 'seed-normal') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await seedNormal(sessionStore)) };
    }
    if (action === 'seed-lapse') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await seedLapse(sessionStore)) };
    }
    if (action === 'trigger-phase4') {
      if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await triggerPhase4(sessionStore, inviteStore, sessionId)) };
    }
    if (action === 'force-manager-lapse') {
      if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await forceManagerLapse(sessionStore, sessionId)) };
    }
    if (action === 'seed-graduation-path') {
      if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await seedGraduationPath(sessionStore, sessionId)) };
    }
    if (action === 'reset-for-second-cycle') {
      if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await resetForSecondCycle(sessionStore, sessionId)) };
    }
    if (action === 'verify') {
      if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(await verify(sessionStore, sessionId)) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };

  } catch (err) {
    console.error('[p1-test-seed] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
