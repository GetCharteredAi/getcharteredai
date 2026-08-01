# Get Chartered AI — Build Log & Project Status

*Last updated: 1 August 2026 (programme-finder-sec card bullets, Referred Continue card fix, terms.html legal corrections)*

---

## 1 August 2026 — programme-finder-sec bullets, Referred dashboard fix, terms.html legal corrections (431e8d1 → 8164893)

Three separate changes pushed to main in this session. First two are copy/UX; the third is a significant legal/compliance correction.

### programme-finder-sec — card bullets replaced with programme-specific facts (431e8d1)

The second bullet on all four `programme-finder-sec` cards on `index.html` previously read "5,000+ practice questions and answers" — a generic claim repeated identically across all four cards, providing no differentiation. Replaced with facts specific to each programme:

| Card | Old bullet | New bullet |
|---|---|---|
| APC Year Two Readiness Review | "One-off diagnostic assessment" (restated the format already implied by the card) | "5 assessment areas covered" |
| APC Full 12 Module Programme | "5,000+ practice questions and answers" | "18 months access" |
| Sprint Programme | "5,000+ practice questions and answers" | "Non-sequential — start anywhere" |
| Referred Candidate Recovery | "5,000+ practice questions and answers" | "Includes your pathway module" |

Each replacement was verified against known-accurate product facts before applying.

### Referred dashboard — Continue card showing wrong module for fresh candidates (b634685)

**Root cause:** `getLastInProgressModule()` filtered `MODULES` to all unlocked entries, then returned `inProgress[0]`. For `plan === 'referred'`, `isModuleUnlocked()` returns `true` for both `modId === 12` (Module 12 — unlocked so Referred candidates can access the mock interview) and `modId >= 13 && modId <= 36` (CR modules). Since MODULES is ordered by id, Module 12 (id=12) precedes CR01 (id=13) in the array, so `inProgress[0]` returned Module 12 for any Referred candidate who had not yet set `gca_last_module` in localStorage.

**Effect:** Fresh Referred candidates saw "12: Revision, Mock Tests & APC Simulation" as their Continue card — the standard revision module for Annual/Monthly/Sprint candidates, not CR01.

**Fix:** `inProgress` filter now excludes `m.id === 12` when `plan === 'referred'`. The existing `firstRef` lookup in the caller already correctly points to CR01 (id=13). Three cases confirmed unaffected:
- Returning Referred candidate with `gca_last_module` set → resolves via `lastId` path before `inProgress` is evaluated ✓
- Referred candidate who explicitly visited Module 12 (`gca_last_module === 12`) → still resolves via `lastId` path ✓
- Annual/Monthly/Sprint → `plan !== 'referred'` guard never fires ✓

Bug only affected first dashboard load for Referred candidates before any module was opened. Real-browser verification on the live site delegated to Ange.

### terms.html — legal corrections (8164893)

**Background:** A factual audit of the checkout flow against the terms document found that Section 5.1 was asserting a consent/waiver mechanic that does not exist in the code. The checkout flow on every product page is: button click → `fetch('/.netlify/functions/create-checkout')` → `window.location.href = data.url` — a direct redirect to Stripe with no interstitial, no checkbox, no acknowledgment step. This is the same category of problem as the "magic login link" found earlier: a document asserting a process that isn't technically implemented.

**Section 5.1 — removed false cancellation-waiver claim:**
- Old: "No refund policy — digital product with immediate access... By completing a purchase you acknowledge that... the right to cancel under the Consumer Contracts Regulations 2013 does not apply because digital content delivery begins immediately with your agreement."
- New: Accurate statement of the statutory 14-day cancellation right under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013. Explicit statement that statutory rights for faulty/misdescribed digital content are unaffected.
- The previous wording was asserting that a waiver had been obtained (via a consent step) that never actually occurs in the checkout flow.

**Section 5.3 — access period clause updated:**
- Old: "APC Sprint is a one-off payment for 49 days access. No refunds are issued once access has been granted. If you do not pass your APC assessment, your Sprint payment of £297 will be credited in full against the Full Year Access programme..."
- New: General clause covering all one-off programmes (Annual, Sprint, Referred, Year Two, Case Study add-on), pointing to access periods stated on the relevant product page.
- The Sprint-to-Annual credit policy (£297 credited, pay £200 difference) was verified to be clearly and accurately stated in two places on `sprint.html` — a promo bar and a dedicated FAQ answer ("What if I don't pass my APC?") — before being removed from the formal terms. It remains customer-facing and accurate.
- The old clause also referenced "49 days access" for Sprint; the 42-day / 49-day day-count framing had already been removed from Sprint's product page copy earlier this session to avoid implying a hard deadline.

**Section 8.3 — liability cap tightened:**
- Old: "shall not exceed the amount you have paid us in the 12 months preceding the claim" — a rolling 12-month payment window unrelated to the specific product purchased.
- New: Capped to the amount paid for the specific product or service giving rise to the claim, with a 12-month claim window running from original purchase date (not a trailing payment window).
- Confirmed no cross-contamination with the Annual plan's 18-month access period — both numbers appear in the document and refer to different things (liability claim window vs. product access duration).

---

## 30 July 2026 — Landing page audit, employer accuracy fixes, platform restructure (b9e94f6 → 7540416)

A full-session audit pass covering the landing page, platform overview, and employer-facing pages. Multiple instances of stale counts, fabricated product claims, and day-count framing were found and fixed. No new features built — all changes are accuracy corrections or copy restructures.

### False commercial claims removed

Three separate false claims on live pages, removed across this session:

1. **`pricing.html` — "unlimited candidates" (b9e94f6):** The `employer-banner` section (introduced 24 Jun 2026, commit c01bf74) claimed "£497 for 18 months — all programmes, all pathways, unlimited candidates." No such employer/bulk product exists. Entire section removed. Confirmed "unlimited candidates" appeared nowhere else on the site.

2. **`employer-guide.html` — "magic login link" (798ddf7):** Step 03 of the Getting Started sequence claimed "Each candidate receives a magic login link. Full access from day one. No setup from them." No magic link mechanism exists — candidates complete Stripe checkout individually and set their own email/password on `success.html`. Replaced with accurate description.

3. **`employer-guide.html` — "tailored pricing proposal" + "invoice issued" + fabricated testimonial (798ddf7, 002a156):** Step 01 implied custom pricing negotiation ("tailored pricing proposal within one working day"), contradicting the page's own "Standard pricing — no minimums" heading. Step 02 said "invoice issued" — no invoicing system exists; confirmed not offered. A testimonial attributed to "MRICS Counsellor — National surveying practice" was not from a real named person with permission to be cited. All three removed.

### employer-guide.html — additional improvements (fc5f5f1 → bf2fe44)

- Pricing section heading: "Standard pricing — no minimums, no negotiations." → "Standard pricing — no minimums." (removed combative framing)
- Added fourth pricing card: APC Year Two Readiness Review (£127), with sub-line "one-off · 'Am I on track?' diagnostic with a report to act on afterward"
- Pricing grid: changed from `repeat(3,1fr)` at `max-width:920px` to `repeat(4,1fr)` at `max-width:1200px` — all four cards in one row at ~288px each

### platform.html — Referred section restructure (5863f63)

- Removed 6 stale CR card placeholders from the main M01–M12 module grid
- Added a styled access note callout below the Referred section heading
- Added 9-card CR01–CR09 grid in the standalone Referred section
- Stripped £ pricing from Sprint and Year Two CTAs
- CR module cards trimmed to title-only (mod-desc removed from all 9 cards) — 2169321
- Referred section CTA upgraded from small inline pill to full-width solid red block at 18px/800-weight — 2169321

### referred-programme.html + platform.html — title and FAQ accuracy (0936581)

- CR01 title corrected to "Understanding Your Referral Properly" (was "Understand Your Referral") on both pages
- CR09 title corrected to "Reflection, Self-Awareness and Resit Mindset" (was "Reflection, Resit Mindset and Practical Next Steps") on both pages
- Two FAQ answers on referred-programme.html updated: Module 2→CR03, Module 4→CR06, Module 6→CR08
- which-programme.html: '30-day structured resit countdown' → 'Structured resit preparation plan'

