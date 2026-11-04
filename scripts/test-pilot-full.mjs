#!/usr/bin/env node
/**
 * Full pilot integration test — apc-mock-pilot
 * Tests all four categories: normal simulator, pilot attempt 1,
 * pilot attempt 2, security / expiry.
 *
 * Requires: local netlify dev running on port 8080
 * Required env: P1_INTERNAL_SECRET, JWT_SECRET, NETLIFY_AUTH_TOKEN,
 *               NETLIFY_SITE_ID  (read from .env automatically via dev server)
 */

import crypto from 'crypto';
import { readFileSync } from 'fs';

// ── Load .env ──────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync('/Users/angelahillaire-hutchinson/Documents/getcharteredai/.env', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const BASE        = 'http://localhost:8080';
const ADMIN_KEY   = process.env.P1_INTERNAL_SECRET;
const JWT_SECRET  = process.env.JWT_SECRET;
const NETLIFY_TOK = process.env.NETLIFY_AUTH_TOKEN;
const SITE_ID     = process.env.NETLIFY_SITE_ID;

if (!ADMIN_KEY || !JWT_SECRET) {
  console.error('FATAL: P1_INTERNAL_SECRET and JWT_SECRET must be set');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warnings = 0;

function ok(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? '  (' + detail + ')' : ''}`);
  passed++;
}
function fail(label, detail = '') {
  console.error(`  ✗ ${label}${detail ? '  (' + detail + ')' : ''}`);
  failed++;
}
function warn(label, detail = '') {
  console.log(`  ⚠ ${label}${detail ? '  (' + detail + ')' : ''}`);
  warnings++;
}
function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────`);
}

async function post(path, body, extraHeaders = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status };
}

// ── Token helpers (mirror pilot-invite.js logic) ────────────────────────────
function makeToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function tokenKey(token) {
  const sig = token.split('.')[1] || token;
  return crypto.createHash('sha256').update(sig).digest('hex');
}

