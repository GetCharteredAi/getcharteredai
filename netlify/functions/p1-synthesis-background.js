// netlify/functions/p1-synthesis-background.js
// Background Function — combines candidate self-assessment (from manager-safe) with
// manager's M1–M7 responses to produce a synthesis stored at {sessionId}/synthesis.
// Status advances to summary-ready on completion.
// Triggered by p1-manager-submit via fire-and-forget fetch.
// POST { sessionId, internalSecret }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const SYNTHESIS_SYSTEM = `You are Michael, producing a Professional Readiness Synthesis for the GCAi Professional Readiness Benchmark.

## Task
Synthesise two evidence sources into a development summary for a structured manager–candidate development conversation:
1. A Manager Development Summary — produced from the candidate's self-assessment (area outcomes, development themes, and Michael's diagnosed priorities; no candidate quotes or private reasoning)
2. A manager's M1–M7 reflections — seven open questions the manager answered about the candidate

## Governing calibration rules
- NOT YET ENOUGH EXPOSURE is not a weakness. It means the individual has not had sufficient opportunity to demonstrate this area. Never reframe it as a development gap unless the manager's evidence independently and specifically identifies a capability issue.
- Lack of exposure is not lack of capability.
- Judge evidence, not silence. A manager who does not comment on an area has not disagreed with the assessment.
- Account for stage: use the discipline and months-in-role context provided. What is reasonable at 8 months differs from what is reasonable at 20 months.
- Do not flatten strengths because another area needs development.

## Manager question mapping
M1 provides broad strengths evidence — draw on it across any relevant area.
M7 provides cross-cutting development and support evidence — draw on it across any relevant area.
M2–M6 each broadly illuminate one of the five Benchmark areas, but you may draw on any answer across any area. Do not treat question numbers as rigid area assignments.

## Area outcome definitions
Each of the five Benchmark areas carries one of four outcomes from the candidate's self-assessment:
- ON TRACK — evidence indicates appropriate progress for this stage
- DEVELOPING — capability is emerging; further practice, experience or development is needed
- SUPPORT WOULD HELP — a meaningful gap requires action; proactive support recommended
- NOT YET ENOUGH EXPOSURE — the candidate has not had sufficient opportunity; capability cannot be assessed. Lack of exposure is not lack of capability. NOT YET ENOUGH EXPOSURE is not a default fallback — it requires a positive finding that opportunity was genuinely absent.

## Area relationship types
For each of the five Benchmark areas, assign exactly one relationship type:
- aligned: both sources suggest a consistent picture of this area
- genuine-divergence: manager describes behaviour meaningfully inconsistent with the area outcome — a real difference worth a conversation
- manager-no-evidence: manager provided no relevant evidence for this area; this is not disagreement and must not be surfaced as such
- exposure-alignment: area shows NOT YET ENOUGH EXPOSURE and manager confirms the individual has not had the relevant opportunity — the perspectives agree

Only genuine-divergence produces a conversation prompt. For aligned, manager-no-evidence and exposure-alignment, return conversationPrompt: null.

## Absent or thin manager evidence
managerPerspectiveThemes: If manager evidence is absent across all questions, return an empty array. If manager evidence is very thin, include only themes directly supported by what the manager actually provided. Do not infer or fabricate a manager perspective from silence.
alignmentSummary: If manager evidence is absent, write a neutral, developmental opening that explains the summary is based on the individual's benchmark self-assessment and Michael's diagnostic analysis, that manager input was not provided in this reflection so no direct comparison between perspectives can be made at this stage, and that the summary therefore focuses on the evidence available from the individual's responses while manager input can add useful workplace context to the development conversation. Do not frame the absence of manager input as a problem, a gap, or a failure. If manager evidence is thin, limit the summary to the areas where comparison is genuinely supported by what the manager provided.

## Privacy boundary
Do not include direct or paraphrased quotes from either source, specific anecdotes in identifiable form, or either party's own words. You may include thematic observations, relationship classifications, development priorities, and conversation prompts drawn from both sources.

## Output schema
Return ONLY valid JSON matching this structure exactly. No markdown, no preamble, no trailing text.

{
  "schemaVersion": "benchmark-v1",
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
      "why": "<string>",
      "managerRole": "<what the manager can do to support this>"
    }
  ],
  "managerPerspectiveThemes": [
    "<thematic observation drawn from manager M1–M7 evidence — no direct quotes>"
  ],
  "areaRelationships": [
    {
      "area": "<area name>",
      "relationshipType": "<aligned|genuine-divergence|manager-no-evidence|exposure-alignment>",
      "observation": "<what this relationship means for the individual's development>",
      "conversationPrompt": null
    }
  ],
  "developmentPrioritiesForDiscussion": [
    {
      "rank": 1,
      "priority": "<specific, stage-appropriate development priority>",
      "rationale": "<grounded in evidence from both sources>",
      "gapType": "<knowledge|practice|experience|exposure|evidence-recognition|articulation>",
      "whatProgressMightLookLike": "<one sentence — observable, developmental, stage-appropriate; not a KPI or appraisal target>",
      "managerAction": "<concrete action the manager can take to support this priority>"
    }
  ],
  "alignmentSummary": "<2–3 sentence narrative: where perspectives are consistent and where they differ — no quotes from either source>",
  "conversationTopics": [
    "<suggested discussion topic for the manager–candidate development conversation>"
  ]
}

