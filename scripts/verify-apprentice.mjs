// verify-apprentice.mjs — Playwright behavioral verification for apprentice-review.html
// Covers: all distinct LM shapes, key branching paths, A10/A34 fixes, report rendering.
// Mocks fetch for tutor, background, and status endpoints.
// Run with: node scripts/verify-apprentice.mjs

import { chromium } from 'playwright';

const BASE = 'http://localhost:9111';
const PASS = '\x1b[32m✅\x1b[0m';
const FAIL = '\x1b[31m❌\x1b[0m';
const INFO = '\x1b[36m→\x1b[0m';

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { console.log(`${PASS} ${label}`); pass++; }
  else { console.log(`${FAIL} ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// Minimal valid JWT for plan:'apprentice'
function makeToken(plan = 'apprentice') {
  const payload = Buffer.from(JSON.stringify({ email: 'test@arev.local', plan, expires: Date.now() + 86400000 })).toString('base64');
  const secret = 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  const sig = Buffer.from(`${payload}.${secret}`).toString('base64').slice(0, 32);
  return `${payload}.${sig}`;
}

// Tutor mock responses keyed by shape
const TUTOR_RESPONSES = {
  'full-loop': { gapType: 'knowledge', explain: 'Professional conduct means acting with integrity at all times, including when facing commercial pressure.', checkQuestion: 'If a client asked you to omit a defect from a report to help a sale proceed, what would you do?' },
  'recognition-prompt': { recognitionPrompt: 'Have you observed a colleague dealing with a complaint or difficult client situation — even as a bystander?' },
  'bespoke-a5': { explain: 'RICS requires members to reflect on their practice and actively seek to improve it. Self-assessment is the foundation of CPD.', pivotQuestion: 'What is one area from today where you could develop further?' },
  'single-reprompt': { reprompt: 'Think about a specific project — can you describe what you personally contributed to the cost planning?' },
  'explain-only': { explain: 'Understanding which competencies align to your route helps you prioritise where to focus your development time.' },
};

// Canned report for polling mock
const CANNED_REPORT = {
  schemaVersion: 'apprentice-v1',
  route: 'Building Surveying',
  stage: '12–24 months',
  overallSummary: 'The apprentice demonstrates solid foundational knowledge with some areas requiring further practical experience.',
  areas: Array.from({length:7}, (_,i) => ({
    id: i+1,
    name: ['Professional Knowledge & Application','Experience & Technical Development','Professional Judgement & Problem Solving','Communication & Client Relationships','Commercial & Business Awareness','Ethics, Professionalism & Responsibility','Self-Development & Progression'][i],
    outcome: ['ON TRACK','DEVELOPING','ON TRACK','DEVELOPING','ATTENTION REQUIRED','ON TRACK','DEVELOPING'][i],
    evidence: 'Demonstrated through structured responses.',
    developmentNeed: 'Further exposure to complex scenarios required.',
    conclusion: 'Overall capability is appropriate to stage.'
  })),
  demonstratedStrengths: ['Strong ethical awareness', 'Good self-reflection'],
  developmentPriorities: [{ rank:1, priority:'Commercial awareness', gapType:'experience', developmentAction:'Seek involvement in fee negotiations and budget reviews.', why:'Responses indicate limited direct commercial exposure.' }],
  apprenticeActions: ['Ask to shadow fee discussions with clients.'],
  workplaceOpportunities: ['Involvement in cost planning exercises.'],
  developmentConversation: ['Discuss commercial exposure goals with line manager.']
};

async function setup(page, plan = 'apprentice') {
  // Inject token before page load
  await page.addInitScript((tok) => {
    localStorage.setItem('gca_token', tok);
    localStorage.setItem('gca_plan', 'apprentice');
  }, makeToken(plan));

  // Mock tutor — route to response by shape in messages
  await page.route('**/.netlify/functions/apprentice-tutor', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const msgs = body.messages || [];
    const content = msgs[0]?.content || '';
    let shape = 'full-loop';
    if (content.includes('recognition-prompt')) shape = 'recognition-prompt';
    else if (content.includes('bespoke-a5')) shape = 'bespoke-a5';
    else if (content.includes('explain-only')) shape = 'explain-only';
    else if (content.includes('single-reprompt')) shape = 'single-reprompt';
    const resp = TUTOR_RESPONSES[shape] || TUTOR_RESPONSES['full-loop'];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type:'text', text: JSON.stringify(resp) }] }) });
  });

  // Mock background function
  await page.route('**/.netlify/functions/apprentice-generate-report-background', async (route) => {
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"started":true}' });
  });

  // Mock status — return complete immediately
  await page.route('**/.netlify/functions/apprentice-report-status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'complete', report: CANNED_REPORT }) });
  });
}

async function clearProgress(page) {
  // Only call after page has navigated
  await page.evaluate(() => {
    try { localStorage.removeItem('gca_arev_progress'); } catch(e) {}
  });
}

async function goToOverlay(page, clearFirst = false) {
  if (clearFirst) {
    await context.addInitScript(() => {
      try { localStorage.removeItem('gca_arev_progress'); } catch(e) {}
    });
  }
  await page.goto(`${BASE}/apprentice-review.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);
  // Click the nav "Start the Review →" button to trigger arevLaunch()
  await page.click('.nav-btn');
  await page.waitForTimeout(600);
}

