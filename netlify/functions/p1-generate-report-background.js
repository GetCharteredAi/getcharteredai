// netlify/functions/p1-generate-report-background.js
// Background Function — generates the candidate Professional Readiness Report (Sonnet),
// then inline generates the manager-safe summary and issues the manager invitation.
// Netlify returns 202 immediately; this runs for up to 15 minutes.
// Candidate report job status written to p1-sessions/{sessionId}/jobs/candidate-report.
// Frontend polls p1-report-status.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const MANAGER_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// ── Stage rubrics (all 20, verbatim) ─────────────────────────────────────────

const STAGE_RUBRICS = `## Stage calibration rubrics

BAND 1 — 8–16 WEEKS (Early professional habits forming)
1. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Completes defined tasks reliably with appropriate support, checks work before passing it on, communicates progress when asked and is beginning to notice when something is unclear, incomplete or needs flagging.
2. COMMUNICATION & WORKING WITH OTHERS: Provides clear, factual updates, listens and responds appropriately, and asks for help when needed, although they may still rely on others to initiate communication or may not always explore the issue independently before asking.
3. LEARNING & APPLYING KNOWLEDGE: Can make a basic but accurate connection between structured learning and something encountered in the workplace, shows curiosity about unfamiliar work and asks rather than guessing when they do not understand.
4. JUDGEMENT, HELP & ESCALATION: Recognises when they are uncertain and generally checks before proceeding rather than guessing. They are beginning to understand what they can deal with themselves and what should be referred to someone more experienced.
5. FEEDBACK, REFLECTION & DEVELOPMENT: Can recall specific feedback, shows willingness to listen and can describe what they were asked to improve, although reflection may still be largely descriptive and they may not yet have had the opportunity to demonstrate the change in practice.

BAND 2 — 4–8 MONTHS (Growing contribution and consistency)
6. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Manages defined responsibilities with increasing consistency, keeps others appropriately informed and recognises quality, deadline or delivery issues early enough to act rather than simply reporting them after the fact.
7. COMMUNICATION & WORKING WITH OTHERS: Communicates clearly with colleagues, begins to initiate appropriate updates without always being prompted, asks more focused questions and contributes constructively when working with people who have greater experience.
8. LEARNING & APPLYING KNOWLEDGE: Can explain how formal learning applies in real situations and articulate things workplace experience has taught them that study alone could not, using experience to deepen rather than simply repeat prior knowledge.
9. JUDGEMENT, HELP & ESCALATION: Shows growing judgement about when to continue independently, when to ask for help and when an issue should be raised. Where genuine opportunities have arisen, can identify at least one situation that appropriately required checking or escalation and explain why.
10. FEEDBACK, REFLECTION & DEVELOPMENT: Can describe a concrete change they have made as a result of feedback, reflect on what did not go as expected and explain how that learning has influenced their subsequent approach.

BAND 3 — 9–12 MONTHS (Increasing ownership, judgement and independence)
11. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Takes ownership of defined work from start to finish, increasingly decides what "done well" looks like without needing each step specified, and proactively identifies and flags emerging issues while recognising the limits of their responsibility.
12. COMMUNICATION & WORKING WITH OTHERS: Adapts communication appropriately to the audience, contributes meaningfully in mixed-experience settings, communicates uncertainty without bluffing and increasingly knows when to initiate updates, questions or conversations themselves.
13. LEARNING & APPLYING KNOWLEDGE: Applies prior learning flexibly across different situations, approaches unfamiliar tasks with a considered plan for identifying what they need to know, and increasingly combines formal learning with workplace experience to inform how they work.
14. JUDGEMENT, HELP & ESCALATION: Demonstrates reasoned independent judgement about when to proceed, when to check and when to escalate, can explain the reasoning behind that decision and raises material issues proactively while remaining within the boundaries of their responsibility.
15. FEEDBACK, REFLECTION & DEVELOPMENT: Actively engages with feedback, increasingly seeks it where useful, identifies patterns across more than one experience and uses reflection to make broader improvements to how they approach their work rather than only correcting an isolated task.

BAND 4 — 13–24 MONTHS (Greater independence and readiness for increased responsibility)
16. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Consistently owns defined work with limited prompting, anticipates quality, deadline and delivery issues, communicates them early and takes appropriate action within their authority rather than waiting for problems to be identified by others.
17. COMMUNICATION & WORKING WITH OTHERS: Communicates confidently and appropriately across different audiences, initiates necessary conversations and updates, contributes constructively in meetings and can explain their position while remaining comfortable acknowledging uncertainty.
18. LEARNING & APPLYING KNOWLEDGE: Integrates formal learning and accumulated workplace experience across less familiar situations, identifies what additional knowledge is required and increasingly adapts previous learning rather than relying on a known process or example.
19. JUDGEMENT, HELP & ESCALATION: Exercises proportionate judgement within their level of responsibility, explains the risks and reasoning behind decisions, recognises when specialist or senior input is required and escalates early enough to protect the work, client, project or organisation.
20. FEEDBACK, REFLECTION & DEVELOPMENT: Uses feedback and self-reflection proactively to identify recurring patterns, can show how their approach has changed over time and increasingly takes ownership of seeking the experience, feedback or development needed for the next level of responsibility.

## Band boundary rule
Less than 8 weeks (approx < 2 months): outside normal window — flag; interpret exposure cautiously.
8 weeks to < 4 months (2–3 months): use Band 1.
4–8 months: use Band 2.
9–12 months: use Band 3.
13–24 months: use Band 4.
More than 24 months: outside V1 range — flag; do not extrapolate a higher standard.
Where elapsed time sits close to a boundary, do not manufacture a material difference for a few days or weeks.`;

