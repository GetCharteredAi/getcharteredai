// verify-apprentice-infra.mjs — Real-infrastructure verification for apprentice-review
// Targets the Netlify deploy preview. No mocked fetches.
// Tests: real LM responses, real Background Function, real Blobs pending→complete, retake limit.

import { chromium } from 'playwright';
import { createHmac } from 'crypto';

const DEPLOY = 'https://deploy-preview-2--getcharteredai.netlify.app';
const PASS = '\x1b[32m✅\x1b[0m';
const FAIL = '\x1b[31m❌\x1b[0m';
const INFO = '\x1b[36m→\x1b[0m';

let pass = 0, fail = 0, findings = [];
function check(label, condition, detail) {
  if (condition) { console.log(`${PASS} ${label}`); pass++; }
  else { console.log(`${FAIL} ${label}${detail ? '\n    ' + detail : ''}`); fail++; }
}
function finding(msg) { console.log(`  ⚠️  ${msg}`); findings.push(msg); }
function note(msg) { console.log(`  ${INFO} ${msg}`); }

// Unique per run so prior failed runs don't consume Blobs retake count
const RUN_EMAIL = `infra-test-${Date.now()}@arev.local`;
note(`Run email: ${RUN_EMAIL}`);

function makeToken(plan = 'apprentice') {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const payload = Buffer.from(JSON.stringify({ email: RUN_EMAIL, plan, expires: Date.now() + 3600000 })).toString('base64');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

// ── Universal advance: handles every screen state that can appear during A1–A36
async function advance(page, passLabel = '') {
  await page.waitForTimeout(250);

  // A1 — structured intake
  if (await page.$('#arev-a1-route')) {
    await page.selectOption('#arev-a1-route', 'Building Surveying').catch(() => {});
    await page.selectOption('#arev-a1-stage', '12–24 months').catch(() => {});
    const roleInput = await page.$('#arev-a1-role'); if (roleInput) await roleInput.fill('Graduate BS');
    await page.click('text=Continue →').catch(() => {}); await page.waitForTimeout(400); return 'A1';
  }

  // LM check step (full-loop CHECK — takes priority over other textareas)
  if (await page.$('#arev-check-submit-btn')) {
    const checkTa = await page.$('#arev-check-answer');
    if (checkTa) await checkTa.fill('Infra test check answer.');
    await page.click('#arev-check-submit-btn').catch(() => {}); await page.waitForTimeout(500); return 'check';
  }

  // A5 bespoke pivot
  if (await page.$('#arev-a5-submit-btn')) {
    const a5ta = await page.$('#arev-a5-pivot'); if (a5ta) await a5ta.fill('Infra test pivot.');
    await page.click('#arev-a5-submit-btn').catch(() => {}); await page.waitForTimeout(400); return 'a5';
  }

  // Explain-only continue (A6 LM)
  if (await page.$('#arev-explain-only-continue-btn')) {
    await page.click('#arev-explain-only-continue-btn').catch(() => {}); await page.waitForTimeout(400); return 'explain-only';
  }

  // Recognition yes/no
  const recNo = await page.$('#arev-rec-no-btn');
  if (recNo) { await recNo.click(); await page.waitForTimeout(300); return 'rec-no'; }
  const obsNo = await page.$('#arev-obs-no-btn');
  if (obsNo) { await obsNo.click(); await page.waitForTimeout(300); return 'obs-no'; }
  const recYes = await page.$('#arev-rec-yes-btn');
  if (recYes) {
    await recYes.click(); await page.waitForTimeout(200);
    const recEx = await page.$('#arev-rec-example'); if (recEx) await recEx.fill('Observed a relevant example briefly.');
    const recSub = await page.$('#arev-rec-submit-btn'); if (recSub) { await recSub.click(); await page.waitForTimeout(300); }
    return 'rec-yes';
  }
  const obsYes = await page.$('#arev-obs-yes-btn');
  if (obsYes) {
    await obsYes.click(); await page.waitForTimeout(200);
    const obsRef = await page.$('#arev-obs-reflection'); if (obsRef) await obsRef.fill('Observed a colleague handling this.');
    const obsSub = await page.$('#arev-obs-submit-btn'); if (obsSub) { await obsSub.click(); await page.waitForTimeout(300); }
    return 'obs-yes';
  }

  // A36 — final priorities multi-select
  const a36cbs = await page.$$('#arev-a36-opts input[type=checkbox]');
  if (a36cbs.length >= 3) {
    const checked = await page.$$eval('#arev-a36-opts input[type=checkbox]:checked', els => els.length);
    if (checked < 3) {
      for (let i = 0; i < 3 && i < a36cbs.length; i++) {
        const isChecked = await a36cbs[i].isChecked(); if (!isChecked) await a36cbs[i].click();
      }
      await page.waitForTimeout(100);
    }
    await page.click('text=Continue →').catch(() => {}); await page.waitForTimeout(400);
    const a36fu = await page.$('#arev-a36-followup');
    if (a36fu) { await a36fu.fill('Technical knowledge — foundational to everything.'); await page.click('text=Complete review →').catch(() => {}); await page.waitForTimeout(500); }
    return 'A36';
  }

  // A36 part 2 followup
  if (await page.$('#arev-a36-followup')) {
    await page.fill('#arev-a36-followup', 'Technical knowledge first.').catch(() => {});
    await page.click('text=Complete review →').catch(() => {}); await page.waitForTimeout(400); return 'A36-fu';
  }

  // A21 — multi-select commercial
  const a21opts = await page.$$('#arev-a21-opts input[type=checkbox]');
  if (a21opts.length) {
    const checked = await page.$$eval('#arev-a21-opts input[type=checkbox]:checked', els => els.length);
    if (!checked) await a21opts[0].click();
    await page.click('text=Continue →').catch(() => {}); await page.waitForTimeout(400);
    const a21fu = await page.$('#arev-a21-followup'); if (a21fu) { await a21fu.fill('Fees discussion.'); await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); }
    return 'A21';
  }

  // Scenario MCQ options
  const opts = await page.$$('.arev-option');
  if (opts.length) {
    await opts[0].click(); await page.waitForTimeout(100);
    const cont = page.locator('button:text("Continue →")').first();
    if (await cont.isVisible().catch(() => false)) { await cont.click(); await page.waitForTimeout(400); }
    const saveCont = page.locator('button:text("Save and continue →")').first();
    if (await saveCont.isVisible().catch(() => false)) { await saveCont.click(); await page.waitForTimeout(400); }
    // handle any followup that appears
    await page.waitForTimeout(200);
    const fu = await page.$('#arev-followup'); if (fu) { await fu.fill('Infra test.'); await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); }
    const dfu = await page.$('#arev-dual-followup'); if (dfu) { await dfu.fill('Infra test.'); await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); }
    const a26fu = await page.$('#arev-a26-followup'); if (a26fu) { await a26fu.fill('Infra test.'); await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); }
    return 'mcq';
  }

  // A26 followup (standalone, no MCQ above)
  if (await page.$('#arev-a26-followup')) {
    await page.fill('#arev-a26-followup', 'Infra test A26 followup.').catch(() => {});
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'a26-fu';
  }

  // Dual-followup (A19, A30)
  if (await page.$('#arev-dual-followup')) {
    await page.fill('#arev-dual-followup', 'Infra test dual.').catch(() => {});
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'dual-fu';
  }

  // A33 investigation followup (always shown)
  if (await page.$('#arev-a33-investigation')) {
    await page.fill('#arev-a33-investigation', 'Infra test investigation.').catch(() => {});
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'a33-inv';
  }

  // Always-followup (generic)
  if (await page.$('#arev-followup')) {
    await page.fill('#arev-followup', 'Infra test followup.').catch(() => {});
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'followup';
  }

  // A6 multi-select
  const a6ms = await page.$$('#arev-a6-multi input[type=checkbox]');
  if (a6ms.length) {
    await a6ms[0].click(); await page.waitForTimeout(100);
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'a6-ms';
  }

  // Free-text
  if (await page.$('#arev-answer')) {
    await page.fill('#arev-answer', 'Infra test free text.').catch(() => {});
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'free-text';
  }

  // Context MCQ followup
  if (await page.$('#arev-followup')) {
    await page.fill('#arev-followup', 'Infra test context followup.').catch(() => {});
    await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400); return 'ctx-fu';
  }

  return null; // nothing matched
}

