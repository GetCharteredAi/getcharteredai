// scripts/stage1-test.mjs
// Stage 1 knowledge-correction acceptance tests
// Tests ETH-01, QS-01, HS-05 (original questions + follow-ups) using the updated ai-tutor.js
// Panel config: claude-haiku-4-5-20251001, max_tokens 2000, source=panel, moduleId=0
// NOT committed, pushed or deployed. Development-only.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { createRequire }    from 'module';

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

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

// ── Extract buildModuleSystemPrompt from ai-tutor.js without modifying the file ──
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

const PANEL = { model: 'claude-haiku-4-5-20251001', max_tokens: 2000, source: 'panel', moduleId: 0 };
const HEADERS = { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };

async function callAPI(system, messages) {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model: PANEL.model, max_tokens: PANEL.max_tokens, system, messages }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.content[0].text, tokens: data.usage.output_tokens, ms: Date.now() - t0 };
}

// ── Test definitions ──
const TESTS = [
  {
    id:      'ETH-01',
    label:   'Five RICS ethical standards — panel mode moduleId=0',
    pathway: 'Building Surveying',
    q1:      'What are the five RICS ethical standards?',
    q2:      'What happened to the old five ethical standards — act with integrity, always provide a high standard of service, and so on? Are they still relevant?',
    checks: [
      'States current five Rules of Conduct (effective 2 February 2022)',
      'Does NOT list seven mandatory competencies as the answer to an ethics framework question',
      'Acknowledges supersession of old five standards in February 2022',
      'Does not deny that a five-item ethical framework exists',
      'Follow-up: explains old standards were superseded; gives current Rules of Conduct',
    ],
  },
  {
    id:      'QS-01',
    label:   'HGCRA 1996 payment provisions — panel mode moduleId=0',
    pathway: 'Quantity Surveying and Construction',
    q1:      'Can you explain the main payment provisions under the Housing Grants, Construction and Regeneration Act 1996?',
    q2:      "Does the Act apply to my architect's fee appointment for a commercial project?",
    checks: [
      'Does NOT state a £1 million (or any monetary) threshold',
      'Does NOT state professional services are categorically excluded',
      'Explains stage payments, payment notice mechanism, pay less notice, right to suspend',
      'Notes payment periods are contract-specific / Scheme for Construction Contracts-dependent',
      "Follow-up: confirms architectural appointments ARE within scope (s.104(2)) with appropriate qualification",
    ],
  },
  {
    id:      'HS-05',
    label:   'Asbestos management obligations — commercial building — panel mode moduleId=0',
    pathway: 'Building Surveying',
    q1:      "There is asbestos in a commercial building I'm managing on behalf of a client. What are my obligations as the managing agent?",
    q2:      'Do I need to tell the Health and Safety Executive about the asbestos?',
    checks: [
      'Does NOT state managing agent must notify HSE on discovery',
      'Explains Reg 4 duty to manage: assessment, written management plan, information provision',
      'Does NOT present general HSE notification as part of the duty to manage',
      'Follow-up: explicitly clarifies HSE notification is for asbestos WORK (Reg 9), not discovery',
      'Follow-up: explains distinction between duty to manage (Reg 4) and notification for licensed/NNLW work (Reg 9)',
    ],
  },
];

// ── Main ──
const ts = new Date().toISOString();
console.log(`\n=== Stage 1 Knowledge Correction Tests ===`);
console.log(`Timestamp: ${ts}`);
console.log(`Panel config: model=${PANEL.model}  max_tokens=${PANEL.max_tokens}  source=${PANEL.source}  moduleId=${PANEL.moduleId}`);
console.log(`Not committed, pushed or deployed.\n`);

const results = [];
for (const t of TESTS) {
  console.log(`  [${t.id}] ${t.label} ...`);
  try {
    const sys = buildModuleSystemPrompt(PANEL.moduleId, t.pathway, null, PANEL.source);
    const r1  = await callAPI(sys, [{ role: 'user', content: t.q1 }]);
    const r2  = await callAPI(sys, [
      { role: 'user',      content: t.q1    },
      { role: 'assistant', content: r1.text },
      { role: 'user',      content: t.q2    },
    ]);
    results.push({ ...t, r1, r2, error: null });
    console.log(`  [${t.id}] done  q1=${r1.ms}ms/${r1.tokens}tok  q2=${r2.ms}ms/${r2.tokens}tok`);
  } catch (e) {
    results.push({ ...t, error: e.message });
    console.log(`  [${t.id}] ERROR: ${e.message}`);
  }
}

console.log('\n');

const lines = [`=== Stage 1 Knowledge Correction Tests ===`, `Timestamp: ${ts}`, ``];

for (const r of results) {
  lines.push('='.repeat(70));
  lines.push(`[${r.id}] ${r.label}`);
  lines.push(`Pathway: ${r.pathway}`);
  lines.push('='.repeat(70));
  lines.push('');

  if (r.error) {
    lines.push(`ERROR: ${r.error}`);
    lines.push('');
    continue;
  }

  lines.push(`Q1: ${r.q1}`);
  lines.push(`Response (${r.r1.tokens} tokens, ${r.r1.ms}ms):`);
  lines.push(r.r1.text);
  lines.push('');
  lines.push(`Follow-up: ${r.q2}`);
  lines.push(`Response (${r.r2.tokens} tokens, ${r.r2.ms}ms):`);
  lines.push(r.r2.text);
  lines.push('');
  lines.push('--- Acceptance checks (human review required) ---');
  r.checks.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
  lines.push('');
}

const outPath = `/tmp/stage1-test-${Date.now()}.output`;
writeFileSync(outPath, lines.join('\n'));
console.log(`Full output printed above and saved to: ${outPath}`);

// Print to console as well
console.log(lines.join('\n'));
