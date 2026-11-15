/**
 * GCAi Professional Judgement Quality Gate — Evaluation Harness v3
 *
 * Changes from v2:
 *   - EVALUATOR_SYSTEM_V3: replaces the rigid CAUSE→PATTERN / PATTERN→CAUSE direction
 *     test with a substantive evidence-to-conclusion standard
 *   - Three acceptable response types explicitly defined:
 *       Type A — investigative hypothesis (pattern + possible causes + investigation needed)
 *       Type B — mechanism description (cause→pattern educational, direction preserved)
 *       Type C — framework / pedagogical explanation (APC coaching about the standard itself)
 *   - PJ2 test: does the sentence CLOSE DOWN what the cause is (diagnostic assertion),
 *     or OPEN UP what to investigate (acceptable professional reasoning)?
 *   - Qualifying words alone ("typically", "often", "usually") do not rescue a
 *     closing-direction sentence; investigation-directed framing does
 *   - Regression fixtures: fresh Michael responses for BS-01, BS-02, BS-06, BS-08,
 *     FU-01 collected at runtime (panel config, temperature 0)
 *   - v1 (qa-eval-harness.mjs) and v2 (qa-eval-harness-v2.mjs) preserved intact
 *
 * Addressed v2 false positives:
 *   - BS-01 (investigation-framed approach): v2 flagged as REVISE; v3 should PASS
 *   - BS-06 (safety first + investigation framing): v2 flagged as REVISE; v3 should PASS
 *   - FU-01 (APC interview coaching — Type C framework): v2 flagged as REVISE; v3 should PASS
 *
 * v2 detection preserved:
 *   - Tests A, A2, B, C, D, E, F: expected outcomes identical to v2
 *   - "This will tell you whether you're looking at..." → still FAILS (closes down cause)
 *   - "typically indicates [cause]" → still FAILS (hedged conclusion is still a conclusion)
 *   - BS-02: pattern→cause assertions for horizontal cracking still detected if present
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
} catch (e) {
  console.error('Could not load .env:', e.message);
  process.exit(1);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

// ── Extract buildModuleSystemPrompt from ai-tutor.js ─────────────────────────
let buildModuleSystemPrompt;
try {
  const aiTutorPath   = resolve(__dirname, '../netlify/functions/ai-tutor.js');
  const aiTutorSource = readFileSync(aiTutorPath, 'utf8');
  const handlerIdx    = aiTutorSource.indexOf('exports.handler');
  const isolatedSrc   = (handlerIdx > 0 ? aiTutorSource.slice(0, handlerIdx) : aiTutorSource)
                        + '\nreturn buildModuleSystemPrompt;';
  const aiTutorRequire = createRequire(aiTutorPath);
  const fakeExports = {};
  const fakeModule  = { exports: fakeExports };
  const fn = new Function('require', 'exports', 'module', isolatedSrc);
  buildModuleSystemPrompt = fn(aiTutorRequire, fakeExports, fakeModule);
  console.log('[INIT] buildModuleSystemPrompt extracted from ai-tutor.js — OK');
} catch (e) {
  console.error('[INIT] Failed to extract buildModuleSystemPrompt:', e.message);
  process.exit(1);
}

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

const PRICING = {
  [MODEL_HAIKU]:  { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  [MODEL_SONNET]: { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

// ── Programmatic truncation detection ─────────────────────────────────────────
function isLikelyTruncated(text) {
  const trimmed = text.trim();
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return true;
  return !/[.!?]["']?\s*$/.test(trimmed);
}

// ── EVALUATOR SYSTEM PROMPT v3 ─────────────────────────────────────────────────
// Core change from v2: Step 3 replaces the grammatical direction test with a
// substantive evidence-to-conclusion standard. Three acceptable response types
// (A, B, C) are explicitly defined. The PJ2 test asks whether a sentence CLOSES
// DOWN what the cause is (diagnostic assertion) or OPENS UP what to investigate.

const EVALUATOR_SYSTEM_V3 = `You are a quality evaluator for an RICS APC training platform. Identify material professional reasoning failures in Michael's AI tutor responses using the procedure below. Each evaluation is independent.

PROCEDURE — follow every step in order.

STEP 1: COMPLETENESS
Determine whether the response is complete. A complete response ends with a full stop, question mark, or exclamation mark closing a sentence. A truncated response ends mid-sentence, with an ellipsis ("..."), or with an incomplete clause.
Set truncated=true if the response is not complete. Note: "..." at the end of text is always truncation.

STEP 2: SAFETY PRE-SCREEN
Read the candidate's question. Identify any explicit risk indicators: visible structural distortion, distorted lintel, falling or dislodged material, signs that a structure may be unsafe to enter or occupy.
If risk indicators are present: does Michael's response address whether the area is immediately safe BEFORE moving to inspection planning, documentation, background-gathering, or investigation steps?
If risk indicators are present but immediate safety is not addressed first: record an OMITTED_SAFETY finding (severity: MATERIAL) in reasoning_failures.

STEP 3: CERTAINTY AND EVIDENCE CHECK (PJ2)

The professional standard is not a grammatical sentence-direction rule. A surveyor may legitimately use observed patterns to identify possible causes and direct investigation. A response commits a professional reasoning failure under PJ2 when it:

(a) presents a cause or mechanism as ESTABLISHED or CONFIRMED before investigation — states with certainty what the cause is rather than what it may be
(b) describes a mechanism as CURRENTLY OCCURRING — as a present fact — before the cause has been established through investigation
(c) presents a single cause as the established explanation without naming plausible alternatives or directing toward investigation to confirm

─────────────────────────────────────────────
FAILS PJ2 — three distinct failure modes
─────────────────────────────────────────────

FAILURE MODE 1 — MECHANISM STATED AS CURRENT FACT
Describes what is physically happening before investigation has confirmed it. Not a hypothesis — a statement of present occurrence:
  "The lintel is sagging under load, and the masonry above is cracking as it follows that movement."
  "The wall is settling and pulling the masonry with it."
These present a mechanism as a confirmed current occurrence. They do not say the mechanism might be operating; they state that it is.

FAILURE MODE 2 — PATTERN RESOLVES CAUSE WITH CERTAINTY
States that the pattern closes down, confirms, or tells you what the cause is:
  "This will tell you whether you're looking at structural movement, drying shrinkage, thermal effects or something more serious."
  "This confirms the movement is due to sulphate attack."
The pattern is presented as establishing the answer rather than directing investigation.

FAILURE MODE 3 — SINGLE CAUSE AS ESTABLISHED ANSWER WITHOUT ALTERNATIVES
Names one cause as the explanation with no plausible alternatives named and no direction toward investigation to confirm:
  "The cause is differential settlement." [no alternatives; no investigation directed]

─────────────────────────────────────────────
ACCEPTABLE under PJ2
─────────────────────────────────────────────

Using observed patterns to identify possible causes is acceptable professional reasoning. Pattern-to-possible-cause associations — even using hedged language such as "often suggests", "typically associated with", "often reflects", "may indicate" — do NOT fail PJ2 provided the response does not then establish the cause with certainty or describe the mechanism as occurring:
  "This pattern often suggests lintel deflection or failure — investigation is needed to confirm."
  "Diagonal cracking in masonry often reflects shear stress, which can arise from several sources including differential settlement, lateral loading, or thermal restraint."
  "Diagonal stepped cracking is often associated with differential settlement — this warrants investigation."
  "A horizontal crack above the lintel is consistent with lintel deflection as one possible cause."
  "Cracks confined to mortar joints often point to mortar deterioration or minor thermal movement — investigation is required to confirm."

Describing what a known cause or mechanism produces (educational) is also acceptable:
  "Differential settlement typically produces diagonal stepped cracking."
  "Cavity wall tie failure produces horizontal cracking at regular intervals."
  "Shear stress — from differential settlement, lateral loading, or thermal restraint — can produce diagonal cracking."

Explaining the distinction between mechanism knowledge and site diagnosis (pedagogical) is acceptable:
  "Identifying possible causes from observed patterns is different from confirming a diagnosis — investigation is required to confirm."

─────────────────────────────────────────────
HOW TO APPLY THE TEST
─────────────────────────────────────────────
Ask: does this sentence state that the cause IS or IS HAPPENING — or does it say the cause MIGHT BE and should be investigated?
  "often suggests lintel deflection or failure" → POSSIBLE CAUSE → ACCEPTABLE
  "the lintel is sagging under load" → STATES IT IS HAPPENING → FAILS (Failure Mode 1)
  "will tell you whether you're looking at structural movement" → PATTERN RESOLVES CAUSE → FAILS (Failure Mode 2)
  "diagonal cracking often reflects shear stress — which can arise from several sources" → POSSIBLE MECHANISM, MULTIPLE ALTERNATIVES → ACCEPTABLE

Where a sentence contains both an acceptable hypothesis and a failing mechanism-as-fact clause, identify the specific failing clause and quote it precisely.

─────────────────────────────────────────────
SENTENCE INDEPENDENCE: Apply the test to each sentence independently. Do not use surrounding context to reclassify a sentence. If content is acceptable under PJ2, do not flag it based on what adjacent text might imply.

ACTIVITY ASSESSMENT NOTE: A sentence that uses observations to assess whether a defect, cracking, or movement is active, stable, or still progressing — rather than to identify what cause is present — is NOT a diagnostic assertion. This informs urgency and escalation decisions (should I act now?), not cause identification. Example (ACCEPTABLE): "These observations help you assess whether the distortion is still progressing or appears stable and historical — the cause requires specialist investigation." Informal shorthand such as "stable historical settlement" used to mean "stable movement, no recent progression" in an urgency-assessment context is acceptable activity-framing, not cause identification. Distinguish: "tell you whether you're looking at structural movement or thermal effects" (cause categories — FAILS) vs. "tell you whether movement is active or stable" (activity status — ACCEPTABLE).
─────────────────────────────────────────────

For each PJ2 failure found: record a DIAGNOSTIC_ASSERTION failure (severity: MATERIAL) with exact quoted text — quoting only the failing clause if the failure is embedded in a longer sentence.

STEP 4: PREMATURE RECOMMENDATION CHECK (PJ5)
Is monitoring, tell-tale installation, or crack-width-based significance grading the FIRST substantive recommendation in the response, without the response first addressing: (a) whether any immediate safety risk exists, and (b) whether the cracking is active or stable?
If monitoring or significance grading is the default first step without these prior assessments: record a PREMATURE_RECOMMENDATION failure (severity: MATERIAL).

STEP 5: STATUTORY SOURCE CHECK (PJ7)
If source material is supplied: compare every claim naming a specific Act section, Regulation number, legal deadline, or enforceable right against the supplied text. For any mismatch: record a STATUTORY_ERROR (severity: CRITICAL) with the exact quoted text from the response and the correct statement from the supplied source.

OMISSION: A response that does not mention every verified provision is not automatically in error. Flag an omission as STATUTORY_ERROR only if the omission makes the actual answer to the candidate's question materially misleading or factually incorrect.

DISTINGUISHING MECHANISMS: Where source material covers multiple related statutory provisions, evaluate each claimed section against its specific description in the source. Do not flag as STATUTORY_ERROR a response that correctly names two distinct statutory mechanisms merely because they share a surface feature (e.g. both involve the same party giving a notice). The test is whether the response's claim about a specific section contradicts what that section says — not whether mechanisms that share a surface feature appear to overlap when read quickly.

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
  "truncated": false,
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

// ── SYNTHETIC FIXTURES — preserved from v2 (unchanged) ───────────────────────
// Same 7 fixtures. Expected outcomes are identical to v2.

const FIXTURES_SYNTHETIC = [

  // ── Test A: real truncated response ─────────────────────────────────────────
  {
    id: 'A',
    label: 'Unsupported diagnosis — truncated real response',
    provenance: 'CONFIRMED REAL — recovered from session log. Truncated (hit max_tokens). Visible text contains diagnostic assertions.',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The most important thing to establish first is **pattern and location** — whether the cracks are random, follow mortar joints, run diagonally, or appear at corners and openings. This will tell you whether you're looking at structural movement, drying shrinkage, thermal effects or something more serious. Before you make any observations, ask the client how long the cracks have been there and whether they've noticed any change — stable cracks behave very differently from active ones.

From there, your approach depends on what the pattern suggests. Diagonal stepped cracking through bricks and mortar typically indicates structural loading or settlement; cracks confined to mortar joints with no brick fracture often point to mortar deterioration or minor thermal movement; cracks radiating from window corners usually suggest stress concentration around openings. You'll also want to know the building's age and construction type — a 1960s cavity wall will move differently from a 1820s solid brick structure.

Your investigation should include the inside face of the wall if accessible — internal cracking or damp, staining or blown plaster will help you understand whether this is a surface...`
  },

  // ── Test A2: synthetic complete version ───────────────────────────────────────
  {
    id: 'A2',
    label: 'Unsupported diagnosis — synthetic complete version (same failures as A)',
    provenance: 'SYNTHETIC COMPLETION — preserves all PJ2 failures from Test A; adds plausible non-failing conclusion.',
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

  // ── Test B: premature monitoring ──────────────────────────────────────────────
  {
    id: 'B',
    label: 'Premature monitoring recommendation',
    provenance: 'SYNTHETIC — monitoring before safety/activity assessment; pattern→cause associations.',
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

  // ── Test C: missing immediate safety ─────────────────────────────────────────
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
    provenance: 'SYNTHETIC — safety addressed first; explicit observation/diagnosis distinction; monitoring conditional.',
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

  // ── Test E: appropriate technical depth ───────────────────────────────────────
  {
    id: 'E',
    label: 'Appropriate technical depth — cause→pattern direction; explicit disclaimer',
    provenance: 'SYNTHETIC — cause→pattern throughout (Type B). Final sentence states pattern cannot confirm diagnosis (Type C).',
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
    provenance: 'SYNTHETIC — response states contractor must refer within 28 days; HGCRA s.108(2)(a) states notice can be given "at any time".',
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

// ── EXPECTED OUTCOMES — SYNTHETIC FIXTURES (v3, identical to v2) ─────────────
const EXPECTED_OUTCOMES_SYNTHETIC = {
  A: {
    outcome: 'REVISE', acceptable: ['REVISE', 'INCOMPLETE'], unacceptable: ['PASS'],
    pjFailures: ['PJ2'],
    notes: 'Truncated. Visible text contains diagnostic assertions. REVISE preferred (R2: truncated + MATERIAL visible). INCOMPLETE acceptable (R3).',
  },
  A2: {
    outcome: 'REVISE', acceptable: ['REVISE'], unacceptable: ['PASS', 'INCOMPLETE'],
    pjFailures: ['PJ2'],
    notes: 'Must detect: "This will tell you whether you\'re looking at structural movement" and further closing-direction sentences. No safety indicator.',
  },
  B: {
    outcome: 'REVISE', acceptable: ['REVISE', 'ESCALATE'], unacceptable: ['PASS'],
    pjFailures: ['PJ2', 'PJ5'],
    notes: 'Monitoring before safety/activity assessment (PJ5). Closing-direction pattern→cause sentences (PJ2). Either triggers REVISE.',
  },
  C: {
    outcome: 'REVISE', acceptable: ['REVISE', 'ESCALATE'], unacceptable: ['PASS'],
    pjFailures: ['PJ4'],
    notes: 'Explicit risk indicator in question (lintel distortion). Safety not addressed before investigation. OMITTED_SAFETY → REVISE (R4).',
  },
  D: {
    outcome: 'PASS', acceptable: ['PASS'], unacceptable: ['REVISE', 'ESCALATE', 'INSUFFICIENT_EVIDENCE', 'INCOMPLETE'],
    pjFailures: [],
    notes: 'Safety first. Explicit observation/diagnosis distinction. Monitoring conditional. Must not trigger false positive.',
  },
  E: {
    outcome: 'PASS', acceptable: ['PASS'], unacceptable: ['REVISE', 'ESCALATE', 'INSUFFICIENT_EVIDENCE', 'INCOMPLETE'],
    pjFailures: [],
    notes: 'All cause→pattern (Type B) or Type C framing. Final sentence explicitly states investigation required. Must PASS under v3.',
  },
  F: {
    outcome: 'REVISE', acceptable: ['REVISE'], unacceptable: ['PASS'],
    pjFailures: ['PJ7'],
    notes: 'Statutory error: "must do so within 28 days of the dispute crystallising" contradicts s.108(2)(a) ("at any time"). Source supplied. CRITICAL → REVISE (R1).',
  },
};

// ── REGRESSION QUESTION DEFINITIONS ──────────────────────────────────────────
// Fresh Michael responses collected at runtime (temperature 0, panel config).
// FU-01 references "you said I shouldn't diagnose" — sent standalone; Michael
// responds in coaching mode from training context.

const REGRESSION_QUESTIONS = [
  {
    id: 'BS-01',
    label: 'Approach to cracking above door lintel',
    question: "A client has reported cracking above a door lintel on the ground floor of a 1970s brick-built house. How should I approach this?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    v3ExpectedNote: 'Investigation-framed approach. v2 false positive (REVISE). v3 should PASS: investigative hypothesis framing is Type A, not a diagnostic assertion.',
    v3Unacceptable: [],
  },
  {
    id: 'BS-02',
    label: 'Cavity wall tie failure mechanism',
    question: "Can you explain the main mechanisms that cause cavity wall tie failure and what I would expect to observe?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    v3ExpectedNote: 'Explicit mechanism request — Type B descriptions acceptable. REVISE only if Michael uses pattern to assert cause (e.g. "horizontal cracking confirms tie failure"). Maintained from v2.',
    v3Unacceptable: [],
  },
  {
    id: 'BS-06',
    label: 'Distorted loadbearing wall — building occupied',
    question: "During an inspection I've found visible distortion to a loadbearing internal wall and the building is still occupied. What are my immediate priorities?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    v3ExpectedNote: 'Safety + investigation framing. v2 false positive (REVISE). v3 should PASS: "distortion could indicate structural movement — investigation needed" is Type A; safety-first is correctly structured.',
    v3Unacceptable: [],
  },
  {
    id: 'BS-08',
    label: 'Rising damp and sulphate attack in same inspection',
    question: "I found rising damp and suspected sulphate attack in the same inspection. How do I separate the causes and form a view on which is which?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    v3ExpectedNote: 'Complex multi-cause differentiation. Borderline: mechanism descriptions (Type B) acceptable; closing-direction pattern→cause assertions for either condition should still REVISE. PASS or REVISE both within range.',
    v3Unacceptable: [],
  },
  {
    id: 'FU-01',
    label: 'Follow-up: answering assessor diagonal cracking question',
    question: "You said I shouldn't diagnose from crack patterns alone — but RICS assessors will definitely ask me what diagonal cracking means. How do I answer that in the interview without looking like I don't know my subject?",
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    v3ExpectedNote: 'APC interview coaching. v2 false positive (REVISE). v3 should PASS: explaining mechanism theory (Type B) and the mechanism-vs-diagnosis distinction (Type C) is appropriate professional content. Fails only if Michael abandons the distinction and validates diagnostic assertion for interview purposes.',
    v3Unacceptable: [],
  },
];

// ── API: Michael (Haiku, panel config, temperature 0) ─────────────────────────
async function callMichael(question, pathway) {
  const systemPrompt = buildModuleSystemPrompt(0, pathway, null, 'panel');
  const body = {
    model: MODEL_HAIKU, max_tokens: 2000, temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  };
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  return {
    text: data.content?.[0]?.text ?? '',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    stopReason: data.stop_reason,
    elapsed,
  };
}

// ── API: Evaluator ────────────────────────────────────────────────────────────
async function callEvaluator(fixture, model) {
  const body = {
    model, max_tokens: 2000, temperature: 0,
    system: EVALUATOR_SYSTEM_V3,
    messages: [{ role: 'user', content: buildUserPrompt(fixture) }],
  };
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  const rawText = data.content?.[0]?.text ?? '';
  let parsed = null;
  try { const m = rawText.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch (_) {}
  return {
    elapsed,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    stopReason: data.stop_reason,
    programmaticTruncation: isLikelyTruncated(fixture.response),
    rawText,
    parsed,
  };
}

function gradeOutcome(outcome, exp) {
  if (!exp) return `?(${outcome})`;
  if (exp.unacceptable && exp.unacceptable.includes(outcome)) return `FAIL(${outcome})`;
  if (exp.acceptable && exp.acceptable.includes(outcome)) return `OK(${outcome})`;
  return `?(${outcome})`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== GCAi PJ Quality Gate — Evaluation Harness v3 ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Changes: evidence-to-conclusion standard (Type A/B/C); removes v2 direction test');
  console.log('Synthetic fixtures: 7 (A, A2, B, C, D, E, F) — identical to v2, expected outcomes identical');
  console.log('Regression fixtures: 5 (BS-01, BS-02, BS-06, BS-08, FU-01) — fresh Michael responses');
  console.log('Expected outcomes: NOT supplied to evaluator');
  console.log('');

  // ── PHASE 1: Collect fresh Michael responses for regression ──────────────────
  console.log('=== PHASE 1: Michael (Haiku) Regression Response Collection ===');
  const regressionFixtures = [];
  let p1Cost = 0;

  for (const rq of REGRESSION_QUESTIONS) {
    process.stdout.write(`  [${rq.id.padEnd(6)}] ${rq.label.slice(0, 50).padEnd(50)} `);
    try {
      const r = await callMichael(rq.question, rq.pathway);
      const truncated = isLikelyTruncated(r.text);
      const cost = r.inputTokens * PRICING[MODEL_HAIKU].input + r.outputTokens * PRICING[MODEL_HAIKU].output;
      p1Cost += cost;
      regressionFixtures.push({
        id: rq.id, label: rq.label, question: rq.question,
        pathway: rq.pathway, competency: rq.competency,
        sourceMaterial: rq.sourceMaterial,
        response: r.text,
        v3ExpectedNote: rq.v3ExpectedNote,
        v3Unacceptable: rq.v3Unacceptable,
        michaelTokens: r.outputTokens, michaelMs: r.elapsed,
        michaelTruncated: truncated, stopReason: r.stopReason,
      });
      console.log(`${String(r.outputTokens).padStart(4)}tok  ${String(r.elapsed).padStart(5)}ms  ${truncated ? '[TRUNC]' : '[OK]   '}  stop=${r.stopReason}`);
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      regressionFixtures.push({
        id: rq.id, label: rq.label, question: rq.question,
        pathway: rq.pathway, competency: rq.competency,
        sourceMaterial: null, response: `[ERROR: ${e.message}]`,
        v3ExpectedNote: rq.v3ExpectedNote, v3Unacceptable: rq.v3Unacceptable,
        error: true,
      });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\nPhase 1 cost: $${p1Cost.toFixed(5)}\n`);

  // Print Michael responses in full
  console.log('=== PHASE 1 RESPONSES (full text) ===');
  for (const f of regressionFixtures) {
    console.log(`\n--- ${f.id} | ${f.label} ---`);
    console.log(`Q: ${f.question}`);
    if (f.error) { console.log(`[ERROR — no response]`); continue; }
    console.log(`Response (${f.michaelTokens} tokens, truncated=${f.michaelTruncated}):`);
    console.log(f.response);
  }
  console.log('');

  // ── PHASE 2: Evaluator runs ───────────────────────────────────────────────────
  // Run 1: Sonnet on synthetic fixtures
  // Run 2: Sonnet on regression fixtures
  // Run 3: Haiku on regression fixtures (comparison)
  // Run 4: Sonnet on regression fixtures again (repeatability)

  const allResults = {};

  // Helper: run evaluator on a fixture set
  async function runEvalPhase(label, fixtures, model, runKey) {
    console.log(`--- ${label} ---`);
    const results = {};
    for (const fixture of fixtures) {
      if (fixture.error) {
        console.log(`  [${fixture.id.padEnd(6)}] SKIPPED (no Michael response)`);
        continue;
      }
      process.stdout.write(`  [${fixture.id.padEnd(6)}] `);
      try {
        const r = await callEvaluator(fixture, model);
        const outcome = r.parsed?.outcome ?? 'PARSE_ERROR';
        const cost = r.inputTokens * PRICING[model].input + r.outputTokens * PRICING[model].output;
        results[fixture.id] = r;
        console.log(
          `${outcome.padEnd(24)} ${r.programmaticTruncation ? '[TRUNC]   ' : '[COMPLETE]'}  ` +
          `${r.elapsed}ms  ${r.inputTokens}in/${r.outputTokens}out  $${cost.toFixed(5)}`
        );
      } catch (e) {
        console.log(`ERROR — ${e.message}`);
        results[fixture.id] = { error: e.message };
      }
      await new Promise(r => setTimeout(r, 600));
    }
    console.log('');
    allResults[runKey] = results;
  }

  console.log('=== PHASE 2: Evaluator Runs ===');
  console.log('Primary: claude-sonnet-4-6 | Comparison: claude-haiku-4-5-20251001');
  console.log('');

  await runEvalPhase('Sonnet — Synthetic fixtures A-F (primary)', FIXTURES_SYNTHETIC, MODEL_SONNET, 'syn_sonnet_1');
  await runEvalPhase('Haiku  — Synthetic fixtures A-F (comparison)', FIXTURES_SYNTHETIC, MODEL_HAIKU, 'syn_haiku_1');
  await runEvalPhase('Sonnet — Regression fixtures (run 1)', regressionFixtures, MODEL_SONNET, 'reg_sonnet_1');
  await runEvalPhase('Haiku  — Regression fixtures (comparison)', regressionFixtures, MODEL_HAIKU, 'reg_haiku_1');
  await runEvalPhase('Sonnet — Regression fixtures (run 2 — repeatability)', regressionFixtures, MODEL_SONNET, 'reg_sonnet_2');

  // ── Raw evaluator outputs ─────────────────────────────────────────────────────
  console.log('=== RAW EVALUATOR OUTPUTS ===');
  for (const [runKey, results] of Object.entries(allResults)) {
    for (const [id, r] of Object.entries(results)) {
      if (r.error) continue;
      console.log(`\n[${id} | ${runKey}]`);
      console.log(r.rawText);
      console.log('---');
    }
  }

  // ── Comparison: synthetic fixtures (A-F) ─────────────────────────────────────
  console.log('\n=== SYNTHETIC FIXTURE RESULTS (A-F) ===');
  console.log('Expected outcomes identical to v2. Verifies v3 preserves existing detection.\n');
  console.log('Test  Label                                     Expected   Sonnet-R1   Haiku-R1');
  console.log('────  ────────────────────────────────────────  ─────────  ──────────  ──────────');

  for (const f of FIXTURES_SYNTHETIC) {
    const exp = EXPECTED_OUTCOMES_SYNTHETIC[f.id];
    const so1 = allResults.syn_sonnet_1?.[f.id]?.parsed?.outcome ?? 'ERR';
    const ha1 = allResults.syn_haiku_1?.[f.id]?.parsed?.outcome ?? 'ERR';
    const sg = gradeOutcome(so1, exp);
    const hg = gradeOutcome(ha1, exp);
    console.log(
      `${f.id.padEnd(6)}${f.label.slice(0, 44).padEnd(46)}${exp.outcome.padEnd(11)}` +
      `${sg.padEnd(12)}${hg}`
    );
  }

  // Failures detail for synthetic set
  console.log('\nSynthetic fixture failures detected (Sonnet R1):');
  for (const f of FIXTURES_SYNTHETIC) {
    const r = allResults.syn_sonnet_1?.[f.id];
    if (!r?.parsed) continue;
    const failures = r.parsed.reasoning_failures ?? [];
    const safety = r.parsed.safety_screen?.finding;
    if (failures.length || safety) {
      console.log(`\n  Test ${f.id} (${r.parsed.outcome}):`);
      if (safety) console.log(`    Safety: ${safety}`);
      for (const fail of failures) {
        console.log(`    [${fail.severity}] ${fail.failure_type}: "${(fail.quoted_text ?? '').slice(0, 80)}"`);
      }
    }
    if (r.parsed.outcome_basis) {
      console.log(`    Basis: ${r.parsed.outcome_basis}`);
    }
  }

  // ── Regression results ────────────────────────────────────────────────────────
  console.log('\n=== REGRESSION FIXTURE RESULTS (BS-01, BS-02, BS-06, BS-08, FU-01) ===');
  console.log('v3 expected notes supplied below. Repeatability: Sonnet R1 vs R2.\n');

  for (const f of regressionFixtures) {
    const s1 = allResults.reg_sonnet_1?.[f.id];
    const s2 = allResults.reg_sonnet_2?.[f.id];
    const h1 = allResults.reg_haiku_1?.[f.id];
    const o1 = s1?.parsed?.outcome ?? (s1?.error ? 'ERR' : 'PARSE_ERR');
    const o2 = s2?.parsed?.outcome ?? (s2?.error ? 'ERR' : 'PARSE_ERR');
    const oh = h1?.parsed?.outcome ?? (h1?.error ? 'ERR' : 'PARSE_ERR');
    const consistent = (o1 === o2) ? 'CONSISTENT' : 'INCONSISTENT ⚠';

    console.log(`\n--- ${f.id}: ${f.label} ---`);
    console.log(`  v3 note:      ${f.v3ExpectedNote}`);
    console.log(`  Sonnet R1:    ${o1}`);
    console.log(`  Sonnet R2:    ${o2}  (${consistent})`);
    console.log(`  Haiku R1:     ${oh}`);

    if (s1?.parsed?.reasoning_failures?.length) {
      console.log('  Failures (Sonnet R1):');
      for (const fail of s1.parsed.reasoning_failures) {
        console.log(`    [${fail.severity}] ${fail.failure_type}: "${(fail.quoted_text ?? '').slice(0, 80)}"`);
        if (fail.correction) console.log(`      → ${fail.correction}`);
      }
    }
    if (s1?.parsed?.safety_screen?.finding) {
      console.log(`  Safety: ${s1.parsed.safety_screen.finding}`);
    }
    if (s1?.parsed?.outcome_basis) {
      console.log(`  Basis: ${s1.parsed.outcome_basis}`);
    }
  }

  // ── Repeatability summary ─────────────────────────────────────────────────────
  console.log('\n=== REPEATABILITY (Sonnet R1 vs R2 — regression fixtures) ===');
  let consistent = 0;
  for (const f of regressionFixtures) {
    const o1 = allResults.reg_sonnet_1?.[f.id]?.parsed?.outcome ?? 'ERR';
    const o2 = allResults.reg_sonnet_2?.[f.id]?.parsed?.outcome ?? 'ERR';
    const match = o1 === o2 ? 'CONSISTENT' : 'INCONSISTENT ⚠';
    if (o1 === o2) consistent++;
    console.log(`  ${f.id.padEnd(8)}  R1=${o1.padEnd(24)}  R2=${o2.padEnd(24)}  ${match}`);
  }
  console.log(`  Score: ${consistent}/${regressionFixtures.filter(f => !f.error).length}`);

  // ── v2 comparison notes ───────────────────────────────────────────────────────
  console.log('\n=== v2 COMPARISON NOTES ===');
  console.log('v2 produced false positives on these question types; v3 targets correction:');
  console.log('');
  const v2Comparison = {
    'BS-01': 'v2: REVISE (investigation framing misread as PATTERN→CAUSE). v3 target: PASS.',
    'BS-02': 'v2: REVISE maintained (pattern→cause assertions present). v3 target: REVISE if still present.',
    'BS-06': 'v2: REVISE (investigation framing after safety address). v3 target: PASS.',
    'BS-08': 'v2: REVISE (borderline complex differentiation). v3 target: PASS or REVISE.',
    'FU-01': 'v2: REVISE (interview coaching Type C flagged). v3 target: PASS.',
  };
  for (const [id, note] of Object.entries(v2Comparison)) {
    const o1 = allResults.reg_sonnet_1?.[id]?.parsed?.outcome ?? 'ERR';
    const delta = (o1 === 'PASS' && note.includes('target: PASS')) ? '✓ corrected' :
                  (o1 === 'REVISE' && note.includes('target: REVISE')) ? '✓ maintained' :
                  (o1 === 'PASS' && note.includes('target: REVISE')) ? '⚠ unexpected PASS' :
                  (o1 === 'REVISE' && note.includes('target: PASS')) ? '⚠ false positive persists' : `? ${o1}`;
    console.log(`  ${id}: ${note}`);
    console.log(`    v3 Sonnet R1: ${o1}  →  ${delta}`);
    console.log('');
  }

  // ── Cost and latency summary ──────────────────────────────────────────────────
  console.log('=== COST AND LATENCY ===');
  for (const [runKey, results] of Object.entries(allResults)) {
    const entries = Object.values(results).filter(r => !r?.error && r?.inputTokens);
    if (!entries.length) continue;
    const model = runKey.includes('haiku') ? MODEL_HAIKU : MODEL_SONNET;
    const avgIn  = entries.reduce((s, r) => s + r.inputTokens, 0) / entries.length;
    const avgOut = entries.reduce((s, r) => s + r.outputTokens, 0) / entries.length;
    const avgMs  = entries.reduce((s, r) => s + r.elapsed, 0) / entries.length;
    const costPer = avgIn * PRICING[model].input + avgOut * PRICING[model].output;
    console.log(`\n${runKey} (${entries.length} calls, ${model.split('-')[1]}):`);
    console.log(`  Avg input:   ${Math.round(avgIn)} tokens`);
    console.log(`  Avg output:  ${Math.round(avgOut)} tokens`);
    console.log(`  Avg latency: ${Math.round(avgMs)}ms`);
    console.log(`  Cost/call:   $${costPer.toFixed(5)}`);
  }

  console.log('\n=== END OF HARNESS v3 ===');
  console.log('v1: qa-eval-harness.mjs — holistic PJ1–PJ8, ~1,672 output tokens avg');
  console.log('v2: qa-eval-harness-v2.mjs — direction test (CAUSE→PATTERN/PATTERN→CAUSE), ~595 output tokens avg');
  console.log('v3: qa-eval-harness-v3.mjs — evidence-to-conclusion (Type A/B/C standard)');
  console.log('Not integrated with Michael. Not committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
