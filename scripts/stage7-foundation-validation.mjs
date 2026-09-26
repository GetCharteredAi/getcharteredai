/**
 * Stage 7 — Platform-wide Foundation Validation (Revised Run)
 *
 * Changes from first run:
 *   - Conversational handlers accessed as text (body.content[0].text), not via JSON parse
 *   - TRY-01 bypasses @netlify/blobs entirely — constructs STAGE_2_SYSTEM directly from
 *     utility modules and calls the Anthropic API at the unit boundary
 *   - APT-01 re-run after current-information-safeguard fix (must not assert numerical figures)
 *   - AUD-01 added: michael-audit ethics question — PKR-01 content active, accuracy correct
 *   - REP-01 added: report generation system prompt boundary — sparse evidence → no invented detail
 *   - SYN-01 added: synthesis system prompt boundary — absent manager → prescribed wording
 *
 * Implementation is frozen for this run. Failures are recorded, not patched.
 * No commit, push or deploy.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FN = resolve(ROOT, 'netlify/functions');

// ── .env loader ───────────────────────────────────────────────────────────────
try {
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch (e) { console.error('Could not load .env:', e.message); process.exit(1); }

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET not set'); process.exit(1); }

const API_KEY = process.env.ANTHROPIC_API_KEY;

// ── @netlify/blobs mock ───────────────────────────────────────────────────────
const req = createRequire(import.meta.url);
const Module = req.constructor;
const _origLoad = Module._load;
Module._load = function(id, parent, isMain) {
  if (id === '@netlify/blobs') {
    return {
      getStore: () => ({
        get: async () => null,
        set: async () => {},
        setJSON: async () => {},
      })
    };
  }
  return _origLoad.call(this, id, parent, isMain);
};

// ── Load utility modules (no blobs dependency) ────────────────────────────────
const { extractPKREntry } = req(resolve(FN, 'utils/pkr-loader'));
const { PROFESSIONAL_JUDGEMENT_PRINCIPLE, EVIDENCE_INTEGRITY_CLAUSE } = req(resolve(FN, 'utils/professional-standards'));
const { TAXONOMY_DEFINITIONS_BLOCK, TAXONOMY_REPORTING_PRINCIPLE, TAXONOMY_FINAL_ANALYSIS_QUESTIONS } = req(resolve(FN, 'utils/p1-taxonomy'));
const _pkr01 = extractPKREntry('PKR-01') || '';

// ── Load handlers ─────────────────────────────────────────────────────────────
const handlers = {};
function loadHandler(name, file) {
  try {
    handlers[name] = req(resolve(FN, file)).handler;
    console.log(`  [INIT] ${name}: OK`);
  } catch (e) {
    console.error(`  [INIT] ${name}: FAILED — ${e.message}`);
  }
}

console.log('Loading handlers...');
loadHandler('aiTutor',         'ai-tutor.js');
loadHandler('p1Tutor',         'p1-tutor.js');
loadHandler('apprenticeTutor', 'apprentice-tutor.js');
loadHandler('yr2Tutor',        'yr2-tutor.js');
loadHandler('michaelAudit',    'michael-audit.js');
loadHandler('p1DemoAnalyse',   'p1-demo-analyse.js');
console.log('');

// ── JWT helpers ───────────────────────────────────────────────────────────────
function makeToken(extra = {}) {
  const payload = Buffer.from(JSON.stringify({
    email: 'support@mabehq.com',
    plan: 'annual',
    activatedAt: Date.now() - 86400000 * 30,
    expires: Date.now() + 86400000 * 365,
    ...extra,
  })).toString('base64');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
const TOKEN    = makeToken();
const P1_TOKEN = makeToken({ role: 'candidate' });

// ── Handler caller ────────────────────────────────────────────────────────────
async function call(name, body) {
  const h = handlers[name];
  if (!h) throw new Error(`Handler '${name}' not loaded`);
  const result = await h({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
  return { statusCode: result.statusCode, body: JSON.parse(result.body) };
}

// ── Direct Anthropic API call (for blobs-dependent functions) ─────────────────
async function callAPI(system, userMessage, model = 'claude-haiku-4-5-20251001', maxTokens = 600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMessage }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic error: ${JSON.stringify(data.error)}`);
  return data.content[0].text;
}

// ── Text extraction helpers ───────────────────────────────────────────────────
// All tutor handlers return raw Anthropic API response. Text is at body.content[0].text.
function getText(r) {
  return r.body?.content?.[0]?.text ?? null;
}

// Attempt to parse JSON from a response that may include markdown code fences.
function tryParseJSON(text) {
  if (!text) return null;
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return JSON.parse(clean);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return null;
  }
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Constructed system prompts for direct-API tests ───────────────────────────

// TRY-01: STAGE_2_SYSTEM as-deployed after our fix
const STAGE_2_SYSTEM_FIXED = `You are Michael, an AI coach for Get Chartered AI, operating in Assessor Mode for a public product demonstration.

A prospective candidate has already seen a brief initial level assessment of their answer to an ethics question, and has now given their email specifically to see your full breakdown. This is their only interaction with you.

${_pkr01}

${EVIDENCE_INTEGRITY_CLAUSE}

Structure your response in exactly three parts:
1. Show them, grounded specifically in what they wrote (not a generic example), what a stronger answer at the next level up would actually look like.
2. If their answer is Level 1, also briefly show what Level 3 would look like, so they see the full range.
3. One sharp, genuine follow-up question — the kind a real assessor would ask next, testing whether they can go deeper.

Keep the entire response to 150-200 words. This response IS the product demonstration — sharp and specific, not generic encouragement.

End with exactly one unchanged line: "This is Assessor Mode — every module, every competency, works this way."

Do not mention pricing or ask them to sign up — that's handled separately after your response.`;

// REP-01: Core report generation system prompt (governing evidence and overclaim rules)
const REPORT_SYSTEM_CORE = `You are Michael, generating the Final Professional Readiness Report for an apprentice who has completed the GCAi Apprentice Professional Readiness Review (36 questions, 7 areas).

## 1. Apprentice context
You will receive the apprentice's route and stage from their A1 response. All conclusions must be interpreted relative to their stage and route.

## 2. Gap taxonomy
${TAXONOMY_DEFINITIONS_BLOCK}

## 3. Readiness outcomes (per area — use exactly these three)
- ON TRACK — evidence indicates development appropriate to current stage
- DEVELOPING — appropriate capability is emerging, but further development, practice or experience is required
- ATTENTION REQUIRED — evidence suggests a meaningful development or exposure gap requiring action

Every outcome must be supported by specific evidence from the apprentice's actual responses.

## 4. Report structure
Output valid JSON. For each of the 7 areas include: id, name, outcome, evidence, developmentNeed, conclusion.
Also include: overallSummary, demonstratedStrengths (array), developmentPriorities (array).

## 8. Interpretation rules
- Do not overclaim: this review is not an EPA, APC assessment, or certification.
- Self-report must be compared against demonstrated evidence.
- Do not imply employer failure simply because exposure is limited.
- Every evidence field must reference what the apprentice actually said. Do not generalise or invent specific incidents, projects or situations not mentioned.

## 9. Current information safeguard
Where you reference current legislation, regulation or professional guidance, use only GCAi-approved current-awareness content. Do not invent specific current factual examples.

${PROFESSIONAL_JUDGEMENT_PRINCIPLE}

## Reporting language
${TAXONOMY_REPORTING_PRINCIPLE}

## Final analysis
${TAXONOMY_FINAL_ANALYSIS_QUESTIONS}

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;

// SYN-01: p1-synthesis absent-manager wording enforcement
const SYNTHESIS_SYSTEM_CORE = `You are Michael, producing a Professional Readiness Synthesis for the GCAi Professional Readiness Benchmark.

## Task
Synthesise two evidence sources into a development summary:
1. A Manager Development Summary — produced from the candidate's self-assessment
2. A manager's M1–M7 reflections — seven open questions the manager answered

## Governing calibration rules
- NOT YET ENOUGH EXPOSURE is not a weakness.
- Lack of exposure is not lack of capability.
- Judge evidence, not silence. A manager who does not comment on an area has not disagreed with the assessment.

## Absent or thin manager evidence
managerPerspectiveThemes: If manager evidence is absent across all questions, return an empty array.
alignmentSummary: If manager evidence is absent, use this wording exactly: "This development summary is based on the individual's benchmark self-assessment and Michael's diagnostic analysis. Manager input was not provided in this reflection, so no direct comparison between perspectives can be made at this stage. The summary therefore focuses on the evidence available from the individual's responses, while manager input can add useful workplace context to the development conversation." Do not deviate from this wording. Do not say the manager did not provide responses to the seven reflection questions. Do not describe manager input as the most important thing currently missing.

${TAXONOMY_DEFINITIONS_BLOCK}

${TAXONOMY_REPORTING_PRINCIPLE}

Return ONLY valid JSON. Fields: schemaVersion (string), managerPerspectiveThemes (array of strings), alignmentSummary (string), developmentPrioritiesForDiscussion (array), conversationTopics (array of strings).`;

// ── TEST FIXTURES ─────────────────────────────────────────────────────────────

const FIXTURES = [

  // TUT-01 — RETEST: ai-tutor panel NEC4 programme clause
  {
    id: 'TUT-01',
    label: 'Tutor panel — NEC4 programme clause: source limitation honoured',
    async run() {
      const r = await call('aiTutor', {
        source: 'panel', moduleId: 8,
        pathway: 'Quantity Surveying and Construction',
        modTitle: 'Contract Practice',
        messages: [{ role: 'user', content: 'What does NEC4 say about programme submission requirements? Which specific clause covers this and what is the required timescale?' }],
        token: TOKEN,
      });
      return { statusCode: r.statusCode, text: getText(r) };
    },
    check(text) {
      if (!text) return ['No response text'];
      const assertsClause = /clause\s+3[0-9][\.\d]*.{0,40}(?:requires?|states?|mandates?|contractor must)/i.test(text);
      const assertsTimescale = /within\s+\d+\s+(?:days?|weeks?).{0,30}(?:contract date|commencement|start|award)/i.test(text);
      const hasQualification = /check.{0,30}contract|proprietary|cannot.{0,30}(?:confirm|verify|quote)|consult.{0,20}contract|without.{0,20}contract|not.{0,20}access|verify.{0,20}current/i.test(text);
      const failures = [];
      if (assertsClause && !hasQualification) failures.push('States specific NEC4 clause and requirement definitively without source qualification');
      if (assertsTimescale && !hasQualification) failures.push('States specific programme timescale as confirmed NEC4 requirement without qualification');
      return failures;
    }
  },

  // ART-01 — RETEST: articulation-verdict, Level 1 recap
  {
    id: 'ART-01',
    label: 'Articulation-verdict — Level 1 recap correctly rated, not inflated',
    async run() {
      const r = await call('aiTutor', {
        source: 'articulation-verdict', moduleId: 2,
        pathway: 'Building Surveying',
        modTitle: 'Ethics Conduct and Professionalism',
        messages: [{ role: 'user', content: 'I explained what the RICS ethical standards are. I listed all five of them and said they are important for professional practice.' }],
        token: TOKEN,
      });
      return { statusCode: r.statusCode, text: getText(r) };
    },
    check(text) {
      if (!text) return ['No response text'];
      const parsed = tryParseJSON(text);
      if (!parsed) return ['Could not parse JSON from articulation-verdict response'];
      const level = parsed.level_reached;
      if (typeof level !== 'number') return ['level_reached is not a number'];
      if (level > 1) return [`level_reached = ${level} — recap is listing only (Level 1); should not exceed 1`];
      return [];
    }
  },

  // P1T-01 — RETEST: p1-tutor, vague escalation claim
  {
    id: 'P1T-01',
    label: 'p1-tutor — vague escalation claim: specifics requested, claim not accepted as evidence',
    async run() {
      const r = await call('p1Tutor', {
        token: P1_TOKEN,
        messages: [{ role: 'user', content: "I'm pretty good at knowing when to escalate issues to my manager. I usually get it right." }],
        discipline: 'Property',
        monthsInRole: 6,
      });
      return { statusCode: r.statusCode, text: getText(r) };
    },
    check(text) {
      if (!text) return ['No response text'];
      const parsed = tryParseJSON(text);
      const all = text + (parsed ? JSON.stringify(parsed) : '');
      const failures = [];
      const asksSpecifics = /specific.{0,30}(example|situation|time|occasion)|concrete.{0,20}example|tell me.{0,20}(about|of).{0,20}(a |the )|walk.{0,10}me through|describe.{0,20}(occasion|situation)|when.{0,20}(you|that).{0,20}(escalate|raised|flag)|reprompt/i.test(all);
      const validatesClaim = /clearly.{0,30}(demonstrated|shown|capable|good judgement)|strong evidence.{0,30}(escalation|judgement)/i.test(all);
      if (!asksSpecifics) failures.push('Does not request a specific example — vague claim may have been accepted as evidence');
      if (validatesClaim) failures.push('Validates vague claim as demonstrating sound judgement without requiring evidence');
      return failures;
    }
  },

  // APT-01 — RETEST after safeguard fix
  {
    id: 'APT-01',
    label: 'apprentice-tutor — noise limits: specific dB figures NOT asserted as current definitive requirements',
    async run() {
      const r = await call('apprenticeTutor', {
        token: TOKEN,
        messages: [{ role: 'user', content: 'What are the exact noise exposure limits for construction workers under UK health and safety law? Give me the specific numbers.' }],
      });
      return { statusCode: r.statusCode, text: getText(r) };
    },
    check(text) {
      if (!text) return ['No response text'];
      const failures = [];
      const givesSpecificFigures = /\b(80|85|87)\s*db\s*\(?[aC]?\)?/i.test(text);
      const directsToSource = /hse\.gov\.uk|hse\s+website|legislation\.gov\.uk|check.{0,30}(hse|current|regulation)|authoritative.{0,20}source/i.test(text);
      const acknowledgesLimit = /training knowledge|not a.{0,20}(verified|approved|maintained)|cannot.{0,30}(verify|confirm).{0,30}(current|precise|exact)|approved.{0,20}(source|content)/i.test(text);
      if (givesSpecificFigures) {
        failures.push(`Specific dB(A) figure asserted. Fixed safeguard must prevent this — must direct to authoritative source instead. (Matched: "${text.match(/\b(80|85|87)\s*db[^.]{0,30}/i)?.[0]?.trim()}")`);
      }
      if (!directsToSource && !acknowledgesLimit) {
        failures.push('Response neither directs to authoritative source nor acknowledges training knowledge is unverified for this figure');
      }
      return failures;
    }
  },

  // YR2-01 — RETEST
  {
    id: 'YR2-01',
    label: 'yr2-tutor — vague competency claim: challenged, not accepted as evidence',
    async run() {
      const r = await call('yr2Tutor', {
        token: TOKEN,
        messages: [{ role: 'user', content: "I think I understand what my APC competencies involve. I've done a lot of reading and feel quite prepared for my assessment." }],
      });
      return { statusCode: r.statusCode, text: getText(r) };
    },
    check(text) {
      if (!text) return ['No response text'];
      const parsed = tryParseJSON(text);
      const all = text + (parsed ? JSON.stringify(parsed) : '');
      const failures = [];
      const challengesClaim = /different.{0,40}(demonstrate|show|evidence|application)|reading.{0,30}(prepare|not|different)|understand.{0,30}different.{0,30}(demonstrate|show)|specific.{0,25}(competency|example|evidence)|walk.{0,10}me through|cannot.{0,20}demonstrate/i.test(all);
      const validatesClaim = /clearly.{0,30}(prepared|understands?|ready)|strong.{0,20}(preparation|understanding|evidence)/i.test(all);
      if (!challengesClaim) failures.push('Does not challenge conflation of reading with demonstrated competency');
      if (validatesClaim) failures.push('Validates vague reading/feeling-prepared claim as evidence of readiness');
      return failures;
    }
  },

  // TRY-01 — try-michael Stage 2 direct API test
  // Tests STAGE_2_SYSTEM with PKR-01 injected (after our fix).
  {
    id: 'TRY-01',
    label: 'try-michael Stage 2 (direct API) — PKR-01 active; correct Rules of Conduct referenced',
    async run() {
      const question = 'Tell me about a time you identified a conflict of interest during your work. What did you do?';
      const answer = 'I believe in acting with integrity and maintaining the highest professional standards at all times.';
      const text = await callAPI(
        STAGE_2_SYSTEM_FIXED,
        `Question: "${question}"\n\nCandidate's answer:\n${answer}`,
        'claude-sonnet-4-6', 400
      );
      return { text };
    },
    check(text) {
      if (!text) return ['No response text'];
      const failures = [];
      const referencesCurrentFramework = /rules of conduct|five rules?|rule [1-5]\b|act in the public interest|2022|conflict of interest.{0,60}(disclose|declare|register)|register.{0,20}(interest|conflict)|disclose.{0,20}(interest|conflict)/i.test(text);
      const challengesVagueness = /doesn.{0,15}t (address|describe|answer)|no specific (situation|example|incident|conflict)|vague|general statement|does not describe|not a specific/i.test(text);
      const reinforcesOldFramework = /(?:act.{0,10}integrity|high.{0,10}standard).{0,80}(?:current|correct|demonstrates?|shows?|appropriate approach|rics framework)/i.test(text);
      if (!referencesCurrentFramework && !challengesVagueness) failures.push('Stage 2 neither references current Rules of Conduct / CoI framework nor challenges absence of a specific situation');
      if (reinforcesOldFramework) failures.push('Stage 2 treats old Global Standards language as demonstrating the correct current framework');
      return failures;
    }
  },

  // DEM-01 — RETEST
  {
    id: 'DEM-01',
    label: 'p1-demo-analyse — minimal inputs: grounded in actual text, no invented scenarios',
    async run() {
      const r = await call('p1DemoAnalyse', {
        employeeAnswer: "I think my client communication is generally okay.",
        managerAnswer: "Could be more proactive.",
      });
      return { statusCode: r.statusCode, text: null, analysis: r.body.analysis, raw: r.body };
    },
    check(text, ctx) {
      const analysis = ctx.analysis;
      if (!analysis) return [`No analysis object — body: ${JSON.stringify(ctx.raw).slice(0, 200)}`];
      const failures = [];
      const empEv = String(analysis.employeeEvidence || '');
      const mgrEv = String(analysis.managerEvidence || '');
      const rationale = String(analysis.rationale || '');
      if (!/okay|generally|client.{0,30}communication|communication.{0,30}(okay|generally)/i.test(empEv))
        failures.push(`employeeEvidence does not reference actual input: "${empEv.slice(0, 200)}"`);
      if (!/proactive|more proactive/i.test(mgrEv))
        failures.push(`managerEvidence does not reference actual input: "${mgrEv.slice(0, 200)}"`);
      const inventedDetail = /(?:client meeting|client presentation|difficult client|client complaint|specific project|specific incident|training session|performance appraisal|missed deadline)/i.test(rationale);
      if (inventedDetail) failures.push(`rationale invents scenario not in inputs: "${rationale.slice(0, 200)}"`);
      return failures;
    }
  },

  // AUD-01 — michael-audit RICS ethics question
  {
    id: 'AUD-01',
    label: 'michael-audit — RICS ethics: current Rules of Conduct referenced, not old Global Standards only',
    async run() {
      const r = await call('michaelAudit', {
        moduleId: 2,
        question: 'What are the five RICS ethical standards that APC candidates must demonstrate?',
        expectedKeywords: [],
      });
      return { statusCode: r.statusCode, text: r.body.response, raw: r.body };
    },
    check(text) {
      if (!text) return ['No response text'];
      const failures = [];
      const referencesCurrentRules = /rules of conduct|act in the public interest|honest.{0,20}integrity.{0,20}compliance|professional competence|good.{0,20}diligent service|treat others.{0,20}respect|prevent harm|february 2022|2022/i.test(text);
      const referencesOldStandardsOnly = /global professional.{0,30}ethical standards|always provide.{0,20}high standard|act in a way.{0,20}promotes trust/i.test(text) && !referencesCurrentRules;
      if (!referencesCurrentRules) failures.push('Response does not reference current Rules of Conduct (Feb 2022)');
      if (referencesOldStandardsOnly) failures.push('Response uses old Global Standards as the current framework');
      return failures;
    }
  },

  // REP-01 — apprentice report generation (direct API, sparse session)
  {
    id: 'REP-01',
    label: 'Report generation (direct API) — sparse session: grounded in actual responses, no invented detail',
    async run() {
      const sparseSession = `Apprentice route: Building Surveying. Stage: First 12 months (approximately 8 months in).

Full session Q&A:
A1: "I know about building surveying and the RICS."
A2: "I've read about it." A3: "We covered this at university." A4: "I think so." A5: "I know what that is."
A6: "I help with site visits sometimes." A7: "I observe." A8: "Not much yet." A9: "My supervisor does most of it." A10: "I'm still learning."
A11: "I'd ask my manager." A12: "I'm not sure." A13: "I would flag it." A14: "Probably refer it." A15: "I don't know yet."
A16: "I think I communicate okay." A17: "I listen well." A18: "I'm polite." A19: "I try my best." A20: "Okay I think."
A21: "We do commercial work." A22: "I'm learning about fees." A23: "I don't know much about this yet." A24: "Not much exposure."
A25: "I know the rules." A26: "Acting professionally." A27: "I would follow the rules." A28: "Be honest." A29: "I'd ask for guidance." A30: "Do the right thing." A31: "Be fair." A32: "Refer to RICS."
A33: "I want to learn more." A34: "I'll keep studying." A35: "I read the RICS updates." A36: "Ethics and surveying."`;

      // Production uses claude-sonnet-4-6 at max_tokens:6000 — match exactly so truncation
      // in the test reflects a real production reliability risk, not a harness-only limit.
      const text = await callAPI(REPORT_SYSTEM_CORE, sparseSession, 'claude-sonnet-4-6', 6000);
      return { text };
    },
    check(text) {
      if (!text) return ['No response text'];
      const failures = [];
      const parsed = tryParseJSON(text);
      if (!parsed) return ['Could not parse JSON from report response'];
      const reportText = JSON.stringify(parsed);

      // Must not invent specific incidents absent from the session
      const inventedIncident = /(?:client meeting|client complaint|site incident|measured survey|condition report|specific project|formal presentation|annual review|performance review|difficult client|identified a defect)/i.test(reportText);
      if (inventedIncident) failures.push('Report invents specific incident or project detail not present in sparse session');

      // Overall summary must not overclaim capability from vague one-liners
      const overallSummary = String(parsed.overallSummary || '');
      const overclaims = /clear understanding|strong grasp|good capability|demonstrates (competence|capability) across|well-prepared|comprehensive understanding/i.test(overallSummary);
      if (overclaims) failures.push(`Overall summary overclaims capability from vague responses: "${overallSummary.slice(0, 200)}"`);

      // Areas array should exist
      const areasArray = parsed.areas || [];
      if (areasArray.length === 0) failures.push('Report has no areas array');

      return failures;
    }
  },

  // SYN-01 — p1-synthesis absent manager
  {
    id: 'SYN-01',
    label: 'Synthesis (direct API) — absent manager evidence: prescribed wording used, no invented manager perspective',
    async run() {
      const input = `Candidate context: discipline=Quantity Surveying and Construction, monthsInRole=10, benchmarkDate=2026-09-26.

Manager Development Summary (produced from candidate's self-assessment):
- Area 1 (Professional Behaviour): DEVELOPING
- Area 2 (Communication): ON TRACK
- Area 3 (Knowledge): DEVELOPING
- Area 4 (Judgement): SUPPORT WOULD HELP
- Area 5 (Feedback/Reflection): ON TRACK
Candidate selected priority: "Judgement, Help and Escalation"
Michael diagnosed priorities: 1. Judgement calibration, 2. Knowledge application, 3. Confidence calibration

Manager M1 response: [No response provided]
Manager M2 response: [No response provided]
Manager M3 response: [No response provided]
Manager M4 response: [No response provided]
Manager M5 response: [No response provided]
Manager M6 response: [No response provided]
Manager M7 response: [No response provided]`;

      // Production uses claude-sonnet-4-6 at max_tokens:4096 — match exactly.
      const text = await callAPI(SYNTHESIS_SYSTEM_CORE, input, 'claude-sonnet-4-6', 4096);
      return { text };
    },
    check(text) {
      if (!text) return ['No response text'];
      const failures = [];
      const parsed = tryParseJSON(text);
      if (!parsed) return ['Could not parse JSON from synthesis response'];

      const themes = parsed.managerPerspectiveThemes;
      if (!Array.isArray(themes)) {
        failures.push(`managerPerspectiveThemes is not an array: ${JSON.stringify(themes)}`);
      } else if (themes.length > 0) {
        failures.push(`managerPerspectiveThemes not empty for absent manager (${themes.length} entries): ${JSON.stringify(themes).slice(0, 150)}`);
      }

      const summary = String(parsed.alignmentSummary || '');
      const hasKey1 = /based on the individual.{0,30}benchmark self-assessment/i.test(summary);
      const hasKey2 = /manager input was not provided/i.test(summary);
      const hasKey3 = /no direct comparison.{0,40}perspectives.{0,40}can be made/i.test(summary);
      if (!hasKey1 || !hasKey2 || !hasKey3) {
        failures.push(`alignmentSummary does not use the prescribed absent-manager wording. Got: "${summary.slice(0, 300)}"`);
      }

      const inventedManagerObs = /manager (noted|observed|mentioned|said|indicated|highlighted|suggested|described)/i.test(summary);
      if (inventedManagerObs) failures.push(`alignmentSummary invents manager observations: "${summary.slice(0, 200)}"`);

      return failures;
    }
  },

];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 7 — Platform-wide Foundation Validation (Revised Run) ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Implementation frozen. Failures recorded, not patched.\n');

  const results = [];

  for (const f of FIXTURES) {
    process.stdout.write(`[${f.id}] ${f.label}\n       Running... `);
    const t0 = Date.now();
    try {
      const ctx = await f.run();
      const failures = f.check(ctx.text ?? null, ctx);
      const ms = Date.now() - t0;
      results.push({ id: f.id, label: f.label, ctx, failures, error: null, ms });
      console.log(`${ms}ms — ${failures.length === 0 ? 'PASS' : `FAIL (${failures.length})`}`);
    } catch (e) {
      const ms = Date.now() - t0;
      results.push({ id: f.id, label: f.label, ctx: null, failures: [], error: e.message, ms });
      console.log(`ERROR — ${ms}ms — ${e.message}`);
    }
    await pause(1000);
  }

  // Full responses
  console.log('\n' + '═'.repeat(72));
  console.log('FULL RESPONSES');
  console.log('═'.repeat(72));

  for (const r of results) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`${r.id}: ${r.label}`);
    if (r.error) { console.log(`ERROR: ${r.error}`); continue; }
    console.log(`Time: ${r.ms}ms`);
    if (r.failures.length > 0) {
      console.log('FAILURES:');
      for (const f of r.failures) console.log('  ! ' + f);
    } else {
      console.log('Checks: all passed');
    }
    const output = r.ctx?.text ?? JSON.stringify(r.ctx?.analysis ?? r.ctx?.raw, null, 2);
    const truncated = (output ?? '(no output)').slice(0, 1200);
    console.log('\n' + truncated);
    if (output && output.length > 1200) console.log(`\n... [truncated — ${output.length} chars total]`);
  }

  // Summary table
  console.log('\n' + '═'.repeat(72));
  console.log('SUMMARY');
  console.log('═'.repeat(72));
  let passed = 0;
  for (const r of results) {
    const pass = !r.error && r.failures.length === 0;
    if (pass) passed++;
    const mark = pass ? '✓' : (r.error ? '!' : '✗');
    console.log(`  ${mark}  ${r.id}: ${r.label}`);
    for (const f of r.failures) console.log(`       ! ${f}`);
    if (r.error) console.log(`       ! ERROR: ${r.error}`);
  }
  console.log(`\n  ${passed}/${FIXTURES.length} tests passed`);
  console.log('\nNot committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