// Drive A1–A36 to completion, return true if it reached the generating screen
async function driveToCompletion(page, label = 'pass') {
  let safety = 0;
  const maxSteps = 120;
  let nullCount = 0;
  while (safety < maxSteps) {
    safety++;
    const overlayContent = await page.innerHTML('#arev-overlay-content').catch(() => '');
    // "Generating your report" is the exact heading from arevRenderWaiting — distinct from LM loading cards which also use arev-dots
    if (overlayContent.includes('Generating your report')) { note(`  [${label}] Reached generating screen (${safety} steps)`); return true; }
    if (overlayContent.includes('Professional Readiness Report') && overlayContent.includes('arev-outcome-badge')) { note(`  [${label}] Report already rendered (${safety} steps)`); return true; }
    const action = await advance(page, label);
    if (!action) {
      nullCount++;
      // LM loading cards contain arev-lm-card or arev-recognition-card — wait longer for real API responses
      const isLmLoading = overlayContent.includes('arev-lm-card') || overlayContent.includes('arev-recognition-card');
      const waitMs = isLmLoading ? 3000 : 1000;
      if (nullCount % 5 === 0) note(`  [${label}] step ${safety}: advance null ×${nullCount}, lmLoading=${isLmLoading}`);
      await page.waitForTimeout(waitMs);
      if (nullCount > 30) { note(`  [${label}] 30 consecutive null advances — stopping`); return false; }
    } else {
      nullCount = 0;
    }
  }
  return false;
}

