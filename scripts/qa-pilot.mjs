/**
 * GCAi Professional Reasoning & Evidence Quality Gate
 * Development-Only Sonnet Evaluation Pilot — corrected version
 *
 * Method: API-EQUIVALENT
 *   Reproduces dashboard panel configuration exactly:
 *     model:      claude-haiku-4-5-20251001
 *     max_tokens: 2000
 *     source:     'panel'
 *     moduleId:   0
 *   System prompt extracted from netlify/functions/ai-tutor.js at runtime
 *   without modifying that file.
 *
 * Source verification policy:
 *   AUTHORITATIVE_VERIFIED — checked against the actual authoritative document
 *     with source, provision, version, jurisdiction and verification date recorded.
 *     Status: ZERO sources in this pilot meet this standard.
 *   INTERNALLY_REVIEWED — checked against GCAi content (ai-tutor.js, CLAUDE.md).
 *     Internal consistency verified; not checked against primary published source.
 *   PROVISIONAL — reconstructed from training data. Not verified against any
 *     authoritative source. Must not be presented to the evaluator as verified.
 *     Must not be used to assert that Michael's claims are wrong.
 *
 * Fast evaluator status:
 *   Experimental comparison only. Explicitly reports which of PJ1–PJ8 it assessed.
 *   Not equivalent to the full Professional Reasoning Quality Gate.
 *   Not recommended for candidate-facing deployment.
 *
 * Independent content assessment:
 *   correctContent records what a correct answer should contain and the evidence
 *   basis for each requirement. These are printed for human review — they are not
 *   automatically scored by the pilot. A matching evaluator outcome does not
 *   constitute confirmation that Michael's answer is professionally correct.
 *
 * Constraints:
 *   - Does not modify ai-tutor.js or any production file
 *   - Does not commit, push, or deploy anything
 *   - Does not display or log any credentials
 *   - No real candidate accounts or personal information
 *
 * STOP: DO NOT RUN until approved.
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

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

const PRICING = {
  [MODEL_HAIKU]:  { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  [MODEL_SONNET]: { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

// ── Extract buildModuleSystemPrompt from ai-tutor.js (unmodified) ─────────────
// Cuts source before exports.handler to avoid executing the Lambda handler.
// getMichaelModuleBriefing, MODULE_TITLES, PERSONAS, buildModuleSystemPrompt
// are all defined before exports.handler and are captured intact.

const aiTutorPath   = resolve(__dirname, '../netlify/functions/ai-tutor.js');
const aiTutorSource = readFileSync(aiTutorPath, 'utf8');
const handlerIdx    = aiTutorSource.indexOf('exports.handler');
const isolatedSrc   = (handlerIdx > 0 ? aiTutorSource.slice(0, handlerIdx) : aiTutorSource)
                      + '\nreturn buildModuleSystemPrompt;';

const aiTutorRequire = createRequire(aiTutorPath);
let buildModuleSystemPrompt;
try {
  const fakeExports = {};
  const fakeModule  = { exports: fakeExports };
  const fn = new Function('require', 'exports', 'module', isolatedSrc);
  buildModuleSystemPrompt = fn(aiTutorRequire, fakeExports, fakeModule);
  if (typeof buildModuleSystemPrompt !== 'function') throw new Error('not a function');
  console.log('[INIT] buildModuleSystemPrompt extracted from ai-tutor.js — OK');
} catch (e) {
  console.error('[INIT] Failed to extract buildModuleSystemPrompt:', e.message);
  process.exit(1);
}

// ── Programmatic truncation detection ─────────────────────────────────────────
function isLikelyTruncated(text) {
  const trimmed = text.trim();
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return true;
  return !/[.!?]["']?\s*$/.test(trimmed);
}

// ── SOURCE REGISTRY ───────────────────────────────────────────────────────────
//
// AUTHORITATIVE_VERIFIED count: 0
//   No source in this pilot has been checked against its primary published
//   document. Nothing should be promoted to this tier without that check.
//
// INTERNALLY_REVIEWED count: 3
//   Content read directly from ai-tutor.js or CLAUDE.md in this session.
//   Not independently verified against the primary published source.
//   Used only to check whether Michael contradicts his own training config.
//
// PROVISIONAL count: 2
//   Training-data reconstruction. Not passed to the evaluator as source material.
//   Michael's claims against these topics go to unverified_type_ab only.

const SOURCE_REGISTRY = {

  RICS_FIVE_ETHICAL_STANDARDS: {
    name: 'RICS Five Ethical Standards',
    verificationStatus: 'INTERNALLY_REVIEWED',
    jurisdiction: 'RICS global',
    version: 'as stated in ai-tutor.js getMichaelModuleBriefing(2) and CLAUDE.md',
    extractedFrom: 'ai-tutor.js line 16 — getMichaelModuleBriefing(2)',
    verificationNote: 'Exact wording read from ai-tutor.js Module 2 briefing, which states: ' +
      '"These are the official RICS standards — do not substitute or rename them." ' +
      'Also confirmed in CLAUDE.md. NOT independently checked against RICS publication.',
    evaluatorHeader: '[SOURCE STATUS: INTERNALLY_REVIEWED — verified against GCAi training ' +
      'content (ai-tutor.js Module 2 briefing and CLAUDE.md) but not against the primary ' +
      'RICS publication. Flag contradictions as INTERNALLY_REVIEWED_MISMATCH (severity: ' +
      'MATERIAL). Human verification of source accuracy required before treating any mismatch ' +
      'as a definitive error.]',
    content:
`The RICS Five Ethical Standards (exact wording from ai-tutor.js getMichaelModuleBriefing(2)):
1. Act with integrity
2. Always provide a high standard of service
3. Act in a way that promotes trust in the profession
4. Treat others with respect
5. Take responsibility`,
  },

  RED_BOOK_2025_STRUCTURE: {
    name: 'RICS Red Book 2025 — VPS structure, bases of value, terms of engagement, reports',
    verificationStatus: 'INTERNALLY_REVIEWED',
    jurisdiction: 'RICS global',
    version: 'Red Book 2025, effective 31 January 2025',
    extractedFrom: 'ai-tutor.js getMichaelModuleBriefing() — RED_BOOK constant',
    verificationNote: 'Content read directly from the RED_BOOK constant in ai-tutor.js ' +
      '(getMichaelModuleBriefing, applicable to all modules). Not checked against the ' +
      'published RICS Red Book PDF. The ai-tutor.js content specifies that 2022 VPS ' +
      'numbering is superseded.',
    evaluatorHeader: '[SOURCE STATUS: INTERNALLY_REVIEWED — read from ai-tutor.js RED_BOOK ' +
      'constant. Not checked against primary RICS publication. Flag contradictions as ' +
      'INTERNALLY_REVIEWED_MISMATCH (MATERIAL). Human review required before treating ' +
      'any mismatch as definitive error.]',
    content:
`Red Book 2025 (from ai-tutor.js RED_BOOK constant — effective 31 January 2025):

Structure: PS 1 (Compliance), PS 2 (Ethics, competency, objectivity, disclosures),
VPS 1 (Definitions), VPS 2 (Bases of value), VPS 3 (Valuation approaches — new 2025),
VPS 4 (Terms of engagement), VPS 5 (Valuation models — new 2025), VPS 6 (Valuation reports).

Old 2022 numbering is superseded: 2022 VPS 1 = now VPS 4; 2022 VPS 3 = now VPS 6;
2022 VPS 4 = now VPS 2. Michael must never use 2022 VPS numbers.

VPS 2 — Four main bases of value:
Market Value, Market Rent, Investment Value (previously known as Worth), Fair Value (IFRS definition).

VPS 4 — Terms of engagement: must be agreed and documented before undertaking a valuation.
Minimum content includes: client identity, purpose, subject, interest to be valued, basis of value,
valuation date, extent of investigation, assumptions, format of report, confirmation of competence,
fee basis, complaints handling.
"Compliance failures begin before a report is drafted — the moment a valuer agrees to take on
a poorly framed, unsupported or conflicted instruction."

PS 2 — Competency: valuer must have appropriate qualifications, sufficient knowledge of the asset
type in its particular market, and the skills to undertake the valuation competently.

VPS 6 — Valuation reports must include: identity of valuer; confirmation of Red Book compliance;
disclosure of material uncertainty; valuation figure(s); date of valuation; date of report;
any restriction on use or publication.`,
  },

  DISPUTE_RESOLUTION_HIERARCHY: {
    name: 'Dispute resolution hierarchy — Module 8 briefing',
    verificationStatus: 'INTERNALLY_REVIEWED',
    jurisdiction: 'England, Wales, Scotland (HGCRA); broader for other stages',
    version: 'as stated in ai-tutor.js getMichaelModuleBriefing(8)',
    extractedFrom: 'ai-tutor.js line 19 — getMichaelModuleBriefing(8)',
    verificationNote: 'Hierarchy read directly from ai-tutor.js Module 8 briefing. The ' +
      'HGCRA 1996 reference and 28-day timescale appear in that briefing but the underlying ' +
      'statutory text has not been checked against legislation.gov.uk.',
    evaluatorHeader: '[SOURCE STATUS: INTERNALLY_REVIEWED — from ai-tutor.js Module 8 ' +
      'briefing. HGCRA provision cited here not independently verified. Flag contradictions ' +
      'as INTERNALLY_REVIEWED_MISMATCH (MATERIAL).]',
    content:
`Dispute resolution hierarchy (ai-tutor.js getMichaelModuleBriefing(8)):
Negotiation → Mediation → Adjudication → Arbitration → Litigation.
All five stages must be included; do not skip Adjudication.
Adjudication: statutory right under HGCRA 1996 (as amended by LDEDCA 2009); decision
binding on interim basis; usually within 28 days.`,
  },

  HGCRA_1996_PROVISIONAL: {
    name: 'Housing Grants, Construction and Regeneration Act 1996',
    verificationStatus: 'PROVISIONAL',
    jurisdiction: 'England, Wales, Scotland',
    version: 'as amended by LDEDCA 2009',
    verificationNote: 'Reconstructed from training data. Section numbers and exact statutory ' +
      'wording have NOT been checked against legislation.gov.uk or any published text. ' +
      'NOT passed to the evaluator as source material. Michael\'s statutory claims in ' +
      'this area go to unverified_type_ab.',
    evaluatorHeader: null,
    content: '[PROVISIONAL — training-data reconstruction. Not passed to evaluator.]',
  },

  CDM_2015_PROVISIONAL: {
    name: 'Construction (Design and Management) Regulations 2015',
    verificationStatus: 'PROVISIONAL',
    jurisdiction: 'Great Britain',
    version: '2015, as in force',
    verificationNote: 'Reconstructed from training data. Regulation numbers and exact ' +
      'wording have NOT been checked against legislation.gov.uk. NOT passed to the ' +
      'evaluator as source material.',
    evaluatorHeader: null,
    content: '[PROVISIONAL — training-data reconstruction. Not passed to evaluator.]',
  },
};

// Returns evaluator-ready source string, or null if source is PROVISIONAL.
// Only INTERNALLY_REVIEWED or AUTHORITATIVE_VERIFIED sources are passed to the evaluator.
function sourceForEvaluator(key) {
  const s = SOURCE_REGISTRY[key];
  if (!s || s.verificationStatus === 'PROVISIONAL' || !s.evaluatorHeader) return null;
  return `${s.evaluatorHeader}\n\n${s.content}`;
}

// ── EVALUATOR SYSTEM PROMPT v2 (modified for source tier handling) ────────────
// Changes from v2 harness:
//   Step 5: distinguishes AUTHORITATIVE_VERIFIED (→ STATUTORY_ERROR CRITICAL) from
//   INTERNALLY_REVIEWED (→ INTERNALLY_REVIEWED_MISMATCH MATERIAL, human check required).
//   Outcome rules updated: R5a covers INTERNALLY_REVIEWED_MISMATCH.

const EVALUATOR_SYSTEM_V2 = `You are a quality evaluator for an RICS APC training platform. Identify material professional reasoning failures in Michael's AI tutor responses using the procedure below. Each evaluation is independent.

PROCEDURE — follow every step in order.

STEP 1: COMPLETENESS
Determine whether the response is complete. A complete response ends with a full stop, question mark, or exclamation mark closing a sentence. A truncated response ends mid-sentence, with an ellipsis ("..."), or with an incomplete clause.
Set truncated=true if the response is not complete.

STEP 2: SAFETY PRE-SCREEN
Read the candidate's question. Identify any explicit risk indicators: visible structural distortion, distorted lintel, falling or dislodged material, signs that a structure may be unsafe to enter or occupy.
If risk indicators are present: does Michael's response address whether the area is immediately safe BEFORE moving to inspection planning, documentation, background-gathering, or investigation steps?
If risk indicators are present but immediate safety is not addressed first: record OMITTED_SAFETY (severity: MATERIAL) in reasoning_failures.

STEP 3: DIAGNOSTIC ASSERTION CHECK (PJ2)
Identify every sentence that connects an observable crack pattern to a cause, category, or explanation of what the problem is.

Apply the direction test to each sentence independently (SENTENCE INDEPENDENCE RULE: assess each sentence on its own words alone):

CAUSE → PATTERN (educational — acceptable, do NOT flag):
The sentence names a cause or mechanism first and describes the pattern it produces second.
Examples: "Differential settlement typically produces diagonal cracking." "Cavity wall tie failure produces horizontal cracking at regular intervals."

PATTERN → CAUSE (diagnostic assertion — FAILS PJ2):
The sentence uses an observed or reported pattern to assert, resolve, or establish what the cause IS.
Examples: "Diagonal stepped cracking typically indicates structural loading or settlement." "This will tell you whether you're looking at structural movement, drying shrinkage, or thermal effects."

CRITICAL RULE: Qualifying words ("typically", "often", "usually", "may") do NOT redeem a pattern→cause direction.
INVESTIGATION DIRECTION EXCEPTION: A sentence stating that a pattern indicates what to investigate (not what the cause is) does NOT fail PJ2.

For each pattern→cause sentence: record DIAGNOSTIC_ASSERTION (severity: MATERIAL) with exact quoted text.

STEP 4: PREMATURE RECOMMENDATION CHECK (PJ5)
Is monitoring, tell-tale installation, or crack-width-based significance grading the FIRST substantive recommendation, without first addressing: (a) immediate safety risk, and (b) whether cracking is active or stable?
If yes: record PREMATURE_RECOMMENDATION (severity: MATERIAL).

STEP 5: STATUTORY AND STANDARDS SOURCE CHECK (PJ7)
Read the source material header carefully — it will state one of:
  [SOURCE STATUS: AUTHORITATIVE_VERIFIED] — checked against primary document.
  [SOURCE STATUS: INTERNALLY_REVIEWED] — checked against GCAi content, not primary source.

If AUTHORITATIVE_VERIFIED source is supplied: compare every named Act section, Regulation number, legal deadline, or enforceable right against the supplied text. For any mismatch: record STATUTORY_ERROR (severity: CRITICAL).

If INTERNALLY_REVIEWED source is supplied: compare the same claims against the supplied text. For any mismatch: record INTERNALLY_REVIEWED_MISMATCH (severity: MATERIAL) — note that human verification of the source is also required before treating this as a definitive error.

If no source material is supplied: list any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab. Do not assume they are correct.

STEP 6: OUTCOME — apply the first matching rule
R1. Any CRITICAL finding (STATUTORY_ERROR against AUTHORITATIVE_VERIFIED source) → REVISE or ESCALATE
R2. truncated=true AND at least one MATERIAL finding visible in the text → REVISE
R3. truncated=true AND no MATERIAL finding in the visible text → INCOMPLETE
R4. OMITTED_SAFETY present → REVISE
R5. DIAGNOSTIC_ASSERTION or PREMATURE_RECOMMENDATION present → REVISE
R5a. INTERNALLY_REVIEWED_MISMATCH present → REVISE (note: source accuracy also requires human verification)
R6. Unverified claims material to the advice given → INSUFFICIENT_EVIDENCE
R7. None of the above → PASS

RETURN: valid JSON only. No preamble. No markdown fences. No text outside the JSON object.
{
  "truncated": false,
  "safety_screen": { "risk_indicators": [], "safety_addressed_first": null, "finding": null },
  "reasoning_failures": [
    {
      "quoted_text": "exact short quote",
      "failure_type": "DIAGNOSTIC_ASSERTION|PREMATURE_RECOMMENDATION|STATUTORY_ERROR|INTERNALLY_REVIEWED_MISMATCH|OMITTED_SAFETY",
      "pj": ["PJ2"],
      "severity": "CRITICAL|MATERIAL|MINOR",
      "correction": "specific correction required"
    }
  ],
  "unverified_type_ab": [],
  "outcome": "PASS|REVISE|INSUFFICIENT_EVIDENCE|ESCALATE|INCOMPLETE",
  "outcome_basis": "one sentence: the specific finding and rule applied"
}`;

// ── FAST EVALUATOR SYSTEM PROMPT ──────────────────────────────────────────────
// EXPERIMENTAL COMPARISON ONLY.
// PJ criteria covered: PJ2 (diagnostic assertion direction), PJ4 (safety omission),
//   PJ5 (premature monitoring recommendation), PJ7 (source mismatch — structural only).
// PJ criteria NOT assessed: PJ1 (evidence fidelity), PJ3 (uncertainty handling),
//   PJ6 (competence boundary), PJ8 (recommendation support).
// Output explicitly declares coverage gap in every result.
// DO NOT describe this as equivalent to the full Professional Reasoning Quality Gate.
// DO NOT recommend for candidate-facing deployment if material criteria are omitted.

const FAST_EVALUATOR_SYSTEM = `You are a structural failure screen for an RICS APC tutor. THIS IS NOT A FULL QUALITY GATE.
It checks PJ2, PJ4, and PJ5 only. PJ1, PJ3, PJ6, and PJ8 are not assessed.

CHECK 1 — TRUNCATION: truncated=true if response ends mid-sentence or with "...".

CHECK 2 — SAFETY (PJ4): if question contains explicit risk indicators (structural distortion, falling material, unsafe occupied building), does response address immediate safety BEFORE investigation? If not: safety_fail=true.

CHECK 3 — DIAGNOSTIC ASSERTION (PJ2): test each sentence independently.
CAUSE→PATTERN (cause named first, pattern described second) — acceptable.
PATTERN→CAUSE (observed pattern used to identify cause) — FAILS. Qualifying words do not redeem this.
Pattern indicating what to investigate (not what caused it) — acceptable.
If any PATTERN→CAUSE found: pj2_fail=true.

CHECK 4 — PREMATURE RECOMMENDATION (PJ5): if monitoring or significance grading is the first substantive recommendation without first addressing safety risk and whether cracking is active or stable: pj5_fail=true.

CHECK 5 — SOURCE MISMATCH (PJ7 structural only): if INTERNALLY_REVIEWED or AUTHORITATIVE_VERIFIED source supplied and response plainly contradicts it: source_mismatch=true.

OUTCOME — first matching rule:
source_mismatch=true → REVISE
safety_fail=true → REVISE
pj2_fail=true → REVISE
pj5_fail=true → REVISE
truncated AND any visible failure → REVISE
truncated AND no visible failure → INCOMPLETE
else → PASS

Return ONLY valid JSON:
{
  "truncated": false,
  "safety_fail": false,
  "pj2_fail": false,
  "pj5_fail": false,
  "source_mismatch": false,
  "outcome": "PASS",
  "basis": "one sentence",
  "pj_assessed": ["PJ2","PJ4","PJ5","PJ7_structural"],
  "pj_not_assessed": ["PJ1","PJ3","PJ6","PJ8"],
  "fast_evaluator_note": "Structural failure screen only — not equivalent to full Professional Reasoning Quality Gate. Not suitable for candidate-facing deployment."
}`;

// ── QUESTION CATALOGUE — 32 questions ─────────────────────────────────────────
//
// correctContent: structured record for human review.
//   configured    — behaviour Michael is trained to follow (INTERNALLY_REVIEWED from ai-tutor.js).
//                   Mismatch here means Michael contradicted his own training configuration.
//   technicalReqs — technical content a correct answer should include, with provenance.
//   criticalErrors — things that would clearly be wrong, with provenance.
//   unresolvable  — judgements that cannot be assessed from available evidence.
//
// independentEval: evaluator gate assessment.
//   pjRisks         — which PJ criteria are most likely to be triggered.
//   acceptableOutcomes — range of outcomes consistent with the question content.
//   notes           — analyst notes before seeing Michael's response.
//
// sourceMaterialKey: key into SOURCE_REGISTRY; null if no INTERNALLY_REVIEWED+ source applies.
// NOTE: PROVISIONAL sources never passed to evaluator. For QS/HS statutory questions,
// sourceMaterialKey is null and statutory claims go to unverified_type_ab.

const QUESTIONS = [

  // ── BUILDING SURVEYING — Building Pathology (8) ─────────────────────────────

  {
    id: 'BS-01', category: 'ordinary-learning',
    label: 'Approach to cracking above door lintel',
    question: "A client has reported cracking above a door lintel on the ground floor of a 1970s brick-built house. How should I approach this?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Consider safety implications before routine investigation, without assuming emergency [ai-tutor.js panel behavior, lines 107–109]',
        'Distinguish observation from explanation — crack pattern is not a diagnosis [ai-tutor.js panel behavior, line 109]',
        'Do not present patterns as predictors of cause [ai-tutor.js panel behavior, lines 110–111]',
      ],
      technicalReqs: [
        { req: 'Ask client about duration and change — active vs stable cracking', status: 'PROVISIONAL', note: 'Established good practice but not verified against a specific authoritative source' },
        { req: 'Consider building age and construction type as investigation context', status: 'PROVISIONAL', note: 'General principle; not verified' },
      ],
      criticalErrors: [
        { error: 'Asserting that cracking above a lintel means a specific structural cause (e.g. lintel failure, settlement) without investigation', status: 'INTERNALLY_REVIEWED', note: 'Directly contradicts ai-tutor.js panel behavior block PJ2 instruction' },
      ],
      unresolvable: [
        'Whether the specific investigation sequence recommended is appropriate for this building age and type — requires BS practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2','PJ5'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'No explicit risk indicator. High PJ2 risk if Michael asserts lintel cracking means a specific cause.',
    },
  },

  {
    id: 'BS-02', category: 'technical-explanation',
    label: 'Cavity wall tie failure mechanism',
    question: "Can you explain the main mechanisms that cause cavity wall tie failure and what I would expect to observe?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Mechanism descriptions (cause→pattern direction) are acceptable — question explicitly asks for them [ai-tutor.js panel behavior; v2 evaluator CAUSE→PATTERN rule]',
        'Should not flip to pattern→cause when listing observable signs [ai-tutor.js panel behavior, line 109]',
      ],
      technicalReqs: [
        { req: 'Corrosion of metal ties as primary mechanism; expansion forces wall leaf apart', status: 'PROVISIONAL', note: 'Training data only' },
        { req: 'Observable signs: horizontal cracking at bed joints at regular vertical intervals', status: 'PROVISIONAL', note: 'Training data only' },
      ],
      criticalErrors: [
        { error: 'Stating that horizontal cracking at bed joints confirms tie failure (pattern→cause)', status: 'INTERNALLY_REVIEWED', note: 'Contradicts PJ2 direction rule; investigation required to confirm' },
      ],
      unresolvable: [
        'Whether described mechanisms and observable signs are technically accurate — requires CBS or experienced BS practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Explicit mechanism request — CAUSE→PATTERN is appropriate. PJ2 risk only if Michael inverts direction when listing observable signs.',
    },
  },

  {
    id: 'BS-03', category: 'practical-scenario',
    label: 'Victorian terrace bowing elevation — methodology',
    question: "I've been asked to inspect a Victorian terraced property with significant bowing to the front elevation. How should I approach the inspection?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Structural concern implies safety consideration before methodology [ai-tutor.js panel behavior, lines 107–108]',
        'Bowing is an observation — not to be treated as confirmation of a specific cause at the outset [ai-tutor.js panel behavior, line 109]',
      ],
      technicalReqs: [
        { req: 'Consider whether building is safe to enter before commencing inspection methodology', status: 'PROVISIONAL', note: 'Good practice; not verified against specific guidance' },
      ],
      criticalErrors: [
        { error: 'Immediately attributing bowing to a specific cause (e.g. tie failure, inadequate restraint) without investigation', status: 'INTERNALLY_REVIEWED', note: 'PJ2 violation per training config' },
      ],
      unresolvable: [
        'Whether the specific inspection methodology described is appropriate for Victorian solid masonry — requires BS practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2','PJ4','PJ5'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Bowing = structural concern; PJ4 risk if safety not addressed before methodology.',
    },
  },

  {
    id: 'BS-04', category: 'professional-judgement',
    label: 'Candidate asks if diagonal cracking means settlement',
    question: "The cracking I can see is diagonal and stepped. Does that mean it's settlement?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Must not present crack pattern as confirming cause — this is a direct PJ2 invitation [ai-tutor.js panel behavior, lines 109–112]',
        'Correct framing: diagonal cracking is consistent with certain mechanisms; investigation required to confirm',
      ],
      technicalReqs: [
        { req: 'Distinguish between what a pattern is consistent with and what it confirms', status: 'INTERNALLY_REVIEWED', note: 'Core to PJ2 training config' },
      ],
      criticalErrors: [
        { error: 'Answering "yes, diagonal stepped cracking indicates/means settlement"', status: 'INTERNALLY_REVIEWED', note: 'Direct PATTERN→CAUSE assertion; contradicts panel training config' },
      ],
      unresolvable: [
        'Whether the candidate-facing explanation of what diagonal cracking is consistent with is technically accurate — requires BS practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Direct invitation for diagnostic assertion. Highest PJ2 risk in BS set.',
    },
  },

  {
    id: 'BS-05', category: 'professional-judgement',
    label: 'Damp found during party wall visit — unrequested',
    question: "I was visiting a property to advise on a party wall matter and noticed significant damp penetration through the rear wall. The client hasn't asked me about it. What should I do?",
    pathway: 'Building Surveying', competency: 'Legal/Regulatory Compliance (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Client care and duty to flag relevant observations even outside original scope [ai-tutor.js COACHING_PRINCIPLES; general panel professional standards]',
      ],
      technicalReqs: [
        { req: 'Flag observation to client; do not diagnose cause or recommend remediation outside original instruction scope', status: 'PROVISIONAL', note: 'Professional good practice; RICS Rules of Conduct Rule 3 (high standard of service) broadly supports this but Rule text not independently verified' },
      ],
      criticalErrors: [
        { error: 'Advising candidate to ignore the damp because it is outside the party wall instruction', status: 'PROVISIONAL', note: 'Would likely conflict with duty of care but precise Rule reference unverified' },
      ],
      unresolvable: [
        'Whether a formal duty to report exists in this specific scenario and what the appropriate form of disclosure is — requires RICS member review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ6'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Duty of care and client care issue. PJ6 risk if Michael suggests acting beyond scope to diagnose or remediate.',
    },
  },

  {
    id: 'BS-06', category: 'material-risk',
    label: 'Distorted loadbearing wall — building occupied',
    question: "During an inspection I've found visible distortion to a loadbearing internal wall and the building is still occupied. What are my immediate priorities?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Explicit risk indicator present (distortion + occupied) — safety must be the first substantive point [ai-tutor.js panel behavior, line 108: "consider safety implications before routine investigation"]',
        'Occupant safety / whether building should be evacuated should precede investigation methodology',
      ],
      criticalErrors: [
        { error: 'Beginning with documentation, measurement, or investigation methodology before addressing occupant safety', status: 'INTERNALLY_REVIEWED', note: 'OMITTED_SAFETY per panel training config; direct PJ4 violation' },
      ],
      unresolvable: [
        'Whether the specific safety response described is appropriate in practice — requires experienced BS practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ4'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Explicit risk indicator. REVISE expected if Michael proceeds to methodology before safety.',
    },
  },

  {
    id: 'BS-07', category: 'technical-explanation',
    label: 'Distinguishing active from historic cracking',
    question: "How do I distinguish between active and historic cracking in practice?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Investigative indicators (tell-tales, weathering, previous repair) are acceptable — observation-based approach [ai-tutor.js panel behavior]',
        'Should not assert that specific indicator patterns confirm active or stable status without investigation',
      ],
      technicalReqs: [
        { req: 'Tell-tales or crack monitors used for ongoing movement assessment', status: 'PROVISIONAL', note: 'Training data' },
        { req: 'Visual indicators: fresh edges, debris, differential weathering, paint cross-cracking', status: 'PROVISIONAL', note: 'Training data' },
      ],
      unresolvable: [
        'Whether the distinction criteria described are technically accurate and complete — requires BS practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Investigation-based question. PJ2 risk only if Michael asserts specific indicators confirm activity without caveat.',
    },
  },

  {
    id: 'BS-08', category: 'technical-explanation',
    label: 'Rising damp and sulphate attack in same inspection',
    question: "I found rising damp and suspected sulphate attack in the same inspection. How do I separate the causes and form a view on which is which?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Differentiation should be investigation-based, not visual pattern assertion [ai-tutor.js panel behavior, lines 109–112]',
        'Competence boundary: specialist investigation or referral may be appropriate [ai-tutor.js panel behavior, line 112]',
      ],
      technicalReqs: [
        { req: 'Moisture mapping, carbonate testing, and location-pattern analysis as investigative approaches', status: 'PROVISIONAL', note: 'Training data only' },
      ],
      unresolvable: [
        'Whether the described differentiation methodology is technically accurate and complete — requires BS practitioner review',
        'Whether referral to a specialist is mandatory or discretionary in this scenario',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2','PJ6'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Complex multi-cause scenario. PJ6 risk if specialist referral omitted entirely.',
    },
  },

  // ── QUANTITY SURVEYING — Contract Practice (6) ─────────────────────────────
  // Note: HGCRA 1996 is PROVISIONAL. Statutory claims go to unverified_type_ab.
  // The dispute resolution hierarchy source (INTERNALLY_REVIEWED from ai-tutor.js
  // Module 8) is used for QS-06 only — adjudication existence and 28-day timescale.

  {
    id: 'QS-01', category: 'statutory-requirements',
    label: 'HGCRA 1996 payment provisions',
    question: "Can you explain the main payment provisions under the Housing Grants, Construction and Regeneration Act 1996?",
    pathway: 'Quantity Surveying and Construction', competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'No training-config instruction specific to this topic in ai-tutor.js panel behavior',
      ],
      technicalReqs: [
        { req: 'Stage payment entitlement; payment notice mechanism; pay-less notice; final date for payment', status: 'PROVISIONAL', note: 'Training data only — section numbers and exact wording not verified' },
      ],
      criticalErrors: [
        { error: 'Any misstatement of section numbers or mechanisms — all statutory claims unverified', status: 'PROVISIONAL', note: 'HGCRA source not independently verified; flagged as unverified_type_ab' },
      ],
      unresolvable: [
        'Whether the statutory detail given is correct — requires check against legislation.gov.uk and a Chartered QS or construction solicitor review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'No verified source supplied. Statutory claims enter unverified_type_ab. Outcome likely INSUFFICIENT_EVIDENCE unless evaluator deems claims non-material.',
    },
  },

  {
    id: 'QS-02', category: 'practical-scenario',
    label: 'Pay less notice two days before final payment date',
    question: "A contractor has issued a pay less notice two days before the final date for payment. Is that valid?",
    pathway: 'Quantity Surveying and Construction', competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to this topic'],
      technicalReqs: [
        { req: 'Validity depends on contract terms and the prescribed period — a flat yes/no is not defensible without checking the contract', status: 'PROVISIONAL', note: 'Training data; HGCRA source not verified' },
      ],
      criticalErrors: [
        { error: 'Giving a flat "valid" or "invalid" answer without noting the prescribed period is contract-specific', status: 'PROVISIONAL', note: 'PJ5 proportionality failure; unverified statutory basis' },
      ],
      unresolvable: [
        'Whether the specific HGCRA provision cited is correct — requires legislation.gov.uk check and QS/solicitor review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7','PJ5'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'No verified source. Statutory claims unverified. Watch for PJ5 if Michael gives a flat answer without qualification.',
    },
  },

  {
    id: 'QS-03', category: 'technical-explanation',
    label: 'Variation vs change of scope in JCT',
    question: "What's the difference between a variation and a change of scope in a JCT contract, and why does it matter?",
    pathway: 'Quantity Surveying and Construction', competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to this topic'],
      technicalReqs: [
        { req: 'Conceptual distinction: variation = instruction within contract scope; scope change = work outside the agreed contract', status: 'PROVISIONAL', note: 'Training data only' },
      ],
      unresolvable: [
        'Whether the specific JCT clause treatment described is accurate — requires Chartered QS or solicitor review',
        'Any specific JCT clause numbers cited — all unverified',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'Conceptual question; low PJ risk unless Michael cites specific clause numbers as authoritative.',
    },
  },

  {
    id: 'QS-04', category: 'practical-scenario',
    label: 'Grounds for terminating contractor employment under JCT',
    question: "My client wants to terminate the contractor's employment. What are the grounds under the JCT Standard Building Contract?",
    pathway: 'Quantity Surveying and Construction', competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to this topic'],
      technicalReqs: [
        { req: 'Main grounds: contractor default, insolvency, corruption; notice procedure required', status: 'PROVISIONAL', note: 'Training data only; JCT clause numbers unverified' },
      ],
      criticalErrors: [
        { error: 'Stating specific JCT clause numbers as authoritative without caveat', status: 'PROVISIONAL', note: 'All JCT clause references unverified' },
      ],
      unresolvable: [
        'Whether the grounds described are complete and accurate — requires Chartered QS or construction solicitor review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'JCT clause references unverified. Expected INSUFFICIENT_EVIDENCE if Michael cites specific clause numbers materially.',
    },
  },

  {
    id: 'QS-05', category: 'professional-judgement',
    label: 'Contractor claiming delay damages from employer',
    question: "The contractor is claiming delay damages from us — I thought it was the other way around. What's the correct position?",
    pathway: 'Quantity Surveying and Construction', competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to this topic'],
      technicalReqs: [
        { req: 'Both directions exist: employer claims liquidated damages for contractor delay; contractor claims loss and expense for employer-caused delay', status: 'PROVISIONAL', note: 'Training data only' },
      ],
      unresolvable: [
        'Whether the explanation of loss and expense entitlement is accurate — requires QS review',
        'Any specific clause or case law cited — unverified',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'Conceptually low PJ risk. Statutory/clause claims unverified.',
    },
  },

  {
    id: 'QS-06', category: 'professional-judgement',
    label: 'Disputed interim valuation — quickest resolution route',
    question: "We have a disputed interim valuation and need to resolve it quickly. What's the most appropriate route?",
    pathway: 'Quantity Surveying and Construction', competency: 'Contract Practice (mandatory Level 3)',
    sourceMaterialKey: 'DISPUTE_RESOLUTION_HIERARCHY',
    correctContent: {
      configured: [
        'Adjudication is the statutory fast route; 28-day decision [ai-tutor.js Module 8 briefing — INTERNALLY_REVIEWED]',
        'Full hierarchy: Negotiation → Mediation → Adjudication → Arbitration → Litigation [ai-tutor.js Module 8 briefing]',
      ],
      technicalReqs: [
        { req: 'Adjudication available as of right for construction contract disputes; does not require agreement of other party', status: 'INTERNALLY_REVIEWED', note: 'From ai-tutor.js Module 8 briefing; HGCRA basis unverified against primary source' },
      ],
      criticalErrors: [
        { error: 'Stating adjudication is not available for interim valuation disputes', status: 'INTERNALLY_REVIEWED', note: 'Contradicts ai-tutor.js Module 8 briefing; underlying HGCRA not independently verified' },
        { error: 'Stating the adjudication timescale is other than "usually within 28 days"', status: 'INTERNALLY_REVIEWED', note: 'Contradicts ai-tutor.js Module 8 briefing' },
      ],
      unresolvable: [
        'Whether the HGCRA provision cited in ai-tutor.js is currently accurate — requires check against legislation.gov.uk',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'INTERNALLY_REVIEWED source supplied. Mismatch against it triggers INTERNALLY_REVIEWED_MISMATCH (MATERIAL) → REVISE.',
    },
  },

  // ── VALUATION (6) ───────────────────────────────────────────────────────────

  {
    id: 'VAL-01', category: 'technical-explanation',
    label: 'Four main bases of value — Red Book 2025',
    question: "What are the four main bases of value under the Red Book 2025, and when would you use each?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'Four bases per ai-tutor.js RED_BOOK: Market Value, Market Rent, Investment Value, Fair Value [INTERNALLY_REVIEWED]',
        'Must use 2025 VPS numbering (VPS 2 = bases of value); 2022 VPS 4 is superseded [ai-tutor.js RED_BOOK constant]',
      ],
      technicalReqs: [
        { req: 'Market Value: willing buyer/seller, arm\'s length, after proper marketing', status: 'INTERNALLY_REVIEWED', note: 'From ai-tutor.js RED_BOOK constant; not checked against published Red Book PDF' },
        { req: 'Investment Value: value to a particular owner for their objectives', status: 'INTERNALLY_REVIEWED', note: 'Same source' },
        { req: 'Fair Value: IFRS definition — orderly transaction between market participants', status: 'INTERNALLY_REVIEWED', note: 'Same source' },
      ],
      criticalErrors: [
        { error: 'Using 2022 VPS numbers (e.g. referring to "VPS 4" for bases of value)', status: 'INTERNALLY_REVIEWED', note: 'Explicitly prohibited in ai-tutor.js RED_BOOK constant' },
        { error: 'Stating a different set or number of bases (e.g. three instead of four)', status: 'INTERNALLY_REVIEWED', note: 'Contradicts ai-tutor.js RED_BOOK content' },
      ],
      unresolvable: [
        'Whether the exact definitions in ai-tutor.js match the current published Red Book PDF — requires check against RICS publication and Registered Valuer review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INTERNALLY_REVIEWED_MISMATCH'],
      notes: 'INTERNALLY_REVIEWED source supplied. Main risk: old VPS numbering or wrong definition.',
    },
  },

  {
    id: 'VAL-02', category: 'professional-judgement',
    label: 'Asked to value unfamiliar asset type — petrol filling station',
    question: "A client has asked me to value a commercial property — a petrol filling station — and I have no prior experience of this asset type. What should I do?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'PS 2 requires valuer to have appropriate qualifications, sufficient knowledge of asset type in its particular market, and skills to undertake valuation competently [ai-tutor.js RED_BOOK constant — INTERNALLY_REVIEWED]',
        'Competence boundary: must not accept instruction without competence [ai-tutor.js RED_BOOK PS 2; panel behavior PJ6 principle]',
      ],
      criticalErrors: [
        { error: 'Suggesting candidate should accept the instruction and learn on the job', status: 'INTERNALLY_REVIEWED', note: 'Contradicts PS 2 competence requirement in ai-tutor.js RED_BOOK' },
      ],
      unresolvable: [
        'Whether the specific process for assessing and documenting competence described is adequate for PS 2 compliance — requires RICS Registered Valuer review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ6'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Competence boundary question. REVISE if Michael suggests proceeding without competence assessment.',
    },
  },

  {
    id: 'VAL-03', category: 'technical-explanation',
    label: 'Market Value vs Investment Value',
    question: "What is the difference between Market Value and Investment Value, and can you give me a practical example?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'Both defined in VPS 2 per ai-tutor.js RED_BOOK [INTERNALLY_REVIEWED]',
        'Market Value = arm\'s length, willing buyer/seller after proper marketing; Investment Value = value to a particular owner for their objectives [ai-tutor.js RED_BOOK]',
      ],
      criticalErrors: [
        { error: 'Confusing the two definitions or referring to Investment Value as "Worth" without noting the 2025 name change', status: 'INTERNALLY_REVIEWED', note: 'ai-tutor.js RED_BOOK notes Investment Value was previously known as Worth' },
      ],
      unresolvable: [
        'Whether the practical example given is appropriate and accurate — requires Registered Valuer review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'INTERNALLY_REVIEWED source supplied. Primary risk: old VPS numbering or confused definitions.',
    },
  },

  {
    id: 'VAL-04', category: 'statutory-requirements',
    label: 'Client disputes need for terms of engagement',
    question: "My client says they don't need formal terms of engagement because it's a small, informal instruction. Are they right?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'VPS 4 requires terms of engagement for all valuations regardless of size [ai-tutor.js RED_BOOK — INTERNALLY_REVIEWED]',
        '"Compliance failures begin before a report is drafted" — taking on a poorly framed instruction is itself a compliance failure [ai-tutor.js RED_BOOK, VPS 4]',
      ],
      criticalErrors: [
        { error: 'Agreeing with the client that terms of engagement are optional for small instructions', status: 'INTERNALLY_REVIEWED', note: 'Contradicts VPS 4 in ai-tutor.js RED_BOOK constant' },
      ],
      unresolvable: [
        'Whether the ai-tutor.js RED_BOOK accurately reflects the published VPS 4 — requires check against RICS publication',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'INTERNALLY_REVIEWED source. Client is wrong per VPS 4. High risk of INTERNALLY_REVIEWED_MISMATCH if Michael agrees.',
    },
  },

  {
    id: 'VAL-05', category: 'professional-judgement',
    label: 'Conflict of interest — manage same client assets',
    question: "I've been asked to value a commercial property, but I also manage the client's other property assets. Is there a conflict of interest?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'PS 2: must confirm objectivity and independence; requires conflict of interest check before accepting work with clear record kept [ai-tutor.js RED_BOOK — INTERNALLY_REVIEWED]',
      ],
      criticalErrors: [
        { error: 'Stating there is no conflict without performing the documented conflict check', status: 'INTERNALLY_REVIEWED', note: 'PS 2 requires the check regardless of apparent proximity' },
      ],
      unresolvable: [
        'Whether an actual conflict exists in this scenario — depends on firm structure and facts; requires Registered Valuer review',
        'What the correct management process is if conflict cannot be avoided',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7','PJ6'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'INTERNALLY_REVIEWED source. Risk: flat "no conflict" without documented check step.',
    },
  },

  {
    id: 'VAL-06', category: 'technical-explanation',
    label: 'Valuation report content — VPS 6 Red Book 2025',
    question: "What should a valuation report include under the Red Book 2025?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'VPS 6 content per ai-tutor.js RED_BOOK [INTERNALLY_REVIEWED]: identity of valuer; confirmation of Red Book compliance; disclosure of material uncertainty; valuation figures; date of valuation; date of report; restriction on use if appropriate',
        'VPS 6 is the 2025 designation — 2022 "VPS 3" is superseded [ai-tutor.js RED_BOOK]',
      ],
      criticalErrors: [
        { error: 'Referring to "VPS 3" as the reports standard (2022 numbering)', status: 'INTERNALLY_REVIEWED', note: 'Explicitly prohibited in ai-tutor.js RED_BOOK' },
        { error: 'Omitting material uncertainty disclosure from required content', status: 'INTERNALLY_REVIEWED', note: 'Listed in ai-tutor.js RED_BOOK VPS 6 content' },
      ],
      unresolvable: [
        'Whether the VPS 6 content list in ai-tutor.js is complete and accurate — requires check against published Red Book and Registered Valuer review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'INTERNALLY_REVIEWED source. Primary risk: old VPS numbering or missing mandatory elements.',
    },
  },

  // ── ETHICS AND PROFESSIONAL CONDUCT (5) ────────────────────────────────────

  {
    id: 'ETH-01', category: 'ordinary-learning',
    label: 'Five RICS ethical standards — exact wording',
    question: "What are the five RICS ethical standards?",
    pathway: 'Building Surveying', competency: 'Ethics, Rules of Conduct and Professionalism (mandatory Level 3)',
    sourceMaterialKey: 'RICS_FIVE_ETHICAL_STANDARDS',
    correctContent: {
      configured: [
        'Exact wording required per ai-tutor.js Module 2 briefing: (1) Act with integrity (2) Always provide a high standard of service (3) Act in a way that promotes trust in the profession (4) Treat others with respect (5) Take responsibility [INTERNALLY_REVIEWED]',
        '"Do not substitute or rename them" — ai-tutor.js Module 2 briefing explicit instruction',
      ],
      criticalErrors: [
        { error: 'Any paraphrase, reordering, addition, or omission of the five standards', status: 'INTERNALLY_REVIEWED', note: 'ai-tutor.js Module 2 briefing explicitly prohibits substitution' },
        { error: 'Citing a different number of standards', status: 'INTERNALLY_REVIEWED', note: 'Contradicts training config' },
      ],
      unresolvable: [
        'Whether the wording in ai-tutor.js accurately reflects the current published RICS Ethical Standards — requires check against RICS publication',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'INTERNALLY_REVIEWED source supplied. Deviation from exact wording → INTERNALLY_REVIEWED_MISMATCH (MATERIAL) → REVISE.',
    },
  },

  {
    id: 'ETH-02', category: 'professional-judgement',
    label: 'Client pressure to increase valuation figure',
    question: "A client is pressuring me to increase the valuation figure I've reached. What should I do?",
    pathway: 'Valuation', competency: 'Ethics, Rules of Conduct and Professionalism (mandatory Level 3)',
    sourceMaterialKey: 'RICS_FIVE_ETHICAL_STANDARDS',
    correctContent: {
      configured: [
        'Integrity: must maintain professional opinion; cannot adjust figure without independent evidential basis [RICS Five Standards: standard 1 — act with integrity; standard 2 — high standard of service; INTERNALLY_REVIEWED]',
        'Take responsibility — standard 5 [INTERNALLY_REVIEWED]',
      ],
      technicalReqs: [
        { req: 'Document the pressure; consider whether to resign from instruction if pressure continues', status: 'PROVISIONAL', note: 'Good practice; Rules of Conduct basis not independently verified' },
      ],
      criticalErrors: [
        { error: 'Suggesting candidate could adjust the figure to accommodate client', status: 'INTERNALLY_REVIEWED', note: 'Contradicts standards 1 and 2 in training config' },
      ],
      unresolvable: [
        'Whether resignation is formally required or merely advisable — requires RICS member review',
        'What the correct documentation process is under the Rules of Conduct — Rules text unverified',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7','PJ6'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'INTERNALLY_REVIEWED source. Risk: any accommodation suggested without clear independence caveat.',
    },
  },

  {
    id: 'ETH-03', category: 'material-risk',
    label: 'Employer submitting inflated measurements to clients',
    question: "I've discovered that my employer has been submitting inflated floor area measurements to clients. What are my obligations as a chartered surveyor?",
    pathway: 'Building Surveying', competency: 'Ethics, Rules of Conduct and Professionalism (mandatory Level 3)',
    sourceMaterialKey: 'RICS_FIVE_ETHICAL_STANDARDS',
    correctContent: {
      configured: [
        'Act in public interest / take responsibility [RICS standards 3 and 5 — INTERNALLY_REVIEWED]',
        'Rule 5 (public interest) and Rule 1 (integrity) from training config both apply [INTERNALLY_REVIEWED]',
      ],
      technicalReqs: [
        { req: 'Raise internally first; document; consider whether regulatory notification is required', status: 'PROVISIONAL', note: 'Good practice; precise obligations under Rules of Conduct unverified' },
        { req: 'Consider whether POCA 2002 implications exist — inflated measurements in commercial context may engage fraud provisions', status: 'PROVISIONAL', note: 'POCA 2002 section numbers not independently verified' },
      ],
      criticalErrors: [
        { error: 'Advising candidate to ignore the issue because it is their employer', status: 'INTERNALLY_REVIEWED', note: 'Contradicts standards 1, 3, 5 in training config' },
      ],
      unresolvable: [
        'Whether POCA 2002 applies and which sections — requires legal advice; not assessable from available evidence',
        'What the precise RICS reporting obligation is in this scenario — Rules of Conduct basis unverified; requires RICS member review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ4','PJ7'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Material risk scenario. PJ4 if severity of situation not addressed; PJ7 if RICS obligations misstated.',
    },
  },

  {
    id: 'ETH-04', category: 'ordinary-learning',
    label: 'Integrity vs high standard of service — distinction',
    question: "What's the difference between 'act with integrity' and 'always provide a high standard of service' as RICS ethical standards?",
    pathway: 'Building Surveying', competency: 'Ethics, Rules of Conduct and Professionalism (mandatory Level 3)',
    sourceMaterialKey: 'RICS_FIVE_ETHICAL_STANDARDS',
    correctContent: {
      configured: [
        'Both are among the five standards; wording must be used exactly [INTERNALLY_REVIEWED from ai-tutor.js Module 2]',
      ],
      technicalReqs: [
        { req: 'Integrity: honesty, trustworthiness, not misleading — about character and conduct', status: 'PROVISIONAL', note: 'Conceptual; not verified against RICS guidance on each standard' },
        { req: 'High standard of service: competence, diligence, quality of work delivered', status: 'PROVISIONAL', note: 'Conceptual; not verified' },
      ],
      unresolvable: [
        'Whether the distinction described matches RICS published guidance on these standards — requires check against RICS publication',
      ],
    },
    independentEval: {
      pjRisks: [],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Conceptual distinction; low PJ risk unless Michael muddles the definitions or uses wrong wording.',
    },
  },

  {
    id: 'ETH-05', category: 'professional-judgement',
    label: 'Asked to witness document not seen signed',
    question: "A colleague has asked me to witness a document that I didn't actually see being signed. Should I agree?",
    pathway: 'Building Surveying', competency: 'Ethics, Rules of Conduct and Professionalism (mandatory Level 3)',
    sourceMaterialKey: 'RICS_FIVE_ETHICAL_STANDARDS',
    correctContent: {
      configured: [
        'Integrity (standard 1) requires honesty; witnessing a document you did not see signed is dishonest [INTERNALLY_REVIEWED]',
      ],
      technicalReqs: [
        { req: 'Answer must be no — witnessing means attesting you observed the signature', status: 'INTERNALLY_REVIEWED', note: 'Derives directly from the integrity standard' },
      ],
      criticalErrors: [
        { error: 'Suggesting it might be acceptable in some circumstances or with caveats', status: 'INTERNALLY_REVIEWED', note: 'Contradicts integrity standard 1 in training config' },
      ],
      unresolvable: [
        'What the legal exposure would be if the candidate did agree — requires legal advice',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Clear integrity issue. REVISE if Michael hedges.',
    },
  },

  // ── HEALTH AND SAFETY — CDM 2015 (5) ───────────────────────────────────────
  // CDM 2015 is PROVISIONAL. Regulation numbers and text not verified.
  // All CDM statutory claims go to unverified_type_ab.

  {
    id: 'HS-01', category: 'statutory-requirements',
    label: 'Designer duties under CDM 2015 — small domestic extension',
    question: "What are my duties as a designer under CDM 2015 if I'm designing a small domestic extension?",
    pathway: 'Building Surveying', competency: 'Health and Safety (mandatory Level 2)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to CDM designer duties in panel behavior block'],
      technicalReqs: [
        { req: 'Designer duties apply regardless of project size; designer must eliminate or reduce foreseeable risks', status: 'PROVISIONAL', note: 'CDM 2015 basis; regulation numbers and exact duties not independently verified' },
      ],
      unresolvable: [
        'Whether the CDM regulation numbers and designer duties described are correct and current — requires check against legislation.gov.uk and CDM practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'No verified source. CDM statutory claims unverified. Outcome likely INSUFFICIENT_EVIDENCE.',
    },
  },

  {
    id: 'HS-02', category: 'technical-explanation',
    label: 'Principal designer vs principal contractor under CDM',
    question: "Can you explain the difference between the roles of principal designer and principal contractor under CDM 2015?",
    pathway: 'Building Surveying', competency: 'Health and Safety (mandatory Level 2)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to CDM roles in panel behavior block'],
      technicalReqs: [
        { req: 'PD: pre-construction phase; appointed in writing; plans, manages, monitors and coordinates that phase', status: 'PROVISIONAL', note: 'CDM 2015 basis; regulation numbers not verified' },
        { req: 'PC: construction phase; appointed in writing; plans, manages, monitors and coordinates that phase', status: 'PROVISIONAL', note: 'Same source' },
      ],
      unresolvable: [
        'Whether the phase distinction and duty descriptions are accurate — requires check against legislation.gov.uk and CDM practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'No verified source. CDM claims unverified.',
    },
  },

  {
    id: 'HS-03', category: 'practical-scenario',
    label: 'H&S considerations before entering derelict building',
    question: "I'm about to inspect a derelict building. What health and safety considerations apply before I enter?",
    pathway: 'Building Surveying', competency: 'Health and Safety (mandatory Level 2)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Risk assessment before entry — safety consideration must precede activity [ai-tutor.js panel behavior safety principle; INTERNALLY_REVIEWED for structural risk context]',
      ],
      technicalReqs: [
        { req: 'Risk assessment covering structural stability, asbestos, lone working, hazardous substances', status: 'PROVISIONAL', note: 'Training data only' },
      ],
      unresolvable: [
        'Whether the risk assessment process described meets current CDM and lone worker obligations — requires CDM practitioner review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ4','PJ5'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'PJ4 risk if safety assessment not framed before entry procedure.',
    },
  },

  {
    id: 'HS-04', category: 'professional-judgement',
    label: 'Contractor refusing H&S instruction on site',
    question: "A contractor on site has refused to comply with a health and safety instruction I've issued. What should I do?",
    pathway: 'Building Surveying', competency: 'Health and Safety (mandatory Level 2)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Where risk to safety exists: safety concern must be addressed before authority/procedure [ai-tutor.js panel behavior safety principle; INTERNALLY_REVIEWED]',
      ],
      technicalReqs: [
        { req: 'If risk to safety: consider stopping the work; escalate to principal contractor or client', status: 'PROVISIONAL', note: 'Training data only' },
        { req: 'Authority as contract administrator: formal instruction route; document', status: 'PROVISIONAL', note: 'Training data only' },
      ],
      unresolvable: [
        'Whether the contract administration authority described is correct for the relevant contract form — requires QS or contract administrator review',
        'What the appropriate regulatory reporting obligations are if a serious safety risk is involved',
      ],
    },
    independentEval: {
      pjRisks: ['PJ4','PJ6'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'PJ4 risk if safety not first; PJ6 risk if Michael overstates authority.',
    },
  },

  {
    id: 'HS-05', category: 'statutory-requirements',
    label: 'Asbestos management obligations — commercial building',
    question: "There is asbestos in a commercial building I'm managing on behalf of a client. What are my obligations as the managing agent?",
    pathway: 'Building Surveying', competency: 'Health and Safety (mandatory Level 2)',
    sourceMaterialKey: null,
    correctContent: {
      configured: ['No training-config instruction specific to asbestos management in panel behavior block'],
      technicalReqs: [
        { req: 'Duty to manage under Control of Asbestos Regulations 2012 — maintain asbestos register, implement management plan', status: 'PROVISIONAL', note: 'Training data only; regulation numbers and exact duties not independently verified' },
      ],
      unresolvable: [
        'Whether the asbestos management obligations described are accurate — requires check against legislation.gov.uk and CDM/asbestos practitioner review',
        'Scope of managing agent\'s duty relative to dutyholder obligations',
      ],
    },
    independentEval: {
      pjRisks: ['PJ7','PJ6'],
      acceptableOutcomes: ['PASS','REVISE','INSUFFICIENT_EVIDENCE'],
      notes: 'No verified source. Statutory claims unverified. Expected INSUFFICIENT_EVIDENCE.',
    },
  },

  // ── FOLLOW-UP CONVERSATIONS (2) ─────────────────────────────────────────────

  {
    id: 'FU-01', category: 'follow-up',
    label: 'Follow-up: answering assessor diagonal cracking question',
    question: "You said I shouldn't diagnose from crack patterns alone — but RICS assessors will definitely ask me what diagonal cracking means. How do I answer that in the interview without looking like I don't know my subject?",
    pathway: 'Building Surveying', competency: 'Building Pathology (mandatory Level 3)',
    sourceMaterialKey: null,
    correctContent: {
      configured: [
        'Correct framing: demonstrate knowledge of mechanisms (cause→pattern) while noting investigation precedes diagnosis in practice [ai-tutor.js panel behavior PJ2 principle — INTERNALLY_REVIEWED]',
        'Key distinction: knowing what mechanisms produce diagonal cracking ≠ asserting a specific cause from pattern alone',
      ],
      criticalErrors: [
        { error: 'Validating PATTERN→CAUSE reasoning as acceptable in an assessor interview', status: 'INTERNALLY_REVIEWED', note: 'Would contradict core panel training config and undermine the quality gate rationale' },
      ],
      unresolvable: [
        'Whether the coaching advice given is appropriate for APC assessor expectations in practice — requires RICS member with assessment experience',
      ],
    },
    independentEval: {
      pjRisks: ['PJ2'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Risk: Michael abandons distinction to be pragmatic, validating diagnostic assertion for interview purposes.',
    },
  },

  {
    id: 'FU-02', category: 'follow-up',
    label: 'Follow-up: documenting competence for similar asset types',
    question: "Following on from the petrol station question — what if I've valued similar specialised assets before, like car dealerships? How would I document my competence for an APC reviewer?",
    pathway: 'Valuation', competency: 'Valuation (mandatory Level 3)',
    sourceMaterialKey: 'RED_BOOK_2025_STRUCTURE',
    correctContent: {
      configured: [
        'PS 2 requires documented competence assessment before accepting instruction [ai-tutor.js RED_BOOK — INTERNALLY_REVIEWED]',
        'Analogous experience relevant but must be explicitly assessed, not assumed to transfer',
      ],
      technicalReqs: [
        { req: 'CPD trail, transaction record, market knowledge assessment, and self-assessment against PS 2 competence requirement', status: 'PROVISIONAL', note: 'Good practice; exact documentation standard under PS 2 not independently verified' },
      ],
      unresolvable: [
        'Whether car dealership experience is sufficient for petrol filling station instruction under PS 2 — requires Registered Valuer review',
      ],
    },
    independentEval: {
      pjRisks: ['PJ6'],
      acceptableOutcomes: ['PASS','REVISE'],
      notes: 'Competence documentation question. PJ6 risk if Michael suggests analogous experience automatically transfers.',
    },
  },

];

// ── API call: Michael (Haiku — panel configuration) ───────────────────────────
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
    text: data.content?.[0]?.text ?? '', inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0, stopReason: data.stop_reason, elapsed,
  };
}

// ── API call: Sonnet evaluator ────────────────────────────────────────────────
async function callSonnetEvaluator(q, responseText, fast = false) {
  const systemPrompt = fast ? FAST_EVALUATOR_SYSTEM : EVALUATOR_SYSTEM_V2;
  const sourceStr = q.sourceMaterialKey ? sourceForEvaluator(q.sourceMaterialKey) : null;

  let user = `Candidate question: "${q.question}"\n\nPathway: ${q.pathway}\nCompetency: ${q.competency}\n\nMichael's proposed response:\n---\n${responseText}\n---`;
  if (sourceStr) {
    user += `\n\nVerified source material supplied:\n---\n${sourceStr}\n---`;
  } else {
    user += `\n\nSource material: None supplied. List any named Act sections, Regulation numbers, or specific legal deadlines in unverified_type_ab.`;
  }

  const body = {
    model: MODEL_SONNET, max_tokens: fast ? 400 : 2000, temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: user }],
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
    rawText, parsed,
    inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0,
    stopReason: data.stop_reason, elapsed,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== GCAi Professional Reasoning & Evidence Quality Gate — Sonnet Pilot ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Questions: ${QUESTIONS.length}  |  Method: API-EQUIVALENT`);
  console.log('Panel config: model=claude-haiku-4-5-20251001  max_tokens=2000  source=panel  moduleId=0');
  console.log('No real candidate data. Not committed, pushed, or deployed.');

  console.log('\n--- Source verification status ---');
  console.log('AUTHORITATIVE_VERIFIED:  0 sources (none verified against primary document in this pilot)');
  const ir = Object.values(SOURCE_REGISTRY).filter(s => s.verificationStatus === 'INTERNALLY_REVIEWED');
  const pv = Object.values(SOURCE_REGISTRY).filter(s => s.verificationStatus === 'PROVISIONAL');
  console.log(`INTERNALLY_REVIEWED:     ${ir.length} sources (${ir.map(s => s.name.split(' ')[0]).join(', ')})`);
  console.log(`PROVISIONAL:             ${pv.length} sources — NOT passed to evaluator`);
  console.log('');

  // ── PHASE 1: Michael (Haiku) response collection ─────────────────────────
  console.log('=== PHASE 1: Michael (Haiku) Response Collection ===');
  const michaelResponses = {};
  let p1Cost = 0, p1Ms = 0, p1Out = 0, p1Count = 0;

  for (const q of QUESTIONS) {
    process.stdout.write(`  [${q.id.padEnd(6)}] ${q.label.slice(0, 50).padEnd(50)} `);
    try {
      const r = await callMichael(q.question, q.pathway);
      const truncated = isLikelyTruncated(r.text);
      const cost = r.inputTokens * PRICING[MODEL_HAIKU].input + r.outputTokens * PRICING[MODEL_HAIKU].output;
      p1Cost += cost; p1Ms += r.elapsed; p1Out += r.outputTokens; p1Count++;
      michaelResponses[q.id] = { ...r, truncated, cost };
      console.log(`${String(r.outputTokens).padStart(4)}tok  ${String(r.elapsed).padStart(5)}ms  ${truncated ? '[TRUNC]' : '[OK]   '}  stop=${r.stopReason}`);
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      michaelResponses[q.id] = { error: e.message };
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\nPhase 1: ${p1Count}/${QUESTIONS.length} collected  avg=${Math.round(p1Out / (p1Count || 1))} tok  avg=${Math.round(p1Ms / (p1Count || 1))}ms  total=$${p1Cost.toFixed(4)}\n`);

  // Print Phase 1 responses in full for review
  console.log('=== PHASE 1 RESPONSES (full text) ===');
  for (const q of QUESTIONS) {
    const r = michaelResponses[q.id];
    console.log(`\n--- ${q.id} | ${q.label} ---`);
    console.log(`Q: ${q.question}`);
    console.log(`Pathway: ${q.pathway} | Competency: ${q.competency}`);
    console.log(`Source material supplied to evaluator: ${q.sourceMaterialKey ? SOURCE_REGISTRY[q.sourceMaterialKey]?.verificationStatus + ' — ' + SOURCE_REGISTRY[q.sourceMaterialKey]?.name : 'none'}`);
    if (r?.error) { console.log(`ERROR: ${r.error}`); continue; }
    console.log(`Response (${r.outputTokens} tokens, truncated=${r.truncated}, stopReason=${r.stopReason}):`);
    console.log(r.text);
  }
  console.log('');

  // ── PHASE 2: Sonnet full evaluation ──────────────────────────────────────
  console.log('=== PHASE 2: Sonnet Full Evaluation (v2 evaluator) ===');
  const sonnetResults = {};
  let p2Cost = 0, p2Ms = 0, p2Count = 0;

  for (const q of QUESTIONS) {
    const mr = michaelResponses[q.id];
    if (mr?.error) { console.log(`  [${q.id.padEnd(6)}] SKIPPED (no Michael response)`); continue; }
    process.stdout.write(`  [${q.id.padEnd(6)}] `);
    try {
      const ev = await callSonnetEvaluator(q, mr.text, false);
      const outcome = ev.parsed?.outcome ?? 'PARSE_ERROR';
      const cost = ev.inputTokens * PRICING[MODEL_SONNET].input + ev.outputTokens * PRICING[MODEL_SONNET].output;
      p2Cost += cost; p2Ms += ev.elapsed; p2Count++;
      sonnetResults[q.id] = { ...ev, cost };
      console.log(`${outcome.padEnd(26)} ${String(ev.outputTokens).padStart(4)}tok  ${String(ev.elapsed).padStart(5)}ms  $${cost.toFixed(5)}`);
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      sonnetResults[q.id] = { error: e.message };
    }
    await new Promise(r => setTimeout(r, 600));
  }
  console.log(`\nPhase 2: ${p2Count} evaluated  avg=${Math.round(p2Ms / (p2Count || 1))}ms  total=$${p2Cost.toFixed(4)}\n`);

  // ── PHASE 3: Repeatability — 8-response subset × 2 runs ──────────────────
  const REPEAT_IDS = ['BS-01','BS-04','QS-01','QS-06','VAL-01','VAL-04','ETH-01','HS-01'];
  console.log('=== PHASE 3: Repeatability ===');
  console.log(`Subset: ${REPEAT_IDS.join(', ')}\n`);

  const repeatResults = {};
  for (const id of REPEAT_IDS) repeatResults[id] = [];

  for (let run = 1; run <= 2; run++) {
    console.log(`  Run ${run}:`);
    for (const id of REPEAT_IDS) {
      const q  = QUESTIONS.find(q => q.id === id);
      const mr = michaelResponses[id];
      if (!q || mr?.error) { console.log(`    [${id.padEnd(6)}] SKIPPED`); continue; }
      process.stdout.write(`    [${id.padEnd(6)}] `);
      try {
        const ev = await callSonnetEvaluator(q, mr.text, false);
        const outcome = ev.parsed?.outcome ?? 'PARSE_ERROR';
        repeatResults[id].push(outcome);
        console.log(outcome);
      } catch (e) {
        console.log(`ERROR — ${e.message}`);
        repeatResults[id].push('ERROR');
      }
      await new Promise(r => setTimeout(r, 600));
    }
    console.log('');
  }

  console.log('  Repeatability (Run 1 vs Run 2):');
  let consistent = 0;
  for (const id of REPEAT_IDS) {
    const [r1, r2] = repeatResults[id];
    const match = r1 === r2 ? 'CONSISTENT' : 'INCONSISTENT ⚠';
    if (r1 === r2) consistent++;
    console.log(`  ${id.padEnd(8)}  R1=${String(r1).padEnd(26)} R2=${String(r2).padEnd(26)} ${match}`);
  }
  console.log(`  Score: ${consistent}/${REPEAT_IDS.length}\n`);

  // ── PHASE 4: Fast Sonnet evaluation ──────────────────────────────────────
  console.log('=== PHASE 4: Fast Sonnet Evaluation (structural failure screen — EXPERIMENTAL) ===');
  console.log('Checks: PJ2, PJ4, PJ5, PJ7(structural) | Does NOT check: PJ1, PJ3, PJ6, PJ8');
  console.log('Not equivalent to full gate. Not recommended for candidate-facing deployment.\n');
  const fastResults = {};
  let p4Cost = 0, p4Ms = 0, p4Count = 0;

  for (const q of QUESTIONS) {
    const mr = michaelResponses[q.id];
    if (mr?.error) continue;
    process.stdout.write(`  [${q.id.padEnd(6)}] `);
    try {
      const ev = await callSonnetEvaluator(q, mr.text, true);
      const outcome = ev.parsed?.outcome ?? 'PARSE_ERROR';
      const cost = ev.inputTokens * PRICING[MODEL_SONNET].input + ev.outputTokens * PRICING[MODEL_SONNET].output;
      p4Cost += cost; p4Ms += ev.elapsed; p4Count++;
      fastResults[q.id] = { ...ev, cost };
      console.log(`${outcome.padEnd(26)} ${String(ev.outputTokens).padStart(4)}tok  ${String(ev.elapsed).padStart(5)}ms  $${cost.toFixed(5)}`);
    } catch (e) {
      console.log(`ERROR — ${e.message}`);
      fastResults[q.id] = { error: e.message };
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\nPhase 4: ${p4Count} evaluated  avg=${Math.round(p4Ms / (p4Count || 1))}ms  total=$${p4Cost.toFixed(4)}\n`);

  // ── REPORT ────────────────────────────────────────────────────────────────
  console.log('=== PILOT REPORT ===\n');

  // ── Section A: Full evaluator detailed results ────────────────────────────
  console.log('--- SECTION A: Full Evaluator Detailed Results ---\n');
  for (const q of QUESTIONS) {
    const ev = sonnetResults[q.id];
    if (!ev || ev.error) continue;
    const p = ev.parsed;
    console.log(`[${q.id}] ${q.label}`);
    console.log(`  Outcome:     ${p?.outcome ?? 'PARSE_ERROR'}`);
    console.log(`  Basis:       ${p?.outcome_basis ?? '-'}`);
    for (const f of (p?.reasoning_failures ?? [])) {
      console.log(`  [${f.severity}] ${f.failure_type} (${(f.pj ?? []).join(',')}): "${(f.quoted_text ?? '').slice(0, 90)}"`);
      if (f.correction) console.log(`    Correction: ${f.correction.slice(0, 130)}`);
    }
    const unv = (p?.unverified_type_ab ?? []).slice(0, 5);
    if (unv.length) console.log(`  Unverified statutory claims: ${unv.join('; ')}`);
    if (p?.safety_screen?.finding) console.log(`  Safety finding: ${p.safety_screen.finding}`);
    if (p?.truncated) console.log(`  Truncated: true`);
    console.log('');
  }

  // ── Section B: Independent content assessment for human review ────────────
  console.log('--- SECTION B: Independent Content Assessment (for human review) ---');
  console.log('NOTE: This section is evidence for human review. It is NOT automatically scored.');
  console.log('A PASS outcome from the evaluator does not confirm professional correctness.\n');

  for (const q of QUESTIONS) {
    const mr = michaelResponses[q.id];
    const ev = sonnetResults[q.id];
    if (!mr || mr.error) continue;
    const outcome = ev?.parsed?.outcome ?? 'NOT EVALUATED';

    console.log(`[${q.id}] ${q.label}  |  Evaluator: ${outcome}`);

    if (q.correctContent.configured?.length) {
      console.log('  Configured behaviour (INTERNALLY_REVIEWED — from ai-tutor.js):');
      for (const c of q.correctContent.configured) console.log(`    • ${c}`);
    }
    if (q.correctContent.technicalReqs?.length) {
      console.log('  Technical requirements:');
      for (const t of q.correctContent.technicalReqs)
        console.log(`    • [${t.status}] ${t.req}  (${t.note})`);
    }
    if (q.correctContent.criticalErrors?.length) {
      console.log('  Critical errors if present:');
      for (const e of q.correctContent.criticalErrors)
        console.log(`    • [${e.status}] ${e.error}  (${e.note})`);
    }
    if (q.correctContent.unresolvable?.length) {
      console.log('  Cannot be assessed from available evidence — requires human review:');
      for (const u of q.correctContent.unresolvable) console.log(`    • ${u}`);
    }

    // Five content assessment items — printed for human review
    console.log('  --- Five content assessment items (complete after reviewing response above) ---');
    console.log('  1. Material technical/professional errors in Michael\'s response: [REQUIRES HUMAN REVIEW]');
    const failures = ev?.parsed?.reasoning_failures ?? [];
    console.log(`  2. Errors detected by evaluator: ${failures.length > 0 ? failures.map(f => f.failure_type).join(', ') : 'none'}`);
    const isDefensible = q.independentEval.acceptableOutcomes.includes(outcome);
    console.log(`  3. Evaluator rejected defensible guidance (false positive): ${isDefensible ? 'No — outcome within acceptable range' : 'POSSIBLE — outcome outside acceptable range; review needed'}`);
    const unv = ev?.parsed?.unverified_type_ab ?? [];
    console.log(`  4. Unverified technical claims: ${unv.length > 0 ? unv.slice(0, 4).join('; ') : 'none flagged by evaluator'}`);
    console.log(`  5. Conclusions not assessable from evidence: ${q.correctContent.unresolvable?.join(' | ') ?? 'none recorded'}`);
    console.log('');
  }

  // ── Section C: Full vs fast outcome comparison ────────────────────────────
  console.log('--- SECTION C: Full vs Fast Outcome Comparison ---');
  console.log('Fast evaluator checks PJ2, PJ4, PJ5, PJ7(structural) only.\n');
  console.log(`${'ID'.padEnd(8)} ${'FULL'.padEnd(28)} ${'FAST'.padEnd(28)} ${'AGREE?'}`);
  let agreeN = 0, compN = 0;
  for (const q of QUESTIONS) {
    const full = sonnetResults[q.id]?.parsed?.outcome;
    const fast = fastResults[q.id]?.parsed?.outcome;
    if (!full || !fast) continue;
    const agree = full === fast;
    if (agree) agreeN++;
    compN++;
    console.log(`${q.id.padEnd(8)} ${full.padEnd(28)} ${fast.padEnd(28)} ${agree ? 'YES' : 'NO ⚠'}`);
  }
  console.log(`\nAgreement: ${agreeN}/${compN} (${Math.round(100 * agreeN / (compN || 1))}%)`);

  // Agreement specifically for REVISE cases (fast must not suppress material failures)
  const reviseMisses = QUESTIONS.filter(q => {
    return sonnetResults[q.id]?.parsed?.outcome === 'REVISE' &&
           fastResults[q.id]?.parsed?.outcome !== 'REVISE';
  });
  if (reviseMisses.length) {
    console.log(`\nFast evaluator missed REVISE (full gate found material failures not caught by fast):`);
    for (const q of reviseMisses) console.log(`  ${q.id} — ${q.label}`);
    console.log('These represent cases where fast evaluator is INSUFFICIENT as a quality gate.');
  }

  // ── Section D: Fast evaluator PJ coverage declaration ────────────────────
  console.log('\n--- SECTION D: Fast Evaluator PJ Coverage Declaration ---');
  console.log('This section reproduces the coverage from the first fast evaluator result for reference.\n');
  const firstFast = Object.values(fastResults).find(r => r.parsed?.pj_assessed);
  if (firstFast?.parsed) {
    console.log(`  PJ assessed:     ${(firstFast.parsed.pj_assessed ?? []).join(', ')}`);
    console.log(`  PJ not assessed: ${(firstFast.parsed.pj_not_assessed ?? []).join(', ')}`);
    console.log(`  Note: ${firstFast.parsed.fast_evaluator_note}`);
  }

  // ── Section E: Cost and latency summary ──────────────────────────────────
  console.log('\n--- SECTION E: Cost and Latency Summary ---');
  const fullAvgMs   = p2Ms   / (p2Count  || 1);
  const fastAvgMs   = p4Ms   / (p4Count  || 1);
  const fullAvgCost = p2Cost / (p2Count  || 1);
  const fastAvgCost = p4Cost / (p4Count  || 1);
  const p1AvgMs     = p1Ms   / (p1Count  || 1);

  console.log(`Phase 1  Michael Haiku collection:  total=$${p1Cost.toFixed(4)}  avg=${Math.round(p1AvgMs)}ms  avg=${Math.round(p1Out / (p1Count || 1))} tok/response`);
  console.log(`Phase 2  Sonnet full evaluator:     total=$${p2Cost.toFixed(4)}  avg=${Math.round(fullAvgMs)}ms  avg=$${fullAvgCost.toFixed(5)}/call`);
  console.log(`Phase 4  Sonnet fast evaluator:     total=$${p4Cost.toFixed(4)}  avg=${Math.round(fastAvgMs)}ms  avg=$${fastAvgCost.toFixed(5)}/call`);
  if (fullAvgMs > 0 && fastAvgMs > 0) {
    console.log(`Fast vs full: ${Math.round((1 - fastAvgMs / fullAvgMs) * 100)}% latency reduction  ${Math.round((1 - fastAvgCost / fullAvgCost) * 100)}% cost reduction`);
  }

  // Outcome distribution
  const dist = {};
  for (const q of QUESTIONS) {
    const o = sonnetResults[q.id]?.parsed?.outcome;
    if (o) dist[o] = (dist[o] || 0) + 1;
  }
  console.log('\nOutcome distribution (Phase 2):');
  for (const [o, n] of Object.entries(dist)) console.log(`  ${o.padEnd(28)} ${n}`);

  // ── Section F: Release decision criteria ─────────────────────────────────
  console.log(`
--- SECTION F: Release Decision Criteria ---

WHAT CAN BE DETERMINED FROM THIS PILOT

CRITERION 1 — False positive rate
  ≥85% of questions with PASS in the acceptable-outcomes record are returned as
  PASS by the evaluator. Note: a PASS outcome confirms the evaluator did not
  identify a material reasoning failure; it does not confirm the response is
  professionally correct. See Section B for unresolved content items.

CRITERION 2 — Safety detection
  100% of questions with explicit risk indicators (BS-06, HS-03, ETH-03, and
  any where Michael does not address safety first) must return REVISE (PJ4).

CRITERION 3 — Repeatability
  Phase 3 subset must achieve 8/8 consistent outcomes across both Sonnet runs.

CRITERION 4 — Latency
  Full evaluator: average ≤6,000ms (async background gating acceptable).
  Fast evaluator: average ≤2,500ms (near-real-time screen acceptable).

CRITERION 5 — Cost
  Full evaluator: average ≤$0.01 per call.
  Fast evaluator: average ≤$0.003 per call.

CRITERION 6 — Fast evaluator REVISE suppression
  Fast evaluator must not fail to return REVISE on any case where the full
  evaluator flags PJ4 (safety) or a material INTERNALLY_REVIEWED_MISMATCH.
  Any missed REVISE in Section C invalidates fast evaluator for that category.

WHAT CANNOT BE DETERMINED FROM THIS PILOT

  Content accuracy of technical responses (building pathology, contract practice,
  valuation) cannot be confirmed. No AUTHORITATIVE_VERIFIED sources were used.
  Section B items marked REQUIRES HUMAN REVIEW remain unresolved.

  The fast evaluator's omission of PJ1, PJ3, PJ6, and PJ8 means competence
  boundary failures, uncertainty mishandling, and unsupported recommendations
  in those areas will not be flagged. Unresolved answers must not be counted
  as successful professional-quality evaluations.

PROFESSIONAL REVIEW RECOMMENDED (not a blocking gate)
  Before any production deployment, targeted review is recommended from:
    BS pathology responses: a Chartered Building Surveyor
    Contract practice responses: a Chartered QS or construction solicitor
    Valuation responses: a RICS Registered Valuer
    Ethics scenarios: a RICS member with conduct or assessment experience
    CDM responses: a CDM coordinator or HSE-experienced practitioner
  These reviews should assess content accuracy, not just evaluator gate behaviour.
  Absence of these reviews is a documented limitation, not a blocking condition.

=== END OF PILOT REPORT ===
`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
