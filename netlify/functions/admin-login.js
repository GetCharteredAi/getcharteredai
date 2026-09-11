const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function generateToken(payload, jwtSecret) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { email, password, plan } = JSON.parse(event.body);

    const adminPass = process.env.ADMIN_TEST_KEY;
    if (!adminPass || email !== 'test@getcharteredai.com' || password !== adminPass) {
      return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Unauthorised' }) };
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET not configured');

    const validPlans = ['annual', 'monthly', 'sprint', 'referred', 'year-one', 'apprentice', 'benchmark'];
    const resolvedPlan = validPlans.includes(plan) ? plan : 'annual';

    // ── Benchmark: create a fresh isolated test Part One session ─────────────
    if (resolvedPlan === 'benchmark') {
      const now = Date.now();
      const sessionId = 'p1-test-' + crypto.randomBytes(4).toString('hex');

      const meta = {
        schemaVersion: 'benchmark-v1',
        sessionId,
        cohortId: null,
        firmName: '[TEST] GCA Internal',
        candidateEmail: 'test@getcharteredai.com',
        managerEmail: 'test@getcharteredai.com',
        employerEmail: 'test@getcharteredai.com',
        candidateName: null,
        managerName: null,
        team: null,
        office: null,
        employmentType: 'apprentice',
        discipline: 'APC',
        employmentStartDate: '2025-09-01',
        monthsInRole: 12,
        status: 'invited',
        createdAt: now,
        candidateInviteKey: null,
        candidateStartedAt: null,
        candidateCompletedAt: null,
        managerInvitedAt: null,
        currentManagerInviteKey: null,
        managerCompletedAt: null,
        synthesisStartedAt: null,
        synthesisCompletedAt: null,
        reminderEmail2SentAt: null,
        reminderEmail4SentAt: null,
        selfPlanSetAt: null,
        selfPlanReviewDate: null,
        progressReflectionSentAt: null
      };

      const sessionStore = getSessionStore();
      await sessionStore.setJSON(`${sessionId}/metadata`, meta);

      const candidatePayload = {
        sessionId,
        role: 'candidate',
        email: 'test@getcharteredai.com',
        expires: now + 30 * 24 * 60 * 60 * 1000
      };
      const candidateToken = generateToken(candidatePayload, jwtSecret);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, token: candidateToken, email: 'test@getcharteredai.com', plan: 'benchmark' })
      };
    }

    // ── Standard test plans ──────────────────────────────────────────────────
    const activatedAt = Date.now();
    const payload = {
      email: 'test@getcharteredai.com',
      plan: resolvedPlan,
      activatedAt,
      expires: activatedAt + 365 * 24 * 60 * 60 * 1000
    };

    const token = generateToken(payload, jwtSecret);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, token, email: payload.email, plan: resolvedPlan, activatedAt })
    };
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
