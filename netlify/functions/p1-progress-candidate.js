// netlify/functions/p1-progress-candidate.js
// POST { token, responses: { P1, P2, P3, P4, P5 } }
// Candidate token. Requires status === 'progress-reflection-open'.
// Archives agreed-priorities → priorities-history (single source of truth for prior priorities).
// Writes progress-responses. Issues manager-progress token (14-day TTL). Status → progress-manager-invited.
// No-overwrite guard.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const PROGRESS_MANAGER_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const REQUIRED_QUESTIONS = ['P1', 'P2', 'P3', 'P4', 'P5'];

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

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[p1-progress-candidate] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) { console.error('[p1-progress-candidate] Email error:', e.message); }
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
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, responses } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'candidate') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!responses || typeof responses !== 'object') {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'responses object required' }) };
  }

  for (const q of REQUIRED_QUESTIONS) {
    if (!responses[q] || typeof responses[q] !== 'string' || !responses[q].trim()) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `Response to ${q} is required` }) };
    }
  }

  const { sessionId } = payload;

  try {
    const sessionStore = getSessionStore();
    const inviteStore = getInviteStore();
    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

    if (meta.status !== 'progress-reflection-open') {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Session is not open for progress reflection.' }) };
    }

    const existing = await sessionStore.get(`${sessionId}/progress-responses`, { type: 'json' });
    if (existing) {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Progress reflection has already been submitted.' }) };
    }

    const now = Date.now();

    // Archive current agreed-priorities → priorities-history before any Phase 4 changes.
    // The synthesis reads from priorities-history[0]; agreed-priorities is not touched until confirmation.
    const currentPlan = await sessionStore.get(`${sessionId}/agreed-priorities`, { type: 'json' });
    if (currentPlan) {
      const existingHistory = await sessionStore.get(`${sessionId}/priorities-history`, { type: 'json' }) || [];
      existingHistory.push({
        version: existingHistory.length + 1,
        archivedAt: now,
        agreedBy: currentPlan.agreedBy,
        agreedPriorities: currentPlan.agreedPriorities,
        reviewDate: currentPlan.reviewDate,
        recordedAt: currentPlan.recordedAt
      });
      await sessionStore.setJSON(`${sessionId}/priorities-history`, existingHistory);
    }

    // Sanitise and write progress responses
    const sanitisedResponses = {};
    for (const q of REQUIRED_QUESTIONS) {
      sanitisedResponses[q] = responses[q].trim().slice(0, 2000);
    }
    await sessionStore.setJSON(`${sessionId}/progress-responses`, {
      responses: sanitisedResponses,
      submittedAt: now
    });

    // Issue manager-progress token (14-day TTL) for optional manager reflection
    const siteUrl = process.env.URL || 'https://getcharteredai.com';
    const managerProgressPayload = {
      sessionId,
      role: 'manager-progress',
      email: meta.managerEmail,
      expires: now + PROGRESS_MANAGER_TTL_MS
    };
    const managerProgressToken = generateToken(managerProgressPayload);
    await inviteStore.setJSON(managerProgressToken, {
      sessionId,
      role: 'manager-progress',
      expiresAt: now + PROGRESS_MANAGER_TTL_MS,
      issuedAt: now
    });

    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'progress-manager-invited',
      candidateProgressSubmittedAt: now,
      progressManagerInvitedAt: now,
      currentProgressManagerInviteKey: managerProgressToken
    });

    const managerLink = `${siteUrl}/professional-readiness-benchmark?token=${managerProgressToken}`;
    await sendEmail(
      meta.managerEmail,
      `A team member has completed their Progress Reflection — your perspective is invited`,
      wrap(`
        <p style="font-size:15px;color:#374151;line-height:1.7">A member of your team has completed their Professional Readiness Progress Reflection and your perspective is invited.</p>
        <p style="font-size:15px;color:#374151;line-height:1.7">This is optional and takes approximately 5 minutes. If you have time, your input helps produce a more complete progress review.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${managerLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Share your perspective →</a>
        </div>
        <p style="font-size:13px;color:#94a3b8;line-height:1.6">This link expires in 14 days. If no response is received, a candidate-only Progress Review will be generated. Contact info@getcharteredai.com with any questions.</p>
      `),
      `A team member has completed their Progress Reflection. Your perspective is invited (optional):\n\n${managerLink}\n\nThis link expires in 14 days.`
    );

    console.log(`[p1-progress-candidate] Progress reflection submitted for session ${sessionId}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[p1-progress-candidate] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not submit progress reflection' }) };
  }
};
