/**
 * Focused unit tests for create-mgr-learning-test-draft.mjs
 *
 * All storage access is replaced with in-memory mock stores.
 * No network calls, no production Blobs, no external email.
 */

import assert from 'assert';
import crypto  from 'crypto';

import {
  checkBlobsContext,
  checkLocalSiteUrl,
  createTestFixture
} from './create-mgr-learning-test.mjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStore() {
  const data = {};
  return {
    setJSON: async (key, val) => { data[key] = JSON.parse(JSON.stringify(val)); return { modified: true }; },
    get:     async (key)      => data[key] !== undefined ? JSON.parse(JSON.stringify(data[key])) : null,
    _data:   data
  };
}

function makeStores() {
  return {
    agreementStore: makeStore(),
    rosterStore:    makeStore(),
    magicStore:     makeStore(),
    emailIdxStore:  makeStore()
  };
}

// Valid base64-encoded JSON context matching what `netlify dev` produces:
// edgeURL pointing at the local blob server.
const LOCAL_BLOBS_ENV = {
  NETLIFY_BLOBS_CONTEXT: Buffer.from(JSON.stringify({
    edgeURL:         'http://localhost:8888/.netlify/blobs',
    uncachedEdgeURL: 'http://localhost:8888/.netlify/blobs',
    siteID:          'test-site-id',
    token:           'test-token'
  })).toString('base64')
};

// Context with edgeURL pointing to production — should be rejected.
const PROD_BLOBS_ENV = {
  NETLIFY_BLOBS_CONTEXT: Buffer.from(JSON.stringify({
    edgeURL: 'https://api.netlify.com',
    siteID:  'live-site-id',
    token:   'live-token'
  })).toString('base64')
};

// Context with no edgeURL — SDK would route to production API.
const NO_EDGE_URL_ENV = {
  NETLIFY_BLOBS_CONTEXT: Buffer.from(JSON.stringify({
    siteID: 'live-site-id',
    token:  'live-token'
  })).toString('base64')
};

function decodeToken(token) {
  const lastDot = token.lastIndexOf('.');
  return JSON.parse(Buffer.from(token.slice(0, lastDot), 'base64').toString('utf8'));
}

const TEST_EMAIL      = 'manager@testfirm.local';
const TEST_EMPLOYER   = crypto.randomUUID();
const TEST_JWT_SECRET = 'test-secret-local-only';
const LOCAL_SITE_URL  = 'http://localhost:8888';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log(`  PASS  ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  FAIL  ${name}`);
        console.error(`        ${err.message}`);
        failed++;
      });
    }
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
  return Promise.resolve();
}

// ── checkLocalSiteUrl ─────────────────────────────────────────────────────────

console.log('\ncheckLocalSiteUrl');

await test('T01 accepts http://localhost:8888', () => {
  assert.strictEqual(checkLocalSiteUrl('http://localhost:8888'), null);
});

await test('T02 accepts http://127.0.0.1:3000', () => {
  assert.strictEqual(checkLocalSiteUrl('http://127.0.0.1:3000'), null);
});

await test('T03 accepts http://myapp.local:5000', () => {
  assert.strictEqual(checkLocalSiteUrl('http://myapp.local:5000'), null);
});

await test('T04 rejects https://localhost:8888 — HTTPS not accepted for local dev', () => {
  const result = checkLocalSiteUrl('https://localhost:8888');
  assert.ok(Array.isArray(result), 'expected error array');
  assert.ok(result[0].includes('https') || result[0].includes('http'), 'should mention protocol');
});

await test('T05 rejects http://getcharteredai.com — non-local hostname', () => {
  const result = checkLocalSiteUrl('http://getcharteredai.com');
  assert.ok(Array.isArray(result), 'expected error array');
  assert.ok(result[0].includes('getcharteredai.com'), 'should name the rejected host');
});

await test('T06 rejects invalid URL string', () => {
  const result = checkLocalSiteUrl('not-a-url');
  assert.ok(Array.isArray(result), 'expected error array');
});

// ── checkBlobsContext ─────────────────────────────────────────────────────────

console.log('\ncheckBlobsContext');

await test('T07 rejects when NETLIFY_BLOBS_CONTEXT is not set', () => {
  const result = checkBlobsContext({});
  assert.ok(Array.isArray(result), 'expected error array');
  assert.ok(result[0].includes('NETLIFY_BLOBS_CONTEXT'), 'should name the env var');
});

