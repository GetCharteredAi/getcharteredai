# Get Chartered AI — Build Log & Project Status

*Last updated: 7 August 2026 (CPD diagnostic logging; employer.html three fixes)*

---

## 7 August 2026 — CPD diagnostic logging + employer.html fixes (115e4fb, e240197)

### CPD silent-failure diagnostic logging (115e4fb)

Read-only investigation confirmed two failure modes in `get-cpd.js` and `save-cpd.js`:

**`get-cpd.js`:** Inner `catch(e) {}` was completely silent — any Blobs read failure returns `{ success: true, entries: [] }`, indistinguishable from a genuinely empty CPD log. Candidate sees blank log with no error.

**`save-cpd.js`:** Same silent inner catch for the read — but with a compounding risk: if the read fails silently while the write succeeds, `entries.unshift(newEntry)` runs against an empty array and `store.set()` writes `[newEntry]` only, silently overwriting all previous CPD entries. During the confirmed stale-token period, writes would have surfaced as 401 via the outer catch (visible failure), so this compound scenario requires a partial-failure window to cause actual data loss — not confirmed to have occurred, but structurally possible.

**Fix applied (diagnostic-only, no functional behaviour change):**
- `get-cpd.js`: `catch(e) {}` → `catch(e) { console.error('CPD read failed:', e.name, e.message, 'status:', e.status); readError = true; }` + `readError` flag added to response body so client can distinguish genuine empty from read failure
- `save-cpd.js`: same `console.error` logging added to inner catch

Both files verified: `node --check` PASS, `catch(e)` count = 2 (inner + outer), `statusCode: 200` count = 1. Blobs key count (number of candidates with CPD data) not accessible locally — check via Netlify dashboard → Storage → Blobs → `cpd-logs`, or `netlify blobs:list --store=cpd-logs` after CLI login.

### employer.html three fixes (e240197)

Three inconsistencies corrected vs `employer-guide.html`:

1. **Cohort-size buckets standardised** — select updated from 1–5/6–15/16–30/30+ to 1–5/6–10/11–20/21–50/50+, matching `employer-guide.html` exactly.

2. **Year Two Readiness Review (£127) added** as fourth pricing card. Pricing grid CSS updated from `repeat(3,1fr)` to `repeat(4,1fr)`. Card uses same `.price-card` / `.price-tier` / `.price-features` / `.price-cta` class pattern as the three existing cards. Mobile grid (`grid-template-columns:1fr`) already in the media query — no mobile change needed.

3. **Light-themed footer added** — `employer.html` had no footer at all (closed `</script></body></html>`). New footer uses light design (`background:#f8fafc`, `border-top:1px solid #e2e8f0`, navy brand name, `#64748b` link colour) matching the page's existing white/grey design system rather than copying `employer-guide.html`'s dark footer. Links: Platform / Employer Guide / PDF Guide (`/employer-guide.pdf`) / Counsellor Guide (`/counsellor-guide.pdf`) / email. PDF paths confirmed against working `employer-guide.html` equivalents before applying.

Note: "22 pathways" language on both employer pages is confirmed intentional marketing copy — not changed.

---

## 6 August 2026 — Try Michael interactive demo (feat/try-michael, merged fc6131e)

### What was built

A public two-stage AI interaction section on `index.html`, placed between the "About Michael" and "Programme Finder" sections. No JWT required — fully open to prospective candidates.

**Architecture:**

`netlify/functions/try-michael.js` handles three distinct request types:

