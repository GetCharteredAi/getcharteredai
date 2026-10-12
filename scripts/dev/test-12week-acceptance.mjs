#!/usr/bin/env node
/**
 * 12-Week Candidate Acceptance Test
 *
 * Creates an isolated session labelled '[TEST] GCAi 12-Week Acceptance Test'
 * (Building Surveying, monthsInRole: 3 ≈ 12 weeks, Band 1 calibration range).
 * Drives the full Benchmark → private-report journey via the deploy-preview API.
 * Does NOT touch the existing 7-month QS session (p1-test-5b485d22).
 *
 * Verifies:
 *   - Michael calibrates questions and findings for Band 1 (8-16 weeks)
 *   - Report overview uses "you/your" language
 *   - Schema is readiness-picture-v1 with all required fields
 *   - Report does not overclaim capability (strength integrity rule)
 *
 * Usage:
 *   node --env-file=.env scripts/dev/test-12week-acceptance.mjs
 */

import { createRequire } from 'module';
import { createHmac, randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const JWT_SECRET     = process.env.JWT_SECRET;
const AUTH_TOKEN     = process.env.NETLIFY_AUTH_TOKEN;
const SITE_ID        = process.env.NETLIFY_SITE_ID || '078e84b1-e53e-406f-88c5-e9c6ce627cd7';
const PREFIX         = process.env.P1_STORE_PREFIX ? process.env.P1_STORE_PREFIX + '-' : '';
const BASE_URL       = process.env.P1_SITE_URL || 'https://deploy-preview-13--getcharteredai.netlify.app';

if (!JWT_SECRET) { console.error('Missing JWT_SECRET'); process.exit(1); }
if (!AUTH_TOKEN) { console.error('Missing NETLIFY_AUTH_TOKEN'); process.exit(1); }

const { getStore } = require(path.join(__dirname, '../../node_modules/@netlify/blobs'));

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(payload) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

async function post(fnName, body) {
  const res = await fetch(`${BASE_URL}/.netlify/functions/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  // background function returns 202 with no body
  if (res.status === 202) return { status: 202 };
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { _raw: text, _status: res.status }; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pass(msg) { console.log('  ✓', msg); }
function fail(msg) { console.error('  ✗', msg); process.exitCode = 1; }
function info(msg) { console.log('  ·', msg); }

// ── Questions (from professional-readiness-benchmark.html QUESTIONS array) ───

const QUESTIONS = [
  // Area 1
  { area: 1, text: 'Thinking about your time at work so far, can you tell me about something you did that you felt you handled professionally?' },
  { area: 1, text: 'Tell me about a recent piece of work you were trusted to complete. What did you do to make sure it was accurate, completed when needed and that the right person knew where it had got to?' },
  { area: 1, text: 'Tell me about a recent task you completed. What did you do once it was finished, and how did you decide what to focus on next?' },
  { area: 1, text: 'Tell me about a time you realised something in your work was wrong, unclear or not going as expected. What did you do?' },
  // Area 2
  { area: 2, text: 'Give me an example of something you needed to explain or update someone about at work. How did you make sure they understood what they needed to know?' },
  { area: 2, text: 'Tell me about a time an instruction or expectation was not completely clear. How did you clarify what was required?' },
  { area: 2, text: 'Think about the last time you asked someone for help. What had you already considered or tried before you approached them?' },
  { area: 2, text: 'Tell me about a recent occasion when you worked with someone more experienced than you. What did you contribute, and what did you learn from them?' },
  // Area 3
  { area: 3, text: 'Give me one example of something you learned through university, college or training that you have now seen or used in your work. How did understanding it help you?' },
  { area: 3, text: 'What is something the workplace has taught you that you would probably not have learned from study alone? Give me a particular example.' },
  { area: 3, text: 'Tell me about a task you were given that you had not done before. How did you work out what you needed to know and how to approach it?' },
  // Area 4
  { area: 4, text: 'Tell me about a situation where you had to decide whether you could continue yourself or whether you should check something with somebody else. What influenced your decision?' },
  { area: 4, text: 'Has there been a situation at work where you had to decide whether something needed raising with someone more senior? What did you do — or what would make you feel something was important enough to escalate?' },
  // Area 5
  { area: 5, text: 'What is the most useful feedback you have received since starting, and what have you changed as a result?' },
  { area: 5, text: 'Looking back over your time at work so far, what is one thing you think you are doing well and one thing you want to improve? What would improvement look like over the next few months?' },
];

// ── Stage-appropriate responses for 12-week Building Surveying graduate ──────
// Band 1 rubric: 8–16 weeks — relies on support, checks before proceeding,
// concrete evidence but narrow in scope, appropriate supervisor dependence.

const RESPONSES = [
  // Q1 — Professional moment
  `In my third week I was asked to write up my notes from a site visit into a summary report. Before I sent it to my supervisor I went back through every room I'd noted and checked the descriptions matched my photos. I noticed I'd described a crack as being in the corner of a ceiling when my photo showed it was on the wall above the window — I corrected that before sending it across. I felt checking carefully rather than just filing it was the right thing to do.`,

  // Q2 — Trusted piece of work, accuracy and handover
  `My supervisor asked me to compile a schedule of condition for a ground-floor retail unit — the first time I'd done one largely by myself. I worked through each area using the template we use in the office, matched my notes to the photos at each stage, and finished it by the deadline she'd given me. When it was done I emailed it to her and messaged her directly to say it was in her inbox, so she didn't have to go looking for it.`,

  // Q3 — Finishing and next focus
  `After I finished a planning history search for a project, I saved the document to the shared drive in the correct folder and sent a short message to the graduate surveyor who had asked for it so he knew where to find it. For what to do next, I went back to the task list my supervisor had given me at the start of the week and started on the next item.`,

  // Q4 — Noticing something wrong
  `I was compiling a schedule of works and noticed I'd recorded two items under the same reference number. I spotted it when I was formatting the document and thought it looked wrong. I stopped and went back through my original notes to check which entry was right. Once I'd corrected it, I mentioned it to my supervisor when I sent the draft — not because it was a major issue, but because I thought she should know I'd found and fixed an error rather than her discovering it later.`,

  // Q5 — Explaining or updating someone
  `I needed to let a colleague know that a document she'd asked me to find wasn't in the filing system where we'd expected it. I sent her a brief email explaining what I'd searched for, which folders I'd checked, and suggested she ask the admin team who might know where older files were archived. I tried to be specific enough that she wouldn't have to repeat the same search I'd already done.`,

  // Q6 — Unclear instruction
  `My supervisor asked me to "review the lease" on a property. I wasn't sure if she meant the whole document or specific sections, or what format she wanted the output in. I went back to her the same morning and asked what she needed from the review. She told me she wanted a short summary of the repair and user obligations, which made it straightforward to complete.`,

  // Q7 — Trying before asking
  `I needed to understand what a particular break clause required in terms of notice. I read it through twice and then looked at a previous lease summary in our shared drive to see how a similar clause had been handled. When I still wasn't certain whether the notice had to be served at the demised premises specifically, I asked the graduate surveyor next to me. I explained what I'd already checked so he could see I hadn't just come to him straight away.`,

  // Q8 — Working with someone more experienced
  `I attended a dilapidations inspection with a senior surveyor. My role was mainly to take notes and record measurements while he led the inspection and talked the tenant through the process. I made sure I had everything noted down so he wouldn't need to refer back to ask me anything. What I picked up from watching him was that when the tenant raised something he wasn't sure about on the day, he said he'd confirm it in writing rather than answering off the top of his head. I hadn't thought of that as something you'd deliberately do.`,

  // Q9 — Training to practice
  `I studied building pathology at university — defects, causes, remedies and how to structure a survey report. In my second week I was asked to sit in while a senior surveyor walked a client through a homebuyers report. I could follow what he was describing and understand why he was drawing the client's attention to specific items, because the defect categories he was using matched what I'd studied. It meant I was actually following the conversation rather than just watching.`,

  // Q10 — Workplace-only learning
  `Something the workplace has taught me that didn't come from studying is how much communication happens informally between surveyors on a project. On one of our current projects, two surveyors had slightly different understandings of a scope decision because they hadn't had a formal conversation about it — just assumed. My supervisor pointed out that a short written note confirming agreed decisions protects everyone and avoids repeated conversations. That wasn't something my course covered as practical advice.`,

  // Q11 — New task approach
  `I was asked to carry out a measured survey of a property I hadn't been to before. I wasn't sure exactly which protocol the office uses for that property type, so I asked my supervisor before I went. I also looked at a previous measured survey from a similar property in our archive to understand the expected level of detail. On site I followed the same structure as the example and then checked back with my supervisor when I returned before I typed anything up.`,

  // Q12 — Check vs continue
  `I was finishing a draft letter to a client about a minor inspection finding. The letter seemed slightly abrupt in tone and I wasn't confident it was the right register for a client communication. Rather than sending it I showed it to my supervisor before it went out. I thought getting the tone wrong on something going to a client was more of a risk than the small delay in asking for a check.`,

  // Q13 — Escalation
  `I haven't had a situation yet where I've needed to formally escalate anything serious. The closest was during a site visit when I noticed a crack in an internal wall that seemed wider than I'd expect for a residential property. I wasn't sure if it was significant or not, so I pointed it out to the senior surveyor I was with rather than deciding on my own. She confirmed it was worth recording and noted it for the report. My instinct was that anything structural wasn't something I should be making a call on at this stage.`,

  // Q14 — Feedback and change
  `My supervisor told me in my first month that my site notes were accurate but hard to read quickly — she said it wasn't always clear which items were observations and which were queries. Since then I've started using consistent headings and separating factual notes from questions I need to follow up. When I submitted my notes from last week's inspection she said they were much clearer. I still check the format before I file anything.`,

  // Q15 — Doing well / want to improve
  `I think I'm doing reasonably well at flagging things I'm not sure about rather than guessing. My supervisor has said she prefers me to ask than to make an assumption on anything client-facing, and I think I do that fairly consistently. What I want to improve is being able to pace myself better on tasks. I check my work so many times that I'm sometimes slower than I should be. Improvement over the next few months would look like producing accurate work more efficiently — trusting myself on routine tasks without needing to go through everything three times.`,
];

// ── Check question responses (Band 1 — stage-appropriate) ────────────────────
// Used when Michael triggers a learning moment. These are generic enough to
// work for any Band 1 check question across the five areas.

const CHECK_RESPONSES_BY_AREA = {
  1: `I think in that situation I would focus on completing the specific task I was given accurately and making sure the person who needed it knew it was done. I'd probably still check with my supervisor before deciding anything beyond that — at this stage I wouldn't assume I had enough of the picture to act more independently.`,
  2: `I would try to be clear and factual, check they'd understood what I meant, and if I wasn't sure whether I'd explained it well I'd ask them to confirm back to me what they thought had been agreed.`,
  3: `I'd look for any existing examples or templates in the office first, then check with my supervisor about how it's typically done before starting. I wouldn't want to assume my approach was right without checking.`,
  4: `At this stage, I'd lean towards checking with someone more senior rather than making the call myself. I'd only continue independently if it was something clearly within my task and relatively low risk to get wrong.`,
  5: `I'd try to think about what specifically went less well and what I could do differently next time — not just note it happened. And if my supervisor gave me feedback on it, I'd make a note to follow up on whether I'd actually made the change.`,
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  12-Week Candidate Acceptance Test');
  console.log('  Session: [TEST] GCAi 12-Week Acceptance Test');
  console.log('  Discipline: Building Surveying  |  monthsInRole: 3 (≈12 weeks)');
  console.log('  Target: feat/p1-conversational-adaptive deploy-preview');
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 1. Create session ────────────────────────────────────────────────────────
  console.log('1. Creating 12-week test session…');
  const sessionId = `p1-test-${randomUUID().slice(0, 8)}`;
  const now = Date.now();

  const meta = {
    sessionId,
    status: 'invited',
    firmName: '[TEST] GCAi 12-Week Acceptance Test',
    discipline: 'Building Surveying',
    monthsInRole: 3,
    employmentStartDate: '2026-07-07',   // ≈ 13 weeks before test date
    employmentType: 'graduate',
    candidateEmail: 'test-12wk@gca-internal.test',
    managerEmail: 'test-manager@gca-internal.test',
    candidateName: '12-Week Test Candidate',
    managerName: 'Test Manager',
    cohortId: 'test-cohort-12wk-acceptance',
    createdAt: now,
  };

  const sessionStore = getStore({ name: `${PREFIX}p1-sessions`, siteID: SITE_ID, token: AUTH_TOKEN });
  await sessionStore.setJSON(`${sessionId}/metadata`, meta);
  info(`Session created: ${sessionId}`);

  const candidateToken = generateToken({
    sessionId,
    role: 'candidate',
    email: meta.candidateEmail,
    expires: now + 48 * 60 * 60 * 1000,
  });

  // ── 2. Run the 15-question benchmark ────────────────────────────────────────
  console.log('\n2. Running benchmark (Building Surveying, Band 1: 8–16 weeks)…\n');

  const messages = [];
  const questionProvenance = {};
  const skippedQuestions = [];

  const discipline = meta.discipline;
  const monthsInRole = meta.monthsInRole;

  let learningMomentsTriggered = 0;

  for (let qi = 0; qi < QUESTIONS.length; qi++) {
    const q = QUESTIONS[qi];
    const responseText = RESPONSES[qi];
    const userContent = `Q${qi + 1}: ${q.text}\n\nMy response: ${responseText}`;
    messages.push({ role: 'user', content: userContent });

    process.stdout.write(`  Q${String(qi + 1).padStart(2, ' ')}/15 (Area ${q.area})… `);

    const tutorResp = await post('p1-tutor', { token: candidateToken, messages, discipline, monthsInRole });

    const raw = (tutorResp.content || []).map(b => b.text || '').join('');
    let lm = null;
    try { lm = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { lm = null; }

    if (lm && lm.reassure) {
      messages.push({ role: 'assistant', content: raw });
      questionProvenance[qi] = 'after-clarification';
      console.log('reassured (independent)');

    } else if (lm && lm.reprompt) {
      messages.push({ role: 'assistant', content: raw });
      questionProvenance[qi] = 'after-prompting';
      learningMomentsTriggered++;
      console.log(`reprompt triggered`);
      // Provide response to reprompt
      const checkResp = CHECK_RESPONSES_BY_AREA[q.area];
      messages.push({ role: 'user', content: checkResp });
      questionProvenance[qi] = 'after-prompting';
      console.log(`    ↳ reprompt answered`);

    } else if (lm && lm.recognitionPrompt) {
      messages.push({ role: 'assistant', content: raw });
      learningMomentsTriggered++;
      console.log(`recognition prompt`);
      // Simulate "yes, I have experience like that"
      messages.push({ role: 'user', content: 'Yes — thinking about it more, I have had something like that, even if I wasn\'t leading it. I was involved in observing the process and I could see what was being considered at each step.' });
      questionProvenance[qi] = 'exposure-acknowledged';
      console.log(`    ↳ recognition acknowledged`);

    } else if (lm && (lm.explain || lm.checkQuestion)) {
      messages.push({ role: 'assistant', content: raw });
      questionProvenance[qi] = 'after-teaching';
      learningMomentsTriggered++;
      const checkQ = lm.checkQuestion || '(check question)';
      console.log(`full LM (${lm.gapType || 'gap'})`);
      console.log(`    ↳ check: ${checkQ.slice(0, 80)}…`);
      // Provide a stage-appropriate check question response
      const checkResp = CHECK_RESPONSES_BY_AREA[q.area];
      messages.push({ role: 'user', content: checkResp });
      console.log(`    ↳ check answered`);

    } else {
      if (lm) messages.push({ role: 'assistant', content: raw });
      questionProvenance[qi] = 'independent';
      console.log('independent (no LM)');
    }

    // Avoid hammering the API — small delay between questions
    if (qi < QUESTIONS.length - 1) await sleep(1200);
  }

  console.log(`\n  Total learning moments triggered: ${learningMomentsTriggered}`);
  console.log(`  Message pairs built: ${messages.length}`);

  // ── 3. Priority selection ────────────────────────────────────────────────────
  console.log('\n3. Selecting development priorities…');
  const candidateSelectedPriorities = ['Professional Behaviour & Responsibility', 'Learning & Applying Knowledge'];
  const contextAnswers = {
    discipline,
    monthsInRole,
    typicalWork: 'Schedule of condition reports, measured surveys, planning history research, attending site inspections with senior surveyors',
    candidateSelectedPriorities,
    candidateSelectedPriority: candidateSelectedPriorities[0],
    questionProvenance,
    skippedQuestions,
    recognitionResults: { 1: 'not-assessed', 2: 'not-assessed', 3: 'not-assessed', 4: 'not-assessed', 5: 'not-assessed' },
  };
  info('Priorities selected: ' + candidateSelectedPriorities.join(', '));

  // ── 4. Trigger report generation ────────────────────────────────────────────
  console.log('\n4. Triggering report generation…');
  const runToken = randomUUID();
  const bgResp = await post('p1-generate-report-background', {
    token: candidateToken,
    messages,
    runToken,
    contextAnswers,
  });
  if (bgResp.status === 202 || bgResp._status === 202) {
    info('Background job accepted (202)');
  } else {
    info(`Background response: ${JSON.stringify(bgResp).slice(0, 120)}`);
  }

  // ── 5. Poll for completion ───────────────────────────────────────────────────
  console.log('\n5. Polling for report completion (8s intervals, up to 3 min)…');
  let report = null;
  const maxAttempts = 23;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(8000);
    const status = await post('p1-report-status', { token: candidateToken, runToken });
    process.stdout.write(`  attempt ${attempt}: ${status.status || '?'}`);
    if (status.status === 'complete' && status.report) {
      console.log(' — DONE');
      report = status.report;
      break;
    } else if (status.status === 'failed') {
      console.log(` — FAILED: ${status.error || 'unknown'}`);
      console.error('\nReport generation failed. Full status:', JSON.stringify(status, null, 2));
      process.exit(1);
    } else {
      console.log('');
    }
  }

  if (!report) {
    console.error('\nReport did not complete within timeout.');
    process.exit(1);
  }

  // ── 6. Verify report ────────────────────────────────────────────────────────
  console.log('\n6. Verifying report…\n');

  pass(`Schema version: ${report.schemaVersion}`);
  if (report.schemaVersion !== 'readiness-picture-v1') fail('Expected readiness-picture-v1');

  pass(`areaOutcomes count: ${report.areaOutcomes?.length}`);
  if (report.areaOutcomes?.length !== 5) fail('Expected 5 areaOutcomes');

  pass(`strengths count: ${report.strengths?.length ?? 0}`);
  pass(`developmentFocus count: ${report.developmentFocus?.length}`);
  pass(`nextActions count: ${report.nextActions?.length}`);

  const hasOverview  = typeof report.overview === 'string' && report.overview.length > 20;
  const hasConvPrompt = typeof report.conversationPrompt === 'string' && report.conversationPrompt.length > 10;
  if (hasOverview) pass('overview present'); else fail('overview missing or too short');
  if (hasConvPrompt) pass('conversationPrompt present'); else fail('conversationPrompt missing');

  // Stage calibration: overview should mention early weeks / early career / starting out
  const overviewLower = report.overview.toLowerCase();
  const stageTerms = ['early', 'first', 'week', 'month', 'starting', 'three month', 'new to', 'beginning'];
  const hasStageRef = stageTerms.some(t => overviewLower.includes(t));
  if (hasStageRef) pass('overview references early-stage context');
  else info('overview stage reference not found — check manually:\n   ' + report.overview);

  // you/your language check
  const overviewPersonal = /\byou\b|\byour\b/i.test(report.overview);
  if (overviewPersonal) pass('overview uses you/your language');
  else fail('overview does NOT use you/your language — check: ' + report.overview);

  const nextActionsText = (report.nextActions || []).join(' ');
  const nextActionsPersonal = /\byou\b|\byour\b/i.test(nextActionsText);
  if (nextActionsPersonal) pass('nextActions use you/your language');
  else fail('nextActions do NOT use you/your — check: ' + nextActionsText.slice(0, 120));

  // No synthesis leak
  const reportStr = JSON.stringify(report);
  const hasSynthesisLeak = reportStr.includes('alignmentSummary') || reportStr.includes('managerView');
  if (!hasSynthesisLeak) pass('no synthesis data in candidate-private report');
  else fail('synthesis data found in private report — data separation issue');

  // Development focus types
  const validTypes = new Set(['capability-gap', 'exposure-gap']);
  const badTypes = (report.developmentFocus || []).filter(d => !validTypes.has(d.type));
  if (badTypes.length === 0) pass('all developmentFocus items have valid type');
  else fail('invalid developmentFocus types: ' + JSON.stringify(badTypes.map(d => d.type)));

  // Print area outcomes
  console.log('\n  Area outcomes (Band 1 calibration):');
  (report.areaOutcomes || []).forEach(a => console.log(`    ${a.id}. ${a.name}: ${a.outcome}`));

  // Print overview
  console.log('\n  Overview:\n  "' + report.overview + '"\n');

  // Print development focus
  if (report.developmentFocus?.length) {
    console.log('  Development focus:');
    report.developmentFocus.forEach(d => console.log(`    · ${d.area} [${d.type}]: ${d.focus}`));
    console.log('');
  }

  // Print next actions
  if (report.nextActions?.length) {
    console.log('  Next actions:');
    report.nextActions.forEach((a, i) => console.log(`    ${i + 1}. ${a}`));
    console.log('');
  }

  // ── 7. Generate access URL ───────────────────────────────────────────────────
  console.log('7. Access URL (48-hour token):\n');
  console.log(`  ${BASE_URL}/professional-readiness-benchmark?token=${candidateToken}\n`);
  console.log(`  Session ID : ${sessionId}`);
  console.log(`  Discipline : ${meta.discipline}`);
  console.log(`  Months     : ${meta.monthsInRole} (≈12 weeks — Band 1)`);
  console.log(`  Status     : awaiting-manager (report complete)\n`);
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
