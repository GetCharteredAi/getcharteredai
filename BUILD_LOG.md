# Get Chartered AI — Build Log & Project Status

*Last updated: 12 July 2026 (Building Control added — active queue complete)*

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

## Other Outstanding Items (non-M11B)

- Daily touchpoint microlearning feature (roadmap idea, not yet built) — optional 5-min daily review, scoped to technical question banks only (spaced repetition/microlearning research), NOT for module/competency content
- Mobile view full review
- Social proof/testimonials
- Dashboard premium redesign
- Social graphics, eligibility quiz, infographics
- LinkedIn content calendar (status beyond late June 2026 unconfirmed)
