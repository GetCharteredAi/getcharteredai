# Get Chartered AI — Deployment Guide
# =====================================
# Complete setup from zero to live in under 30 minutes

## WHAT YOU HAVE
- public/index.html         — Full platform (landing + member area)
- public/success.html       — Post-payment account activation
- public/cancel.html        — Payment cancelled page
- netlify/functions/stripe-webhook.js  — Receives Stripe payment events
- netlify/functions/verify-session.js  — Verifies payment & issues access token
- netlify/functions/login.js           — Validates member login tokens
- netlify.toml              — Netlify configuration
- package.json              — Dependencies

## STEP 1 — Push to GitHub
1. Create a new GitHub repository (e.g. getcharteredai-platform)
2. Upload all these files keeping the folder structure exactly as-is
3. Make sure netlify/functions/ and public/ folders are at the root

## STEP 2 — Connect to Netlify
1. Go to app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repo
4. Build settings will auto-detect from netlify.toml
5. Click Deploy

## STEP 3 — Set Environment Variables
In Netlify: Site Settings → Environment Variables → Add variable

Add these FOUR variables:

  STRIPE_SECRET_KEY     = sk_test_YOUR_SECRET_KEY_HERE
  STRIPE_WEBHOOK_SECRET = whsec_YOUR_WEBHOOK_SECRET_HERE  (get this in Step 4)
  JWT_SECRET            = gca-secure-platform-2025-apc
  RESEND_API_KEY        = re_YOUR_RESEND_KEY_HERE  (get this in Step 4b below)

## STEP 4 — Set Up Stripe Webhook
1. Go to dashboard.stripe.com → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: https://getcharteredai.netlify.app/.netlify/functions/stripe-webhook
4. Select event: checkout.session.completed
5. Click Add endpoint
6. Copy the "Signing secret" (starts with whsec_)
7. Paste it as STRIPE_WEBHOOK_SECRET in Netlify (Step 3)

## STEP 4b — Set Up Welcome Emails (free)

Welcome emails are sent via Resend — free for up to 3,000 emails/month.

1. Go to resend.com and create a free account
2. Click API Keys → Create API Key
3. Copy the key (starts with re_...)
4. Add it to Netlify as RESEND_API_KEY
5. In Resend, go to Domains → Add Domain → add getcharteredai.com
6. Follow their DNS instructions (5 minutes, just adding records in your domain settings)

Without this step the platform still works — emails just won't send until it's configured.

## STEP 5 — Redeploy
After adding all environment variables:
Netlify → Deploys → Trigger deploy → Deploy site

## STEP 6 — Test the Full Flow
Use Stripe test card: 4242 4242 4242 4242 | Any future date | Any CVC

1. Go to https://getcharteredai.netlify.app
2. Click "Enrol Now" → choose a plan
3. Complete payment with test card
4. You'll land on /success.html
5. Enter your email and set a password
6. You'll be redirected to the dashboard
7. All 12 modules will be accessible
8. Progress saves automatically

## STEP 7 — Go Live
When ready to take real payments:
1. In Netlify env vars, change STRIPE_SECRET_KEY to your sk_live_... key
2. In index.html, change the STRIPE_KEY variable to your pk_live_... key
3. Add a new Stripe webhook for live mode pointing to the same URL
4. Update STRIPE_WEBHOOK_SECRET with the live webhook secret

## SUPPORT
Email: contact@gcaitutor.com
Stripe dashboard: dashboard.stripe.com
Netlify dashboard: app.netlify.com
