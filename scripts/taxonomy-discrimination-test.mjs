#!/usr/bin/env node
// scripts/taxonomy-discrimination-test.mjs
// TEMPORARY — taxonomy v1 discrimination test harness.
// Delete after validation is complete.
//
// Run: ANTHROPIC_API_KEY=<key> node scripts/taxonomy-discrimination-test.mjs
//
// Purpose: prove that the production taxonomy causes Michael to produce different
// gapType classifications — and materially different recommended actions — for two
// superficially identical DEVELOPING outcomes where the ONLY variable is whether
// the individual has had the workplace opportunity.
//
// This uses TAXONOMY_DEFINITIONS_BLOCK imported directly from the production module
// (netlify/functions/utils/p1-taxonomy.js) — not a mock. The test calls the same
// Claude model used in production.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  TAXONOMY_DEFINITIONS_BLOCK,
  TAXONOMY_REPORTING_PRINCIPLE,
  TAXONOMY_FINAL_ANALYSIS_QUESTIONS,
  GAP_TYPE_FAMILIES,
} = require('../netlify/functions/utils/p1-taxonomy.js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not set.');
  process.exit(1);
}

const MODEL = 'claude-sonnet-4-6';

// ── System prompt ─────────────────────────────────────────────────────────────
// Mirrors the structure of SYNTHESIS_SYSTEM in p1-synthesis-background.js,
// simplified to a single-area classification task so the taxonomy logic is
// isolated from the multi-source alignment / manager-perspective machinery.

const SYSTEM_PROMPT = `You are Michael, producing a development synthesis for the GCAi Professional Readiness Benchmark.

You will receive a candidate's assessment data for one area. Analyse the evidence and classify the primary limiting factor using the taxonomy below, then produce a development priority with the appropriate recommended action.

${TAXONOMY_DEFINITIONS_BLOCK}

## Reporting language
${TAXONOMY_REPORTING_PRINCIPLE}

## Final analysis
${TAXONOMY_FINAL_ANALYSIS_QUESTIONS}

## Output schema
Return ONLY valid JSON. No markdown, no preamble.

{
  "areaName": "Feedback, Reflection & Development",
  "areaOutcome": "<outcome from the assessment>",
  "gapType": "<one of the ten gap types>",
  "gapTypeRationale": "<specific reasoning — what in the evidence determined this type and not another>",
  "developmentPrioritiesForDiscussion": [
    {
      "rank": 1,
      "priority": "<specific, stage-appropriate development priority>",
      "rationale": "<grounded in the evidence provided>",
      "gapType": "<same as above — consistent with your classification>",
      "whatProgressMightLookLike": "<one observable, stage-appropriate sentence>",
      "managerAction": "<concrete action the manager or employer can take>"
    }
  ],
  "candidateFacingDevelopmentSummary": "<2-3 sentence plain-language summary for the candidate — no raw taxonomy labels>",
  "employerFacingSummary": "<2-3 sentence summary for the employer / development conversation — describes the nature of the development need and what kind of support would help>"
}`;

// ── Session A — Capability / Learning Need ────────────────────────────────────
// Individual has had the opportunity; the limiting factor is weak understanding
// and inability to internalise or apply feedback constructively.
// Expected: gapType = knowledge or application → family = learning-practice

const SESSION_A = {
  label: 'Session A — Capability / Learning Need',
  expected: { gapType: 'knowledge or application', family: 'learning-practice' },
  userMessage: `## Candidate assessment data

Discipline: Building Surveying
Months in current role: 14
Area: Feedback, Reflection & Development
Area outcome: DEVELOPING

## Candidate's responses (paraphrased from Michael's diagnostic session)

The candidate has had regular quarterly one-to-one meetings with their line manager throughout their 14 months. They have received specific written feedback on technical reports, client communication, and site visit notes. Their office runs structured quarterly reviews and the candidate has a named mentor who they meet monthly.

When asked what they have learned from feedback received, the candidate gave vague responses: "I try to take on board what I'm told" and "I know I need to get better at my reports." When asked to describe one specific thing that feedback has changed about how they work, they could not give a concrete example. They showed limited awareness of why structured reflection on feedback is a professional development practice rather than a performance management tool. When Michael asked them to explain how they would use feedback to identify a pattern in their development, the candidate could not articulate a process.

## Manager's assessment

Manager confirms the candidate receives regular structured feedback, has quarterly reviews, a mentor, and clear written development points after each piece of work.

Manager notes: "They receive the feedback fine, but I'm not sure it actually changes how they approach the next task. They don't seem to connect what they've been told with how they work differently afterwards. The conversations happen but I don't think they're translating into deliberate changes."

## Exposure confirmation
relevant-exposure-identified — candidate has had regular structured feedback opportunities throughout their role`
};

// ── Session B — Opportunity / Exposure Need ───────────────────────────────────
// Individual understands the principle clearly; the limiting factor is that
// their role has not provided the workplace opportunity to demonstrate it.
// Expected: gapType = exposure → family = workplace-exposure