- **`stage: 'question'`** — server-side random question selection. No AI, no Blobs, no auth. Picks one of five questions at random, returns `{ question, questionIndex }`. The client never sends question text — only the index returned by this call.
- **Stage 1** — Haiku (`claude-haiku-4-5-20251001`, 120 tokens). Takes `{ stage: 1, answer, questionIndex }`. Returns a 40–60 word level assessment (Level 1/2/3) with brief reasoning. Rate-limited per IP (fail-open — Blobs outage should not block visitors).
- **Stage 2** — Sonnet (`claude-sonnet-4-6`, 400 tokens). Takes `{ stage: 2, answer, questionIndex, email, pathway, sittingWindow }`. Returns three-part full assessor breakdown: stronger answer example at next level, full-range example if Level 1, genuine assessor follow-up question. Ends with the fixed line "This is Assessor Mode — every module, every competency, works this way." Email gate is **fail-closed** (Blobs outage returns 503, not allow-through). Pathway and sitting window written to Blobs `em:{email}` record for lead capture alongside the timestamp.

**Injection hardening:**
- Both system prompts are server-side `const` strings — no visitor data touches either prompt
- Question text comes from a server-side `QUESTIONS[5]` array — client sends only an integer index (0–4), validated server-side
- Visitor answer goes into `messages[0].content` user slot only

**Question pool — five questions (all RICS APC ethics framing):**
1. Conflict of interest identification and action
2. Whether to raise a concern about something seen on a project
3. Explaining a difficult professional decision to a client
4. Being asked to do something professionally uncomfortable
5. Identifying a risk others overlooked

**UI state machine (6 states):**
- `idle`: collapsed — only reveal button visible ("Try a question — see how Michael would actually assess your answer →")
- `loading-q`: button disabled, "Loading…" while question fetches
- `question-shown`: question card revealed, textarea and Stage 1 button appear
- `s1-loading`: textarea locked, Stage 1 button loading
- `s1-done`: Stage 1 response (blue left border), email gate expanded
- `s2-done`: Stage 2 response (amber left border), pricing CTA

**Email gate — three fields:**
- Email address
- Pathway dropdown (all 16 active RICS pathways, alphabetically ordered, matching `VALID_PATHWAYS` in `get-questions.js`)
- Sitting window dropdown (five time buckets: Under 3 months / 3–6 months / 6–12 months / 12–18 months / More than 18 months)
- Single combined validation message ("Please complete all fields above.")
- Gate copy: "Enter your details." (not "Enter your email.")
- One-per-email gate: error message is "This email has already received a full breakdown." — no "Try a different email address" appended (removing implicit invitation to circumvent)

### Bugs found and fixed

**Bug 1 — Blobs 401 (Netlify access token expiry)**

During initial branch deploy testing, Stage 2 returned 503 ("Please try again shortly.") despite env vars being present. Root cause: `NETLIFY_ACCESS_TOKEN` had expired or been revoked. Diagnosed via diagnostic logging (added temporarily, removed before merge): `siteID present: true, token present: true` combined with `401 status code` on `store.get()`. Fix: Ange generated fresh Netlify PAT, updated env var in dashboard, triggered empty commit redeploy. Token expiry is an ongoing operational risk — the same pattern could silently affect `get-cpd.js`/`save-cpd.js` (see Outstanding Items).

**Bug 2 — Systematic curly/smart quote corruption in JS block**

After all features were confirmed working in isolation, the button click did nothing — no loading state, no question reveal. Browser console showed `SyntaxError: Invalid character '‘'` at line 1597 and `ReferenceError: Can't find variable: _tmReveal`. Root cause: the `Edit` tool had introduced typographic/curly quotes (U+2018/U+2019 single, U+201C/U+201D double) as JavaScript string delimiters throughout the entire 100-line script block — 63 occurrences. The SyntaxError at the first curly quote prevented the entire script block from parsing, so `_tmReveal` was never defined. Fix: Python codepoint replacement (`chr(0x2018)` → `chr(0x27)` etc.) targeted at lines 1593–1696, validated clean with codepoint scan + `node --check` on extracted JS before push.

Note: This is a recurring risk in this codebase — the same category of curly-quote corruption has caused JS breakage before. Any JS written via Edit/Write should be verified with a codepoint scan before pushing.

### Commits

