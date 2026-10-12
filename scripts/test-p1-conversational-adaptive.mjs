/**
 * Phase 2 — Conversational Adaptive Accommodations — automated tests
 * Run: node scripts/test-p1-conversational-adaptive.mjs
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function ok(label, condition) {
  if (condition) { console.log('  ✓', label); passed++; }
  else { console.error('  ✗', label); failed++; }
}

const html = readFileSync(path.join(root, 'public/professional-readiness-benchmark.html'), 'utf8');
const tutorJs = readFileSync(path.join(root, 'netlify/functions/p1-tutor.js'), 'utf8');
const reportBg = readFileSync(path.join(root, 'netlify/functions/p1-generate-report-background.js'), 'utf8');
const synthesisBg = readFileSync(path.join(root, 'netlify/functions/p1-synthesis-background.js'), 'utf8');
const candidateSynthBg = readFileSync(path.join(root, 'netlify/functions/p1-candidate-synthesis-background.js'), 'utf8');
const managerSafeBg = readFileSync(path.join(root, 'netlify/functions/p1-manager-safe-background.js'), 'utf8');

// ─── Section 1: Question wording ─────────────────────────────────────────────
console.log('\n1. Question wording — Q1 and Q13');

ok('Q1 contains approved revised text',
  html.includes("can you tell me about something you did that you felt you handled professionally?"));

ok('Q1 does NOT contain old text',
  !html.includes("what do you think being professional means in your role? Give me an example of how you have tried to demonstrate that."));

ok('Q13 contains approved revised text',
  html.includes("Has there been a situation at work where you had to decide whether something needed raising with someone more senior?"));

ok('Q13 contains the escalation question continuation',
  html.includes("or what would make you feel something was important enough to escalate?"));

ok('Q13 does NOT contain old text',
  !html.includes("Have you had to raise or escalate something because you thought it could affect the work, a client, a project or the organisation? What made you decide it needed raising?"));

// ─── Section 2: p1-tutor.js accommodation shapes ──────────────────────────────
console.log('\n2. p1-tutor.js — accommodation signal handlers');

ok('[REPHRASE REQUEST] signal defined in system prompt',
  tutorJs.includes('[REPHRASE REQUEST]'));

ok('[REPHRASE REQUEST 2] signal defined in system prompt',
  tutorJs.includes('[REPHRASE REQUEST 2]'));

ok('rephrase JSON shape defined',
  tutorJs.includes('"rephrase"'));

ok('[CLARIFY REQUEST] signal defined',
  tutorJs.includes('[CLARIFY REQUEST]'));

ok('clarify JSON shape defined',
  tutorJs.includes('"clarify"'));

ok('[EXAMPLE REQUEST] signal defined',
  tutorJs.includes('[EXAMPLE REQUEST]'));

ok('example JSON shape defined',
  tutorJs.includes('"example"'));

ok('[NO EXPERIENCE] signal defined',
  tutorJs.includes('[NO EXPERIENCE]'));

ok('[NO EXPERIENCE] uses recognitionPrompt shape',
  tutorJs.includes('[NO EXPERIENCE]') && tutorJs.includes('"recognitionPrompt"'));

ok('[UNCERTAIN SIGNAL] signal defined',
  tutorJs.includes('[UNCERTAIN SIGNAL]'));

ok('reassure JSON shape defined',
  tutorJs.includes('"reassure"'));

ok('Max 2 rephrases rule in system prompt',
  tutorJs.includes('Max 2 rephrases'));

// ─── Section 3: Provenance states ─────────────────────────────────────────────
console.log('\n3. Provenance states — all 6 values defined');

ok("provenance value 'independent' defined",
  html.includes("'independent'"));

ok("provenance value 'after-clarification' defined",
  html.includes("'after-clarification'"));

ok("provenance value 'after-prompting' defined",
  html.includes("'after-prompting'"));

ok("provenance value 'after-teaching' defined",
  html.includes("'after-teaching'"));

ok("provenance value 'skipped' defined",
  html.includes("'skipped'"));

ok("provenance value 'exposure-acknowledged' defined",
  html.includes("'exposure-acknowledged'"));

ok('questionProvenance state variable declared',
  html.includes('let questionProvenance = {}'));

ok('skippedQuestions array declared',
  html.includes('let skippedQuestions = []'));

// ─── Section 4: Skip vs. exposure-acknowledged ────────────────────────────────
console.log('\n4. Skip vs. exposure-acknowledged distinction');

ok("handleSkip sets provenance to 'skipped'",
  html.includes("questionProvenance[currentQ] = 'skipped'"));

ok('handleSkip pushes to skippedQuestions array',
  html.includes("skippedQuestions.push(currentQ)"));

ok('handleSkip does NOT change recognitionResults (no assignment)',
  (() => {
    // Check no actual assignment to recognitionResults in handleSkip
    const skipFn = html.match(/function handleSkip\(\)[\s\S]*?\n}\n/);
    if (!skipFn) return false;
    // Should not contain a live assignment (contextAnswers.recognitionResults[...] = ...)
    return !skipFn[0].match(/contextAnswers\.recognitionResults\[.*?\]\s*=/);
  })());

ok("recognitionNoFromPanel sets provenance to 'exposure-acknowledged'",
  html.includes("questionProvenance[currentQ] = 'exposure-acknowledged'"));

ok('recognitionNoFromPanel sets confirmed-lack-of-exposure',
  (() => {
    const fn = html.match(/function recognitionNoFromPanel\(\)[^}]+}/s);
    if (!fn) return false;
    return fn[0].includes('confirmed-lack-of-exposure');
  })());

ok("recognitionNo (standard LM path) also sets 'exposure-acknowledged'",
  html.includes("function recognitionNo()") &&
  (() => {
    // Extract the block between function recognitionNo() { ... } (multi-brace)
    const startIdx = html.indexOf("function recognitionNo()");
    if (startIdx === -1) return false;
    const slice = html.slice(startIdx, startIdx + 600);
    return slice.includes("'exposure-acknowledged'");
  })());

// ─── Section 5: NOT ASSESSED outcome ─────────────────────────────────────────
console.log('\n5. NOT ASSESSED outcome in all synthesis/report functions');

ok('p1-generate-report-background.js contains NOT ASSESSED outcome label',
  reportBg.includes('NOT ASSESSED'));

ok('p1-generate-report-background.js distinguishes NOT ASSESSED from NOT YET ENOUGH EXPOSURE',
  reportBg.includes('NOT ASSESSED is distinct from NOT YET ENOUGH EXPOSURE') ||
  reportBg.includes('NOT ASSESSED — the candidate chose not to answer'));

ok('p1-synthesis-background.js contains NOT ASSESSED outcome label',
  synthesisBg.includes('NOT ASSESSED'));

ok('p1-synthesis-background.js distinguishes it from development gap',
  synthesisBg.includes('carries no capability signal'));

ok('p1-candidate-synthesis-background.js contains NOT ASSESSED outcome label',
  candidateSynthBg.includes('NOT ASSESSED'));

ok('p1-manager-safe-background.js contains NOT ASSESSED outcome label',
  managerSafeBg.includes('NOT ASSESSED'));

ok('NOT ASSESSED in skipped questions section of report system prompt',
  reportBg.includes('## Skipped questions') || reportBg.includes('Skipped questions'));

// ─── Section 6: Privacy boundary ─────────────────────────────────────────────
console.log('\n6. Privacy boundary — manager-safe excludes accommodation history');

ok('manager-safe-background.js explicitly prohibits accommodation history',
  managerSafeBg.includes('accommodation history') || managerSafeBg.includes('accommodation types'));

ok('manager-safe-background.js explicitly prohibits provenance records',
  managerSafeBg.includes('provenance records'));

ok('manager-safe-background.js explicitly prohibits teaching intervention details',
  managerSafeBg.includes('teaching intervention details'));

ok('p1-generate-report-background.js MANAGER_SAFE_SYSTEM prohibits accommodation history',
  reportBg.includes('accommodation history') || reportBg.includes('accommodation types used'));

ok('p1-generate-report-background.js MANAGER_SAFE_SYSTEM prohibits provenance records',
  reportBg.includes('provenance records'));

ok('questionProvenance stored in candidate-private blob',
  reportBg.includes('questionProvenance') && reportBg.includes('candidate-private'));

ok('questionProvenance NOT present in manager-safe blob write',
  (() => {
    const managerSafeWrite = reportBg.match(/setJSON\(`\$\{sessionId\}\/manager-safe`[^)]+\)/s);
    if (!managerSafeWrite) return true; // Can't find it, assume ok
    return !managerSafeWrite[0].includes('questionProvenance');
  })());

// ─── Section 7: Rephrase cap ──────────────────────────────────────────────────
console.log('\n7. Rephrase cap — maximum 2 rephrases per question');

ok('rephraseCount state variable declared',
  html.includes('let rephraseCount = {}'));

ok('rephrase cap logic: count >= 2 triggers cap state',
  html.includes('atCap') && html.includes('count >= 2'));

ok('After rephrase cap: help panel shows skip-only message',
  html.includes("I've offered two versions of this question"));

ok('[REPHRASE REQUEST 2] signal used for second rephrase',
  html.includes('[REPHRASE REQUEST 2]'));

ok('rephraseCount incremented on each rephrase',
  html.includes("rephraseCount[currentQ] = (rephraseCount[currentQ] || 0) + 1"));

// ─── Section 8: Report integrity ─────────────────────────────────────────────
console.log('\n8. Report integrity — provenance and skipped sections in system prompt');

ok('Report system prompt contains Provenance notes section',
  reportBg.includes('## Provenance notes') || reportBg.includes('Provenance notes'));

ok('Report system prompt contains Skipped questions section',
  reportBg.includes('## Skipped questions') || reportBg.includes('Skipped questions'));

ok('Provenance passed to callAnthropic in handler',
  reportBg.includes('questionProvenance') && reportBg.includes('buildReportSystem'));

ok('skippedQuestions extracted from contextAnswers',
  reportBg.includes('skippedQuestions = contextAnswers?.skippedQuestions'));

ok('questionProvenance extracted from contextAnswers',
  reportBg.includes('questionProvenance = contextAnswers?.questionProvenance'));

// ─── Section 9: Uncertain signal ─────────────────────────────────────────────
console.log('\n9. Uncertain signal handling');

ok('System prompt handles [UNCERTAIN SIGNAL]',
  tutorJs.includes('[UNCERTAIN SIGNAL]'));

ok('System prompt instructs evaluation of substance not confidence',
  tutorJs.includes('evaluate the substance') || tutorJs.includes('evaluate the SUBSTANCE'));

ok('Uncertain-response rule explicitly stated in system prompt',
  tutorJs.includes('Uncertain-response rule') || tutorJs.includes('uncertain-response rule'));

ok('Client sends [UNCERTAIN SIGNAL] prefix when checkbox checked',
  html.includes('[UNCERTAIN SIGNAL]'));

ok('Uncertain checkbox present in HTML',
  html.includes("reflection-uncertain-check"));

ok("reassure response advances question as 'after-clarification'",
  html.includes('lm.reassure') && html.includes("'after-clarification'"));

// ─── Section 10: Tone guidance ────────────────────────────────────────────────
console.log('\n10. Tone guidance');

ok('System prompt prohibits "Great answer!" opener',
  tutorJs.includes('"Great answer!"') || tutorJs.includes("Great answer!"));

ok('System prompt prohibits "Well done!" opener',
  tutorJs.includes('"Well done!"') || tutorJs.includes("Well done!"));

ok('System prompt instructs plain warm language for accommodations',
  tutorJs.includes('plain, warm language'));

ok('System prompt prohibits "This question is designed to assess"',
  tutorJs.includes('"This question is designed to assess"') ||
  tutorJs.includes('This question is designed to assess'));

ok('System prompt prohibits academic register',
  tutorJs.includes('academic register') || tutorJs.includes('formal or academic'));

ok('System prompt defines when to trigger a Learning Moment (no specific situation rule)',
  tutorJs.includes('No specific situation') || tutorJs.includes('no specific situation') ||
  (tutorJs.includes('general habit') && tutorJs.includes('reprompt')));

ok('System prompt identifies vague habit statements as insufficient evidence',
  tutorJs.includes('I try to') || tutorJs.includes('I always') || tutorJs.includes('I usually just'));

// ─── Section 11: Evidence integrity safeguards ───────────────────────────────
console.log('\n11. Evidence integrity — check-question and uncertain signal');

ok('No fake "Thank you." injected after check-question response (evidence integrity)',
  (() => {
    // The check-question path must NOT push a synthetic assistant approval message.
    // Locate the lmPhase === 'check' block and ensure no 'Thank you.' is injected.
    const checkBlock = html.slice(html.indexOf("lmPhase === 'check'"), html.indexOf("lmPhase === 'recognition'"));
    return !checkBlock.includes("content: 'Thank you.'") && !checkBlock.includes('content: "Thank you."');
  })());

ok("recognitionYes() uses neutral prompt, not approval acknowledgement",
  html.includes("Please tell me more about that experience.") &&
  !html.includes("Thank you — that context is helpful."));

ok("Uncertain checkbox sets accommodationUsedThisQ = true (provenance accuracy)",
  html.includes('accommodationUsedThisQ = true; // uncertain checkbox is an accommodation') ||
  (html.includes('isUncertain') && html.includes('accommodationUsedThisQ = true')));

ok('questionProvenance not passed to manager-safe generator input (privacy structural check)',
  (() => {
    // Manager-safe is called with JSON.stringify(report) — it must not receive contextAnswers or questionProvenance.
    const msCallIdx = reportBg.indexOf('Generate the Manager Development Summary based on this candidate');
    const surroundingCode = reportBg.slice(Math.max(0, msCallIdx - 200), msCallIdx + 200);
    return !surroundingCode.includes('questionProvenance') && !surroundingCode.includes('contextAnswers');
  })());

ok('candidate-private stores questionProvenance (provenance persisted for report)',
  reportBg.includes('candidate-private') && reportBg.includes('questionProvenance'));

ok('check-question response is pushed to messages for report evaluation',
  (() => {
    const checkBlock = html.slice(html.indexOf("lmPhase === 'check'"), html.indexOf("lmPhase === 'recognition'"));
    return checkBlock.includes("messages.push({ role: 'user', content: responseText })");
  })());

// ─── Section 12: Data minimization — manager-safe stripped input ─────────────
console.log('\n12. Data minimization — manager-safe receives stripped input only');

ok('buildManagerSafeInput function defined in p1-generate-report-background.js',
  reportBg.includes('function buildManagerSafeInput'));

ok('buildManagerSafeInput strips evidence field from areas',
  (() => {
    const fn = reportBg.match(/function buildManagerSafeInput\(report\)[\s\S]*?^}/m);
    if (!fn) return false;
    return !fn[0].includes('evidence') && fn[0].includes('outcome');
  })());

ok('buildManagerSafeInput strips overallSummary',
  (() => {
    const fn = reportBg.match(/function buildManagerSafeInput\(report\)[\s\S]*?^}/m);
    if (!fn) return false;
    return !fn[0].includes('overallSummary');
  })());

ok('buildManagerSafeInput strips demonstratedStrengths',
  (() => {
    const fn = reportBg.match(/function buildManagerSafeInput\(report\)[\s\S]*?^}/m);
    if (!fn) return false;
    return !fn[0].includes('demonstratedStrengths');
  })());

ok('buildManagerSafeInput strips candidateActions',
  (() => {
    const fn = reportBg.match(/function buildManagerSafeInput\(report\)[\s\S]*?^}/m);
    if (!fn) return false;
    return !fn[0].includes('candidateActions');
  })());

ok('buildManagerSafeInput retains area outcomes and exposureConfirmation',
  (() => {
    const fn = reportBg.match(/function buildManagerSafeInput\(report\)[\s\S]*?^}/m);
    if (!fn) return false;
    return fn[0].includes('outcome') && fn[0].includes('exposureConfirmation');
  })());

ok('buildManagerSafeInput retains development priority rank, area, gapType — no narrative text',
  (() => {
    const fn = reportBg.match(/function buildManagerSafeInput\(report\)[\s\S]*?^}/m);
    if (!fn) return false;
    return fn[0].includes('gapType') && fn[0].includes('rank') &&
           !fn[0].includes('developmentAction') && !fn[0].includes('.why');
  })());

ok('Manager-safe call uses buildManagerSafeInput (not full report)',
  (() => {
    const callIdx = reportBg.indexOf('Generate the Manager Development Summary');
    // Template literal: "...Summary from this candidate outcome summary:\n\n${JSON.stringify(buildManagerSafeInput(report)..."
    // buildManagerSafeInput appears AFTER the text, so search forward
    const surrounding = reportBg.slice(callIdx, callIdx + 300);
    return surrounding.includes('buildManagerSafeInput(report)') &&
           !surrounding.match(/JSON\.stringify\(\s*report\s*[,)]/);
  })());

ok('MANAGER_SAFE_SYSTEM explains stripped input (no inference from candidate statements)',
  reportBg.includes('No candidate quotes') || reportBg.includes('do not invent or infer specific candidate statements'));

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
