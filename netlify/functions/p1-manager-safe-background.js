// netlify/functions/p1-manager-safe-background.js
// Standalone manager-safe generation — used by the admin reversal flow.
// Normal flow uses p1-generate-report-background.js which runs manager-safe inline.
// POST { sessionId, internalSecret }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const MANAGER_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

function generateToken(payload) {
  const jwtSecret = process.env.JWT_SECRET;
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[p1-manager-safe-bg] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) { console.error('[p1-manager-safe-bg] Email error:', e.message); }
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

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { sessionId, internalSecret } = body;

  if (!internalSecret || internalSecret !== process.env.P1_INTERNAL_SECRET) return;
  if (!sessionId) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const sessionStore = getSessionStore();
  const inviteStore  = getInviteStore();
  const jobKey       = `${sessionId}/jobs/manager-safe`;

  try {
    await sessionStore.setJSON(jobKey, { status: 'pending', startedAt: Date.now() });

    const [privateData, meta] = await Promise.all([
      sessionStore.get(`${sessionId}/candidate-private`, { type: 'json' }),
      sessionStore.get(`${sessionId}/metadata`, { type: 'json' })
    ]);

    if (!privateData?.report || !meta) {
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'missing_data', failedAt: Date.now() });
      return;
    }

    // Generate manager-safe
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
        system: MANAGER_SAFE_SYSTEM,
        messages: [{ role: 'user', content: `Generate the Manager Development Summary based on this candidate Professional Readiness Report:\n\n${JSON.stringify(privateData.report, null, 2)}` }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[p1-manager-safe-bg] Anthropic error:', data);
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'ai_error', failedAt: Date.now() });
      return;
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let managerSafe;
    try { managerSafe = JSON.parse(clean); }
    catch (e) {
      console.error('[p1-manager-safe-bg] JSON parse error:', e.message);
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'parse_error', failedAt: Date.now() });
      return;
    }

    await sessionStore.setJSON(`${sessionId}/manager-safe`, {
      schemaVersion: 'benchmark-v1',
      managerSafe,
      savedAt: Date.now()
    });

    // Issue new manager invitation
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

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'awaiting-manager',
      managerInvitedAt: now,
      currentManagerInviteKey: managerToken,
      reminderEmail4SentAt: null
    });

    await sessionStore.setJSON(jobKey, { status: 'complete', completedAt: now });

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
    console.log(`[p1-manager-safe-bg] Email #3 sent to ${meta.managerEmail} for session ${sessionId}`);

  } catch (err) {
    console.error('[p1-manager-safe-bg] Unexpected error:', err.message);
    try {
      await sessionStore.setJSON(jobKey, { status: 'failed', error: 'unexpected_error', failedAt: Date.now() });
    } catch { /* ignore */ }
  }
};