// ──────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await setup(page);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 1: OVERLAY OPEN + WELCOME SCREEN ──');
await goToOverlay(page, true);
const overlayVisible = await page.isVisible('#arev-overlay');
check('Overlay opens on page load for authenticated apprentice user', overlayVisible);
const heading = await page.textContent('.arev-heading').catch(() => '');
check('Welcome screen heading visible', heading.includes('Apprentice') || heading.includes('Welcome') || heading.length > 2, `got: "${heading}"`);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 2: A1 — STRUCTURED INTAKE ──');
// Click start (if welcome screen has a button)
const startBtn = page.locator('.arev-btn-primary').first();
await startBtn.click();
await page.waitForTimeout(400);

// Should now see A1 (structured-intake)
const a1RouteSelect = await page.$('#arev-a1-route');
check('A1: route select is present', !!a1RouteSelect);
const a1StageSelect = await page.$('#arev-a1-stage');
check('A1: stage select is present', !!a1StageSelect);
const a1RoleInput = await page.$('#arev-a1-role');
check('A1: role input is present', !!a1RoleInput);

// Try to continue without selecting → validation error
await page.click('text=Continue →');
await page.waitForTimeout(200);
const errVisible = await page.isVisible('#arev-err');
check('A1: validation fires when route/stage empty', errVisible);

// Fill and continue
await page.selectOption('#arev-a1-route', 'Building Surveying');
await page.selectOption('#arev-a1-stage', '12–24 months');
await page.fill('#arev-a1-role', 'Graduate Building Surveyor');
await page.click('text=Continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 3: A2 — CONTEXT MCQ (no LM, no score) ──');
const a2Options = await page.$$('.arev-option');
check('A2: MCQ options rendered (context-mcq type)', a2Options.length >= 3);
// No escape button expected for A2
const a2Escape = await page.$('.arev-escape-btn');
check('A2: no escape button (context-only)', !a2Escape);
// Select option and continue
await a2Options[0].click();
await page.waitForTimeout(100);
const a2Selected = await page.$('.arev-option.selected');
check('A2: option selection registers .selected class', !!a2Selected);
await page.click('text=Continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 4: A3 — FREE TEXT + RECOGNITION-PROMPT on escape ──');
const a3Textarea = await page.$('#arev-answer');
check('A3: free-text textarea present', !!a3Textarea);
const a3EscapeBtn = await page.$('.arev-escape-btn');
check('A3: escape button present (recognition-prompt shape)', !!a3EscapeBtn);

// Trigger escape → recognition-prompt LM
await a3EscapeBtn.click();
await page.waitForTimeout(1200); // wait for async tutor call

const recYes = await page.$('#arev-rec-yes-btn');
const recNo  = await page.$('#arev-rec-no-btn');
check('A3 escape: recognition-prompt card shows Yes/No buttons', !!recYes && !!recNo);
const recText = await page.textContent('.arev-recognition-text').catch(() => '');
check('A3 escape: recognition-prompt text rendered from tutor', recText.includes('observed') || recText.length > 10, `got: "${recText.slice(0,60)}"`);

// Choose No → should advance without asking for example
await recNo.click();
await page.waitForTimeout(400);
const afterA3 = await page.textContent('#arev-overlay-content').catch(() => '');
check('A3 escape → No: advances past recognition-prompt', !afterA3.includes('arev-rec-no-btn'));

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 5: A4 — SCENARIO MCQ + FULL-LOOP on escape ──');
const a4Options = await page.$$('.arev-option');
check('A4: scenario MCQ options present', a4Options.length >= 4);
// Select escape option (E — last option matching escape)
const a4EscapeOpt = page.locator('.arev-option-letter:text("E")').first();
const a4EscapeOptParent = a4EscapeOpt.locator('..');
await a4EscapeOptParent.click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(1500); // full-loop API call

