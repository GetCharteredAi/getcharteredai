// netlify/functions/p1-session-load.js
// Returns session state for a candidate or employer token.
// Called on page load to determine which UI state to show.

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
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
  } catch { return null; }
}

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token } = body;
  if (!token) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing token' }) };

  const payload = verifyToken(token);
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Invalid or expired token' }) };

  try {
    if (payload.role === 'candidate') {
      const sessionStore = getSessionStore();
      const meta = await sessionStore.get(`${payload.sessionId}/metadata`, { type: 'json' });
      if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

      const response = {
        role: 'candidate',
        sessionId: payload.sessionId,
        status: meta.status,
        firmName: meta.firmName,
        discipline: meta.discipline,
        monthsInRole: meta.monthsInRole,
        employmentStartDate: meta.employmentStartDate,
        candidateName: meta.candidateName || null,
        managerName: meta.managerName || null
      };

      const PHASE_4_STATUSES = ['progress-reflection-open', 'progress-manager-invited',
        'progress-manager-lapsed', 'progress-synthesising', 'progress-ready', 'progress-complete'];

      // Include Benchmark report for all post-completion statuses (Phase 3 and Phase 4)
      if (meta.status === 'candidate-complete' || meta.status === 'awaiting-manager' ||
          meta.status === 'manager-complete' || meta.status === 'synthesising' ||
          meta.status === 'summary-ready' || meta.status === 'manager-lapsed' ||
          meta.status === 'reflection-ready' || PHASE_4_STATUSES.includes(meta.status)) {
        const privateData = await sessionStore.get(`${payload.sessionId}/candidate-private`, { type: 'json' });
        if (privateData?.report) {
          response.report = privateData.report;
          response.contextAnswers = privateData.contextAnswers;
        }
      }

      if (meta.status === 'summary-ready' || meta.status === 'reflection-ready' || meta.status === 'manager-lapsed') {
        const synthData = await sessionStore.get(`${payload.sessionId}/synthesis`, { type: 'json' });
        if (synthData?.synthesis) response.synthesis = synthData.synthesis;
      }

      if (meta.status === 'reflection-ready' || meta.status === 'manager-lapsed') {
        const apData = await sessionStore.get(`${payload.sessionId}/agreed-priorities`, { type: 'json' });
        if (apData) {
          response.agreedPriorities = apData.agreedPriorities;
          response.reviewDate = apData.reviewDate;
        }
      }

      // Phase 4: prior priorities shown as context during reflection form
      if (meta.status === 'progress-reflection-open') {
        const apData = await sessionStore.get(`${payload.sessionId}/agreed-priorities`, { type: 'json' });
        if (apData) {
          response.priorAgreedPriorities = apData.agreedPriorities;
          response.priorReviewDate = apData.reviewDate;
        }
      }

      // Phase 4: progress review (proposed priorities included — not canonical until confirmed)
      if (meta.status === 'progress-ready') {
        const prData = await sessionStore.get(`${payload.sessionId}/progress-review`, { type: 'json' });
        if (prData?.review) response.progressReview = prData.review;
      }

      // Phase 4: confirmed canonical priorities after completion
      if (meta.status === 'progress-complete') {
        const apData = await sessionStore.get(`${payload.sessionId}/agreed-priorities`, { type: 'json' });
        if (apData) {
          response.agreedPriorities = apData.agreedPriorities;
          response.reviewDate = apData.reviewDate;
        }
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response) };
    }

    if (payload.role === 'employer') {
      const cohortStore = getCohortStore();
      const index = await cohortStore.get('index', { type: 'json' }) || [];
      const cohort = index.find(c => c.cohortId === payload.cohortId);
      if (!cohort) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Cohort not found' }) };
      if (cohort.employerContactEmail !== payload.email) return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };

      const sessionIds = await cohortStore.get(`${payload.cohortId}/sessions`, { type: 'json' }) || [];
      const sessionStore = getSessionStore();
      const sessions = await Promise.all(
        sessionIds.map(async sid => {
          const meta = await sessionStore.get(`${sid}/metadata`, { type: 'json' });
          if (!meta) return null;
          return { sessionId: sid, candidateEmail: meta.candidateEmail, status: meta.status, createdAt: meta.createdAt };
        })
      );

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          role: 'employer',
          cohortId: payload.cohortId,
          firmName: cohort.firmName,
          sessions: sessions.filter(Boolean)
        })
      };
    }

    if (payload.role === 'manager') {
      const sessionStore = getSessionStore();
      const meta = await sessionStore.get(`${payload.sessionId}/metadata`, { type: 'json' });
      if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

      if (meta.currentManagerInviteKey !== token) {
        return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'This invitation link has been superseded. Please use your most recent invitation email.' }) };
      }

      // Session has advanced to Phase 4 — Phase 3 manager link no longer active
      const PHASE_4_STATUSES = ['progress-reflection-open', 'progress-manager-invited',
        'progress-manager-lapsed', 'progress-synthesising', 'progress-ready', 'progress-complete'];
      if (PHASE_4_STATUSES.includes(meta.status)) {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({
          role: 'manager', status: meta.status, firmName: meta.firmName, phase4: true
        }) };
      }

      const response = {
        role: 'manager',
        sessionId: payload.sessionId,
        status: meta.status,
        firmName: meta.firmName,
        discipline: meta.discipline,
        monthsInRole: meta.monthsInRole,
        candidateLabel: 'the individual'
      };

      if (meta.status === 'summary-ready' || meta.status === 'reflection-ready') {
        const synthData = await sessionStore.get(`${payload.sessionId}/synthesis`, { type: 'json' });
        if (synthData?.synthesis) response.synthesis = synthData.synthesis;
      }

      if (meta.status === 'reflection-ready') {
        const apData = await sessionStore.get(`${payload.sessionId}/agreed-priorities`, { type: 'json' });
        if (apData) {
          response.agreedPriorities = apData.agreedPriorities;
          response.reviewDate = apData.reviewDate;
        }
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response) };
    }

    // Phase 4: manager-progress token (optional progress reflection)
    if (payload.role === 'manager-progress') {
      const sessionStore = getSessionStore();
      const meta = await sessionStore.get(`${payload.sessionId}/metadata`, { type: 'json' });
      if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

      if (meta.currentProgressManagerInviteKey !== token) {
        return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'This invitation link has been superseded. Please use your most recent invitation email.' }) };
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({
        role: 'manager-progress',
        sessionId: payload.sessionId,
        status: meta.status,
        firmName: meta.firmName,
        discipline: meta.discipline,
        monthsInRole: meta.monthsInRole,
        progressManagerSubmitted: !!meta.progressManagerCompletedAt
      }) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unsupported role for session load' }) };

  } catch (err) {
    console.error('[p1-session-load] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not load session' }) };
  }
};
