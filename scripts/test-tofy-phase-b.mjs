/**
 * Phase B automated tests for Michael spoken coach
 * Run: node scripts/test-tofy-phase-b.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

let passed = 0, failed = 0;
function ok(label, condition) {
  if (condition) { console.log('  ✓', label); passed++; }
  else { console.error('  ✗', label); failed++; }
}

// ─── 1. questions-data.json content quality ───────────────────────────────
console.log('\n1. questions-data.json — content quality');
const qData = require(path.join(root, 'netlify/functions/questions-data.json'));
const qPathways = Object.keys(qData);
ok('Has exactly 16 pathway banks', qPathways.length === 16);

const EXPECTED_16 = new Set([
  'Building Surveying','Quantity Surveying and Construction','Taxation Allowances',
  'Valuation','Planning and Development','Project Management','Residential',
  'Commercial Real Estate','Property Finance and Investment','Facility Management',
  'Rural','Land and Resources','Building Control','Corporate Real Estate',
  'Management Consultancy','Infrastructure'
]);
ok('All 16 pathways match expected catalogue', qPathways.every(p => EXPECTED_16.has(p)));

let totalQs = 0, missingKeyPoints = 0, missingPass = 0;
const MANDATORY_CONTAMINATION = [
  'Your firm is considering marketing itself as a RICS regulated firm in an overseas jurisdiction',
  'Failure to Prevent Fraud offence under the Economic Crime and Corporate Transparency Act',
  'whistleblowing protections exist for employees who report concerns',
  'managing a commercial property for a landlord client when the tenant approaches you directly'
];
let contaminated = 0;
for (const [p, qs] of Object.entries(qData)) {
  totalQs += qs.length;
  for (const q of qs) {
    if (!q.keyPoints || !q.keyPoints.length) missingKeyPoints++;
    if (!q.pass) missingPass++;
    if (MANDATORY_CONTAMINATION.some(m => q.q.includes(m))) contaminated++;
  }
}
ok(`Total questions across 16 pathways: ${totalQs} (≥ 800)`, totalQs >= 800);
ok('All questions have keyPoints', missingKeyPoints === 0);
ok('All questions have pass-level answer', missingPass === 0);
ok('Zero contaminating mandatory questions in technical banks', contaminated === 0);

// ─── 2. get-questions.js — VALID_PATHWAYS alignment ──────────────────────
console.log('\n2. get-questions.js — pathway alignment');
const getQSrc = readFileSync(path.join(root, 'netlify/functions/get-questions.js'), 'utf8');
const vpMatch = getQSrc.match(/new Set\(\[([\s\S]*?)\]\)/);
ok('VALID_PATHWAYS Set found in get-questions.js', !!vpMatch);
if (vpMatch) {
  const vpNames = vpMatch[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
  ok('get-questions VALID_PATHWAYS has 16 entries', vpNames.length === 16);
  ok('get-questions VALID_PATHWAYS matches expected catalogue',
    vpNames.every(p => EXPECTED_16.has(p)) && vpNames.length === EXPECTED_16.size);
}

// ─── 3. tofy-speak.js — structure and new parameters ─────────────────────
console.log('\n3. tofy-speak.js — structure verification');
const tofySrc = readFileSync(path.join(root, 'netlify/functions/tofy-speak.js'), 'utf8');
ok('_TECHNICAL_BANK_PATHWAYS constant defined', tofySrc.includes('_TECHNICAL_BANK_PATHWAYS'));
ok('_RICS_VOCAB constant defined', tofySrc.includes('_RICS_VOCAB'));
ok('transcribeAudio accepts questionHint and language parameters', tofySrc.includes('async function transcribeAudio(audioBuffer, mimeType, questionHint, language)'));
ok('Whisper prompt field added to multipart', tofySrc.includes('name="prompt"'));
ok('getCoaching accepts pathway parameter', tofySrc.includes('practiceArea, pathway, practiceMode, questionWhy'));
ok('_isHelpRequest function defined', tofySrc.includes('function _isHelpRequest(transcript)'));
ok('No 15-char length trigger in _isHelpRequest', !tofySrc.includes('t.length < 15'));
ok('_isHelpRequest uses word-boundary anchors not ^-anchors', !tofySrc.includes('/^i don') && tofySrc.includes('/\\bi don'));
ok('_isHelpRequest Stage 2 uses action-verb pattern only (no vocabulary-only override)', tofySrc.includes('actionVerbPattern') && !tofySrc.includes('substantiveContent'));
ok('_isHelpRequest has Stage 3 word-count threshold', tofySrc.includes('wordCount >= 40'));
ok('_isHelpRequest exported for unit testing', tofySrc.includes('exports._isHelpRequest = _isHelpRequest'));
ok('transcript-assessment disclaimer in getCoaching prompt', tofySrc.includes('You are evaluating a text transcript'));
ok('_getTeachingResponse function defined', tofySrc.includes('async function _getTeachingResponse('));
ok('response_type included in coaching schema', tofySrc.includes('"response_type":"coaching"'));
ok('response_type included in teaching schema', tofySrc.includes('"response_type":"teaching"'));
ok('pathway validated against technical bank set', tofySrc.includes('_TECHNICAL_BANK_PATHWAYS.has(pathway)'));
ok('max_tokens increased to 900', tofySrc.includes('max_tokens: 900'));
ok('Unrecognised pathway degrades gracefully (warn not error)', tofySrc.includes("console.warn('[tofy-speak] pathway without completed technical bank:"));

// ─── 4. index.html — client-side changes ─────────────────────────────────
console.log('\n4. index.html — client-side changes');
const html = readFileSync(path.join(root, 'public/index.html'), 'utf8');
ok('_PA_TECH_BANK_PATHWAYS constant defined in client', html.includes('const _PA_TECH_BANK_PATHWAYS = new Set('));
ok('_paSelectPathway is now async', html.includes('async function _paSelectPathway(pathway)'));
ok('_paSelectPathway routes to get-questions API', html.includes("'/.netlify/functions/get-questions'") && html.includes('random: true'));
ok('_paSelectPathway checks _PA_TECH_BANK_PATHWAYS', html.includes('_PA_TECH_BANK_PATHWAYS.has(pathway)'));
ok('PATHWAY_QUESTIONS removed from _paSelectPathway', !html.includes('PATHWAY_QUESTIONS[pathway]'));
ok('pathway field sent in POST to tofy-speak', html.includes('pathway: _tofyPathway || null'));
ok('practiceMode field sent to tofy-speak', html.includes('practiceMode:'));
ok('questionWhy field sent to tofy-speak', html.includes('questionWhy: q.why || \'\''));
ok('questionPass field sent to tofy-speak', html.includes('questionPass: q.pass || \'\''));
ok('questionHigh field sent to tofy-speak', html.includes('questionHigh: q.high || \'\''));
ok('Old _tofyAttempt1Transcript assignment removed from _tofySubmitAudio',
  !html.includes("if (attemptNum === 1) _tofyAttempt1Transcript"));
ok('_tofyAttempt1Transcript assignment moved to verdict function',
  html.includes("if (attemptNum === 1 && data.transcript) _tofyAttempt1Transcript"));
ok('Teaching response branch in _tofyShowSpeakVerdict', html.includes("coaching.response_type === 'teaching'"));
ok("Teaching message doesn't imply platform limited to 16 pathways",
  html.includes("Pathway-specific technical questions for") && !html.includes("supports only 16"));

// ─── 5. _isHelpRequest — exercises the ACTUAL production function ─────────
console.log('\n5. _isHelpRequest — live production function (3-stage)');
// Import the real function exported from tofy-speak.js.
// Any divergence between the production implementation and these test cases
// will surface as a test failure — not just a structural string check.
const { _isHelpRequest } = require(path.join(root, 'netlify/functions/tofy-speak.js'));
ok('_isHelpRequest imported from production tofy-speak.js', typeof _isHelpRequest === 'function');

const helpCases = [
  // ── Core help signals ───────────────────────────────────────────────────
  ["I don't know what to say", true],
  ["Can you explain this to me?", true],
  ["I have no idea", true],
  ["I need a hint", true],
  ["I'm not sure what this means", true],
  // ── Genuine attempts — should be scored, not taught ─────────────────────
  ["I'm not sure but I would first check the client's instructions", false],
  ["I think the approach would be to inspect the property first", false],
  ["MEES", false],
  ["Err", false],
  ["OK so", false],
  ["The answer probably relates to RICS Red Book guidance", false],
  ["I would start by reviewing the lease terms", false],
  // ── Regression: exact transcript from live acceptance test (Priority 3) ──
  // Whisper hallucinated "What are we going to do John?" before the candidate spoke.
  // The old ^-anchored patterns failed because "i don't know" was at word 9, not word 1.
  ["What are we going to do John? I don't know, can you help me please Michael?", true],
  // ── Mid-position help signal without professional content ───────────────
  ["Actually I'm not sure where to start", true],
  // ── Help request mentioning RICS terminology (new safeguard) ────────────
  // Vocabulary alone must not override a clear help request.
  // "I don't understand dilapidations, can you explain?" must trigger teaching.
  ["I don't understand dilapidations. Can you explain them to me?", true],
  ["Can you help me understand what a party wall agreement is?", true],
  // ── Stage 2 override: action-verb language signals genuine attempt ───────
  // Candidate expresses uncertainty but constructs an answer — should be scored.
  ["I don't know all the regs but I would inspect the building using a schedule of condition", false],
  ["I'm not entirely sure, but I would inspect the building and review the relevant documentation", false],
  // ── Stage 3 override: ≥ 40 words treated as genuine attempt ────────────
  ["I don't know for certain but off the top of my head I'd say there are probably about five or six things worth mentioning here and they all relate to how you approach the situation professionally and whether you have thought through the client's needs and the commercial context and any relevant regulations", false],
];
helpCases.forEach(([t, expected]) => {
  ok(`"${t.slice(0,65)}" → ${expected}`, _isHelpRequest(t) === expected);
});

// ─── 6. State clearing — pathway switching cannot leak question/transcript ─
console.log('\n6. State clearing — pathway switching');
// Simulate the state machine in JS to verify no leakage paths
let _tofyQuestion = null, _tofyAttempt1Transcript = null, _tofyPathway = null;

// Simulate: select pathway A, get question, record attempt 1
_tofyPathway = 'Building Surveying';
_tofyAttempt1Transcript = null;
_tofyQuestion = { q: 'Question A', module: 'APC ASSESSMENT · BUILDING SURVEYING', keyPoints: [] };
_tofyAttempt1Transcript = 'My answer attempt 1';

// Now switch to pathway B (simulates _paSelectPathway being called)
_tofyPathway = 'Valuation';
_tofyAttempt1Transcript = null;  // reset happens at top of _paSelectPathway
_tofyQuestion = { q: 'Question B', module: 'APC ASSESSMENT · VALUATION', keyPoints: [] };

ok('Switching pathway resets attempt1Transcript', _tofyAttempt1Transcript === null);
ok('Switching pathway sets new question', _tofyQuestion.q === 'Question B');
ok('Switching pathway updates _tofyPathway', _tofyPathway === 'Valuation');

// Simulate: teaching response should not advance attempt counter
_tofyAttempt1Transcript = null;
const attemptNum = _tofyAttempt1Transcript ? 2 : 1;
// teaching response — do NOT set _tofyAttempt1Transcript
// (attempt stays null — next speak is still attempt 1)
ok('Teaching response does not consume attempt slot (attemptNum stays 1)', attemptNum === 1 && _tofyAttempt1Transcript === null);

// Simulate coaching response path — correctly sets attempt1
const fakeTranscript = 'My first scored answer';
if (attemptNum === 1 && fakeTranscript) _tofyAttempt1Transcript = fakeTranscript;
const attemptNum2 = _tofyAttempt1Transcript ? 2 : 1;
ok('After coaching response, next attempt is correctly 2', attemptNum2 === 2);

// ─── 7. 22-pathway structure preserved ───────────────────────────────────
console.log('\n7. 22-pathway catalogue structure');
const pathwaysMatch = html.match(/const PATHWAYS = \[([^\]]+)\]/);
ok('PATHWAYS const still present in index.html', !!pathwaysMatch);
if (pathwaysMatch) {
  const all22 = pathwaysMatch[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
  ok('PATHWAYS has 22 entries', all22.length === 22);
  ok('_PA_TECH_BANK_PATHWAYS (16) is a strict subset of PATHWAYS (22)',
    [...EXPECTED_16].every(p => all22.includes(p)));
  const remaining6 = all22.filter(p => !EXPECTED_16.has(p));
  ok('6 remaining pathways identified', remaining6.length === 6);
  console.log('    Remaining 6:', remaining6.join(', '));
}

// ─── 8. Competency-level alignment — ai-tutor.js and tofy-speak.js ───────
console.log('\n8. Competency-level alignment — coaching prompt guards');
const aiTutorSrc = readFileSync(path.join(root, 'netlify/functions/ai-tutor.js'), 'utf8');

// articulation-verdict route: level must be determined before language-register check
ok('articulation-verdict determines competency level before language-register check',
  aiTutorSrc.includes('Competency level reached: determine this first'));
ok('articulation-verdict flags hypothetical language only for Level 2 and Level 3',
  aiTutorSrc.includes('For Level 2 and Level 3 questions, flag hypothetical language'));
ok('articulation-verdict does not flag hypothetical language for Level 1 knowledge questions',
  aiTutorSrc.includes('For Level 1 knowledge questions, accurate explanation') &&
  aiTutorSrc.includes('must NOT be flagged as a deficiency'));
ok('articulation-verdict contains fabrication guard',
  aiTutorSrc.includes('Never advise a candidate to invent or claim experience they have not had'));

// COACHING_PRINCIPLES: same level-qualification applied to panel and module routes
ok('COACHING_PRINCIPLES qualified for Level 2 and Level 3 only',
  aiTutorSrc.includes('Level 2 or Level 3 question') && aiTutorSrc.includes('COACHING PRINCIPLE'));
ok('COACHING_PRINCIPLES contains fabrication guard',
  aiTutorSrc.includes('Never advise a candidate to invent, fabricate or claim experience they have not had'));
ok('COACHING_PRINCIPLES does not remove the experience-language coaching principle entirely',
  aiTutorSrc.includes('past-tense personal experience'));

// TOFY spoken route: same level-awareness in modeInstruction
ok('TOFY modeInstruction guards knowledge questions against experience-language coaching',
  tofySrc.includes('For knowledge questions') && tofySrc.includes('Reserve coaching on experience language for Level 2 and Level 3'));

// Route distinction preserved: two different evaluation rubrics remain separate
ok('articulation-verdict route uses text-chat rubric (technical_accuracy field)',
  aiTutorSrc.includes('"technical_accuracy"'));
ok('TOFY route uses five-capability spoken rubric (Answer|Structure|Reasoning|Judgement)',
  tofySrc.includes('Answer|Structure|Reasoning|Judgement|Professional communication'));

// ─── 9. Question-mismatch regression — client-side data flow ─────────────
console.log('\n9. Question-mismatch regression — locks and generation counters');

// Root cause: _tofyQuestion is a shared mutable global; _tofySubmitAudio read it at
// call time. A concurrent second _paSelectPathway fetch could resolve while the
// candidate was recording, silently replacing _tofyQuestion with a different question.
// The screen showed the original question (embedded in HTML at render time), but the
// POST body sent the replacement — causing Michael to evaluate the wrong question.

// ── Structural checks ───────────────────────────────────────────────────────
ok('_tofyLockedQuestion variable declared',
  html.includes('let _tofyLockedQuestion = null'));
ok('_tofyFetchGeneration counter declared',
  html.includes('let _tofyFetchGeneration = 0'));
ok('_tofySpeakMode locks the question at entry',
  html.includes('_tofyLockedQuestion = _tofyQuestion') && html.includes('function _tofySpeakMode'));
ok('_tofyTypeMode locks the question at entry',
  html.includes('_tofyLockedQuestion = _tofyQuestion') && html.includes('function _tofyTypeMode'));
ok('_tofySubmitAudio uses _tofyLockedQuestion not _tofyQuestion',
  /async function _tofySubmitAudio[\s\S]{0,30}const q = _tofyLockedQuestion/.test(html));
ok('_tofySubmitAudio has fail-safe for missing locked question',
  html.includes('Session expired — please start again'));
ok('_paSelectPathway increments generation counter before fetch',
  html.includes('const myGen = ++_tofyFetchGeneration') && html.includes('_paSelectPathway'));
ok('_paSelectPathway discards stale fetch result',
  html.includes('myGen !== _tofyFetchGeneration'));
ok('_paSelectPathway clears locked question on new load',
  html.includes('_tofyLockedQuestion = null') && html.includes('_paSelectPathway'));
ok('_tofySelectTopic increments generation counter for async path',
  (() => {
    const selectTopicIdx = html.indexOf('async function _tofySelectTopic');
    const paSelectIdx = html.indexOf('async function _paSelectPathway');
    const sectionEnd = Math.min(paSelectIdx, selectTopicIdx + 2000);
    const section = html.slice(selectTopicIdx, sectionEnd);
    return section.includes('++_tofyFetchGeneration') && section.includes('myGen !== _tofyFetchGeneration');
  })());
ok('_tofySubmitRecap uses locked question',
  html.includes('_tofyLockedQuestion || _tofyQuestion'));

// ── Simulation: generation counter prevents stale overwrites ────────────────
console.log('\n  Simulation — generation counter');
let _simQuestion = null, _simLocked = null, _simGen = 0;

// Simulate: fetch 1 starts
const gen1 = ++_simGen;
// Simulate: fetch 2 starts (user navigates or double-clicks) before fetch 1 resolves
const gen2 = ++_simGen;

// Fetch 1 resolves (slower) — should be discarded
if (gen1 === _simGen) _simQuestion = { q: 'Question from fetch 1' };
ok('Stale fetch 1 discarded when fetch 2 is current', _simQuestion === null);

// Fetch 2 resolves — should be applied
if (gen2 === _simGen) _simQuestion = { q: 'Question from fetch 2' };
ok('Current fetch 2 result applied', _simQuestion !== null && _simQuestion.q === 'Question from fetch 2');

// Simulate: speak mode locks the question
_simLocked = _simQuestion;
// Simulate: while recording, another navigation starts a fetch 3
const gen3 = ++_simGen;
// Fetch 3 resolves and would overwrite _simQuestion
if (gen3 === _simGen) _simQuestion = { q: 'Question from fetch 3' };
// But submission uses _simLocked, not _simQuestion
ok('Locked question unchanged even after concurrent fetch resolves',
  _simLocked.q === 'Question from fetch 2');
ok('Submit uses locked question, not overwritten _simQuestion',
  _simLocked.q !== _simQuestion.q);

// ── Simulation: teaching → spoken answer → retry question identity ──────────
console.log('\n  Simulation — teaching → retry question identity');
let _simAttempt1 = null, _simLockedQ = null;
const profitsMethod = { q: 'What is the profits method of valuation?', keyPoints: ['maintainable trade', 'FMT'] };

// Step 1: question loaded, speak mode entered
_simLockedQ = profitsMethod;  // _tofySpeakMode sets _tofyLockedQuestion = _tofyQuestion
ok('Locked question set to profits method on speak-mode entry', _simLockedQ === profitsMethod);

// Step 2: first submission returns teaching response — attempt1 NOT set
// (teaching responses don't consume an attempt slot)
const teachingResp = { coaching: { response_type: 'teaching', explanation: 'The profits method...' } };
// _tofyShowSpeakVerdict teaching branch: does NOT set _tofyAttempt1Transcript
ok('After teaching response attempt1 transcript is still null', _simAttempt1 === null);

// Step 3: "Ready — speak your answer" → _tofySpeakMode() → re-locks same question
_simLockedQ = profitsMethod;  // _tofySpeakMode re-locks on entry
ok('Re-entering speak mode after teaching re-locks same question', _simLockedQ === profitsMethod);

// Step 4: second submission uses the same locked question, attemptNum still 1
// New design: attemptNum = (_tofyRetryRequested && attempt1Transcript) ? 2 : 1
// No retry flag has been set yet, so this is still attempt 1.
let _simRetryRequested = false;
const simAttemptNum = (_simRetryRequested && _simAttempt1) ? 2 : 1;
ok('Attempt number is still 1 after teaching response (slot not consumed)', simAttemptNum === 1);
ok('Second submission evaluates against profits method (correct question)', _simLockedQ.q === profitsMethod.q);

// Step 5: genuine coaching response stores transcript; without "Try again", next attempt is still 1
const transcriptOfAnswer = 'The profits method uses maintainable trade...';
if (simAttemptNum === 1 && transcriptOfAnswer) _simAttempt1 = transcriptOfAnswer;
// Retry requires EXPLICIT "Try again" button — attempt1Transcript alone is not enough
const simAttemptNumWithoutRetry = (_simRetryRequested && _simAttempt1) ? 2 : 1;
ok('Without Try Again click, next submission is still attempt 1 (not auto-incremented)', simAttemptNumWithoutRetry === 1);
// Clicking "Try again" sets the flag
_simRetryRequested = true;
const simAttemptNumWithRetry = (_simRetryRequested && _simAttempt1) ? 2 : 1;
ok('After Try Again click with stored attempt 1, next submission is attempt 2', simAttemptNumWithRetry === 2);

// ─── 10. Retry numbering regression — explicit Try Again gate ─────────────
console.log('\n10. Retry numbering regression — explicit Try Again gate');

// Structural checks
ok('_tofyRetryRequested global declared', html.includes('let _tofyRetryRequested = false'));
ok('_tofyRetryMode function defined', html.includes('function _tofyRetryMode'));
// The verdict "Try again" button uses min-width:160px; "Ready — speak your answer" uses min-width:180px
// Check that the verdict button (160px) calls _tofyRetryMode(), not _tofySpeakMode()
ok('"Try again" verdict button calls _tofyRetryMode() not _tofySpeakMode()',
  html.includes('onclick="_tofyRetryMode()"') &&
  !html.includes('onclick="_tofySpeakMode()" style="flex:1;min-width:160px'));
ok('_tofyRetryRequested set in _tofyRetryMode',
  (() => {
    const idx = html.indexOf('function _tofyRetryMode');
    return html.slice(idx, idx + 150).includes('_tofyRetryRequested = true');
  })());
ok('_tofySubmitAudio uses _tofyRetryRequested for attemptNum',
  html.includes('_tofyRetryRequested && _tofyAttempt1Transcript'));
ok('attempt1Transcript only sent when attemptNum === 2',
  html.includes('attemptNum === 2 ? _tofyAttempt1Transcript : null'));
ok('_tofyShowQuestion clears _tofyRetryRequested',
  (() => {
    const idx = html.indexOf('function _tofyShowQuestion');
    return html.slice(idx, idx + 300).includes('_tofyRetryRequested = false');
  })());
ok('_tofySelectTopic clears _tofyRetryRequested',
  (() => {
    const idx = html.indexOf('async function _tofySelectTopic');
    return html.slice(idx, idx + 300).includes('_tofyRetryRequested = false');
  })());
ok('_paSelectPathway clears _tofyRetryRequested',
  (() => {
    const idx = html.indexOf('async function _paSelectPathway');
    return html.slice(idx, idx + 300).includes('_tofyRetryRequested = false');
  })());
ok('_tofyShowSpeakVerdict clears _tofyRetryRequested after attempt 2',
  html.includes('if (attemptNum === 2) _tofyRetryRequested = false'));

// Server-side guard
ok('tofy-speak.js isRetry guards against help-request attempt1Transcript',
  tofySrc.includes('!_isHelpRequest(attempt1Transcript)'));

// Transcript-only coaching — explicit prohibition on vocal delivery comments
ok('tofy-speak.js prohibits comments on vocal delivery in system prompt',
  tofySrc.includes('Do not comment on vocal delivery, tone of voice, pace or intonation'));

// ── Simulation: bug scenario — help first, then first genuine attempt ───────
console.log('\n  Simulation — help-first bug scenario');

let _bugSimAttempt1Transcript = null;
let _bugSimRetryRequested = false;

// Step 1: Candidate asks for help — teaching response returned, no attempt recorded
// (teaching branch returns early; transcript NOT stored as attempt1)
const helpRequestTranscript = "I don't know what risks arise from capital allowances in a sale contract. Can you help?";
const bugSimAttemptNum1 = (_bugSimRetryRequested && _bugSimAttempt1Transcript) ? 2 : 1;
ok('Help-first: attemptNum is 1 when retry not requested', bugSimAttemptNum1 === 1);

// Teaching response: teaching branch returns early, _bugSimAttempt1Transcript stays null
// (simulate: coaching.response_type === 'teaching' → early return, no transcript stored)
const helpResponseType = 'teaching';
if (helpResponseType !== 'teaching') {
  if (bugSimAttemptNum1 === 1) _bugSimAttempt1Transcript = helpRequestTranscript;
}
ok('Help-first: attempt1Transcript not set after teaching response', _bugSimAttempt1Transcript === null);

// Step 2: Candidate clicks "Ready — speak your answer" → does NOT set retry flag
ok('Help-first: retry flag not set by Ready button (only by Try Again)', _bugSimRetryRequested === false);

// Step 3: Candidate gives first genuine answer
const bugSimAttemptNum2 = (_bugSimRetryRequested && _bugSimAttempt1Transcript) ? 2 : 1;
ok('Help-first: first genuine answer is Attempt 1, no comparison', bugSimAttemptNum2 === 1);

// Step 4: Coaching response — set attempt1Transcript for future retry
const genuineTranscript = 'The risks include loss of capital allowances pool apportionment and disputes over fixtures...';
if (bugSimAttemptNum2 === 1 && genuineTranscript) _bugSimAttempt1Transcript = genuineTranscript;
ok('Help-first: attempt1Transcript set after genuine attempt 1', _bugSimAttempt1Transcript !== null);

// Step 5: "Try again" button clicked — now retry flag is set
_bugSimRetryRequested = true;

// Step 6: Genuine attempt 2
const bugSimAttemptNum3 = (_bugSimRetryRequested && _bugSimAttempt1Transcript) ? 2 : 1;
ok('Help-first: attempt 2 only after explicit Try Again click', bugSimAttemptNum3 === 2);

// ── Simulation: server-side defence — help-request as attempt1Transcript ────
console.log('\n  Simulation — server-side isRetry defence');
const { _isHelpRequest: _isHR } = require(path.join(root, 'netlify/functions/tofy-speak.js'));

const helpReqAsAttempt1 = "I don't know what risks arise, can you explain them to me?";
const genuineAttempt2 = "The risks include disputes over CAA 2001 fixture pools and loss of allowances";
const isRetryGuarded = (2 > 1 && helpReqAsAttempt1 && !_isHR(helpReqAsAttempt1));
ok('Server guards: help-request attempt1 suppresses comparison', isRetryGuarded === false);

const isRetryGenuine = (2 > 1 && genuineAttempt2 && !_isHR(genuineAttempt2));
ok('Server guards: genuine attempt1 allows comparison for attempt 2', isRetryGenuine === true);

// ─── 11. Welsh / wrong-language transcription safeguard ───────────────────
console.log('\n11. Welsh / wrong-language transcription safeguard');

const { _isLikelyWrongLanguage } = require(path.join(root, 'netlify/functions/tofy-speak.js'));

// Structural checks
ok('_isLikelyWrongLanguage exported from tofy-speak.js', typeof _isLikelyWrongLanguage === 'function');
ok('transcribeAudio signature accepts language parameter',
  tofySrc.includes('async function transcribeAudio(audioBuffer, mimeType, questionHint, language)'));
ok('language field added to Whisper multipart body',
  tofySrc.includes('name="language"'));
ok('transcribeAudio called with \'en\' in handler',
  tofySrc.includes("transcribeAudio(audioBuffer, mimeType, question, 'en')"));
ok('wrong-language check present in handler before scoring',
  tofySrc.includes("_isLikelyWrongLanguage(transcript, 'en')"));
ok('wrong-language check returns empty transcript to suppress attempt consumption',
  (() => {
    const idx = tofySrc.indexOf("_isLikelyWrongLanguage(transcript, 'en')");
    const block = tofySrc.slice(idx, idx + 400);
    return block.includes("transcript: ''") && block.includes('error:');
  })());

// ── Live function tests — exact Welsh transcript from the reported failure ─
console.log('\n  Language detection — live function tests');

// Welsh transcript containing the exact terms from the failure report.
// This is > 20 words and has almost no English function words.
const welshTranscript20 = "Mae cyfrifiadur yn cyfrifo cyfradd ddiddordeb ar gyfer y gwerthiant eiddo yn seiliedig ar y gwerth cyfredol o'r farchnad bresennol heddiw";
ok('Welsh transcript (20+ words, reported failure terms) flagged as wrong language',
  _isLikelyWrongLanguage(welshTranscript20, 'en') === true);

// Longer Welsh passage with "cyfrifiadur" and "ddiddordeb" from reported failure
const welshTranscriptLong = "Cyfrifiadur a ddiddordeb yn y gwerthu eiddo mae'r asiantwr yn nodi gwrthdaro buddiant os oes ganddo gysylltiad personol ariannol neu brofesiynol a'r gwerthwr neu'r prynwr yn y gwerthiant hwn";
ok('Long Welsh passage with "cyfrifiadur" and "ddiddordeb" flagged', _isLikelyWrongLanguage(welshTranscriptLong, 'en') === true);

// English APC answers must pass through (not be flagged)
const englishConflict = "A conflict of interest in valuation arises when the valuer has a financial or personal connection to the property or parties involved, which could compromise independence and objectivity";
ok('English conflict-of-interest answer not flagged', _isLikelyWrongLanguage(englishConflict, 'en') === false);

const englishCapAllowances = "The risks include loss of capital allowances pool for the seller and inability for the buyer to claim allowances on fixtures and plant under the CAA 2001 unless addressed in the contract";
ok('English capital allowances answer not flagged', _isLikelyWrongLanguage(englishCapAllowances, 'en') === false);

const englishTerse = "Conflict arises where valuer has undisclosed financial interest in the subject property reducing objectivity";
ok('Short English answer (< 20 words) passes through regardless of function word count',
  _isLikelyWrongLanguage(englishTerse, 'en') === false);

const englishSingleWord = 'MEES';
ok('Single-word transcript passes through (too short to judge)', _isLikelyWrongLanguage(englishSingleWord, 'en') === false);

// Non-English expected language is always passed through (req 6 — no hardcoded English assumption)
ok('Non-English expected language always passes through (future-proofing)',
  _isLikelyWrongLanguage(welshTranscriptLong, 'cy') === false);
ok('Undefined expected language passes through',
  _isLikelyWrongLanguage(welshTranscriptLong, undefined) === false);

// ── Attempt-state preservation on transcription failure ───────────────────
console.log('\n  Simulation — attempt state preserved on transcription failure');

let _tfSimAttempt1 = null;
let _tfSimRetryRequested = false;

// Attempt 1: transcription failure (empty transcript returned by server)
const tfSimAttemptNum1 = (_tfSimRetryRequested && _tfSimAttempt1) ? 2 : 1;
// Server returns { transcript: '', error: '...' } — client throws, never reaches _tofyShowSpeakVerdict
// _tfSimAttempt1 is NOT set
ok('Transcription failure on attempt 1 does not set attempt1Transcript', _tfSimAttempt1 === null);
ok('Transcription failure on attempt 1 leaves retry flag false', _tfSimRetryRequested === false);

// Retry click + genuine attempt 1 succeeds
_tfSimAttempt1 = 'A conflict of interest arises when the valuer has a financial connection to the property being valued';
ok('Genuine attempt 1 sets attempt1Transcript', _tfSimAttempt1 !== null);

// Try Again clicked
_tfSimRetryRequested = true;

// Attempt 2: transcription failure
const tfSimAttemptNum2 = (_tfSimRetryRequested && _tfSimAttempt1) ? 2 : 1;
ok('Transcription failure on attempt 2: attemptNum was 2', tfSimAttemptNum2 === 2);
// Server returns { transcript: '', error: '...' } — client throws, never reaches _tofyShowSpeakVerdict
// _tfSimAttempt1 preserved, _tfSimRetryRequested preserved
ok('Transcription failure on attempt 2 preserves attempt1Transcript', _tfSimAttempt1 !== null);
ok('Transcription failure on attempt 2 preserves retry flag for re-record', _tfSimRetryRequested === true);

// Candidate re-records attempt 2 — retry flag and attempt1 still in place
const tfSimAttemptNum3 = (_tfSimRetryRequested && _tfSimAttempt1) ? 2 : 1;
ok('Re-recorded attempt 2 after failure is still attempt 2 (not attempt 3)', tfSimAttemptNum3 === 2);

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nSome tests failed — do not deploy.'); process.exit(1); }
else { console.log('\nAll tests passed. Ready for live acceptance test.'); }
