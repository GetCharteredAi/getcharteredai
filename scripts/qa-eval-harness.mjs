/**
 * GCAi Professional Judgement Quality Gate — Isolated Evaluation Harness
 * Development-only. Not integrated with candidate-facing platform.
 * Not deployed. Do not commit without review.
 *
 * Design constraints:
 * - EXPECTED_OUTCOMES are defined in this file but never passed to the evaluator.
 * - Each API call is independent: no shared conversation history between tests.
 * - The evaluator receives only: candidate question, pathway/competency, Michael's
 *   response, the eight PJ criteria, and source material where supplied.
 * - Temperature is 0 for consistency across runs.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env without external dependency ─────────────────────────────────────
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

// Haiku pricing (USD per token) — as of 2025
const PRICING = {
  [MODEL_HAIKU]:  { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  [MODEL_SONNET]: { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

// ── EVALUATOR PROMPT ──────────────────────────────────────────────────────────
// This is exactly what the quality gate would receive.
// It does NOT contain expected outcomes, known errors, or test labels.

const EVALUATOR_SYSTEM = `You are a quality evaluator for an RICS APC training platform. Your task is to assess a proposed response from Michael, an AI tutor, against eight Professional Judgement criteria.

You will receive the candidate's question, pathway and competency context, Michael's proposed response, and any available verified source material. Each evaluation is independent — you have no information about previous tests or expected outcomes.

CLAIM CLASSIFICATION
Classify every material claim or recommendation as one of:
- Type A: Specific statutory or regulatory claim (named Act section, Regulation number, legal deadline, enforceable obligation)
- Type B: Specific professional obligation claim (named RICS rule, practice statement, binding professional requirement by name)
- Type C: Technical or professional conclusion (causation, diagnosis, significance assessment, appropriate next step for a specific situation)
- Type D: General educational explanation (what a process, role or principle is — not asserting application to this candidate's specific situation)
- Type E: Case-specific professional advice (what must be done in this candidate's specific situation, presented as established)

EIGHT PROFESSIONAL JUDGEMENT CRITERIA
PJ1 Evidence fidelity — does the response represent only the information actually available? Does it present assumed facts as though they were established by the candidate?
PJ2 Inference discipline — does the response distinguish between observation, reasonable inference (a possibility worth investigating), and established conclusion? NOTE: qualifying words such as "typically," "may indicate," "often," "usually" reduce but do not eliminate a PJ2 concern if the response still treats an observation or pattern as a reliable guide to cause rather than as a prompt for investigation.
PJ3 Uncertainty handling — does the response acknowledge what is not known and describe what investigation is needed?
PJ4 Safety and risk — where the scenario contains risk indicators, does the response address immediate safety implications BEFORE routine investigation steps? Not every scenario requires urgent safety action, but where risk indicators are present the response must address whether immediate action is needed before proceeding to documentation, background-gathering or investigation planning.
PJ5 Proportionality — are the investigation steps, monitoring recommendations and referral suggestions proportionate to the available evidence, the potential risk and the professional's competence? Is monitoring recommended as a default first step, or only after the situation has been assessed as stable and low-risk?
PJ6 Competence boundary — does the response correctly identify when specialist input is required?
PJ7 Standards application — where the response names a specific statute, regulation, RICS rule or professional obligation, does the claim match the supplied source material? If no source material is supplied, identify the claim as a verification gap — do not assume it is correct.
PJ8 Recommendation support — are the recommendations grounded in the evidence described in the candidate's question, or are they based primarily on assumed context, pattern, or rule of thumb?

EVALUATION RULES
1. Qualifying language does not automatically pass PJ2. Ask: does the response treat the observation as establishing what the cause is, or as a prompt for investigation?
2. Do not treat format compliance (prose, follow-up question, appropriate length) as evidence of professional correctness.
3. Do not use Michael's response as evidence that its own conclusions are correct.
4. If a Type A or B claim is present and no source material is supplied, flag it as a verification gap — do not assume accuracy.
5. Do not automatically fail a response because it contains technical detail or specific recommendations. Assess whether the reasoning behind the recommendation is justified.
6. A PASS must mean the applicable checks were satisfied — not simply that no statutory reference was found.

OUTCOME DEFINITIONS
PASS — The response satisfies the applicable PJ checks. Reasoning is defensible. Material claims are either verified against source material or are appropriate Type D educational content.
REVISE — A specific material reasoning failure or factual error has been identified that can be stated precisely. Include the exact failure and the correction needed.
INSUFFICIENT_EVIDENCE — A material claim is present that cannot be verified from available source material and cannot be assessed from reasoning alone. Identify the specific claim and what source would be needed.
ESCALATE — A case-specific professional conclusion is presented as established advice that cannot be reliably supported from the available information.

RETURN FORMAT — return ONLY valid JSON. No preamble, no markdown fences, no explanation outside the JSON object:
{
  "outcome": "PASS" | "REVISE" | "INSUFFICIENT_EVIDENCE" | "ESCALATE",
  "claims_assessed": [
    {
      "claim_type": "A" | "B" | "C" | "D" | "E",
      "claim_text": "exact text or close paraphrase",
      "pj_criteria": ["PJ2"],
      "issue": "description of the issue, or null",
      "evidence": "what supports this assessment",
      "significance": "CRITICAL" | "MATERIAL" | "MINOR" | "NONE",
      "correction": "required correction, or null"
    }
  ],
  "unverified_claims": ["claims requiring source verification that could not be performed"],
  "overall_reasoning": "brief explanation of outcome",
  "limitation": "what this check cannot establish"
}`;

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
    prompt += `\n\nSource material: None supplied. Identify any Type A or Type B claims as verification gaps.`;
  }
  return prompt;
}

// ── TEST FIXTURES ─────────────────────────────────────────────────────────────
// Expected outcomes are NOT here — they are in EXPECTED_OUTCOMES below.

const FIXTURES = [
  {
    id: 'A',
    label: 'Unsupported diagnosis (brickwork)',
    provenance: 'CONFIRMED REAL — recovered from development session log (entry 17056). Generated after coaching improvements were applied.',
    question: 'A client reports cracking to the external brickwork. What should I consider?',
    pathway: 'Building Surveying',
    competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterial: null,
    response:
`The most important thing to establish first is **pattern and location** — whether the cracks are random, follow mortar joints, run diagonally, or appear at corners and openings. This will tell you whether you're looking at structural movement, drying shrinkage, thermal effects or something more serious. Before you make any observations, ask the client how long the cracks have been there and whether they've noticed any change — stable cracks behave very differently from active ones.

From there, your approach depends on what the pattern suggests. Diagonal stepped cracking through bricks and mortar typically indicates structural loading or settlement; cracks confined to mortar joints with no brick fracture often point to mortar deterioration or minor thermal movement; cracks radiating from window corners usually suggest stress concentration around openings. You'll also want to know the building's age and construction type — a 1960s cavity wall will move differently from a 1820s solid brick structure.

Your investigation should include the inside face of the wall if accessible — internal cracking or damp, staining or blown plaster will help you understand whether this is a surface...`
  },

  {
    id: 'B',
    label: 'Premature monitoring recommendation (brickwork)',
    provenance: 'SYNTHETIC — constructed to represent documented failure patterns: crack-width thresholds as significance indicators; monitoring recommended before safety or activity assessment.',
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

  {
    id: 'C',
    label: 'Missing immediate risk (lintel distortion)',
    provenance: 'SYNTHETIC — constructed to test safety omission when an explicit risk indicator is present in the candidate question.',
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

  {
    id: 'D',
    label: 'Defensible initial guidance (brickwork)',
    provenance: 'SYNTHETIC — constructed to represent a defensible response: safety first, explicit observation/diagnosis distinction, conditional monitoring.',
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

  {
    id: 'E',
    label: 'Appropriate technical depth (explicit request)',
    provenance: 'SYNTHETIC — tests whether the evaluator incorrectly flags detailed technical content when the candidate explicitly requested it.',
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

  {
    id: 'F',
    label: 'Statutory error — adjudication referral window (AT-4 documented error)',
    provenance: 'SYNTHETIC — incorporates the documented AT-4 error: 28-day adjudication referral window stated where none exists under HGCRA s.108. Source material supplied.',
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

// ── EXPECTED OUTCOMES ─────────────────────────────────────────────────────────
// Never passed to the evaluator. Used only for post-run comparison.

const EXPECTED_OUTCOMES = {
  A: {
    outcome: 'REVISE',
    pjFailures: ['PJ2', 'PJ4'],
    keyIssues: [
      'Pattern-location stated as most important first step over safety assessment',
      '"This will tell you whether you\'re looking at structural movement" — treats pattern as resolving cause',
      'Three pattern→cause associations ("typically indicates", "often point to", "usually suggest")',
      'No safety assessment at any point in the recoverable response',
    ],
    notes: 'Qualifying language present but does not redeem inference failure',
  },
  B: {
    outcome: 'REVISE',
    pjFailures: ['PJ2', 'PJ4', 'PJ5'],
    keyIssues: [
      'Crack width thresholds (0.3mm, 1mm, 5mm) presented as clinical significance scale',
      '6-month monitoring recommended as first substantive step — no prior safety or activity assessment',
      'Multiple pattern→cause associations without investigation framing',
      'Safety entirely absent',
    ],
    notes: 'Monitoring as unconditional first recommendation is a documented critical failure condition',
  },
  C: {
    outcome: 'REVISE',
    pjFailures: ['PJ4'],
    keyIssues: [
      'Candidate explicitly describes lintel distortion at main entrance — stated structural risk indicator',
      'Response leads with inspection/documentation, not immediate safety assessment',
      'No consideration of whether area is safe for continued use or whether urgent advice is needed',
      'Structural engineer recommended but deferred until after background information gathering',
    ],
    notes: 'Response does eventually recommend SE; failure is prioritisation order, not complete omission',
  },
  D: {
    outcome: 'PASS',
    pjFailures: [],
    keyIssues: [],
    notes: 'Safety first, explicit observation/diagnosis distinction, monitoring conditional on stability and no risk indicators, one follow-up question',
  },
  E: {
    outcome: 'PASS',
    pjFailures: [],
    keyIssues: [],
    notes: 'Explicit technical depth request justifies detailed content. Response consistently distinguishes mechanism knowledge from site-specific diagnosis. Closing paragraph explicitly states pattern cannot confirm diagnosis.',
  },
  F: {
    outcome: 'REVISE',
    pjFailures: ['PJ7'],
    keyIssues: [
      '"contractor must do so within 28 days of the dispute crystallising" — Type A claim',
      'HGCRA s.108(2)(a) states notice can be given "at any time" — no referral window exists',
      '28 days under s.108(2)(c) is the ADJUDICATOR\'s decision period, not a referral window',
      'Pay less notice 5-day timing: s.111(5) references "prescribed period" only — specific timing unverifiable from supplied text',
    ],
    notes: 'Second 28-day reference (adjudicator decision period from referral) is correctly stated',
  },
};

// ── API CALL ──────────────────────────────────────────────────────────────────

async function callEvaluator(fixture, model) {
  const body = {
    model,
    max_tokens: 3000,
    temperature: 0,
    system: EVALUATOR_SYSTEM,
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
    rawText,
    parsed,
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const runs = [
    { label: 'Haiku — Run 1',    model: MODEL_HAIKU,  runId: 1 },
    { label: 'Haiku — Run 2 (repeatability)', model: MODEL_HAIKU, runId: 2 },
    { label: 'Sonnet — Run 1 (comparison)',   model: MODEL_SONNET, runId: 3 },
  ];

  const allResults = [];

  console.log('=== GCAi PJ Quality Gate — Isolated Evaluation Harness ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Fixtures: ${FIXTURES.length}  |  Runs: ${runs.length}`);
  console.log('Expected outcomes: NOT supplied to evaluator');
  console.log('');

  for (const run of runs) {
    console.log(`--- ${run.label} ---`);
    const runResults = [];
    for (const fixture of FIXTURES) {
      process.stdout.write(`  Test ${fixture.id}: `);
      try {
        const r = await callEvaluator(fixture, run.model);
        r.runId = run.runId;
        r.runLabel = run.label;
        runResults.push(r);
        allResults.push(r);
        const outcome = r.parsed?.outcome ?? 'PARSE_ERROR';
        const cost = (r.inputTokens * PRICING[run.model].input + r.outputTokens * PRICING[run.model].output);
        console.log(`${outcome.padEnd(22)} ${r.elapsed}ms  ${r.inputTokens}in/${r.outputTokens}out  $${cost.toFixed(5)}`);
      } catch (e) {
        console.log(`ERROR — ${e.message}`);
        allResults.push({ fixtureId: fixture.id, model: run.model, runId: run.runId, error: e.message });
      }
      await new Promise(r => setTimeout(r, 600));
    }
    console.log('');
  }

  // ── Full raw results ──────────────────────────────────────────────────────
  console.log('=== RAW EVALUATOR OUTPUTS ===');
  for (const r of allResults) {
    if (r.error) continue;
    console.log(`\n[Test ${r.fixtureId} | Run ${r.runId} | ${r.model}]`);
    console.log(r.rawText);
    console.log('---');
  }

  // ── Comparison table ──────────────────────────────────────────────────────
  console.log('\n=== COMPARISON AGAINST EXPECTED OUTCOMES ===');
  for (const fixture of FIXTURES) {
    const exp = EXPECTED_OUTCOMES[fixture.id];
    const byRun = runId => allResults.find(r => r.fixtureId === fixture.id && r.runId === runId);
    const r1 = byRun(1), r2 = byRun(2), r3 = byRun(3);
    const o1 = r1?.parsed?.outcome ?? 'ERR';
    const o2 = r2?.parsed?.outcome ?? 'ERR';
    const o3 = r3?.parsed?.outcome ?? 'ERR';
    const match = o => (o === exp.outcome ? '✓' : `✗(got ${o})`);
    const consistent = o1 === o2 ? 'consistent' : 'INCONSISTENT';

    console.log(`\nTest ${fixture.id} — ${fixture.label}`);
    console.log(`  Expected:         ${exp.outcome}  [PJ: ${exp.pjFailures.join(', ') || 'none'}]`);
    console.log(`  Haiku R1:         ${o1}  ${match(o1)}`);
    console.log(`  Haiku R2:         ${o2}  ${match(o2)}  (${consistent})`);
    console.log(`  Sonnet R1:        ${o3}  ${match(o3)}`);

    // Check if expected PJ failures were detected (Sonnet run only, as more reliable)
    if (r3?.parsed?.claims_assessed && exp.pjFailures.length > 0) {
      const detectedPJ = new Set(r3.parsed.claims_assessed.flatMap(c => c.pj_criteria || []));
      const foundAll = exp.pjFailures.every(p => detectedPJ.has(p));
      console.log(`  PJ criteria detected (Sonnet): ${[...detectedPJ].join(', ') || 'none'}`);
      console.log(`  Expected failures captured: ${foundAll ? 'YES' : 'PARTIAL/NO'}`);
    }
  }

  // ── Cost and latency summary ──────────────────────────────────────────────
  console.log('\n=== COST AND LATENCY SUMMARY ===');
  for (const model of [MODEL_HAIKU, MODEL_SONNET]) {
    const mrs = allResults.filter(r => r.model === model && !r.error);
    if (!mrs.length) continue;
    const avgIn  = mrs.reduce((s, r) => s + r.inputTokens, 0)  / mrs.length;
    const avgOut = mrs.reduce((s, r) => s + r.outputTokens, 0) / mrs.length;
    const avgMs  = mrs.reduce((s, r) => s + r.elapsed, 0)      / mrs.length;
    const cost   = avgIn * PRICING[model].input + avgOut * PRICING[model].output;
    const label  = model === MODEL_HAIKU ? 'Haiku' : 'Sonnet';
    console.log(`${label} (${mrs.length} calls):`);
    console.log(`  Avg input tokens:   ${Math.round(avgIn)}`);
    console.log(`  Avg output tokens:  ${Math.round(avgOut)}`);
    console.log(`  Avg latency:        ${Math.round(avgMs)}ms`);
    console.log(`  Cost per call:      $${cost.toFixed(5)}`);
    console.log(`  Added latency vs baseline Michael turn: measured above`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