- `d6c3db2` — Add diagnostic logging (temporary, for Blobs 401 diagnosis)
- `9ef0e7f` — Empty commit to trigger branch redeploy after token refresh
- `027ccfe` — Add question pool, collapsed reveal, and pathway/sitting gate
- `03e3831` — Fix curly/smart quote corruption in JS block
- `fc6131e` — Merge to main

---

## 5 August 2026 — Security: close unauthenticated ai-tutor.js exposure (32fd870, merged 2312a6d)

### Exposure found

`ai-tutor.js` had no server-side authentication check of any kind. It accepted any POST to `/.netlify/functions/ai-tutor` with no token, no credential, no origin restriction. CORS was `Access-Control-Allow-Origin: *`. Anyone who could identify the function URL and request format (readable from deployed page source) could call Claude — Haiku for standard requests, Sonnet for scored requests — at platform cost, indefinitely, with no rate limiting.

This was discovered while scoping the "Try Michael" public demo feature. It was not previously documented. The exposure was live across all four plan types.

### Root cause

All access gating for Michael was client-side only (the dashboard JS wouldn't render Michael's UI without a valid session). Server-side, the function was open. The nine client-side call sites that legitimately use `ai-tutor.js` did not send a token — not because the token was unavailable, but because the server never required one.

### Fix — two parts, deployed together (branch `fix/ai-tutor-auth`)

**Server side — `ai-tutor.js`:** JWT verification added immediately after body parse, before any Anthropic call. Reuses the exact pattern from `get-cpd.js`/`save-cpd.js` (same secret, same base64 decode + signature comparison). Any request with a missing, malformed, expired, or invalid token returns 401 immediately. Claude is never called.

**Client side — `index.html`:** `token: getToken()` added to all nine `ai-tutor.js` call sites:
1. Module in-tutor chat (`callModuleTutor`)
2. Floating dashboard chat (Module 12 embedded chat)
3. Mock interview question generation
4. Mock interview answer scoring
5. PREP evidence feedback
6. Case study review
7. Michael panel (`sendMichaelPanel`)
8. Recovery plan parser
9. Think on Your Feet articulation verdict

`getToken()` (line 2288) returns `localStorage.getItem('gca_token')` — available globally at all nine call sites. No client-side session flow changes required.

### Pre-deploy check

Confirmed zero of nine call sites were sending a token before the fix — critical catch, because deploying the server-side check without the client update would have broken Michael for every paying candidate immediately. Both halves committed together and deployed to a branch (`fix/ai-tutor-auth`) before any merge to `main`.

### Browser verification (preview deploy)

Tested by Ange on `fix/ai-tutor-auth` preview:

| Feature | Result |
|---|---|
| Module in-tutor chat | ✅ Working |
| Mock interview question generation | ✅ Working |
| Mock interview answer scoring | ✅ Working |
| PREP evidence feedback | ✅ Working |
| Case study review | ✅ Working |
| Michael panel (Ask Michael) | ✅ Working |
| Think on Your Feet verdict | ✅ Working |
| Floating chat (Module 12) | Not tested — pre-existing Module-12-only gating confirmed via `git show 01d670d`, unrelated to this fix |

7 of 8 Michael-dependent features explicitly confirmed working. 8th is a Module 12-specific element gated at line 3634 (`id === 12 ? renderAITutor() : ''`), present before any work this session.

### Open items following this fix

- **`ai-tutor.js` still accepts a client-provided `system` prompt** for non-moduleId calls (mock sim, CS review, floating chat, recovery plan). A determined caller with a valid token could still pass an arbitrary system prompt. Medium-term: lock these to server-side prompts the way `moduleId`-based calls already are.
- **Floating chat (Module 12)** — confirm whether the embedded chat is intentionally Module-12-only or should be surfaced elsewhere on the dashboard.

---

## 5 August 2026 — Dashboard dark canvas + Monthly unlock pill (f54ee76)

