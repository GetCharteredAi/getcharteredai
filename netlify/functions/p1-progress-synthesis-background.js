// netlify/functions/p1-progress-synthesis-background.js
// Background function. Internal secret gate.
// Reads priorities-history[0] for prior agreed priorities (written at candidate submission).
// Reads progress-responses (P1–P5) and progress-manager-responses (PM1–PM3, if present).
// Produces Professional Readiness Progress Review at {sessionId}/progress-review.
// Status: progress-synthesising | progress-manager-lapsed → progress-ready.
// POST { sessionId, internalSecret, runToken }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const PROGRESS_SYSTEM = `You are Michael, producing a Professional Readiness Progress Review for the GCAi Professional Readiness Benchmark.

## Task
Compare the individual's prior agreed development priorities against evidence of progress from:
1. The individual's five-question progress reflection (always present)
2. The manager's three-question reflection (present only if the manager responded)

## Progress judgement labels
For each prior priority, apply exactly one of these four labels:
- Progress evident: evidence shows clear development and practice against this priority
- Some progress: partial evidence of effort or change, but development is incomplete
- Limited evidence of progress: little or no evidence of meaningful change against this priority
- Priority should be reconsidered: evidence suggests this priority no longer fits, or was the wrong focus

## Priority graduation
A priority may "graduate out" — if evidence shows it has progressed sufficiently to warrant a more advanced or different focus, set graduated: true. The corresponding slot in proposedPriorities must contain a more advanced development focus appropriate to the individual's current stage. Graduation requires strong evidence of sustained progress, not a single example.

## Governing principles
- Lack of evidence is not lack of progress. If the individual did not get the opportunity, acknowledge that rather than judging capability.
- Manager silence is not disagreement, poor performance, or evidence against the individual.
- Do not make alignment, divergence, or comparison claims without actual manager evidence.
- Do not use appraisal or performance-management language. Never say someone has failed, is behind, or is underperforming.
- proposedPriorities are Michael's recommendation only. They are not canonical until confirmed by the candidate. Do not state them as final.
- Lack of exposure is not lack of capability.
- Do not invent manager observations from silence.

## Absent or thin manager evidence
If no manager evidence is present or all manager responses are blank, set candidateOnly: true.
managerPerspective for each progressAgainstPriorities item must be null.
Do not infer themes, alignment, or observations from manager silence.

## Output schema
Return ONLY valid JSON. No markdown. No preamble. No trailing text.