For genuine-divergence entries in areaRelationships, replace the null conversationPrompt with a string — a suggested opener for a development conversation about that area. For all other relationship types, conversationPrompt remains null.`;

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
  const jobKey = `${sessionId}/jobs/synthesis`;

  try {
    const existingJob = await sessionStore.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    await sessionStore.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    const [managerSafeData, managerResponsesData, meta] = await Promise.all([
      sessionStore.get(`${sessionId}/manager-safe`, { type: 'json' }),
      sessionStore.get(`${sessionId}/manager-responses`, { type: 'json' }),
      sessionStore.get(`${sessionId}/metadata`, { type: 'json' })
    ]);

    if (!managerSafeData?.managerSafe || !managerResponsesData?.responses || !meta) {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'missing_data', failedAt: Date.now() });
      if (meta) await sessionStore.setJSON(`${sessionId}/metadata`, { ...meta, status: 'manager-complete' });
      return;
    }

    if (meta.status !== 'manager-complete') {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'invalid_status', failedAt: Date.now() });
      return;
    }

    const { managerSafe } = managerSafeData;
    const { responses } = managerResponsesData;

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'synthesising',
      synthesisStartedAt: Date.now()
    });

    const benchmarkDate = meta.candidateCompletedAt
      ? new Date(meta.candidateCompletedAt).toISOString().slice(0, 10)
      : '(unknown)';
    const diagnosedPriorities = (managerSafe.sharedDevelopmentPriorities || [])
      .map(p => `${p.rank}. ${p.priority}${p.why ? ` — ${p.why}` : ''}`)
      .join('\n') || '(none recorded)';

    const userPrompt = `Generate the Professional Readiness Synthesis from the following inputs.

## Session context
Discipline: ${meta.discipline || '(not recorded)'}
Months in role: ${meta.monthsInRole ?? '(not recorded)'}
Benchmark date: ${benchmarkDate}
Candidate's selected priority area: ${meta.candidateSelectedPriority || '(not recorded)'}

## Manager Development Summary (from candidate self-assessment)

Area outcomes:
${(managerSafe.areaStatuses || []).map(a => `- ${a.name}: ${a.outcome}`).join('\n')}

Development themes:
${(managerSafe.developmentThemes || []).map(t => `- ${t}`).join('\n')}

Michael's diagnosed priorities:
${diagnosedPriorities}

## Manager's M1–M7 Reflections

M1. What is the individual currently doing particularly well?
${responses.M1 || '(no response provided)'}

M2. How reliably do they take ownership of work appropriate to their stage?
${responses.M2 || '(no response provided)'}

M3. How effectively do they communicate and work with colleagues, clients or others?
${responses.M3 || '(no response provided)'}

M4. Are they applying what they are learning to real work?
${responses.M4 || '(no response provided)'}

M5. Do they recognise when to continue independently and when to ask for help or escalate?
${responses.M5 || '(no response provided)'}

M6. How do they respond to feedback?
${responses.M6 || '(no response provided)'}

M7. What support, experience, exposure or additional responsibility would be most useful for their development next?
${responses.M7 || '(no response provided)'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYNTHESIS_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[p1-synthesis-bg] Anthropic error:', data);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'ai_error', failedAt: Date.now() });
      await sessionStore.setJSON(`${sessionId}/metadata`, { ...meta, status: 'manager-complete' });
      return;
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let synthesis;
    try { synthesis = JSON.parse(clean); }
    catch (e) {
      console.error('[p1-synthesis-bg] JSON parse error:', e.message);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'parse_error', failedAt: Date.now() });
      await sessionStore.setJSON(`${sessionId}/metadata`, { ...meta, status: 'manager-complete' });
      return;
    }

    const now = Date.now();
    await sessionStore.setJSON(`${sessionId}/synthesis`, {
      schemaVersion: 'benchmark-v1',
      synthesis,
      savedAt: now
    });

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'summary-ready',
      synthesisCompletedAt: now
    });

    await sessionStore.setJSON(jobKey, { status: 'complete', runToken, completedAt: now });
    console.log(`[p1-synthesis-bg] Synthesis complete for session ${sessionId}`);

  } catch (err) {
    console.error('[p1-synthesis-bg] Unexpected error:', err.message);
    try {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
      const failedMeta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
      if (failedMeta?.status === 'synthesising') {
        await sessionStore.setJSON(`${sessionId}/metadata`, { ...failedMeta, status: 'manager-complete' });
      }
    } catch { /* ignore */ }
  }
};