Titles now match the in-app MODULES array exactly (canonical source of truth). CR07 has no static MODULES entry — dynamically inserted at runtime.

### index.html — landing page audit (189f4a8 → 7540416)

**`whats-included-sec` — two-box grid replaced with four title-only boxes (189f4a8):**
The "Been referred?" / "Moving into Year Two?" boxes (with full paragraphs including a stale "six specialist modules" count) were replaced with four compact title-only boxes in a `repeat(4,1fr)` grid: APC Full 12 Module Programme / Sprint Programme / Referred Recovery / Year Two Readiness Review. No body text, no links — orange `#f59e0b` titles only.

**`programme-finder-sec` — five stale facts corrected (189f4a8):**
The "Choose your programme / Find the right path for your APC" section (four clickable cards with expandable detail panels) was confirmed as a genuinely separate section from the boxes above. Structure kept as-is; five specific corrections applied:
- Sprint sub-heading: "Intensive 42-day focus..." → "Intensive, self-paced focus..."
- Sprint bullet: "42-day focused programme" → "Focused, self-paced programme"
- Referred sub-heading: "Targeted 90-day recovery..." → "Targeted recovery..."
- Referred bullet: "6 targeted modules" → "9 targeted modules" (real count correction)
- Referred bullet: "90-day programme" → "Structured recovery programme"
- Year Two bullet: "One-off assessment · £127" → "One-off diagnostic assessment" (price removed)

**"When you enrol" paragraph rewrite (7540416):**
The fragmented sentence-list paragraph ("When you enrol on Get Chartered AI you get immediate access to...") was replaced with three full sentences covering: (1) the complete programme scope for all candidates, (2) the Referred Recovery programme with nine specialist modules, (3) the Year Two Readiness Review. The stale "six specialist modules" reference in the old paragraph is gone. Word-reveal animation class and styles preserved.

---

## 30 July 2026 — Referred programme marketing page audit and restructure (5863f63 → this commit)

A comprehensive audit found that both `platform.html` and `referred-programme.html` were showing stale, fictional module content that bore no resemblance to the actual in-app CR module structure. Two separate commits fix the full set of issues.

### platform.html — Referred section restructure (5863f63)

**Problem:** The main module grid contained a `referred-divider` and 6 stale CR card placeholders with fictional titles. The standalone Referred section also lacked module cards. Sprint and Year Two CTAs included £ prices.

**Changes:**
- Removed the 6 stale CR card placeholders (and the `referred-divider`) from the main M01–M12 module grid — that grid now contains exactly Module 01 to Module 12.
- Added a styled access note callout below the Referred section heading explaining CR modules are only accessible with a Confidence Reset subscription.
- Added a 9-card CR01–CR09 module grid inside the standalone Referred section using the existing `.mod-grid` CSS class.
- Stripped £ pricing from Sprint and Year Two CTAs (Sprint: "See the APC Sprint Programme →"; Year Two: "See the Year Two Readiness Review →"). Pricing is on the destination pages; it does not belong on this overview page.

### referred-programme.html — Module grid fix (5863f63)

**Problem:** The marketing page's module grid showed 6 stale cards using fictional "Module 01"–"Module 06" labels and pre-build placeholder titles with no resemblance to actual content.

**Changes:**
- Replaced all 6 stale cards with 9 accurate CR01–CR09 cards.
- Module numbers styled `color:#64748b` (consistent with the existing card design system).
- HTML comment updated to `<!-- NINE MODULES`.

### Title and FAQ consistency pass (this commit)

**Problem:** Marketing page titles for CR01 and CR09 had drifted from the actual in-app MODULES array wording (ground truth). Three FAQ answers still referenced old "Module 2 / Module 4 / Module 6" numbering from the pre-restructure 6-module layout. `which-programme.html` retained `'30-day structured resit countdown'`, contradicting the deliberate decision to strip deadline-pressure framing from Referred copy.

**Changes — both `platform.html` and `referred-programme.html`:**

| Module | Before | After |
|---|---|---|
| CR01 | Understand Your Referral | Understanding Your Referral Properly |
| CR09 | Reflection, Resit Mindset and Practical Next Steps | Reflection, Self-Awareness and Resit Mindset |

Titles now match the in-app MODULES array exactly. The in-app array is canonical — marketing pages follow it, not the other way around.

**Changes — `referred-programme.html` FAQ:**
- "the Level 2 framework in Module 2 and the mandatory competency reconstruction in Module 4" → "the competency-level framework in CR03 and the competency evidence rebuilding in CR06"
- "The AI-scored mock interview in Module 6" → "The AI-scored mock interview in CR08"

**Changes — `which-programme.html`:**
- Feature bullet: `'30-day structured resit countdown'` → `'Structured resit preparation plan'`

