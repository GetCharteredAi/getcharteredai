#!/usr/bin/env node
// scripts/seed-demo-cohort.mjs
// Creates a realistic 12-person demo cohort directly in Netlify Blobs.
// Writes session metadata + cohort-safe records, creates cohort index entry,
// generates an employer token, and prints the dashboard URL.
//
// Required env vars:
//   JWT_SECRET          — from Netlify env
//   NETLIFY_AUTH_TOKEN  — personal access token with blob write access
//   NETLIFY_SITE_ID     — site UUID from Netlify dashboard
//
// Optional:
//   DEMO_EMPLOYER_EMAIL — defaults to demo@getcharteredai.com
//   P1_STORE_PREFIX     — if set in Netlify env, must match (default: none)
//   P1_SITE_URL         — base URL (default: https://getcharteredai.com)
//
// Usage:
//   DEMO_COHORT_CONFIRM=yes JWT_SECRET=... NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... node scripts/seed-demo-cohort.mjs

import crypto from 'crypto';

const JWT_SECRET     = process.env.JWT_SECRET;
const NETLIFY_TOKEN  = process.env.NETLIFY_AUTH_TOKEN;
const NETLIFY_SITE   = process.env.NETLIFY_SITE_ID;
const EMPLOYER_EMAIL = process.env.DEMO_EMPLOYER_EMAIL || 'demo@getcharteredai.com';
const SITE_URL       = process.env.P1_SITE_URL || 'https://getcharteredai.com';
const PREFIX         = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const SESSION_STORE = `${PREFIX}p1-sessions`;
const COHORT_STORE  = `${PREFIX}p1-cohorts`;

if (!JWT_SECRET || !NETLIFY_TOKEN || !NETLIFY_SITE) {
  console.error('Missing required env vars: JWT_SECRET, NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID');
  process.exit(1);
}

// Explicit opt-in required because this script writes demo data to the selected Netlify blob store.
if (process.env.DEMO_COHORT_CONFIRM !== 'yes') {
  console.error('Set DEMO_COHORT_CONFIRM=yes to confirm you intend to write demo data to the blob store.');
  process.exit(1);
}

// ── Blob helpers ──────────────────────────────────────────────────────────────

async function blobPut(store, key, value) {
  const url = `https://api.netlify.com/api/v1/blobs/${NETLIFY_SITE}/${store}/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`Blob PUT ${store}/${key} failed: ${res.status} ${await res.text()}`);
}

async function blobGet(store, key) {
  const url = `https://api.netlify.com/api/v1/blobs/${NETLIFY_SITE}/${store}/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blob GET ${store}/${key} failed: ${res.status}`);
  return res.json();
}

// ── Token ─────────────────────────────────────────────────────────────────────

function signToken(payload) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

// ── Demo data ─────────────────────────────────────────────────────────────────
//
// Fletcher & Partners LLP — 12 graduate/apprentice participants
// Spread across QS, PM, BS, CS, FV disciplines; London, Manchester, Bristol offices
// Designed to produce: constraint-led exec summary (FR&D + JH&E gaps dominate);
// clear L&A and PBR strengths; 3 sessions with Phase 4 data for State B.

const FIRM_NAME = 'Fletcher & Partners LLP';
const NOW = Date.now();
const EMPLOYER_TOKEN_TTL = 365 * 24 * 60 * 60 * 1000;

