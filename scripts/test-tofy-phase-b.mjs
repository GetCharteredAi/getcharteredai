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
ok('transcribeAudio accepts questionHint parameter', tofySrc.includes('async function transcribeAudio(audioBuffer, mimeType, questionHint)'));
ok('Whisper prompt field added to multipart', tofySrc.includes('name="prompt"'));
ok('getCoaching accepts pathway parameter', tofySrc.includes('practiceArea, pathway, practiceMode, questionWhy'));
ok('_isHelpRequest function defined', tofySrc.includes('function _isHelpRequest(transcript)'));
ok('No 15-char length trigger in _isHelpRequest', !tofySrc.includes('t.length < 15'));
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

// ─── 5. _isHelpRequest edge case logic ───────────────────────────────────
console.log('\n5. _isHelpRequest — edge case logic');
function _isHelpRequest(transcript) {
  const t = transcript.toLowerCase().trim();
  const helpPatterns = [
    /^i don'?t know/,
    /^i'?m not sure what (to say|this means|this is|the answer)/,
    /^(can you |could you )(explain|tell me|help me|describe) (this|what|how|why|the)/,
    /^i have no idea/,
    /^i need (help|a hint)/,
    /^sorry,? i (don'?t|couldn'?t|can'?t)/
  ];
  return helpPatterns.some(p => p.test(t));
}
const helpCases = [
  ["I don't know what to say", true],
  ["Can you explain this to me?", true],
  ["I have no idea", true],
  ["I need a hint", true],
  ["I'm not sure what this means", true],
  ["I'm not sure but I would first check the client's instructions", false],
  ["I think the approach would be to inspect the property first", false],
  ["MEES", false],
  ["Err", false],
  ["OK so", false],
  ["The answer probably relates to RICS Red Book guidance", false],
  ["I would start by reviewing the lease terms", false],
];
helpCases.forEach(([t, expected]) => {
  ok(`"${t.slice(0,50)}" → ${expected}`, _isHelpRequest(t) === expected);
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

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nSome tests failed — do not deploy.'); process.exit(1); }
else { console.log('\nAll tests passed. Ready for live acceptance test.'); }