**Ground truth confirmed:** CR module titles verified directly against the `MODULES` array in `public/index.html`. CR07 has no static entry — it is dynamically inserted at runtime as `{id:_m11bId, code:'CR07', label:'Your pathway module'}` (the user's own M11B pathway module).

---

## 29 July 2026 — Logo rollout (all 33 pages) + platform.html Sprint/Year Two additions (4a8717f → 9c3f01a)

### Logo rollout — all 33 pages

**Problem:** `logo.png` had a 1600×400 canvas with visible content occupying only 364×84px (22.8%). At 30px height the mark rendered at ~6px — effectively a tiny dot. New file `logo1.png` (1986×373, white wordmark, minimal 24px padding each side, white text on transparent background) was introduced. All 33 pages updated to 44px height, redundant `nav-logo-stack` text spans removed (the wordmark is now inside the image itself).

**Two-logo strategy** (white nav pages can't use white-text logo1.png):

| Variant | File | Used on | Background |
|---|---|---|---|
| White wordmark | `logo1.png` | 24 dark-nav pages | `background:#0D0F1C` / `rgba(11,12,28,.97)` |
| Dark navy wordmark + blue icon | `logo.png` | 9 light-nav/body pages | `nav{background:#fff}` or `body{background:#EFF6FF}` |

**24 dark-background pages (logo1.png) — commit 4a8717f:**
index.html, index-staging.html, pricing.html, platform.html, employer-guide.html, year-one-review.html, programme.html, apprentice-guide.html, assocrics-guide.html, competency-checker.html, confidence-checklist.html, counsellor-guide.html, free-guide.html, grad-guide-1.html, grad-guide-2.html, grad-guide-bs.html, grad-guide-qs.html, grad-guide.html, guides.html, hot-topics.html, privacy.html, referred-guide.html, referred-programme.html, sprint.html, terms.html

**9 light-background pages (logo.png) — commit 956ee39:**
employer.html, which-programme.html, why-candidates-are-referred.html (white nav `#fff`); apc-guide.html, apprentice-guide-info.html, grad-assessment-guide.html, grad-bs-guide.html, grad-interview-guide.html, grad-qs-guide.html (body `background:#EFF6FF`)

**CSS pattern applied everywhere:**
```css
.nav-logo img { height: 44px }
.footer-logo img { height: 44px; margin-bottom: 12px; display: block }
```

### platform.html — Sprint and Year Two Readiness Review sections added (9c3f01a)

Both programmes were entirely absent from `/platform` ("Inside the Platform"). Two new sections inserted between the Referred Candidate section and the Michael section:

**Sprint section:** amber-accented eyebrow, six numbered stage cards (dark subtle background matching page card style), closing note on non-linear access, CTA → `/sprint` (£297 one-off).

Stage cards:
1. Understand the Assessment
2. Build Chartered-Level Answers
3. Check Your Readiness
4. Strengthen Your Technical Knowledge
5. Revise Under Pressure
6. Prove You're Ready — Final Review

**Year Two Readiness Review section:** blue-accented eyebrow, two body paragraphs (problem framing + six-month referral delay stat), five ✓ bullet items covering all deliverables, CTA → `/year-one-review` (£127 one-off).

No existing sections were touched. Confirmed: 54 insertions, 0 deletions relative to prior file.

---

## 28–29 July 2026 — Think on Your Feet (bc8521b → ca280ab, merged to main)

### What it is

A 3-minute daily articulation practice mechanic. A question appears from the candidate's own pathway question bank without warning → 75-second fixed countdown timer → candidate speaks aloud (nothing recorded) → candidate types a recap of key points → Michael evaluates the recap and returns a structured 6-field JSON verdict → candidate can retry or reveal model answers.

Entry points added to all four plan dashboards:

| Plan | UI element | Position |
|------|------------|----------|
| Annual | `ds-btn` (quick-action row) | After Mock Interview |
| Monthly | `ds-btn` (quick-action row) | After Mock Interview (always unlocked — not gated like Mock Interview) |
| Sprint | `ds-btn` (quick-action row) | After Mock Interview — standalone tool, NOT a 7th S-stage (Sprint stages represent sequential module sections, TOFY is a standalone practice mechanic) |
| Referred | `db-card` in right column | Third card stacked below Mock Interview, matching existing `db-card` visual language |

Click handler: `openThinkOnYourFeet()` on all four — no arguments, defaults to `michael`/`pathway` from internal state.

### Architecture decisions

**Coach-agnostic from day one.** Michael's three identity strings extracted into a `PERSONAS` object in `ai-tutor.js`. All existing callers unaffected (default `persona='michael'`). Future coach = add entry to PERSONAS + new content source. `openThinkOnYourFeet(coachPersona, contentSource)` takes both as explicit parameters.

**Question bank reuse.** Extended the existing `get-questions.js` endpoint with a `random: true` parameter — returns one random question for the caller's pathway. 4 lines of new code, no new infrastructure, no new endpoint. All auth checks (JWT verify, revoked emails, pathway validation) run identically to the full question bank path.

**Structured JSON verdict.** New `source: 'articulation-verdict'` value in `buildModuleSystemPrompt()` returns a strict JSON-only prompt instructing Michael to respond with exactly 6 fields: `technical_accuracy`, `structure`, `level_reached` (integer 1/2/3), `level_label`, `priority_improvement`, `better_structure`, `follow_up_question`. No markdown, no prose, no fences. Client-side `JSON.parse()` validates this and renders into distinct verdict panels.

### Bugs found and fixed during build

**Bug 1 — `finalSystem` routing (ee37fae):** `buildModuleSystemPrompt()` was gated on `moduleId` being present. TOFY verdict calls have no `moduleId` (pathway questions have a `module` string, not a numeric module ID) — so the `articulation-verdict` branch never executed; Michael received the generic `'You are a helpful RICS APC tutor.'` fallback and responded in free-flowing prose with markdown headings. `JSON.parse()` then failed and the client showed "Could not connect."

Fix: one-line change to the routing condition:
```javascript
// Before
const finalSystem = moduleId
// After
const finalSystem = (moduleId || source === 'articulation-verdict')
```
This routes articulation-verdict calls through `buildModuleSystemPrompt()` even without `moduleId`. Inside the function, `getMichaelModuleBriefing(undefined)` returns the full default RICS briefing; `modTitle` (the competency area from the question data) fills in for `title`; the `articulation-verdict` branch at `if (source === 'articulation-verdict')` executes correctly.

**Bug 2 — `ANTHROPIC_API_KEY` not reaching branch deploy:** Diagnosed over two sessions. The key was not set in Netlify at all for the branch — it was later confirmed as a team-level variable on a different account scope. Resolution: key added explicitly to the site's environment variables with all three deploy contexts (Production, Deploy Previews, Branch deploys). Empty commit `9073252` triggered a fresh deploy to confirm. The "AI service not configured" 500 error disappeared once the key was correctly scoped.

### Files changed

- `netlify/functions/ai-tutor.js` — `PERSONAS` object; `buildModuleSystemPrompt()` signature updated with `persona` param and `articulation-verdict` branch; `finalSystem` routing condition fixed
- `netlify/functions/get-questions.js` — `random: true` param support
- `public/index.html` — overlay CSS + HTML; `openThinkOnYourFeet()`, `_tofyLoad()`, `_tofyShowQuestion()`, `_tofyStartRecap()`, `_tofySubmitRecap()`, `_tofyShowVerdict()`, `_tofyRevealAnswer()`, `closeTOFY()`; dashboard entry points for all four plans

---

## Platform Reference

- **Live site:** getcharteredai.com
- **Repo:** GetCharteredAi/getcharteredai
- **Local:** ~/Documents/getcharteredai
- **Stack:** Single-file platform (public/index.html, ~3,000+ lines), 14 Netlify Functions, Stripe, JWT auth (no database), Anthropic API (ai-tutor.js), Resend email
- **Design tokens:** Background #0D0F1C, Primary blue #2563EB, Nav bg rgba(11,12,28,0.97) blur(16px), Inter (body 300–700), Plus Jakarta Sans (headings 400–800)
- **Deployment:** GitHub push to `main` → Netlify auto-deploy. **Never rely on local commit alone — confirm push to origin/main AND a real Netlify deploy before marking anything "live."**

---

## M11B Pathway Build — Status

**Concept:** M11B is a pathway-specific bridge module (11 sections) sitting between M11 and M12 in the candidate journey, covering: intro, pathway structure/competency selection, health & safety, accounting, data sources, client care, business planning, conflict avoidance, sustainability, Michael AI guided practice, and a module assessment (10 questions). Each pathway also gets a matching `pathwayOnly`-gated Module 12 section (a realistic APC scenario in the 12.16/JCT format: bold question, italic tests/frequency line, "model answer" framing, 6 key elements, 3 "how to frame this" quotes, "three things assessors tick", closing kicker).

### Live and wired (16 of 16 in active scope — COMPLETE)

| Pathway | Module ID | Colour | M11B | M12 section |
|---|---|---|---|---|
| Rural | 20 | #16a34a | ✅ | ✅ |
| Taxation Allowances | 21 | #0891b2 | ✅ | ✅ |
| Building Surveying | 22 | #7c3aed | ✅ | ✅ |
| Quantity Surveying and Construction | 23 | #0e7490 | ✅ | ✅ |
| Commercial Real Estate | 24 | #b45309 | ✅ | ✅ |
| Valuation | 25 | #4f46e5 | ✅ | ✅ |
| Infrastructure | 26 | #ea580c | ✅ | ✅ |
| Residential | 27 | #db2777 | ✅ | ✅ |
| Project Management | 28 | #0369a1 | ✅ | ✅ (pre-existing 12.16 JCT, retrofitted with pathwayOnly) |
| Facilities Management | 29 | #dc2626 | ✅ | ✅ |
| Planning and Development | 30 | #4d7c0f | ✅ | ✅ |
| Property Finance and Investment | 31 | #0f766e | ✅ | ✅ |
| Corporate Real Estate | 32 | #92400e | ✅ | ✅ |
| Management Consultancy | 33 | #1e3a8a | ✅ | ✅ |
| Land and Resources | 34 | #a16207 | ✅ | ✅ |
| Building Control | 35 | #881337 | ✅ | ✅ |

### Remaining active queue

None — all 16 pathways in the active scope are complete.

### Deliberately deprioritised (6 — small candidate numbers; revisit once active queue is complete)

- Environmental Surveying
- Geomatics
- Minerals and Waste Management
- Personal Property/Arts and Antiques
- Research (no separate RICS pathway guide — competencies drawn from other pathways; may not need its own M11B)
- Valuation of Businesses and Intangible Assets

---

## Full 22-Pathway Reconciliation (confirmed 11 July 2026 against rics.org/join-rics/sector-pathways)

Building Control, Building Surveying, Commercial Real Estate, Corporate Real Estate, Environmental Surveying, Facility Management, Geomatics, Infrastructure, Land and Resources, Management Consultancy, Minerals and Waste Management, Personal Property/Arts and Antiques, Planning and Development, Project Management, Property Finance and Investment, Quantity Surveying and Construction, Research, Residential, Rural, Taxation Allowances, Valuation, Valuation of Businesses and Intangible Assets.

---

## Question Banks — Separate System from M11B

Question banks use a prefix/localStorage-key/element-ID system, entirely separate from M11B's numeric pathway IDs. As of 11 July 2026, 16 of 22 pathways have a working question bank (the 6 deprioritised pathways above are the ones without one, since Infrastructure's gap was fixed).

---

## 19 July 2026 — Sprint Programme Full Redesign (706f1e4 → 642db59)

### M11B + Referred wiring (835745c, 7919ac9)

M11B pathway modules unlocked for Sprint and Referred plans. Previously excluded by an explicit `if (plan === 'sprint' || plan === 'referred') return false` in all 16 M11B `isModuleUnlocked()` blocks. Removed the exclusion — `getUnlockedCount('sprint') = 12` and `getUnlockedCount('referred') = 18` both satisfy `>= 11`, so M11B now unlocks automatically. Sprint milestone strip and sidebar both updated to show S04 "Pathway Prep" node (M11B) between S03 and the Module 12 stages. Referred milestone strip updated to show CR06 "Your pathway module" (M11B) between CR05 and the renamed CR07 "Reflect & resit mindset". Referred programme module count heading corrected from six to seven. Sprint `dashMods` and Referred `dashMods` both include `_m11bId ? [MODULES.find(m.id === _m11bId)] : []` stub card.

### Module 1 Sprint redesign — S01/S02/S03 (706f1e4, aee804c, 8ef44e6)

Three sprint-specific sections added to Module 1, visible only to Sprint plan (`sprintOnly: true`):

- **S01 — Know the Format:** What the APC interview actually looks like (panel composition, session timing, questions ahead, submission vs interview split, what "Level 3" requires in a live response).
- **S02 — Competency Answers:** How to build Level 3 answers and defend the case study under pressure (PEEL-under-fire structure, follow-up question patterns, common Level 2 trap phrases).
- **S03 — Technical Knowledge Check:** Self-check checklist across all 11 mandatory competencies. Interactive — candidates tick off competencies they can answer at Level 3, with progress counted and saved to localStorage.

Hide list applied to Module 1 Sprint view: sections 1.2, 1.3a, 1.3b, 1.4, 1.5, 1.5a, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15 suppressed for Sprint users. Section 1.3 "What the APC Really Is" intentionally kept visible.

Pass rate stat in 1.1 corrected: the "UK first-time pass rate 65% in 2025" figure was the female candidate pass rate from the RICS Annual Review gender breakdown, not a UK-wide figure. Replaced with the verified global figure: ~59% consistent across 2023–2025.

Sprint-visible section order (6 of 24): 1.1 Welcome → Your Sprint Plan → S01 Know the Format → S02 Competency Answers → 1.3 What the APC Really Is → S03 Technical Knowledge Check.

### S01–S06 stage wiring (ef69878, 57a559b, 1c994fb, a729206)

All six Sprint stages wired in both the milestone strip and dashboard sidebar, with scroll-to-section targets:

| Stage | Target | Scroll anchor |
|---|---|---|
| S01 | Module 1 | `sec-1-2` (S01 section) |
| S02 | Module 1 | `sec-1-3` (S02 section) |
| S03 | Module 1 | `sec-1-5` (S03 section) |
| S04 | `openS04QuestionBank()` | n/a (question bank overlay) |
| S05 | Module 12 | `sec-12-0` (Sprint Start Here) |
| S06 | Module 12 | `sec-12-1` (60-Minute Mock) |

S04 "Pathway Prep" opens the question bank overlay as the primary experience (pathway → function dispatch lookup), not M11B directly. An inline banner below the topbar offers M11B as secondary access. Module 12 S05/S06 filtering: S05 hides sections 12.15+ (revision only); S06 shows only 12.0 + 12.15 + the user's pathway scenario.

Scroll targets use `setTimeout(80ms)` after `showView('module')` to fire after the view's `window.scrollTo(0,0)` resets the position. Scroll map keyed on stage CODE (S01–S06), not label text — safe through any label renaming.

### S06 label rename

"Final 48 Hours" → **"Final Review"** across all three locations (milestone strip, sidebar, and new grid). Same reasoning as the earlier Referred "Final 30 Days" rename: a fixed time label creates false anxiety for candidates who reach the stage earlier or later than the implied window. The S06 code and scroll map key are unaffected.

### 6-card Sprint grid (a3c0b24)

Sprint plan's `dashModGrid` replaced from 3 generic module cards to 6 stage-specific cards matching the sidebar exactly. Non-Sprint plans (Annual/Monthly/Referred) continue using the existing `dashMods.map()` path unchanged.

Each card shows: stage code badge, label, and a one-line description of what the stage covers:
- S01: "What the actual interview looks like, minute by minute."
- S02: "How to answer at Level 3, and defend your case study under pressure."
- S03: "A quick self-check across all 11 mandatory competencies."
- S04: "Test yourself against real pathway-specific questions."
- S05: "Revise every mandatory competency, then push yourself with real assignment questions."
- S06: "The 60-minute mock interview and your pathway's assessor scenario."

Card states: done (green border + ✅ when module marked complete), active★ (blue glow — suggested next step based on `_spActiveModId2` sequential progression), available (clickable, no special styling).

### Sprint card lock logic correction (642db59)

**Bug:** Initial grid implementation used `isComplete()` sequentially to compute lock state — S05/S06 went locked once Module 1 was complete but M11B wasn't done, even though `isModuleUnlocked(12, 'sprint') = true` unconditionally.

**Root cause:** `_spActiveModId2` sequential progression was being used as an *access gate* rather than a *suggested-next-step indicator*. `isModuleUnlocked()` for Sprint returns `true` for M01, M11B, and M12 unconditionally — Module 12 was never gated behind Module 1 completion in the original access logic.

**Fix:** Lock condition changed to `!isModuleUnlocked(n.modId, plan, activatedAt)`. For Sprint this is never true, so no Sprint card is ever locked. Active★ highlight is purely cosmetic guidance — it does not prevent clicking any card. A fresh-account Sprint user can click S05 or S06 immediately. Verified by simulation across all four account states (nothing complete, M01 done, M01+M11B done, all done) — S05 and S06 remain clickable in every case.

### Render-path bug audit — three separate fixes

The same three-render-path class of bug (found originally in CR5.4 on 13 July) appeared again across today's Sprint work:

**1. `_spScrollMap` ReferenceError (3ab94ae):** Variable declared with `const` inside the `else if (plan === 'sprint')` milestone strip block (lines ~3347–3402), but referenced in a separate `if (plan === 'sprint')` sidebar block at line ~3501. `const` block scoping made it invisible — crashing the entire Sprint dashboard render for all users. Fix: re-declared `_spScrollMap` at the top of the sidebar block.

**2. Module 1 Sprint hide list missing from MODULE PROGRESS panel (582c862):** The `pp.innerHTML` filter (MODULE PROGRESS right panel) was updated with the Sprint M01 hide list, matching the existing TOC sidebar and content area filters.

**3. Module 12 sprint stage filter missing from MODULE PROGRESS panel (2a11d5f):** `pp.innerHTML` applied the Module 1 hide list but not the Module 12 sprint stage filter. S05 showed all 17 sections instead of 15 (incorrectly including mock interview + pathway scenario); S06 showed all 17 instead of 3 (should show only 12.0 + 12.15 + user's pathway scenario). Also caused `scrollToSection` index misalignment since pp and content rendered different counts. Fix: added identical `if (plan === 'sprint' && id === 12 && window._sprintStage)` block to `pp.innerHTML`, matching TOC sidebar and content area. All three render paths now apply identical filters for both Module 1 and Module 12.

**Running count:** This is the third separate session (CR5.4 / 13 July; Module 12 M14 July audit; Sprint / 19 July) where the three-render-path pattern has produced a real bug. The standing rule from 13 July (grep `m\.sections` render paths before marking filtered content complete) applies equally to any sprint-stage or plan-conditional filter.

---

## 25 July 2026 — Site-wide copy audit: module counts, pricing fix, token expiry, day-count removal (f261107)

### Module count corrections — Referred programme (six/seven → nine)

All references to the Referred programme's module count updated from "six" or "seven" to "nine" across every page that mentioned a specific count: `referred-programme.html` (4 locations), `pricing.html`, `employer-guide.html` (2), `employer.html`, `platform.html`, `which-programme.html`, `index.html`. The Referred programme is nine modules (CR01–CR09), with CR07 being the pathway-specific M11B module inserted dynamically between CR06 and CR08.

### Pricing error fix — employer.html

`employer.html` was displaying the Referred Candidate Recovery Programme at **£297** instead of the correct **£397** — a £100 understatement on an employer-facing page. Fixed to £397.

### Sprint token expiry — align paying customers to 49 days

Two separate code paths handle Sprint token issuance:

- **`verify-sprint-session.js`** — called from `sprint-success.html` after Stripe checkout. Was issuing 42-day tokens.
- **`generate-sprint-token.js`** — admin-only, called manually with an admin key. Already issued 49-day tokens (explicitly labelled "6 weeks + 1 week buffer").

Paying customers were receiving 42 days while admin-issued tokens gave 49 days. Decision: align up — paying customers now also get 49 days.

**Changes made:**
- `verify-sprint-session.js`: L41 `42 * 24 * 60 * 60 * 1000` → `49 * 24 * 60 * 60 * 1000`; L2 comment updated to match
- `generate-sprint-token.js`: plain-text email body updated from "42 days" to "49 days" (HTML body was already correct at 49)
- `terms.html`: "a one-off payment for 42 days access" → "49 days access" (contractual reference updated to match)

`verify-session.js` (handles all other plans including Referred at 90 days) is untouched.

### Day-count removal from pricing/payment contexts

Decision: specific day counts attached directly to a price or in a payment note imply a hard deadline at the point of sale — the opposite of what both programmes are trying to convey. Day counts stripped from all pricing/payment contexts; kept in descriptive copy, FAQ explanations, in-app admin banners (where a paying candidate seeing their own access window is a different context from being sold to), and terms.

**Removed from (10 locations):**
- `pricing.html` Sprint pnote: `42 days access · Full sprint programme` → `Full sprint programme`
- `pricing.html` Referred pnote: `90 days access · Nine-module recovery programme` → `Nine-module recovery programme`
- `which-programme.html` Sprint priceNote: `one-off · 42 days access` → `one-off`
- `which-programme.html` Referred priceNote: `one-off · 90 days access` → `one-off`
- `referred-programme.html` price note: `One-off payment · Immediate access · 90 days access` → `One-off payment · Immediate access`
- `referred-guide.html` payment note: `One-off payment · 90 days access · Updated for 2026` → `One-off payment · Updated for 2026`
- `employer-guide.html` Sprint sub-line: `one-off · 42 days` → `one-off`
- `employer-guide.html` Referred sub-line: `one-off · 90 days` → `one-off`
- `employer-guide.html` Referred feature bullet: `90 days focused access` → `Full access, at your own pace`
- `programme.html` Sprint also-meta: `£297 · 42 days` → `£297`
- `programme.html` Referred also-meta: `£397 · 90 days` → `£397`

**Left intact:** in-app admin banners in `index.html` and `platform.html` (`£397 · 90 days` in the Referred-only module gate warning); FAQ copy in `referred-programme.html` ("90 days from purchase — enough time to..."); descriptive paragraph copy in `index.html` and `referred-guide.html`; `terms.html` beyond the 42→49 update.

---

## 18 July 2026 — Stripe price ID mismatch fix + pricing copy audit

### Bug: Sprint and Referred buyers getting 'annual' plan (live since 30 May 2026)

**Root cause:** Commit `d5e07ea` (30 May 2026) updated Sprint and Referred price IDs in `create-checkout.js` but did NOT update `verify-session.js`. The two files referenced different IDs for the same plans.

**Impact:** Any Sprint (£297) or Referred (£397) buyer who completed checkout from 30 May to 18 July 2026 was granted `plan: 'annual'` — full 12-module access with an 18-month token — instead of their actual plan. Over-privileged, not locked out. 49 days of exposure.

**Fix (`verify-session.js`):** Sprint and Referred single-ID constants replaced with Sets containing both the current ID (matching `create-checkout.js`) and the legacy ID. Current IDs are now primary; legacy IDs kept as fallbacks.

- Referred: current `price_1TcsEeRkzyH1h56UidHDLTKy` (was checking `price_1TaFxDRkzyH1h56URvfFhEbr`)
- Sprint: current `price_1TcsLoRkzyH1h56UOSPEAPSq` (was checking `price_1SdEf0RkzyH1h56UQZUOtebL`)

**New standing rule (added to Key Lessons Learned below):** Any Stripe price ID must be defined in a single source of truth. `create-checkout.js` is authoritative; `verify-session.js` must always reference the same IDs. Any price ID change in one file is a mandatory change in the other.

### Pricing copy audit — fixes applied

Discovered £39.90/month and £383/year (old pricing, pre-2026 price change) still in two outbound marketing functions never updated when pricing changed:

- `nurture-sequence.js:39` — £39.90/month → £49/month (fixed)
- `capture-lead.js:47` — £39.90/month or £383/year → £49/month or £497 (fixed)
- `capture-lead.js:70` — First month is just £39.90 → £49 (fixed)

Also fixed:
- `employer.html` — "12 months access" → "18 months access" (Employer plan is 18 months per canonical pricing)
- `terms.html` — Annual Access access window "12 months from your activation date" → "18 months" (consistent with `send-welcome.js`, `which-programme.html`, and confirmed by Ange)

---

## Key Lessons Learned / Standing Rules

1. **Verify legal/competency facts against the current RICS guide before publishing.** Multiple corrections made this build cycle: CRE's competency list (was using Associate-level structure instead of Chartered), Residential leasehold reform (marriage value abolition not yet in force), various break clause/notice mechanics verified against current case law and statute.

   **12 July 2026 — QS/BS audit:** Retroactively audited Building Surveying and Quantity Surveying content (11B.2, M12 sections, Michael's `PATHWAY_RULES`) against the current December 2025 RICS pathway guides, since both were built before this session's verification standard was established. Found and fixed one discrepancy: QS's 11B.2 optional-selection paragraph incorrectly implied selection from the full technical competency list, when QS's optional competencies are actually drawn from a closed pathway-specific list only (unlike Building Surveying, which does require one further pick from the full list). Corrected in commit dbf10d3. No other issues found — Michael's `PATHWAY_RULES` for both pathways already matched the current guides.

   **12 July 2026 — TA audit:** Audited Taxation Allowances 11B.2, M12 pathwayOnly section, and Michael's `PATHWAY_RULES` against the current December 2025 RICS pathway guide. Found one discrepancy: the 11B.2 optional-selection paragraph listed "Inspection, Measurement, Legal and regulatory compliance, Data management, and Conflict avoidance" as common optional selections — all of which are mandatory competencies, not items from TA's actual pathway-specific optional list. Replaced with the correct optional list: Capital taxation, Contaminated land, Design economics and cost planning, Development appraisals, Due diligence, Insurance, Property finance and funding, Property management, Risk management, and Sustainability. Also noted that Michael's `PATHWAY_RULES` didn't specify TA's optional list contents — gap closed in follow-up commit by adding the full optional list inline to the TA `PATHWAY_RULES` entry. M12 HMRC enquiry scenario and core competency structure were both correct.

   **12 July 2026 — Rural audit:** Audited Rural 11B.2, M12 pathwayOnly section, and Michael's `PATHWAY_RULES` against the current December 2025 RICS pathway guide. Found two related errors in 11B.2: (1) the optional-competency list bullet points marked Management of the natural environment and landscape, Property management, and Valuation as "(mandatory if not chosen as core)" — a rule that only applies to Agriculture per the guide; the other three are standard optional-list entries with no mandatory-appearance requirement. (2) The trailing "Remember" paragraph repeated the same overstatement for all four options. Both corrected: Agriculture's bullet now reads "mandatory somewhere in your selection — if not chosen as core, must appear as an optional to Level 2 or 3"; the other three have no mandatory tag; "Remember" paragraph corrected accordingly. Michael's `PATHWAY_RULES` and M12 AHA rent review scenario were both correct.

   **12 July 2026 — CRE audit:** Audited Commercial Real Estate 11B.2, M12 pathwayOnly section, and Michael's `PATHWAY_COMP` against the current December 2025 / January 2026 RICS CRE pathway guide. Found two errors, both in 11B.2 and PATHWAY_COMP: (1) The grouped competency entry (Accounting principles and procedures / Conflict avoidance / Data management / Sustainability) was described as a mandatory pick ("one of your three optional picks must come from this group") — incorrect. The grouped entry is simply the first bullet on the optional list and is a ceiling rule only: if a candidate selects from this group, they may choose at most one; but they are not required to select from it at all, and can fill all three optional slots from the other ~17 items. (2) The "plus one" additional pick was described as "from either the core or optional list" — incorrect. It must come from the full list of technical competencies, the cross-pathway master list in the Requirements and Competencies guide, not a recycled pick from CRE's own lists. Both errors corrected in 11B.2 body and PATHWAY_COMP entry. M12 Section 25 notice scenario was correct.
2. **Don't invent or guess pathway IDs or colours.** Always check the codebase directly first. A CRE/Taxation Allowances colour collision on #b45309 happened and was fixed 10 July 2026 by not checking existing colours before a build.
3. **M11B numeric IDs and question bank prefixes are separate systems** — check both independently before assuming either implies the other's state (this is exactly what caused the Infrastructure gap: it had neither, despite assumptions that "all 22 question banks" were complete).
4. **Milestone strip splice fix:** the `else if` addition must start with a space then `else if` (not a newline followed by a brace) to chain correctly onto the preceding closing brace. Newline+brace escaping produces a stray extra `}` that cascades into a JS syntax error.
5. **Silent syntax error incident — 13 July 2026 (fixed in 9b176ed):** Three separate JS SyntaxErrors from the same session's batch work stacked up and silently broke the entire page (including login), with no visible console error. Root causes: (1) 11B.12 insertion placed inside the preceding section object instead of as a sibling array element, across all 16 modules; (2) `_m11bCRE` naming collision between Commercial Real Estate (id:24) and Corporate Real Estate (id:32) — both abbreviate to "CRE", now renamed to `_m11bCorpRE`/`_isCorpREDash` for Corporate RE; (3) unescaped apostrophe in "CRE's" inside a single-quoted `PATHWAY_COMP` string, terminating it early. **Standing rule going forward: after any bulk/batch edit touching multiple pathways or large JS string constants, run an actual JS syntax parse check (e.g. `node --check` on the extracted script block) — not just visual/structural verification — before committing.** Also: watch for name collisions between similarly-abbreviated pathways (Commercial Real Estate vs Corporate Real Estate) the same way colour collisions are already checked for.
5. **Confirm exact localStorage pathwayOnly strings before using them** — don't assume they match the pathway's common name. Confirmed exceptions: Facilities Management's stored string is `'Facility Management'` (no "s"), Quantity Surveying's is `'Quantity Surveying and Construction'`.
6. **Confirm push + Netlify deploy, not just local commit, before marking a pathway "live."** Planning and Development and Property Finance and Investment both sat committed locally but unpushed for a period before this was caught (12 July 2026) — from Corporate Real Estate onward, Claude Code confirms push+deploy before reporting completion.
7. **Large content blocks should be pasted as chat text, not shared via file/download** — Claude Code (running in the local terminal) has no access to files shared through the chat UI, only the local filesystem. Direct chat-text paste works reliably at ~11-section module length.
8. **Stripe price IDs: one source of truth, mandatory sync.** `create-checkout.js` is the authoritative file for all plan/price-ID mappings. `verify-session.js` must reference the exact same IDs. Any price ID change in one file is a mandatory change in the other — they are not independent. Discovered 18 July 2026: a 30 May price ID update in `create-checkout.js` was not mirrored in `verify-session.js`, silently granting Sprint/Referred buyers 'annual' access for 49 days.

### Standard 7-Point Wiring Checklist (per pathway)

1. `MODULES` array entry with 11 sections
2. Dashboard variables (`_m11bXX` / `_isXXDash`)
3. `dashMods` chain extension
4. Milestone strip `else if` entry
5. Navigation blocks (`id===X`, `id===11&&_isXX`, `id===12&&_isXX`)
6. `dmcard` unlock label inclusion
7. Matching `pathwayOnly` Module 12 section (unless one already exists, as with PM), using the confirmed exact localStorage pathway string

---

## M11B Structural To-Dos — COMPLETE (12 July 2026)

Both structural to-dos are now done across all 16 pathways:

1. **11B.0 "Understanding Your Technical Pathway Module"** — inserted before 11B.1 in all 16 M11B modules. Explains the bridge module concept, confirms pathway-guide verification, and gives four concrete how-to-use-it instructions. Existing 11B.1–11B.11 numbering unchanged; "11B.2 to 11B.9" cross-references in the earlier-built modules (Rural, TA, BS, QS) remain valid.

2. **11B.12 "If You've Been Referred: What This Module Means for You"** — inserted after 11B.11 in all 16 M11B modules. Reframes a referral as targeted feedback, gives four resit-specific instructions (including mapping referral report to sections, and when to revisit mandatory competency modules alongside pathway-specific content).

Both sections also reflected on the **Inside the Platform page** (`platform.html`): two new marketing sections added between the module grid and the Michael section — "Your Technical Pathway Module" and "Support for Referred Candidates" (with a link to the Referred Candidate Recovery Programme).

Committed across 4 batches (b72eba1, fb86b2a, a94d026, d50aebd), all pushed to origin/main. Three silent JS SyntaxErrors from this batch work were found and fixed in 9b176ed — see lesson 5 in Key Lessons Learned.

---

## Referred Revision Digest — CR5.4 (COMPLETE, 13 July 2026; expanded 13 July 2026)

A pathwayOnly-gated section added to CR05 for all 16 active pathways. Each referred candidate sees exactly one digest — the one matching their `gca_pathway` localStorage value — covering pathway-specific resit traps plus a "Practice this now" cue linking back to their M11B Module 12 scenario.

Module 17 (CR05) now has 19 sections: 3 universal (CR5.1–CR5.3) + 16 pathwayOnly CR5.4 digests.

**Pathways covered:** Rural, Taxation Allowances, Building Surveying, Quantity Surveying and Construction, Commercial Real Estate, Valuation, Infrastructure, Residential, Project Management, Facility Management, Planning and Development, Property Finance and Investment, Corporate Real Estate, Management Consultancy, Land and Resources, Building Control.

**Build process (initial insertion):** 4 batches of 4, each locally committed with `node --check` verification before any push. Final push (5a561d5) covered all 4 batches in one Netlify deploy. Pre-push audit confirmed all 16 pathwayOnly strings against confirmed localStorage values (including `'Facility Management'` and `'Quantity Surveying and Construction'`), no duplicates, syntax clean on 2.90M-char script block.

**CR5.4 content expansion — 13 July 2026 (commits 38f2c00, fe50926, 6e9092f, d7f0ca3; pushed d7f0ca3):**

All 16 CR5.4 digests expanded from lightweight 4-point summaries to in-depth 6-point sections with worked examples. Format per section: intro sentence, 6 numbered points each with a bold lead and worked structure or example, "If you have more time" cross-references to M11B sections, "Practice this now" cue. Body lengths range from ~2,400 to ~3,200 chars per pathway. Same 4-batch-of-4 / node --check / single-push discipline used.

**Canonical replacement method for structured MODULES content (established this session):** reconstruct old section JSON via `json.dumps({"h":..., "pathwayOnly":..., "body":...}, ensure_ascii=False)` from parsed MODULES data, verify `html.count(old_json) == 1`, replace with `html.replace(old_json, new_json)`. Do NOT use `raw_decode` against the raw HTML string — it fails at scale (returned 820K-char false match in testing). Always use default `json.dumps` separators (not `separators=(',',':')`) to match the original file's spacing.

**Pre-push audit checklist used for expansion push:**
1. MODULES JSON parse clean (34 modules, m17 has 19 sections)
2. All 16 CR5.4 pathwayOnly strings confirmed against localStorage values, body lengths all >1,500 chars
3. Both filter() calls confirmed to have pathwayOnly check (filter 1 at pos ~1,475,375 / 8-space indent; filter 2 at pos ~1,478,212 / 6-space indent)
4. `node --check` PASS on 2.919M-char script block
5. Push confirmed; Netlify deploy confirmed at 3,217,127 bytes live

**13 July 2026 — Three follow-up fixes (fc202a4):**

1. **CR5.4 pathwayOnly gating bug** — all 16 digests were rendering for every referred candidate regardless of pathway. Root cause: two separate `m.sections.filter()` calls exist in the codebase. Filter 1 (TOC sidebar) had the `pathwayOnly` check; filter 2 (main content renderer — the `content-section` divs users actually read) did not. The batch-insertion verification confirmed the MODULES data was correct but never tested the render path — a confirmed blind spot. Fix: one line added to filter 2. Verified by simulating the filter for 6 pathway values (Building Surveying, Rural, QS, Facility Management, Corporate RE, and no pathway set) — each returns exactly 3 universal CR05 sections + at most 1 matching digest.

2. **CR05 title** — `'Performing Under Pressure — Mock Practice and Your Final 30 Days'` → `'Performing Under Pressure — Mock Practice and Your Resit Prep'`. Fixed day-count framing implied an artificial ceiling.

3. **CR5.3 phase reframing** — Heading, body opening, and all day-range labels changed from calendar-day structure (Days 1–7, Days 8–14, etc.) to phase labels (Phase 1–5). Closing rule updated to reference Phase 3 instead of Day 21. Substantive guidance unchanged throughout. `20–30 minutes` (session length) and `final week` (pre-assessment reference) kept as-is.

**Standing note on verification scope:** `node --check` and JSON.parse() verify syntax and data structure — they do not verify render-path behaviour. When adding filtered content (pathwayOnly, sprintOnly), also simulate the filter logic in Python to confirm the correct sections are visible for each case.

**13 July 2026 — Third unfiltered render path found and fixed (post-expansion):**

After the CR5.4 expansion was pushed, a third unfiltered render path was discovered: the "MODULE PROGRESS" right-hand panel (built via `m.sections.map(...)` inside `modProgressPanel.innerHTML`). It was listing all 16 pathway-specific CR5.4 digests for every candidate, regardless of pathway — the same root cause as the earlier main-content-renderer bug. Fixed by adding the identical filter (pathwayOnly + sprintOnly + Sprint Learners header) before the `.map()` call. Section indices still align because both the main content renderer and progress panel now iterate the same filtered array, so `sec-${id}-${i}` / `step-${id}-${i}` IDs remain consistent.

Total render paths for `m.sections` confirmed by systematic grep: **3** (TOC sidebar, main content renderer, module progress panel). All three now have the pathwayOnly/sprintOnly filter.

**Stronger standing rule going forward:** For any `pathwayOnly`- or `sprintOnly`-gated content, do a full codebase search for *every* place the parent section array is iterated (grep `m\.sections`, `\.sections\.map`, `\.sections\.filter`, `\.sections\.forEach`) before marking the feature complete. Do not rely on knowing the render paths from a prior incident — a new surface can exist and be invisible to the verification done at insertion time.

**14 July 2026 — Module 12 pathwayOnly audit (proactive — no bug reported):**

Ran the same systematic render-path audit against Module 12 (32 sections: 16 universal + 16 pathwayOnly scenario sections, one per pathway). Findings:

- All 3 `m.sections` render paths (TOC sidebar, main content renderer, module progress panel) already have the pathwayOnly filter — no unfiltered paths found.
- 18 occurrences of `id === 12` in JS confirmed to be: dashboard unlock check, AI tutor widget injection (`renderAITutor()`), quiz rendering, and prev/next nav buttons for each pathway variant. None iterate sections independently.
- Section heading literals (12.16, 12.17, 12.18, 12.19, 12.20, 12.21) appear exclusively inside MODULES data — zero occurrences in render logic.
- Filter simulation confirmed for 5 pathway values (Rural, Project Management, Facility Management, Corporate Real Estate, no pathway): each returns exactly 16 sections (15 universal + 1 correct pathway scenario), or 15 (universal only) with no pathway set.

**Result: M12 clean — no fixes required.**

---

## 14 July 2026 — Referred Programme Updates (d614a46, c967c01, 3e061ef → pushed 3e061ef)

Three separate changes pushed in one deploy. Live confirmed at 3,241,931 bytes.

**Part 1 — CR04 rename (d614a46):** Module title changed from "Rebuilding Your Mandatory Competency Answers" to "Rebuilding Your Competency Evidence and Answers". One occurrence in MODULES data; cascades automatically to module menu, header, breadcrumb, and module progress panel via the shared section renderer.

**Part 3 — Case Study Review copy + button (d614a46):** Card copy updated across all three surfaces (compact panel locked state, csIntroOverlay heading/body, dashboard bottom card body) to "Strengthen Your Case Study" framing. Button text "Unlock for £29" → "Review My Case Study" in both the compact card and the csIntroOverlay payment button. Draft upload confirmed already post-payment only (inside `csOpenOverlay()`, not `csIntroOverlay`) — no sequencing change required.

**Part 2 — Referral Recovery Plan (c967c01 + 3e061ef):** New free tool for referred candidates, bridging CR01 to CR02.

- **3 new Netlify functions:** `save-recovery-plan.js`, `get-recovery-plan.js`, `delete-recovery-plan.js` — Netlify Blobs store `'recovery-plans'`, keyed by email, same pattern as CPD tracker.
- **Entry point:** Full-width banner card in referred dashboard `actionsEl`, sitting between the milestone strip and the Continue/Quick-links cards. Left-blue-accent border, visually distinct from CR0X module circles. Label: "Recovery Tool · Free · Between CR01 and CR02".
- **Four-state overlay:** (1) Intro — PDF upload (client-side pdf.js extraction, CDN loaded) or paste textarea, then "Analyse with Michael →"; (2) Loading spinner; (3) Draft review — each Michael-proposed row as an editable card, nothing added to plan without candidate confirmation; (4) Confirmed plan — grouped by category, per-row status dropdowns, auto-saves on change via `save-recovery-plan.js`.
- **Michael's system prompt:** Enforces provisional framing ("This might indicate...", "One possible action here is...") — never definitive. Returns JSON array only. All candidate/Michael text escaped via `rpEsc()` before innerHTML injection (XSS safe).
- **Manual fallback:** "Prefer not to upload? Complete the plan manually — you'll get the same structured table either way." skips directly to the empty plan table.
- **Access gate:** Referred plan only, free — no payment check.

**Pre-push verification:** node --check PASS on 2.93M-char script block; all 3 m.sections render paths confirmed to have pathwayOnly filter (dynamic search — hardcoded positions were stale after CSS/JS additions); MODULES JSON parse clean; all content checks passed.

---

## 14 July 2026 — Case Study Review access flow rework (ca87768, live)

Recovery Plan folded inside the £29 Case Study Review purchase. Five touch points changed in one commit:

**A — csIntroOverlay copy:** Eyebrow changed from "Case Study Review" to "ADD-ON" (matching dashboard bottom card pattern). H2 changed from "Strengthen Your Case Study" to "Case Study Review". Single-paragraph body expanded to three paragraphs: (1) case study shapes your questions, (2) Recovery Plan step — upload referral report, Michael proposes rows, candidate confirms, (3) case study coaching step. Price line updated to "Optional Case Study Review — £29 one-time".

**B — Entry banner removed:** The standalone "Recovery Tool · Free · Between CR01 and CR02" card removed from the referred dashboard `actionsEl`. No longer separately accessible as a free dashboard card.

**C — Compact panel unlocked state (return visits):** Previously showed one "📝 Case Study Review — Open" button. Now shows two: "🗂️ Your Referral Recovery Plan" (→ `openRecoveryPlan()`) and "📝 Case Study Review — Open" (→ `csOpenOverlay()`). Both persistent — candidates returning to update plan statuses or jump into case study coaching can do so independently.

**D — Post-payment first-visit auto-sequence:** On `cs_purchase=success` verification, sets `gca_cs_first_visit` flag alongside `gca_cs_access`. On the subsequent dashboard render, detects and clears the flag, then calls `setTimeout(openRecoveryPlan, 600)` — auto-launches Step 1 (Recovery Plan) once only. All return visits skip the auto-launch.

**E — Recovery Plan confirmed-plan footer:** "Continue to Step 2: Case Study Review →" button added alongside the existing "Start over / re-upload" button. Calls `closeRecoveryPlan(); csOpenOverlay()`. Present on every plan-state visit (first-purchase and return) since it's static HTML in `rpStatePlan`.

Recovery Plan overlay internals (four states, Michael behaviour, storage, system prompt) unchanged.

**Note on live verification:** End-to-end UI check (payment → auto-launch → Continue button → return visit dual buttons) requires browser interaction through a test account — not automatable from the terminal. This sequence should be manually tested on the live site before the next related change.

---

## Content Security Project — Architecture and Phasing

### Background (identified 15 July 2026)
`public/index.html` is a static file served to every visitor before authentication. It contains the full `MODULES` array (all 16 pathways, ~1.1 MB), all 17 question banks (~1.4 MB), and the coaching intelligence constants (~52 KB). The `pathwayOnly` JS filters only control rendering — they don't gate data delivery. Any user can view-source and read all pathway content regardless of plan or pathway.

### JWT canonical secret — CANONICAL RULE (established 17 July 2026)
**Always use `process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z'` in every Netlify function.**
The shorter fallback `'gca-secure-platform-2025-apc'` existed in 8 older functions and has been eliminated. In production both resolve to the same `JWT_SECRET` env var, but the inconsistent fallback was a silent-breakage risk. Fixed in 2d4151b across: `admin-login.js`, `generate-sprint-token.js`, `get-report.js`, `login.js`, `send-reset.js`, `verify-session.js`, `verify-sprint-session.js`, `save-report.js`.

### Phase 1 — Coaching intelligence server-side (COMPLETE, 2d4151b, 17 July 2026)
Moved `getMichaelModuleBriefing()` + 7 constants (PATHWAY_RULES ~13 KB, PATHWAY_COMP ~37 KB, PATHWAY_CLARIF, SPA_CONTEXT, RED_BOOK, FORESTRY, VALUER_REG) from `index.html` into `ai-tutor.js`.

Client now sends `{ moduleId, pathway, modTitle, source, messages, max_tokens }`. Server builds full system prompt from constants it owns. Two call sites updated: in-module tutor (`source:'module'`) and Michael Panel (`source:'panel'`). Non-module calls (mock sim, CS review, floating chat) continue using client-provided `system` string unchanged.

`index.html` reduced by ~37 KB. Coaching intelligence no longer in page source or visible in browser Network tab request payload.

### Phase 2 — M11B pathway modules behind `get-modules.js` (COMPLETE, 28df3b1 + push below, 18 July 2026)
Modules 20–35 (16 M11B pathway modules) moved out of the static MODULES array and behind `get-modules.js`. Built in three committed steps: (1) `get-modules.js` + `modules-data.json` created and unit tested (9 tests, all pass); (2) client-side wiring added with `window._useContentAPI` feature flag and `prefetchPathwayModule()` — static data kept as fallback, browser-verified by Ange (`[ContentAPI] serving module 21 from secure cache` confirmed); (3) static M11B section content stripped from `index.html` (523 KB / 16% reduction), flag removed, stubs kept for dashboard cards.

**Known limitation (accepted for Phase 2):** pathway is NOT in the JWT — it's client-side only (`localStorage.gca_pathway`). The function trusts the client's pathway claim. A paying candidate could request a different pathway's M11B by changing their localStorage value. This is explicitly accepted for Phase 2; server-side pathway storage (Netlify Blobs + `set-pathway.js`) is the Phase 2B fix if needed.

**Sequencing rule (followed):** `get-modules.js` built and verified first. Feature flag added with static fallback. Browser-tested by Ange. Static data removed only after confirmation. Static data removal and API wiring were never in the same commit.

### Phase 3 — Question banks behind `get-questions.js` (NOT YET BUILT)
`SA_QUESTIONS` array purpose is unconfirmed — **do not build Phase 3 until clarified by Ange.** It may be Sprint plan or Associate-level. The 16 confirmed pathway banks can proceed; SA_QUESTIONS needs separate scoping.

Each of the 17 question banks has entirely bespoke UI functions (not a shared component). Moving server-side requires refactoring the UI layer for each bank, not just data delivery. Recommended: one pathway at a time, independently verified.

### Phase 4 — Universal modules (1–11) and CR programme (lower priority)
These are common to all paid candidates — can't be gated by pathway, only by auth. Would require a post-login fetch replacing the static MODULES entries. Lowest priority since exposure applies equally to all paid subscribers.

---

## 17 July 2026 — Content security Phase 1 + JWT fix (2d4151b, live)

See "Content Security Project" section above for full detail. Short summary:
- JWT secret inconsistency fixed across 8 functions
- `getMichaelModuleBriefing()` + 7 coaching constants removed from `index.html`, now live in `ai-tutor.js` only
- Two Michael call sites updated to send `moduleId`/`source` instead of full system prompt
- `index.html` down from 3.07 MB to 3.04 MB

---

## 15 July 2026 — Remove orphaned navy CS Review card (3a16607, live)

`dashBottomRowGrid` was rendering two Case Study Review cards on the referred dashboard: the correct white compact panel (`id="csPanelCompact"`, in the static header row, goes through `csIntroOverlay`) and an orphaned navy card (`id="csReviewBottomCard"`, dynamically appended by JS, had stale copy "£29 one-off" / "Add Case Study Review" and called `checkout('case-study')` directly — bypassing the overlay entirely). The navy card was never updated during the access flow rework and was visible as a duplicate pricing entry next to the Industry Briefing card.

Removed: the entire JS block (comment + `const bottomGrid` + `if (bottomGrid && ...)` guard + `csCard` construction + `bottomGrid.appendChild`). `checkout('case-study')` now has 0 occurrences in the codebase. Industry Briefing card and its `dashBottomRowGrid` container are untouched. All purchase flow now routes through `csIntroOverlay` via the compact panel.

---

## 14 July 2026 — CS Review card width + markdown rendering (ea3b8a0, live)

Two independent visual/rendering fixes pushed together.

**Card width fix:** `.cs-panel-compact` `max-width` increased from `280px` to `340px`. The class is used on one element only (`id="csPanelCompact"` on the referred dashboard header row). The previous 280px caused the two unlocked-state buttons ("Your Referral Recovery Plan" / "Case Study Review — Open") and the price label to wrap excessively inside the flex row alongside the welcome text/badge.

**Markdown rendering fix:** Michael's Case Study Review feedback was displaying literal `##`, `---`, `**bold**` characters instead of rendered HTML. Root cause: `csRenderResults()` passed section body text through `csEscapeHtml()` (entity-only escape) and the `.cs-result-section-body` CSS used `white-space:pre-wrap`, outputting everything verbatim. Fix:
- Added `csMarkdownToHtml(str)` — line-by-line parser handling: `---`/`***` → `<hr>`, `##`/`#` headings → bold div, `- `/ `* ` bullet lists → `<ul><li>`, `1. ` numbered lists → `<ol><li>`, blank lines → `<br>`, plain lines → `<p>`. HTML entities escaped first (XSS safe).
- Added `csInlineMd(str)` — inline handler for `**bold**` → `<strong>` and `*italic*` → `<em>`.
- `csRenderResults()` now calls `csMarkdownToHtml()` for both section body and closing note.
- Removed `white-space:pre-wrap` from `.cs-result-section-body` CSS (no longer needed).

The AI tutor chat (pos ~1,550,816) already had its own partial inline formatter (`**bold**` + newlines only) — this fix does not touch that path.

**Pre-push verification:** node --check PASS (2,933,695 chars). Both changes confirmed in place before push.

---

## Other Outstanding Items (non-M11B)

- Daily touchpoint microlearning feature (roadmap idea, not yet built) — optional 5-min daily review, scoped to technical question banks only (spaced repetition/microlearning research), NOT for module/competency content
- Mobile view full review
- Social proof/testimonials
- Dashboard premium redesign
- Social graphics, eligibility quiz, infographics
- LinkedIn content calendar (status beyond late June 2026 unconfirmed)