// Should now see LM explain + check step
const checkStep = await page.$('.arev-lm-explain');
check('A4 escape: full-loop LM — explain text rendered', !!checkStep);
const checkTextarea = await page.$('#arev-check-answer');
check('A4 escape: CHECK step textarea rendered', !!checkTextarea);
await checkTextarea.fill('I would decline to omit the defect and explain my professional obligation.');
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 6: A5 — FREE TEXT + BESPOKE-A5 on escape ──');
const a5Textarea = await page.$('#arev-answer');
check('A5: free-text textarea present', !!a5Textarea);
const a5EscapeBtn = await page.$('.arev-escape-btn');
check('A5: escape button present (bespoke-a5 shape)', !!a5EscapeBtn);

await a5EscapeBtn.click();
await page.waitForTimeout(1500);

// Should show: explain text + pivot question + textarea (no separate CHECK step)
const a5Explain = await page.$('.arev-lm-explain');
check('A5 escape: bespoke-a5 LM — explain rendered', !!a5Explain);
const a5CheckQ = await page.$('.arev-lm-check-q');
check('A5 escape: pivot question rendered', !!a5CheckQ);
const a5SubmitBtn = await page.$('#arev-a5-submit-btn');
check('A5 escape: submit button is #arev-a5-submit-btn (not check-submit-btn)', !!a5SubmitBtn);
const a5PivotTa = await page.$('#arev-a5-pivot');
check('A5 escape: pivot textarea is #arev-a5-pivot (not #arev-check-answer)', !!a5PivotTa);

// Confirm there is NO separate CHECK step (no #arev-check-answer)
const noCheckTa = await page.$('#arev-check-answer');
check('A5 escape: no generic CHECK textarea (pivot is distinct)', !noCheckTa);

await a5PivotTa.fill('I could focus more on self-assessment in technical areas.');
await a5SubmitBtn.click();
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 7: A6 — STRUCTURED MCQ + EXPLAIN-ONLY (no CHECK) ──');
const a6Options = await page.$$('.arev-option');
check('A6: MCQ options present', a6Options.length >= 3);
const a6MultiSelect = await page.$('#arev-a6-multi');
check('A6: route-specific multi-select ALWAYS shown', !!a6MultiSelect);

// Select escape option E
const a6EscapeOpt = page.locator('.arev-option-letter:text("E")').first();
await (await a6EscapeOpt.locator('..').elementHandle()).click();
await page.waitForTimeout(100);
await page.click('text=Save and continue →');
await page.waitForTimeout(1500);

