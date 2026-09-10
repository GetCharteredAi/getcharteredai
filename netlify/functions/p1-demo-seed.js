// netlify/functions/p1-demo-seed.js
// ONE-SHOT DEMO SEED — DELETE THIS FILE IMMEDIATELY AFTER USE.
// Creates a 12-person Fletcher & Partners LLP demo cohort in Netlify Blobs
// using the server-side JWT_SECRET and NETLIFY_BLOBS_CONTEXT (no client secrets).
//
// POST { "confirm": "fletcher-demo-run-2026" }
// Returns { "dashboardUrl": "https://..." }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const PREFIX   = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const SITE_URL = process.env.P1_SITE_URL || process.env.URL || 'https://getcharteredai.com';

const CONFIRM_TOKEN = 'fletcher-demo-run-2026';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig  = crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// ── Demo data (mirrors scripts/seed-demo-cohort.mjs) ─────────────────────────

const FIRM_NAME      = 'Fletcher & Partners LLP';
const EMPLOYER_EMAIL = 'demo@getcharteredai.com';
const EMPLOYER_TTL   = 365 * 24 * 60 * 60 * 1000;

const NOW = Date.now();

const COHORT_SAFE_RECORDS = [
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 15*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'DEVELOPING',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'}
    ], candidateSelectedPriority:'Feedback, Reflection & Development',
       developmentPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Feedback, Reflection & Development'],areaRelationships:[{area:'Feedback, Reflection & Development',relationshipType:'aligned'}],michaelSynthesisPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]},
    phase4:{progressManagerParticipated:true,progressJudgements:[{rank:1,progressJudgement:'Progress evident',graduated:false,area:'Feedback, Reflection & Development'}],proposedPriorityAreas:['Judgement, Help & Escalation']}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 20*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'DEVELOPING',exposureConfirmation:'not-assessed'}
    ], candidateSelectedPriority:'Judgement, Help & Escalation',
       developmentPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Judgement, Help & Escalation'],areaRelationships:[{area:'Judgement, Help & Escalation',relationshipType:'aligned'}],michaelSynthesisPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]},
    phase4:{progressManagerParticipated:false,progressJudgements:[{rank:1,progressJudgement:'Some progress',graduated:false,area:'Judgement, Help & Escalation'}],proposedPriorityAreas:['Judgement, Help & Escalation']}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 10*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'}
    ], candidateSelectedPriority:'Feedback, Reflection & Development',
       developmentPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Feedback, Reflection & Development'],areaRelationships:[{area:'Feedback, Reflection & Development',relationshipType:'aligned'}],michaelSynthesisPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]},
    phase4:{progressManagerParticipated:true,progressJudgements:[{rank:1,progressJudgement:'Progress evident',graduated:true,area:'Feedback, Reflection & Development'}],proposedPriorityAreas:['Learning & Applying Knowledge']}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 25*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'DEVELOPING',exposureConfirmation:'not-assessed'}
    ], candidateSelectedPriority:'Communication & Working With Others',
       developmentPriorities:[{area:'Communication & Working With Others',gapType:'knowledge'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Communication & Working With Others'],areaRelationships:[{area:'Communication & Working With Others',relationshipType:'aligned'}],michaelSynthesisPriorities:[{area:'Communication & Working With Others',gapType:'knowledge'}]}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 12*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'}
    ], candidateSelectedPriority:'Feedback, Reflection & Development',
       developmentPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Feedback, Reflection & Development'],areaRelationships:[{area:'Feedback, Reflection & Development',relationshipType:'aligned'}],michaelSynthesisPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 30*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'NOT YET ENOUGH EXPOSURE',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'}
    ], candidateSelectedPriority:'Judgement, Help & Escalation',
       developmentPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 18*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'NOT YET ENOUGH EXPOSURE',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'}
    ], candidateSelectedPriority:'Communication & Working With Others',
       developmentPriorities:[{area:'Communication & Working With Others',gapType:'practice'}]}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 8*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'}
    ], candidateSelectedPriority:'Judgement, Help & Escalation',
       developmentPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Judgement, Help & Escalation','Communication & Working With Others'],areaRelationships:[{area:'Judgement, Help & Escalation',relationshipType:'aligned'}],michaelSynthesisPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]},
    phase4:{progressManagerParticipated:true,progressJudgements:[{rank:1,progressJudgement:'Some progress',graduated:false,area:'Judgement, Help & Escalation'}],proposedPriorityAreas:['Judgement, Help & Escalation']}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 22*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'}
    ], candidateSelectedPriority:'Feedback, Reflection & Development',
       developmentPriorities:[{area:'Feedback, Reflection & Development',gapType:'knowledge'}]}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 14*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'DEVELOPING',exposureConfirmation:'not-assessed'}
    ], candidateSelectedPriority:'Communication & Working With Others',
       developmentPriorities:[{area:'Communication & Working With Others',gapType:'practice'}]},
    phase3:{managerParticipated:true,managerSelectedFocusAreas:['Communication & Working With Others','Feedback, Reflection & Development'],areaRelationships:[{area:'Communication & Working With Others',relationshipType:'aligned'},{area:'Feedback, Reflection & Development',relationshipType:'genuine-divergence'}],michaelSynthesisPriorities:[{area:'Communication & Working With Others',gapType:'practice'}]},
    phase4:{progressManagerParticipated:false,progressJudgements:[{rank:1,progressJudgement:'Limited evidence of progress',graduated:false,area:'Communication & Working With Others'}],proposedPriorityAreas:['Communication & Working With Others','Judgement, Help & Escalation']}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 17*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a2',name:'Communication & Working With Others',outcome:'NOT YET ENOUGH EXPOSURE',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'ON TRACK',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'DEVELOPING',exposureConfirmation:'not-assessed'}
    ], candidateSelectedPriority:'Judgement, Help & Escalation',
       developmentPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]},
    phase3:{managerParticipated:false,managerSelectedFocusAreas:[],areaRelationships:[],michaelSynthesisPriorities:[{area:'Judgement, Help & Escalation',gapType:'experience'}]}
  },
  { schemaVersion:'cohort-safe-v1', lastUpdatedAt: NOW - 5*86400000,
    benchmark:{ areas:[
      {id:'a1',name:'Professional Behaviour & Responsibility',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a2',name:'Communication & Working With Others',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a3',name:'Learning & Applying Knowledge',outcome:'DEVELOPING',exposureConfirmation:'relevant-exposure-identified'},
      {id:'a4',name:'Judgement, Help & Escalation',outcome:'NOT YET ENOUGH EXPOSURE',exposureConfirmation:'confirmed-lack-of-exposure'},
      {id:'a5',name:'Feedback, Reflection & Development',outcome:'SUPPORT WOULD HELP',exposureConfirmation:'confirmed-lack-of-exposure'}
    ], candidateSelectedPriority:'Feedback, Reflection & Development',
       developmentPriorities:[{area:'Feedback, Reflection & Development',gapType:'practice'}]}
  }
];