// cohort-safe blobs — one per participant
// Notation: PBR | C&W | L&A | JH&E | FR&D (5 areas in canonical order)
const COHORT_SAFE_RECORDS = [
  // 0: Alice Chen — QS, London, graduate, 18 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 15 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'DEVELOPING', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' }
      ],
      candidateSelectedPriority: 'Feedback, Reflection & Development',
      developmentPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Feedback, Reflection & Development'],
      areaRelationships: [{ area: 'Feedback, Reflection & Development', relationshipType: 'aligned' }],
      michaelSynthesisPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    },
    phase4: {
      progressManagerParticipated: true,
      progressJudgements: [{ rank: 1, progressJudgement: 'Progress evident', graduated: false, area: 'Feedback, Reflection & Development' }],
      proposedPriorityAreas: ['Judgement, Help & Escalation']
    }
  },

  // 1: Ben Osei — QS, London, graduate, 14 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 20 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'DEVELOPING', exposureConfirmation: 'not-assessed' }
      ],
      candidateSelectedPriority: 'Judgement, Help & Escalation',
      developmentPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Judgement, Help & Escalation'],
      areaRelationships: [{ area: 'Judgement, Help & Escalation', relationshipType: 'aligned' }],
      michaelSynthesisPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    },
    phase4: {
      progressManagerParticipated: false,
      progressJudgements: [{ rank: 1, progressJudgement: 'Some progress', graduated: false, area: 'Judgement, Help & Escalation' }],
      proposedPriorityAreas: ['Judgement, Help & Escalation']
    }
  },

  // 2: Carla Hughes — PM, Manchester, graduate, 22 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 10 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' }
      ],
      candidateSelectedPriority: 'Feedback, Reflection & Development',
      developmentPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Feedback, Reflection & Development'],
      areaRelationships: [{ area: 'Feedback, Reflection & Development', relationshipType: 'aligned' }],
      michaelSynthesisPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    },
    phase4: {
      progressManagerParticipated: true,
      progressJudgements: [{ rank: 1, progressJudgement: 'Progress evident', graduated: true, area: 'Feedback, Reflection & Development' }],
      proposedPriorityAreas: ['Learning & Applying Knowledge']
    }
  },

  // 3: Daniel Park — PM, Manchester, graduate, 16 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 25 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'DEVELOPING', exposureConfirmation: 'not-assessed' }
      ],
      candidateSelectedPriority: 'Communication & Working With Others',
      developmentPriorities: [{ area: 'Communication & Working With Others', gapType: 'knowledge' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Communication & Working With Others'],
      areaRelationships: [{ area: 'Communication & Working With Others', relationshipType: 'aligned' }],
      michaelSynthesisPriorities: [{ area: 'Communication & Working With Others', gapType: 'knowledge' }]
    }
  },

  // 4: Eve Patel — BS, London, graduate, 20 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 12 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' }
      ],
      candidateSelectedPriority: 'Feedback, Reflection & Development',
      developmentPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Feedback, Reflection & Development'],
      areaRelationships: [{ area: 'Feedback, Reflection & Development', relationshipType: 'aligned' }],
      michaelSynthesisPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    }
  },

  // 5: Finn Adeyemi — BS, Bristol, graduate, 12 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 30 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'NOT YET ENOUGH EXPOSURE', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' }
      ],
      candidateSelectedPriority: 'Judgement, Help & Escalation',
      developmentPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    }
  },

  // 6: Grace Li — CS, London, graduate, 19 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 18 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'NOT YET ENOUGH EXPOSURE', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' }
      ],
      candidateSelectedPriority: 'Communication & Working With Others',
      developmentPriorities: [{ area: 'Communication & Working With Others', gapType: 'practice' }]
    }
  },

  // 7: Hugo Walsh — CS, Manchester, apprentice, 24 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 8 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' }
      ],
      candidateSelectedPriority: 'Judgement, Help & Escalation',
      developmentPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Judgement, Help & Escalation', 'Communication & Working With Others'],
      areaRelationships: [{ area: 'Judgement, Help & Escalation', relationshipType: 'aligned' }],
      michaelSynthesisPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    },
    phase4: {
      progressManagerParticipated: true,
      progressJudgements: [{ rank: 1, progressJudgement: 'Some progress', graduated: false, area: 'Judgement, Help & Escalation' }],
      proposedPriorityAreas: ['Judgement, Help & Escalation']
    }
  },

  // 8: Isla Fernandez — FV, London, graduate, 15 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 22 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' }
      ],
      candidateSelectedPriority: 'Feedback, Reflection & Development',
      developmentPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'knowledge' }]
    }
  },

  // 9: James Okafor — FV, Bristol, graduate, 17 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 14 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'DEVELOPING', exposureConfirmation: 'not-assessed' }
      ],
      candidateSelectedPriority: 'Communication & Working With Others',
      developmentPriorities: [{ area: 'Communication & Working With Others', gapType: 'practice' }]
    },
    phase3: {
      managerParticipated: true,
      managerSelectedFocusAreas: ['Communication & Working With Others', 'Feedback, Reflection & Development'],
      areaRelationships: [
        { area: 'Communication & Working With Others', relationshipType: 'aligned' },
        { area: 'Feedback, Reflection & Development', relationshipType: 'genuine-divergence' }
      ],
      michaelSynthesisPriorities: [{ area: 'Communication & Working With Others', gapType: 'practice' }]
    },
    phase4: {
      progressManagerParticipated: false,
      progressJudgements: [{ rank: 1, progressJudgement: 'Limited evidence of progress', graduated: false, area: 'Communication & Working With Others' }],
      proposedPriorityAreas: ['Communication & Working With Others', 'Judgement, Help & Escalation']
    }
  },

  // 10: Kemi Thornton — QS, Manchester, graduate, 21 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 17 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'NOT YET ENOUGH EXPOSURE', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'ON TRACK', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'DEVELOPING', exposureConfirmation: 'not-assessed' }
      ],
      candidateSelectedPriority: 'Judgement, Help & Escalation',
      developmentPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    },
    phase3: {
      managerParticipated: false,
      managerSelectedFocusAreas: [],
      areaRelationships: [],
      michaelSynthesisPriorities: [{ area: 'Judgement, Help & Escalation', gapType: 'experience' }]
    }
  },

  // 11: Leo Sato — PM, London, apprentice, 26 months
  {
    schemaVersion: 'cohort-safe-v1',
    lastUpdatedAt: NOW - 5 * 86400000,
    benchmark: {
      areas: [
        { id: 'a1', name: 'Professional Behaviour & Responsibility', outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a2', name: 'Communication & Working With Others',     outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a3', name: 'Learning & Applying Knowledge',           outcome: 'DEVELOPING', exposureConfirmation: 'relevant-exposure-identified' },
        { id: 'a4', name: 'Judgement, Help & Escalation',            outcome: 'NOT YET ENOUGH EXPOSURE', exposureConfirmation: 'confirmed-lack-of-exposure' },
        { id: 'a5', name: 'Feedback, Reflection & Development',      outcome: 'SUPPORT WOULD HELP', exposureConfirmation: 'confirmed-lack-of-exposure' }
      ],
      candidateSelectedPriority: 'Feedback, Reflection & Development',
      developmentPriorities: [{ area: 'Feedback, Reflection & Development', gapType: 'practice' }]
    }
  }
];

