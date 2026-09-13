// netlify/functions/p1-taxonomy-test-background.js
// TEMPORARY — taxonomy v1 discrimination test runner. Delete after results captured.

const { getStore } = require('@netlify/blobs');
const { TAXONOMY_DEFINITIONS_BLOCK, TAXONOMY_REPORTING_PRINCIPLE, TAXONOMY_FINAL_ANALYSIS_QUESTIONS, GAP_TYPE_FAMILIES } = require('./utils/p1-taxonomy');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const TEST_TOKEN = 'taxonomy-test-cf02ea9';
const MODEL = 'claude-sonnet-4-6';

const FAMILY_LABELS = {
  'learning-practice':        'Learning & Practice',
  'workplace-exposure':       'Workplace Exposure',
  'recognition-articulation': 'Recognition & Articulation',
  'judgement-responsibility': 'Judgement & Responsibility',
  'confidence-calibration':   'Confidence Calibration',
};

function getTestStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-taxonomy-test`)
    : getStore({ name: `${PREFIX}p1-taxonomy-test`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

const SYSTEM_PROMPT = `You are Michael, producing a development synthesis for the GCAi Professional Readiness Benchmark.

You will receive a candidate's assessment data for one area. Analyse the evidence and classify the primary limiting factor using the taxonomy below, then produce a development priority with the appropriate recommended action.

${TAXONOMY_DEFINITIONS_BLOCK}

## Reporting language
${TAXONOMY_REPORTING_PRINCIPLE}

## Final analysis
${TAXONOMY_FINAL_ANALYSIS_QUESTIONS}

## Output schema
Return ONLY valid JSON. No markdown, no preamble.

{
  "areaName": "Feedback, Reflection & Development",
  "areaOutcome": "<outcome from the assessment>",
  "gapType": "<one of the ten gap types>",
  "gapTypeRationale": "<specific reasoning — what in the evidence determined this type and not another>",
  "developmentPrioritiesForDiscussion": [
    {
      "rank": 1,
      "priority": "<specific, stage-appropriate development priority>",
      "rationale": "<grounded in the evidence provided>",
      "gapType": "<same as above>",
      "whatProgressMightLookLike": "<one observable, stage-appropriate sentence>",
      "managerAction": "<concrete action the manager or employer can take>"
    }
  ],
  "candidateFacingDevelopmentSummary": "<2-3 sentence plain-language summary for the candidate — no raw taxonomy labels>",
  "employerFacingSummary": "<2-3 sentence summary for the employer — describes the nature of the development need and what kind of support would help>"
}`;

// Session A — capability / learning need
// Has had regular structured feedback opportunities throughout role.
// Understanding is weak; cannot articulate what changed or how feedback was applied.
// Expected: gapType = knowledge or application → family = learning-practice
const SESSION_A_MESSAGE = `## Candidate assessment data

Discipline: Building Surveying
Months in current role: 14
Area: Feedback, Reflection & Development
Area outcome: DEVELOPING

## Candidate's responses (paraphrased from Michael's diagnostic session)

The candidate has had regular quarterly one-to-one meetings with their line manager throughout their 14 months. They have received specific written feedback on technical reports, client communication, and site visit notes. Their office runs structured quarterly reviews and the candidate has a named mentor who they meet monthly.

When asked what they have learned from feedback received, the candidate gave vague responses: "I try to take on board what I'm told" and "I know I need to get better at my reports." When asked to describe one specific thing that feedback has changed about how they work, they could not give a concrete example. They showed limited awareness of why structured reflection on feedback is a professional development practice rather than a performance management tool. When Michael asked them to explain how they would use feedback to identify a pattern in their development, the candidate could not articulate a process.

## Manager's assessment

Manager confirms the candidate receives regular structured feedback, has quarterly reviews, a mentor, and clear written development points after each piece of work.

Manager notes: "They receive the feedback fine, but I'm not sure it actually changes how they approach the next task. They don't seem to connect what they've been told with how they work differently afterwards. The conversations happen but I don't think they're translating into deliberate changes."

