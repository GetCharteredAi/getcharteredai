// netlify/functions/p1-synthesis-background.js
// Background Function — combines candidate self-assessment (from manager-safe) with
// manager's M1–M7 responses to produce a synthesis stored at {sessionId}/synthesis.
// Status advances to summary-ready on completion.
// Triggered by p1-manager-submit via fire-and-forget fetch.
// POST { sessionId, internalSecret }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const SYNTHESIS_SYSTEM = `You are Michael, producing a Professional Readiness Synthesis for the GCAi Professional Readiness Benchmark.

## Your task
You have two inputs:
1. A Manager Development Summary — produced from the candidate's self-assessment (area outcomes and development themes only; no candidate quotes or private reasoning)
2. A manager's M1–M7 reflections — seven open questions the manager answered about the candidate

Your task is to synthesise these two perspectives into a development summary that is useful for a structured manager–candidate development conversation.

## Privacy boundary — strictly enforced
Do not include:
- Any direct or paraphrased quotes from the candidate's self-assessment
- Any direct quotes from the manager's M1–M7 responses
- Any specific anecdote or situation from either source in identifiable form
- The candidate's or manager's own words in any form

You may include:
- Thematic observations drawn from both sources
- Where the two perspectives align or diverge, described at a thematic level
- Conversation prompts and development priorities

## Output schema
{
  "schemaVersion": "benchmark-v1",
  "alignmentSummary": "<2–3 sentence narrative: where manager and candidate self-assessment broadly agree, and where they differ>",
  "alignedAreas": [
    { "area": "<area name>", "observation": "<what both perspectives suggest about this area>" }
  ],
  "divergentAreas": [
    { "area": "<area name>", "observation": "<how the perspectives differ and what that means for development>", "conversationPrompt": "<suggested opener for a development conversation about this area>" }
  ],
  "sharedPriorities": [
    { "rank": 1, "priority": "<development priority>", "rationale": "<why this is a shared priority>" }
  ],
  "conversationTopics": ["<suggested discussion topic for manager–candidate review>"],
  "managerRecommendedActions": ["<practical action the manager can take to support development>"]
}

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { sessionId, internalSecret } = body;

  if (!internalSecret || internalSecret !== process.env.P1_INTERNAL_SECRET) return;
  if (!sessionId) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const sessionStore = getSessionStore();
  const jobKey = `${sessionId}/jobs/synthesis`;

  try {
    await sessionStore.setJSON(jobKey, { status: 'pending', startedAt: Date.now() });

    const [managerSafeData, managerResponsesData, meta] = await Promise.all([
      sessionStore.get(`${sessionId}/manager-safe`, { type: 'json' }),
      sessionStore.get(`${sessionId}/manager-responses`, { type: 'json' }),
      sessionStore.get(`${sessionId}/metadata`, { type: 'json' })
    ]);

    if (!managerSafeData?.managerSafe || !managerResponsesData?.responses || !meta) {
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'missing_data', failedAt: Date.now() });
      return;
    }

    const { managerSafe } = managerSafeData;
    const { responses } = managerResponsesData;

    const userPrompt = `Generate the Professional Readiness Synthesis from the following two perspectives.

## Manager Development Summary (from candidate self-assessment)

Area outcomes:
${managerSafe.areaStatuses.map(a => `- ${a.name}: ${a.outcome}`).join('\n')}

Development themes:
${(managerSafe.developmentThemes || []).map(t => `- ${t}`).join('\n')}

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
        max_tokens: 2000,
        system: SYNTHESIS_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[p1-synthesis-bg] Anthropic error:', data);
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'ai_error', failedAt: Date.now() });
      return;
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let synthesis;
    try { synthesis = JSON.parse(clean); }
    catch (e) {
      console.error('[p1-synthesis-bg] JSON parse error:', e.message);
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'parse_error', failedAt: Date.now() });
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

    await sessionStore.setJSON(jobKey, { status: 'complete', completedAt: now });
    console.log(`[p1-synthesis-bg] Synthesis complete for session ${sessionId}`);

  } catch (err) {
    console.error('[p1-synthesis-bg] Unexpected error:', err.message);
    try {
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'unexpected_error', failedAt: Date.now() });
    } catch { /* ignore */ }
  }
};
