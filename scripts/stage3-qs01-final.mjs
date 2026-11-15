/**
 * Stage 3 QS-01 final integration test — knowledge-first pipeline
 *
 * Key change from stage3-qs01-rerun.mjs:
 *   PKR-02 verified statutory material is supplied to Michael at generation
 *   time, not only to the evaluator. Michael generates the response with the
 *   authoritative source available, rather than relying on general model
 *   knowledge and attempting to correct errors afterwards.
 *
 * Evaluator: qa-eval-harness-v3.mjs with updated Step 5 (omission standard
 *   and mechanism-distinction note to address the R2 s.110A(1)(b)/s.110B
 *   false positive observed in stage3-qs01-rerun.mjs).
 *
 * ai-tutor.js: unchanged. No change to candidate-facing Tutor behaviour.
 * Development only. Not committed, pushed or deployed.
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
} catch (e) { console.error('[INIT]', e.message); process.exit(1); }

// ── Extract EVALUATOR_SYSTEM_V3 (picks up updated Step 5) ────────────────────
let EVALUATOR_SYSTEM_V3;
try {
  const src = readFileSync(resolve(__dirname, 'qa-eval-harness-v3.mjs'), 'utf8');
  const s   = src.indexOf('const EVALUATOR_SYSTEM_V3 = `') + 'const EVALUATOR_SYSTEM_V3 = `'.length;
  const e   = src.indexOf('`;\n\n// ── Build user prompt', s);
  if (s < 50 || e < 0) throw new Error('Boundary not found');
  EVALUATOR_SYSTEM_V3 = src.slice(s, e);
  console.log(`[INIT] EVALUATOR_SYSTEM_V3 (${EVALUATOR_SYSTEM_V3.length} chars) — OK`);
} catch (e) { console.error('[INIT] Evaluator:', e.message); process.exit(1); }

// ── Load PKR-02 ───────────────────────────────────────────────────────────────
const PKR_CONTENT = readFileSync(resolve(__dirname, 'professional-knowledge-register.md'), 'utf8');
function extractPKREntry(id) {
  const start = PKR_CONTENT.indexOf(`## ${id}:`);
  if (start === -1) return null;
  const next  = PKR_CONTENT.indexOf('\n## PKR-', start + 5);
  return PKR_CONTENT.slice(start, next === -1 ? PKR_CONTENT.length : next).trim();
}
const PKR02 = extractPKREntry('PKR-02');
if (!PKR02) { console.error('[INIT] PKR-02 not found'); process.exit(1); }
console.log(`[INIT] PKR-02 (${PKR02.length} chars) — OK`);

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

const REVISION_SYSTEM = `You are correcting a professional response for an RICS APC training platform. Apply the minimum targeted correction for each identified failure. Do not rewrite sections that were not flagged. Do not add disclaimers, hedging throughout, or generic qualifications. Return only the corrected response text.

STATUTORY_ERROR: Replace the incorrect claim with the accurate statement from the verified source material. Do not remove accurate statutory information — make it more precisely accurate. Return the full corrected response.`;

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Knowledge-first pipeline ──────────────────────────────────────────────────
// Supply PKR evidence to Michael at generation time, not only to the evaluator.
async function runPipeline(question, pathway, competency, evidence) {
  const t0 = Date.now();

  // Step 1: Michael — system prompt augmented with verified PKR material
  let sysPrompt = buildModuleSystemPrompt(0, pathway, null, 'panel');
  if (evidence) {
    sysPrompt +=
      '\n\n---\nVERIFIED STATUTORY REFERENCE MATERIAL\n' +
      'The following entry from the GCAi Professional Knowledge Register has been verified against primary legislation. ' +
      'Apply its requirements accurately in your response. Do not contradict its verified provisions.\n\n' +
      evidence +
      '\n---';
  }
  const michael   = await callAPI('haiku', 2000, sysPrompt, [{ role: 'user', content: question }]);
  const michaelMs = michael.ms;

  await pause(400);

  // Step 2: First evaluation
  const evalUser1 = buildEvalUser(question, pathway, competency, michael.text, evidence);
  const eval1Raw  = await callAPI('sonnet', 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: evalUser1 }]);
  const eval1     = parseEval(eval1Raw.text);
  const outcome1  = eval1?.outcome ?? 'PARSE_ERR';

  if (outcome1 === 'PASS') {
    return {
      proposedResponse: michael.text, michaelMs, eval1,
      outcome: 'PASS', finalResponse: michael.text,
      totalMs: Date.now() - t0,
      totalCost: calcCost('haiku', michael.in, michael.out) + calcCost('sonnet', eval1Raw.in, eval1Raw.out),
    };
  }

  if (outcome1 === 'REVISE') {
    await pause(400);
    const failures = (eval1?.reasoning_failures ?? [])
      .map((f, i) => `Failure ${i + 1}: ${f.failure_type}\nQuoted: "${f.quoted_text}"\nCorrection: ${f.correction}`)
      .join('\n\n');
    const revUser = `Original response:\n---\n${michael.text}\n---\n\nEvaluator findings:\n${failures}\n\nApply only the targeted corrections. Return the full corrected response text.`;
    const revRaw  = await callAPI('sonnet', 2400, REVISION_SYSTEM, [{ role: 'user', content: revUser }]);

    await pause(400);

    const evalUser2 = buildEvalUser(question, pathway, competency, revRaw.text, evidence);
    const eval2Raw  = await callAPI('sonnet', 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: evalUser2 }]);
    const eval2     = parseEval(eval2Raw.text);
    const outcome2  = eval2?.outcome ?? 'PARSE_ERR';

    const pipelineOutcome = outcome2 === 'PASS' ? 'REVISE→PASS' : 'REVISE→WITHHELD';
    const totalCost =
      calcCost('haiku',  michael.in, michael.out) +
      calcCost('sonnet', eval1Raw.in, eval1Raw.out) +
      calcCost('sonnet', revRaw.in, revRaw.out) +
      calcCost('sonnet', eval2Raw.in, eval2Raw.out);

    return {
      proposedResponse: michael.text, michaelMs, eval1,
      revisionText: revRaw.text, eval2,
      outcome: pipelineOutcome,
      finalResponse: outcome2 === 'PASS' ? revRaw.text : null,
      totalMs: Date.now() - t0, totalCost,
    };
  }

  return {
    proposedResponse: michael.text, michaelMs, eval1,
    outcome: outcome1, finalResponse: null,
    totalMs: Date.now() - t0,
    totalCost: calcCost('haiku', michael.in, michael.out) + calcCost('sonnet', eval1Raw.in, eval1Raw.out),
  };
}

function buildEvalUser(question, pathway, competency, response, evidence) {
  let u = `Candidate question: "${question}"\n\nPathway: ${pathway}\nCompetency: ${competency}\n\nMichael's proposed response:\n---\n${response}\n---`;
  u += evidence
    ? `\n\nVerified source material supplied:\n---\n${evidence}\n---`
    : `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;
  return u;
}

function printResult(label, r) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(label);
  console.log(`Pipeline: ${r.outcome}   Total: ${r.totalMs}ms   Cost: $${r.totalCost?.toFixed(5)}`);

  console.log('\nMICHAEL PROPOSED RESPONSE:');
  console.log(`[${r.michaelMs}ms — with PKR-02 injected]`);
  console.log(r.proposedResponse);

  console.log('\nEVALUATOR FINDINGS (R1):');
  if (r.eval1) {
    console.log(`Outcome: ${r.eval1.outcome}`);
    if (!r.eval1.reasoning_failures?.length && !r.eval1.unverified_type_ab?.length) {
      console.log('  No material failures.');
    }
    for (const f of r.eval1.reasoning_failures ?? []) {
      console.log(`  [${f.severity}] ${f.failure_type}: "${(f.quoted_text ?? '').slice(0, 120)}"`);
      console.log(`    Correction: ${(f.correction ?? '').slice(0, 150)}`);
    }
    if (r.eval1.unverified_type_ab?.length) {
      console.log(`  Unverified: ${r.eval1.unverified_type_ab.slice(0, 3).join('; ')}`);
    }
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
        console.log(`    Correction: ${(f.correction ?? '').slice(0, 150)}`);
      }
      if (!r.eval2.reasoning_failures?.length) console.log('  No material failures.');
      console.log(`  Basis: ${r.eval2.outcome_basis}`);
    }
  }

  console.log(`\nFINAL RESPONSE DELIVERED: ${r.finalResponse ? 'YES' : 'NO (withheld)'}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 3 QS-01 Final Integration Test — Knowledge-First Pipeline ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Change: PKR-02 supplied to Michael at generation time (injected into system prompt).');
  console.log('Evaluator: updated Step 5 — omission standard; mechanism-distinction note.');
  console.log('ai-tutor.js: unchanged. Candidate-facing Tutor behaviour preserved.');
  console.log('Not committed, pushed or deployed.');
  console.log('');

  const PATHWAY    = 'Quantity Surveying and Construction';
  const COMPETENCY = 'Contract Practice (mandatory Level 3)';

  const QS01    = "Can you explain how the Housing Grants, Construction and Regeneration Act 1996 applies to payment — specifically what happens if a paying party fails to issue a payment notice?";
  const QS01_FU = "What is the statutory deadline for giving a payment notice under the HGCRA 1996, and what is the legal basis for that period?";

  console.log('Running QS-01 primary (knowledge-first)...');
  const r1 = await runPipeline(QS01, PATHWAY, COMPETENCY, PKR02);
  printResult('QS-01: HGCRA payment provisions (primary question)', r1);

  await pause(800);

  console.log('\nRunning QS-01 follow-up (knowledge-first)...');
  const r2 = await runPipeline(QS01_FU, PATHWAY, COMPETENCY, PKR02);
  printResult('QS-01-FU: Statutory deadline for payment notice', r2);

  console.log('\n\n=== SUMMARY ===');
  console.log(`QS-01 primary:   ${r1.outcome.padEnd(20)} ${r1.totalMs}ms  $${r1.totalCost?.toFixed(5)}  Final delivered: ${r1.finalResponse ? 'YES' : 'NO'}`);
  console.log(`QS-01 follow-up: ${r2.outcome.padEnd(20)} ${r2.totalMs}ms  $${r2.totalCost?.toFixed(5)}  Final delivered: ${r2.finalResponse ? 'YES' : 'NO'}`);

  if (r1.finalResponse || r2.finalResponse) {
    console.log('\n=== FINAL RESPONSES DELIVERED ===');
    if (r1.finalResponse) {
      console.log('\nQS-01 primary:');
      console.log(r1.finalResponse);
    }
    if (r2.finalResponse) {
      console.log('\nQS-01 follow-up:');
      console.log(r2.finalResponse);
    }
  }

  console.log('\nNot committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
