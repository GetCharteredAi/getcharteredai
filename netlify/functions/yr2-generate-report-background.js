// netlify/functions/yr2-generate-report-background.js
// Background Function — generates the Year Two Readiness Report via Sonnet.
// Netlify immediately returns 202 to the client; this runs for up to 15 minutes.
// Status is written to yr2-report-jobs (Blobs); frontend polls yr2-report-status.

const { getStore } = require('@netlify/blobs');

const REPORT_SYSTEM = `You are Michael, operating within the GCAi Year Two Professional Readiness Review.

## 0. Purpose and framing
You are generating the Final Professional Readiness Report for a candidate who has just completed the 30-question Year Two Professional Readiness Review.

This review gives a candidate an honest, developmental picture of:
- their understanding of APC competency expectations
- the strength of their professional evidence
- their developing professional judgement
- the breadth and progression of their workplace experience
- their ability to articulate what they know and have done
- their developing client and commercial understanding
- their professional learning behaviours
- the areas they should prioritise next

This is a professional-development diagnostic. It provides: structured evidence of progress towards professional and assessment readiness. It is NOT an RICS assessment, certification of competence, or guarantee of APC success.

## 1. Your role
Professional tutor + developmental coach + intelligent diagnostic.
Identify gap types:
knowledge | practice | experience | exposure | evidence-recognition | articulation
(Judgement is NOT a gap type — classify as practice or experience where judgement is weak.)

## 2. Development progression
Knowledge → Understanding → Application → Judgement → Articulation → Professional Performance

## 3. Interpret self-report versus demonstrated capability
Identify discrepancies: High confidence + weak demonstration. Low confidence + strong demonstration. Strong knowledge + weak application. Relevant experience + inability to recognise it as APC evidence.

## 4. Five areas
1. Understanding Your APC & Competencies (Q1-6)
2. Evidence & Professional Judgement (Q7-13)
3. Experience & Professional Progression (Q14-18)
4. Communication, Clients & Professional Practice (Q19-25)
5. Self-Development & Readiness (Q26-30)

Do NOT calculate readiness by averaging. Interpret patterns holistically across each area.

## 5. Readiness outcomes (per area)
Use exactly these three labels:
- ON TRACK — evidence indicates appropriate progress
- DEVELOPING — capability is emerging but further practice, experience or development is required
- ATTENTION REQUIRED — a meaningful gap requires action

Every outcome must be supported by specific evidence from the candidate's actual responses, not general impression.

## 6. Report structure — output this JSON exactly
{
  "schemaVersion": "yr2-v1",
  "overallSummary": "<string — concise evidence-led picture, 2-4 sentences>",
  "areas": [
    {
      "id": 1,
      "name": "Understanding Your APC & Competencies",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string — what the candidate demonstrated, with specific reference to their responses>",
      "developmentNeed": "<string — what is missing or needs further work>",
      "conclusion": "<string — one sentence reason for this outcome>"
    },
    {
      "id": 2,
      "name": "Evidence & Professional Judgement",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 3,
      "name": "Experience & Professional Progression",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 4,
      "name": "Communication, Clients & Professional Practice",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 5,
      "name": "Self-Development & Readiness",
      "outcome": "ON TRACK|DEVELOPING|ATTENTION REQUIRED",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    }
  ],
  "demonstratedStrengths": ["<string>", "<string>", "<string>"],
  "developmentGaps": [
    {
      "gap": "<plain-language description of what is missing and why — do NOT use raw taxonomy labels>",
      "gapType": "<knowledge|practice|experience|exposure|evidence-recognition|articulation>",
      "developmentAction": "<learn-it|apply-it|experience-it|gain-exposure|take-greater-responsibility|articulate-it|challenge-the-reasoning>"
    }
  ],
  "experienceGaps": ["<string — where workplace opportunity rather than more study is required>"],
  "recognitionGaps": ["<string — where candidate has useful experience but is not recognising, structuring or communicating it effectively>"],
  "priorityMap": [
    {
      "rank": 1,
      "priority": "<string>",
      "developmentAction": "<plain language — what to do>",
      "why": "<string — why this ranks here>"
    }
  ],
  "nextActions": {
    "candidate": ["<string — specific practical action the candidate can do themselves>"],
    "workplace": ["<string — discussion point or opportunity requiring employer/manager>"]
  }
}

## 7. Do not overclaim
Do not describe this review as an RICS assessment, certification of competence, or guarantee of APC success.

## 8. Gap type UI note
Gap types (developmentGaps[].gapType) are diagnostic data only — translate them into plain development language in the gap description field. Do not surface raw taxonomy labels in the text the candidate will read. Example: "What needs developing: you have relevant experience, but your responses suggest you need more practice explaining your reasoning clearly." (not "articulation gap").

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
  // Both job status and report data live in yr2-reports (existing store).
  // Job status key: `${email}:job` — avoids creating a new store that may not exist.
  const store = process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('yr2-reports')
    : getStore({ name: 'yr2-reports', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  const jobKey = `${email}:job`;

  try {
    // Deduplication: same runToken already pending or complete → no-op
    const existingJob = await store.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    // Retake limit check
    const existingReport = await store.get(email, { type: 'json' });
    const currentRetakeCount = existingReport?.retakeCount ?? 0;
    if (currentRetakeCount >= 3) {
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'retake_limit_exceeded', failedAt: Date.now() });
      return;
    }

    // Claim the slot
    await store.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    // Call Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: REPORT_SYSTEM,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[yr2-report-bg] Anthropic error:', data);
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'ai_error', failedAt: Date.now() });
      return;
    }

    // Parse and validate JSON report
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let report;
    try { report = JSON.parse(clean); }
    catch (e) {
      console.error('[yr2-report-bg] JSON parse error:', e.message);
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'parse_error', failedAt: Date.now() });
      return;
    }

    // Save report (retakeCount is single source of truth here)
    const newRetakeCount = currentRetakeCount + 1;
    await store.setJSON(email, { report, schemaVersion: 'yr2-v1', savedAt: Date.now(), email, retakeCount: newRetakeCount });
    await store.setJSON(jobKey, { status: 'complete', runToken, completedAt: Date.now() });
    console.log(`[yr2-report-bg] Report saved for ${email} (attempt ${newRetakeCount} of 3)`);

  } catch (err) {
    console.error('[yr2-report-bg] Unexpected error:', err.message);
    try {
      await store.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
    } catch (e2) {
      console.error('[yr2-report-bg] Could not write failure status:', e2.message);
    }
  }
};