// Session status — sessions 0, 1, 2, 7, 9 have Phase 4 data → 5 Phase 4 complete (State B threshold)
const SESSION_STATUSES = [
  'progress-complete',  // Alice — Phase 4 done
  'progress-complete',  // Ben — Phase 4 done
  'progress-complete',  // Carla — Phase 4 done
  'reflection-ready',   // Daniel — Phase 3 done, not yet in Phase 4
  'reflection-ready',   // Eve — Phase 3 done
  'summary-ready',      // Finn — Benchmark only
  'summary-ready',      // Grace — Benchmark only
  'progress-complete',  // Hugo — Phase 4 done
  'summary-ready',      // Isla — Benchmark only
  'progress-complete',  // James — Phase 4 done
  'reflection-ready',   // Kemi — Phase 3 (manager declined)
  'summary-ready'       // Leo — Benchmark only
];

const SESSION_META_EXTRAS = [
  { discipline: 'Quantity Surveying', team: 'London',     office: 'London',     employmentType: 'graduate',    monthsInRole: 18, candidateName: 'Alice Chen' },
  { discipline: 'Quantity Surveying', team: 'London',     office: 'London',     employmentType: 'graduate',    monthsInRole: 14, candidateName: 'Ben Osei' },
  { discipline: 'Project Management', team: 'Manchester', office: 'Manchester', employmentType: 'graduate',    monthsInRole: 22, candidateName: 'Carla Hughes' },
  { discipline: 'Project Management', team: 'Manchester', office: 'Manchester', employmentType: 'graduate',    monthsInRole: 16, candidateName: 'Daniel Park' },
  { discipline: 'Building Surveying', team: 'London',     office: 'London',     employmentType: 'graduate',    monthsInRole: 20, candidateName: 'Eve Patel' },
  { discipline: 'Building Surveying', team: 'Bristol',    office: 'Bristol',    employmentType: 'graduate',    monthsInRole: 12, candidateName: 'Finn Adeyemi' },
  { discipline: 'Commercial Real Estate', team: 'London', office: 'London',     employmentType: 'graduate',    monthsInRole: 19, candidateName: 'Grace Li' },
  { discipline: 'Commercial Real Estate', team: 'Manchester', office: 'Manchester', employmentType: 'apprentice', monthsInRole: 24, candidateName: 'Hugo Walsh' },
  { discipline: 'Valuation',          team: 'London',     office: 'London',     employmentType: 'graduate',    monthsInRole: 15, candidateName: 'Isla Fernandez' },
  { discipline: 'Valuation',          team: 'Bristol',    office: 'Bristol',    employmentType: 'graduate',    monthsInRole: 17, candidateName: 'James Okafor' },
  { discipline: 'Quantity Surveying', team: 'Manchester', office: 'Manchester', employmentType: 'graduate',    monthsInRole: 21, candidateName: 'Kemi Thornton' },
  { discipline: 'Project Management', team: 'London',     office: 'London',     employmentType: 'apprentice',  monthsInRole: 26, candidateName: 'Leo Sato' }
];

