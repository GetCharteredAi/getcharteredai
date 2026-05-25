# Smoke test checklist

Run before merging to `main` or after changing payment, auth, or routing.

## Automated (local or CI)

```bash
npm run validate
```

Expect `LINK_CHECK: PASS` and `FUNCTION_CHECK: PASS`.

## Deploy Preview (manual)

Use Stripe **test** mode: set `pk_test_...` in `public/index.html` (`STRIPE_KEY`) and `sk_test_...` as `STRIPE_SECRET_KEY` on the preview site. Test card: `4242 4242 4242 4242`.

| # | Flow | Pass criteria |
|---|------|----------------|
| 1 | `/` → Enrol → pay | Stripe Checkout opens and completes |
| 2 | `/success` | Token issued; password set; dashboard loads |
| 3 | Dashboard | At least one module opens; AI tutor responds (if `ANTHROPIC_API_KEY` set) |
| 4 | `/guides` | Lead form submits; guide email received |
| 5 | `/sprint` → pay → `/sprint-success` | Sprint token in localStorage; welcome email received |
| 6 | `/competency-checker` | Lead capture works |
| 7 | `/admin-sprint` | Gate accepts `SPRINT_ADMIN_KEY` from Netlify env; magic link generated |
| 8 | Stripe webhook | Dashboard shows successful delivery to `/.netlify/functions/stripe-webhook` for a test subscription event |

## Production go-live

1. `STRIPE_KEY` in `public/index.html` is `pk_live_...`
2. Netlify `STRIPE_SECRET_KEY` is `sk_live_...`
3. Live webhook URL and `STRIPE_WEBHOOK_SECRET` configured
4. `JWT_SECRET` and `SPRINT_ADMIN_KEY` are strong, unique values (not placeholders)
5. Repeat flows 1–2 with a small real charge if needed

See [SETUP.md](SETUP.md) for full deployment steps.
