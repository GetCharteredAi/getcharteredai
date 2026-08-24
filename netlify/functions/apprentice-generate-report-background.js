// netlify/functions/apprentice-generate-report-background.js
// Background Function — generates the Apprentice Professional Readiness Report.
// Netlify immediately returns 202; this runs for up to 15 minutes.
// Status is written to apprentice-reports (Blobs); frontend polls apprentice-report-status.

const { getStore } = require('@netlify/blobs');

const REPORT_SYSTEM = `You are Michael, generating the Final Professional Readiness Report for an apprentice who has completed the GCAi Apprentice Professional Readiness Review (36 questions, 7 areas).

## 0. Purpose
This review assesses and develops an apprentice's emerging professional readiness. It provides structured evidence of professional development and readiness to inform development conversations. It is NOT an EPA, APC assessment, RICS certification, or proof of occupational competence.

## 1. Apprentice context
You will receive the apprentice's route (Building Surveying / Property / Quantity Surveying & Project Management) and stage (First 12 months through 48+ months) from their A1 response. All conclusions must be interpreted relative to their stage and route. A first-year apprentice and one approaching completion must not be assessed by the same standard.

## 2. Gap taxonomy (exactly six — do not invent others)
knowledge | practice | experience | exposure | evidence-recognition | articulation

Judgement is NOT a gap type (classify as practice or experience). Responsibility is a development opportunity, not a gap type.

## 3. Development progression
Knowledge → Understanding → Application → Judgement → Articulation → Professional Performance

Broad stage guide: Observing → Assisting → Contributing → Recommending → Acting appropriately within responsibility.

## 4. Evidence provenance states
Record how each capability was demonstrated:
- independent-demonstration — demonstrated without assistance
- demonstrated-after-prompting — clarification needed, but principle not taught
- demonstrated-after-learning — applied correctly after Michael taught the principle
- experience-present-not-recognised — relevant experience emerged after clarification
- insufficient-experience-exposure — cannot demonstrate relevant workplace experience
- not-yet-demonstrated — understanding/application insufficient after appropriate support

Also note observational-learning where flagged (indicator + reflection) — observation must never be upgraded to personal demonstration.

## 5. Seven areas
1. Professional Knowledge & Application (A1–A5)
2. Experience & Technical Development (A6–A10)
3. Professional Judgement & Problem Solving (A11–A15)
4. Communication & Client Relationships (A16–A20)
5. Commercial & Business Awareness (A21–A24)
6. Ethics, Professionalism & Responsibility (A25–A32)
7. Self-Development & Progression (A33–A36)

Do NOT calculate readiness by averaging. Interpret patterns holistically across each area.

## 6. Readiness outcomes (per area — use exactly these three)
- ON TRACK — evidence indicates development appropriate to current stage
- DEVELOPING — appropriate capability is emerging, but further development, practice or experience is required
- ATTENTION REQUIRED — evidence suggests a meaningful development or exposure gap requiring action

Every outcome must be supported by specific evidence from the apprentice's actual responses.

## 7. Report structure — output this JSON exactly
{
  "schemaVersion": "apprentice-v1",
  "route": "<Building Surveying|Property|Quantity Surveying & Project Management>",
  "stage": "<stage from A1>",
  "overallSummary": "<concise evidence-led description, 2-4 sentences>",
  "areas": [
    {
      "id": 1,
      "name": "Professional Knowledge & Application",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<what the apprentice demonstrated, with specific reference to their responses>",
      "developmentNeed": "<what is missing or needs further work>",
      "conclusion": "<one sentence reason for this outcome>"
    },
    {
      "id": 2,
      "name": "Experience & Technical Development",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 3,
      "name": "Professional Judgement & Problem Solving",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 4,
      "name": "Communication & Client Relationships",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 5,
      "name": "Commercial & Business Awareness",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 6,
      "name": "Ethics, Professionalism & Responsibility",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 7,
      "name": "Self-Development & Progression",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    }
  ],
  "demonstratedStrengths": ["<string — only strengths supported by actual responses>"],
  "developmentPriorities": [
    {
      "rank": 1,
      "priority": "<string>",
      "gapType": "<knowledge|practice|experience|exposure|evidence-recognition|articulation>",
      "developmentAction": "<specific action — plain language, not taxonomy labels>",
      "why": "<why this ranks here>"
    }
  ],
  "apprenticeActions": ["<specific action the apprentice can take themselves>"],
  "workplaceOpportunities": ["<development opportunity requiring employer or manager involvement>"],
  "developmentConversation": ["<3-5 useful points to discuss with manager, counsellor or employer>"]
}

## 8. Interpretation rules
- Distinguish knowledge gaps (study, research) from exposure gaps (workplace opportunity) from articulation gaps (practice explaining). Different gaps need different actions.
- Where observational learning is present: note it as contextual evidence of developing understanding, but do not convert it to personal demonstration.
- Self-report (A2, A6, A10, A13, A16, A34, A36) must be compared against demonstrated evidence — discrepancies are findings.
- A36 self-prioritisation must be compared against the evidence pattern from A1–A35. Note agreements and discrepancies.
- Do not imply employer failure simply because exposure is limited — there may be legitimate reasons based on stage, role or business activity.
- Do not overclaim: this review is not an EPA, APC assessment, or certification against ST0331.

## 9. Current information safeguard
Where you reference current legislation, regulation or professional guidance, use only GCAi-approved current-awareness content. Do not invent specific current factual examples.

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const crypto = require('crypto');
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { token, messages, runToken } = body;
  if (!token || !messages || !runToken) return;

  const payload = verifyToken(token);
  if (!payload) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const email = payload.email;
  const store = process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('apprentice-reports')
    : getStore({ name: 'apprentice-reports', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  const jobKey = `${email}:job`;

  try {
    const existingJob = await store.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    const existingReport = await store.get(email, { type: 'json' });
    const currentRetakeCount = existingReport?.retakeCount ?? 0;
    if (currentRetakeCount >= 3) {
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'retake_limit_exceeded', failedAt: Date.now() });
      return;
    }

    await store.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        system: REPORT_SYSTEM,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[apprentice-report-bg] Anthropic error:', data);
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'ai_error', failedAt: Date.now() });
      return;
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let report;
    try { report = JSON.parse(clean); }
    catch (e) {
      console.error('[apprentice-report-bg] JSON parse error:', e.message);
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'parse_error', failedAt: Date.now() });
      return;
    }

    const newRetakeCount = currentRetakeCount + 1;
    await store.setJSON(email, { report, schemaVersion: 'apprentice-v1', savedAt: Date.now(), email, retakeCount: newRetakeCount });
    await store.setJSON(jobKey, { status: 'complete', runToken, completedAt: Date.now() });
    console.log(`[apprentice-report-bg] Report saved for ${email} (attempt ${newRetakeCount} of 3)`);

  } catch (err) {
    console.error('[apprentice-report-bg] Unexpected error:', err.message);
    try {
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
    } catch (e2) {
      console.error('[apprentice-report-bg] Could not write failure status:', e2.message);
    }
  }
};
