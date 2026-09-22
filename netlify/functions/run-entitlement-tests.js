// netlify/functions/run-entitlement-tests.js
// Phase 1 authenticated entitlement test runner.
// Runs entirely server-side using secrets already in the Netlify environment.
// Safety guard: blocked in production. Remove this file before or after merge to main.

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  // ── Safety guards ─────────────────────────────────────────────────────────
  // Block in production — this endpoint must never run on the live site.
  if (process.env.CONTEXT === 'production') {
    return { statusCode: 403, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Test runner not available in production' }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'POST only' }) };
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'JWT_SECRET not configured' }) };
  }

  // Derive the deploy URL from the incoming request host — works for branch
  // deploys and PR previews where DEPLOY_URL may not be set.
  const host = event.headers['x-forwarded-host'] || event.headers['host'] || '';
  const deployUrl = host ? `https://${host}` : (process.env.DEPLOY_URL || process.env.URL || '').replace(/\/$/, '');
  if (!deployUrl) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not determine deploy URL' }) };
  }

  // ── Token factory ─────────────────────────────────────────────────────────
  // Signs tokens with the same HMAC-SHA256 mechanism as verify-session.js.
  // No secrets appear in any output.
  const now = Date.now();
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

  function makeToken(payload) {
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
    return `${tokenData}.${sig}`;
  }

  const TEST_EMAIL = 'test@getcharteredai.com';

  const tokens = {
    annual:         makeToken({ email: TEST_EMAIL, plan: 'annual',    activatedAt: now,                           expires: now + ONE_YEAR }),
    monthlyFresh:   makeToken({ email: TEST_EMAIL, plan: 'monthly',   activatedAt: now,                           expires: now + ONE_YEAR }),
    monthly2mo:     makeToken({ email: TEST_EMAIL, plan: 'monthly',   activatedAt: now - 60 * 24 * 60 * 60 * 1000, expires: now + ONE_YEAR }),
    sprintWithPath: makeToken({ email: TEST_EMAIL, plan: 'sprint',    activatedAt: now, pathway: 'Valuation',     expires: now + ONE_YEAR }),
    sprintNoPath:   makeToken({ email: TEST_EMAIL, plan: 'sprint',    activatedAt: now,                           expires: now + ONE_YEAR }), // old-format: no pathway field
    referred:       makeToken({ email: TEST_EMAIL, plan: 'referred',  activatedAt: now,                           expires: now + ONE_YEAR }),
    selfpaced:      makeToken({ email: TEST_EMAIL, plan: 'selfpaced', activatedAt: now,                           expires: now + ONE_YEAR }),
    yearOne:        makeToken({ email: TEST_EMAIL, plan: 'year-one',  activatedAt: now,                           expires: now + ONE_YEAR }),
  };

  // ── Selfpaced Blobs setup ─────────────────────────────────────────────────
  // Write a test record with all 12 modules unlocked for the test account.
  // This only affects test@getcharteredai.com — no real customer data is touched.
  let selfpacedSetup = 'ok';
  try {
    const store = process.env.NETLIFY_BLOBS_CONTEXT
      ? getStore('selfpaced-progress')
      : getStore({ name: 'selfpaced-progress', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
    await store.set(TEST_EMAIL, JSON.stringify({
      customerId: 'test', paymentMethodId: 'test',
      unlockedModules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      createdAt: now, isTestRecord: true,
    }));
  } catch (e) {
    selfpacedSetup = `blobs-write-failed: ${e.message}`;
  }

  // ── Test runner ───────────────────────────────────────────────────────────
  async function callLesson(tokenKey, moduleId) {
    try {
      const r = await fetch(`${deployUrl}/.netlify/functions/get-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokens[tokenKey], moduleId }),
      });
      let body = {};
      try { body = await r.json(); } catch {}
      return { status: r.status, code: body.code || null };
    } catch (e) {
      return { status: 'ERROR', code: e.message };
    }
  }

  const results = [];

  async function check(label, tokenKey, moduleId, expectStatus) {
    const { status, code } = await callLesson(tokenKey, moduleId);
    const pass = status === expectStatus;
    results.push({ pass, label, status, code, expected: expectStatus });
  }

  // ── Annual ────────────────────────────────────────────────────────────────
  await check('annual       mod 1  permitted',  'annual', 1,  200);
  await check('annual       mod 5  permitted',  'annual', 5,  200);
  await check('annual       mod 12 permitted',  'annual', 12, 200);
  await check('annual       mod 13 denied',     'annual', 13, 403);
  await check('annual       mod 36 denied',     'annual', 36, 403);

  // ── Monthly (fresh — 1 month = 1 module unlocked) ─────────────────────────
  await check('monthly(1mo) mod 1  permitted',  'monthlyFresh', 1, 200);
  await check('monthly(1mo) mod 2  denied',     'monthlyFresh', 2, 403);

  // ── Monthly (2 months in — floor(60/30)+1 = 3 modules unlocked) ───────────
  await check('monthly(2mo) mod 3  permitted',  'monthly2mo', 3, 200);
  await check('monthly(2mo) mod 4  denied',     'monthly2mo', 4, 403);

  // ── Sprint with pathway field (new-format token) ──────────────────────────
  await check('sprint(+path) mod 1  permitted', 'sprintWithPath', 1,  200);
  await check('sprint(+path) mod 12 permitted', 'sprintWithPath', 12, 200);
  await check('sprint(+path) mod 3  denied',    'sprintWithPath', 3,  403);
  await check('sprint(+path) mod 13 denied',    'sprintWithPath', 13, 403);

  // ── Sprint WITHOUT pathway field (old-format token — existing customers) ──
  await check('sprint(NO path) mod 1  permitted', 'sprintNoPath', 1,  200);
  await check('sprint(NO path) mod 12 permitted', 'sprintNoPath', 12, 200);
  await check('sprint(NO path) mod 5  denied',    'sprintNoPath', 5,  403);

  // ── Referred ──────────────────────────────────────────────────────────────
  await check('referred     mod 12 permitted',  'referred', 12, 200);
  await check('referred     mod 13 permitted',  'referred', 13, 200);
  await check('referred     mod 16 permitted',  'referred', 16, 200);
  await check('referred     mod 36 permitted',  'referred', 36, 200);
  await check('referred     mod 1  denied',     'referred', 1,  403);
  await check('referred     mod 5  denied',     'referred', 5,  403);

  // ── Self-Paced (test account: all 12 unlocked) ────────────────────────────
  await check('selfpaced    mod 1  permitted',  'selfpaced', 1,  200);
  await check('selfpaced    mod 6  permitted',  'selfpaced', 6,  200);
  await check('selfpaced    mod 12 permitted',  'selfpaced', 12, 200);
  await check('selfpaced    mod 13 denied',     'selfpaced', 13, 403);

  // ── Year-one (wrong plan — uses own page) ─────────────────────────────────
  await check('year-one     mod 1  denied',     'yearOne', 1, 403);

  // ── Cross-plan boundary checks ────────────────────────────────────────────
  await check('referred token → mod 3  (annual only) denied',    'referred',       3,  403);
  await check('sprint token  → mod 15 (referred only) denied',   'sprintWithPath', 15, 403);
  await check('annual token  → mod 36 (referred only) denied',   'annual',         36, 403);

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return {
    statusCode: failed > 0 ? 207 : 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: { passed, failed, total: results.length, selfpacedSetup },
      results: results.map(r => ({
        pass: r.pass,
        label: r.label,
        status: r.status,
        expected: r.expected,
        ...(r.code ? { code: r.code } : {}),
      })),
    }, null, 2),
  };
};
