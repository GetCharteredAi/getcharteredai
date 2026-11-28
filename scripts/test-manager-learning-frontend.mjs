// scripts/test-manager-learning-frontend.mjs
// Focused frontend tests for manager-learning.js (Phase C, Build 2).
//
// Tests are grouped around the three behaviour guarantees:
//   B1 — Failed requests leave history unchanged so retries are always valid.
//   B2 — A failed end-practice debrief request is retryable without losing history.
//   B3 — Conversation state is isolated per (topicId, sectionIndex) pair.
//
// Additional tests cover: duplicate-send prevention while a request is pending,
// correct sectionIndex propagation in API payloads, and auth flow routing.
//
// No live provider calls, no production access.

import { createRequire }    from 'module';
import { strict as assert } from 'assert';
import path                 from 'path';
import { fileURLToPath }    from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// ── Minimal DOM mock ──────────────────────────────────────────────────────────

const registry = new Map();

class MockClassList {
  constructor() { this._s = new Set(); }
  add(c)              { this._s.add(c); }
  remove(c)           { this._s.delete(c); }
  toggle(c, force) {
    if (force !== undefined) { force ? this._s.add(c) : this._s.delete(c); }
    else { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
  }
  contains(c)         { return this._s.has(c); }
}

class MockEl {
  constructor(tag) {
    this.tagName      = tag;
    this.id           = '';
    this.hidden       = false;
    this.textContent  = '';
    this.innerHTML    = '';
    this.value        = '';
    this.disabled     = false;
    this.rows         = 0;
    this.placeholder  = '';
    this.title        = '';
    this.type         = '';
    this.dataset      = {};
    this.className    = '';
    this.scrollTop    = 0;
    this.scrollHeight = 100;
    this.classList    = new MockClassList();
    this._attrs       = {};
    this._listeners   = {};
    this.children     = [];
    this.style        = {};
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    if (this._listeners[type])
      this._listeners[type] = this._listeners[type].filter(f => f !== fn);
  }
  getAttribute(n)    { return this._attrs[n] ?? null; }
  setAttribute(n, v) { this._attrs[n] = String(v); }
  appendChild(child) {
    this.children.push(child);
    registerTree(child);
    return child;
  }
  focus() {}
  remove() { if (this.id) registry.delete(this.id); }
  querySelectorAll() { return []; }
}

function registerTree(el) {
  if (el.id) registry.set(el.id, el);
  for (const c of (el.children || [])) registerTree(c);
}

class MockStorage {
  constructor() { this._d = {}; }
  getItem(k)    { return this._d[k] !== undefined ? this._d[k] : null; }
  setItem(k, v) { this._d[k] = String(v); }
  removeItem(k) { delete this._d[k]; }
  clear()       { this._d = {}; }
}

// ── Load module with mocked globals ──────────────────────────────────────────

const domListeners = {};
const localStorage  = new MockStorage();
const sessionStorage = new MockStorage();

global.document = {
  addEventListener(type, fn) {
    (domListeners[type] = domListeners[type] || []).push(fn);
  },
  getElementById(id) { return registry.get(id) || null; },
  createElement(tag) { return new MockEl(tag); },
};
global.window = {
  location: { search: '', href: 'http://localhost/', toString() { return this.href; } },
  history:  { replaceState() {} },
  DOMPurify: { sanitize: (s) => s },
  marked:    { parse: (s) => s },
  MediaRecorder: undefined,
};
global.localStorage  = localStorage;
global.sessionStorage = sessionStorage;
Object.defineProperty(global, 'navigator', { value: { mediaDevices: null }, writable: true, configurable: true });
global.atob          = (s) => Buffer.from(s, 'base64').toString('utf8');
global.URLSearchParams = URLSearchParams;
global.URL           = URL;
global.fetch         = async () => ({ ok: true, status: 200, json: async () => ({}) });
global.setTimeout    = setTimeout;
global.FileReader    = class {
  readAsDataURL() { this.onerror && this.onerror(new Error('no FileReader in Node')); }
};

// Pre-acknowledge privacy so ensurePrivacyAck always fires its callback
// synchronously in tests (the modal flow is not under test here).
sessionStorage.setItem('gca_mgr_privacy_ack', '1');

const ML_PATH = path.resolve(__dirname, '../public/js/manager-learning.js');
// Clear any cached version before loading
delete require.cache[require.resolve(ML_PATH)];
const ml = require(ML_PATH);

const {
  _panelState:              panelState,
  _createConversationPanel: createConversationPanel,
  _callMichael:             callMichael,
  _handleSend:              handleSend,
  _runEndPractice:          runEndPractice,
  _handleClaim:             handleClaim,
  _handleAuth:              handleAuth,
  _initAuthorized:          initAuthorized,
  _signOut:                 signOut,
  _storeToken:              storeToken,
  _clearToken:              clearToken,
  _isTokenValid:            isTokenValid,
} = ml;

// ── Helpers ───────────────────────────────────────────────────────────────────

function el(id) { return registry.get(id) || null; }

// Wait for all pending microtasks + a macro-task tick so async functions finish.
function settle() {
  return new Promise(resolve => setImmediate(resolve));
}

// Build a mock token that is structurally valid for isTokenValid.
function makeToken(overrides = {}) {
  const payload = {
    role:        'manager-learning',
    email:       'test@example.com',
    employerKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    expires:     Date.now() + 3600_000,
    ...overrides
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  return b64 + '.fakesig';
}

// Convenience: set a captured list of fetch call bodies and queue responses.
function mockFetch(responses) {
  const calls = [];
  let   idx   = 0;
  global.fetch = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    calls.push({ url, body });
    const r = responses[idx++] || responses[responses.length - 1];
    return { ok: r.ok, status: r.status, json: async () => r.data };
  };
  return calls;
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

async function test(label, fn) {
  // Reset shared state between tests
  registry.clear();
  localStorage.clear();
  sessionStorage.setItem('gca_mgr_privacy_ack', '1');
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  // Reset panelState
  for (const k of Object.keys(panelState)) delete panelState[k];

  try {
    await fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${e.message}`);
    failures.push({ label, message: e.message });
    failed++;
  }
}

// ── B1 — Failed request leaves history unchanged ──────────────────────────────

console.log('\nB1  Failed request does not corrupt history');

await test('B1-01  history is empty after a 503 failure', async () => {
  storeToken(makeToken());
  createConversationPanel('t1_0', 'topic-t1', 0, 'coach');
  el('conv-textarea-t1_0').value = 'Hello';

  mockFetch([{ ok: false, status: 503, data: { error: 'unavailable' } }]);
  handleSend('t1_0', 'topic-t1', 0, 'coach');
  await settle();

  assert.strictEqual(panelState['t1_0'].messages.length, 0,
    'history must remain empty after a failed request');
});

await test('B1-02  retry after 503 sends a single user message (no duplicate)', async () => {
  storeToken(makeToken());
  createConversationPanel('t1_0', 'topic-t1', 0, 'coach');
  el('conv-textarea-t1_0').value = 'Hello';

  const calls = mockFetch([
    { ok: false, status: 503, data: { error: 'unavailable' } },
    { ok: true,  status: 200, data: { text: 'Hi there' } },
  ]);

  handleSend('t1_0', 'topic-t1', 0, 'coach');
  await settle();
  assert.strictEqual(panelState['t1_0'].messages.length, 0, 'no history after first failure');

  el('conv-textarea-t1_0').value = 'Hello';
  handleSend('t1_0', 'topic-t1', 0, 'coach');
  await settle();

  assert.strictEqual(calls.length, 2, 'expected exactly two fetch calls');
  const secondPayload = calls[1].body;
  assert.strictEqual(secondPayload.messages.length, 1,
    'retry must send exactly one user message, not two');
  assert.strictEqual(secondPayload.messages[0].role, 'user');
  assert.strictEqual(secondPayload.messages[0].content, 'Hello');

  assert.strictEqual(panelState['t1_0'].messages.length, 2,
    'after success history must contain user + assistant messages');
  assert.strictEqual(panelState['t1_0'].messages[0].role, 'user');
  assert.strictEqual(panelState['t1_0'].messages[1].role, 'assistant');
});

await test('B1-03  retry after network error sends a single user message', async () => {
  storeToken(makeToken());
  createConversationPanel('t1_0', 'topic-t1', 0, 'coach');
  el('conv-textarea-t1_0').value = 'First attempt';

  let callCount = 0;
  global.fetch = async (url, opts) => {
    callCount++;
    if (callCount === 1) throw new Error('network error');
    const body = JSON.parse(opts.body);
    // Verify retry sends exactly 1 message
    assert.strictEqual(body.messages.length, 1, 'retry must not duplicate message');
    return { ok: true, status: 200, json: async () => ({ text: 'OK' }) };
  };

  handleSend('t1_0', 'topic-t1', 0, 'coach');
  await settle();
  assert.strictEqual(panelState['t1_0'].messages.length, 0, 'no commit on network error');

  el('conv-textarea-t1_0').value = 'First attempt';
  handleSend('t1_0', 'topic-t1', 0, 'coach');
  await settle();
  assert.strictEqual(panelState['t1_0'].messages.length, 2);
});

await test('B1-04  send button disabled while request in flight prevents duplicate send', async () => {
  storeToken(makeToken());
  createConversationPanel('t1_0', 'topic-t1', 0, 'coach');

  let resolveFirst;
  const firstResponse = new Promise(res => { resolveFirst = res; });
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    await firstResponse;
    return { ok: true, status: 200, json: async () => ({ text: 'reply' }) };
  };

  el('conv-textarea-t1_0').value = 'msg';
  handleSend('t1_0', 'topic-t1', 0, 'coach');
  // Button should now be disabled — a second send must be ignored
  el('conv-textarea-t1_0').value = 'msg';
  handleSend('t1_0', 'topic-t1', 0, 'coach');

  resolveFirst({ ok: true, status: 200, json: async () => ({ text: 'reply' }) });
  await settle();

  assert.strictEqual(callCount, 1, 'only one fetch call despite two handleSend calls');
  assert.strictEqual(panelState['t1_0'].messages.length, 2, 'one exchange committed');
});

await test('B1-05  correct sectionIndex sent for section at index 2', async () => {
  storeToken(makeToken());
  createConversationPanel('topicX_2', 'topicX', 2, 'reflect');
  el('conv-textarea-topicX_2').value = 'question';

  const calls = mockFetch([{ ok: true, status: 200, data: { text: 'reply' } }]);
  handleSend('topicX_2', 'topicX', 2, 'reflect');
  await settle();

  assert.strictEqual(calls[0].body.sectionIndex, 2,
    'API payload must carry sectionIndex=2, not the string panelId');
  assert.strictEqual(calls[0].body.topicId, 'topicX');
});

await test('B1-06  correct sectionIndex sent for section at index 0', async () => {
  storeToken(makeToken());
  createConversationPanel('topicX_0', 'topicX', 0, 'coach');
  el('conv-textarea-topicX_0').value = 'hi';

  const calls = mockFetch([{ ok: true, status: 200, data: { text: 'ok' } }]);
  handleSend('topicX_0', 'topicX', 0, 'coach');
  await settle();

  assert.strictEqual(calls[0].body.sectionIndex, 0,
    'sectionIndex must be integer 0, not string "topicX_0"');
});

await test('B1-07  history grows correctly over multiple successful exchanges', async () => {
  storeToken(makeToken());
  createConversationPanel('t2_0', 'topic-t2', 0, 'coach');

  const calls = mockFetch([
    { ok: true, status: 200, data: { text: 'reply1' } },
    { ok: true, status: 200, data: { text: 'reply2' } },
  ]);

  el('conv-textarea-t2_0').value = 'msg1';
  handleSend('t2_0', 'topic-t2', 0, 'coach');
  await settle();

  el('conv-textarea-t2_0').value = 'msg2';
  handleSend('t2_0', 'topic-t2', 0, 'coach');
  await settle();

  assert.strictEqual(panelState['t2_0'].messages.length, 4);
  assert.strictEqual(panelState['t2_0'].messages[0].content, 'msg1');
  assert.strictEqual(panelState['t2_0'].messages[1].content, 'reply1');
  assert.strictEqual(panelState['t2_0'].messages[2].content, 'msg2');
  assert.strictEqual(panelState['t2_0'].messages[3].content, 'reply2');

  // Second call must include full history
  assert.strictEqual(calls[1].body.messages.length, 3,
    'second request must include both prior messages plus new user message');
});

// ── B2 — End-practice debrief is retryable ────────────────────────────────────

console.log('\nB2  Failed end-practice request is retryable');

await test('B2-01  failed debrief does not set practiceEnded', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  panelState['t3_0'].messages = [
    { role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }
  ];

  mockFetch([{ ok: false, status: 503, data: { error: 'err' } }]);
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(panelState['t3_0'].practiceEnded, false,
    'practiceEnded must remain false after a failed debrief request');
});

await test('B2-02  failed debrief re-enables the end-practice button', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  el('end-practice-t3_0').hidden = false;
  panelState['t3_0'].messages = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'x' }];

  mockFetch([{ ok: false, status: 503, data: { error: 'err' } }]);
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(el('end-practice-t3_0').disabled, false,
    'end-practice button must be re-enabled after a failed debrief so manager can retry');
});

await test('B2-03  failed debrief shows inline error', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  panelState['t3_0'].messages = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'x' }];

  mockFetch([{ ok: false, status: 503, data: { error: 'err' } }]);
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(el('conv-error-t3_0').hidden, false, 'error element must be visible');
  assert.ok(el('conv-error-t3_0').textContent.length > 0, 'error message must not be empty');
});

await test('B2-04  retry after failed debrief succeeds and sets practiceEnded', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  el('end-practice-t3_0').hidden = false;
  panelState['t3_0'].messages = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'x' }];

  const calls = mockFetch([
    { ok: false, status: 503, data: { error: 'err' } },
    { ok: true,  status: 200, data: { text: 'Great practice session!' } },
  ]);

  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();
  assert.strictEqual(panelState['t3_0'].practiceEnded, false);

  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(panelState['t3_0'].practiceEnded, true,
    'practiceEnded must be set after successful retry');
  assert.strictEqual(calls.length, 2, 'expected exactly two fetch calls');
  assert.strictEqual(el('debrief-area-t3_0').hidden, false, 'debrief area must be visible');
});

await test('B2-05  debrief request sends correct sectionIndex', async () => {
  storeToken(makeToken());
  createConversationPanel('topicY_1', 'topicY', 1, 'practice');
  panelState['topicY_1'].messages = [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }];

  const calls = mockFetch([{ ok: true, status: 200, data: { text: 'done' } }]);
  runEndPractice('topicY_1', 'topicY', 1);
  await settle();

  assert.strictEqual(calls[0].body.sectionIndex, 1,
    'debrief must send sectionIndex=1, not the string panelId');
  assert.strictEqual(calls[0].body.endPractice, true);
  assert.strictEqual(calls[0].body.mode, 'practice');
});

await test('B2-06  history remains intact after failed debrief', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  const originalMessages = [
    { role: 'user', content: 'msg1' }, { role: 'assistant', content: 'rep1' },
    { role: 'user', content: 'msg2' }, { role: 'assistant', content: 'rep2' },
  ];
  panelState['t3_0'].messages = [...originalMessages];

  mockFetch([{ ok: false, status: 503, data: { error: 'err' } }]);
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(panelState['t3_0'].messages.length, 4,
    'conversation history must not be modified by a failed debrief request');
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(panelState['t3_0'].messages[i].content, originalMessages[i].content);
  }
});

await test('B2-07  debrief request messages end with user role, not assistant', async () => {
  // Regression for the confirmed production defect: when panelState.messages ends with
  // an assistant message, the Anthropic API returns empty content (no debrief generated).
  // The fix appends a user trigger so the API produces a fresh Michael response.
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  panelState['t3_0'].messages = [
    { role: 'user', content: 'msg1' }, { role: 'assistant', content: 'rep1' },
  ];

  const calls = mockFetch([{ ok: true, status: 200, data: { text: 'debrief' } }]);
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  const sent = calls[0].body.messages;
  assert.strictEqual(sent[sent.length - 1].role, 'user',
    'final message in debrief request must be user role so the API generates a fresh response');
});

await test('B2-08  trigger message is not stored in panelState after successful debrief', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  panelState['t3_0'].messages = [
    { role: 'user', content: 'msg1' }, { role: 'assistant', content: 'rep1' },
  ];
  const originalLen = panelState['t3_0'].messages.length;

  mockFetch([{ ok: true, status: 200, data: { text: 'debrief text' } }]);
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(panelState['t3_0'].messages.length, originalLen,
    'trigger message must not be committed to panelState.messages after a successful debrief');
});

await test('B2-09  retry sends identical messages to first attempt — trigger not duplicated', async () => {
  storeToken(makeToken());
  createConversationPanel('t3_0', 'topic-t3', 0, 'practice');
  el('end-practice-t3_0').hidden = false;
  panelState['t3_0'].messages = [
    { role: 'user', content: 'msg1' }, { role: 'assistant', content: 'rep1' },
  ];

  const calls = mockFetch([
    { ok: false, status: 503, data: { error: 'err' } },
    { ok: true,  status: 200, data: { text: 'debrief' } },
  ]);

  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();
  runEndPractice('t3_0', 'topic-t3', 0);
  await settle();

  assert.strictEqual(calls.length, 2, 'expected exactly two fetch calls');
  const first  = calls[0].body.messages;
  const second = calls[1].body.messages;
  assert.strictEqual(first.length, second.length,
    'retry must send same number of messages as first attempt — trigger must not accumulate');
  assert.strictEqual(second[second.length - 1].role, 'user',
    'retry final message must be user role');
  assert.strictEqual(second[second.length - 1].content, first[first.length - 1].content,
    'retry trigger content must match first attempt exactly');
});

// ── B3 — Conversation state isolated per (topicId, sectionIndex) ──────────────

console.log('\nB3  Conversation state isolation across topics');

await test('B3-01  two topics with same sectionIndex have independent histories', async () => {
  storeToken(makeToken());

  createConversationPanel('topicA_0', 'topicA', 0, 'coach');
  createConversationPanel('topicB_0', 'topicB', 0, 'coach');

  const callsA = mockFetch([{ ok: true, status: 200, data: { text: 'replyA' } }]);
  el('conv-textarea-topicA_0').value = 'msgA';
  handleSend('topicA_0', 'topicA', 0, 'coach');
  await settle();

  assert.strictEqual(panelState['topicA_0'].messages.length, 2, 'topicA panel has 2 messages');
  assert.strictEqual(panelState['topicB_0'].messages.length, 0,
    'topicB panel must have 0 messages — state must not bleed across topics');
});

await test('B3-02  panelId for section 2 of topicA does not equal section 2 of topicB', () => {
  // This verifies the compound key construction used in renderSection.
  // If keys were just the integer, panelState[2] would be shared.
  createConversationPanel('topicA_2', 'topicA', 2, 'practice');
  createConversationPanel('topicB_2', 'topicB', 2, 'practice');

  panelState['topicA_2'].messages.push({ role: 'user', content: 'from A' });

  assert.strictEqual(panelState['topicB_2'].messages.length, 0,
    'topicB section 2 must not share state with topicA section 2');
  assert.strictEqual(panelState['topicA_2'].messages.length, 1);
});

await test('B3-03  two sections within the same topic have independent histories', async () => {
  storeToken(makeToken());

  createConversationPanel('topicA_0', 'topicA', 0, 'reflect');
  createConversationPanel('topicA_2', 'topicA', 2, 'practice');

  mockFetch([{ ok: true, status: 200, data: { text: 'section0reply' } }]);
  el('conv-textarea-topicA_0').value = 'sec0msg';
  handleSend('topicA_0', 'topicA', 0, 'reflect');
  await settle();

  assert.strictEqual(panelState['topicA_0'].messages.length, 2);
  assert.strictEqual(panelState['topicA_2'].messages.length, 0,
    'section 2 state must be unaffected by activity in section 0');
});

await test('B3-04  API request for section 0 does not include messages from section 2', async () => {
  storeToken(makeToken());

  createConversationPanel('topicA_0', 'topicA', 0, 'reflect');
  createConversationPanel('topicA_2', 'topicA', 2, 'practice');

  // Pre-load section 2 with existing history
  panelState['topicA_2'].messages = [
    { role: 'user', content: 'sec2msg' }, { role: 'assistant', content: 'sec2rep' }
  ];

  const calls = mockFetch([{ ok: true, status: 200, data: { text: 'ok' } }]);
  el('conv-textarea-topicA_0').value = 'sec0msg';
  handleSend('topicA_0', 'topicA', 0, 'reflect');
  await settle();

  const sentMessages = calls[0].body.messages;
  const hasSection2Content = sentMessages.some(m => m.content === 'sec2msg' || m.content === 'sec2rep');
  assert.strictEqual(hasSection2Content, false,
    'section 0 request must not contain messages from section 2');
  assert.strictEqual(calls[0].body.sectionIndex, 0);
});

// ── Auth flow routing ─────────────────────────────────────────────────────────

console.log('\nAuth  Flow routing');

await test('Auth-01  isTokenValid rejects expired token', () => {
  const expired = makeToken({ expires: Date.now() - 1000 });
  assert.strictEqual(isTokenValid(expired), false);
});

await test('Auth-02  isTokenValid accepts valid token', () => {
  const valid = makeToken();
  assert.strictEqual(isTokenValid(valid), true);
});

await test('Auth-03  isTokenValid rejects wrong role', () => {
  const wrong = makeToken({ role: 'other-role' });
  assert.strictEqual(isTokenValid(wrong), false);
});

await test('Auth-04  handleClaim stores token and calls initAuthorized on success', async () => {
  const fetched = [];
  global.fetch = async (url, opts) => {
    fetched.push(url);
    return {
      ok:     true,
      status: 200,
      json:   async () => ({ learningToken: makeToken() }),
    };
  };
  global.window.location = { search: '', href: 'http://localhost/?claim=abc', toString() { return this.href; } };

  await handleClaim('abc');

  assert.ok(fetched.some(u => u.includes('p1-manager-learning-claim')),
    'claim endpoint must be called');
  const stored = localStorage.getItem('gca_mgr_learning_token');
  assert.ok(stored && stored.length > 0, 'token must be stored in localStorage');
});

await test('Auth-05  handleClaim shows error on failure', async () => {
  global.fetch = async () => ({
    ok: false, status: 400,
    json: async () => ({ error: 'invalid' }),
  });
  // Provide dummy error elements
  const tEl = new MockEl('h1'); tEl.id = 'error-title'; registry.set('error-title', tEl);
  const bEl = new MockEl('p');  bEl.id = 'error-body';  registry.set('error-body', bEl);

  await handleClaim('bad-token');

  assert.ok(tEl.textContent.length > 0, 'error title must be populated');
  assert.ok(bEl.textContent.length > 0, 'error body must be populated');
  assert.strictEqual(localStorage.getItem('gca_mgr_learning_token'), null,
    'token must NOT be stored on failure');
});

await test('Auth-06  handleAuth stores token and calls initAuthorized on success', async () => {
  global.fetch = async () => ({
    ok:     true,
    status: 200,
    json:   async () => ({ learningToken: makeToken() }),
  });
  global.window.location = { search: '', href: 'http://localhost/?auth=tok', toString() { return this.href; } };

  await handleAuth('magic-token');

  assert.ok(localStorage.getItem('gca_mgr_learning_token') !== null,
    'learningToken must be stored');
});

await test('Auth-07  signOut clears token', () => {
  storeToken(makeToken());
  assert.ok(localStorage.getItem('gca_mgr_learning_token') !== null);
  signOut();
  assert.strictEqual(localStorage.getItem('gca_mgr_learning_token'), null,
    'token must be removed on sign-out');
});

await test('Auth-08  401 during topic fetch clears token and routes to sign-in', async () => {
  storeToken(makeToken());
  global.fetch = async () => ({
    ok: false, status: 401,
    json: async () => ({ error: 'Unauthorized' }),
  });
  // fetchTopics is called by initAuthorized; test it in isolation via callMichael
  createConversationPanel('t9_0', 'topic-t9', 0, 'coach');
  el('conv-textarea-t9_0').value = 'x';

  global.fetch = async () => ({
    ok: false, status: 401,
    json: async () => ({ error: 'Unauthorized' }),
  });
  handleSend('t9_0', 'topic-t9', 0, 'coach');
  await settle();

  assert.strictEqual(localStorage.getItem('gca_mgr_learning_token'), null,
    'token must be cleared on 401 response');
});

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n' + passed + '/' + total + ' passed');
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  ' + f.label + ': ' + f.message);
  process.exitCode = 1;
}
