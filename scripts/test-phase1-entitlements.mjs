/**
 * Phase 1 content-protection — authenticated runtime entitlement tests
 *
 * Uses admin-login on the preview to obtain real signed tokens, then calls
 * get-lesson to verify permitted and denied access for every programme type.
 *
 * Usage:
 *   ADMIN_TEST_KEY=<key> node scripts/test-phase1-entitlements.mjs
 *
 * ADMIN_TEST_KEY must already be in your shell environment — do not paste
 * it into the chat or print it here.
 */

const PREVIEW   = 'https://feature-content-protection-phase1--getcharteredai.netlify.app';
const FUNCTIONS = `${PREVIEW}/.netlify/functions`;
const ADMIN_EMAIL = 'test@getcharteredai.com';

const ADMIN_KEY = process.env.ADMIN_TEST_KEY;
if (!ADMIN_KEY) {
  console.error('ADMIN_TEST_KEY not set in environment. Exiting.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(plan) {
  const r = await fetch(`${FUNCTIONS}/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_KEY, plan }),
  });
  const d = await r.json();
  if (!d.success || !d.token) throw new Error(`admin-login failed for plan=${plan}: ${d.error || JSON.stringify(d)}`);
  return d.token;
}

async function req(token, moduleId) {
  const r = await fetch(`${FUNCTIONS}/get-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, moduleId }),
  });
  let body = {};
  try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, code: body.code };
}

let pass = 0, fail = 0, skip = 0;

function result(label, ok, status, note) {
  if (ok) {
    console.log(`  PASS  ${label} → ${status}${note ? '  // ' + note : ''}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label} → ${status}${note ? '  // ' + note : ''}`);
    fail++;
  }
}

function skipNote(label, reason) {
  console.log(`  SKIP  ${label}  // ${reason}`);
  skip++;
}

async function section(name, fn) {
  console.log(`\n── ${name} ──`);
  try { await fn(); }
  catch (e) { console.log(`  ERROR  ${name}: ${e.message}`); fail++; }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

await section('Unauthenticated (no token)', async () => {
  const r = await fetch(`${FUNCTIONS}/get-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moduleId: 1 }),
  });
  result('No token → 401', r.status === 401, r.status);
});

await section('Annual plan', async () => {
  const t = await getToken('annual');
  const r1 = await req(t, 1);   result('Module 1  → 200 (permitted)',  r1.status === 200, r1.status);
  const r5 = await req(t, 5);   result('Module 5  → 200 (permitted)',  r5.status === 200, r5.status);
  const r12 = await req(t, 12); result('Module 12 → 200 (permitted)',  r12.status === 200, r12.status);
  const r13 = await req(t, 13); result('Module 13 → 403 (not annual)', r13.status === 403, r13.status, `code=${r13.code}`);
  const r36 = await req(t, 36); result('Module 36 → 403 (not annual)', r36.status === 403, r36.status, `code=${r36.code}`);
});

await section('Monthly plan (fresh — 1 module unlocked)', async () => {
  const t = await getToken('monthly');
  const r1 = await req(t, 1);  result('Module 1 → 200 (unlocked)',       r1.status === 200, r1.status);
  const r2 = await req(t, 2);  result('Module 2 → 403 (not yet unlocked)', r2.status === 403, r2.status, `code=${r2.code}`);
  const r5 = await req(t, 5);  result('Module 5 → 403 (not yet unlocked)', r5.status === 403, r5.status, `code=${r5.code}`);
  // Code audit confirms progressive unlock formula; fresh token exercises the boundary at month 1.
});

await section('Sprint plan (with pathway in JWT)', async () => {
  const t = await getToken('sprint');
  const r1  = await req(t, 1);  result('Module 1  → 200 (sprint entitlement)', r1.status === 200, r1.status);
  const r12 = await req(t, 12); result('Module 12 → 200 (sprint entitlement)', r12.status === 200, r12.status);
  const r2  = await req(t, 2);  result('Module 2  → 403 (not in sprint)',       r2.status === 403, r2.status, `code=${r2.code}`);
  const r5  = await req(t, 5);  result('Module 5  → 403 (not in sprint)',       r5.status === 403, r5.status, `code=${r5.code}`);
  const r13 = await req(t, 13); result('Module 13 → 403 (not in sprint)',       r13.status === 403, r13.status, `code=${r13.code}`);
});

await section('Sprint plan — existing tokens without pathway field', async () => {
  // Admin-login always includes pathway in new tokens. Old-format (no pathway) tokens
  // require JWT_SECRET to construct locally. Verified by code audit:
  //   checkEntitlement(sprint, 1)  → allowed without any pathway lookup
  //   checkEntitlement(sprint, 12) → allowed without any pathway lookup
  //   verifyToken()                → accepts any validly-signed payload regardless of fields present
  skipNote('Old-format Sprint token (no pathway)', 'requires JWT_SECRET to construct locally — confirmed by code audit');
});

await section('Referred plan', async () => {
  const t = await getToken('referred');
  const r12 = await req(t, 12); result('Module 12 → 200 (referred includes mock)', r12.status === 200, r12.status);
  const r13 = await req(t, 13); result('Module 13 → 200 (referred permitted)',     r13.status === 200, r13.status);
  const r16 = await req(t, 16); result('Module 16 → 200 (referred permitted)',     r16.status === 200, r16.status);
  const r36 = await req(t, 36); result('Module 36 → 200 (referred permitted)',     r36.status === 200, r36.status);
  const r1  = await req(t, 1);  result('Module 1  → 403 (not referred)',           r1.status === 403, r1.status, `code=${r1.code}`);
  const r5  = await req(t, 5);  result('Module 5  → 403 (not referred)',           r5.status === 403, r5.status, `code=${r5.code}`);
});

await section('Self-Paced plan (test record: all 12 unlocked)', async () => {
  const t = await getToken('selfpaced');
  const r1  = await req(t, 1);  result('Module 1  → 200 (unlocked)',           r1.status === 200, r1.status);
  const r6  = await req(t, 6);  result('Module 6  → 200 (all unlocked in test)', r6.status === 200, r6.status);
  const r12 = await req(t, 12); result('Module 12 → 200 (all unlocked in test)', r12.status === 200, r12.status);
  const r13 = await req(t, 13); result('Module 13 → 403 (not selfpaced)',       r13.status === 403, r13.status, `code=${r13.code}`);
});

await section('Year-one plan (should be denied — uses own page)', async () => {
  const t = await getToken('year-one');
  const r1 = await req(t, 1);
  result('Module 1 → 403 (wrong plan)', r1.status === 403, r1.status, `code=${r1.code}`);
});

await section('Cross-plan boundary: referred token requesting annual module', async () => {
  const t = await getToken('referred');
  const r3 = await req(t, 3); result('Module 3 → 403 (annual only, not referred)', r3.status === 403, r3.status, `code=${r3.code}`);
});

await section('Cross-plan boundary: sprint token requesting referred module', async () => {
  const t = await getToken('sprint');
  const r15 = await req(t, 15); result('Module 15 → 403 (referred only, not sprint)', r15.status === 403, r15.status, `code=${r15.code}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`PASS ${pass}  FAIL ${fail}  SKIP ${skip}`);
if (fail > 0) {
  console.log('\nOne or more tests failed — review output above before merging.');
  process.exit(1);
} else {
  console.log('\nAll runtime entitlement checks passed.');
}
