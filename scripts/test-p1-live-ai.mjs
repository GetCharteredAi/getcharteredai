/**
 * Live AI acceptance test for P1 conversational accommodations.
 * Tests actual Michael responses from the Netlify preview's p1-tutor function.
 *
 * Requires JWT_SECRET (already in .env — no secrets needed in the terminal).
 * Secure usage:
 *   ! node --env-file=.env scripts/test-p1-live-ai.mjs
 */

import { createHmac } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.P1_BASE_URL || 'https://deploy-preview-13--getcharteredai.netlify.app';

if (!JWT_SECRET) {
  console.error('\nERROR: JWT_SECRET not found. Run: node --env-file=.env scripts/test-p1-live-ai.mjs\n');
  process.exit(1);
}

// ── Token generation (matches p1-tutor.js verifyToken exactly) ────────────────
function makeTestToken() {
  const payload = {
    role: 'candidate',
    sessionId: 'p1-test-live-ai-acceptance',
    email: 'test@gca-test.internal',
    expires: Date.now() + 60 * 60 * 1000 // 1 hour
  };
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;

function pass(label) { console.log('  ✓', label); passed++; }
function fail(label, detail) { console.error('  ✗', label, detail ? `(${detail})` : ''); failed++; }
function warn(label, detail) { console.log('  ⚠', label, detail ? `(${detail})` : ''); warned++; }

async function callTutor(token, messages, discipline = 'Quantity Surveying', monthsInRole = 7) {
  const res = await fetch(`${BASE_URL}/.netlify/functions/p1-tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, messages, discipline, monthsInRole })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  const raw = (data.content || []).map(b => b.text || '').join('');
  let parsed = null;
  try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { /* null = no LM */ }
  return { raw, parsed };
}

// ── Test harness ──────────────────────────────────────────────────────────────
const token = makeTestToken();
const Q1 = 'Thinking about your time at work so far, can you tell me about something you did that you felt you handled professionally?';
const Q12 = 'Tell me about a situation where you had to decide whether you could continue yourself or whether you should check something with somebody else. What influenced your decision?';
const Q13 = 'Has there been a situation at work where you had to decide whether something needed raising with someone more senior? What did you do — or what would make you feel something was important enough to escalate?';

console.log(`\nLive AI acceptance tests — ${BASE_URL}`);
console.log('Token:', token.slice(0, 40) + '…\n');

// ── 1. Auth check ─────────────────────────────────────────────────────────────
console.log('1. Auth — valid token accepted');
try {
  await callTutor(token, [{ role: 'user', content: `Q1: ${Q1}\n\nMy response: I made sure to double-check a site measurement before submitting a report.` }]);
  pass('Valid test token accepted by p1-tutor');
} catch (e) { fail('Valid test token rejected', e.message); process.exit(1); }

// ── 2. Strong independent response — no learning moment ───────────────────────
console.log('\n2. Strong independent response — expect no learning moment');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `Q${12 + 1}: ${Q12}\n\nMy response: We were reviewing a cost plan when I spotted that the contingency allowance seemed very low compared with the risk register. I wasn't confident enough to change it without checking, so I flagged it to my senior surveyor before the report went to the client. She agreed and we revised it upward. My decision was based on the fact that if I was wrong in either direction it would affect the client relationship — so getting sign-off was the right call.`
  }]);
  if (!parsed || (!parsed.explain && !parsed.reprompt && !parsed.recognitionPrompt)) {
    pass('Strong response → no learning moment (Michael advances)');
  } else if (parsed.reprompt) {
    warn('Strong response → reprompt issued (minor — Michael could have advanced)', parsed.reprompt.slice(0, 80));
  } else {
    fail('Strong response triggered a full teaching loop unexpectedly', JSON.stringify(parsed).slice(0, 100));
  }
} catch (e) { fail('Strong response test failed', e.message); }