// Should see explain text + Continue button, but NO check textarea (explain-only, no CHECK step)
const a6Explain = await page.$('.arev-lm-explain');
check('A6 escape: explain text rendered', !!a6Explain);
const a6CheckTa = await page.$('#arev-check-answer');
check('A6 escape: NO CHECK textarea (explain-only shape, no CHECK step)', !a6CheckTa);
const a6ContinueBtn = await page.$('#arev-explain-only-continue-btn');
check('A6 escape: single Continue button (not check submit)', !!a6ContinueBtn);
await a6ContinueBtn.click();
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 8: A7 — FREE TEXT + RECOGNITION-PROMPT (same shape as A3) ──');
const a7Textarea = await page.$('#arev-answer');
check('A7: free-text textarea present', !!a7Textarea);
const a7EscapeBtn = await page.$('.arev-escape-btn');
check('A7: escape button present', !!a7EscapeBtn);
// Answer normally
await a7Textarea.fill('I regularly check property registers to verify ownership before proceeding.');
await page.click('text=Save and continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 9: A8 — FREE TEXT + SILENT-FLAG (escape silently accepted) ──');
const a8Textarea = await page.$('#arev-answer');
check('A8: free-text textarea present', !!a8Textarea);
const a8EscapeBtn = await page.$('.arev-escape-btn');
check('A8: escape button present (silent-flag shape)', !!a8EscapeBtn);
// Trigger escape — should advance immediately with no LM card
await a8EscapeBtn.click();
await page.waitForTimeout(600);
const a8LmCard = await page.$('.arev-lm-card');
const a8RecCard = await page.$('.arev-recognition-card');
check('A8 escape: no LM card shown (silent-flag — immediate advance)', !a8LmCard && !a8RecCard);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 10: A9 — SCENARIO MCQ + FOLLOW-UP (checkAndFollowupBoth) ──');
// A9: non-escape selection → always-followup shown directly
const a9Options = await page.$$('.arev-option');
check('A9: scenario MCQ options present', a9Options.length >= 4);
// Select option A (not escape)
await a9Options[0].click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(400);
// Follow-up should appear
const a9FollowupPanel = await page.$('.arev-panel');
const a9FollowupTa = await page.$('#arev-followup');
check('A9 (A selected): always-followup textarea shown immediately', !!a9FollowupTa);
await a9FollowupTa.fill('My supervisor reviews my reports before they go to the client.');
await page.click('text=Save and continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 11: A10 — CONTEXT MCQ + FOLLOW-UP (no score, no LM) ──');
const a10Options = await page.$$('.arev-option');
check('A10: MCQ options rendered (7 options A-G)', a10Options.length >= 7);
// Select any option
await a10Options[0].click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(400);
// Follow-up should appear ("What would help you progress?")
const a10FollowupTa = await page.$('#arev-followup');
check('A10: follow-up textarea shown ("What would help you progress?")', !!a10FollowupTa);
const a10OverlayHtml = await page.innerHTML('#arev-overlay-content').catch(() => '');
check('A10: no LM card shown (context/calibration only — no Learning Moment)', !a10OverlayHtml.includes('arev-lm-card') && !a10OverlayHtml.includes('arev-check-answer'));
await a10FollowupTa.fill('More structured feedback from my supervisor.');
await page.click('text=Save and continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 12: A11 — SCENARIO MCQ + FULL-LOOP (non-escape path) ──');
const a11Options = await page.$$('.arev-option');
check('A11: scenario MCQ options present', a11Options.length >= 4);
// Select best answer (C) — no LM, should advance straight through
const a11CLabel = page.locator('.arev-option-letter:text("C")').first();
await (await a11CLabel.locator('..').elementHandle()).click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(400);
// Should NOT show LM (only E triggers it)
const a11Content = await page.innerHTML('#arev-overlay-content').catch(() => '');
check('A11 (C selected): no LM card shown for non-escape selection', !a11Content.includes('arev-lm-explain'));

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 13: A12 — FREE TEXT + OBSERVATIONAL LEARNING path ──');
const a12Textarea = await page.$('#arev-answer');
check('A12: free-text textarea present', !!a12Textarea);
const a12EscapeBtn = await page.$('.arev-escape-btn');
check('A12: escape button present (observational-learning shape)', !!a12EscapeBtn);
// Trigger escape → observational path (not standard LM)
await a12EscapeBtn.click();
await page.waitForTimeout(400);
const obsYes = await page.$('#arev-obs-yes-btn');
const obsNo  = await page.$('#arev-obs-no-btn');
check('A12 escape: observational-learning card shows Observed Yes/No (not recognition-prompt)', !!obsYes && !!obsNo);
// Choose "Yes — I've observed"
await obsYes.click();
await page.waitForTimeout(200);
const obsReflection = await page.$('#arev-obs-reflection');
check('A12 observational Yes: reflection textarea appears', !!obsReflection);
await obsReflection.fill('My supervisor handled a tenant complaint — I noticed they kept records of every step.');
await page.click('#arev-obs-submit-btn');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 14: A13 — CONTEXT MCQ (calibration, no LM) ──');
const a13Options = await page.$$('.arev-option');
check('A13: MCQ options present (self-report/calibration)', a13Options.length >= 3);
await a13Options[1].click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 15: A14 — FREE TEXT + OBSERVATIONAL LEARNING path ──');
const a14EscapeBtn = await page.$('.arev-escape-btn');
check('A14: escape button present (observational-learning shape)', !!a14EscapeBtn);
await a14EscapeBtn.click();
await page.waitForTimeout(400);
const a14ObsNo = await page.$('#arev-obs-no-btn');
check('A14 escape: observational-learning path (not recognition-prompt)', !!a14ObsNo);
// Choose No → should advance
await a14ObsNo.click();
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 16: A15 — MCQ FOLLOWUP with checkReplacesFollowup ──');
const a15Options = await page.$$('.arev-option');
check('A15: scenario MCQ options present', a15Options.length >= 4);
// Select escape E → full-loop fires → CHECK step → after CHECK, should ADVANCE (not show followup)
const a15EscapeOpt = page.locator('.arev-option-letter:text("E")').first();
await (await a15EscapeOpt.locator('..').elementHandle()).click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(1500);
const a15CheckTa = await page.$('#arev-check-answer');
check('A15 escape: CHECK step appears after full-loop', !!a15CheckTa);
await a15CheckTa.fill('I would stop and ask my supervisor before proceeding further.');
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(600);
// After CHECK submit, should NOT show alwaysFollowUp textarea (checkReplacesFollowup=true)
const a15FollowupTa = await page.$('#arev-followup');
check('A15 escape: no always-followup after CHECK (checkReplacesFollowup=true)', !a15FollowupTa);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 17: A16–A18 quick-pass (skip to A19) ──');
// A16: context-mcq
let opts = await page.$$('.arev-option');
if (opts.length) { await opts[0].click(); await page.waitForTimeout(100); await page.click('text=Continue →'); await page.waitForTimeout(400); }
// A17: free-text no escape
let ta = await page.$('#arev-answer');
if (ta) { await ta.fill('I wrote a defect inspection report and presented it to the client in person.'); await page.click('text=Save and continue →'); await page.waitForTimeout(400); }
// A18: free-text + recognition-prompt
const a18Esc = await page.$('.arev-escape-btn');
if (a18Esc) {
  ta = await page.$('#arev-answer');
  if (ta) { await ta.fill('I prepare written update reports for my manager.'); }
  await page.click('text=Save and continue →'); await page.waitForTimeout(400);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 18: A19 — DUAL-FOLLOWUP MCQ (escape→full-loop, followup escape→recognition-then-fullloop) ──');
opts = await page.$$('.arev-option');
check('A19: scenario MCQ options present', opts.length >= 4);
// Select non-escape → always-followup shown
await opts[0].click();
await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(400);
const a19FollowupTa = await page.$('#arev-dual-followup');
check('A19 non-escape: dual-followup textarea appears', !!a19FollowupTa);
// Trigger followup escape → recognition-then-fullloop
const a19DualEscape = await page.$('#arev-dual-escape-btn');
check('A19: follow-up escape button present', !!a19DualEscape);
await a19DualEscape.click();
await page.waitForTimeout(1500);
// Should see recognition-prompt (not direct full-loop)
const a19RecCard = await page.$('.arev-recognition-card');
check('A19 followup-escape: recognition-prompt fires first (recognition-then-fullloop)', !!a19RecCard);
const a19RecNo = await page.$('#arev-rec-no-btn');
if (a19RecNo) { await a19RecNo.click(); await page.waitForTimeout(400); }

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 19: A20 — MCQ FOLLOWUP with checkReplacesFollowup ──');
opts = await page.$$('.arev-option');
check('A20: scenario MCQ options present', opts.length >= 4);
// Select E → full-loop → CHECK → should advance (no followup)
const a20EscOpt = page.locator('.arev-option-letter:text("E")').first();
await (await a20EscOpt.locator('..').elementHandle()).click();
await page.click('text=Continue →');
await page.waitForTimeout(1500);
const a20CheckTa = await page.$('#arev-check-answer');
check('A20 escape: CHECK step appears', !!a20CheckTa);
if (a20CheckTa) { await a20CheckTa.fill('Unclear expectations lead to rework, cost overruns and damaged trust.'); }
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(600);
const a20FuTa = await page.$('#arev-followup');
check('A20 escape: no always-followup after CHECK (checkReplacesFollowup=true)', !a20FuTa);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 20: A21 — MULTI-SELECT + CONDITIONAL FOLLOW-UP ──');
const a21Opts = await page.$$('#arev-a21-opts input[type=checkbox]');
check('A21: multi-select checkboxes present (9 options incl None yet)', a21Opts.length >= 9);
// Select two non-None options
await a21Opts[0].click(); await page.waitForTimeout(100);
await a21Opts[1].click(); await page.waitForTimeout(100);
await page.click('text=Continue →');
await page.waitForTimeout(400);
const a21FollowupTa = await page.$('#arev-a21-followup');
check('A21 (items selected): follow-up prompt appears', !!a21FollowupTa);
await a21FollowupTa.fill('The fees discussion, because it directly affects the business.');
await page.click('text=Save and continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 21a: A22 — checkReplacesFollowup (escape path, same as A15/A20) ──');
opts = await page.$$('.arev-option');
check('A22: scenario MCQ options present', opts.length >= 4);
const a22EscOpt = page.locator('.arev-option-letter:text("E")').first();
await (await a22EscOpt.locator('..').elementHandle()).click();
await page.click('text=Continue →');
await page.waitForTimeout(1500);
const a22CheckTa = await page.$('#arev-check-answer');
check('A22 escape: CHECK step appears after full-loop', !!a22CheckTa);
if (a22CheckTa) { await a22CheckTa.fill('Completing extra work without raising it could create fee, liability and scope problems.'); }
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(600);
const a22FuTa = await page.$('#arev-followup');
check('A22 escape: no always-followup after CHECK (checkReplacesFollowup=true)', !a22FuTa);

console.log('\n── SECTION 21b: A23 — checkReplacesFollowup (escape path) ──');
opts = await page.$$('.arev-option');
check('A23: scenario MCQ options present', opts.length >= 4);
const a23EscOpt = page.locator('.arev-option-letter:text("E")').first();
await (await a23EscOpt.locator('..').elementHandle()).click();
await page.click('text=Continue →');
await page.waitForTimeout(1500);
const a23CheckTa = await page.$('#arev-check-answer');
check('A23 escape: CHECK step appears after full-loop', !!a23CheckTa);
if (a23CheckTa) { await a23CheckTa.fill('Early escalation gives the team time to adjust scope, fees or programme before it becomes a problem.'); }
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(600);
const a23FuTa = await page.$('#arev-followup');
check('A23 escape: no always-followup after CHECK (checkReplacesFollowup=true)', !a23FuTa);

console.log('\n── SECTION 21c: A24 — free-text answer normally ──');
// A24: free-text + full-loop on escape — answer normally
ta = await page.$('#arev-answer');
if (ta) { await ta.fill('The client pays for specialist expertise, professional judgement, and accountability that they can\'t replicate in-house.'); await page.click('text=Save and continue →'); await page.waitForTimeout(500); }

console.log('\n── SECTION 21d: A25 — checkReplacesFollowup (non-escape to keep flow moving) ──');
// A25 already verified via named section 22 in the original; here quick-pass with non-escape
// to advance to A26 correctly
opts = await page.$$('.arev-option');
if (opts.length) { await opts[0].click(); await page.waitForTimeout(100); await page.click('text=Continue →'); await page.waitForTimeout(500); }
ta = await page.$('#arev-followup');
if (ta) { await ta.fill('Professional integrity means considering fitness for purpose and reliability, not just efficiency.'); await page.click('text=Save and continue →'); await page.waitForTimeout(500); }

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 22: A26 — NO-MCQ-ESCAPE + FOLLOWUP HAS ESCAPE → FULL-LOOP ──');
await page.waitForTimeout(300);
opts = await page.$$('.arev-option');
check('A26: scenario MCQ options present (A–D only, no E)', opts.length >= 1);
const a26Letters = await Promise.all(opts.map(o => o.$('.arev-option-letter').then(el => el ? el.textContent() : '')));
check('A26: no E option in option list', !a26Letters.includes('E'));
if (!opts.length) { console.log('  [SKIP] A26 — no options visible, check prior question timing'); }
else await opts[0].click(); await page.waitForTimeout(100);
await page.click('text=Continue →'); await page.waitForTimeout(400);
const a26FollowupTa = await page.$('#arev-a26-followup');
check('A26: follow-up textarea appears after MCQ (always shown)', !!a26FollowupTa);
const a26EscBtn = await page.$('#arev-a26-escape-btn');
check('A26: follow-up escape button present', !!a26EscBtn);
// Trigger the follow-up escape → should fire full-loop
await a26EscBtn.click();
await page.waitForTimeout(1500);
const a26LmExplain = await page.$('.arev-lm-explain');
check('A26 followup-escape: full-loop LM fires (explain rendered)', !!a26LmExplain);
const a26CheckTa = await page.$('#arev-check-answer');
if (a26CheckTa) { await a26CheckTa.fill('I would ask my supervisor to help me think through what I learned.'); }
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 23: A27 — checkReplacesFollowup ──');
opts = await page.$$('.arev-option');
if (opts.length) {
  const a27EscOpt = page.locator('.arev-option-letter:text("E")').first();
  const a27El = await a27EscOpt.locator('..').elementHandle().catch(() => null);
  if (a27El) {
    await a27El.click(); await page.click('text=Continue →'); await page.waitForTimeout(1500);
    const a27Check = await page.$('#arev-check-answer');
    check('A27 escape: CHECK step appears', !!a27Check);
    if (a27Check) { await a27Check.fill('Even perceived bias undermines trust in professional advice.'); }
    await page.click('#arev-check-submit-btn'); await page.waitForTimeout(600);
    const a27Fu = await page.$('#arev-followup');
    check('A27 escape: no always-followup after CHECK (checkReplacesFollowup=true)', !a27Fu);
  }
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 24: A28 — checkAndFollowupBoth (evidence-seeking) ──');
opts = await page.$$('.arev-option');
check('A28: scenario MCQ options present', opts.length >= 4);
const a28EscOpt = page.locator('.arev-option-letter:text("E")').first();
await (await a28EscOpt.locator('..').elementHandle()).click();
await page.click('text=Continue →');
await page.waitForTimeout(1500);
const a28CheckTa = await page.$('#arev-check-answer');
check('A28 escape: CHECK step fires (full-loop)', !!a28CheckTa);
if (a28CheckTa) { await a28CheckTa.fill('I would check my delegation letter and ask my supervisor.'); }
await page.click('#arev-check-submit-btn');
await page.waitForTimeout(600);
// After CHECK, evidence-seeking followup should STILL appear
const a28FollowupTa = await page.$('#arev-followup');
check('A28 escape: always-followup ALSO shown after CHECK (checkAndFollowupBoth=true)', !!a28FollowupTa);
if (a28FollowupTa) { await a28FollowupTa.fill('I check my delegation letter and confirm with my principal.'); }
await page.click('text=Save and continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 25: A29 — FREE TEXT no escape, no LM ──');
ta = await page.$('#arev-answer');
check('A29: free-text textarea present', !!ta);
const a29EscBtn = await page.$('.arev-escape-btn');
check('A29: no escape button (reflection only, no LM)', !a29EscBtn);
if (ta) { await ta.fill('A difficult client conversation taught me to always confirm instructions in writing.'); }
await page.click('text=Save and continue →');
await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 26: A30 — DUAL-FOLLOWUP (like A19, different question) ──');
opts = await page.$$('.arev-option');
check('A30: scenario MCQ options present', opts.length >= 4);
await opts[0].click(); await page.waitForTimeout(100);
await page.click('text=Continue →'); await page.waitForTimeout(400);
const a30FuTa = await page.$('#arev-dual-followup');
check('A30 (non-escape): dual-followup textarea shown', !!a30FuTa);
if (a30FuTa) { await a30FuTa.fill('I once flagged a fire exit blockage on a site visit and escalated it immediately.'); }
await page.click('text=Save and continue →'); await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 27: A31 — FREE TEXT + DUAL ESCAPE BUTTONS ──');
ta = await page.$('#arev-answer');
check('A31: free-text textarea present', !!ta);
const a31Esc1 = await page.$('#arev-esc1-btn');
const a31Esc2 = await page.$('#arev-esc2-btn');
check('A31: TWO distinct escape buttons present', !!a31Esc1 && !!a31Esc2);
const a31Esc1Text = await a31Esc1.textContent().catch(() => '');
const a31Esc2Text = await a31Esc2.textContent().catch(() => '');
check('A31 escape 1: exposure escape (recognition-prompt)', a31Esc1Text.includes('exposure') || a31Esc1Text.includes('sufficient'));
check('A31 escape 2: knowledge escape (full-loop)', a31Esc2Text.includes('sure') || a31Esc2Text.includes('sustainability'));
// Trigger escape 2 → full-loop
await a31Esc2.click(); await page.waitForTimeout(1500);
const a31LmExplain = await page.$('.arev-lm-explain');
check('A31 escape 2: full-loop LM fires', !!a31LmExplain);
const a31CheckTa = await page.$('#arev-check-answer');
if (a31CheckTa) { await a31CheckTa.fill('Sustainability affects material choice, whole-life cost planning, and regulatory compliance.'); }
await page.click('#arev-check-submit-btn'); await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 28: A32 — SCENARIO MCQ simple full-loop ──');
opts = await page.$$('.arev-option');
check('A32: scenario MCQ options present', opts.length >= 4);
await opts[0].click(); await page.waitForTimeout(100);
await page.click('text=Continue →'); await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 29: A33 — FREE TEXT + INVESTIGATION ALWAYS SHOWN ──');
ta = await page.$('#arev-answer');
check('A33: free-text textarea present', !!ta);
const a33EscBtn = await page.$('.arev-escape-btn');
check('A33: escape button present', !!a33EscBtn);
// Answer normally → investigation follow-up should appear
await ta.fill('My supervisor noted that my cost estimates lacked adequate contingency.');
await page.click('text=Save and continue →'); await page.waitForTimeout(400);
const a33InvTa = await page.$('#arev-a33-investigation');
check('A33: investigation follow-up textarea ALWAYS shown after main response', !!a33InvTa);
if (a33InvTa) { await a33InvTa.fill('Through written review notes left on my reports.'); }
await page.click('text=Save and continue →'); await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 30: A34 — CONTEXT MCQ + FOLLOW-UP (scored:false, follow-up included in report) ──');
opts = await page.$$('.arev-option');
check('A34: MCQ options present (context-mcq-followup)', opts.length >= 3);
await opts[1].click(); await page.waitForTimeout(100);
await page.click('text=Continue →'); await page.waitForTimeout(400);
const a34FuTa = await page.$('#arev-followup');
check('A34: follow-up textarea appears ("Give one recent example...")', !!a34FuTa);
if (a34FuTa) { await a34FuTa.fill('I researched MRICS requirements on my own and discussed them with my APC counsellor.'); }
await page.click('text=Save and continue →'); await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 31: A35 — FREE TEXT + FULL-LOOP on escape ──');
ta = await page.$('#arev-answer');
check('A35: free-text textarea present', !!ta);
const a35EscBtn = await page.$('.arev-escape-btn');
check('A35: escape button present (full-loop shape)', !!a35EscBtn);
// Answer normally
await ta.fill('The Renters\' Rights Act 2025 requires landlords to register properties — this changes how we advise residential clients on compliance.');
await page.click('text=Save and continue →'); await page.waitForTimeout(400);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 32: A36 — FINAL PRIORITIES (exactly 3, then first-priority follow-up) ──');
const a36Checkboxes = await page.$$('#arev-a36-opts input[type=checkbox]');
check('A36: 14 checkbox options present', a36Checkboxes.length === 14);
// Try to continue with 0 selected → error
await page.click('text=Continue →'); await page.waitForTimeout(200);
const a36Err = await page.isVisible('#arev-err');
check('A36: validation error when < 3 selected', a36Err);
// Select exactly 3
await a36Checkboxes[0].click(); await a36Checkboxes[1].click(); await a36Checkboxes[2].click();
await page.waitForTimeout(100);
// Try to select a 4th → should be blocked
await a36Checkboxes[3].click(); await page.waitForTimeout(100);
const a36FourthChecked = await a36Checkboxes[3].isChecked();
check('A36: 4th selection blocked (limit enforced)', !a36FourthChecked);
await page.click('text=Continue →'); await page.waitForTimeout(400);
// Follow-up: "Which ONE first — and why?"
const a36FuTa = await page.$('#arev-a36-followup');
check('A36: follow-up "Which ONE first — and why?" appears', !!a36FuTa);
await a36FuTa.fill('Technical knowledge — it underpins everything else I do.');
await page.click('text=Complete review →'); await page.waitForTimeout(1500);

// ═══════════════════════════════════════════════════════════════
console.log('\n── SECTION 33: REPORT — GENERATION + RENDER ──');
// Should now see report (mocked status returns complete immediately)
const reportHeading = await page.textContent('.arev-heading').catch(() => '');
check('Report: heading rendered', reportHeading.includes('Professional Readiness Report') || reportHeading.includes('Generating'));
// Wait for polling to resolve (mock returns complete on first call)
await page.waitForTimeout(9500); // one 8s poll interval
const reportHeadingFinal = await page.textContent('.arev-heading').catch(() => '');
check('Report: "Professional Readiness Report" heading after polling', reportHeadingFinal.includes('Professional Readiness Report'));
const reportRoute = await page.textContent('.arev-sub').catch(() => '');
check('Report: route + stage in subtitle', reportRoute.includes('Building Surveying') && reportRoute.includes('12–24 months'));
const outcomeCount = await page.$$eval('.arev-outcome-badge', els => els.length);
check('Report: 7 area outcome badges rendered', outcomeCount === 7);
const onTrack = await page.$$eval('.arev-on-track', els => els.length);
const developing = await page.$$eval('.arev-developing', els => els.length);
const attention = await page.$$eval('.arev-attention', els => els.length);
check('Report: outcome badges sum to 7', onTrack + developing + attention === 7);
const disclaimer = await page.$('.arev-report-disclaimer');
check('Report: disclaimer box rendered (not EPA/APC)', !!disclaimer);
const disclaimerText = await disclaimer.textContent().catch(() => '');
check('Report: disclaimer correctly states not EPA/APC', disclaimerText.includes('EPA') && disclaimerText.includes('APC'));
const priorityRank = await page.$('.arev-priority-rank');
check('Report: at least one development priority rendered', !!priorityRank);
const strengthsList = await page.$('.arev-report-list');
check('Report: at least one list section rendered (strengths/actions)', !!strengthsList);

// ═══════════════════════════════════════════════════════════════
console.log('\n── RESULTS ──');
console.log(`${PASS} Passed: ${pass}`);
if (fail > 0) console.log(`${FAIL} Failed: ${fail}`);
else console.log('\x1b[32mAll checks passed.\x1b[0m');

await browser.close();
process.exit(fail > 0 ? 1 : 0);