await test('T08 rejects NETLIFY_BLOBS_CONTEXT=1 — not valid base64 JSON', () => {
  // Buffer.from('1','base64') → empty buffer → empty string → JSON.parse throws
  const result = checkBlobsContext({ NETLIFY_BLOBS_CONTEXT: '1' });
  assert.ok(Array.isArray(result), 'expected error array');
  assert.ok(result.some(l => l.includes('base64') || l.includes('JSON')), 'should explain decode failure');
});

await test('T09 rejects context with no edgeURL — SDK would route to production API', () => {
  const result = checkBlobsContext(NO_EDGE_URL_ENV);
  assert.ok(Array.isArray(result), 'expected error array');
  assert.ok(result.some(l => l.includes('edgeURL')), 'should mention edgeURL');
});

await test('T10 rejects context with non-local edgeURL', () => {
  const result = checkBlobsContext(PROD_BLOBS_ENV);
  assert.ok(Array.isArray(result), 'expected error array');
  assert.ok(result.some(l => l.includes('api.netlify.com') || l.includes('not a local')), 'should name the bad host');
});

await test('T11 accepts valid local context from netlify dev', () => {
  assert.strictEqual(checkBlobsContext(LOCAL_BLOBS_ENV), null);
});

// ── createTestFixture — safety and validation ─────────────────────────────────

console.log('\ncreateTestFixture — safety and validation');

await test('T12 returns error when siteUrl is a production address', async () => {
  const result = await createTestFixture(
    { email: TEST_EMAIL, siteUrl: 'http://getcharteredai.com', jwtSecret: TEST_JWT_SECRET, env: LOCAL_BLOBS_ENV },
    makeStores()
  );
  assert.strictEqual(result.exitCode, 1);
  assert.ok(result.messages.some(l => l.includes('getcharteredai.com')));
});

await test('T13 returns error when NETLIFY_BLOBS_CONTEXT is unsafe', async () => {
  const result = await createTestFixture(
    { email: TEST_EMAIL, siteUrl: LOCAL_SITE_URL, jwtSecret: TEST_JWT_SECRET, env: {} },
    makeStores()
  );
  assert.strictEqual(result.exitCode, 1);
  assert.ok(result.messages.some(l => l.includes('NETLIFY_BLOBS_CONTEXT')));
});

await test('T14 returns error when jwtSecret is missing', async () => {
  const result = await createTestFixture(
    { email: TEST_EMAIL, siteUrl: LOCAL_SITE_URL, jwtSecret: '', env: LOCAL_BLOBS_ENV },
    makeStores()
  );
  assert.strictEqual(result.exitCode, 1);
  assert.ok(result.messages.some(l => l.includes('JWT_SECRET')));
});

await test('T15 returns error when email is invalid', async () => {
  const result = await createTestFixture(
    { email: 'not-an-email', siteUrl: LOCAL_SITE_URL, jwtSecret: TEST_JWT_SECRET, env: LOCAL_BLOBS_ENV },
    makeStores()
  );
  assert.strictEqual(result.exitCode, 1);
  assert.ok(result.messages.some(l => l.includes('email')));
});

await test('T16 returns error when employerKey is not a valid UUID', async () => {
  const result = await createTestFixture(
    { email: TEST_EMAIL, employerKey: 'bad-key', siteUrl: LOCAL_SITE_URL, jwtSecret: TEST_JWT_SECRET, env: LOCAL_BLOBS_ENV },
    makeStores()
  );
  assert.strictEqual(result.exitCode, 1);
  assert.ok(result.messages.some(l => l.includes('employer-key') || l.includes('UUID')));
});

// ── createTestFixture — successful creation ───────────────────────────────────

console.log('\ncreateTestFixture — successful creation');

// Run one successful fixture for all success tests to share
const successStores = makeStores();
const successResult = await createTestFixture(
  {
    email:       TEST_EMAIL,
    employerKey: TEST_EMPLOYER,
    siteUrl:     LOCAL_SITE_URL,
    jwtSecret:   TEST_JWT_SECRET,
    env:         LOCAL_BLOBS_ENV
  },
  successStores
);

await test('T17 exitCode is 0', () => {
  assert.strictEqual(successResult.exitCode, 0);
});

await test('T18 agreementStore has agreement keyed by employerKey', () => {
  const ag = successStores.agreementStore._data[TEST_EMPLOYER];
  assert.ok(ag, 'agreement missing');
  assert.strictEqual(ag.employerKey, TEST_EMPLOYER);
  assert.strictEqual(ag.serviceActive, true);
});

