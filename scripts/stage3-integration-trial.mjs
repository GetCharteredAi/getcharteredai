/**
 * Stage 3 Integration Trial
 * Controlled quality gate pipeline: Michael → v3 Evaluator → PASS/REVISE/etc.
 *
 * 8 test cases:
 *   ETH-01, QS-01, HS-05 — knowledge corrections + PKR evidence
 *   BS-01, BS-06, FU-01  — professional reasoning corrections, no PKR
 *   TEST-PASS            — legitimate technical explanation
 *   TEST-REVISE          — question designed to produce REVISE (leading question,
 *                          single-cause framing risk); if passes live, synthetic
 *                          fixture demonstrates the correction path
 *
 * Development only. Not committed, pushed or deployed.
 * Does not touch the live ai-tutor endpoint or any production path.
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

// ── Extract buildModuleSystemPrompt ──────────────────────────────────────────
let buildModuleSystemPrompt;
try {
  const aiTutorPath = resolve(__dirname, '../netlify/functions/ai-tutor.js');
  const src = readFileSync(aiTutorPath, 'utf8');
  const handlerIdx = src.indexOf('exports.handler');
  const isolated = (handlerIdx > 0 ? src.slice(0, handlerIdx) : src) + '\nreturn buildModuleSystemPrompt;';
  const fn = new Function('require', 'exports', 'module', isolated);
  buildModuleSystemPrompt = fn(createRequire(aiTutorPath), {}, { exports: {} });
  console.log('[INIT] buildModuleSystemPrompt — OK');
} catch (e) { console.error('[INIT] buildModuleSystemPrompt failed:', e.message); process.exit(1); }

// ── Extract EVALUATOR_SYSTEM_V3 ──────────────────────────────────────────────
let EVALUATOR_SYSTEM_V3;
try {
  const v3Src = readFileSync(resolve(__dirname, 'qa-eval-harness-v3.mjs'), 'utf8');
  const start = v3Src.indexOf('const EVALUATOR_SYSTEM_V3 = `') + 'const EVALUATOR_SYSTEM_V3 = `'.length;
  const end   = v3Src.indexOf('`;\n\n// ── Build user prompt', start);
  if (start < 50 || end < 0) throw new Error('Boundary not found');
  EVALUATOR_SYSTEM_V3 = v3Src.slice(start, end);
  console.log(`[INIT] EVALUATOR_SYSTEM_V3 (${EVALUATOR_SYSTEM_V3.length} chars) — OK`);
} catch (e) { console.error('[INIT] Evaluator extract failed:', e.message); process.exit(1); }

// ── Load PKR ─────────────────────────────────────────────────────────────────
const PKR_CONTENT = readFileSync(resolve(__dirname, 'professional-knowledge-register.md'), 'utf8');

function extractPKREntry(id) {
  const start = PKR_CONTENT.indexOf(`## ${id}:`);
  if (start === -1) return null;
  const next = PKR_CONTENT.indexOf('\n## PKR-', start + 5);
  return PKR_CONTENT.slice(start, next === -1 ? PKR_CONTENT.length : next).trim();
}

function selectEvidence(question, competency) {
  const q = (question + ' ' + competency).toLowerCase();
  if (/ethics|rules of conduct|professionalism/i.test(q))               return { id: 'PKR-01', text: extractPKREntry('PKR-01') };
  if (/contract practice|hgcra|payment|construction contract/i.test(q)) return { id: 'PKR-02', text: extractPKREntry('PKR-02') };
  if (/health and safety|asbestos|car 2012|duty to manage/i.test(q))    return { id: 'PKR-03', text: extractPKREntry('PKR-03') };
  return null;
}

// ── API helpers ───────────────────────────────────────────────────────────────
const HEADERS = {
  'x-api-key': ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
};

function calcCost(model, input, output) {
  if (model === 'haiku')  return (input * 0.80 + output * 4.00) / 1_000_000;
  if (model === 'sonnet') return (input * 3.00 + output * 15.00) / 1_000_000;
  return 0;
}

async function callAPI(model, maxTokens, system, messages) {
  const t = Date.now();
  const modelId = model === 'haiku' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature: 0, system, messages }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  return {
    text: data.content?.[0]?.text ?? '',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    ms: Date.now() - t,
  };
}

function parseEval(text) {
  try { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (_) { return null; }
}

// ── Revision system prompt ────────────────────────────────────────────────────
const REVISION_SYSTEM = `You are correcting a professional response for an RICS APC training platform. Apply the minimum targeted correction for each identified failure. Do not rewrite sections that were not flagged. Do not add disclaimers, hedging throughout, or generic qualifications. Return only the corrected response text.

DIAGNOSTIC_ASSERTION Failure Mode 1 (mechanism stated as current fact): Reframe as a possible cause requiring investigation — change "the lintel is sagging under load" to "lintel deflection is one possible cause worth investigating".

DIAGNOSTIC_ASSERTION Failure Mode 2 (pattern resolves cause): Reframe to show pattern informs investigation, not confirms cause — change "this tells you whether you're looking at X" to "this is worth investigating as a possible X".

DIAGNOSTIC_ASSERTION Failure Mode 3 (single cause, no alternatives): Add plausible alternatives and direction to investigate.

OMITTED_SAFETY: Insert a safety-first paragraph before investigation steps.

PREMATURE_RECOMMENDATION: Insert safety and activity assessment before the monitoring recommendation.`;

// ── Pipeline ──────────────────────────────────────────────────────────────────
async function runPipeline(fixture) {
  const { id, question, pathway, competency, syntheticResponse } = fixture;
  const result = { id, question, pathway, competency };

  const t0 = Date.now();

  // Evidence selection
  const evidence = fixture.forcedEvidence ?? selectEvidence(question, competency);
  result.evidenceId = evidence?.id ?? 'none';

  // Step 1: Michael's proposed response
  let michaelResp;
  if (syntheticResponse) {
    // Synthetic fixture: use pre-written response, skip Michael call
    michaelResp = { text: syntheticResponse, inputTokens: 0, outputTokens: 0, ms: 0, synthetic: true };
  } else {
    const sysPrompt = buildModuleSystemPrompt(0, pathway, null, 'panel');
    michaelResp = await callAPI('haiku', 2000, sysPrompt, [{ role: 'user', content: question }]);
  }
  result.proposedResponse    = michaelResp.text;
  result.michaelMs           = michaelResp.ms;
  result.michaelTokens       = { in: michaelResp.inputTokens, out: michaelResp.outputTokens };
  result.michaelCost         = calcCost('haiku', michaelResp.inputTokens, michaelResp.outputTokens);
  result.michaelSynthetic    = !!syntheticResponse;

  await pause(400);

  // Step 2: First evaluation
  const evalUser1 = buildEvalUser(question, pathway, competency, michaelResp.text, evidence?.text ?? null);
  const eval1Raw = await callAPI('sonnet', 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: evalUser1 }]);
  result.eval1Parsed   = parseEval(eval1Raw.text);
  result.eval1RawText  = eval1Raw.text;
  result.eval1Ms       = eval1Raw.ms;
  result.eval1Tokens   = { in: eval1Raw.inputTokens, out: eval1Raw.outputTokens };
  result.eval1Cost     = calcCost('sonnet', eval1Raw.inputTokens, eval1Raw.outputTokens);

  const outcome1 = result.eval1Parsed?.outcome ?? 'PARSE_ERR';

  if (outcome1 === 'PASS') {
    result.pipelineOutcome = 'PASS';
    result.finalResponse   = michaelResp.text;
    result.totalMs         = Date.now() - t0;
    result.totalCost       = result.michaelCost + result.eval1Cost;
    return result;
  }

  if (outcome1 === 'REVISE') {
    await pause(400);
    // Revision
    const failures = (result.eval1Parsed?.reasoning_failures ?? [])
      .map((f, i) => `Failure ${i + 1}: ${f.failure_type}\nQuoted: "${f.quoted_text}"\nCorrection: ${f.correction}`)
      .join('\n\n');
    const revUser = `Original response:\n---\n${michaelResp.text}\n---\n\nEvaluator findings:\n${failures}\n\nApply only the targeted corrections. Return the full corrected response text.`;
    const revRaw = await callAPI('sonnet', 2400, REVISION_SYSTEM, [{ role: 'user', content: revUser }]);
    result.revisionText   = revRaw.text;
    result.revisionMs     = revRaw.ms;
    result.revisionTokens = { in: revRaw.inputTokens, out: revRaw.outputTokens };
    result.revisionCost   = calcCost('sonnet', revRaw.inputTokens, revRaw.outputTokens);

    await pause(400);

    // Second evaluation
    const evalUser2 = buildEvalUser(question, pathway, competency, revRaw.text, evidence?.text ?? null);
    const eval2Raw = await callAPI('sonnet', 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: evalUser2 }]);
    result.eval2Parsed   = parseEval(eval2Raw.text);
    result.eval2RawText  = eval2Raw.text;
    result.eval2Ms       = eval2Raw.ms;
    result.eval2Tokens   = { in: eval2Raw.inputTokens, out: eval2Raw.outputTokens };
    result.eval2Cost     = calcCost('sonnet', eval2Raw.inputTokens, eval2Raw.outputTokens);

    const outcome2 = result.eval2Parsed?.outcome ?? 'PARSE_ERR';
    result.pipelineOutcome = outcome2 === 'PASS' ? 'REVISE→PASS' : 'REVISE→WITHHELD';
    result.finalResponse   = outcome2 === 'PASS' ? revRaw.text : null;
    result.totalMs         = Date.now() - t0;
    result.totalCost       = result.michaelCost + result.eval1Cost + result.revisionCost + result.eval2Cost;
    return result;
  }

  if (outcome1 === 'INSUFFICIENT_EVIDENCE') {
    result.pipelineOutcome = 'INSUFFICIENT_EVIDENCE';
    // Deliver with unverified claims noted — no automatic stripping in this trial
    result.finalResponse   = michaelResp.text;
    result.totalMs         = Date.now() - t0;
    result.totalCost       = result.michaelCost + result.eval1Cost;
    return result;
  }

  if (outcome1 === 'ESCALATE') {
    result.pipelineOutcome = 'ESCALATE';
    result.finalResponse   = null;
    result.totalMs         = Date.now() - t0;
    result.totalCost       = result.michaelCost + result.eval1Cost;
    return result;
  }

  if (outcome1 === 'INCOMPLETE') {
    result.pipelineOutcome = 'INCOMPLETE';
    result.finalResponse   = null;
    result.totalMs         = Date.now() - t0;
    result.totalCost       = result.michaelCost + result.eval1Cost;
    return result;
  }

  result.pipelineOutcome = `UNHANDLED:${outcome1}`;
  result.finalResponse   = null;
  result.totalMs         = Date.now() - t0;
  result.totalCost       = result.michaelCost + result.eval1Cost;
  return result;
}

function buildEvalUser(question, pathway, competency, response, sourceMaterial) {
  let user = `Candidate question: "${question}"\n\nPathway: ${pathway}\nCompetency: ${competency}\n\nMichael's proposed response:\n---\n${response}\n---`;
  if (sourceMaterial) {
    user += `\n\nVerified source material supplied:\n---\n${sourceMaterial}\n---`;
  } else {
    user += `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;
  }
  return user;
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test fixtures ─────────────────────────────────────────────────────────────
// Synthetic TEST-REVISE response: designed to contain Failure Mode 2 (pattern resolves cause)
// Used as supplementary fixture if the live question passes.
const SYNTHETIC_REVISE_RESPONSE =
`The regular horizontal cracking at approximately 1.5m intervals is a strong indicator of cavity wall tie failure. This pattern tells you that the ties have corroded and expanded, causing the outer leaf to separate from the inner leaf. In a 1960s property this is to be expected — the galvanised ties used in that era are particularly susceptible to corrosion.

You should arrange for a borescope survey immediately to check the tie condition. If ties are found to be failing, remediation is required — typically drilling through the outer leaf and installing stainless steel replacement ties, followed by repointing the drilled holes. The outer leaf will also need to be assessed for stability pending remediation.

What is the extent of the cracking — is it localised to one area or does it extend across the whole elevation?`;

const FIXTURES = [
  {
    id: 'ETH-01',
    label: 'RICS ethical framework',
    question: "What is the RICS ethical framework, and how does it differ from the previous professional and ethical standards?",
    pathway: 'Ethics and Rules of Conduct',
    competency: 'Ethics, Rules of Conduct and Professionalism (mandatory Level 3)',
    expected: 'PASS',
    notes: 'PKR-01 evidence. Stage 1 corrections applied.',
  },
  {
    id: 'QS-01',
    label: 'HGCRA payment provisions',
    question: "Can you explain how the Housing Grants, Construction and Regeneration Act 1996 applies to payment — specifically what happens if a paying party fails to issue a payment notice?",
    pathway: 'Quantity Surveying and Construction',
    competency: 'Contract Practice (mandatory Level 3)',
    expected: 'PASS',
    notes: 'PKR-02 evidence. Stage 1 corrections applied.',
  },
  {
    id: 'HS-05',
    label: 'Asbestos management obligations',
    question: "I'm a managing agent and I've just discovered asbestos during a refurbishment inspection. What are my immediate obligations under the Control of Asbestos Regulations 2012?",
    pathway: 'Building Surveying',
    competency: 'Health and Safety (mandatory Level 2)',
    expected: 'PASS',
    notes: 'PKR-03 evidence. Stage 1 corrections applied.',
  },
  {
    id: 'BS-01',
    label: 'Cracking above door lintel',
    question: "A client has reported cracking above a door lintel on the ground floor of a 1970s brick-built house. How should I approach this?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS',
    notes: 'No PKR. Stage 2 reasoning corrections applied.',
  },
  {
    id: 'BS-06',
    label: 'Distorted loadbearing wall — building occupied',
    question: "During an inspection I've found visible distortion to a loadbearing internal wall and the building is still occupied. What are my immediate priorities?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS',
    notes: 'No PKR. Stage 2 activity-assessment correction applied.',
  },
  {
    id: 'FU-01',
    label: 'APC interview coaching — diagonal cracking',
    question: "You said I shouldn't diagnose from crack patterns alone — but RICS assessors will definitely ask me what diagonal cracking means. How do I answer that in the interview without looking like I don't know my subject?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS',
    notes: 'No PKR. Stage 2 interview coaching correction applied.',
  },
  {
    id: 'TEST-PASS',
    label: 'Technical explanation — masonry vs timber frame (should PASS)',
    question: "Can you explain the main structural differences between traditional masonry cavity wall construction and modern timber frame construction — and the key building pathology risks associated with each?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS',
    notes: 'No PKR. Technical educational content expected; Type B acceptable. No correction history for this topic.',
  },
  {
    id: 'TEST-REVISE',
    label: 'Leading question designed to trigger REVISE',
    question: "I'm looking at a 1960s cavity wall property with regular horizontal cracking through the outer leaf at around 1.5m intervals. What does this tell me about the building's condition, and what should I do next?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    expected: 'REVISE',
    notes: '"What does this tell me" targets Failure Mode 2 (pattern resolves cause). "What should I do next" risks premature recommendation. If live response passes, SYNTHETIC-REVISE demonstrates the correction path.',
  },
  {
    id: 'SYNTHETIC-REVISE',
    label: 'SYNTHETIC fixture — Failure Mode 2 + premature recommendation (must REVISE)',
    question: "I'm looking at a 1960s cavity wall property with regular horizontal cracking through the outer leaf at around 1.5m intervals. What does this tell me about the building's condition, and what should I do next?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    expected: 'REVISE→PASS',
    notes: 'Synthetic response known to contain Failure Mode 2 ("tells you the ties have corroded") and premature recommendation (borescope survey before safety assessment). Demonstrates the complete REVISE→PASS correction path.',
    syntheticResponse: SYNTHETIC_REVISE_RESPONSE,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 3 Integration Trial ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Isolated pipeline: not connected to production endpoint.');
  console.log('ai-tutor.js not modified. No deployment.');
  console.log(`Questions: ${FIXTURES.filter(f => !f.syntheticResponse).length} live Michael + 1 synthetic`);
  console.log('');

  const results = [];

  for (const fixture of FIXTURES) {
    const label = fixture.syntheticResponse ? `[SYNTHETIC] ${fixture.id}` : `[LIVE] ${fixture.id}`;
    process.stdout.write(`${label} — `);
    try {
      const r = await runPipeline(fixture);
      r.expected = fixture.expected;
      r.label    = fixture.label;
      r.testNotes = fixture.notes;
      results.push(r);
      const match = r.expected === r.pipelineOutcome || (r.expected === 'REVISE' && r.pipelineOutcome?.startsWith('REVISE'));
      console.log(`${r.pipelineOutcome?.padEnd(18)} ${r.totalMs}ms  $${r.totalCost?.toFixed(5)}  ${match ? 'EXPECTED' : 'UNEXPECTED'}`);
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      results.push({ id: fixture.id, label: fixture.label, error: e.message, expected: fixture.expected });
    }
    await pause(800);
  }

  // ── Print full report ─────────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(80));
  console.log('STAGE 3 REPORT');
  console.log('='.repeat(80));

  for (const r of results) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`${r.id}: ${r.label}`);
    console.log(`Evidence: ${r.evidenceId ?? 'none'}   Pipeline: ${r.pipelineOutcome ?? 'ERROR'}   Expected: ${r.expected}   Total: ${r.totalMs ?? '?'}ms   Cost: $${r.totalCost?.toFixed(5) ?? '?'}`);

    if (r.error) { console.log(`ERROR: ${r.error}`); continue; }

    console.log('\nMICHAEL PROPOSED RESPONSE:');
    console.log(r.michaelSynthetic ? '[SYNTHETIC FIXTURE]' : `[${r.michaelTokens?.out}tok Haiku, ${r.michaelMs}ms]`);
    console.log(r.proposedResponse);

    console.log('\nEVALUATOR FINDINGS (R1):');
    if (r.eval1Parsed) {
      console.log(`Outcome: ${r.eval1Parsed.outcome}`);
      if (r.eval1Parsed.safety_screen?.finding) {
        console.log(`Safety: ${r.eval1Parsed.safety_screen.finding}`);
      }
      if (r.eval1Parsed.reasoning_failures?.length) {
        for (const f of r.eval1Parsed.reasoning_failures) {
          console.log(`  [${f.severity}] ${f.failure_type}: "${(f.quoted_text ?? '').slice(0, 90)}"`);
          console.log(`    Correction: ${(f.correction ?? '').slice(0, 120)}`);
        }
      } else {
        console.log('  No material failures.');
      }
      if (r.eval1Parsed.unverified_type_ab?.length) {
        console.log(`  Unverified claims: ${r.eval1Parsed.unverified_type_ab.join('; ').slice(0, 100)}`);
      }
      console.log(`Basis: ${r.eval1Parsed.outcome_basis}`);
    } else {
      console.log('[Parse error — raw below]');
      console.log(r.eval1RawText?.slice(0, 300));
    }

    if (r.revisionText) {
      console.log('\nREVISED RESPONSE (Sonnet correction):');
      console.log(`[${r.revisionTokens?.out}tok, ${r.revisionMs}ms]`);
      console.log(r.revisionText);

      console.log('\nEVALUATOR FINDINGS (R2):');
      if (r.eval2Parsed) {
        console.log(`Outcome: ${r.eval2Parsed.outcome}`);
        if (r.eval2Parsed.reasoning_failures?.length) {
          for (const f of r.eval2Parsed.reasoning_failures) {
            console.log(`  [${f.severity}] ${f.failure_type}: "${(f.quoted_text ?? '').slice(0, 90)}"`);
          }
        } else {
          console.log('  No material failures.');
        }
        console.log(`Basis: ${r.eval2Parsed.outcome_basis}`);
      } else {
        console.log('[Parse error]');
      }
    }

    console.log(`\nFINAL RESPONSE DELIVERED: ${r.finalResponse ? 'YES' : 'NO (withheld)'}`);
  }

  // ── Performance summary ───────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(80));
  console.log('PERFORMANCE SUMMARY');
  console.log('='.repeat(80));
  console.log('');

  const live      = results.filter(r => !r.michaelSynthetic && !r.error);
  const passOnly  = live.filter(r => r.pipelineOutcome === 'PASS');
  const revise    = live.filter(r => r.pipelineOutcome?.startsWith('REVISE'));
  const synthetic = results.filter(r => r.michaelSynthetic);

  const avg = arr => arr.length ? Math.round(arr.reduce((s, r) => s + (r.totalMs ?? 0), 0) / arr.length) : 0;
  const sum = arr => arr.reduce((s, r) => s + (r.totalCost ?? 0), 0);

  console.log(`Live PASS questions (${passOnly.length}):`);
  console.log(`  Avg total latency: ${avg(passOnly)}ms`);
  console.log(`  Michael avg: ${avg(passOnly.map(r => ({ totalMs: r.michaelMs })))}ms`);
  console.log(`  Eval avg: ${avg(passOnly.map(r => ({ totalMs: r.eval1Ms })))}ms`);
  console.log(`  Avg cost per interaction: $${passOnly.length ? (sum(passOnly) / passOnly.length).toFixed(5) : '?'}`);

  if (revise.length) {
    console.log(`\nLive REVISE questions (${revise.length}):`);
    console.log(`  Avg total latency: ${avg(revise)}ms`);
    console.log(`  Avg cost per interaction: $${(sum(revise) / revise.length).toFixed(5)}`);
  }

  if (synthetic.length) {
    console.log(`\nSynthetic fixtures (${synthetic.length}):`);
    for (const r of synthetic) {
      console.log(`  ${r.id}: ${r.pipelineOutcome}, ${r.totalMs}ms, $${r.totalCost?.toFixed(5)}`);
    }
  }

  console.log(`\nTotal API cost (all ${results.length} tests): $${sum(results).toFixed(5)}`);

  // ── Results table ─────────────────────────────────────────────────────────
  console.log('\n\nRESULTS TABLE:');
  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log('ID              OUTCOME           EVIDENCE  EXPECTED  MATCH  TOT_MS   COST');
  console.log('─────────────────────────────────────────────────────────────────────────');
  for (const r of results) {
    if (r.error) { console.log(`${r.id.padEnd(16)} ERROR`); continue; }
    const match = r.expected === r.pipelineOutcome || (r.expected === 'REVISE' && r.pipelineOutcome?.startsWith('REVISE')) ? '✓' : '✗';
    console.log(
      `${r.id.padEnd(16)} ${(r.pipelineOutcome ?? '?').padEnd(18)} ${(r.evidenceId ?? 'none').padEnd(10)} ${(r.expected ?? '?').padEnd(10)} ${match}      ${String(r.totalMs ?? '?').padEnd(7)} $${r.totalCost?.toFixed(4) ?? '?'}`
    );
  }
  console.log('─────────────────────────────────────────────────────────────────────────');

  console.log('\n=== END. Not committed, pushed or deployed. ===');
}

main().catch(e => { console.error(e); process.exit(1); });
