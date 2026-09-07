// netlify/functions/p1-candidate-synthesis-background.js
// Background Function — candidate-only synthesis for manager-lapsed sessions.
// POST { sessionId, internalSecret, runToken }
// Requires status === 'manager-lapsed'. Status remains 'manager-lapsed' throughout.
// Writes to {sessionId}/synthesis with candidateOnly: true.
// No manager input, no alignment/divergence analysis.

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const CANDIDATE_ONLY_SYSTEM = `You are Michael, producing a Candidate Development Summary for the GCAi Professional Readiness Benchmark.

## Situation
This candidate's manager did not contribute to the Benchmark. You are producing a development summary from the candidate's own assessment only. The candidate will use this to set their own development priorities.

## Governing calibration rules
- NOT YET ENOUGH EXPOSURE is not a weakness. It means the individual has not had sufficient opportunity to demonstrate this area. Never reframe it as a development gap unless the assessment specifically identifies a capability issue.
- Lack of exposure is not lack of capability.
- Account for stage: use the discipline and months-in-role context provided. What is reasonable at 8 months differs from what is reasonable at 20 months.
- Do not flatten strengths because another area needs development.

## Privacy boundary
Do not include direct or paraphrased quotes from the candidate's responses, specific anecdotes in identifiable form, or the candidate's own words. You may include thematic observations and development priorities drawn from the assessment.

## What you must NOT produce
- An alignment or divergence analysis (there is no manager perspective)
- An alignmentSummary comparing two sources
- Manager actions or manager-facing content
- Any invented or implied manager perspective
- Any comparison language ("your manager thinks...", "compared with your manager's view...")
- managerPerspectiveThemes
- areaRelationships
- conversationTopics (these are for the manager-candidate conversation; not applicable here)

## Output schema
Return ONLY valid JSON matching this structure exactly. No markdown, no preamble, no trailing text.

{
  "schemaVersion": "benchmark-v1",
  "candidateOnly": true,
  "benchmarkContext": {
    "discipline": "<from session context>",
    "monthsInRole": 0,
    "benchmarkDate": "<ISO date YYYY-MM-DD of candidate Benchmark completion>"
  },
  "candidateSelectedPriority": "<the area the candidate chose — pass through unchanged>",
  "michaelDiagnosedPriorities": [
    {
      "rank": 1,
      "priority": "<string>",
      "why": "<string>"
    }
  ],
  "developmentPrioritiesForConsideration": [
    {
      "rank": 1,
      "priority": "<specific, stage-appropriate development priority for the candidate to consider>",
      "rationale": "<grounded in evidence from the candidate's own assessment>",
      "gapType": "<knowledge|practice|experience|exposure|evidence-recognition|articulation>",
      "whatProgressMightLookLike": "<one sentence — observable, developmental, stage-appropriate; not a KPI or appraisal target>"
    }
  ],
  "selfReflectionPrompts": [
    "<a question for the candidate to reflect on as they set their own development priorities>"
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
  const jobKey = `${sessionId}/jobs/candidate-synthesis`;

  try {
    const existingJob = await sessionStore.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    await sessionStore.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    const [managerSafeData, meta] = await Promise.all([
      sessionStore.get(`${sessionId}/manager-safe`, { type: 'json' }),
      sessionStore.get(`${sessionId}/metadata`, { type: 'json' })
    ]);

    if (!managerSafeData?.managerSafe || !meta) {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'missing_data', failedAt: Date.now() });
      return;
    }

    if (meta.status !== 'manager-lapsed') {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'invalid_status', failedAt: Date.now() });
      return;
    }

    const { managerSafe } = managerSafeData;

    const benchmarkDate = meta.candidateCompletedAt
      ? new Date(meta.candidateCompletedAt).toISOString().slice(0, 10)
      : '(unknown)';
    const diagnosedPriorities = (managerSafe.sharedDevelopmentPriorities || [])
      .map(p => `${p.rank}. ${p.priority}${p.why ? ` — ${p.why}` : ''}`)
      .join('\n') || '(none recorded)';

    const userPrompt = `Generate the Candidate Development Summary from the following inputs.

## Session context
Discipline: ${meta.discipline || '(not recorded)'}
Months in role: ${meta.monthsInRole ?? '(not recorded)'}
Benchmark date: ${benchmarkDate}
Candidate's selected priority area: ${meta.candidateSelectedPriority || '(not recorded)'}

## Candidate Assessment Summary

Area outcomes:
${(managerSafe.areaStatuses || []).map(a => `- ${a.name}: ${a.outcome}`).join('\n')}

Development themes:
${(managerSafe.developmentThemes || []).map(t => `- ${t}`).join('\n')}

Michael's diagnosed priorities:
${diagnosedPriorities}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: CANDIDATE_ONLY_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[p1-candidate-synthesis-bg] Anthropic error:', data);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'ai_error', failedAt: Date.now() });
      return;
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let synthesis;
    try { synthesis = JSON.parse(clean); }
    catch (e) {
      console.error('[p1-candidate-synthesis-bg] JSON parse error:', e.message);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'parse_error', failedAt: Date.now() });
      return;
    }

    const now = Date.now();
    await sessionStore.setJSON(`${sessionId}/synthesis`, {
      schemaVersion: 'benchmark-v1',
      synthesis,
      savedAt: now
    });

    await sessionStore.setJSON(jobKey, { status: 'complete', runToken, completedAt: now });
    console.log(`[p1-candidate-synthesis-bg] Candidate-only synthesis complete for session ${sessionId}`);

  } catch (err) {
    console.error('[p1-candidate-synthesis-bg] Unexpected error:', err.message);
    try {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
    } catch { /* ignore */ }
  }
};
