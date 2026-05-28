# Get Chartered AI — Deployment Guide

Complete setup from zero to live. Deploy from GitHub only — no local build step.

## Repository layout

```
getcharteredai/
├── netlify.toml
├── package.json          # validate/smoke scripts only (functions use native fetch)
├── package-lock.json
├── SETUP.md
├── netlify/functions/    # 14 serverless handlers
└── public/               # 33 HTML pages + 7 PDFs
```

**Runtime:** Node 18 on Netlify (`NODE_VERSION` in `netlify.toml`). Not Bun or Deno.

**Build:** Leave build command empty. Base directory: repo root (empty in UI, or `base = "."` in `netlify.toml`). Publish directory: `public`. Functions: `netlify/functions`.

**Do not** set Netlify UI **Base directory** to `public` while `publish` is also `public` — that resolves to `public/public` and the deploy fails.

---

## Public pages (`public/`)

| Page | Purpose |
|------|---------|
| `index.html` | Landing + member dashboard (12 modules, AI tutor) |
| `success.html` | Post-payment activation |
| `cancel.html` | Payment cancelled |
| `sprint.html` / `sprint-success.html` | APC Sprint checkout flow |
| `admin-sprint.html` | Sprint admin token generator |
| `referred-programme.html` | APC Confidence Reset |
| `guides.html` | Free guides hub |
| `free-guide.html`, `apc-guide.html`, `hot-topics.html` | Lead magnets |
| `competency-checker.html` | Competency tool + AI |
| `employer.html`, `employer-guide.html` | Employer flows |
| `assocrics-guide.html`, `confidence-checklist.html`, `counsellor-guide.html` | Guides |
| `referred-guide.html`, `why-candidates-are-referred.html`, `which-programme.html` | Referred programme |
| `grad-guide*.html`, `grad-bs-guide.html`, `grad-qs-guide.html`, `grad-interview-guide.html`, `grad-assessment-guide.html` | Graduate guides |
| `apprentice-guide.html`, `apprentice-guide-info.html` | Apprentice guides |
| `privacy.html`, `terms.html` | Legal |

**PDFs:** `apc-guide.pdf`, `assessors-briefing.pdf`, `confidence-checklist.pdf`, `counsellor-guide.pdf`, `employer-guide.pdf`, `referred-guide.pdf`

HTML pages use `.html` paths in production (`pretty_urls = false` in `netlify.toml`). `/dashboard` redirects to `/index.html?view=dashboard` (member dashboard is embedded in `index.html`).

---

## Netlify functions (`netlify/functions/`)

