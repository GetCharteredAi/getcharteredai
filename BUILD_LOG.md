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
2. **Don't invent or guess pathway IDs or colours.** Always check the codebase directly first. A CRE/Taxation Allowances colour collision on #b45309 happened and was fixed 10 July 2026 by not checking existing colours before a build.
3. **M11B numeric IDs and question bank prefixes are separate systems** — check both independently before assuming either implies the other's state (this is exactly what caused the Infrastructure gap: it had neither, despite assumptions that "all 22 question banks" were complete).
4. **Milestone strip splice fix:** the `else if` addition must start with a space then `else if` (not a newline followed by a brace) to chain correctly onto the preceding closing brace. Newline+brace escaping produces a stray extra `}` that cascades into a JS syntax error.
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

## Two Outstanding M11B Structural To-Dos (apply across all pathways)

1. A general intro section explaining the technical pathway to candidates
2. A dedicated section for referred candidates

Both needed for the "inside the platform" page.

---

## Other Outstanding Items (non-M11B)

- Daily touchpoint microlearning feature (roadmap idea, not yet built) — optional 5-min daily review, scoped to technical question banks only (spaced repetition/microlearning research), NOT for module/competency content
- Mobile view full review
- Social proof/testimonials
- Dashboard premium redesign
- Social graphics, eligibility quiz, infographics
- LinkedIn content calendar (status beyond late June 2026 unconfirmed)