const GOVERNING_RULES = `## Governing calibration rules
1. The rubric is a guide to reasonable stage expectations, not a checklist. Make a reasoned judgement from the quality and consistency of the evidence available.
2. Judge evidence, not confidence. A confident claim without a real example is weaker evidence than a hesitant but well-grounded example.
3. Lack of exposure is not lack of capability. Do not turn the absence of experience into a negative capability judgement.
4. A lack of exposure to one sub-element does not automatically determine the whole-area verdict.
5. Account for the workplace environment. Distinguish between behaviour the individual could reasonably have demonstrated and behaviour their role, authority, project or team structure has not yet allowed.
6. Do not flatten strengths because another sub-element needs development.
7. "Proactive" must be interpreted relative to stage, authority and opportunity.
8. Months in role calibrates expectation; it does not replace professional judgement.`;

function buildReportSystem(discipline, monthsInRole) {
  return `You are Michael, generating a Professional Readiness Report for the GCAi Professional Readiness Benchmark.

## Purpose
This review gives the candidate an honest, developmental picture of their professional readiness across five areas. It is a professional-development diagnostic — NOT a formal assessment, certification, or guarantee of any qualification outcome.

## Your role
Professional tutor + developmental coach + intelligent diagnostic.
Identify gap types: knowledge | practice | experience | exposure | evidence-recognition | articulation
(Judgement is NOT a gap type — classify as practice or experience.)

## Development progression
Knowledge → Understanding → Application → Judgement → Articulation → Professional Performance

## Candidate context
Discipline: ${discipline}
Months in current role: ${monthsInRole}

${STAGE_RUBRICS}

${GOVERNING_RULES}

## Five assessment areas
1. Professional Behaviour & Responsibility (Q1–Q4)
2. Communication & Working With Others (Q5–Q8)
3. Learning & Applying Knowledge (Q9–Q11)
4. Judgement, Help & Escalation (Q12–Q13)
5. Feedback, Reflection & Development (Q14–Q15)

Interpret patterns holistically across each area. Do NOT calculate readiness by averaging.

## Canonical outcome labels (use ONLY these four)
ON TRACK — evidence indicates appropriate progress for this stage
DEVELOPING — capability is emerging; further practice, experience or development is needed
SUPPORT WOULD HELP — a meaningful gap requires action; proactive support recommended
NOT YET ENOUGH EXPOSURE — the candidate has not had sufficient opportunity; capability cannot be assessed

Every outcome must be supported by specific evidence from the candidate's actual responses.
NOT YET ENOUGH EXPOSURE is not a default fallback — it requires a positive finding that opportunity was genuinely absent.

## Sensitive disclosure
If any response suggests a safeguarding concern, serious workplace harm, or personal crisis, set sensitiveDisclosureFlag to true. Do not elaborate in the report body.

## Report structure — output this JSON exactly
{
  "schemaVersion": "benchmark-v1",
  "overallSummary": "<concise evidence-led picture, 2-4 sentences>",
  "areas": [
    {
      "id": 1,
      "name": "Professional Behaviour & Responsibility",
      "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE",
      "evidence": "<what the candidate demonstrated, with specific reference to their responses>",
      "developmentNeed": "<what is missing or needs further work>",
      "conclusion": "<one sentence reason for this outcome>"
    },
    {
      "id": 2,
      "name": "Communication & Working With Others",
      "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 3,
      "name": "Learning & Applying Knowledge",
      "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 4,
      "name": "Judgement, Help & Escalation",
      "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    },
    {
      "id": 5,
      "name": "Feedback, Reflection & Development",
      "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE",
      "evidence": "<string>",
      "developmentNeed": "<string>",
      "conclusion": "<string>"
    }
  ],
  "demonstratedStrengths": ["<string>", "<string>"],
  "developmentPriorities": [
    {
      "rank": 1,
      "priority": "<string>",
      "gapType": "<knowledge|practice|experience|exposure|evidence-recognition|articulation>",
      "developmentAction": "<specific plain-language action — do not use raw taxonomy labels>",
      "why": "<why this ranks here>"
    }
  ],
  "candidateActions": ["<specific action the candidate can take themselves>"],
  "workplaceOpportunities": ["<development opportunity requiring manager or employer>"],
  "sensitiveDisclosureFlag": false
}

## Do not overclaim
Do not describe this review as a formal assessment, professional certification, or guarantee of any qualification outcome.

## Current information safeguard
Where you reference current legislation, regulation or professional guidance, use only GCAi-approved current-awareness content. Do not invent specific current factual examples.

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;
}

const MANAGER_SAFE_SYSTEM = `You are Michael, generating a Manager Development Summary for the GCAi Professional Readiness Benchmark.

## Your task
You have access to a candidate's Professional Readiness Report. Generate a Manager Development Summary that:
- Gives the manager useful, actionable insight to support the candidate's professional development
- Does NOT include any of the candidate's specific statements, quotes, or private reflections verbatim
- Does NOT reveal the candidate's individual answers to any questions
- Translates development findings into insight the manager can act on

## Privacy boundary — strictly enforced
Do not include:
- Any direct or paraphrased quotes from the candidate's responses
- Any specific anecdote or situation the candidate described
- Any reference to the candidate's private reasoning or feelings
- The candidate's own words in any form

You may include:
- Development theme summaries (e.g., "there is a development opportunity around escalation judgement")
- Area-level outcomes
- Conversation prompts and suggested actions for the manager

## Output schema
{
  "schemaVersion": "benchmark-v1",
  "areaStatuses": [
    { "id": 1, "name": "Professional Behaviour & Responsibility", "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE" },
    { "id": 2, "name": "Communication & Working With Others", "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE" },
    { "id": 3, "name": "Learning & Applying Knowledge", "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE" },
    { "id": 4, "name": "Judgement, Help & Escalation", "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE" },
    { "id": 5, "name": "Feedback, Reflection & Development", "outcome": "ON TRACK|DEVELOPING|SUPPORT WOULD HELP|NOT YET ENOUGH EXPOSURE" }
  ],
  "developmentThemes": ["<key development theme — no candidate quotes>"],
  "suggestedConversationPoints": ["<discussion prompt for a development conversation with the candidate>"],
  "recommendedActions": ["<practical action the manager can take to support development>"],
  "sharedDevelopmentPriorities": [
    {
      "rank": 1,
      "priority": "<string>",
      "why": "<string>",
      "managerRole": "<what the manager can do to support this>"
    }
  ]
}

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch { return null; }
}