| Function | Purpose | Env vars |
|----------|---------|----------|
| `create-checkout.js` | Stripe Checkout session | `STRIPE_SECRET_KEY` |
| `verify-session.js` | Verify payment, issue access token | `STRIPE_SECRET_KEY`, `JWT_SECRET` |
| `verify-sprint-session.js` | Sprint payment verify | `STRIPE_SECRET_KEY`, `JWT_SECRET` |
| `login.js` | Validate 2-part member tokens | `JWT_SECRET` |
| `stripe-webhook.js` | Subscription lifecycle emails | `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` |
| `send-welcome.js` | Welcome email | `RESEND_API_KEY` |
| `send-reset.js` | Password reset magic link | `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `JWT_SECRET` |
| `ai-tutor.js` | Anthropic API proxy | `ANTHROPIC_API_KEY` |
| `capture-lead.js` | APC guide leads | `RESEND_API_KEY` |
| `capture-grad-lead.js` | Graduate/apprentice leads | `RESEND_API_KEY` |
| `employer-followup.js` | Employer enquiry emails | `RESEND_API_KEY` |
| `generate-sprint-token.js` | Admin sprint access tokens | `SPRINT_ADMIN_KEY`, `JWT_SECRET`, `RESEND_API_KEY` |
| `get-plan.js` | Plan lookup by session ID | `STRIPE_SECRET_KEY` |
| `nurture-sequence.js` | Nurture emails (optional scheduled) | `RESEND_API_KEY` |

---

## Member tokens

- Activations use a 2-part custom token (base64 payload + signature), stored in `localStorage` as `gca_token`.
- Use the same `JWT_SECRET` across deploys so tokens remain valid.
- Live functions include fallbacks for `JWT_SECRET` / `SPRINT_ADMIN_KEY` when env vars are unset — set explicit values in Netlify for production (see `.env.example`).

---

## STEP 1 — Push to GitHub

1. Push the repo with `public/` and `netlify/functions/` at the repository root.
2. Do not commit `.env`, `node_modules/`, or `.netlify/`.

---

## STEP 2 — Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Add new site → Import from GitHub
3. Build settings auto-detect from `netlify.toml` (`base = "."`, `publish = "public"`)
4. In **Site configuration → Build & deploy → Build settings**, leave **Base directory** empty (repo root). If it was set to `public`, clear it — `netlify.toml` overrides it, but an empty UI value avoids confusion.
5. Deploy

---

## STEP 3 — Environment variables

In Netlify: **Site settings → Environment variables**

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook HMAC verification |
| `JWT_SECRET` | Yes | Member & sprint tokens |
| `RESEND_API_KEY` | Yes* | Transactional email |
| `ANTHROPIC_API_KEY` | Yes* | AI tutor & mock simulator |
| `SPRINT_ADMIN_KEY` | Yes (admin tool) | Required for `/admin-sprint`; must match password entered at gate |

\*Platform runs without `RESEND_API_KEY` / `ANTHROPIC_API_KEY`, but email/AI features will not work.

Use strong random values for `JWT_SECRET` and `SPRINT_ADMIN_KEY` (see `.env.example`). No defaults in server code.

**Lead nurture:** Day 3/10 follow-ups are manual — see [OPERATIONS.md](OPERATIONS.md).

---

## STEP 4 — Stripe webhook

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook` (or custom domain)
3. Subscribe to these events (required by `stripe-webhook.js`):
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. Copy the signing secret (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` in Netlify
5. Repeat for **live mode** when going to production

---

## STEP 4b — Resend (email)

1. [resend.com](https://resend.com) → API key → `RESEND_API_KEY`
2. Add and verify domain `getcharteredai.com`

---

## STEP 4c — Anthropic (AI)

1. [console.anthropic.com](https://console.anthropic.com) → API key → `ANTHROPIC_API_KEY`

---

## STEP 5 — Redeploy

After env vars: **Deploys → Trigger deploy → Deploy site**

---

## STEP 6 — Test

Full checklist: [SMOKE_TEST.md](SMOKE_TEST.md)

```bash
npm run validate
```

Stripe test card: `4242 4242 4242 4242` | any future expiry | any CVC

For preview/testing, set `STRIPE_KEY` in `public/index.html` to `pk_test_...` to match `sk_test_...` in Netlify.

1. Homepage → Enrol → pay
2. `/success` → email + password → dashboard
3. `/guides`, `/sprint`, `/competency-checker`
4. `/admin-sprint` (password = `SPRINT_ADMIN_KEY` from Netlify)

---

## STEP 7 — Go live

1. Set live `STRIPE_SECRET_KEY` and live webhook secret in Netlify
2. Set `STRIPE_KEY` in `public/index.html` to your live publishable key (`pk_live_...`) — must pair with `sk_live_...`
3. Webhook URL: `https://getcharteredai.com/.netlify/functions/stripe-webhook` (or your custom domain)
4. Run [SMOKE_TEST.md](SMOKE_TEST.md) production section; optional small real charge to confirm webhook

---

## Support

- Email: info@getcharteredai.com
- Stripe: [dashboard.stripe.com](https://dashboard.stripe.com)
- Netlify: [app.netlify.com](https://app.netlify.com)