// ── 3. Rephrase accommodation ─────────────────────────────────────────────────
console.log('\n3. Rephrase accommodation [REPHRASE REQUEST]');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `[REPHRASE REQUEST]\n\nQ1: ${Q1}`
  }]);
  if (parsed?.rephrase && typeof parsed.rephrase === 'string' && parsed.rephrase.length > 20) {
    pass('Rephrase returned a reworded question');
    const sameWords = parsed.rephrase.toLowerCase().includes('handled professionally') && parsed.rephrase.toLowerCase().includes('thinking about your time');
    if (sameWords) warn('Rephrase may be too similar to original — contains same key phrases', parsed.rephrase.slice(0, 80));
    else pass('Rephrase uses different vocabulary from original');
    console.log('    Michael rephrase:', parsed.rephrase.slice(0, 120));
  } else {
    fail('Rephrase did not return { rephrase: "..." }', JSON.stringify(parsed).slice(0, 80));
  }
} catch (e) { fail('Rephrase test failed', e.message); }

// ── 4. Second rephrase [REPHRASE REQUEST 2] ───────────────────────────────────
console.log('\n4. Second rephrase [REPHRASE REQUEST 2]');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `[REPHRASE REQUEST 2]\n\nQ1: ${Q1}`
  }]);
  if (parsed?.rephrase) {
    pass('Second rephrase returned (correct — cap is client-side, not tutor-side)');
    console.log('    Michael rephrase 2:', parsed.rephrase.slice(0, 120));
  } else {
    warn('Second rephrase did not return rephrase shape', JSON.stringify(parsed).slice(0, 80));
  }
} catch (e) { fail('Second rephrase test failed', e.message); }

// ── 5. Clarify accommodation ──────────────────────────────────────────────────
console.log('\n5. Clarify accommodation [CLARIFY REQUEST]');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `[CLARIFY REQUEST]\n\nQ1: ${Q1}`
  }]);
  if (parsed?.clarify && typeof parsed.clarify === 'string' && parsed.clarify.length > 30) {
    pass('Clarify returned a response');
    const mentionsArea = /professional|conduct|behaviour|approach|standard|how you/i.test(parsed.clarify);
    if (mentionsArea) pass('Clarify response describes the area being assessed');
    else warn('Clarify response may not clearly name the area');
    const leaksAnswer = /you should say|model answer|good answer|strong answer|high score/i.test(parsed.clarify);
    if (!leaksAnswer) pass('Clarify response does not reveal model answer content');
    else fail('Clarify response appears to give model answer content', parsed.clarify.slice(0, 100));
    const academic = /this question is designed to assess|the assessment criteria/i.test(parsed.clarify);
    if (!academic) pass('Clarify response avoids academic register');
    else warn('Clarify response uses academic/formal register', parsed.clarify.slice(0, 100));
    console.log('    Michael clarify:', parsed.clarify.slice(0, 200));
  } else {
    fail('Clarify did not return { clarify: "..." }', JSON.stringify(parsed).slice(0, 80));
  }
} catch (e) { fail('Clarify test failed', e.message); }

// ── 6. Example accommodation ──────────────────────────────────────────────────
console.log('\n6. Example accommodation [EXAMPLE REQUEST]');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `[EXAMPLE REQUEST]\n\nQ1: ${Q1}`
  }]);
  if (parsed?.example && typeof parsed.example === 'string' && parsed.example.length > 30) {
    pass('Example returned a response');
    const disciplineRef = /survey|quantity|cost|build|measure|site|plan|report|client/i.test(parsed.example);
    if (disciplineRef) pass('Example references discipline-relevant context (QS)');
    else warn('Example may not reference QS discipline specifically');
    const prescriptive = /you should say|the right answer|a good answer|you should mention/i.test(parsed.example);
    if (!prescriptive) pass('Example does not prescribe the answer');
    else fail('Example appears to prescribe what the answer should be', parsed.example.slice(0, 100));
    console.log('    Michael example:', parsed.example.slice(0, 200));
  } else {
    fail('Example did not return { example: "..." }', JSON.stringify(parsed).slice(0, 80));
  }
} catch (e) { fail('Example test failed', e.message); }