const SESSION_STATUSES = [
  'progress-complete','progress-complete','progress-complete',
  'reflection-ready','reflection-ready',
  'summary-ready','summary-ready',
  'progress-complete',
  'summary-ready',
  'progress-complete',
  'reflection-ready','summary-ready'
];

const SESSION_META = [
  {discipline:'Quantity Surveying',team:'London',office:'London',employmentType:'graduate',monthsInRole:18},
  {discipline:'Quantity Surveying',team:'London',office:'London',employmentType:'graduate',monthsInRole:14},
  {discipline:'Project Management',team:'Manchester',office:'Manchester',employmentType:'graduate',monthsInRole:22},
  {discipline:'Project Management',team:'Manchester',office:'Manchester',employmentType:'graduate',monthsInRole:16},
  {discipline:'Building Surveying',team:'London',office:'London',employmentType:'graduate',monthsInRole:20},
  {discipline:'Building Surveying',team:'Bristol',office:'Bristol',employmentType:'graduate',monthsInRole:12},
  {discipline:'Commercial Real Estate',team:'London',office:'London',employmentType:'graduate',monthsInRole:19},
  {discipline:'Commercial Real Estate',team:'Manchester',office:'Manchester',employmentType:'apprentice',monthsInRole:24},
  {discipline:'Valuation',team:'London',office:'London',employmentType:'graduate',monthsInRole:15},
  {discipline:'Valuation',team:'Bristol',office:'Bristol',employmentType:'graduate',monthsInRole:17},
  {discipline:'Quantity Surveying',team:'Manchester',office:'Manchester',employmentType:'graduate',monthsInRole:21},
  {discipline:'Project Management',team:'London',office:'London',employmentType:'apprentice',monthsInRole:26}
];

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (body.confirm !== CONFIRM_TOKEN) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Missing or incorrect confirm token' }) };
  }

  if (!process.env.JWT_SECRET) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'JWT_SECRET not configured' }) };
  }

  try {
    const sessionStore = getSessionStore();
    const cohortStore  = getCohortStore();

    const cohortId   = crypto.randomUUID();
    const sessionIds = COHORT_SAFE_RECORDS.map(() => crypto.randomUUID());

    // Write all 12 sessions in parallel
    await Promise.all(sessionIds.map(async (sessionId, i) => {
      const m = SESSION_META[i];
      const meta = {
        schemaVersion: 'benchmark-v1',
        sessionId, cohortId,
        firmName: FIRM_NAME,
        candidateEmail: `candidate${i+1}@fletcher-demo.com`,
        managerEmail:   `manager${i+1}@fletcher-demo.com`,
        employerEmail:  EMPLOYER_EMAIL,
        team: m.team, office: m.office,
        employmentType: m.employmentType,
        discipline: m.discipline,
        monthsInRole: m.monthsInRole,
        status: SESSION_STATUSES[i],
        createdAt: NOW - 45*86400000,
        candidateCompletedAt: COHORT_SAFE_RECORDS[i].lastUpdatedAt
      };
      await Promise.all([
        sessionStore.setJSON(`${sessionId}/metadata`,    meta),
        sessionStore.setJSON(`${sessionId}/cohort-safe`, COHORT_SAFE_RECORDS[i])
      ]);
    }));

    // Write cohort index
    await cohortStore.setJSON(`${cohortId}/sessions`, sessionIds);
    const existingIndex = await cohortStore.get('index', { type: 'json' }) || [];
    existingIndex.push({ cohortId, firmName: FIRM_NAME, employerContactEmail: EMPLOYER_EMAIL, status: 'active', createdAt: NOW });
    await cohortStore.setJSON('index', existingIndex);

    // Generate employer token
    const token = signToken({ cohortId, role: 'employer', email: EMPLOYER_EMAIL, expires: NOW + EMPLOYER_TTL });
    const dashboardUrl = `${SITE_URL}/cohort-dashboard?token=${token}`;

    console.log(`[p1-demo-seed] Cohort ${cohortId} created for ${FIRM_NAME}`);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, cohortId, dashboardUrl })
    };

  } catch (err) {
    console.error('[p1-demo-seed] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