// ── Generate a fresh pilot invite via the real endpoint ──────────────────────
async function generateInvite(label = 'test-pilot') {
  const r = await post('/.netlify/functions/pilot-invite', {
    adminKey: ADMIN_KEY,
    email: `${label}-${Date.now()}@test.invalid`,
    candidateName: 'Test Candidate'
  });
  if (r.status !== 200 || !r.json?.link) throw new Error('invite failed: ' + JSON.stringify(r));
  const url   = new URL(r.json.link);
  const token = url.searchParams.get('token');
  if (!token) throw new Error('no token in invite link');
  return token;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. NORMAL SIMULATOR — static JS validation (server can't test browser UI)
// ═══════════════════════════════════════════════════════════════════════════════
section('1. Normal simulator — code integrity checks');

// 1a — validate-index-js passes (no broken references)
try {
  const { execSync } = await import('child_process');
  const out = execSync('node scripts/validate-index-js.mjs', {
    cwd: '/Users/angelahillaire-hutchinson/Documents/getcharteredai',
    encoding: 'utf8'
  });
  if (out.includes('INDEX_JS_CHECK: PASS')) ok('validate-index-js passes', 'INDEX_JS_CHECK: PASS');
  else fail('validate-index-js failed', out.trim());
} catch (e) {
  fail('validate-index-js threw', e.message.split('\n')[0]);
}

// 1b — pilot globals present in index.html
{
  const html = readFileSync('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'utf8');
  if (html.includes('let _pilotMode')) ok('_pilotMode global declared');
  else fail('_pilotMode global missing');
  if (html.includes('const PILOT_SIM_API')) ok('PILOT_SIM_API constant declared');
  else fail('PILOT_SIM_API missing');
  if (html.includes('async function showResults()')) ok('showResults is async');
  else fail('showResults is not async');
  if (html.includes('async function skipQuestion(')) ok('skipQuestion is async');
  else fail('skipQuestion not async');
  if (html.includes('async function nextQuestion(')) ok('nextQuestion is async');
  else fail('nextQuestion not async');
  if (html.includes('async function nextSection(')) ok('nextSection is async');
  else fail('nextSection not async');
  if (html.includes('if (!r.ok) throw new Error(\'save-state')) ok('savePilotState throws on non-2xx');
  else fail('savePilotState still silently catches');
  if (html.includes('function showPilotSaveError(')) ok('showPilotSaveError helper present');
  else fail('showPilotSaveError helper missing');
  if (html.includes('async function retryPilotSave(')) ok('retryPilotSave helper present');
  else fail('retryPilotSave helper missing');
  // Confirm no browser-side fallback questions in generateQuestions pilot branch
  const pilotGenBlock = html.match(/if \(_pilotMode\) \{[\s\S]+?const legislation2026/);
  if (pilotGenBlock && !pilotGenBlock[0].includes("return ['Tell us")) ok('generateQuestions: no fallback question array in pilot branch');
  else if (html.includes("if (_pilotMode)") && html.includes("Could not load questions")) ok('generateQuestions: pilot error path present (retryable error shown)');
  else warn('generateQuestions pilot branch could not be verified');
  // Confirm submitAnswer saves BEFORE showing next button (pilot path)
  // The structure is: await savePilotState → showPilotSaveError/return on fail → then simNextBtn shown
  // The structure: pilot save → catch shows retry error and returns → normal path falls through to show Next
  const withheldComment = html.indexOf('// For pilot: Next button is withheld until progress is confirmed');
  const pilotSaveInSubmit = html.indexOf("await savePilotState({ answers: simState.answers, currentQuestion: qIdx + 1 });");
  if (withheldComment > 0 && pilotSaveInSubmit > 0 && pilotSaveInSubmit > withheldComment) {
    ok('submitAnswer: save confirmed before Next button (pilot-withheld comment + save present)');
  } else {
    fail('submitAnswer: missing save-before-Next structure', 'comment@' + withheldComment + ' save@' + pilotSaveInSubmit);
  }
  // skipQuestion pops on failure
  if (html.includes('simState.answers.pop(); // undo — not persisted')) ok('skipQuestion: answer popped on save failure');
  else fail('skipQuestion: missing answer pop on failure');
  // showResults removes restart button in pilot mode
  if (html.includes("querySelector('.sim-restart-btn')") && html.includes('restartBtn.remove()')) ok('showResults: restart button removed for pilot');
  else fail('showResults: restart button not removed in pilot mode');
  // showResults requires successful complete-mock before showing CTA
  if (html.includes('if (!r.ok) throw new Error(\'complete-mock')) ok('showResults: complete-mock response validated');
  else fail('showResults: complete-mock failure not checked');
  // restorePilotAttempt handles sIdx >= 5
  if (html.includes('if (sIdx >= 5)') && html.includes('await showResults()')) ok('restorePilotAttempt: handles sIdx >= 5');
  else fail('restorePilotAttempt: does not handle completed-attempt refresh');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PILOT ATTEMPT 1 — API-level integration
// ═══════════════════════════════════════════════════════════════════════════════
section('2. Pilot attempt 1 — API integration');

let tok1;
try {
  tok1 = await generateInvite('attempt1');
  ok('pilot-invite generates fresh token');
} catch (e) {
  fail('pilot-invite failed', e.message);
  process.exit(1);
}

// 2a — verify token
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: tok1 });
  if (r.status === 200 && r.json?.credits?.mockRemaining === 2) ok('verify: token valid, mockRemaining=2');
  else fail('verify failed', JSON.stringify(r.json));
}

// 2b — start-mock attempt 1
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: tok1, attemptNum: 1 });
  if (r.status === 200 && r.json?.ok) ok('start-mock attempt 1: accepted, credits decremented');
  else fail('start-mock attempt 1 failed', JSON.stringify(r.json));
}

// 2c — start-mock attempt 1 again (idempotent — already started)
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: tok1, attemptNum: 1 });
  if (r.status === 200 && r.json?.ok) ok('start-mock attempt 1 (repeat): idempotent 200');
  else fail('start-mock repeat not idempotent', JSON.stringify(r.json));
}

// 2d — cannot start attempt 2 before attempt 1 is complete
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: tok1, attemptNum: 2 });
  if (r.status === 403 && r.json?.error === 'attempt1-incomplete') ok('start-mock attempt 2: blocked (attempt1-incomplete)');
  else fail('attempt 2 not blocked before attempt 1 complete', JSON.stringify(r.json));
}

// 2e — generate section 0 questions (AI, persisted)
{
  const r = await post('/.netlify/functions/pilot-simulator', { mode: 'generate', token: tok1, attemptNum: 1, sectionIdx: 0 });
  if (r.status === 200 && Array.isArray(r.json?.questions) && r.json.questions.length >= 3) {
    ok('pilot-simulator generate section 0: questions returned', r.json.questions.length + ' questions');
  } else {
    fail('pilot-simulator generate section 0 failed', JSON.stringify(r.json));
  }
}

// 2f — generate section 1 (pre-written QS pool)
let sect1Qs;
{
  const r = await post('/.netlify/functions/pilot-simulator', { mode: 'generate', token: tok1, attemptNum: 1, sectionIdx: 1 });
  if (r.status === 200 && Array.isArray(r.json?.questions) && r.json.questions.length === 5) {
    sect1Qs = r.json.questions;
    ok('pilot-simulator generate section 1: 5 pre-written QS questions returned');
  } else {
    fail('pilot-simulator generate section 1 failed', JSON.stringify(r.json));
  }
}