### White module card boxes — root cause and fix

`.dash-main` background was `var(--off)` (`#f8fafc`, near-white). Module cards use `background: rgba(255,255,255,.03)` — 3% white opacity, designed for a dark parent. On a near-white canvas this rendered as white boxes. CSS was correctly deployed; the cards were rendering exactly as specified but on the wrong parent.

Fix: `.dash-main` background changed from `var(--off)` to `var(--navy)` (`#0D0F1C`) — matching the nav bar, giving the dashboard a fully dark canvas. Two text elements inside `.dash-main` that used `var(--text)`/`var(--muted)` (near-black, invisible on dark canvas) updated to `#eef2ff` / `rgba(255,255,255,.45)` respectively.

### Monthly "Next module unlocks" pill

Pre-existing gap: when a Monthly subscriber completed all currently-unlocked modules (`lastMod === null`, `done > 0`), neither the Continue nor Start Here branch fired — the action row rendered with no primary action at all.

Fix: new `else if (plan === 'monthly')` branch added to `renderDashboard()`. Computes next unlock date as `activatedAt + unlockedCount * 30 * 24 * 60 * 60 * 1000` (consistent with `getUnlockedCount` formula) and renders a disabled pill: "Next module unlocks [date]". Annual/Sprint/Referred cannot reach this branch.

---

## 4 August 2026 — Question bank pilot audit: Valuation + Taxation Allowances (6063b57, 9481fcc)

Pilot accuracy audit of `questions-data.json`. Methodology: check against official live sources only — RICS Global Standards, legislation.gov.uk. Two pathways fully audited.

### Referred programme structure — confirmed accurate

CR01–CR09 keys verified in the JSON. CR07 is the pathway-specific M11B module inserted between CR06 and CR08. No issues found.

### Valuation — Q1 PASS tier (6063b57)

**Q1 asks for the RICS definition of Market Value.**

Pilot check of 5 definitional questions (Q1, Q6, Q7, Q14, Q17). One real error found:

- Q1 PASS: `"Market Value is the estimated amount for which a property should exchange..."` — wrong. The RICS Global Standards definition covers assets and liabilities, not just properties.
- **Fix:** `"a property"` → `"an asset or liability"` to match RICS Global Standards verbatim.

Q4 (Red Book 2025 effective date) verified as correct. Q6, Q7, Q14, Q17 — not flagged.

### Taxation Allowances — Q15 and Q19 HIGH tiers (9481fcc)

Full 50-question audit. Two questions with imprecise pooling-timing language for CAA 2001 s187A (past owner pooling requirement for fixtures):

**Q15 HIGH and Q19 HIGH** both stated: `"the expenditure must be pooled in a chargeable period where they are treated as owning the fixture"`

The actual statutory requirement (CAA 2001 s187A(4)(a)) is: "allocated to a pool in a chargeable period beginning on or before the day on which the past owner ceases to be treated as the owner of the fixture."

The old wording omits the key qualifier — "beginning on or before the day" — which is the operative restriction. A chargeable period that merely overlaps with ownership satisfies the old wording but not the statute.

- **Fix Q15:** `"pooled in a chargeable period where they are treated as owning the fixture"` → `"pooled in a chargeable period beginning on or before the day the past owner ceases to be treated as owning the fixture"`
- **Fix Q19:** Same correction. The Q15 imprecision was originally flagged from Q21–50 review; Q19 found to contain identical language when both were fixed together.

Q19 was initially missed in the Q1–20 pass because it used the same phrasing — the two-question pattern only surfaced when Q15 was being fixed and Q19 was re-scanned.

### Coverage after this session

Audited: Valuation (pilot, 5 of 50 questions), Taxation Allowances (full 50). 14 pathways remain unchecked: Building Surveying, Quantity Surveying and Construction, Planning and Development, Project Management, Residential, Commercial Real Estate, Property Finance and Investment, Facility Management, Rural, Land and Resources, Building Control, Corporate Real Estate, Management Consultancy, Infrastructure.

