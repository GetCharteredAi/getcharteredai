/**
 * Focused mocked-storage tests for netlify/functions/get-manager-lesson.js
 * No real Blobs, no network calls.
 */

import { createRequire } from 'module';
import path   from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import crypto from 'crypto';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const require    = createRequire(import.meta.url);

const FUNC_PATH   = path.resolve(__dirname, '../netlify/functions/get-manager-lesson.js');
const BLOBS_PATH  = require.resolve('@netlify/blobs');
const LOADER_PATH = path.resolve(__dirname, '../netlify/functions/utils/lessons-loader.js');

// ── Mock store factory ─────────────────────────────────────────────────────────

function createMockBlobs(storage) {
  return {
    getStore: (nameOrOpts) => {
      const name = typeof nameOrOpts === 'string' ? nameOrOpts : nameOrOpts.name;
      return {
        get: async (key) => {
          const k = `${name}::${key}`;
          return k in storage ? JSON.parse(JSON.stringify(storage[k])) : null;
        }
      };
    }
  };
}

function loadHandler(storage, topics = []) {
  delete require.cache[FUNC_PATH];
  delete require.cache[LOADER_PATH];
  require.cache[BLOBS_PATH] = {
    id: BLOBS_PATH, filename: BLOBS_PATH, loaded: true,
    exports: createMockBlobs(storage)
  };
  require.cache[LOADER_PATH] = {
    id: LOADER_PATH, filename: LOADER_PATH, loaded: true,
    exports: { loadPublishedTopics: () => topics }
  };
  process.env.JWT_SECRET            = 'test-secret';
  process.env.P1_STORE_PREFIX       = '';
  process.env.NETLIFY_BLOBS_CONTEXT = 'dummy';
  return require(FUNC_PATH).handler;
}

// Injects a loader that throws, simulating a missing or malformed data file.
function loadHandlerBroken(storage) {
  delete require.cache[FUNC_PATH];
  delete require.cache[LOADER_PATH];
  require.cache[BLOBS_PATH] = {
    id: BLOBS_PATH, filename: BLOBS_PATH, loaded: true,
    exports: createMockBlobs(storage)
  };
  require.cache[LOADER_PATH] = {
    id: LOADER_PATH, filename: LOADER_PATH, loaded: true,
    exports: { loadPublishedTopics: () => { throw new Error('Data file is not valid JSON: unexpected token'); } }
  };
  process.env.JWT_SECRET            = 'test-secret';
  process.env.P1_STORE_PREFIX       = '';
  process.env.NETLIFY_BLOBS_CONTEXT = 'dummy';
  return require(FUNC_PATH).handler;
}

function post(storage, body) {
  return loadHandler(storage)({ httpMethod: 'POST', body: JSON.stringify(body) });
}

// ── Token helpers ──────────────────────────────────────────────────────────────

const SECRET = 'test-secret';

function makeLearningToken(payload, secret = SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

function makeLegacySigToken(payload, secret = SECRET) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = Buffer.from(`${tokenData}.${secret}`).toString('base64').slice(0, 32);
  return `${tokenData}.${sig}`;
}

// ── Seed helpers ───────────────────────────────────────────────────────────────

const TEST_EMAIL    = 'manager@testfirm.local';
const TEST_EMPLOYER = crypto.randomUUID();

function makeLearningPayload(overrides = {}) {
  return {
    role:        'manager-learning',
    email:       TEST_EMAIL,
    employerKey: TEST_EMPLOYER,
    expires:     Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides
  };
}

function seedActiveState(storage, { email = TEST_EMAIL, employerKey = TEST_EMPLOYER } = {}) {
  const emailKey  = Buffer.from(email).toString('base64url');
  const rosterKey = `${employerKey}/${emailKey}`;
  storage[`p1-employer-agreements::${employerKey}`] = {
    employerKey, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  storage[`p1-manager-roster::${rosterKey}`] = { email, employerKey, active: true };
}

// ── Test runner ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result
      .then(() => { console.log(`  PASS  ${name}`); passed++; })
      .catch(e  => { console.error(`  FAIL  ${name}`); console.error(`        ${e.message}`); failed++; });
  }
  console.log(`  PASS  ${name}`);
  passed++;
  return Promise.resolve();
}

// ── Method and input validation ────────────────────────────────────────────────

console.log('\nMethod and input validation');