// Wait for report to render in overlay (up to maxMs)
async function waitForReport(page, maxMs = 300000) {
  const start = Date.now();
  let pendingSeen = false;
  let pollCount = 0;
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(8000);
    pollCount++;
    const html = await page.innerHTML('#arev-overlay-content').catch(() => '');
    if (html.includes('Professional Readiness Report') && html.includes('arev-outcome-badge')) {
      note(`Report complete at poll ${pollCount} (${Math.round((Date.now()-start)/1000)}s)`);
      return { done: true, elapsed: Date.now()-start, polls: pollCount };
    }
    if (!pendingSeen && html.includes('Generating your report')) {
      pendingSeen = true; note(`Pending/generating state confirmed at poll ${pollCount}`);
    }
    const shortHtml = html.slice(0, 80).replace(/\s+/g,' ');
    note(`Poll ${pollCount}: ${shortHtml}...`);
  }
  return { done: false, elapsed: Date.now()-start, polls: pollCount };
}

// ─────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await context.addInitScript((tok) => {
  try {
    localStorage.setItem('gca_token', tok);
    localStorage.setItem('gca_plan', 'apprentice');
    localStorage.removeItem('gca_arev_progress');
  } catch(e) {}
}, makeToken());

console.log('\n── INFRASTRUCTURE TEST: Apprentice Professional Readiness Review ──');
console.log(`   Target: ${DEPLOY}\n`);

// ═══════════════════════════════════════════════════════════════
console.log('── STEP 1: Page load + overlay + engine ──');
await page.goto(`${DEPLOY}/apprentice-review.html`);
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(400);
await page.click('.nav-btn'); await page.waitForTimeout(800);
check('Page serves correctly and overlay opens', await page.isVisible('#arev-overlay'));
check('apprentice-engine.js loads (AREV_ENGINE defined in page scope)',
  await page.evaluate(() => { try { return typeof AREV_ENGINE !== 'undefined'; } catch(e){ return false; } }).catch(() => false));

// ═══════════════════════════════════════════════════════════════
console.log('\n── STEP 2: Real LM calls ──');
// Start assessment
const startBtn = page.locator('.arev-btn-primary').first();
await startBtn.click(); await page.waitForTimeout(400);
// Drive A1 then A2 (context-mcq, no LM)
await advance(page); // A1
await advance(page); // A2

// A3: free-text — answer directly (no escape)
await page.fill('#arev-answer', 'I verify information from Land Registry and primary regulatory sources before relying on it.').catch(() => {});
await page.click('text=Save and continue →').catch(() => {}); await page.waitForTimeout(400);

