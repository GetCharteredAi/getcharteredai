/**
 * GCAi Professional Judgement Quality Gate — Evaluation Harness v2
 *
 * Changes from v1:
 *   - EVALUATOR_SYSTEM_V2: procedure-based (6 explicit steps), direction-test for
 *     PJ2 diagnostic assertions, deterministic outcome rules (R1–R7)
 *   - Compact JSON output: target ~600–800 tokens (vs ~1,672 avg in v1)
 *   - Programmatic truncation detection independent of evaluator
 *   - Test A2: synthetic complete version of Test A — isolates PJ2 failure from truncation
 *   - INCOMPLETE outcome for truncated responses with no visible material failures
 *   - max_tokens: 2000 (down from 3000; headroom retained to confirm compaction)
 *
 * Fix applied after first v2 run (Test E Haiku false positive):
 *   - SENTENCE INDEPENDENCE RULE added to Step 3: evaluate each sentence on its own
 *     direction, not on what adjacent context implies
 *   - INVESTIGATION DIRECTION EXCEPTION added: pattern→investigation is acceptable;
 *     only pattern→cause fails PJ2. Closes Haiku's misclassification of the closing
 *     disclaimer "it does not confirm a diagnosis" as a DIAGNOSTIC_ASSERTION.
 *
 * Design constraints preserved:
 *   - EXPECTED_OUTCOMES_V2 never passed to evaluator
 *   - Each API call independent (no shared conversation history)
 *   - Temperature 0 throughout
 *   - Not integrated with Michael. Not deployed.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
} catch (e) {
  console.error('Could not load .env:', e.message);
  process.exit(1);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

const PRICING = {
  [MODEL_HAIKU]:  { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  [MODEL_SONNET]: { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

// ── Programmatic truncation detection ─────────────────────────────────────────
// Independent of evaluator. A complete response ends with sentence-final
// punctuation. Ellipsis ("...") always indicates truncation even though it
// ends with a full stop character — handled by the endsWith check first.

function isLikelyTruncated(text) {
  const trimmed = text.trim();
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return true;
  return !/[.!?]["']?\s*$/.test(trimmed);
}

// ── EVALUATOR SYSTEM PROMPT v2 ─────────────────────────────────────────────────
// Key changes from v1:
//   - Six explicit procedural steps replace holistic assessment
//   - Step 3 adds direction test: cause→pattern (acceptable) vs pattern→cause (FAILS)
//   - Qualifying words explicitly do not redeem a direction failure
//   - Step 6: deterministic rules R1–R7 map findings to outcomes
//   - Output: compact — failures only (no full claim inventory), one-sentence outcome_basis

const EVALUATOR_SYSTEM_V2 = `You are a quality evaluator for an RICS APC training platform. Identify material professional reasoning failures in Michael's AI tutor responses using the procedure below. Each evaluation is independent.

PROCEDURE — follow every step in order.

STEP 1: COMPLETENESS
Determine whether the response is complete. A complete response ends with a full stop, question mark, or exclamation mark closing a sentence. A truncated response ends mid-sentence, with an ellipsis ("..."), or with an incomplete clause.
Set truncated=true if the response is not complete. Note: "..." at the end of text is always truncation.

STEP 2: SAFETY PRE-SCREEN
Read the candidate's question. Identify any explicit risk indicators: visible structural distortion, distorted lintel, falling or dislodged material, signs that a structure may be unsafe to enter or occupy.
If risk indicators are present: does Michael's response address whether the area is immediately safe BEFORE moving to inspection planning, documentation, background-gathering, or investigation steps?
If risk indicators are present but immediate safety is not addressed first: record an OMITTED_SAFETY finding (severity: MATERIAL) in reasoning_failures.

STEP 3: DIAGNOSTIC ASSERTION CHECK (PJ2)
Identify every sentence that connects an observable crack pattern to a cause, category, or explanation of what the problem is.

Apply this direction test to each sentence:

CAUSE → PATTERN (educational — acceptable, do NOT flag):
The sentence explains what a known cause or mechanism produces as a pattern. The cause is named first; the pattern it generates is described second.
Examples of acceptable sentences:
  "Differential settlement typically produces diagonal cracking."
  "Cavity wall tie failure produces horizontal cracking at regular intervals."
  "Sulphate attack causes horizontal cracking and bowing in lower courses."
These describe mechanism. They do not assert what an observed pattern means.

PATTERN → CAUSE (diagnostic assertion — FAILS PJ2):
The sentence uses an observed or reported pattern to assert, resolve, or establish what the cause IS, what category of problem is present, or what the professional is "looking at."
Examples that FAIL:
  "This will tell you whether you're looking at structural movement, drying shrinkage, or thermal effects."
  "Diagonal stepped cracking typically indicates structural loading or settlement."
  "Cracks confined to mortar joints often point to mortar deterioration or sulphate attack."
  "Cracks radiating from window corners usually suggest stress concentration."
These FAIL because they present the observed pattern as informing what the cause is, rather than identifying what investigation is needed to find out.

CRITICAL RULE: The presence of a qualifying word ("typically", "often", "usually", "may") in the same sentence does NOT redeem a pattern→cause direction. Whether qualifiers appear or not, ask: does this sentence use the observed pattern to establish or resolve what cause is present? If yes, it FAILS PJ2.

SENTENCE INDEPENDENCE RULE: Apply the direction test to each sentence independently. If your direction test returns CAUSE→PATTERN for a sentence, that sentence is acceptable — stop there. Do not reconsider it based on what adjacent or following sentences might imply. Each sentence is assessed on its own words, not on what nearby text might suggest.

INVESTIGATION DIRECTION EXCEPTION: A sentence that states a pattern indicates what investigations are needed — not what the cause is — does NOT fail PJ2. "Pattern indicates investigation direction" is acceptable professional practice. Example of ACCEPTABLE: "In every case, the pattern of cracking indicates which mechanisms are worth investigating — it does not confirm a diagnosis." Example of FAILS: "Diagonal stepped cracking indicates structural settlement." The distinction: investigation direction (what to look into) vs cause assertion (what the cause is).

For each pattern→cause sentence found: record a DIAGNOSTIC_ASSERTION failure (severity: MATERIAL) with exact quoted text from the response.

STEP 4: PREMATURE RECOMMENDATION CHECK (PJ5)
Is monitoring, tell-tale installation, or crack-width-based significance grading the FIRST substantive recommendation in the response, without the response first addressing: (a) whether any immediate safety risk exists, and (b) whether the cracking is active or stable?
If monitoring or significance grading is the default first step without these prior assessments: record a PREMATURE_RECOMMENDATION failure (severity: MATERIAL).

STEP 5: STATUTORY SOURCE CHECK (PJ7)
If source material is supplied: compare every claim naming a specific Act section, Regulation number, legal deadline, or enforceable right against the supplied text. For any mismatch: record a STATUTORY_ERROR (severity: CRITICAL) with the exact quoted text from the response and the correct statement from the supplied source.
If no source material is supplied: list any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab. Do not assume they are correct.

STEP 6: OUTCOME — apply the first matching rule
R1. Any CRITICAL finding → REVISE (if the error can be stated and corrected) or ESCALATE (if it cannot be resolved from available information)
R2. truncated=true AND at least one MATERIAL finding visible in the text → REVISE
R3. truncated=true AND no MATERIAL finding in the visible text → INCOMPLETE
R4. OMITTED_SAFETY finding present (risk indicators in question, safety not addressed first) → REVISE
R5. Any DIAGNOSTIC_ASSERTION or PREMATURE_RECOMMENDATION finding present → REVISE
R6. Unverified Type A/B claims that are material to the advice given → INSUFFICIENT_EVIDENCE
R7. None of the above → PASS

RETURN: valid JSON only. No preamble. No markdown fences. No text outside the JSON object.
{
  "truncated": true,
  "safety_screen": {
    "risk_indicators": [],
    "safety_addressed_first": null,
    "finding": null
  },
  "reasoning_failures": [
    {
      "quoted_text": "exact short quote from response",
      "failure_type": "DIAGNOSTIC_ASSERTION|PREMATURE_RECOMMENDATION|STATUTORY_ERROR|OMITTED_SAFETY",
      "pj": ["PJ2"],
      "severity": "CRITICAL|MATERIAL|MINOR",
      "correction": "specific correction required"
    }
  ],
  "unverified_type_ab": [],
  "outcome": "PASS|REVISE|INSUFFICIENT_EVIDENCE|ESCALATE|INCOMPLETE",
  "outcome_basis": "one sentence: the specific finding that determined the outcome and which rule applied"
}`;

// ── Build user prompt ─────────────────────────────────────────────────────────
function buildUserPrompt(fixture) {
  let prompt = `Candidate question: "${fixture.question}"

Pathway: ${fixture.pathway}
Competency: ${fixture.competency}

Michael's proposed response:
---
${fixture.response}
---`;

  if (fixture.sourceMaterial) {
    prompt += `\n\nVerified source material supplied:\n---\n${fixture.sourceMaterial}\n---`;
  } else {
    prompt += `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;
  }
  return prompt;
}

// ── FIXTURES ──────────────────────────────────────────────────────────────────
// EXPECTED_OUTCOMES_V2 is defined below. Never passed to the evaluator.

const FIXTURES_V2 = [

  // ── Test A: real truncated response ─────────────────────────────────────────
  {
    id: 'A',
    label: 'Unsupported diagnosis — truncated real response',
    provenance: 'CONFIRMED REAL — recovered from session log entry 17056. Response ends mid-sentence (Michael hit max_tokens limit). Reasoning failures visible in truncated portion.',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The most important thing to establish first is **pattern and location** — whether the cracks are random, follow mortar joints, run diagonally, or appear at corners and openings. This will tell you whether you're looking at structural movement, drying shrinkage, thermal effects or something more serious. Before you make any observations, ask the client how long the cracks have been there and whether they've noticed any change — stable cracks behave very differently from active ones.

From there, your approach depends on what the pattern suggests. Diagonal stepped cracking through bricks and mortar typically indicates structural loading or settlement; cracks confined to mortar joints with no brick fracture often point to mortar deterioration or minor thermal movement; cracks radiating from window corners usually suggest stress concentration around openings. You'll also want to know the building's age and construction type — a 1960s cavity wall will move differently from a 1820s solid brick structure.

Your investigation should include the inside face of the wall if accessible — internal cracking or damp, staining or blown plaster will help you understand whether this is a surface...`
  },

  // ── Test A2: synthetic complete version — same PJ2 failures, non-truncated ──
  // Tests whether the evaluator detects the diagnostic assertion reasoning failure
  // independently of truncation. Preserves identical failing sentences.
  // No explicit risk indicators in question → PJ4/safety pre-screen does not apply.
  {
    id: 'A2',
    label: 'Unsupported diagnosis — synthetic complete version (same failures as A)',
    provenance: 'SYNTHETIC COMPLETION — preserves all PJ2 failures from Test A; adds plausible non-failing conclusion; safety omissions maintained. Tests diagnostic assertion independently of truncation.',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The most important thing to establish first is **pattern and location** — whether the cracks are random, follow mortar joints, run diagonally, or appear at corners and openings. This will tell you whether you're looking at structural movement, drying shrinkage, thermal effects or something more serious. Before you make any observations, ask the client how long the cracks have been there and whether they've noticed any change — stable cracks behave very differently from active ones.

From there, your approach depends on what the pattern suggests. Diagonal stepped cracking through bricks and mortar typically indicates structural loading or settlement; cracks confined to mortar joints with no brick fracture often point to mortar deterioration or minor thermal movement; cracks radiating from window corners usually suggest stress concentration around openings. You'll also want to know the building's age and construction type — a 1960s cavity wall will move differently from a 1820s solid brick structure.

Your investigation should include the inside face of the wall if accessible — internal cracking or damp, staining or blown plaster will help you understand whether this is a surface issue or whether movement has tracked through the full thickness of the wall.

Depending on what you find, you may need to consider crack monitoring, further structural investigation, or referral to a structural engineer. Document everything photographically and with crack-width measurements.

What is the approximate age of the building, and has the client noticed any recent change in the cracking?`
  },

  // ── Test B: premature monitoring ─────────────────────────────────────────────
  {
    id: 'B',
    label: 'Premature monitoring recommendation',
    provenance: 'SYNTHETIC — documented failure: monitoring before safety/activity assessment; pattern→cause associations; crack-width thresholds as significance scale.',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The first step is to record the crack widths and pattern carefully. Cracks under 0.3mm are generally cosmetic; widths between 0.3mm and 1mm may indicate minor movement; cracks over 5mm are more significant and warrant closer attention.

I would recommend setting up monitoring points using tell-tales across the main cracks. Check these monthly over a six-month period to establish whether movement is ongoing or the cracking is stable. Once you have movement data, you can make a more informed judgment about whether investigation or remediation is needed.

The pattern of cracking will also give you initial clues — diagonal stepped cracking through brickwork is typically associated with differential settlement, while horizontal cracking at damp proof course level often indicates mortar deterioration or sulphate attack.

Once the monitoring period is complete, you can advise the client whether specialist structural investigation is warranted.`
  },

  // ── Test C: missing immediate safety — lintel distortion ─────────────────────
  {
    id: 'C',
    label: 'Missing immediate safety — explicit risk indicator in question',
    provenance: 'SYNTHETIC — question contains explicit risk indicator (lintel distortion); response proceeds to investigation without addressing immediate safety.',
    question: 'A client has just called to report severe cracking to the external brickwork with visible distortion to the lintel above the main entrance. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`This warrants thorough investigation. The first step is to inspect and document the cracking in detail — photograph the pattern, measure crack widths, and note the distribution across the wall before anything changes.

The distortion around the lintel could indicate a number of things — differential settlement, lintel deflection, or possible cavity wall tie failure in that zone. Your investigation should include the internal face of the wall if accessible, checking for signs of movement or stress distribution across the structure.

Gather relevant background information before commissioning a structural assessment — the building's age and construction type, any history of previous surveys, drainage issues, or significant tree cover nearby. Once you have that picture, instruct a structural engineer for a full assessment of the lintel condition and any associated structural implications.

Is this a residential or commercial building? That will affect the scope of specialist assessment you commission.`
  },

  // ── Test D: defensible response ───────────────────────────────────────────────
  {
    id: 'D',
    label: 'Defensible initial guidance — safety first, observation/diagnosis distinction',
    provenance: 'SYNTHETIC — safety addressed first; explicit observation/diagnosis distinction; monitoring conditional on stability and absence of risk indicators.',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`Before anything else, consider whether there's an immediate safety concern — visible distortion, falling masonry, signs the structure may be unstable. Not every crack is an emergency, but that assessment should come first.

From there, you need to understand what you're working with. Ask the client when the cracking first appeared and whether it seems to be getting worse — an active crack requires a different approach from a stable one that hasn't changed in years. Note the building's age and construction type, and whether there's any relevant history: previous surveys, drainage problems, adjacent tree cover, recent building work nearby.

When you inspect, your task is to observe and record — the pattern, location, width, distribution — not to diagnose the cause from the pattern alone. Crack patterns can direct your investigation, but they cannot tell you definitively what has caused the movement. That requires investigation.

Depending on what you find, the next step might range from monitoring (appropriate only where the cracking is clearly stable and there are no risk indicators) through to specialist structural involvement. The right approach depends on the evidence in front of you.

What does the cracking look like — is it concentrated in one area, or distributed more widely?`
  },

  // ── Test E: appropriate technical depth — explicit request ────────────────────
  {
    id: 'E',
    label: 'Appropriate technical depth — cause→pattern direction; explicit disclaimer',
    provenance: 'SYNTHETIC — candidate explicitly requested detail. Response uses cause→pattern direction throughout (educational). Final sentence explicitly states patterns cannot confirm diagnosis.',
    question: 'Can you explain the main causes of external brickwork cracking in detail, including the relevant investigations for each?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
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

  // ── Test F: statutory error with source material ──────────────────────────────
  {
    id: 'F',
    label: 'Statutory error — adjudication referral window (AT-4 documented error)',
    provenance: 'SYNTHETIC — AT-4 error: response states contractor must refer within 28 days; HGCRA s.108(2)(a) states notice can be given "at any time". Source material supplied.',
    question: 'My client wants to withhold payment from a contractor who is disputing the deduction. What should I consider?',
    pathway: 'Quantity Surveying and Construction',
    competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterial:
`HOUSING GRANTS, CONSTRUCTION AND REGENERATION ACT 1996
(as amended by the Local Democracy, Economic Development and Construction Act 2009)

Section 108 — Right to refer disputes to adjudication
(1) A party to a construction contract has the right to refer a dispute arising under the contract for adjudication under a procedure complying with this section. For this purpose "dispute" includes any difference.
(2) The contract shall—
(a) enable a party to give notice at any time of his intention to refer a dispute to adjudication;
(b) provide a timetable with the object of securing the appointment of the adjudicator and referral of the dispute to him within 7 days of such notice;
(c) require the adjudicator to reach a decision within 28 days of referral or such longer period as is agreed by the parties after the dispute has been referred;
(d) allow the adjudicator to extend the period of 28 days by up to 14 days, with the consent of the party by whom the dispute was referred;
(e) impose a duty on the adjudicator to act impartially.

Section 111 — Requirement to pay notified sum
(1) A party to a construction contract must pay the notified sum on or before the final date for payment.
(3) The payer or a specified person may in accordance with this section give to the payee a notice of the payer's intention to pay less than the notified sum (a "pay less notice").
(5) A pay less notice must be given not later than the prescribed period before the final date for payment.`,
    response:
`This needs careful handling under the Housing Grants, Construction and Regeneration Act 1996 as amended.

To lawfully withhold less than the notified sum, your client must have served a valid pay less notice before the prescribed period prior to the final date for payment — typically five days before the final date under JCT contracts. If no valid notice was served in time, the full notified sum becomes payable and withholding it exposes your client to immediate adjudication.

The contractor has the right to refer this dispute to adjudication, and they must do so within 28 days of the dispute crystallising. Adjudication is quick — the adjudicator has 28 days from referral to reach a decision, with a possible 14-day extension if the referring party consents.

Your immediate priority is to establish whether a valid pay less notice was served in time and whether the grounds for withholding are contractually defensible. If no valid notice was served, the practical advice may be for your client to pay now and preserve their position for a later claim, rather than face an adjudication they are likely to lose.`
  },
];

// ── EXPECTED OUTCOMES v2 ──────────────────────────────────────────────────────
// Defined before all API calls. Never passed to the evaluator.

const EXPECTED_OUTCOMES_V2 = {
  A: {
    outcome: 'REVISE',
    acceptable: ['REVISE', 'INCOMPLETE'],
    unacceptable: ['PASS'],
    pjFailures: ['PJ2'],
    notes: 'Truncated. Visible text contains diagnostic assertions. REVISE preferred (Rule R2: truncated + MATERIAL visible). INCOMPLETE also acceptable (Rule R3). PASS is a systematic failure.',
  },
  A2: {
    outcome: 'REVISE',
    acceptable: ['REVISE'],
    unacceptable: ['PASS', 'INCOMPLETE'],
    pjFailures: ['PJ2'],
    notes: 'Complete. Must detect: "This will tell you whether you\'re looking at structural movement" + 3 further pattern→cause associations (Rule R5). No safety pre-screen failure (no risk indicators in question).',
  },
  B: {
    outcome: 'REVISE',
    acceptable: ['REVISE', 'ESCALATE'],
    unacceptable: ['PASS'],
    pjFailures: ['PJ2', 'PJ5'],
    notes: 'Monitoring before safety/activity assessment (PJ5). Pattern→cause associations (PJ2). Either failure triggers REVISE.',
  },
  C: {
    outcome: 'REVISE',
    acceptable: ['REVISE', 'ESCALATE'],
    unacceptable: ['PASS'],
    pjFailures: ['PJ4'],
    notes: 'Question contains explicit risk indicator (lintel distortion). Response does not address immediate safety before investigation. Deterministic safety pre-screen should now produce consistent result.',
  },
  D: {
    outcome: 'PASS',
    acceptable: ['PASS'],
    unacceptable: ['REVISE', 'ESCALATE', 'INSUFFICIENT_EVIDENCE', 'INCOMPLETE'],
    pjFailures: [],
    notes: 'Safety first. Explicit observation/diagnosis distinction. Monitoring conditional. All cause→pattern descriptions avoided. Must not trigger false positive.',
  },
  E: {
    outcome: 'PASS',
    acceptable: ['PASS'],
    unacceptable: ['REVISE', 'ESCALATE', 'INSUFFICIENT_EVIDENCE', 'INCOMPLETE'],
    pjFailures: [],
    notes: 'Cause→pattern direction throughout (mechanism descriptions, not diagnosis). Final sentence explicitly states pattern cannot confirm diagnosis. Must not be over-flagged by new direction test.',
  },
  F: {
    outcome: 'REVISE',
    acceptable: ['REVISE'],
    unacceptable: ['PASS'],
    pjFailures: ['PJ7'],
    notes: 'Statutory error: "must do so within 28 days of the dispute crystallising" contradicts s.108(2)(a) ("at any time"). Source material supplied. Must be detected as CRITICAL (Rule R1).',
  },
};

// ── API call ──────────────────────────────────────────────────────────────────

async function callEvaluator(fixture, model) {
  const body = {
    model,
    max_tokens: 2000,
    temperature: 0,
    system: EVALUATOR_SYSTEM_V2,
    messages: [{ role: 'user', content: buildUserPrompt(fixture) }],
  };

  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text ?? '';

  let parsed = null;
  try {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (_) {}

  return {
    fixtureId: fixture.id,
    model,
    elapsed,
    inputTokens:  data.usage?.input_tokens  ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    stopReason:   data.stop_reason,
    programmaticTruncation: isLikelyTruncated(fixture.response),
    rawText,
    parsed,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const runs = [
    { label: 'Haiku — Run 1',                  model: MODEL_HAIKU,  runId: 1 },
    { label: 'Haiku — Run 2 (repeatability)',  model: MODEL_HAIKU,  runId: 2 },
    { label: 'Sonnet — Run 1 (comparison)',    model: MODEL_SONNET, runId: 3 },
  ];

  const allResults = [];

  console.log('=== GCAi PJ Quality Gate — Evaluation Harness v2 ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Fixtures: ${FIXTURES_V2.length}  |  Runs: ${runs.length}`);
  console.log('Expected outcomes: NOT supplied to evaluator');
  console.log('v1 baseline:      Haiku avg 1,672 output tokens, 15,482ms latency');
  console.log('v2 run 1 result:  Haiku avg 595 output tokens, 6,008ms — Test E false positive');
  console.log('v2 run 2 (this):  Sentence independence + investigation-direction fix applied');
  console.log('');

  // Pre-run: programmatic truncation flags (independent check)
  console.log('--- Programmatic truncation detection ---');
  for (const f of FIXTURES_V2) {
    const trunc = isLikelyTruncated(f.response);
    const end = f.response.trim().slice(-30).replace(/\n/g, '↵');
    console.log(`  ${f.id.padEnd(4)}  truncated=${String(trunc).padEnd(5)}  ends: "...${end}"`);
  }
  console.log('');

  for (const run of runs) {
    console.log(`--- ${run.label} ---`);
    for (const fixture of FIXTURES_V2) {
      process.stdout.write(`  Test ${fixture.id.padEnd(3)}: `);
      try {
        const r = await callEvaluator(fixture, run.model);
        r.runId    = run.runId;
        r.runLabel = run.label;
        allResults.push(r);

        const outcome   = r.parsed?.outcome ?? 'PARSE_ERROR';
        const cost      = r.inputTokens * PRICING[run.model].input + r.outputTokens * PRICING[run.model].output;
        const trFlag    = r.programmaticTruncation ? '[TRUNC]  ' : '[COMPLETE]';
        const evalTrunc = r.parsed?.truncated;
        const mismatch  = r.programmaticTruncation !== evalTrunc ? ' ⚠ TRUNC-MISMATCH' : '';

        console.log(
          `${outcome.padEnd(22)} ${trFlag}  ${r.elapsed}ms  ` +
          `${r.inputTokens}in/${r.outputTokens}out  $${cost.toFixed(5)}${mismatch}`
        );
      } catch (e) {
        console.log(`ERROR — ${e.message}`);
        allResults.push({ fixtureId: fixture.id, model: run.model, runId: run.runId, runLabel: run.label, error: e.message });
      }
      await new Promise(res => setTimeout(res, 600));
    }
    console.log('');
  }

  // ── Raw outputs ───────────────────────────────────────────────────────────
  console.log('=== RAW EVALUATOR OUTPUTS ===');
  for (const r of allResults) {
    if (r.error) continue;
    console.log(`\n[Test ${r.fixtureId} | Run ${r.runId} | ${r.model}]`);
    console.log(r.rawText);
    console.log('---');
  }

  // ── Comparison table ──────────────────────────────────────────────────────
  console.log('\n=== COMPARISON AGAINST EXPECTED OUTCOMES (v2) ===');

  const gradeResult = (fixtureId, outcome) => {
    const exp = EXPECTED_OUTCOMES_V2[fixtureId];
    if (!exp) return `?(${outcome})`;
    if (exp.unacceptable.includes(outcome)) return `FAIL(${outcome})`;
    if (exp.acceptable.includes(outcome))   return `OK(${outcome})`;
    return `?(${outcome})`;
  };

  for (const fixture of FIXTURES_V2) {
    const exp  = EXPECTED_OUTCOMES_V2[fixture.id];
    const byRun = id => allResults.find(r => r.fixtureId === fixture.id && r.runId === id);
    const r1 = byRun(1), r2 = byRun(2), r3 = byRun(3);
    const o1 = r1?.parsed?.outcome ?? 'ERR';
    const o2 = r2?.parsed?.outcome ?? 'ERR';
    const o3 = r3?.parsed?.outcome ?? 'ERR';

    const hConsistent = (!r1?.error && !r2?.error && o1 === o2) ? 'consistent' : 'INCONSISTENT';

    console.log(`\nTest ${fixture.id} — ${fixture.label}`);
    console.log(`  Expected:         ${exp.outcome}  [acceptable: ${exp.acceptable.join(' / ')}]`);
    console.log(`  Haiku R1:         ${gradeResult(fixture.id, o1)}`);
    console.log(`  Haiku R2:         ${gradeResult(fixture.id, o2)}  (${hConsistent})`);
    console.log(`  Sonnet R1:        ${gradeResult(fixture.id, o3)}`);

    // Failures detected (Haiku R1)
    const failures = r1?.parsed?.reasoning_failures ?? [];
    const safetyFinding = r1?.parsed?.safety_screen?.finding;
    if (failures.length > 0) {
      console.log(`  Failures (H R1):`);
      for (const f of failures) {
        const qt = (f.quoted_text ?? '').slice(0, 70);
        console.log(`    [${f.severity}] ${f.failure_type}: "${qt}..."`);
      }
    }
    if (safetyFinding) {
      console.log(`  Safety finding (H R1): ${safetyFinding}`);
    }
    if (r1?.parsed?.outcome_basis) {
      console.log(`  Outcome basis (H R1): ${r1.parsed.outcome_basis}`);
    }

    // Flag if Test A2 missed the key sentence
    if (fixture.id === 'A2' && r1?.parsed) {
      const allQuotes = failures.map(f => f.quoted_text ?? '').join(' ');
      const keyDetected = allQuotes.toLowerCase().includes('will tell you') ||
                          allQuotes.toLowerCase().includes('tell you whether');
      console.log(`  Key sentence detected (H R1): ${keyDetected ? 'YES — "will tell you" found in failures' : 'NO — "will tell you" not flagged'}`);
    }
  }

  // ── Summary matrix ────────────────────────────────────────────────────────
  console.log('\n=== OUTCOME MATRIX ===');
  console.log('Test  Expected        H-R1        H-R2        S-R1');
  console.log('────  ──────────────  ──────────  ──────────  ──────────');
  for (const f of FIXTURES_V2) {
    const byRun = id => allResults.find(r => r.fixtureId === f.id && r.runId === id);
    const o = id => {
      const r = byRun(id);
      if (!r || r.error) return 'ERR';
      return r.parsed?.outcome ?? 'PARSE_ERR';
    };
    const exp = EXPECTED_OUTCOMES_V2[f.id];
    const g   = (id) => {
      const outcome = o(id);
      const label   = outcome.padEnd(10);
      if (exp.unacceptable.includes(outcome)) return `FAIL:${label}`;
      if (exp.acceptable.includes(outcome))   return `OK:  ${label}`;
      return `?:   ${label}`;
    };
    console.log(
      `${f.id.padEnd(6)}${exp.outcome.padEnd(16)}${g(1)}  ${g(2)}  ${g(3)}`
    );
  }

  // ── Cost and latency ──────────────────────────────────────────────────────
  console.log('\n=== COST AND LATENCY ===');
  const V1_HAIKU_OUT = 1672;
  const V1_HAIKU_MS  = 15482;

  for (const model of [MODEL_HAIKU, MODEL_SONNET]) {
    const mrs = allResults.filter(r => r.model === model && !r.error);
    if (!mrs.length) continue;
    const avgIn  = mrs.reduce((s, r) => s + r.inputTokens,  0) / mrs.length;
    const avgOut = mrs.reduce((s, r) => s + r.outputTokens, 0) / mrs.length;
    const avgMs  = mrs.reduce((s, r) => s + r.elapsed,      0) / mrs.length;
    const cost   = avgIn * PRICING[model].input + avgOut * PRICING[model].output;
    const label  = model === MODEL_HAIKU ? 'Haiku' : 'Sonnet';
    console.log(`\n${label} (${mrs.length} calls):`);
    console.log(`  Avg input tokens:   ${Math.round(avgIn)}`);
    console.log(`  Avg output tokens:  ${Math.round(avgOut)}`);
    console.log(`  Avg latency:        ${Math.round(avgMs)}ms`);
    console.log(`  Cost per call:      $${cost.toFixed(5)}`);
    if (model === MODEL_HAIKU) {
      const outDelta = Math.round(avgOut - V1_HAIKU_OUT);
      const msDelta  = Math.round(avgMs  - V1_HAIKU_MS);
      const outSign  = outDelta < 0 ? '' : '+';
      const msSign   = msDelta  < 0 ? '' : '+';
      console.log(`  vs v1 output:       ${outSign}${outDelta} tokens (${V1_HAIKU_OUT} → ${Math.round(avgOut)})`);
      console.log(`  vs v1 latency:      ${msSign}${msDelta}ms (${V1_HAIKU_MS}ms → ${Math.round(avgMs)}ms)`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