{
  "schemaVersion": "progress-v1",
  "candidateOnly": false,
  "sinceBenchmark": "<2–3 sentence narrative: what has changed since priorities were agreed — grounded only in evidence provided. Do not reference the manager if candidateOnly.>",
  "progressAgainstPriorities": [
    {
      "rank": 1,
      "priority": "<original priority — pass through unchanged>",
      "evidenceOfChange": "<thematic summary of what the evidence shows — no direct quotes>",
      "progressJudgement": "Progress evident | Some progress | Limited evidence of progress | Priority should be reconsidered",
      "managerPerspective": null,
      "graduated": false,
      "nextStep": "<one concrete, stage-appropriate next step>"
    }
  ],
  "whatIsWorking": ["<behaviour or development activity worth continuing — grounded in evidence>"],
  "whatStillNeedsAttention": ["<where progress is limited, evidence is weak, or opportunity is missing>"],
  "proposedPriorities": [
    {
      "rank": 1,
      "priority": "<proposed priority text>",
      "why": "<rationale grounded in evidence — specific to this individual>",
      "continuedFrom": "<original priority text if kept or refined — null if wholly new>",
      "graduatedFrom": "<original priority text if this slot was freed by graduation — null otherwise>"
    }
  ]
}`;

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { sessionId, internalSecret, runToken } = body;
  if (!internalSecret || internalSecret !== process.env.P1_INTERNAL_SECRET) return;
  if (!sessionId) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const sessionStore = getSessionStore();
  const jobKey = `${sessionId}/jobs/progress-synthesis`;

  try {
    const existingJob = await sessionStore.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    await sessionStore.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    const [meta, candidateResponses, managerResponses, prioritiesHistory] = await Promise.all([
      sessionStore.get(`${sessionId}/metadata`, { type: 'json' }),
      sessionStore.get(`${sessionId}/progress-responses`, { type: 'json' }),
      sessionStore.get(`${sessionId}/progress-manager-responses`, { type: 'json' }),
      sessionStore.get(`${sessionId}/priorities-history`, { type: 'json' })
    ]);

    if (!meta || !candidateResponses?.responses) {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'missing_data', failedAt: Date.now() });
      return;
    }

    const VALID_STATUSES = ['progress-synthesising', 'progress-manager-lapsed'];
    if (!VALID_STATUSES.includes(meta.status)) {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'invalid_status', failedAt: Date.now() });
      return;
    }

    // Prior priorities must come from priorities-history (written at candidate submission)
    const priorPlan = (prioritiesHistory || [])[0];
    if (!priorPlan?.agreedPriorities?.length) {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'missing_prior_priorities', failedAt: Date.now() });
      return;
    }

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'progress-synthesising',
      progressSynthesisStartedAt: meta.progressSynthesisStartedAt || Date.now()
    });

    const { responses: cr } = candidateResponses;
    const mr = managerResponses?.responses;
    const candidateOnly = !mr || Object.values(mr).every(v => !v?.trim());

    const prioritiesText = priorPlan.agreedPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const agreedByLabel = priorPlan.agreedBy === 'manager-candidate'
      ? 'agreed jointly by manager and individual'
      : 'set by the individual (manager-lapsed route)';

    const managerSection = candidateOnly
      ? `(Manager did not respond. Set candidateOnly: true. Set managerPerspective to null for all items. Do not infer any manager view from silence.)`
      : `PM1. What progress have you noticed since the last review?
${mr.PM1 || '(no response provided)'}

PM2. Where does the individual still need support, exposure or experience?
${mr.PM2 || '(no response provided)'}

PM3. Should the current priorities continue, change or be replaced?
${mr.PM3 || '(no response provided)'}`;

    const userPrompt = `Generate the Professional Readiness Progress Review from the following inputs.

## Session context
Discipline: ${meta.discipline || '(not recorded)'}
Months in role: ${meta.monthsInRole ?? '(not recorded)'}
Priorities review date: ${priorPlan.reviewDate || '(not recorded)'}
Priorities ${agreedByLabel}

## Prior agreed development priorities
${prioritiesText}

## Individual's Progress Reflection

P1. Which agreed priority have you made the most progress on?
${cr.P1 || '(no response)'}

P2. What have you done differently since the last review?
${cr.P2 || '(no response)'}

P3. Give one recent example that shows that progress.
${cr.P3 || '(no response)'}

P4. Which priority still feels hardest or least developed?
${cr.P4 || '(no response)'}

P5. What support, experience or exposure would help you move forward?
${cr.P5 || '(no response)'}

## Manager's Progress Reflection
${managerSection}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: PROGRESS_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[p1-progress-synthesis-bg] Anthropic error:', data);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'ai_error', failedAt: Date.now() });
      return;
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let review;
    try { review = JSON.parse(clean); }
    catch (e) {
      console.error('[p1-progress-synthesis-bg] JSON parse error:', e.message);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'parse_error', failedAt: Date.now() });
      return;
    }

    const now = Date.now();
    await sessionStore.setJSON(`${sessionId}/progress-review`, {
      schemaVersion: 'progress-v1',
      review,
      candidateOnly: !!review.candidateOnly,
      savedAt: now
    });

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'progress-ready',
      progressSynthesisCompletedAt: now
    });

    await sessionStore.setJSON(jobKey, { status: 'complete', runToken, completedAt: now });
    console.log(`[p1-progress-synthesis-bg] Progress review complete for session ${sessionId}`);

  } catch (err) {
    console.error('[p1-progress-synthesis-bg] Unexpected error:', err.message);
    try {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
    } catch { /* ignore */ }
  }
};