await test('T19 rosterStore has active roster entry for the email', () => {
  const rosterKey = `${TEST_EMPLOYER}/${Buffer.from(TEST_EMAIL.toLowerCase()).toString('base64url')}`;
  const entry = successStores.rosterStore._data[rosterKey];
  assert.ok(entry, 'roster entry missing');
  assert.strictEqual(entry.active, true);
  assert.strictEqual(entry.email, TEST_EMAIL.toLowerCase());
});

await test('T20 magicStore has record keyed by tokenUuid', () => {
  const authLine = successResult.messages.find(m => m.includes('?auth='));
  assert.ok(authLine, 'auth URL line missing');
  const magicToken = authLine.split('?auth=')[1];
  const { tokenUuid } = decodeToken(magicToken);
  assert.ok(tokenUuid, 'tokenUuid missing from magic token');
  const record = successStores.magicStore._data[tokenUuid];
  assert.ok(record, 'magic record missing from magicStore');
  assert.strictEqual(record.tokenUuid, tokenUuid);
  assert.strictEqual(record.email, TEST_EMAIL.toLowerCase());
  assert.strictEqual(record.employerKey, TEST_EMPLOYER);
  assert.ok(record.issuedAt, 'issuedAt missing');
  assert.ok(record.expiresAt, 'expiresAt missing');
});

await test('T21 magic token claims: role manager-magic, correct email and employerKey', () => {
  const authLine   = successResult.messages.find(m => m.includes('?auth='));
  const magicToken = authLine.split('?auth=')[1];
  const payload    = decodeToken(magicToken);
  assert.strictEqual(payload.role, 'manager-magic');
  assert.strictEqual(payload.email, TEST_EMAIL.toLowerCase());
  assert.strictEqual(payload.employerKey, TEST_EMPLOYER);
  assert.ok(/^[0-9a-f-]{36}$/.test(payload.tokenUuid), 'tokenUuid should be a UUID');
});

await test('T22 magic token expires approximately MAGIC_LINK_TTL_MS (15 min) from now', () => {
  const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
  const authLine   = successResult.messages.find(m => m.includes('?auth='));
  const magicToken = authLine.split('?auth=')[1];
  const { expires } = decodeToken(magicToken);
  const remaining  = expires - Date.now();
  assert.ok(remaining > MAGIC_LINK_TTL_MS - 5000, `expires too soon: ${remaining}ms remaining`);
  assert.ok(remaining <= MAGIC_LINK_TTL_MS + 5000, `expires too far: ${remaining}ms remaining`);
});

await test('T23 learning token claims: role manager-learning, correct email and employerKey', () => {
  const lsLine       = successResult.messages.find(m => m.includes("localStorage.setItem"));
  assert.ok(lsLine, 'localStorage command missing');
  const match        = lsLine.match(/localStorage\.setItem\('gca_mgr_learning_token', '(.+)'\)/);
  assert.ok(match, 'could not extract learning token');
  const payload      = decodeToken(match[1]);
  assert.strictEqual(payload.role, 'manager-learning');
  assert.strictEqual(payload.email, TEST_EMAIL.toLowerCase());
  assert.strictEqual(payload.employerKey, TEST_EMPLOYER);
});

await test('T24 output messages include the ?auth= URL and localStorage command', () => {
  const hasAuthUrl  = successResult.messages.some(m => m.includes(`${LOCAL_SITE_URL}/manager-learning?auth=`));
  const hasLsCmd    = successResult.messages.some(m => m.includes("localStorage.setItem('gca_mgr_learning_token'"));
  assert.ok(hasAuthUrl, 'auth URL missing from output');
  assert.ok(hasLsCmd,   'localStorage command missing from output');
});

await test('T25 emailIdxStore has active index entry keyed by base64url(email)/employerKey', () => {
  const emailKey  = Buffer.from(TEST_EMAIL.toLowerCase()).toString('base64url');
  const idxKey    = `${emailKey}/${TEST_EMPLOYER}`;
  const entry     = successStores.emailIdxStore._data[idxKey];
  assert.ok(entry,                        'email index entry missing');
  assert.strictEqual(entry.email,       TEST_EMAIL.toLowerCase(), 'email mismatch');
  assert.strictEqual(entry.employerKey, TEST_EMPLOYER,            'employerKey mismatch');
  assert.strictEqual(entry.active,      true,                     'entry must be active');
  assert.ok(entry.updatedAt,                                      'updatedAt missing');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
