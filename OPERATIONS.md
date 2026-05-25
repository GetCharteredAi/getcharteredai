# Operations — lead nurture & admin

## APC guide leads (Day 3 / Day 10 follow-up)

`capture-lead.js` sends the candidate their guide immediately. It also emails **info@getcharteredai.com** with pre-written follow-up copy for **Day 3** and **Day 10**.

**This is manual.** Nothing schedules those emails automatically.

### SOP

1. When a lead notification arrives, note the recommended product (Sprint vs Full Programme) in the subject/body.
2. On the **Day 3** date shown in the email, send the “Day 3” block to the lead (copy/paste from the admin email, or reply with light edits).
3. On the **Day 10** date, send the “Day 10” block the same way.
4. Log outreach in your CRM if you use one.

### Optional automation (not enabled)

`nurture-sequence.js` can send sequence emails via HTTP POST (`emailIndex` 1–3), but nothing calls it today. To automate later you would need:

- A lead store (e.g. MongoDB or Resend audiences), and
- Netlify scheduled/background invocations, or
- An external cron hitting `/.netlify/functions/nurture-sequence`

Until then, treat nurture as an ops task, not a platform feature.

## Sprint admin (`/admin-sprint`)

1. Set `SPRINT_ADMIN_KEY` in Netlify (required; no code default).
2. Open `/admin-sprint`, enter that value at the gate (not stored in the repo).
3. Use after confirming Stripe payment for manual activations.

Self-serve sprint checkout sends the welcome email from `verify-sprint-session.js` — no admin key required.

## Stripe key alignment

| Environment | `public/index.html` `STRIPE_KEY` | Netlify `STRIPE_SECRET_KEY` |
|-------------|----------------------------------|-----------------------------|
| Test / preview | `pk_test_...` | `sk_test_...` |
| Production | `pk_live_...` | `sk_live_...` |

Mismatch causes checkout or verification failures.
