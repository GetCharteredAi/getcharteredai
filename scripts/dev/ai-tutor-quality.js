/**
 * ai-tutor-quality.js
 *
 * Development-only quality gate endpoint for Michael AI Tutor.
 * Runs the candidate's question through Michael (Haiku), then evaluates
 * the proposed response with the v3 Professional Reasoning Evaluator (Sonnet)
 * before returning the result.
 *
 * STATUS: Development trial only. Not deployed. Not reachable by platform users.
 *
 * Authentication: requires X-Admin-Key header matching ADMIN_TEST_KEY.
 * The live /ai-tutor endpoint is NOT modified by this file.
 *
 * POST body: { question, pathway, competency, moduleId?, source_material? }
 * Response:  { final_response, pipeline_outcome, diagnostics }
 *   pipeline_outcome: PASS | REVISE→PASS | REVISE→WITHHELD | INSUFFICIENT_EVIDENCE | ESCALATE | INCOMPLETE
 *   diagnostics:      eval findings, revision text, timings, token costs
 */

'use strict';

const { readFileSync } = require('fs');
const { resolve }      = require('path');

// ── Shared pipeline (same logic as stage3-integration-trial.mjs) ─────────────
// In production this would be a shared require(), here kept inline for isolation.

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

const PKR_PATH = resolve(__dirname, '../../scripts/professional-knowledge-register.md');
const V3_PATH  = resolve(__dirname, '../../scripts/qa-eval-harness-v3.mjs');

// ── Lazy-load EVALUATOR_SYSTEM_V3 from v3 harness at cold start ──────────────
let _evaluatorPrompt = null;
function getEvaluatorPrompt() {
  if (_evaluatorPrompt) return _evaluatorPrompt;
  const src   = readFileSync(V3_PATH, 'utf8');
  const start = src.indexOf('const EVALUATOR_SYSTEM_V3 = `') + 'const EVALUATOR_SYSTEM_V3 = `'.length;
  const end   = src.indexOf('`;\n\n// ── Build user prompt', start);
  if (start < 50 || end < 0) throw new Error('Cannot extract EVALUATOR_SYSTEM_V3');
  _evaluatorPrompt = src.slice(start, end);
  return _evaluatorPrompt;
}

// ── Lazy-load PKR ────────────────────────────────────────────────────────────
let _pkr = null;
function getPKR() {
  if (_pkr) return _pkr;
  _pkr = readFileSync(PKR_PATH, 'utf8');
  return _pkr;
}

// ── PKR evidence selection ───────────────────────────────────────────────────
function selectEvidence(question, competency) {
  const q = (question + ' ' + competency).toLowerCase();
  const pkr = getPKR();
  if (/ethics|rules of conduct|professionalism/i.test(q))            return extractPKREntry(pkr, 'PKR-01');
  if (/contract practice|hgcra|payment|construction contract/i.test(q)) return extractPKREntry(pkr, 'PKR-02');
  if (/health and safety|asbestos|car 2012|duty to manage/i.test(q)) return extractPKREntry(pkr, 'PKR-03');
  return null;
}

function extractPKREntry(pkr, id) {
  const start = pkr.indexOf(`## ${id}:`);
  if (start === -1) return null;
  const next = pkr.indexOf('\n## PKR-', start + 5);
  return pkr.slice(start, next === -1 ? pkr.length : next).trim();
}

// ── System prompt extraction (mirrors test-script pattern) ──────────────────
let _buildModuleSystemPrompt = null;
function getBuildFn() {
  if (_buildModuleSystemPrompt) return _buildModuleSystemPrompt;
  const { createRequire } = require('module');
  const src       = readFileSync(resolve(__dirname, './ai-tutor.js'), 'utf8');
  const handlerIdx = src.indexOf('exports.handler');
  const isolated  = (handlerIdx > 0 ? src.slice(0, handlerIdx) : src) + '\nreturn buildModuleSystemPrompt;';
  const fn = new Function('require', 'exports', 'module', isolated);
  _buildModuleSystemPrompt = fn(createRequire(resolve(__dirname, './ai-tutor.js')), {}, { exports: {} });
  return _buildModuleSystemPrompt;
}

// ── API calls ────────────────────────────────────────────────────────────────
const HEADERS = () => ({
  'x-api-key': process.env.ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
});

