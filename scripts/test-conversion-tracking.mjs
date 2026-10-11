/**
 * Google Ads conversion tracking — automated tests
 * Covers: get-payment-amount function, verify-session response structure, success.html implementation
 * Run: node scripts/test-conversion-tracking.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

let passed = 0, failed = 0;
function ok(label, condition) {
  if (condition) { console.log('  ✓', label); passed++; }
  else { console.error('  ✗', label); failed++; }
}

// ── Stripe fetch mock ─────────────────────────────────────────────────────────
let mockFetchImpl = null;
const originalFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (mockFetchImpl) return mockFetchImpl(url, opts);
  return originalFetch(url, opts);
};
function mockStripe(data, ok = true) {
  mockFetchImpl = async () => ({ ok, json: async () => data });
}
function mockStripeNetworkError() {
  mockFetchImpl = async () => { throw new Error('Network error'); };
}
function clearMock() { mockFetchImpl = null; }

// ── Load function under test ──────────────────────────────────────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_for_tests';
const { handler } = require(path.join(root, 'netlify/functions/get-payment-amount.js'));

// ─── 1. get-payment-amount — HTTP method guards ───────────────────────────────
console.log('\n1. get-payment-amount — HTTP method guards');

{
  const res = await handler({ httpMethod: 'OPTIONS' });
  ok('OPTIONS returns 200', res.statusCode === 200);
}
{
  const res = await handler({ httpMethod: 'GET' });
  ok('GET returns 405', res.statusCode === 405);
}
{
  const res = await handler({ httpMethod: 'PUT' });
  ok('PUT returns 405', res.statusCode === 405);
}

// ─── 2. get-payment-amount — request validation ───────────────────────────────
console.log('\n2. get-payment-amount — request validation');

{
  const res = await handler({ httpMethod: 'POST', body: 'not-json' });
  ok('Invalid JSON body returns 400', res.statusCode === 400);
}
{
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
  ok('Missing session_id returns 400', res.statusCode === 400);
}
{
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: '' }) });
  ok('Empty session_id returns 400', res.statusCode === 400);
}
{
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'pi_3ABC' }) });
  ok('session_id not starting with cs_ returns 400', res.statusCode === 400);
}
{
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'sub_12345' }) });
  ok('Subscription ID rejected (must start cs_)', res.statusCode === 400);
}

// ─── 3. get-payment-amount — paid sessions ────────────────────────────────────
console.log('\n3. get-payment-amount — paid sessions');

{
  mockStripe({ payment_status: 'paid', status: 'complete', amount_total: 49700, currency: 'gbp' });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_annual123' }) });
  const body = JSON.parse(res.body);
  ok('Paid live session returns statusCode 200', res.statusCode === 200);
  ok('Paid live session returns paid: true', body.paid === true);
  ok('Paid live session returns correct amount (pence)', body.amount === 49700);
  ok('Paid live session returns uppercase currency', body.currency === 'GBP');
  clearMock();
}

{
  mockStripe({ payment_status: 'paid', status: 'complete', amount_total: 4900, currency: 'gbp' });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_monthly123' }) });
  const body = JSON.parse(res.body);
  ok('Monthly subscription (£49) returns paid: true with correct amount', body.paid === true && body.amount === 4900);
  clearMock();
}

{
  // status=complete covers subscriptions where payment_status may differ
  mockStripe({ payment_status: 'no_payment_required', status: 'complete', amount_total: 4900, currency: 'gbp' });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_sub456' }) });
  const body = JSON.parse(res.body);
  ok('status=complete alone marks as paid (subscription path)', body.paid === true);
  clearMock();
}

{
  // Test-mode session IDs are accepted by the server function (guard is client-side only)
  mockStripe({ payment_status: 'paid', status: 'complete', amount_total: 29700, currency: 'gbp' });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_sprint123' }) });
  const body = JSON.parse(res.body);
  ok('cs_test_ session accepted by server function (client-side guard fires it)', body.paid === true && body.amount === 29700);
  clearMock();
}

{
  // Missing currency field — should default to GBP
  mockStripe({ payment_status: 'paid', status: 'complete', amount_total: 39700 });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_nocurrency' }) });
  const body = JSON.parse(res.body);
  ok('Missing currency field defaults to GBP', body.currency === 'GBP');
  clearMock();
}

// ─── 4. get-payment-amount — unpaid / error cases ────────────────────────────
console.log('\n4. get-payment-amount — unpaid and error handling');

{
  mockStripe({ payment_status: 'unpaid', status: 'open', amount_total: 29700, currency: 'gbp' });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_unpaid123' }) });
  const body = JSON.parse(res.body);
  ok('Unpaid session returns statusCode 200', res.statusCode === 200);
  ok('Unpaid session returns paid: false', body.paid === false);
  ok('Unpaid session does not expose amount', body.amount === undefined);
  clearMock();
}

{
  mockStripe({ error: { message: 'No such checkout.session' } }, false);
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_notfound' }) });
  const body = JSON.parse(res.body);
  ok('Stripe API non-ok returns paid: false (no crash)', res.statusCode === 200 && body.paid === false);
  clearMock();
}

{
  mockStripeNetworkError();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_neterror' }) });
  const body = JSON.parse(res.body);
  ok('Network error returns paid: false gracefully', res.statusCode === 200 && body.paid === false);
  clearMock();
}

{
  // Temporarily remove the secret key
  const saved = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_live_nokey' }) });
  ok('Missing STRIPE_SECRET_KEY returns 500', res.statusCode === 500);
  process.env.STRIPE_SECRET_KEY = saved;
}

// ─── 5. verify-session.js — response structure ───────────────────────────────
console.log('\n5. verify-session.js — response structure');

const vsSrc = readFileSync(path.join(root, 'netlify/functions/verify-session.js'), 'utf8');
ok('verify-session response includes amount field', vsSrc.includes('amount: session.amount_total'));
ok('verify-session response includes currency field', vsSrc.includes("currency: (session.currency || 'gbp').toUpperCase()"));
ok('amount and currency added in same response object as success:true', (() => {
  const successLine = vsSrc.indexOf('success: true');
  const amountLine = vsSrc.indexOf('amount: session.amount_total');
  // Both should be within 200 chars of each other (same JSON object)
  return successLine > 0 && amountLine > 0 && Math.abs(successLine - amountLine) < 200;
})());

// ─── 6. success.html — Google tag and conversion implementation ───────────────
console.log('\n6. success.html — implementation verification');

const successSrc = readFileSync(path.join(root, 'public/success.html'), 'utf8');

ok('Google tag script loaded in <head>',
  successSrc.includes('https://www.googletagmanager.com/gtag/js?id=AW-18498077631'));
ok('gtag config call present', successSrc.includes("gtag('config', 'AW-18498077631')"));
ok('CONVERSION_SEND_TO set to confirmed label zp1FCNWxqpkdEL-HyfRE',
  successSrc.includes("'AW-18498077631/zp1FCNWxqpkdEL-HyfRE'"));
ok('Old Sprint label QgrnCNeAvJMdEL-HyfRE not present', !successSrc.includes('QgrnCNeAvJMdEL-HyfRE'));
ok('REPLACE_WITH_LABEL placeholder fully removed', !successSrc.includes('REPLACE_WITH_LABEL'));
ok('fireConversion function defined', successSrc.includes('function fireConversion('));
ok('Deduplication flag _convFired prevents double firing', successSrc.includes('_convFired'));
ok('Conversion event uses actual amount (not hardcoded price)', successSrc.includes('amountPence / 100'));
ok('Conversion sends GBP currency', successSrc.includes("currency: currency || 'GBP'"));
ok('Conversion uses transaction_id for deduplication', successSrc.includes('transaction_id: transactionId'));
ok('fireConversion called on activation success (data.amount, data.currency)',
  successSrc.includes('fireConversion(data.amount, data.currency, sessionId)'));
ok('fireConversion called on page load (d.amount, d.currency)',
  successSrc.includes('fireConversion(d.amount, d.currency, sessionId)'));
ok('Page-load conversion uses get-payment-amount endpoint',
  successSrc.includes('/.netlify/functions/get-payment-amount'));

// ─── 7. success.html — test isolation and consent guards ───────────────────────
console.log('\n7. success.html — test isolation and consent guards');

ok('Production domain guard: only fires on getcharteredai.com',
  successSrc.includes("window.location.hostname !== 'getcharteredai.com'"));
ok('Test-session guard: cs_test_ prefix blocked client-side',
  successSrc.includes("transactionId.startsWith('cs_test_')"));
ok('gtag availability guard prevents errors when tag is blocked',
  successSrc.includes("typeof gtag !== 'function'"));
ok('Page-load fetch wrapped in try/catch (ad-blocker resilience)',
  successSrc.match(/\(async \(\) => \{\s+try \{[\s\S]*?get-payment-amount/) !== null);
ok('No Netlify preview domain added to cross-domain tracking',
  !successSrc.includes('netlify.app') && !successSrc.includes('netlify.com'));
ok('Debug log fires on non-production domains (safe payload inspection without gtag call)',
  successSrc.includes("'[GCAi conversion – preview only]'"));
ok('Google Consent Mode default denies ad_storage before consent',
  successSrc.includes("gtag('consent', 'default'") && successSrc.includes("ad_storage: 'denied'"));
ok('Consent Mode default set before gtag config call',
  successSrc.indexOf("gtag('consent', 'default'") < successSrc.indexOf("gtag('config'"));
ok('Consent state updated in DOMContentLoaded when gca_cookies accepted',
  successSrc.includes("localStorage.getItem('gca_cookies') === 'accepted'") &&
  successSrc.includes("gtag('consent', 'update'") && successSrc.includes("ad_storage: 'granted'"));

// ─── 8. Functional integrity — existing code untouched ───────────────────────
console.log('\n8. Existing activation flow — no regressions');

ok('verify-session POST call preserved', successSrc.includes("'/.netlify/functions/verify-session'"));
ok('JWT stored in localStorage after activation', successSrc.includes("localStorage.setItem('gca_token'"));
ok('Plan stored in localStorage', successSrc.includes("localStorage.setItem('gca_plan'"));
ok('Welcome email still sent after activation', successSrc.includes("'/.netlify/functions/send-welcome'"));
ok('Apprentice redirect preserved', successSrc.includes("'/apprentice-review'"));
ok('Dashboard redirect preserved', successSrc.includes("'/index.html?view=dashboard'"));
ok('Password minimum length check preserved', successSrc.includes('pass.length < 8'));

// ─── 9. index.html — cookie banner accuracy ──────────────────────────────────
console.log('\n9. index.html — cookie banner accuracy');

const indexSrc = readFileSync(path.join(root, 'public/index.html'), 'utf8');
ok('Banner no longer falsely claims no advertising cookies are used',
  !indexSrc.includes('No advertising or tracking cookies are used'));
ok('Banner accurately mentions advertising cookies', indexSrc.includes('advertising cookies'));
ok('gca_cookies localStorage key used for consent state', indexSrc.includes("'gca_cookies'"));
ok('acceptCookies and declineCookies functions defined',
  indexSrc.includes('function acceptCookies') && indexSrc.includes('function declineCookies'));

// ─── Final summary ────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\n  FAILED\n'); process.exit(1); }
else { console.log('\n  ALL PASSED\n'); }