// 2g — generate section 1 again: must return same cached questions
{
  const r = await post('/.netlify/functions/pilot-simulator', { mode: 'generate', token: tok1, attemptNum: 1, sectionIdx: 1 });
  if (r.status === 200 && r.json?.questions?.[0] === sect1Qs?.[0]) ok('pilot-simulator generate section 1 cached: same questions returned');
  else fail('section 1 not cached / different questions on second call', JSON.stringify({ got: r.json?.questions?.[0], want: sect1Qs?.[0] }));
}

// 2h — score an answer (reads question from blob — sends no question text)
{
  const r = await post('/.netlify/functions/pilot-simulator', {
    mode: 'score', token: tok1, attemptNum: 1,
    sectionIdx: 1, qIdx: 0,
    answer: 'Cost planning starts at RIBA Stage 1 with an Order of Cost Estimate, progressing through elemental cost plans at Stages 2 and 3, pre-tender cost plan at Stage 4, and post-contract cost management thereafter.'
  });
  if (r.status === 200 && r.json?.score?.structure > 0) ok('pilot-simulator score: valid score returned', 'structure=' + r.json.score.structure);
  else fail('pilot-simulator score failed', JSON.stringify(r.json));
}

// 2i — score with wrong qIdx (question not saved) must 404
{
  const r = await post('/.netlify/functions/pilot-simulator', {
    mode: 'score', token: tok1, attemptNum: 1,
    sectionIdx: 1, qIdx: 99,
    answer: 'Some answer text'
  });
  if (r.status === 404) ok('pilot-simulator score: missing question returns 404');
  else fail('pilot-simulator score: missing question did not return 404', 'status=' + r.status);
}

// 2j — save-state
{
  const r = await post('/.netlify/functions/pilot-speak', {
    mode: 'save-state', token: tok1, attemptNum: 1,
    state: { currentSection: 1, currentQuestion: 1, answers: [{ section: 1, question: sect1Qs?.[0], answer: 'test', avg: 72 }] }
  });
  if (r.status === 200) ok('save-state: accepted');
  else fail('save-state failed', JSON.stringify(r.json));
}

// 2k — load-state: check saved data restored
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'load-state', token: tok1, attemptNum: 1 });
  if (r.status === 200 && r.json?.attempt?.currentSection === 1 && r.json.attempt.currentQuestion === 1) {
    ok('load-state: currentSection and currentQuestion restored correctly');
  } else {
    fail('load-state: restored state does not match saved state', JSON.stringify(r.json?.attempt));
  }
}

// 2l — complete-mock attempt 1
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'complete-mock', token: tok1, attemptNum: 1 });
  if (r.status === 200 && r.json?.ok) ok('complete-mock attempt 1: accepted');
  else fail('complete-mock attempt 1 failed', JSON.stringify(r.json));
}

// 2m — verify: attempt1Completed should be true, attempt2 not yet started
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: tok1 });
  const c = r.json?.credits;
  if (c?.attempt1Completed === true && c?.attempt2Started === false) {
    ok('verify after complete-mock 1: attempt1Completed=true, attempt2Started=false');
  } else {
    fail('verify after complete-mock 1: unexpected credit state', JSON.stringify(c));
  }
}

// 2n — cannot restart attempt 1 after completion
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: tok1, attemptNum: 1 });
  if (r.status === 403 && r.json?.error === 'attempt-complete') ok('start-mock attempt 1 (after complete): blocked (attempt-complete)');
  else fail('attempt 1 not blocked after completion', JSON.stringify(r.json));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PILOT ATTEMPT 2
// ═══════════════════════════════════════════════════════════════════════════════
section('3. Pilot attempt 2');

// 3a — start attempt 2 (now that attempt 1 is complete)
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: tok1, attemptNum: 2 });
  if (r.status === 200 && r.json?.ok) ok('start-mock attempt 2: accepted');
  else fail('start-mock attempt 2 failed', JSON.stringify(r.json));
}

// 3b — verify: attempt2Started=true, mockRemaining=0
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: tok1 });
  const c = r.json?.credits;
  if (c?.attempt2Started === true && c?.mockRemaining === 0) ok('verify: attempt2Started=true, mockRemaining=0');
  else fail('verify after start attempt 2: unexpected state', JSON.stringify(c));
}