---

## 3 August 2026 — Michael coaching audit: PATHWAY_COMP named-list fixes (51be749, dcfa800, 8c9d530, 00b3299)

Full audit of Michael's `PATHWAY_COMP` constant in `ai-tutor.js` against the official RICS pathway guides (December 2025 v1.6) across 10 pathways. All verified against source PDFs before any change was applied.

**Scope:** 10 pathways checked. 8 of 10 now fully verified. 2 remaining flagged for future pass once current PDFs are sourced.

### Results summary

| Pathway | Outcome | Commits |
|---|---|---|
| Valuation | Fixed — Machinery and business assets specialisation sub-list named (11 items) | 51be749 |
| Infrastructure | Fixed — 8-competency "four to Level 3" core selection list named | 51be749 |
| Residential | Already fully accurate — no changes | — |
| Project Management | Already fully accurate — no changes | — |
| Planning and Development | Already fully accurate — no changes | — |
| Facilities Management | Fixed — 10-competency core list named | dcfa800 |
| Property Finance and Investment | Fixed — 13-item optional list named | 8c9d530 |
| Corporate Real Estate | Fixed — 14-item optional list named | 8c9d530 |
| Management Consultancy | Fixed — 15-item optional list named | 00b3299 |
| Land and Resources | Fixed — 34-item optional list named | 00b3299 |

### What was fixed

All five fixes followed the same pattern: the structural rule (how many competencies, at what level) was already correct — the only gap was that the list being drawn from was unnamed ("from core list" / "from the optional list"). Each fix names the list explicitly, matching the Infrastructure fix pattern established at the start of the audit.

**Valuation — Machinery and business assets (51be749):**
- Before: `"must choose two to Level 3 from a specific sub-list (see RICS document)"`
- After: named 11-item list: Accounting principles and procedures OR Conflict avoidance OR Sustainability (grouped as one); Auctioneering; Capital taxation; Compulsory purchase and compensation; Corporate recovery and insolvency; Insurance; Investment management; Leasing/letting; Legal/regulatory compliance; Local taxation/assessment; Purchase and sale

**Infrastructure — four to Level 3 core list (51be749):**
- Before: `"plus four to Level 3 from core list"`
- After: named 8 competencies: Client care, Contract practice, Cost prediction and analysis, Procurement and tendering, Programming and planning, Project controls, Quantification/costing and price analysis, Risk management

**Facilities Management — core list (dcfa800):**
- Before: `"Two to Level 3 and two to Level 2 from core list (Client care must be taken to Level 3)"`
- After: named 10 competencies: Asset management, Business alignment, Client care (must be taken to Level 3), Legal/regulatory compliance, Maintenance management, Performance management, Procurement and tendering, Project finance, Supplier management, Workspace strategy

**Property Finance and Investment — optional list (8c9d530):**
- Before: `"One to Level 3 and one to Level 2"`
- After: named 13 items: Accounting principles and procedures, Capital taxation, Corporate finance, Development appraisals, Indirect investment vehicles, Landlord and tenant, Leasing/letting, Local taxation/assessment, Property management, Purchase and sale, Research methodologies and techniques, Strategic real estate consultancy, Valuation

**Corporate Real Estate — optional list (8c9d530):**
- Before: `"Three to Level 3 and one to Level 2"`
- After: named 14 items: Change management, Inspection, Leasing and letting, Local taxation/assessment, Measurement, Performance management, Procurement and tendering, Programming and planning, Purchase and sale, Strategic real estate consultancy, Supplier management, Sustainability, Valuation, Workspace strategy

### All 10 pathways complete

All optional lists applied against the official RICS "Requirements and Competencies Guide: Chartered framework" (December 2025, amended March 2026) — the master document covering all 22 pathways, which also independently confirmed every fix applied earlier in the session.