## Exposure confirmation
relevant-exposure-identified — candidate has had regular structured feedback opportunities throughout their role`;

// Session B — opportunity / exposure need
// Has not had structured feedback opportunities due to role context.
// Understanding is clear and well-articulated; explicitly states lack of opportunity.
// Expected: gapType = exposure → family = workplace-exposure
const SESSION_B_MESSAGE = `## Candidate assessment data

Discipline: Building Surveying
Months in current role: 14
Area: Feedback, Reflection & Development
Area outcome: DEVELOPING

## Candidate's responses (paraphrased from Michael's diagnostic session)

The candidate works on a small, primarily solo project under a senior surveyor who is frequently off-site. There are no formal review processes, no structured one-to-ones, and feedback is given informally and infrequently — described as "when something goes wrong."

When asked what effective feedback looks like, the candidate gave a clear, structured response: "Good feedback should be specific, timely, and tied to something I can actually change. It should help me understand not just what went wrong but why, and what I should do differently." When asked how they would use feedback to develop professionally, they described a deliberate reflection process: noting the feedback, identifying the underlying principle, and applying it consciously to the next similar task. They articulated clearly why this matters for APC development and could describe what a productive development conversation would look like. When Michael checked their understanding further, their answers held up under follow-up questions.

They stated explicitly: "I know what I should be doing with feedback — I just haven't had much of it to work with."

## Manager's assessment

Manager confirms: "We're a small team and I'm on-site most of the time. There aren't formal review structures — I give feedback when I notice something but it's not regular or structured. [Candidate] works quite independently and I don't have a strong view of how they respond to feedback because it doesn't come up much."

## Exposure confirmation
confirmed-lack-of-exposure — candidate has not had regular structured feedback conversations or formal review processes in this role`;

async function callClaude(apiKey, userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

function parseJSON(text) {
  try { return JSON.parse(text.trim()); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return { _parseError: true, _raw: text };
}

function buildSessionResult(label, expected, raw) {
  const parsed = parseJSON(raw);
  const gapType = parsed.gapType || parsed.developmentPrioritiesForDiscussion?.[0]?.gapType || null;
  const familyKey = gapType ? (GAP_TYPE_FAMILIES[gapType] || 'unknown') : 'unknown';
  const reportingFamily = FAMILY_LABELS[familyKey] || familyKey;
  return { label, expected, gapType, reportingFamily, rawJSON: parsed };
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { runId, testToken } = body;
  if (testToken !== TEST_TOKEN || !runId) { console.error('[p1-taxonomy-test-background] Unauthorized or missing runId'); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[p1-taxonomy-test-background] ANTHROPIC_API_KEY not set');
    const store = getTestStore();
    await store.setJSON(`run/${runId}`, { status: 'failed', error: 'ANTHROPIC_API_KEY not set', runId }).catch(() => {});
    return;
  }

  const store = getTestStore();

  try {
    console.log(`[p1-taxonomy-test-background] Running discrimination test runId=${runId}`);
    const [rawA, rawB] = await Promise.all([
      callClaude(apiKey, SESSION_A_MESSAGE),
      callClaude(apiKey, SESSION_B_MESSAGE)
    ]);

    const sessionA = buildSessionResult(
      'Session A — Capability / Learning Need',
      { gapType: 'knowledge or application', family: 'Learning & Practice' },
      rawA
    );
    const sessionB = buildSessionResult(
      'Session B — Opportunity / Exposure Need',
      { gapType: 'exposure', family: 'Workplace Exposure' },
      rawB
    );

    const gapTypesDiffer = sessionA.gapType !== sessionB.gapType;
    const familiesDiffer = sessionA.reportingFamily !== sessionB.reportingFamily;
    const pass = gapTypesDiffer && familiesDiffer;

    await store.setJSON(`run/${runId}`, {
      status: 'complete',
      runId,
      completedAt: Date.now(),
      sessionA,
      sessionB,
      comparison: { gapTypesDiffer, familiesDiffer, pass }
    });

    console.log(`[p1-taxonomy-test-background] Complete. Pass=${pass} A=${sessionA.gapType} B=${sessionB.gapType}`);
  } catch (err) {
    console.error('[p1-taxonomy-test-background] Error:', err.message);
    await store.setJSON(`run/${runId}`, { status: 'failed', error: err.message, runId }).catch(() => {});
  }
};