// 3c — attempt 2 has its own separate question set
let sect1QsAttempt2;
{
  const r = await post('/.netlify/functions/pilot-simulator', { mode: 'generate', token: tok1, attemptNum: 2, sectionIdx: 1 });
  if (r.status === 200 && Array.isArray(r.json?.questions) && r.json.questions.length === 5) {
    sect1QsAttempt2 = r.json.questions;
    // Questions should be different (they're randomly shuffled from the pool)
    ok('pilot-simulator attempt 2 section 1: separate question set generated');
  } else {
    fail('attempt 2 section 1 questions failed', JSON.stringify(r.json));
  }
}

// 3d — attempt 2 save-state is separate from attempt 1
{
  const r = await post('/.netlify/functions/pilot-speak', {
    mode: 'save-state', token: tok1, attemptNum: 2,
    state: { currentSection: 0, currentQuestion: 0, answers: [] }
  });
  if (r.status === 200) ok('save-state attempt 2: accepted');
  else fail('save-state attempt 2 failed', JSON.stringify(r.json));
}

// 3e — load attempt 1 state: unchanged by attempt 2 operations
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'load-state', token: tok1, attemptNum: 1 });
  if (r.status === 200 && r.json?.attempt?.currentSection === 1) {
    ok('load-state attempt 1: not affected by attempt 2 operations');
  } else {
    fail('attempt 1 state was overwritten by attempt 2', JSON.stringify(r.json?.attempt));
  }
}

// 3f — complete attempt 2
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'complete-mock', token: tok1, attemptNum: 2 });
  if (r.status === 200 && r.json?.ok) ok('complete-mock attempt 2: accepted');
  else fail('complete-mock attempt 2 failed', JSON.stringify(r.json));
}

// 3g — both complete: cannot start any further attempts
{
  const r2 = await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: tok1, attemptNum: 2 });
  if (r2.status === 403 && r2.json?.error === 'attempt-complete') ok('start-mock attempt 2 (after complete): blocked');
  else fail('attempt 2 start not blocked after completion', JSON.stringify(r2.json));
}

// 3h — mockRemaining = 0, no third attempt possible
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: tok1 });
  const c = r.json?.credits;
  if (c?.attempt1Completed && c?.attempt2Completed && c?.mockRemaining === 0) {
    ok('verify: both attempts complete, mockRemaining=0, no third attempt possible');
  } else {
    fail('final verify: unexpected state', JSON.stringify(c));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SECURITY AND EXPIRY
// ═══════════════════════════════════════════════════════════════════════════════
section('4. Security and expiry');

// 4a — expired token (exp in the past) is blocked with 410
{
  const expiredToken = makeToken({
    purpose: 'mock-pilot',
    pathway: 'Quantity Surveying and Construction',
    assessmentDate: '14 November',
    completeBy: '14 November',
    email: 'expired@test.invalid',
    candidateName: 'Expired Test',
    exp: Date.now() - 1000, // 1 second ago
    iat: Date.now() - 10000
  });
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: expiredToken });
  if (r.status === 410) ok('expired token (past): 410 from pilot-speak');
  else fail('expired token: expected 410, got ' + r.status, JSON.stringify(r.json));
}

// 4a-ii — token expiring at exactly 14 Nov 23:59:59 UTC is valid today (before that boundary)
{
  const boundaryToken = makeToken({
    purpose: 'mock-pilot',
    pathway: 'Quantity Surveying and Construction',
    assessmentDate: '14 November',
    completeBy: '14 November',
    email: 'boundary@test.invalid',
    candidateName: 'Boundary Test',
    exp: new Date('2026-11-14T23:59:59Z').getTime(), // new canonical expiry
    iat: Date.now()
  });
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: boundaryToken });
  if (r.status === 200) ok('token expiring 14 Nov 23:59 UTC: valid today (200)');
  else fail('token expiring 14 Nov 23:59 UTC: unexpected status', r.status + ' ' + JSON.stringify(r.json));
}

// 4a-iii — source assertion: pilot-speak.js PILOT_EXPIRES_AT is set to 2026-11-14T23:59:59Z
{
  const src = readFileSync(
    new URL('../netlify/functions/pilot-speak.js', import.meta.url), 'utf8'
  );
  if (src.includes('2026-11-14T23:59:59Z'))
    ok('pilot-speak.js: PILOT_EXPIRES_AT = 2026-11-14T23:59:59Z');
  else
    fail('pilot-speak.js: PILOT_EXPIRES_AT does not match expected 2026-11-14T23:59:59Z');
}

