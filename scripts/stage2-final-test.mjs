/**
 * Stage 2 Final Targeted Test
 * Tests: BS-01 (×2 for consistency), BS-06, FU-01 with corrected Michael system prompt
 * Synthetic: A2, B, C, D, E — verifies no regressions
 * Evaluator: EVALUATOR_SYSTEM_V3 read live from qa-eval-harness-v3.mjs (no separate copy)
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

// ── Extract buildModuleSystemPrompt ──────────────────────────────────────────
let buildModuleSystemPrompt;
try {
  const aiTutorPath   = resolve(__dirname, '../netlify/functions/ai-tutor.js');
  const aiTutorSource = readFileSync(aiTutorPath, 'utf8');
  const handlerIdx    = aiTutorSource.indexOf('exports.handler');
  const isolatedSrc   = (handlerIdx > 0 ? aiTutorSource.slice(0, handlerIdx) : aiTutorSource)
                        + '\nreturn buildModuleSystemPrompt;';
  const fn = new Function('require', 'exports', 'module', isolatedSrc);
  buildModuleSystemPrompt = fn(createRequire(aiTutorPath), {}, { exports: {} });
  console.log('[INIT] buildModuleSystemPrompt extracted — OK');
} catch (e) { console.error('[INIT] Failed:', e.message); process.exit(1); }

// ── Extract EVALUATOR_SYSTEM_V3 from qa-eval-harness-v3.mjs ──────────────────
let EVALUATOR_SYSTEM_V3;
try {
  const v3Src = readFileSync(resolve(__dirname, 'qa-eval-harness-v3.mjs'), 'utf8');
  const start = v3Src.indexOf('const EVALUATOR_SYSTEM_V3 = `') + 'const EVALUATOR_SYSTEM_V3 = `'.length;
  const end   = v3Src.indexOf('`;\n\n// ── Build user prompt', start);
  if (start < 50 || end < 0) throw new Error('Could not locate EVALUATOR_SYSTEM_V3 boundaries');
  EVALUATOR_SYSTEM_V3 = v3Src.slice(start, end);
  console.log(`[INIT] EVALUATOR_SYSTEM_V3 extracted (${EVALUATOR_SYSTEM_V3.length} chars) — OK`);
} catch (e) { console.error('[INIT] Failed to extract evaluator prompt:', e.message); process.exit(1); }

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';
const HEADERS = { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };

function isLikelyTruncated(text) {
  const t = text.trim();
  if (t.endsWith('...') || t.endsWith('…')) return true;
  return !/[.!?]["']?\s*$/.test(t);
}

async function callAPI(model, maxTokens, system, messages) {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, system, messages }),
  });
  const elapsed = Date.now() - t0;
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  return { text: data.content?.[0]?.text ?? '', inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, elapsed };
}

async function callMichael(question, pathway) {
  const system = buildModuleSystemPrompt(0, pathway, null, 'panel');
  const r = await callAPI(MODEL_HAIKU, 2000, system, [{ role: 'user', content: question }]);
  return r;
}

async function callEvaluator(fixture) {
  let user = `Candidate question: "${fixture.question}"\n\nPathway: ${fixture.pathway}\nCompetency: ${fixture.competency}\n\nMichael's proposed response:\n---\n${fixture.response}\n---`;
  user += fixture.sourceMaterial
    ? `\n\nVerified source material supplied:\n---\n${fixture.sourceMaterial}\n---`
    : `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;
  const r = await callAPI(MODEL_SONNET, 2000, EVALUATOR_SYSTEM_V3, [{ role: 'user', content: user }]);
  let parsed = null;
  try { const m = r.text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch (_) {}
  return { ...r, parsed, programmaticTruncation: isLikelyTruncated(fixture.response) };
}

// ── REGRESSION QUESTIONS ──────────────────────────────────────────────────────
const REGRESSION_QUESTIONS = [
  {
    id: 'BS-01',
    label: 'Cracking above door lintel',
    question: "A client has reported cracking above a door lintel on the ground floor of a 1970s brick-built house. How should I approach this?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS — corrected system prompt should remove "most common cause" and "usually stable" assertions',
    expectedOutcomes: ['PASS'],
  },
  {
    id: 'BS-06',
    label: 'Distorted loadbearing wall — building occupied',
    question: "During an inspection I've found visible distortion to a loadbearing internal wall and the building is still occupied. What are my immediate priorities?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS — evaluator ACTIVITY ASSESSMENT NOTE should resolve false positive on urgency-triage language',
    expectedOutcomes: ['PASS'],
  },
  {
    id: 'FU-01',
    label: 'APC interview coaching — diagonal cracking',
    question: "You said I shouldn't diagnose from crack patterns alone — but RICS assessors will definitely ask me what diagonal cracking means. How do I answer that in the interview without looking like I don't know my subject?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    expected: 'PASS — corrected system prompt should guide mechanism knowledge cause-first; model answer qualification preserved',
    expectedOutcomes: ['PASS'],
  },
];

// ── SYNTHETIC FIXTURES (inline — test specific cases only) ───────────────────
const SYNTHETIC_TESTS = [
  {
    id: 'D',
    label: 'Defensible response — safety first, observation/diagnosis distinction (must PASS)',
    expected: 'PASS',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`Before anything else, consider whether there's an immediate safety concern — visible distortion, falling masonry, signs the structure may be unstable. Not every crack is an emergency, but that assessment should come first.

From there, you need to understand what you're working with. Ask the client when the cracking first appeared and whether it seems to be getting worse — an active crack requires a different approach from a stable one that hasn't changed in years. Note the building's age and construction type, and whether there's any relevant history: previous surveys, drainage problems, adjacent tree cover, recent building work nearby.

When you inspect, your task is to observe and record — the pattern, location, width, distribution — not to diagnose the cause from the pattern alone. Crack patterns can direct your investigation, but they cannot tell you definitively what has caused the movement. That requires investigation.

Depending on what you find, the next step might range from monitoring (appropriate only where the cracking is clearly stable and there are no risk indicators) through to specialist structural involvement. The right approach depends on the evidence in front of you.

What does the cracking look like — is it concentrated in one area, or distributed more widely?`
  },
  {
    id: 'A2',
    label: 'Unsupported diagnosis — "will tell you whether you\'re looking at" (must REVISE)',
    expected: 'REVISE',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The most important thing to establish first is **pattern and location** — whether the cracks are random, follow mortar joints, run diagonally, or appear at corners and openings. This will tell you whether you're looking at structural movement, drying shrinkage, thermal effects or something more serious. Before you make any observations, ask the client how long the cracks have been there and whether they've noticed any change — stable cracks behave very differently from active ones.

From there, your approach depends on what the pattern suggests. Diagonal stepped cracking through bricks and mortar typically indicates structural loading or settlement; cracks confined to mortar joints with no brick fracture often point to mortar deterioration or minor thermal movement; cracks radiating from window corners usually suggest stress concentration around openings. You'll also want to know the building's age and construction type — a 1960s cavity wall will move differently from a 1820s solid brick structure.

Your investigation should include the inside face of the wall if accessible — internal cracking or damp, staining or blown plaster will help you understand whether this is a surface issue or whether movement has tracked through the full thickness of the wall.

Depending on what you find, you may need to consider crack monitoring, further structural investigation, or referral to a structural engineer. Document everything photographically and with crack-width measurements.

What is the approximate age of the building, and has the client noticed any recent change in the cracking?`
  },
  {
    id: 'B',
    label: 'Premature monitoring — monitoring as first step (must REVISE)',
    expected: 'REVISE',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The first step is to record the crack widths and pattern carefully. Cracks under 0.3mm are generally cosmetic; widths between 0.3mm and 1mm may indicate minor movement; cracks over 5mm are more significant and warrant closer attention.

I would recommend setting up monitoring points using tell-tales across the main cracks. Check these monthly over a six-month period to establish whether movement is ongoing or the cracking is stable. Once you have movement data, you can make a more informed judgment about whether investigation or remediation is needed.

The pattern of cracking will also give you initial clues — diagonal stepped cracking through brickwork is typically associated with differential settlement, while horizontal cracking at damp proof course level often indicates mortar deterioration or sulphate attack.

Once the monitoring period is complete, you can advise the client whether specialist structural investigation is warranted.`
  },
  {
    id: 'C',
    label: 'Safety omission — lintel distortion, no safety assessment first (must REVISE)',
    expected: 'REVISE',
    question: 'A client has just called to report severe cracking to the external brickwork with visible distortion to the lintel above the main entrance. What should I consider?',
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`This warrants thorough investigation. The first step is to inspect and document the cracking in detail — photograph the pattern, measure crack widths, and note the distribution across the wall before anything changes.

The distortion around the lintel could indicate a number of things — differential settlement, lintel deflection, or possible cavity wall tie failure in that zone. Your investigation should include the internal face of the wall if accessible, checking for signs of movement or stress distribution across the structure.

Gather relevant background information before commissioning a structural assessment — the building's age and construction type, any history of previous surveys, drainage issues, or significant tree cover nearby. Once you have that picture, instruct a structural engineer for a full assessment of the lintel condition and any associated structural implications.

Is this a residential or commercial building? That will affect the scope of specialist assessment you commission.`
  },
  {
    id: 'E',
    label: 'Mechanism descriptions — all cause→pattern Type B (must PASS)',
    expected: 'PASS',
    question: 'Can you explain the main causes of external brickwork cracking in detail, including the relevant investigations for each?',
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`External brickwork cracking has several distinct mechanisms and understanding which may be operating requires both observation and targeted investigation.

**Differential settlement** — unequal movement in the ground or foundations — typically produces diagonal cracking, often stepping through mortar joints. It can arise from shrinkable clay subsoil, tree root influence on soil moisture, inadequate foundations, or adjacent ground disturbance. Investigation includes ground investigation to examine soil type and foundation condition, a drain survey to check for leaking drains, and records of tree proximity and species.

**Cavity wall tie failure** — ties corroding, expanding, or detaching — typically produces horizontal cracking at regular intervals corresponding to tie spacing, most commonly every four to five courses. Most prevalent in buildings constructed between 1945 and 1980 with early galvanised ties. Investigation includes borescope survey or sample tie removal, followed by a structural engineer's assessment of the extent and remediation required.

**Sulphate attack** — chemical attack of Portland cement mortar by sulphates in certain brick types or ground conditions — causes horizontal cracking and sometimes bowing, typically in lower courses, often associated with persistent damp. Investigation includes mortar analysis and examination of the source of moisture.

**Thermal and moisture movement** — expansion and contraction with temperature and humidity changes — produces cracking at stress concentration points: corners, around openings, or in long runs without movement joints. Generally cosmetic, but context matters.

**Lintel failure or deflection** — deteriorating or deflecting lintels produce cracking radiating from opening corners. Investigation includes visual inspection, probe or borescope access to check lintel condition, and often structural assessment.

In every case, the pattern of cracking indicates which mechanisms are worth investigating — it does not confirm a diagnosis. That requires the full picture: pattern, activity, building type, age, and history.`
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 2 Final Targeted Test ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Corrections applied:');
  console.log('  ai-tutor.js: added "no most-likely cause" + "no building-age activity inference" + "cause-first interview coaching" to PROFESSIONAL STANDARDS');
  console.log('  qa-eval-harness-v3.mjs: added ACTIVITY ASSESSMENT NOTE to Step 3 (BS-06 false positive fix)');
  console.log('Not committed, pushed or deployed.');
  console.log('');

  // ── PHASE 1: Collect fresh Michael responses ──────────────────────────────
  console.log('=== PHASE 1: Michael Responses (corrected system prompt) ===');
  const regressionFixtures = [];

  for (const rq of REGRESSION_QUESTIONS) {
    process.stdout.write(`  [${rq.id}] `);
    try {
      const r = await callMichael(rq.question, rq.pathway);
      const trunc = isLikelyTruncated(r.text);
      regressionFixtures.push({ id: rq.id, label: rq.label, question: rq.question, pathway: rq.pathway, competency: rq.competency, sourceMaterial: null, response: r.text, expected: rq.expected, expectedOutcomes: rq.expectedOutcomes, michaelToks: r.outputTokens, michaelMs: r.elapsed, trunc });
      console.log(`${r.outputTokens}tok  ${r.elapsed}ms  ${trunc ? '[TRUNC]' : '[OK]'}  stop=end_turn`);
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      regressionFixtures.push({ id: rq.id, label: rq.label, question: rq.question, pathway: rq.pathway, competency: rq.competency, sourceMaterial: null, response: `[ERROR: ${e.message}]`, expected: rq.expected, expectedOutcomes: rq.expectedOutcomes, error: true });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== PHASE 1 RESPONSES (full text) ===');
  for (const f of regressionFixtures) {
    console.log(`\n--- ${f.id}: ${f.label} ---`);
    console.log(`Q: ${f.question}`);
    if (f.error) { console.log('[ERROR — no response]'); continue; }
    console.log(`Response (${f.michaelToks} tokens, truncated=${f.trunc}):`);
    console.log(f.response);
  }

  // ── PHASE 2: Evaluator runs ───────────────────────────────────────────────
  // Regression: BS-01 twice, BS-06 once, FU-01 once
  // Synthetic: D, A2, B, C, E
  console.log('\n=== PHASE 2: Evaluator (Sonnet v3 with ACTIVITY ASSESSMENT NOTE) ===');
  console.log('Evaluator: EVALUATOR_SYSTEM_V3 read live from qa-eval-harness-v3.mjs');
  console.log('');

  const evalResults = {};

  async function runEval(id, fixture, runLabel) {
    process.stdout.write(`  [${id} | ${runLabel}] `);
    try {
      const r = await callEvaluator(fixture);
      const outcome = r.parsed?.outcome ?? 'PARSE_ERR';
      const cost = (r.inputTokens * 3 + r.outputTokens * 15) / 1_000_000;
      evalResults[`${id}_${runLabel}`] = r;
      console.log(`${outcome.padEnd(24)} ${r.elapsed}ms  ${r.inputTokens}in/${r.outputTokens}out  $${cost.toFixed(5)}`);
      return r;
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      evalResults[`${id}_${runLabel}`] = { error: e.message };
      return null;
    }
  }

  // Regression
  console.log('--- Regression fixtures ---');
  for (const f of regressionFixtures) {
    if (!f.error) await runEval(f.id, f, 'R1');
    await new Promise(r => setTimeout(r, 600));
  }
  // BS-01 second run (consistency check)
  const bs01 = regressionFixtures.find(f => f.id === 'BS-01');
  if (bs01 && !bs01.error) {
    await new Promise(r => setTimeout(r, 600));
    await runEval('BS-01', bs01, 'R2');
  }

  // Synthetic
  console.log('\n--- Synthetic fixtures ---');
  for (const f of SYNTHETIC_TESTS) {
    await runEval(f.id, f, 'syn');
    await new Promise(r => setTimeout(r, 600));
  }

  // ── PHASE 3: Raw evaluator outputs ───────────────────────────────────────
  console.log('\n=== RAW EVALUATOR OUTPUTS ===');
  for (const [key, r] of Object.entries(evalResults)) {
    if (r?.error) continue;
    console.log(`\n[${key}]`);
    console.log(r.text);
    console.log('---');
  }

  // ── PHASE 4: Results table ────────────────────────────────────────────────
  console.log('\n=== RESULTS SUMMARY ===');
  console.log('');
  console.log('REGRESSION:');
  console.log('─────────────────────────────────────────────────────────────────────');

  for (const rq of REGRESSION_QUESTIONS) {
    const r1 = evalResults[`${rq.id}_R1`];
    const r2 = evalResults[`${rq.id}_R2`];
    const o1 = r1?.parsed?.outcome ?? (r1?.error ? 'ERR' : '?');
    const o2 = rq.id === 'BS-01' ? (r2?.parsed?.outcome ?? (r2?.error ? 'ERR' : '—')) : '—';
    const consistent = rq.id === 'BS-01' ? (o1 === o2 ? 'CONSISTENT' : 'INCONSISTENT ⚠') : '';
    const grade = rq.expectedOutcomes?.includes(o1) ? 'OK' : 'UNEXPECTED';
    console.log(`\n${rq.id}: ${rq.label}`);
    console.log(`  Expected: ${rq.expectedOutcomes?.join('/')}`);
    console.log(`  R1: ${o1}  ${rq.id === 'BS-01' ? `R2: ${o2}  ${consistent}` : ''}  → ${grade}`);
    if (r1?.parsed?.reasoning_failures?.length) {
      console.log('  Failures (R1):');
      for (const f of r1.parsed.reasoning_failures) {
        console.log(`    [${f.severity}] ${f.failure_type}: "${(f.quoted_text ?? '').slice(0, 80)}"`);
      }
    }
    if (r1?.parsed?.safety_screen?.finding) console.log(`  Safety: ${r1.parsed.safety_screen.finding}`);
    if (r1?.parsed?.outcome_basis) console.log(`  Basis: ${r1.parsed.outcome_basis}`);
  }

  console.log('\n\nSYNTHETIC FIXTURES:');
  console.log('─────────────────────────────────────────────────────────────────────');
  for (const f of SYNTHETIC_TESTS) {
    const r = evalResults[`${f.id}_syn`];
    const o = r?.parsed?.outcome ?? (r?.error ? 'ERR' : '?');
    const grade = o === f.expected ? `OK(${o})` : `UNEXPECTED(${o}, expected ${f.expected})`;
    console.log(`  ${f.id.padEnd(4)}: ${f.label.slice(0, 60).padEnd(62)} → ${grade}`);
    if (r?.parsed?.reasoning_failures?.length && o !== f.expected) {
      for (const fail of r.parsed.reasoning_failures) {
        console.log(`       [${fail.severity}] ${fail.failure_type}: "${(fail.quoted_text ?? '').slice(0, 60)}"`);
      }
    }
  }

  // ── Acceptance criteria ───────────────────────────────────────────────────
  console.log('\n\n=== ACCEPTANCE CRITERIA CHECK ===');
  const criteria = [
    { id: 1, text: 'Genuine unsupported diagnoses flagged', check: () => { const a2 = evalResults['A2_syn']?.parsed?.outcome; const b = evalResults['B_syn']?.parsed?.outcome; return a2 === 'REVISE' && b === 'REVISE'; } },
    { id: 2, text: 'Legitimate investigative hypotheses not rejected (Test D)', check: () => evalResults['D_syn']?.parsed?.outcome === 'PASS' },
    { id: 3, text: 'Appropriate technical explanations acceptable (Test E)', check: () => evalResults['E_syn']?.parsed?.outcome === 'PASS' },
    { id: 4, text: 'Safety omissions identified (Test C)', check: () => evalResults['C_syn']?.parsed?.outcome === 'REVISE' },
    { id: 5, text: 'BS-01 inconsistency resolved', check: () => { const o1 = evalResults['BS-01_R1']?.parsed?.outcome; const o2 = evalResults['BS-01_R2']?.parsed?.outcome; return o1 === 'PASS' && o2 === 'PASS'; } },
    { id: 6, text: 'Michael useful answers to BS-01, BS-06, FU-01', check: () => REGRESSION_QUESTIONS.every(rq => { const o = evalResults[`${rq.id}_R1`]?.parsed?.outcome; return rq.expectedOutcomes?.includes(o); }) },
    { id: 7, text: 'No new false positives on Test E (Type B/C mechanism descriptions)', check: () => evalResults['E_syn']?.parsed?.outcome === 'PASS' },
  ];

  let allMet = true;
  for (const c of criteria) {
    let met;
    try { met = c.check(); } catch (_) { met = false; }
    const icon = met ? '✓' : '✗';
    console.log(`  ${icon} ${c.id}. ${c.text}`);
    if (!met) allMet = false;
  }
  console.log('');
  console.log(allMet ? '  All acceptance criteria met.' : '  One or more criteria not met — see failures above.');

  console.log('\n=== END ===');
  console.log('Development only. Not committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