function generateToken(payload) {
  const jwtSecret = process.env.JWT_SECRET;
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
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

async function callAnthropic(apiKey, system, messages, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Anthropic error: ${JSON.stringify(data)}`);
  const text = (data.content || []).map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[p1-report-bg] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) { console.error('[p1-report-bg] Email error:', e.message); }
}

function wrap(content) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff">
    <div style="background:#0D0F1C;padding:20px 28px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#fff">Get Chartered <span style="color:#f59e0b">AI</span></span>
      <span style="font-size:11px;color:rgba(255,255,255,.4)">getcharteredai.com</span>
    </div>
    <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">${content}</div>
    <div style="padding:14px 28px;text-align:center">
      <p style="font-size:11px;color:#94a3b8;margin:0">Get Chartered AI &middot; getcharteredai.com</p>
    </div>
  </div>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { token, messages, runToken, contextAnswers } = body;
  if (!token || !messages || !runToken) return;

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'candidate') return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const { sessionId } = payload;
  const sessionStore = getSessionStore();
  const inviteStore  = getInviteStore();
  const jobKey       = `${sessionId}/jobs/candidate-report`;

  try {
    // Deduplication
    const existingJob = await sessionStore.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    await sessionStore.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    // Read metadata for calibration context
    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'session_not_found', failedAt: Date.now() });
      return;
    }

    const discipline   = contextAnswers?.discipline || meta.discipline || 'Not specified';
    const monthsInRole = contextAnswers?.monthsInRole ?? meta.monthsInRole ?? 0;

    // ── Step 1: Generate candidate report ────────────────────────────────────
    let report;
    try {
      report = await callAnthropic(apiKey, buildReportSystem(discipline, monthsInRole), messages, 4000);
    } catch (e) {
      console.error('[p1-report-bg] Report generation failed:', e.message);
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'ai_error', failedAt: Date.now() });
      return;
    }

    // Write candidate-private
    const privateData = {
      schemaVersion: 'benchmark-v1',
      report,
      contextAnswers: contextAnswers || { discipline, monthsInRole },
      savedAt: Date.now()
    };
    await sessionStore.setJSON(`${sessionId}/candidate-private`, privateData);

    // Update metadata to candidate-complete
    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'candidate-complete',
      discipline,
      monthsInRole,
      candidateCompletedAt: Date.now()
    });

    // Mark job complete — frontend can now show the report
    await sessionStore.setJSON(jobKey, { status: 'complete', runToken, completedAt: Date.now() });
    console.log(`[p1-report-bg] Candidate report complete for session ${sessionId}`);

    // ── Step 2: Generate manager-safe (inline, same bg window) ───────────────
    let managerSafe;
    try {
      managerSafe = await callAnthropic(
        apiKey,
        MANAGER_SAFE_SYSTEM,
        [{ role: 'user', content: `Generate the Manager Development Summary based on this candidate Professional Readiness Report:\n\n${JSON.stringify(report, null, 2)}` }],
        2000
      );
    } catch (e) {
      console.error('[p1-report-bg] Manager-safe generation failed:', e.message);
      // Candidate report is already saved; log failure but don't fail the whole job
      return;
    }

    await sessionStore.setJSON(`${sessionId}/manager-safe`, {
      schemaVersion: 'benchmark-v1',
      managerSafe,
      savedAt: Date.now()
    });

    // ── Step 3: Issue manager invitation ──────────────────────────────────────
    const now = Date.now();
    const managerPayload = {
      sessionId,
      role: 'manager',
      email: meta.managerEmail,
      expires: now + MANAGER_TOKEN_TTL_MS
    };
    const managerToken = generateToken(managerPayload);

    await inviteStore.setJSON(managerToken, {
      sessionId,
      role: 'manager',
      expiresAt: now + MANAGER_TOKEN_TTL_MS,
      issuedAt: now
    });

    // Update metadata
    const updatedMeta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...updatedMeta,
      status: 'awaiting-manager',
      managerInvitedAt: now,
      currentManagerInviteKey: managerToken
    });

    const siteUrl = process.env.URL || 'https://getcharteredai.com';
    const managerLink = `${siteUrl}/professional-readiness-benchmark?token=${managerToken}`;
    await sendEmail(
      meta.managerEmail,
      `A team member has completed their Benchmark — your input is invited`,
      wrap(`
        <p style="font-size:15px;color:#374151;line-height:1.7">A member of your team has completed their Professional Readiness Benchmark and your input has been invited.</p>
        <p style="font-size:15px;color:#374151;line-height:1.7">Your perspective takes approximately 5 minutes and helps produce a more complete picture of their professional development.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${managerLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Share your perspective →</a>
        </div>
        <p style="font-size:13px;color:#94a3b8;line-height:1.6">This link expires in 14 days. If you have any questions, contact info@getcharteredai.com.</p>
      `),
      `A team member has completed their Professional Readiness Benchmark. Your input is invited here: ${managerLink}`
    );
    console.log(`[p1-report-bg] Email #3 sent to ${meta.managerEmail} for session ${sessionId}`);

  } catch (err) {
    console.error('[p1-report-bg] Unexpected error:', err.message);
    try {
      await sessionStore.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
    } catch { /* ignore */ }
  }
};