const SESSION_B = {
  label: 'Session B — Opportunity / Exposure Need',
  expected: { gapType: 'exposure', family: 'workplace-exposure' },
  userMessage: `## Candidate assessment data

Discipline: Building Surveying
Months in current role: 14
Area: Feedback, Reflection & Development
Area outcome: DEVELOPING

## Candidate's responses (paraphrased from Michael's diagnostic session)

The candidate works on a small, primarily solo project under a senior surveyor who is frequently off-site. There are no formal review processes, no structured one-to-ones, and feedback is given informally and infrequently — described as "when something goes wrong."

When asked what effective feedback looks like, the candidate gave a clear, structured response: "Good feedback should be specific, timely, and tied to something I can actually change. It should help me understand not just what went wrong but why, and what I should do differently." When asked how they would use feedback to develop professionally, they described a deliberate reflection process: noting the feedback, identifying the underlying principle, and applying it consciously to the next similar task. They articulated clearly why this matters for APC development and could describe what a productive development conversation would look like. When Michael checked their understanding further, their answers held up under follow-up questions.

They stated explicitly: "I know what I should be doing with feedback — I just haven't had much of it to work with."

## Manager's assessment

Manager confirms: "We're a small team and I'm on-site most of the time. There aren't formal review structures — I give feedback when I notice something but it's not regular or structured. [Candidate] works quite independently and I don't have a strong view of how they respond to feedback because it doesn't come up much."

## Exposure confirmation
confirmed-lack-of-exposure — candidate has not had regular structured feedback conversations or formal review processes in this role`
};

// ── API call ──────────────────────────────────────────────────────────────────

async function callClaude(userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

function parseJSON(text) {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return { _parseError: true, _raw: text };
  }
}

const FAMILY_LABELS = {
  'learning-practice':       'Learning & Practice',
  'workplace-exposure':      'Workplace Exposure',
  'recognition-articulation':'Recognition & Articulation',
  'judgement-responsibility':'Judgement & Responsibility',
  'confidence-calibration':  'Confidence Calibration',
};

function getFamily(gapType) {
  const key = GAP_TYPE_FAMILIES[gapType];
  return key ? (FAMILY_LABELS[key] || key) : 'UNKNOWN — not in taxonomy';
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function run() {
  const W = 72;
  const line = '═'.repeat(W);
  const thin = '─'.repeat(W);

  console.log(line);
  console.log('GCAi TAXONOMY DISCRIMINATION TEST — v1 validation');
  console.log(`Model: ${MODEL}`);
  console.log(line);

  const results = [];

  for (const session of [SESSION_A, SESSION_B]) {
    process.stdout.write(`\nRunning ${session.label} ... `);
    const raw = await callClaude(session.userMessage);
    const parsed = parseJSON(raw);
    const gapType = parsed.gapType || parsed.developmentPrioritiesForDiscussion?.[0]?.gapType || null;
    const family = gapType ? getFamily(gapType) : 'not classified';
    results.push({ ...session, parsed, gapType, family, raw });
    console.log('done.');
  }

  // ── Per-session detail ────────────────────────────────────────────────────

  for (const r of results) {
    console.log(`\n${line}`);
    console.log(r.label);
    console.log(`Expected: gapType = ${r.expected.gapType}, family = ${FAMILY_LABELS[r.expected.family]}`);
    console.log(thin);

    if (r.parsed._parseError) {
      console.log('PARSE ERROR — raw output:');
      console.log(r.raw);
      continue;
    }

    console.log(`gapType:              ${r.gapType || 'none'}`);
    console.log(`Reporting family:     ${r.family}`);
    console.log(`Area outcome:         ${r.parsed.areaOutcome || 'not set'}`);
    console.log();
    console.log('Gap type rationale:');
    console.log(`  ${r.parsed.gapTypeRationale || 'none'}`);
    console.log();

    if (r.parsed.developmentPrioritiesForDiscussion?.length) {
      const p = r.parsed.developmentPrioritiesForDiscussion[0];
      console.log('Development priority:');
      console.log(`  ${p.priority}`);
      console.log();
      console.log('Manager / employer action:');
      console.log(`  ${p.managerAction}`);
      console.log();
      console.log('What progress looks like:');
      console.log(`  ${p.whatProgressMightLookLike}`);
      console.log();
    }

    console.log('Candidate-facing summary:');
    console.log(`  ${r.parsed.candidateFacingDevelopmentSummary || 'none'}`);
    console.log();
    console.log('Employer-facing summary:');
    console.log(`  ${r.parsed.employerFacingSummary || 'none'}`);
  }

  // ── Side-by-side ──────────────────────────────────────────────────────────

  const [a, b] = results;
  const gapsDiffer = a.gapType !== b.gapType;
  const familiesDiffer = a.family !== b.family;
  const pass = gapsDiffer && familiesDiffer;

  console.log(`\n${line}`);
  console.log('SIDE-BY-SIDE COMPARISON');
  console.log(line);

  const col = 26;
  const row = (label, va, vb) =>
    console.log(`${label.padEnd(20)} ${String(va).padEnd(col)} ${vb}`);

  row('', 'Session A (Capability)', 'Session B (Exposure)');
  row('gapType', a.gapType || 'N/A', b.gapType || 'N/A');
  row('Reporting family', a.family, b.family);
  row('Types differ?', gapsDiffer ? '✓ yes' : '✗ no', '');
  row('Families differ?', familiesDiffer ? '✓ yes' : '✗ no', '');

  console.log();
  if (pass) {
    console.log('RESULT: PASS');
    console.log('Taxonomy distinguished a capability need from an opportunity need.');
    console.log('Different gapType + different reporting family + (check above) different recommended action.');
  } else {
    console.log('RESULT: FAIL');
    if (!gapsDiffer) console.log(`Both sessions produced the same gapType: ${a.gapType}`);
    if (!familiesDiffer) console.log(`Both sessions mapped to the same family: ${a.family}`);
  }

  // ── Raw JSON ──────────────────────────────────────────────────────────────

  console.log(`\n${line}`);
  console.log('RAW JSON — Session A');
  console.log(thin);
  console.log(JSON.stringify(a.parsed, null, 2));

  console.log(`\n${line}`);
  console.log('RAW JSON — Session B');
  console.log(thin);
  console.log(JSON.stringify(b.parsed, null, 2));

  console.log(`\n${line}`);
}

run().catch(e => {
  console.error('\nFatal:', e.message);
  process.exit(1);
});
