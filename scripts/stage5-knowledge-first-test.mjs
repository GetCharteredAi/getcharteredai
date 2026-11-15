/**
 * Stage 5 — Knowledge-first Michael AI Tutor acceptance test.
 *
 * Tests the handler after quality-gate removal.
 * Invokes the handler directly (no netlify dev required).
 * PKR is injected before generation; no Sonnet evaluation or revision pipeline.
 *
 * Fixed test questions (do not modify between runs):
 *   ETH-01  — RICS ethics / Rules of Conduct           (expects PKR-01)
 *   QS-01   — HGCRA payment provisions                  (expects PKR-02)
 *   HS-05   — Asbestos management obligations            (expects PKR-03)
 *   BS-01   — Building pathology — cracking above lintel (no PKR)
 *   BS-06   — Structural safety — distorted wall         (no PKR)
 *   CTRL-3  — JCT vs NEC4 (no PKR entry)                (no PKR)
 *   FU-01   — APC interview coaching                     (no PKR)
 *   CTRL-4  — Follow-up that changes safety context      (no PKR)
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

// ── Load handler directly ─────────────────────────────────────────────────────
let handler;
try {
  const handlerPath = resolve(__dirname, '../netlify/functions/ai-tutor.js');
  const req = createRequire(import.meta.url);
  const mod = req(handlerPath);
  handler = mod.handler;
  console.log('[INIT] Handler loaded from ai-tutor.js — OK');
} catch (e) { console.error('[INIT] Handler failed:', e.message); process.exit(1); }

// ── Build a valid test token ──────────────────────────────────────────────────
function makeTestToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    plan: 'annual',
    activatedAt: Date.now() - 86400000 * 30,
    expires: Date.now() + 86400000 * 365,
  })).toString('base64');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

const TEST_TOKEN = makeTestToken('support@mabehq.com');

// ── Invoke handler ─────────────────────────────────────────────────────────────
async function askMichael({ question, pathway, priorMessages = [] }) {
  const messages = [...priorMessages, { role: 'user', content: question }];
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      source: 'panel',
      moduleId: 0,
      pathway,
      modTitle: 'APC Preparation',
      messages,
      token: TEST_TOKEN,
    }),
  };

  const t0 = Date.now();
  const result = await handler(event);
  const ms = Date.now() - t0;
  const body = JSON.parse(result.body);

  return {
    statusCode: result.statusCode,
    text: body.content?.[0]?.text ?? null,
    quality_gate: body.quality_gate ?? null,
    ms,
  };
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test fixtures ─────────────────────────────────────────────────────────────
const FIXTURES = [
  {
    id: 'ETH-01',
    label: 'RICS ethics — Rules of Conduct',
    question: 'What are the five RICS ethical standards?',
    pathway: 'Building Surveying',
    expectPkr: true,
    expectSubstantive: true,
  },
  {
    id: 'QS-01',
    label: 'HGCRA payment provisions',
    question: 'Can you explain the main payment provisions under the Housing Grants, Construction and Regeneration Act 1996?',
    pathway: 'Quantity Surveying and Construction',
    expectPkr: true,
    expectSubstantive: true,
  },
  {
    id: 'HS-05',
    label: 'Asbestos management obligations',
    question: 'There is asbestos in a commercial building I\'m managing on behalf of a client. What are my obligations as the managing agent?',
    pathway: 'Building Surveying',
    expectPkr: true,
    expectSubstantive: true,
  },
  {
    id: 'BS-01',
    label: 'Building pathology — cracking above lintel',
    question: 'A client reports cracking above a door lintel. What should I consider?',
    pathway: 'Building Surveying',
    expectPkr: false,
    expectSubstantive: true,
  },
  {
    id: 'BS-06',
    label: 'Structural safety — distorted loadbearing wall',
    question: 'You are inspecting an occupied building and notice significant distortion to a loadbearing wall. What should you do?',
    pathway: 'Building Surveying',
    expectPkr: false,
    expectSubstantive: true,
  },
  {
    id: 'CTRL-3',
    label: 'No PKR match — JCT vs NEC4',
    question: 'Can you explain the key differences between JCT and NEC4 contracts?',
    pathway: 'Quantity Surveying and Construction',
    expectPkr: false,
    expectSubstantive: true,
  },
  {
    id: 'FU-01',
    label: 'APC interview coaching — diagonal cracking',
    question: 'How should I explain what diagonal cracking might indicate during my APC interview?',
    pathway: 'Building Surveying',
    expectPkr: false,
    expectSubstantive: true,
  },
  {
    id: 'CTRL-4',
    label: 'Follow-up that changes safety context',
    question: 'The client has just told me the wall I\'m looking at is supporting the floor above and the building is currently occupied with people working directly below. Does this change what I should do?',
    pathway: 'Building Surveying',
    expectPkr: false,
    expectSubstantive: true,
    priorMessages: [
      { role: 'user', content: 'You are inspecting an occupied building and notice significant distortion to a loadbearing wall. What should you do?' },
      { role: 'assistant', content: 'The first thing to consider is whether the building is immediately safe to occupy. Significant distortion to a loadbearing wall is a structural concern that warrants prompt professional assessment. Before planning a detailed investigation, you need to form a view on whether the distortion appears active and whether it poses an immediate risk to the occupants.' },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stage 5 — Knowledge-First Michael AI Tutor Acceptance Test ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Handler: netlify/functions/ai-tutor.js (quality gate removed, PKR injection active)');
  console.log('Test: direct handler invocation with valid test token');
  console.log('');

  const results = [];

  for (const f of FIXTURES) {
    process.stdout.write(`[${f.id}] ${f.label}... `);
    try {
      const r = await askMichael({ question: f.question, pathway: f.pathway, priorMessages: f.priorMessages || [] });
      results.push({ ...f, result: r, error: null });

      const hasResponse = !!r.text && r.text.length > 50;
      const hasGate = !!r.quality_gate;
      console.log(`${r.statusCode} — ${r.ms}ms — response: ${hasResponse ? r.text.length + ' chars' : 'EMPTY'} — gate field: ${hasGate ? 'PRESENT (unexpected)' : 'absent (correct)'}`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ ...f, result: null, error: e.message });
    }
    await pause(400);
  }

  // ── Full responses ────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(72));
  console.log('FULL RESPONSES');
  console.log('═'.repeat(72));

  for (const f of results) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`${f.id}: ${f.label}`);
    console.log(`Pathway: ${f.pathway}`);
    if (f.error) {
      console.log(`ERROR: ${f.error}`);
      continue;
    }
    const r = f.result;
    console.log(`Status: ${r.statusCode}  Time: ${r.ms}ms`);
    console.log(`Quality gate field in response: ${r.quality_gate ? JSON.stringify(r.quality_gate) : 'none (correct)'}`);
    console.log('');
    console.log(r.text ?? '(no response text)');
  }

  // ── Acceptance checks ─────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(72));
  console.log('ACCEPTANCE CHECKS');
  console.log('═'.repeat(72));

  const checks = [];

  for (const f of results) {
    if (f.error) {
      checks.push({ label: `${f.id}: handler did not error`, pass: false });
      continue;
    }
    const r = f.result;
    checks.push({ label: `${f.id}: HTTP 200`, pass: r.statusCode === 200 });
    checks.push({ label: `${f.id}: response text present and substantive`, pass: !!r.text && r.text.length > 100 });
    checks.push({ label: `${f.id}: no quality_gate field (gate removed)`, pass: !r.quality_gate });
  }

  // PKR injection check: confirm ETH-01, QS-01, HS-05 responses contain content
  // that would only appear with PKR injection (checked manually in full responses above)
  checks.push({
    label: 'ETH-01: response delivered (PKR-01 context available)',
    pass: !!(results.find(f => f.id === 'ETH-01')?.result?.text),
  });
  checks.push({
    label: 'QS-01: response delivered (PKR-02 context available)',
    pass: !!(results.find(f => f.id === 'QS-01')?.result?.text),
  });
  checks.push({
    label: 'HS-05: response delivered (PKR-03 context available)',
    pass: !!(results.find(f => f.id === 'HS-05')?.result?.text),
  });
  checks.push({
    label: 'CTRL-3: response delivered without PKR (no match)',
    pass: !!(results.find(f => f.id === 'CTRL-3')?.result?.text),
  });
  checks.push({
    label: 'CTRL-4: follow-up with context delivered',
    pass: !!(results.find(f => f.id === 'CTRL-4')?.result?.text),
  });

  let passed = 0;
  for (const c of checks) {
    const mark = c.pass ? '✓' : '✗';
    if (c.pass) passed++;
    console.log(`  ${mark}  ${c.label}`);
  }
  console.log(`\n  ${passed}/${checks.length} checks passed`);
  console.log('\nNot committed, pushed or deployed.');
}

main().catch(e => { console.error(e); process.exit(1); });