### M11B module-content cross-check (7d4fa74)

After closing the PATHWAY_COMP audit, the 11B.2 section (competency structure) of the 7 pathways where gaps were found was cross-checked against the same module content candidates actually read. Finding: 6 of 7 already fully accurate with named lists — the module content was written more recently and more carefully than PATHWAY_COMP. One real error found and fixed in Management Consultancy:

**Management Consultancy 11B.2 — optional rule description corrected:**
- `"you select three, from a broad list including"` → `"one to Level 3 and one to Level 2 from:"` (the rule has two distinct level requirements, not three undifferentiated picks)
- `"from either the core or optional list"` → `"from the full technical competency list (the cross-pathway master list — not a recycled pick from the core or optional lists above)"` (same category of error as the CRE 11B.2 fix from the 12 July audit: conflating two distinct competency pools)

File: `netlify/functions/modules-data.json`. JSON parse-clean verified post-edit.

---

## 1 August 2026 — Nav logo alignment + "When you enrol" restructure (a59369c, eb9f064)

### Nav logo alignment with hero content (a59369c)

The nav logo sat at a fixed 40px from the viewport left edge regardless of viewport width. The hero content block is `max-width:1100px` centred within a section with 24px gutters — at 1440px its left edge falls at ~170px, leaving a 130px visual disconnect between the logo and the content below it.

**Fix:**
- `nav` padding changed from `0 40px` to `0 24px` (matching the hero's horizontal gutter)
- Nav children (logo, nav-right div, hamburger button) wrapped in `<div style="max-width:1100px;margin:0 auto;width:100%;display:flex;align-items:center;">` — the same centering formula as the hero container

Result: logo left edge tracks `24px + (viewport − 48px − 1100px) / 2` at all widths above 1148px, identical to the hero content. Below 1148px both sit at 24px. All nav links, dropdowns, mobile hamburger and mobile drawer unaffected — `.nav-right{margin-left:auto}` continues to push links flush right within the constrained wrapper.

### "When you enrol" paragraph restructure with highlights (eb9f064)

The section's single opening paragraph ran all three programme descriptions (Full Programme, Referred, Year Two) together as one long unbroken block with no visual hierarchy. Split into three distinct paragraphs and applied `.anim-highlight` (already defined in the section's inline `<style>` block as `color:#2563EB;font-weight:600`) to seven key facts.

**Paragraph 1** (retains `anim-intro-text` class, word-reveal animation, `margin:0 auto 24px`):
Highlights: `12 structured modules` · `50 pathway-specific technical questions` · `24/7 support from Michael` · `60-minute AI-scored mock interview`

**Paragraph 2** (static, `margin:0 auto 24px`):
Highlights: `APC Referred — Confidence Reset` · `nine specialist modules`

**Paragraph 3** (static, `margin:0 auto 56px` — preserves spacing before the four amber programme boxes):
Highlight: `APC Year Two Readiness Review`

**Animation note:** The `wrap()` JS treats `.anim-highlight` spans as element nodes and recurses into them, wrapping their text children in `.anim-word` spans. CSS cascade means highlighted words in P1 animate in already blue and bold. P2 and P3 render with static blue+bold highlights from page load — no animation conflict.

---

## 1 August 2026 — Meet Michael rewrite (2ba297a)

Final piece of the landing page declutter pass. The previous Michael section led with a generic process statement ("Most APC candidates revise content but never practise performing under pressure…") followed by three bullet points and a broken link.

**Copy replaced with three paragraphs centred on the knowing-vs-defending insight:**
1. "Knowing your competencies isn't the same as being able to defend them under pressure. Michael is where you find the gap — before an assessor does."
2. "Ask him to explain something you're unsure of. Then switch him into Assessor Mode and let him challenge you the way a real panel would: pushing back, asking follow-ups, testing whether your answer actually holds up."
3. "Every pathway. Every module. From your very first day."

