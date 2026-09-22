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

    const validPlans = ['annual', 'monthly', 'sprint', 'referred', 'selfpaced', 'year-one', 'apprentice', 'benchmark', 'benchmark-manager', 'benchmark-manager-return'];
    const resolvedPlan = validPlans.includes(plan) ? plan : 'annual';

    // ── Benchmark Manager Return: find most recent test session where manager completed ──
    if (resolvedPlan === 'benchmark-manager-return') {
      const sessionStore = getSessionStore();
      const { blobs } = await sessionStore.list({ prefix: 'p1-test-' });
      const metaKeys = blobs.map(b => b.key).filter(k => k.endsWith('/metadata'));
      const metas = (await Promise.all(
        metaKeys.map(k => sessionStore.get(k, { type: 'json' }).catch(() => null))
      ))
        .filter(m => m && m.sessionId?.startsWith('p1-test-') && m.managerCompletedAt)
        .sort((a, b) => (b.managerCompletedAt || 0) - (a.managerCompletedAt || 0));
      if (!metas.length) {
        return { statusCode: 404, body: JSON.stringify({ success: false, error: 'No completed manager session found — run the manager flow first' }) };
      }
      const meta = metas[0];
      const now = Date.now();
      const candidateToken = generateToken(
        { sessionId: meta.sessionId, role: 'candidate', email: meta.candidateEmail, expires: now + 30 * 24 * 60 * 60 * 1000 },
        jwtSecret
      );
      return { statusCode: 200, body: JSON.stringify({ success: true, candidateToken, sessionId: meta.sessionId, plan: 'benchmark-manager-return' }) };
    }

    // ── Benchmark Manager: create session pre-seeded at awaiting-manager ─────
    if (resolvedPlan === 'benchmark-manager') {
      const now = Date.now();
      const sessionId = 'p1-test-' + crypto.randomBytes(4).toString('hex');
      const MANAGER_TTL = 14 * 24 * 60 * 60 * 1000;

      const managerToken = generateToken(
        { sessionId, role: 'manager', email: 'contact@gcaitutor.com', expires: now + MANAGER_TTL },
        jwtSecret
      );
      const candidateToken = generateToken(
        { sessionId, role: 'candidate', email: 'test@getcharteredai.com', expires: now + 30 * 24 * 60 * 60 * 1000 },
        jwtSecret
      );

      const meta = {
        schemaVersion: 'benchmark-v1',
        sessionId,
        cohortId: null,
        firmName: '[TEST] GCA Internal',
        candidateEmail: 'test@getcharteredai.com',
        managerEmail: 'contact@gcaitutor.com',
        employerEmail: 'test@getcharteredai.com',
        candidateName: 'Test Apprentice',
        managerName: null,
        team: null,
        office: null,
        employmentType: 'apprentice',
        discipline: 'Building Surveying',
        employmentStartDate: '2025-09-01',
        monthsInRole: 12,
        status: 'awaiting-manager',
        createdAt: now,
        candidateInviteKey: null,
        candidateStartedAt: now,
        candidateCompletedAt: now,
        candidateSelectedPriority: 'Communication & Working With Others',
        managerInvitedAt: now,
        currentManagerInviteKey: managerToken,
        managerCompletedAt: null,
        synthesisStartedAt: null,
        synthesisCompletedAt: null,
        reminderEmail2SentAt: null,
        reminderEmail4SentAt: null,
        selfPlanSetAt: null,
        selfPlanReviewDate: null,
        progressReflectionSentAt: null
      };

      const managerSafe = {
        schemaVersion: 'benchmark-v1',
        areaStatuses: [
          { id: 1, name: 'Professional Behaviour & Responsibility', outcome: 'ON TRACK' },
          { id: 2, name: 'Communication & Working With Others', outcome: 'DEVELOPING' },
          { id: 3, name: 'Learning & Applying Knowledge', outcome: 'ON TRACK' },
          { id: 4, name: 'Judgement, Help & Escalation', outcome: 'DEVELOPING' },
          { id: 5, name: 'Feedback, Reflection & Development', outcome: 'NOT YET ENOUGH EXPOSURE' }
        ],
        developmentThemes: [
          'Professional conduct and ownership of role responsibilities are progressing appropriately for this stage of development',
          'Communication in more complex or unfamiliar client-facing situations is an area where further development would be beneficial',
          'Judgement around when to continue independently versus when to seek guidance is developing, with continued exposure to varied situations likely to consolidate this'
        ],
        suggestedConversationPoints: [
          'How the individual is finding client-facing communication and what situations they find most challenging',
          'How they currently decide when to escalate a query versus continue independently'
        ],
        recommendedActions: [
          'Create structured opportunities for client communication with debrief support',
          'Share examples of escalation judgement from your own experience to build their decision-making framework'
        ],
        sharedDevelopmentPriorities: [
          {
            rank: 1,
            priority: 'Developing confidence and clarity in client-facing communication',
            why: 'Communication in client-facing contexts is identified as the area with the most active development opportunity at this stage of their Building Surveying career',
            managerRole: 'Create low-stakes opportunities for client interaction and provide structured feedback afterwards'
          },
          {
            rank: 2,
            priority: 'Building independent judgement around escalation and decision-making',
            why: 'Knowing when to continue independently and when to escalate is a threshold competency at this stage and is still actively developing',
            managerRole: 'Discuss real examples of decision points together and share your own reasoning to model the thought process'
          }
        ]
      };

      const sessionStore = getSessionStore();
      await sessionStore.setJSON(`${sessionId}/metadata`, meta);
      await sessionStore.setJSON(`${sessionId}/manager-safe`, { managerSafe });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, managerToken, candidateToken, plan: 'benchmark-manager' })
      };
    }

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
        managerEmail: 'contact@gcaitutor.com',
        employerEmail: 'test@getcharteredai.com',
        candidateName: null,
        managerName: null,
        team: null,
        office: null,
        employmentType: 'apprentice',
        discipline: 'Building Surveying',
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

    // Test pathway — matches the default set on line 2949 of index.html
    const TEST_PATHWAY = 'Valuation';
    const pathwayPlans = new Set(['annual', 'monthly', 'sprint', 'referred', 'selfpaced']);

    const payload = {
      email: 'test@getcharteredai.com',
      plan: resolvedPlan,
      activatedAt,
      expires: activatedAt + 365 * 24 * 60 * 60 * 1000,
      ...(pathwayPlans.has(resolvedPlan) ? { pathway: TEST_PATHWAY } : {}),
    };

    const token = generateToken(payload, jwtSecret);

    // For selfpaced: create a test Blobs record with all 12 modules unlocked so every
    // module is accessible during testing without needing real unlock purchases.
    if (resolvedPlan === 'selfpaced') {
      try {
        const spStore = process.env.NETLIFY_BLOBS_CONTEXT
          ? getStore('selfpaced-progress')
          : getStore({ name: 'selfpaced-progress', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
        await spStore.set('test@getcharteredai.com', JSON.stringify({
          customerId: 'test',
          paymentMethodId: 'test',
          unlockedModules: [1,2,3,4,5,6,7,8,9,10,11,12],
          createdAt: activatedAt,
          isTestRecord: true,
        }));
      } catch (e) {
        console.warn('[admin-login] selfpaced Blobs write failed (non-fatal):', e.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, token, email: payload.email, plan: resolvedPlan, activatedAt })
    };
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