async function callAPI(model, maxTokens, system, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: HEADERS(),
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: data.content?.[0]?.text ?? '',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
const REVISION_SYSTEM = `You are correcting a professional response for an RICS APC training platform.
Apply the minimum targeted correction for each identified failure. Do not rewrite sections that were not flagged.
Do not add disclaimers, hedging throughout, or generic qualifications — make only the specific targeted correction.

DIAGNOSTIC_ASSERTION Failure Mode 1 (mechanism as current fact): Reframe as a possible cause requiring investigation.
DIAGNOSTIC_ASSERTION Failure Mode 2 (pattern resolves cause): Reframe to show pattern informs investigation, not confirms cause.
DIAGNOSTIC_ASSERTION Failure Mode 3 (single cause, no alternatives): Add plausible alternatives and direction to investigate.
OMITTED_SAFETY: Insert a safety-first assessment before investigation steps.
PREMATURE_RECOMMENDATION: Insert safety and activity assessment before the monitoring recommendation.

Return only the corrected response text. No preamble.`;

async function runPipeline(question, pathway, competency, externalEvidence) {
  const t0 = Date.now();
  const evidence = externalEvidence ?? selectEvidence(question, competency);

  // Step 1: Michael's proposed response
  const sysPrompt = getBuildFn()(0, pathway, null, 'panel');
  const t1 = Date.now();
  const michael = await callAPI(MODEL_HAIKU, 2000, sysPrompt, [{ role: 'user', content: question }]);
  const michaelMs = Date.now() - t1;

  // Step 2: First evaluation
  let evalUser = `Candidate question: "${question}"\n\nPathway: ${pathway}\nCompetency: ${competency}\n\nMichael's proposed response:\n---\n${michael.text}\n---`;
  evalUser += evidence
    ? `\n\nVerified source material supplied:\n---\n${evidence}\n---`
    : `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;

  const t2 = Date.now();
  const eval1Raw = await callAPI(MODEL_SONNET, 2000, getEvaluatorPrompt(), [{ role: 'user', content: evalUser }]);
  const eval1Ms = Date.now() - t2;

  let eval1;
  try { const m = eval1Raw.text.match(/\{[\s\S]*\}/); eval1 = m ? JSON.parse(m[0]) : null; } catch (_) { eval1 = null; }
  const outcome1 = eval1?.outcome ?? 'PARSE_ERR';

  // Step 3: Handle outcome
  if (outcome1 === 'PASS') {
    return { final_response: michael.text, pipeline_outcome: 'PASS', diagnostics: { eval1, michaelMs, eval1Ms, totalMs: Date.now() - t0 } };
  }

  if (outcome1 === 'REVISE') {
    // One revision attempt
    const failures = (eval1?.reasoning_failures ?? [])
      .map((f, i) => `Failure ${i + 1}:\n  Type: ${f.failure_type}\n  Quoted text: "${f.quoted_text}"\n  Required correction: ${f.correction}`)
      .join('\n\n');

    const revUser = `Original response:\n---\n${michael.text}\n---\n\nQuality evaluator findings:\n${failures}\n\nApply only the targeted corrections. Return the full corrected response text.`;
    const t3 = Date.now();
    const revised = await callAPI(MODEL_SONNET, 2400, REVISION_SYSTEM, [{ role: 'user', content: revUser }]);
    const revisionMs = Date.now() - t3;

    // Re-evaluate
    let evalUser2 = `Candidate question: "${question}"\n\nPathway: ${pathway}\nCompetency: ${competency}\n\nMichael's proposed response:\n---\n${revised.text}\n---`;
    evalUser2 += evidence
      ? `\n\nVerified source material supplied:\n---\n${evidence}\n---`
      : `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;

    const t4 = Date.now();
    const eval2Raw = await callAPI(MODEL_SONNET, 2000, getEvaluatorPrompt(), [{ role: 'user', content: evalUser2 }]);
    const eval2Ms = Date.now() - t4;

    let eval2;
    try { const m = eval2Raw.text.match(/\{[\s\S]*\}/); eval2 = m ? JSON.parse(m[0]) : null; } catch (_) { eval2 = null; }

    const pipelineOutcome = eval2?.outcome === 'PASS' ? 'REVISE→PASS' : 'REVISE→WITHHELD';
    const finalResponse = eval2?.outcome === 'PASS' ? revised.text : null;

    return {
      final_response: finalResponse,
      pipeline_outcome: pipelineOutcome,
      diagnostics: { eval1, eval2, revisedResponse: revised.text, michaelMs, eval1Ms, revisionMs, eval2Ms, totalMs: Date.now() - t0 },
    };
  }

  if (outcome1 === 'INSUFFICIENT_EVIDENCE') {
    return { final_response: michael.text, pipeline_outcome: 'INSUFFICIENT_EVIDENCE', diagnostics: { eval1, michaelMs, eval1Ms, totalMs: Date.now() - t0 } };
  }

  if (outcome1 === 'ESCALATE') {
    return { final_response: null, pipeline_outcome: 'ESCALATE', diagnostics: { eval1, michaelMs, eval1Ms, totalMs: Date.now() - t0 } };
  }

  return { final_response: null, pipeline_outcome: `UNHANDLED:${outcome1}`, diagnostics: { eval1, michaelMs, eval1Ms, totalMs: Date.now() - t0 } };
}

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Dev-only authentication
  const adminKey = event.headers?.['x-admin-key'] ?? '';
  if (!adminKey || adminKey !== process.env.ADMIN_TEST_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  let body;
  try { body = JSON.parse(event.body ?? '{}'); } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { question, pathway, competency, source_material } = body;
  if (!question || !pathway || !competency) {
    return { statusCode: 400, body: JSON.stringify({ error: 'question, pathway and competency are required' }) };
  }

  try {
    const result = await runPipeline(question, pathway, competency, source_material ?? null);
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