**Removed:**
- Three `michael-check-item` bullet points ("Tutor Mode for structured learning" / "Assessor Mode for realistic challenge" / "Available 24/7 across every pathway") — all accurate but generic; the paragraphs now convey the same substance with more force
- "Watch 90-second introduction →" link — pointed to `/pricing` with no video behind it

Eyebrow ("Your AI APC Coach"), heading ("Meet Michael"), HeyGen video iframe, grid layout and section wrapper all unchanged.

---

## 1 August 2026 — Landing page declutter pass (741c15a → 3efaf5e)

A holistic audit of the full landing page in section order revealed significant repetition and three real errors (stale copy, a dead UI element, orphaned JavaScript). Four commits in this pass.

### "How It Works" + "Getting Started" consolidation (741c15a)

Two sections were doing the same job: a 4-step `how-it-works-sec` and a 4-step `contact-sec` ("Getting Started"). The `how-it-works-sec` was already hidden (`display:none!important` in the 768px media query) but still present in the DOM. Removed it entirely and consolidated into a single revised `contact-sec`, updated to reflect the platform's actual preparation flow rather than a generic onboarding sequence.

Changes:
- Removed entire `<section id="how-it-works-sec">` (37 lines)
- Removed orphaned `#how-it-works-sec{display:none!important}` CSS rule from 768px media query
- Updated `contact-sec` heading: "From enrolment to first module in under five minutes." → "Enrol in minutes. Prepare at your pace. Walk in ready."
- Steps 03 and 04 rewritten to focus on preparation depth rather than setup mechanics

### "About the Platform" trim + Sprint/quiz fixes (3efaf5e)

Full section-by-section text audit identified three errors and one structural redundancy in About the Platform:

**Error 1 — Stale "six specialist modules" in About opening paragraph**
The first `about-long` paragraph read: "Get Chartered AI is a structured APC preparation platform... Twelve modules covering every mandatory competency. Sprint-specific coaching for candidates preparing under pressure. Six specialist modules for referred candidates. All 22 RICS pathways supported from day one." The referred programme has nine modules (CR01–CR09), not six. The entire sentence list was also redundant — all these facts appear in dedicated sections lower on the page. Fix: retained the single opening sentence ("built by Chartered Surveyors…"), removed the rest.

**Error 2 — "42 days" in Sprint expanded panel**
The `prog-sprint` detail panel body still read "Focused, intense preparation over 42 days with real assessor-style questioning." All other Sprint day-count references had been removed from the site in an earlier session pass; this one was missed. Fixed to match: "Focused, intense preparation with real assessor-style questioning."

**Error 3 — Dead "Take the 2-minute quiz" link and orphaned JS**
A link at the bottom of the `programme-finder-sec` grid labelled "Take the 2-minute quiz →" linked to `#pathways-sec` but triggered no quiz behaviour. The associated JavaScript block (`pfResults`, `pfSelectQ1`, `pfShowResult`, `pfBack`, `pfReset`, `data-pf-action` event listener — 59 lines) referenced HTML element IDs (`pf-q1`, `pf-q2`, `pf-result`, `pf-dot1`, `pf-dot2`) that do not exist anywhere in the file. The quiz was never built; only the JS scaffolding and the link label remained. Both removed entirely. A proper eligibility quiz is a parked future project and will be built from scratch when commissioned.

**Structural fix — "Get Chartered AI Difference" info-card removed**
The right-hand `info-card` in `About the Platform` ("Structure. Confidence. Results." + 8 bullets) duplicated content already covered in the `why-sec` section eight cards below it. Removed entirely. `<div class="about-grid">` changed to `<div>` so the remaining About content flows full-width rather than sitting at ~60% in the first grid column. The two checklist bullets above the italic quote ("Assessor-led pathway-specific question bank" / "PREP Builder") were also removed as redundant; the italic quote ("Warm when you are learning…") is retained as the section's closing line.

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
