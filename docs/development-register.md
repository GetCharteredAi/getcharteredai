# Development Register

Outstanding items logged for future resolution. Each entry records what is known, what was deferred and why.

---

## Open items

### DR-001 — Employer Guide mobile navigation overflow
**Logged:** 2026-11-16
**Severity:** Low — cosmetic, does not block content access
**Description:** `public/employer-guide.html` overflows horizontally on viewports ≤ 390px. The `.nav-right` element (5 navigation links + CTA button) has no mobile collapse or hide breakpoint. `body.scrollWidth` measures 671px at 390px viewport.
**Pre-existing:** Yes. The overflow also exists on `main` (510px) prior to this branch. The branch worsened it slightly through content reflow.
**Root cause:** `.nav-right { display:flex; gap:8px }` with no `@media` rule to collapse the nav links on mobile.
**Fix required:** Add a `@media(max-width:760px)` rule to hide `.nav-links` / collapse `.nav-right` to logo + CTA only, matching the pattern used on `employer-professional-readiness.html`.
**Blocked by:** Employer Guide is an approved page — no amendments without explicit authorisation.

---

### DR-002 — End-to-end recurring Professional Readiness review cycle testing
**Logged:** 2026-11-16
**Severity:** Medium — functionality untested in live environment before deployment
**Description:** The recurring progress cycle (Phase 4) in `p1-scheduled.js` — which re-opens a new Progress Reflection or Professional Readiness Review for sessions with `status=progress-complete` when their `progressReviewDate` arrives — has not been tested end-to-end in production. Unit tests (15/15 passing) cover guard logic, optimistic locking and token validation. Full integration tests exist in `scripts/stage*.mjs` but target production API and require real session tokens.
**Deployment status:** The recurring cycle function changes are held on `feature/early-career-professional-readiness` and NOT included in the current deployment. Only the marketing pages (commit `08207d8`) have been deployed.
**Risk basis for isolation:** `progressReviewDate` is set by `p1-confirm-progress-priorities.js` which is live on `main`. Any production session that has reached `progress-complete` already carries this field. Deploying the new cron block without prior verification could trigger unintended cycle emails to existing customers on the next daily run.
**What is needed before merging the function changes:**
1. KV store query to identify sessions currently at `status=progress-complete` with `progressReviewDate` set.
2. Confirm whether any such sessions have a `progressReviewDate` that has already passed (or is imminent).
3. If sessions exist: run end-to-end cycle test on a known test session, confirm email dispatch, session state transition and cycle history archiving before live rollout.
4. Consider a controlled rollout option: deploy with the cron block gated by a feature flag or run a manual first cycle on a designated test session.
**Related tests:** `scripts/test-recurring-cycle-guards.mjs` (unit), `scripts/stage*.mjs` (integration, production API).
