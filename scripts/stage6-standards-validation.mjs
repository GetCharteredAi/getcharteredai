/**
 * Stage 6 — Platform-wide Professional Knowledge and Judgement Standard validation.
 *
 * Targeted spot-checks for the shared standard. NOT a complete content audit.
 * Tests four properties:
 *   1. JCT/NEC4 (PKR-04): response doesn't call JCT adversarial by design or
 *      NEC4 universally collaborative; handles balanced comparison
 *   2. Proprietary clause question: Michael explains limitation rather than inventing
 *   3. Contextual continuity: follow-up to JCT topic still receives PKR-04 context
 *   4. Ethics (PKR-01): correct Rules of Conduct used, not old Global Standards
 *
 * All tests use ai-tutor panel path (direct handler invocation).
 * Preserves single-model knowledge-first Tutor — no Sonnet gate, no evaluator.
 *
 * Not committed, pushed or deployed.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';

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
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET not found'); process.exit(1); }

// ── Load handler ──────────────────────────────────────────────────────────────
let handler;
try {
  const req = createRequire(import.meta.url);
  handler = req(resolve(__dirname, '../netlify/functions/ai-tutor.js')).handler;
  console.log('[INIT] Handler loaded — OK');
} catch (e) { console.error('[INIT] Handler failed:', e.message); process.exit(1); }

// ── Build test token ──────────────────────────────────────────────────────────
function makeTestToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email, plan: 'annual',
    activatedAt: Date.now() - 86400000 * 30,
    expires: Date.now() + 86400000 * 365,
  })).toString('base64');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
const TEST_TOKEN = makeTestToken('support@mabehq.com');

// ── askMichael helper ─────────────────────────────────────────────────────────
async function askMichael({ question, pathway, priorMessages = [] }) {
  const messages = [...priorMessages, { role: 'user', content: question }];
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      source: 'panel', moduleId: 0,
      pathway, modTitle: 'APC Preparation',
      messages, token: TEST_TOKEN,
    }),
  };
  const t0 = Date.now();
  const result = await handler(event);
  const body = JSON.parse(result.body);
  return { statusCode: result.statusCode, text: body.content?.[0]?.text ?? null, ms: Date.now() - t0 };
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Checks ────────────────────────────────────────────────────────────────────
// Patterns that should NOT appear (known error patterns from prior JCT behaviour)
const FORBIDDEN_JCT = [
  /adversarial by design/i,
  /inherently adversarial/i,
  /designed to be adversarial/i,
  /jct.{0,30}adversarial/i,
  /nec4.{0,50}universally collaborative/i,
  /nec.{0,20}inherently collaborative/i,
  /nec4.{0,30}always.{0,20}collaborat/i,
  /nec4.{0,30}universally.{0,20}target cost/i,
  /nec.{0,30}all.{0,20}target cost/i,
];

// Patterns that SHOULD appear in JCT/NEC4 balanced response
const REQUIRED_JCT = [
  /option|pricing|lump sum|remeasure|target cost|cost reimburs/i,
  /mutual trust|core clause|10\.1|collaborative/i,
];

// Patterns indicating limitation-explanation for proprietary clauses
const LIMITATION_INDICATORS = [
  /proprietary|cannot verify|specific clause|not able to confirm|exact wording|published document/i,
  /specific.{0,30}clause|clause.{0,30}specific/i,
  /without.{0,30}checking|refer to the contract|consult the contract|check the contract/i,
];

// Patterns for correct RICS ethics (current Rules of Conduct)
const CORRECT_ETHICS = [
  /rules of conduct/i,
  /2 february 2022|february 2022/i,
  /act in the public interest|public interest/i,
  /treat others with respect|diversity and inclusion/i,
];

// Patterns for incorrect RICS ethics (old Global Standards)
const INCORRECT_ETHICS = [
  /act with integrity.{0,50}high standard/i,
  /five.{0,30}global.{0,30}professional/i,
  /always provide a high standard of service/i,
  /act in a way that promotes trust in the profession/i,
];

// ── Test fixtures ─────────────────────────────────────────────────────────────
const FIXTURES = [
  {
    id: 'JCT-01',
    label: 'JCT vs NEC4 comparison — must not call JCT adversarial by design',
    question: 'Can you explain the key differences between JCT and NEC4 contracts? Which is better for collaborative projects?',
    pathway: 'Quantity Surveying and Construction',
    check: (text) => {
      const failures = [];
      for (const p of FORBIDDEN_JCT) {
        if (p.test(text)) failures.push('FORBIDDEN pattern found: ' + p.toString());
      }
      // Check PKR-04 influenced the response (should mention Options or pricing mechanisms)
      const hasContext = REQUIRED_JCT.some(p => p.test(text));
      if (!hasContext) failures.push('No NEC4 Options or pricing mechanism detail (PKR-04 may not have been injected)');
      return failures;
    }
  },
  {
    id: 'JCT-02',
    label: 'Proprietary NEC4 clause — must explain limitation, not invent clause text',
    question: 'What exactly does NEC4 clause 25.3 say about compensation events?',
    pathway: 'Quantity Surveying and Construction',
    check: (text) => {
      const failures = [];
      // Should NOT confidently assert clause text as fact
      const inventsCause = /clause 25\.3.{0,50}states|clause 25\.3.{0,50}says|clause 25\.3.{0,50}provides that/i.test(text)
        && !LIMITATION_INDICATORS.some(p => p.test(text));
      if (inventsCause) failures.push('Response asserts specific proprietary clause text without acknowledging limitation');
      return failures;
    }
  },
  {
    id: 'CTX-01',
    label: 'Contextual continuity — follow-up on NEC4 Option C without repeating contract name',
    question: 'What are the key risk implications of Option C for the contractor?',
    pathway: 'Quantity Surveying and Construction',
    priorMessages: [
      { role: 'user', content: 'Can you explain the NEC4 pricing options?' },
      { role: 'assistant', content: 'NEC4 offers six pricing options, from Option A (lump sum activity schedule) through to Option F (management contract). The most commercially significant distinction is between the priced options (A and B) and the target cost options (C and D).' }
    ],
    check: (text) => {
      const failures = [];
      // Should respond relevantly about Option C risk sharing
      const hasOptionC = /target cost|pain.?gain|risk.{0,20}shar|cost overrun|defined cost|disallowed cost/i.test(text);
      if (!hasOptionC) failures.push('No Option C risk-sharing content — contextual continuity may not be working');
      return failures;
    }
  },
  {
    id: 'ETH-01',
    label: 'RICS ethics — must use current Rules of Conduct, not old Global Standards',
    question: 'What are the five RICS ethical standards?',
    pathway: 'Building Surveying',
    check: (text) => {
      const failures = [];
      for (const p of INCORRECT_ETHICS) {
        if (p.test(text)) failures.push('INCORRECT ethics pattern found: ' + p.toString());
      }
      const hasCorrect = CORRECT_ETHICS.filter(p => p.test(text)).length;
      if (hasCorrect < 2) failures.push('Fewer than 2 correct Rules of Conduct markers found — response may be using incorrect framework');
      return failures;
    }
  },
  {
    id: 'ETH-02',
    label: 'RICS ethics follow-up — must name Rules of Conduct when asked about current framework',
    question: 'I thought the RICS ethical standards were things like "Act with integrity" and "Always provide a high standard of service" — is that still current?',
    pathway: 'Building Surveying',
    check: (text) => {
      const failures = [];
      // Should explain the old standards were superseded
      const correctsError = /superseded|replaced|2022|no longer current|rules of conduct/i.test(text);
      if (!correctsError) failures.push('Response does not correct the old Global Standards or reference Rules of Conduct');
      return failures;
    }
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 6 — Professional Knowledge and Judgement Standard Validation ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Scope: ai-tutor panel path — JCT/NEC4, contextual continuity, RICS ethics');
  console.log('Single-model knowledge-first Tutor preserved — no Sonnet gate, no evaluator');
  console.log('');

  const results = [];

  for (const f of FIXTURES) {
    process.stdout.write(`[${f.id}] ${f.label}... `);
    try {
      const r = await askMichael({ question: f.question, pathway: f.pathway, priorMessages: f.priorMessages || [] });
      const checkFailures = f.check(r.text || '');
      results.push({ ...f, text: r.text, statusCode: r.statusCode, ms: r.ms, checkFailures, error: null });
      const status = checkFailures.length === 0 ? 'PASS' : `FAIL (${checkFailures.length} issue${checkFailures.length > 1 ? 's' : ''})`;
      console.log(`${r.statusCode} — ${r.ms}ms — ${status}`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ ...f, text: null, checkFailures: [], error: e.message });
    }
    await pause(600);
  }

  // ── Full responses ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log('FULL RESPONSES');
  console.log('═'.repeat(72));

  for (const r of results) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`${r.id}: ${r.label}`);
    if (r.error) { console.log(`ERROR: ${r.error}`); continue; }
    console.log(`Status: ${r.statusCode}  Time: ${r.ms}ms`);
    if (r.checkFailures.length > 0) {
      console.log('CHECK FAILURES:');
      for (const f of r.checkFailures) console.log('  ! ' + f);
    } else {
      console.log('Checks: all passed');
    }
    console.log('');
    console.log(r.text ?? '(no response)');
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log('SUMMARY');
  console.log('═'.repeat(72));

  let passed = 0;
  for (const r of results) {
    const pass = !r.error && r.checkFailures.length === 0;
    if (pass) passed++;
    const mark = pass ? '✓' : '✗';
    console.log(`  ${mark}  ${r.id}: ${r.label}`);
    if (r.checkFailures.length > 0) {
      for (const f of r.checkFailures) console.log(`       ! ${f}`);
    }
    if (r.error) console.log(`       ! ERROR: ${r.error}`);
  }
  console.log(`\n  ${passed}/${FIXTURES.length} tests passed`);
  console.log('\nNot committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