// A4: scenario-mcq — deliberately trigger escape to get real full-loop LM call
note('A4: selecting E to trigger real full-loop LM call...');
const a4Start = Date.now();
const a4EscEl = await page.locator('.arev-option-letter:text("E")').first().locator('..').elementHandle().catch(() => null);
if (a4EscEl) { await a4EscEl.click(); await page.waitForTimeout(100); await page.click('text=Continue →').catch(() => {}); }
// Wait up to 25s for real LM
let a4LmVisible = false;
for (let i = 0; i < 25; i++) { await page.waitForTimeout(1000); if (await page.$('.arev-lm-explain')) { a4LmVisible = true; break; } }
const a4Elapsed = ((Date.now() - a4Start) / 1000).toFixed(1);
check(`A4: real full-loop LM responded (${a4Elapsed}s)`, a4LmVisible);
if (a4LmVisible) {
  const explain = await page.textContent('.arev-lm-explain').catch(() => '');
  check('A4: LM explain text is substantive (not empty/error)', explain.length > 20, `"${explain.slice(0,80)}"`);
  note(`A4 explain: "${explain.slice(0, 120)}"`);
  await page.fill('#arev-check-answer', 'I would explain my professional obligation and decline to omit the defect.').catch(() => {});
  await page.click('#arev-check-submit-btn').catch(() => {}); await page.waitForTimeout(500);
} else {
  finding('A4 full-loop LM did not respond within 25s'); await advance(page); // try to move on
}