// ── Main ──────────────────────────────────────────────────────────────────────

const cohortId  = crypto.randomUUID();
const sessionIds = COHORT_SAFE_RECORDS.map(() => crypto.randomUUID());

console.log('\n═══════════════════════════════════════════════════');
console.log('  Fletcher & Partners LLP — Demo Cohort Seed');
console.log('═══════════════════════════════════════════════════\n');
console.log(`Cohort ID : ${cohortId}`);
console.log(`Sessions  : ${sessionIds.length}`);
console.log(`Employer  : ${EMPLOYER_EMAIL}`);
console.log(`Store     : ${SESSION_STORE} / ${COHORT_STORE}`);
console.log('');

// Write session records
for (let i = 0; i < COHORT_SAFE_RECORDS.length; i++) {
  const sessionId = sessionIds[i];
  const extras    = SESSION_META_EXTRAS[i];
  const safe      = COHORT_SAFE_RECORDS[i];
  const status    = SESSION_STATUSES[i];

  const meta = {
    schemaVersion: 'benchmark-v1',
    sessionId,
    cohortId,
    firmName: FIRM_NAME,
    candidateEmail: `candidate${i + 1}@fletcher-demo.com`,
    managerEmail:   `manager${i + 1}@fletcher-demo.com`,
    employerEmail:  EMPLOYER_EMAIL,
    candidateName:  extras.candidateName,
    team:           extras.team,
    office:         extras.office,
    employmentType: extras.employmentType,
    discipline:     extras.discipline,
    monthsInRole:   extras.monthsInRole,
    status,
    createdAt:          NOW - 45 * 86400000,
    candidateCompletedAt: safe.lastUpdatedAt
  };

  process.stdout.write(`  Writing session ${i + 1}/12 (${extras.candidateName})...`);
  await blobPut(SESSION_STORE, `${sessionId}/metadata`,    meta);
  await blobPut(SESSION_STORE, `${sessionId}/cohort-safe`, safe);
  console.log(' done');
}

// Write cohort store
process.stdout.write('\nWriting cohort index...');
await blobPut(COHORT_STORE, `${cohortId}/sessions`, sessionIds);

const existingIndex = await blobGet(COHORT_STORE, 'index') || [];
existingIndex.push({ cohortId, firmName: FIRM_NAME, employerContactEmail: EMPLOYER_EMAIL, status: 'active', createdAt: NOW });
await blobPut(COHORT_STORE, 'index', existingIndex);
console.log(' done');

// Generate employer token
const employerToken = signToken({
  cohortId,
  role: 'employer',
  email: EMPLOYER_EMAIL,
  expires: NOW + EMPLOYER_TOKEN_TTL
});

const dashboardUrl = `${SITE_URL}/cohort-dashboard?token=${employerToken}`;

console.log(`
═══════════════════════════════════════════════════
  Demo cohort ready
═══════════════════════════════════════════════════

  Firm:     ${FIRM_NAME}
  Sessions: ${sessionIds.length} (5 Phase 4 complete, 2 Phase 3 only, 5 Benchmark only)
  Eligible: 12 of 12 (all analytics-eligible)
  State A:  available — constraint-led summary expected (FR&D confirmed-lack >> relevant)
  State B:  available — 5 Phase 4 sessions (exactly at threshold; progress section will render)

  Dashboard URL:
  ${dashboardUrl}

  Analytics will trigger automatically when you open the dashboard.
  The page polls every few seconds — expect results within ~30 seconds.

  Employer token expires: ${new Date(NOW + EMPLOYER_TOKEN_TTL).toISOString().slice(0, 10)}
`);