// ── 7. No experience accommodation ────────────────────────────────────────────
console.log('\n7. No experience [NO EXPERIENCE]');
try {
  const { parsed } = await callTutor(token, [
    { role: 'user', content: `Q${13}: ${Q13}` },
    { role: 'assistant', content: '{ "recognitionPrompt": "Has there been any situation..." }' },
    { role: 'user', content: `[NO EXPERIENCE]\n\nQ${13}: ${Q13}` }
  ]);
  if (parsed?.recognitionPrompt && typeof parsed.recognitionPrompt === 'string') {
    pass('No-experience returns recognitionPrompt shape');
    const negative = /weak|gap|missing|lacking|failure|poor/i.test(parsed.recognitionPrompt);
    if (!negative) pass('Recognition prompt avoids negative capability language');
    else fail('Recognition prompt uses negative language', parsed.recognitionPrompt.slice(0, 100));
    console.log('    Michael recognitionPrompt:', parsed.recognitionPrompt.slice(0, 200));
  } else {
    fail('No-experience did not return { recognitionPrompt: "..." }', JSON.stringify(parsed).slice(0, 80));
  }
} catch (e) { fail('No-experience test failed', e.message); }

// ── 8. Uncertain signal — capable response ────────────────────────────────────
console.log('\n8. Uncertain signal — capable response → expect reassure or advance');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `[UNCERTAIN SIGNAL]\n\nQ${12 + 1}: ${Q12}\n\nMy response: I think I was helping put together a cost report and my supervisor mentioned the risk allowance looked light. I said maybe we should check with the client first and she said that was the right call. I'm not sure if that counts as escalation.`
  }]);
  if (!parsed || !parsed.explain) {
    if (parsed?.reassure) {
      pass('Uncertain signal with capable response → reassure (correct)');
      const grade = /excellent|perfect|right|correct|well done|great/i.test(parsed.reassure);
      if (!grade) pass('Reassure does not grade or score the response');
      else warn('Reassure response contains evaluative language', parsed.reassure);
      console.log('    Michael reassure:', parsed.reassure);
    } else {
      pass('Uncertain signal with capable response → no teaching moment (advance)');
    }
  } else {
    warn('Uncertain capable response triggered teaching — may be appropriate if evidence was thin', JSON.stringify(parsed).slice(0, 100));
  }
} catch (e) { fail('Uncertain capable test failed', e.message); }

// ── 9. Uncertain signal — thin response → expect probe or teach ───────────────
console.log('\n9. Uncertain signal — thin response → expect probe or teach');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `[UNCERTAIN SIGNAL]\n\nQ${12 + 1}: ${Q12}\n\nMy response: I usually just check with my manager about everything I'm not sure about. I'm not sure if that's right.`
  }]);
  if (parsed?.reprompt || parsed?.explain) {
    pass('Uncertain thin response → probe or teaching moment (correct — substance warrants it)');
    console.log('    Michael probe/teach:', (parsed.reprompt || parsed.explain || '').slice(0, 150));
  } else if (parsed?.reassure) {
    fail('Thin uncertain response → reassure (incorrect — substance does not demonstrate capability)');
  } else {
    warn('Thin uncertain response → no response (neutral advance)', JSON.stringify(parsed).slice(0, 60));
  }
} catch (e) { fail('Uncertain thin test failed', e.message); }