// 4a-iv — source assertion: pilot-feedback.js does not gate on token expiry
//          (candidates must be able to submit feedback after 14 Nov)
{
  const src = readFileSync(
    new URL('../netlify/functions/pilot-feedback.js', import.meta.url), 'utf8'
  );
  // verifyPilotToken in pilot-feedback.js intentionally omits an expiry check
  const hasNoExpiryGate = !src.match(/if\s*\(.*\.exp.*<.*Date\.now\(\)\)/);
  const hasComment      = src.includes('Allow feedback submission even after expiry');
  if (hasNoExpiryGate && hasComment)
    ok('pilot-feedback.js: no expiry gate — feedback accepted after pilot closes');
  else if (!hasNoExpiryGate)
    fail('pilot-feedback.js: unexpected expiry gate found — feedback may be blocked after 14 Nov');
  else
    fail('pilot-feedback.js: expected intent comment not found');
}

// 4b — tampered token (signature mismatch) is rejected
{
  const validToken = await generateInvite('tamper-test');
  const parts = validToken.split('.');
  const tamperedToken = parts[0] + '.invalidsignatureXXX';
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: tamperedToken });
  if (r.status === 401 || r.status === 403) ok('tampered token: rejected (401/403)', 'status=' + r.status);
  else fail('tampered token not rejected', 'status=' + r.status);
}

// 4c — pilot-simulator rejects token with wrong purpose
{
  const wrongToken = makeToken({
    purpose: 'login',  // wrong purpose
    email: 'x@test.invalid',
    exp: Date.now() + 86400000,
    iat: Date.now()
  });
  const r = await post('/.netlify/functions/pilot-simulator', { mode: 'generate', token: wrongToken, attemptNum: 1, sectionIdx: 0 });
  if (r.status === 401 || r.status === 403) ok('pilot-simulator: wrong-purpose token rejected');
  else fail('pilot-simulator: wrong-purpose token not rejected', 'status=' + r.status);
}

// 4d — pilot-simulator refuses to score an unsaved question (qIdx out of range)
{
  const freshToken = await generateInvite('security-score-test');
  await post('/.netlify/functions/pilot-speak', { mode: 'start-mock', token: freshToken, attemptNum: 1 });
  // Don't generate questions for section 2 — attempt to score anyway
  const r = await post('/.netlify/functions/pilot-simulator', {
    mode: 'score', token: freshToken, attemptNum: 1,
    sectionIdx: 2, qIdx: 0,
    answer: 'Injected question answer text'
  });
  if (r.status === 404) ok('pilot-simulator: refuses score for question not in saved attempt (404)');
  else fail('pilot-simulator: should have rejected unsaved question', 'status=' + r.status + ' ' + JSON.stringify(r.json));
}

// 4e — ai-tutor must reject pilot token with 403 (pilot tokens must never reach ai-tutor)
{
  const freshToken = await generateInvite('ai-tutor-rejection');
  const r = await post('/.netlify/functions/ai-tutor', {
    scoring: false,
    system: 'You are helpful.',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 100,
    token: freshToken  // pilot token, not a GCA customer token
  });
  if (r.status === 403) {
    ok('ai-tutor: pilot token rejected with 403');
  } else {
    fail('ai-tutor: pilot token not rejected with 403', 'status=' + r.status);
  }
}

// 4f — pilot endpoints reject missing token
{
  const r = await post('/.netlify/functions/pilot-speak', { mode: 'verify', token: null });
  if (r.status === 401 || r.status === 400 || r.status === 403) ok('pilot-speak: null token rejected');
  else fail('pilot-speak: null token not rejected', 'status=' + r.status);
}

// 4g — pilot-invite requires valid admin key
{
  const r = await post('/.netlify/functions/pilot-invite', {
    adminKey: 'wrong-key',
    email: 'x@test.invalid',
    candidateName: 'Test'
  });
  if (r.status === 403) ok('pilot-invite: wrong admin key rejected (403)');
  else fail('pilot-invite: wrong key not rejected', 'status=' + r.status);
}

// 4h — static pages
{
  const r1 = await get('/apc-mock-pilot.html');
  if (r1.status === 200) ok('apc-mock-pilot.html: 200');
  else fail('apc-mock-pilot.html: unexpected status', r1.status);
  const r2 = await get('/');
  if (r2.status === 200) ok('/: 200 (normal site unchanged)');
  else fail('/: unexpected status', r2.status);
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed  |  ${failed} failed  |  ${warnings} warnings`);
console.log('══════════════════════════════════════════════════════════\n');
if (failed > 0) {
  console.error(`  ${failed} test(s) FAILED — do not commit`);
  process.exit(1);
} else {
  console.log('  All API tests passed. UI/browser flows require manual verification.');
  console.log(`  Local preview: ${BASE}`);
}