// A5: bespoke-A5 — trigger real LM
note('A5: triggering real bespoke-A5 LM call...');
const a5Start = Date.now();
const a5Esc = await page.$('.arev-escape-btn');
if (a5Esc) { await a5Esc.click(); }
let a5Visible = false;
for (let i = 0; i < 25; i++) { await page.waitForTimeout(1000); if (await page.$('#arev-a5-pivot')) { a5Visible = true; break; } }
const a5Elapsed = ((Date.now() - a5Start) / 1000).toFixed(1);
check(`A5: real bespoke-A5 LM responded (${a5Elapsed}s)`, a5Visible);
if (a5Visible) {
  const a5Explain = await page.textContent('.arev-lm-explain').catch(() => '');
  const a5NoCheck = !(await page.$('#arev-check-answer'));
  check('A5: no #arev-check-answer (bespoke pivot distinct from CHECK step)', a5NoCheck);
  note(`A5 explain: "${a5Explain.slice(0, 120)}"`);
  await page.fill('#arev-a5-pivot', 'I could improve my reflective practice in technical decision-making.').catch(() => {});
  await page.click('#arev-a5-submit-btn').catch(() => {}); await page.waitForTimeout(400);
} else {
  finding('A5 bespoke-A5 LM did not respond within 25s'); await advance(page);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── STEP 3: Drive A6–A36 to completion ──');
note('Fast-forwarding A6–A36 using universal advance loop...');
const ffStart = Date.now();
const reached = await driveToCompletion(page, 'A6-A36');
const ffElapsed = Math.round((Date.now() - ffStart) / 1000);
check(`A6–A36 fast-forward reached generating screen (${ffElapsed}s)`, reached);

// ═══════════════════════════════════════════════════════════════
console.log('\n── STEP 4: Real Background Function — pending → complete ──');
note('Waiting for real Sonnet report (up to 5 min)...');
const rep1 = await waitForReport(page, 300000);
check(`Pass 1: real report generated (${Math.round(rep1.elapsed/1000)}s, ${rep1.polls} polls)`, rep1.done);

if (rep1.done) {
  const badges = await page.$$('.arev-outcome-badge');
  check('Pass 1 report: 7 area badges rendered', badges.length === 7, `got ${badges.length}`);
  const outcomes = await Promise.all(badges.map(b => b.textContent()));
  const validOuts = ['ON TRACK', 'DEVELOPING', 'ATTENTION REQUIRED'];
  check('Pass 1 report: all badge texts are valid outcomes', outcomes.every(t => validOuts.some(v => t.includes(v))), outcomes.join(' | '));
  note(`Outcomes: ${outcomes.join(' | ')}`);
  const disclaimer = await page.textContent('.arev-report-disclaimer').catch(() => '');
  check('Pass 1 report: disclaimer rendered (EPA/APC caveat)', disclaimer.includes('EPA') && disclaimer.includes('APC'));
  const summary = await page.innerHTML('.arev-panel').catch(() => '');
  check('Pass 1 report: overall summary panel rendered', summary.includes('Summary') || summary.length > 50);
} else {
  finding(`Pass 1 report did not complete within 5 minutes (${rep1.polls} polls, ${Math.round(rep1.elapsed/1000)}s)`);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── STEP 5: Retake enforcement — Pass 2 (attempt 2 of 3) ──');
await page.evaluate(() => { try { localStorage.removeItem('gca_arev_progress'); } catch(e) {} });
await page.goto(`${DEPLOY}/apprentice-review.html`);
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(400);
await page.click('.nav-btn'); await page.waitForTimeout(800);
const startBtn2 = page.locator('.arev-btn-primary').first();
if (await startBtn2.isVisible().catch(() => false)) { await startBtn2.click(); await page.waitForTimeout(400); }
const p2Reached = await driveToCompletion(page, 'pass2');
check('Pass 2: reached generating screen (not retake-blocked at start)', p2Reached);
if (p2Reached) {
  const rep2 = await waitForReport(page, 300000);
  check(`Pass 2: report completes (attempt 2 of 3, ${Math.round(rep2.elapsed/1000)}s)`, rep2.done);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── STEP 6: Retake enforcement — Pass 3 (attempt 3 of 3) ──');
await page.evaluate(() => { try { localStorage.removeItem('gca_arev_progress'); } catch(e) {} });
await page.goto(`${DEPLOY}/apprentice-review.html`);
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(400);
await page.click('.nav-btn'); await page.waitForTimeout(800);
const startBtn3 = page.locator('.arev-btn-primary').first();
if (await startBtn3.isVisible().catch(() => false)) { await startBtn3.click(); await page.waitForTimeout(400); }
const p3Reached = await driveToCompletion(page, 'pass3');
check('Pass 3: reached generating screen (not retake-blocked at start)', p3Reached);
if (p3Reached) {
  const rep3 = await waitForReport(page, 300000);
  check(`Pass 3: report completes (attempt 3 of 3, ${Math.round(rep3.elapsed/1000)}s)`, rep3.done);
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── STEP 7: Retake enforcement — Pass 4 (should be blocked) ──');
await page.evaluate(() => { try { localStorage.removeItem('gca_arev_progress'); } catch(e) {} });
await page.goto(`${DEPLOY}/apprentice-review.html`);
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(400);
await page.click('.nav-btn'); await page.waitForTimeout(800);
const startBtn4 = page.locator('.arev-btn-primary').first();
if (await startBtn4.isVisible().catch(() => false)) { await startBtn4.click(); await page.waitForTimeout(400); }
const p4Reached = await driveToCompletion(page, 'pass4');
if (p4Reached) {
  // retake_limit_exceeded is written by the Background Function then read via polling.
  // The block appears at the polling phase — not immediately on submit. Poll up to 6 intervals
  // (48s) to allow the Background Function time to write the failed status to Blobs.
  let p4Blocked = false;
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(8000);
    const p4Html = await page.innerHTML('#arev-overlay-content').catch(() => '');
    if (p4Html.includes('retake_limit_exceeded') || p4Html.includes('Report generation failed')) {
      note(`Pass 4 retake block received at poll ${i}`);
      p4Blocked = true;
      break;
    }
    // If a 4th report renders, enforcement failed
    if (p4Html.includes('arev-outcome-badge')) { break; }
    note(`Pass 4 poll ${i}: still generating...`);
  }
  check('Pass 4: blocked by retake limit (max 3 enforced in Blobs)', p4Blocked);
  if (!p4Blocked) finding('Pass 4 was not blocked — retake limit may not be enforced in Blobs');
} else {
  note('Pass 4 did not reach generating screen — could not test block');
}

// ═══════════════════════════════════════════════════════════════
console.log('\n── RESULTS ──');
console.log(`${PASS} Passed: ${pass}`);
if (fail > 0) console.log(`${FAIL} Failed: ${fail}`);
if (findings.length > 0) { console.log('\n⚠️  Findings:'); findings.forEach(f => console.log(`  - ${f}`)); }
if (fail === 0 && findings.length === 0) console.log('\x1b[32mAll infrastructure checks passed.\x1b[0m');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
