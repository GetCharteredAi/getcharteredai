#!/usr/bin/env node
// scripts/reissue-tokens.mjs
// Re-issues HMAC-SHA256 tokens to all active Sprint / Referred / Annual customers
// via magic-link email, replacing legacy truncated-base64 tokens.
//
// DRY RUN by default — logs what would be sent without emailing anyone.
// Set DRY_RUN=false to send live.
//
// Usage:
//   JWT_SECRET=... STRIPE_SECRET_KEY=... RESEND_API_KEY=... node scripts/reissue-tokens.mjs
//   DRY_RUN=false JWT_SECRET=... STRIPE_SECRET_KEY=... RESEND_API_KEY=... node scripts/reissue-tokens.mjs

import { createHmac } from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN         = process.env.DRY_RUN !== 'false'; // default: true
const JWT_SECRET      = process.env.JWT_SECRET;
const STRIPE_SECRET   = process.env.STRIPE_SECRET_KEY;
const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const BASE_URL        = process.env.BASE_URL || 'https://getcharteredai.com';

if (!JWT_SECRET || !STRIPE_SECRET || !RESEND_API_KEY) {
  console.error('Missing required env vars: JWT_SECRET, STRIPE_SECRET_KEY, RESEND_API_KEY');
  process.exit(1);
}

const PLAN_CONFIG = {
  sprint:   { days: 70,  label: 'APC Final Sprint' },
  referred: { days: 90,  label: 'Referred Candidate Recovery Programme' },
  annual:   { days: 548, label: '12-Module Programme' },
};
const TARGET_PLANS = new Set(Object.keys(PLAN_CONFIG));

// ── Token generation ──────────────────────────────────────────────────────────

function makeToken(email, plan, activatedAt, expires, sessionId) {
  const payload = Buffer.from(JSON.stringify({
    email, plan, activatedAt, expires,
    ...(sessionId ? { sessionId } : {})
  })).toString('base64');
  const sig = createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function stripeFetch(path) {
  const r = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` }
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${data.error?.message || path}`);
  return data;
}

async function getAllSessions() {
  const sessions = [];
  let startingAfter = null;
  while (true) {
    const qs = new URLSearchParams({ limit: '100', status: 'complete' });
    if (startingAfter) qs.set('starting_after', startingAfter);
    const page = await stripeFetch(`/v1/checkout/sessions?${qs}`);
    sessions.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return sessions;
}

// ── Email helpers ─────────────────────────────────────────────────────────────

function emailHtml(label, magicLink, expiryDate) {
  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="background:#0a0f1e;border-radius:12px 12px 0 0;padding:28px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0;font-family:Georgia,serif">Get Chartered <span style="color:#f59e0b">AI</span></h1>
    <p style="color:rgba(255,255,255,.5);font-size:11px;margin:6px 0 0;letter-spacing:.1em;text-transform:uppercase">${label}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="font-size:20px;color:#0f172a;margin-bottom:8px">Access your dashboard</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:24px">
      Click below to go straight to your Get Chartered AI dashboard — no password needed.
      Your access remains valid until <strong>${expiryDate}</strong>.
    </p>
    <a href="${magicLink}" style="display:block;background:#2563EB;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:16px">
      Open My Dashboard →
    </a>
    <p style="font-size:12px;color:#94a3b8;margin:0">
      Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>
    </p>
  </div>
</div>`.trim();
}

async function sendEmail(to, subject, html, text) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Get Chartered AI <info@getcharteredai.com>',
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`Resend ${r.status}: ${err.message || JSON.stringify(err)}`);
  }
  return r.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Re-issue HMAC tokens — ${DRY_RUN ? 'DRY RUN (no emails sent)' : '*** LIVE — emails will be sent ***'}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('Fetching Stripe checkout sessions...');
  const sessions = await getAllSessions();
  console.log(`  ${sessions.length} total complete sessions retrieved\n`);

  const now = Date.now();

  // Deduplicate: one re-issue per email per plan, using the most recent session.
  // A customer who paid twice would get one email with the newest purchase's expiry.
  const byKey = new Map(); // `${email}:${plan}` → candidate

  for (const s of sessions) {
    const planKey = s.metadata?.plan_key;
    if (!TARGET_PLANS.has(planKey)) continue;

    const email = (s.customer_details?.email || s.customer_email || '').toLowerCase().trim();
    if (!email) {
      console.warn(`  [NO EMAIL] session ${s.id} (${planKey}) — skipped`);
      continue;
    }

    const activatedAt = s.created * 1000; // Stripe timestamps are seconds
    const config = PLAN_CONFIG[planKey];
    const expires = activatedAt + config.days * 24 * 60 * 60 * 1000;

    if (expires <= now) continue; // token already expired — not active

    const key = `${email}:${planKey}`;
    const existing = byKey.get(key);
    if (!existing || activatedAt > existing.activatedAt) {
      byKey.set(key, { email, plan: planKey, activatedAt, expires, sessionId: s.id, config });
    }
  }

  // Also log which expired sessions were skipped
  const expiredCount = sessions.filter(s => {
    const planKey = s.metadata?.plan_key;
    if (!TARGET_PLANS.has(planKey)) return false;
    const activatedAt = s.created * 1000;
    const config = PLAN_CONFIG[planKey];
    return activatedAt + config.days * 24 * 60 * 60 * 1000 <= now;
  }).length;

  console.log(`Active customers to re-issue: ${byKey.size}`);
  if (expiredCount) console.log(`Expired sessions skipped:     ${expiredCount}`);
  console.log('');

  if (byKey.size === 0) {
    console.log('Nothing to do.');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const { email, plan, activatedAt, expires, sessionId, config } of byKey.values()) {
    const expiryDate = new Date(expires).toISOString().slice(0, 10);
    const token = makeToken(email, plan, activatedAt, expires, sessionId);
    const magicLink = `${BASE_URL}?token=${encodeURIComponent(token)}`;
    const subject = `Your ${config.label} — access link`;

    console.log(`  ${email}`);
    console.log(`    plan:    ${plan}`);
    console.log(`    expires: ${expiryDate}`);
    console.log(`    session: ${sessionId}`);

    if (DRY_RUN) {
      console.log(`    link:    ${magicLink.slice(0, 80)}...`);
      console.log(`    → DRY RUN — no email sent\n`);
      continue;
    }

    try {
      await sendEmail(
        email,
        subject,
        emailHtml(config.label, magicLink, expiryDate),
        `Access your Get Chartered AI dashboard:\n${magicLink}\n\nAccess valid until ${expiryDate}.\nQuestions? info@getcharteredai.com`
      );
      console.log(`    → Sent ✓\n`);
      sent++;
    } catch (err) {
      console.error(`    → FAILED: ${err.message}\n`);
      failed++;
    }

    // 300 ms gap — stays comfortably within Resend rate limits
    await new Promise(res => setTimeout(res, 300));
  }

  console.log(`${'='.repeat(60)}`);
  if (DRY_RUN) {
    console.log(`Dry run complete. ${byKey.size} customer(s) would receive emails.`);
    console.log(`Re-run with DRY_RUN=false to send live.`);
  } else {
    console.log(`Done. Sent: ${sent}  Failed: ${failed}`);
  }
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