await test('T01 OPTIONS → 200', async () => {
  const storage = {};
  const res = await loadHandler(storage)({ httpMethod: 'OPTIONS', body: '' });
  assert.strictEqual(res.statusCode, 200);
});

await test('T02 GET → 405', async () => {
  const storage = {};
  const res = await loadHandler(storage)({ httpMethod: 'GET', body: '' });
  assert.strictEqual(res.statusCode, 405);
});

await test('T03 invalid JSON body → 400', async () => {
  const storage = {};
  const res = await loadHandler(storage)({ httpMethod: 'POST', body: 'not-json' });
  assert.strictEqual(res.statusCode, 400);
});

await test('T04 missing token → 401', async () => {
  const res = await post({}, {});
  assert.strictEqual(res.statusCode, 401);
});

// ── Token verification ─────────────────────────────────────────────────────────

console.log('\nToken verification');

await test('T05 wrong HMAC signature → 401', async () => {
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload, 'wrong-secret');
  const res     = await post({}, { token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T06 legacySig token → 401 (rejected after HMAC fix)', async () => {
  const payload = makeLearningPayload();
  const token   = makeLegacySigToken(payload);
  const res     = await post({}, { token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T07 missing expires field → 401', async () => {
  const { expires: _, ...bare } = makeLearningPayload();
  const token = makeLearningToken(bare);
  const res   = await post({}, { token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T08 past expiry → 401', async () => {
  const payload = makeLearningPayload({ expires: Date.now() - 1000 });
  const token   = makeLearningToken(payload);
  const res     = await post({}, { token });
  assert.strictEqual(res.statusCode, 401);
});

await test('T09 wrong role → 403', async () => {
  const payload = makeLearningPayload({ role: 'manager-invite' });
  const token   = makeLearningToken(payload);
  const res     = await post({}, { token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T10 malformed employerKey → 403', async () => {
  const payload = makeLearningPayload({ employerKey: 'not-a-uuid' });
  const token   = makeLearningToken(payload);
  const res     = await post({}, { token });
  assert.strictEqual(res.statusCode, 403);
});

// ── Agreement and roster checks ────────────────────────────────────────────────

console.log('\nAgreement and roster checks');

await test('T11 agreement not found → 403', async () => {
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const res     = await post({}, { token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T12 agreement inactive → 403', async () => {
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const storage = {};
  storage[`p1-employer-agreements::${TEST_EMPLOYER}`] = {
    employerKey: TEST_EMPLOYER, serviceActive: false,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  const res = await post(storage, { token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T13 agreement expired → 403', async () => {
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const storage = {};
  storage[`p1-employer-agreements::${TEST_EMPLOYER}`] = {
    employerKey: TEST_EMPLOYER, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() - 1000).toISOString()
  };
  const res = await post(storage, { token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T14 roster entry missing → 403', async () => {
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const storage = {};
  storage[`p1-employer-agreements::${TEST_EMPLOYER}`] = {
    employerKey: TEST_EMPLOYER, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  const res = await post(storage, { token });
  assert.strictEqual(res.statusCode, 403);
});

await test('T15 roster entry inactive → 403', async () => {
  const payload   = makeLearningPayload();
  const token     = makeLearningToken(payload);
  const storage   = {};
  const emailKey  = Buffer.from(TEST_EMAIL).toString('base64url');
  const rosterKey = `${TEST_EMPLOYER}/${emailKey}`;
  storage[`p1-employer-agreements::${TEST_EMPLOYER}`] = {
    employerKey: TEST_EMPLOYER, serviceActive: true,
    serviceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  storage[`p1-manager-roster::${rosterKey}`] = { email: TEST_EMAIL, employerKey: TEST_EMPLOYER, active: false };
  const res = await post(storage, { token });
  assert.strictEqual(res.statusCode, 403);
});

// ── Valid access ───────────────────────────────────────────────────────────────

console.log('\nValid access');

await test('T16 valid token → 200 with { authorized: true, topics: [] }', async () => {
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const storage = {};
  seedActiveState(storage);
  const res  = await post(storage, { token });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.authorized, true);
  assert.deepStrictEqual(body.topics, []);
});

await test('T17 employer isolation: token for employer A rejected against employer B storage', async () => {
  const employerA = crypto.randomUUID();
  const employerB = crypto.randomUUID();
  // Token claims employerA; storage only has employerB records
  const payload   = makeLearningPayload({ employerKey: employerA });
  const token     = makeLearningToken(payload);
  const storage   = {};
  seedActiveState(storage, { email: TEST_EMAIL, employerKey: employerB });
  const res = await post(storage, { token });
  // employerA agreement not found
  assert.strictEqual(res.statusCode, 403);
});

// ── Phase B fixtures ───────────────────────────────────────────────────────────

const PRACTICE_CHARACTER = {
  name:            'Priya Kapoor',
  yearDescription: 'second-year APC candidate',
  pathway:         'Building Surveying',
  scenarioContext: 'Priya has missed two CPD deadlines and seems disengaged in supervision sessions.'
};

// A fully-structured published topic with all three section types.
const PUBLISHED_TOPIC = {
  id:        'topic-gcf-01',
  title:     'Giving Constructive Feedback',
  published: true,
  sections:  [
    { sectionType: 'content',  body: '<p>Introduction</p>' },
    { sectionType: 'reflect',  reflectionPrompt: 'Think about a recent feedback conversation.' },
    {
      sectionType:       'practice',
      practicePrompt:    'You are about to speak with Priya.',
      practiceCharacter: PRACTICE_CHARACTER
    }
  ]
};

// ── Phase B: content and field-stripping tests ─────────────────────────────────

console.log('\nPhase B: published content and field stripping');

await test('T18 published topic returned — 200 with one topic in response', async () => {
  const storage = {};
  seedActiveState(storage);
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const handler = loadHandler(storage, [PUBLISHED_TOPIC]);
  const res  = await handler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.authorized, true);
  assert.strictEqual(body.topics.length, 1);
  assert.strictEqual(body.topics[0].id, 'topic-gcf-01');
});

await test('T19 practiceCharacter absent from client response', async () => {
  const storage = {};
  seedActiveState(storage);
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const handler = loadHandler(storage, [PUBLISHED_TOPIC]);
  const res  = await handler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  assert.strictEqual(res.statusCode, 200);
  const sections = JSON.parse(res.body).topics[0].sections;
  for (const section of sections) {
    assert.ok(!Object.prototype.hasOwnProperty.call(section, 'practiceCharacter'),
      `section sectionType=${section.sectionType} must not expose practiceCharacter`);
  }
});

await test('T20 practicePrompt retained in practice section (client-visible setup)', async () => {
  const storage = {};
  seedActiveState(storage);
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const handler = loadHandler(storage, [PUBLISHED_TOPIC]);
  const res  = await handler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  const sections = JSON.parse(res.body).topics[0].sections;
  const practice = sections.find(s => s.sectionType === 'practice');
  assert.ok(practice, 'practice section must be present');
  assert.strictEqual(practice.practicePrompt, 'You are about to speak with Priya.');
});

await test('T21 reflectionPrompt retained in reflect section (client-visible)', async () => {
  const storage = {};
  seedActiveState(storage);
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const handler = loadHandler(storage, [PUBLISHED_TOPIC]);
  const res  = await handler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  const sections = JSON.parse(res.body).topics[0].sections;
  const reflect = sections.find(s => s.sectionType === 'reflect');
  assert.ok(reflect, 'reflect section must be present');
  assert.strictEqual(reflect.reflectionPrompt, 'Think about a recent feedback conversation.');
});

await test('T22 malformed published topic (no sections) — 503, error logged, no partial list', async () => {
  const storage = {};
  seedActiveState(storage);
  // A topic missing the sections array is structurally invalid.
  const malformed = { id: 'topic-bad', title: 'No sections here', published: true };
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const handler = loadHandler(storage, [malformed]);

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  let res;
  try {
    res = await handler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  } finally {
    console.error = origError;
  }

  assert.strictEqual(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.ok(!body.topics, 'no topic list must be present in a 503 response');
  assert.ok(errors.some(e => e.includes('topic-bad')),
    `expected server error log referencing "topic-bad", got: ${errors.join('; ')}`);
});

await test('T23 malformed lesson data (loader throws) → 503 after auth passes', async () => {
  const storage = {};
  seedActiveState(storage);
  const payload = makeLearningPayload();
  const token   = makeLearningToken(payload);
  const handler = loadHandlerBroken(storage);
  const res  = await handler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  assert.strictEqual(res.statusCode, 503);
  assert.ok(JSON.parse(res.body).error.includes('unavailable'));
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