// ── 10. Learning-assisted application — check question quality ─────────────────
console.log('\n10. Learning-assisted application — check question after teaching');
try {
  // First get Michael to teach on a weak response
  const { parsed: lm } = await callTutor(token, [{
    role: 'user',
    content: `Q1: ${Q1}\n\nMy response: I try to be professional every day at work.`
  }]);

  if (lm?.explain && lm?.checkQuestion) {
    pass('Weak response triggers full teaching loop');
    console.log('    Michael explain:', lm.explain.slice(0, 150));
    console.log('    Michael checkQuestion:', lm.checkQuestion);

    // Now test a strong check-question response
    const { parsed: afterStrong } = await callTutor(token, [
      { role: 'user', content: `Q1: ${Q1}\n\nMy response: I try to be professional every day at work.` },
      { role: 'assistant', content: JSON.stringify(lm) },
      { role: 'user', content: lm.checkQuestion + '\n\nMy answer: We had a subcontractor claim that contradicted our site records. I re-checked our measurements against the original survey notes and raised the discrepancy with my senior surveyor before the payment was processed. The principle was: when client or commercial risk is involved, verify the evidence before signing off.' }
    ]);
    if (!afterStrong || (!afterStrong.explain && !afterStrong.reprompt)) {
      pass('Strong check-question response → Michael advances (evidence accepted)');
    } else {
      warn('Strong check response still triggered follow-up', JSON.stringify(afterStrong).slice(0, 100));
    }

    // Now test a weak check-question response
    const { parsed: afterWeak } = await callTutor(token, [
      { role: 'user', content: `Q1: ${Q1}\n\nMy response: I try to be professional every day at work.` },
      { role: 'assistant', content: JSON.stringify(lm) },
      { role: 'user', content: lm.checkQuestion + "\n\nMy answer: I would probably just ask my manager." }
    ]);
    if (afterWeak?.reprompt || afterWeak?.explain) {
      pass('Weak check-question response → Michael probes further (does not auto-accept)');
    } else {
      warn('Weak check response advanced without further probe (may reduce evidence accuracy)');
    }
  } else if (lm?.reprompt) {
    warn('Weak Q1 response → reprompt (not full loop) — check-question flow not tested');
  } else {
    fail('Weak Q1 response produced no learning moment');
  }
} catch (e) { fail('Learning-assisted application test failed', e.message); }

// ── 11. Tone — no praise openers ──────────────────────────────────────────────
console.log('\n11. Tone — teaching explanation should not open with praise');
try {
  const { parsed } = await callTutor(token, [{
    role: 'user',
    content: `Q${14}: What is the most useful feedback you have received since starting, and what have you changed as a result?\n\nMy response: I got some feedback once. It was useful.`
  }]);
  if (parsed?.explain) {
    const praiseOpener = /^(great|well done|good|excellent|that'?s?( a)? (great|good|strong|solid)|thanks for sharing|thank you for)/i.test(parsed.explain.trim());
    if (!praiseOpener) pass('Teaching explanation does not open with praise');
    else fail('Teaching explanation opens with generic praise', parsed.explain.slice(0, 80));
  } else if (parsed?.reprompt) {
    const praiseOpener = /^(great|well done|good|excellent)/i.test(parsed.reprompt.trim());
    if (!praiseOpener) pass('Reprompt does not open with praise');
    else fail('Reprompt opens with generic praise', parsed.reprompt.slice(0, 80));
  } else {
    warn('No learning moment returned for thin Q14 response — cannot test tone');
  }
} catch (e) { fail('Tone test failed', e.message); }

// ── 12. NOT ASSESSED does not appear for answered questions ───────────────────
console.log('\n12. Tutor does not return NOT ASSESSED for answered questions');
try {
  const { raw } = await callTutor(token, [{
    role: 'user',
    content: `Q1: ${Q1}\n\nMy response: I made sure all my measurements were double-checked before submitting the report because I knew the client was relying on them.`
  }]);
  if (!raw.includes('NOT ASSESSED')) {
    pass('NOT ASSESSED does not appear in tutor response for answered question');
  } else {
    fail('Tutor returned NOT ASSESSED for an answered question');
  }
} catch (e) { fail('NOT ASSESSED test failed', e.message); }

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Live AI tests: ${passed} passed, ${failed} failed, ${warned} warnings`);
if (failed > 0) {
  console.error('\nFAILED — see failures above\n');
  process.exit(1);
} else {
  console.log(warned > 0 ? '\nPASSED WITH WARNINGS — review warnings above\n' : '\nALL PASSED\n');
}
