/**
 * Stage 4 dashboard integration test — API-equivalent
 *
 * Tests the quality gate pipeline with the same logic as the integrated
 * ai-tutor.js handler. Uses the dashboard's client-side system prompt
 * exactly as sendAIMessage would build it.
 *
 * Browser verification: the actual browser test (Task 7) requires a human
 * tester authenticated as support@mabehq.com. This script verifies the
 * pipeline logic and produces the Expected responses for the browser test.
 *
 * Test questions from Task 7 brief:
 *   ETH-01  — RICS ethics (PKR-01)
 *   QS-01   — Construction payment (PKR-02)
 *   HS-05   — Asbestos management (PKR-03)
 *   BS-01   — Building pathology (no PKR)
 *   BS-06   — Structural safety (no PKR)
 *   FU-01   — APC interview coaching (no PKR)
 *   CTRL-1  — Straightforward educational question (expect useful answer)
 *   CTRL-2  — Unsupported technical conclusion (expect correction or withholding)
 *   CTRL-3  — No PKR match (no evidence supplied)
 *   CTRL-4  — Follow-up that changes professional considerations
 *
 * Not committed, pushed or deployed.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env loader ───────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch (e) { console.error('Could not load .env:', e.message); process.exit(1); }

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

// ── Extract buildModuleSystemPrompt (ai-tutor.js unchanged) ──────────────────
let buildModuleSystemPrompt;
try {
  const p   = resolve(__dirname, '../netlify/functions/ai-tutor.js');
  const src = readFileSync(p, 'utf8');
  const hi  = src.indexOf('exports.handler');
  const isolated = (hi > 0 ? src.slice(0, hi) : src) + '\nreturn buildModuleSystemPrompt;';
  buildModuleSystemPrompt = new Function('require', 'exports', 'module', isolated)(createRequire(p), {}, { exports: {} });
  console.log('[INIT] buildModuleSystemPrompt — OK');
} catch (e) { console.error('[INIT] buildModuleSystemPrompt:', e.message); process.exit(1); }

// ── Extract EVALUATOR_SYSTEM_V3 ──────────────────────────────────────────────
let EVALUATOR_SYSTEM_V3;
try {
  const src = readFileSync(resolve(__dirname, 'qa-eval-harness-v3.mjs'), 'utf8');
  const s   = src.indexOf('const EVALUATOR_SYSTEM_V3 = `') + 'const EVALUATOR_SYSTEM_V3 = `'.length;
  const e   = src.indexOf('`;\n\n// ── Build user prompt', s);
  if (s < 50 || e < 0) throw new Error('Boundary not found');
  EVALUATOR_SYSTEM_V3 = src.slice(s, e);
  console.log(`[INIT] EVALUATOR_SYSTEM_V3 (${EVALUATOR_SYSTEM_V3.length} chars) — OK`);
} catch (e) { console.error('[INIT] Evaluator:', e.message); process.exit(1); }

// ── Load PKR ──────────────────────────────────────────────────────────────────
const PKR_CONTENT = readFileSync(resolve(__dirname, 'professional-knowledge-register.md'), 'utf8');
function extractPKREntry(id) {
  const start = PKR_CONTENT.indexOf(`## ${id}:`);
  if (start === -1) return null;
  const next  = PKR_CONTENT.indexOf('\n## PKR-', start + 5);
  return PKR_CONTENT.slice(start, next === -1 ? PKR_CONTENT.length : next).trim();
}
function selectEvidence(question, pathway) {
  const q = (question + ' ' + (pathway || '')).toLowerCase();
  if (/ethic|rules of conduct|professionalism/i.test(q))                return { id: 'PKR-01', text: extractPKREntry('PKR-01') };
  if (/contract practice|hgcra|payment|construction contract/i.test(q)) return { id: 'PKR-02', text: extractPKREntry('PKR-02') };
  if (/health and safety|asbestos|car 2012|duty to manage/i.test(q))    return { id: 'PKR-03', text: extractPKREntry('PKR-03') };
  return null;
}
console.log(`[INIT] PKR loaded (${PKR_CONTENT.length} chars) — OK`);

// ── Dashboard system prompt builder ──────────────────────────────────────────
// Mirrors buildAITutorScope() logic from index.html for a fully-unlocked annual account.
// This is the same client-side system prompt sendAIMessage would pass for the test account.
function buildDashboardSystem(pathway, tutorMode = 'TUTOR MODE (Gear 1 — Learning)') {
  const candidatePathway = pathway || 'Quantity Surveying and Construction';
  const scope = `FULL ACCESS — all 12 modules unlocked. You can coach on any competency, any topic and any legislation covered across the complete programme.`;

  return `You are Michael — the Michael for Get Chartered AI, a professional coaching platform for RICS APC candidates built by Chartered Surveyors.

You operate in two modes. The candidate's current mode is indicated at the end of this prompt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEAR 1 — TUTOR MODE (Learning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHARACTER: Warm, direct, specific. You are on the candidate's side — you genuinely want them to pass. You acknowledge the person before you address the professional. You lead with curiosity, not correction.

APPROACH:
- Answer the candidate's question first — provide substantive guidance immediately when the subject is sufficiently clear
- Where a defect may indicate immediate risk, consider safety implications before routine investigation — do not assume every defect is an emergency, but assess risk at the outset
- Distinguish observation from explanation — a reported symptom, pattern or measurement is a prompt for investigation, not a diagnosis
- Ask at most one focused question per response — a single question, not compound — placed at the end

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use Markdown so responses render clearly for the candidate:
- Paragraphs for prose — keep them focused and direct
- **Bold** for key terms and important concepts, used selectively
- ## headings only where a response genuinely benefits from structure
- Bullet points when presenting several distinct items

MODULE SCOPE:
${scope}

CANDIDATE PATHWAY: ${candidatePathway}
CURRENT MODE: ${tutorMode}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────
const HEADERS = {
  'x-api-key': process.env.ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
};

function calcCost(model, inp, out) {
  return model === 'haiku'
    ? (inp * 0.80 + out * 4.00) / 1_000_000
    : (inp * 3.00 + out * 15.00) / 1_000_000;
}

async function callAPI(model, maxTokens, system, messages) {
  const t0    = Date.now();
  const modelId = model === 'haiku' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
  const res   = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature: 0, system, messages }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }
  const data  = await res.json();
  return { text: data.content?.[0]?.text ?? '', in: data.usage?.input_tokens ?? 0, out: data.usage?.output_tokens ?? 0, ms: Date.now() - t0 };
}

function parseEval(text) {
  try { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (_) { return null; }
}

const REVISION_SYSTEM = `You are correcting a professional response for an RICS APC training platform. Apply the minimum targeted correction for each identified failure. Do not rewrite sections that were not flagged. Return only the corrected response text.

STATUTORY_ERROR: Replace the incorrect claim with the accurate statement from the verified source material.
DIAGNOSTIC_ASSERTION Failure Mode 1 (mechanism as current fact): Reframe as a possible cause requiring investigation.
DIAGNOSTIC_ASSERTION Failure Mode 2 (pattern resolves cause): Reframe to show pattern informs investigation, not confirms cause.
DIAGNOSTIC_ASSERTION Failure Mode 3 (single cause, no alternatives): Add plausible alternatives and direction to investigate.
OMITTED_SAFETY: Insert a safety-first assessment before investigation steps.
PREMATURE_RECOMMENDATION: Insert safety and activity assessment before the monitoring recommendation.

Return only the corrected response text. No preamble.`;

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Quality gate pipeline (mirrors ai-tutor.js _runQualityGate) ──────────────
async function runQualityGate(question, pathway, dashboardSystem, conversationMessages) {
  const t0 = Date.now();
  const evidenceMatch = selectEvidence(question, pathway);
  const evidence = evidenceMatch?.text ?? null;

  // Step 1: Michael with PKR injected
  let augSystem = dashboardSystem;
  if (evidence) {
    augSystem = dashboardSystem +
      '\n\n---\nVERIFIED STATUTORY REFERENCE MATERIAL\n' +
      'The following entry from the GCAi Professional Knowledge Register has been verified against primary legislation. ' +
      'Apply its requirements accurately. Do not contradict its verified provisions.\n\n' +
      evidence + '\n---';
  }

  const michael   = await callAPI('haiku', 2000, augSystem, conversationMessages);
  const michaelMs = michael.ms;

  await pause(300);

  // Step 2: Evaluate
  let evalUser = `Candidate question: "${question}"\n\nPathway: ${pathway || 'not specified'}\nCompetency: General\n\nMichael's proposed response:\n---\n${michael.text}\n---`;
  evalUser += evidence
    ? `\n\nVerified source material supplied:\n---\n${evidence}\n---`
    : `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;

  const eval1Raw = await callAPI('sonnet', 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: evalUser }]);
  const eval1    = parseEval(eval1Raw.text);
  const outcome1 = eval1?.outcome ?? 'PARSE_ERR';

  const baseCost = calcCost('haiku', michael.in, michael.out) + calcCost('sonnet', eval1Raw.in, eval1Raw.out);

  if (outcome1 === 'PASS' || outcome1 === 'INSUFFICIENT_EVIDENCE') {
    return { michaelResponse: michael.text, michaelMs, eval1, outcome: outcome1, finalResponse: michael.text, totalMs: Date.now() - t0, totalCost: baseCost, evidenceId: evidenceMatch?.id ?? null };
  }

  if (outcome1 === 'ESCALATE') {
    const fallback = "That question involves professional judgement that depends on the specific facts — I can help you understand the general framework and typical considerations, but a definitive conclusion would need specialist advice tailored to the situation. What aspect of the general framework would be most useful to explore?";
    return { michaelResponse: michael.text, michaelMs, eval1, outcome: 'ESCALATE', finalResponse: fallback, totalMs: Date.now() - t0, totalCost: baseCost, evidenceId: evidenceMatch?.id ?? null };
  }

  if (outcome1 === 'REVISE') {
    await pause(300);
    const failures = (eval1?.reasoning_failures ?? [])
      .map((f, i) => `Failure ${i + 1}: ${f.failure_type}\nQuoted: "${f.quoted_text}"\nCorrection: ${f.correction}`)
      .join('\n\n');

    const revUser    = `Original response:\n---\n${michael.text}\n---\n\nEvaluator findings:\n${failures}\n\nApply only the targeted corrections. Return the full corrected response text.`;
    const revRaw     = await callAPI('sonnet', 2400, REVISION_SYSTEM, [{ role: 'user', content: revUser }]);

    await pause(300);

    let evalUser2 = `Candidate question: "${question}"\n\nPathway: ${pathway || 'not specified'}\nCompetency: General\n\nMichael's proposed response:\n---\n${revRaw.text}\n---`;
    evalUser2 += evidence
      ? `\n\nVerified source material supplied:\n---\n${evidence}\n---`
      : `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;

    const eval2Raw = await callAPI('sonnet', 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: evalUser2 }]);
    const eval2    = parseEval(eval2Raw.text);
    const outcome2 = eval2?.outcome ?? 'PARSE_ERR';

    const pipelineOutcome = outcome2 === 'PASS' ? 'REVISE→PASS' : 'REVISE→WITHHELD';
    const totalCost = baseCost + calcCost('sonnet', revRaw.in, revRaw.out) + calcCost('sonnet', eval2Raw.in, eval2Raw.out);

    return {
      michaelResponse: michael.text, michaelMs, eval1,
      revisionText: revRaw.text, eval2,
      outcome: pipelineOutcome,
      finalResponse: revRaw.text,
      totalMs: Date.now() - t0, totalCost,
      evidenceId: evidenceMatch?.id ?? null,
    };
  }

  return { michaelResponse: michael.text, michaelMs, eval1, outcome: outcome1, finalResponse: michael.text, totalMs: Date.now() - t0, totalCost: baseCost, evidenceId: evidenceMatch?.id ?? null };
}

function printResult(id, label, r) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${id}: ${label}`);
  console.log(`Pipeline: ${r.outcome}   Total: ${r.totalMs}ms   Cost: $${r.totalCost?.toFixed(5)}`);
  console.log(`Evidence: ${r.evidenceId ?? 'none'}`);

  console.log('\nMICHAEL PROPOSED RESPONSE:');
  console.log(`[${r.michaelMs}ms]`);
  console.log(r.michaelResponse);

  console.log('\nEVALUATOR FINDINGS (R1):');
  if (r.eval1) {
    console.log(`Outcome: ${r.eval1.outcome}`);
    if (!r.eval1.reasoning_failures?.length && !r.eval1.unverified_type_ab?.length) {
      console.log('  No material failures.');
    }
    for (const f of r.eval1.reasoning_failures ?? []) {
      console.log(`  [${f.severity}] ${f.failure_type}: "${(f.quoted_text ?? '').slice(0, 120)}"`);
      if (f.correction) console.log(`    Correction: ${(f.correction ?? '').slice(0, 150)}`);
    }
    if (r.eval1.unverified_type_ab?.length) console.log(`  Unverified: ${r.eval1.unverified_type_ab.slice(0, 3).join('; ')}`);
    console.log(`  Basis: ${r.eval1.outcome_basis}`);
  }

  if (r.revisionText) {
    console.log('\nREVISED RESPONSE:');
    console.log(r.revisionText);
    console.log('\nEVALUATOR FINDINGS (R2):');
    if (r.eval2) {
      console.log(`Outcome: ${r.eval2.outcome}`);
      for (const f of r.eval2.reasoning_failures ?? []) {
        console.log(`  [${f.severity}] ${f.failure_type}: "${(f.quoted_text ?? '').slice(0, 120)}"`);
      }
      if (!r.eval2.reasoning_failures?.length) console.log('  No material failures.');
      console.log(`  Basis: ${r.eval2.outcome_basis}`);
    }
  }

  console.log(`\nFINAL RESPONSE DELIVERED: ${r.finalResponse ? 'YES' : 'NO'}`);
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
const FIXTURES = [
  {
    id: 'ETH-01',
    label: 'RICS ethics',
    question: "What are the five RICS ethical standards?",
    pathway: 'Building Surveying',
  },
  {
    id: 'QS-01',
    label: 'Construction payment',
    question: "Can you explain the main payment provisions under the Housing Grants, Construction and Regeneration Act 1996?",
    pathway: 'Quantity Surveying and Construction',
  },
  {
    id: 'HS-05',
    label: 'Asbestos management (managing agent)',
    question: "There is asbestos in a commercial building I'm managing on behalf of a client. What are my obligations as the managing agent?",
    pathway: 'Building Surveying',
  },
  {
    id: 'BS-01',
    label: 'Building pathology — cracking above lintel',
    question: "A client reports cracking above a door lintel. What should I consider?",
    pathway: 'Building Surveying',
  },
  {
    id: 'BS-06',
    label: 'Structural safety — distorted loadbearing wall',
    question: "You are inspecting an occupied building and notice significant distortion to a loadbearing wall. What should you do?",
    pathway: 'Building Surveying',
  },
  {
    id: 'FU-01',
    label: 'APC interview coaching — diagonal cracking',
    question: "How should I explain what diagonal cracking might indicate during my APC interview?",
    pathway: 'Building Surveying',
  },
  {
    id: 'CTRL-1',
    label: 'Straightforward educational — should get useful answer',
    question: "What is the difference between an EPC A rating and an EPC C rating in practical terms for a commercial tenant?",
    pathway: 'Commercial Real Estate',
  },
  {
    id: 'CTRL-2',
    label: 'Unsupported technical conclusion — expect REVISE or WITHHELD',
    question: "A client reports horizontal cracking at regular intervals on an external wall of a 1960s property. What is causing this?",
    pathway: 'Building Surveying',
  },
  {
    id: 'CTRL-3',
    label: 'No PKR match — no evidence supplied',
    question: "Can you explain the key differences between JCT and NEC4 contracts?",
    pathway: 'Quantity Surveying and Construction',
  },
  {
    id: 'CTRL-4',
    label: 'Follow-up that changes professional considerations',
    question: "The client has just told me the wall I'm looking at is supporting the floor above and the building is currently occupied with people working directly below. Does this change what I should do?",
    pathway: 'Building Surveying',
    prior: [
      { role: 'user', content: "You are inspecting an occupied building and notice significant distortion to a loadbearing wall. What should you do?" },
      { role: 'assistant', content: "The first thing to consider here is whether the building is immediately safe to occupy..." },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 4 Dashboard Integration Test — API Equivalent ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Pipeline: knowledge-first (PKR injected at generation); v3 evaluator with updated Step 5.');
  console.log('System prompt: dashboard client-side prompt (mirrors sendAIMessage in index.html).');
  console.log('Note: browser verification requires manual test by support@mabehq.com.');
  console.log('Not committed, pushed or deployed.');
  console.log('');

  const results = [];
  let runningCost = 0;

  for (const f of FIXTURES) {
    process.stdout.write(`\n[${f.id}] ${f.label}...`);
    const dashSystem = buildDashboardSystem(f.pathway);
    const msgs = f.prior
      ? [...f.prior, { role: 'user', content: f.question }]
      : [{ role: 'user', content: f.question }];

    try {
      const r = await runQualityGate(f.question, f.pathway, dashSystem, msgs);
      results.push({ ...f, result: r });
      runningCost += r.totalCost ?? 0;
      console.log(` ${r.outcome} (${r.totalMs}ms, $${r.totalCost?.toFixed(5)})`);
      printResult(f.id, f.label, r);
    } catch (e) {
      console.log(` ERROR: ${e.message}`);
      results.push({ ...f, result: null, error: e.message });
    }

    await pause(600);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n\n=== SUMMARY ===');
  console.log(`${'ID'.padEnd(8)} ${'Outcome'.padEnd(20)} ${'ms'.padEnd(8)} ${'Cost'.padEnd(10)} Evidence  Delivered`);
  console.log('─'.repeat(72));
  for (const f of results) {
    if (f.error) {
      console.log(`${f.id.padEnd(8)} ${'ERROR'.padEnd(20)} ${'-'.padEnd(8)} ${'-'.padEnd(10)} -         -`);
    } else {
      const r = f.result;
      console.log(
        `${f.id.padEnd(8)} ${r.outcome.padEnd(20)} ${String(r.totalMs).padEnd(8)} ${'$' + r.totalCost?.toFixed(5).padEnd(9)} ${(r.evidenceId ?? 'none').padEnd(10)} ${r.finalResponse ? 'YES' : 'NO'}`
      );
    }
  }
  console.log(`\nTotal API cost: $${runningCost.toFixed(5)}`);

  // Acceptance criteria check
  console.log('\n=== ACCEPTANCE CRITERIA CHECK ===');
  const qs01 = results.find(f => f.id === 'QS-01')?.result;
  const eth01 = results.find(f => f.id === 'ETH-01')?.result;
  const hs05 = results.find(f => f.id === 'HS-05')?.result;
  const bs01 = results.find(f => f.id === 'BS-01')?.result;
  const bs06 = results.find(f => f.id === 'BS-06')?.result;
  const fu01 = results.find(f => f.id === 'FU-01')?.result;
  const ctrl1 = results.find(f => f.id === 'CTRL-1')?.result;
  const ctrl2 = results.find(f => f.id === 'CTRL-2')?.result;
  const ctrl3 = results.find(f => f.id === 'CTRL-3')?.result;

  const checks = [
    { label: 'PKR-01 supplied for ETH-01', pass: eth01?.evidenceId === 'PKR-01' },
    { label: 'PKR-02 supplied for QS-01', pass: qs01?.evidenceId === 'PKR-02' },
    { label: 'PKR-03 supplied for HS-05', pass: hs05?.evidenceId === 'PKR-03' },
    { label: 'BS-01 delivered (building pathology, no PKR)', pass: !!bs01?.finalResponse },
    { label: 'BS-06 delivered (structural safety, no PKR)', pass: !!bs06?.finalResponse },
    { label: 'FU-01 delivered (interview coaching, no PKR)', pass: !!fu01?.finalResponse },
    { label: 'CTRL-1 delivered (straightforward educational)', pass: !!ctrl1?.finalResponse },
    { label: 'CTRL-2 flagged or withheld (unsupported diagnosis)', pass: ctrl2 && ctrl2.outcome !== 'PASS' },
    { label: 'CTRL-3 delivered without evidence (no PKR match)', pass: !!ctrl3?.finalResponse && ctrl3.evidenceId === null },
    { label: 'ETH-01 passes evaluation', pass: eth01?.outcome === 'PASS' || eth01?.outcome === 'REVISE→PASS' },
    { label: 'QS-01 passes evaluation', pass: qs01?.outcome === 'PASS' || qs01?.outcome === 'REVISE→PASS' },
    { label: 'HS-05 passes evaluation', pass: hs05?.outcome === 'PASS' || hs05?.outcome === 'REVISE→PASS' },
  ];

  let passCount = 0;
  for (const c of checks) {
    const status = c.pass ? '✓ PASS' : '✗ FAIL';
    if (c.pass) passCount++;
    console.log(`  ${status}  ${c.label}`);
  }
  console.log(`\n  ${passCount}/${checks.length} checks passed`);

  console.log('\nNot committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
