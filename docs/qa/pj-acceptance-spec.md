# Get Chartered AI — Professional Judgement Acceptance Specification
**Version:** Draft 0.1 — Awaiting Professional Review  
**Prepared:** September 2026  
**Status:** NOT APPROVED — source verification and qualified professional review outstanding for all five tests

---

## Part A — Outstanding Local Changes (Preserved, Uncommitted)

The following local changes exist on the `main` branch and have not been committed or deployed. They must not be discarded or overwritten.

| File | Change | Status |
|---|---|---|
| `netlify/functions/ai-tutor.js` | (1) Routing fix: `moduleId \|\| source === 'panel'` covers falsy `moduleId: 0` from dashboard button; (2) `max_tokens` increased to 2000 for `source === 'panel'`; (3) Full coaching behaviour block for `source === 'panel'` replacing bare fallback; (4) RESPONSE FORMAT + RESPONSE DISCIPLINE blocks for `source === 'module'` | Uncommitted, tested locally |
| `public/index.html` | (1) DOMPurify + marked.js Markdown rendering in `michaelPanelAppend()` and `callModuleTutor()`; (2) `continueMichaelPanel()` function and "Continue explanation →" button for truncated responses; (3) GEAR 1 APPROACH updated with answer-first, observation/explanation, one-question, safety and proportionality bullets; (4) `<script>` tags for marked.umd.js and purify.min.js | Uncommitted, tested locally |
| `public/js/marked.umd.js` | marked v18.0.14 UMD build — new file | Untracked, tested locally |
| `public/js/purify.min.js` | DOMPurify v3.4.16 — new file | Untracked, tested locally |
| `package.json` / `package-lock.json` | marked and DOMPurify added as dependencies | Uncommitted |

**None of these changes should be committed until the Professional Judgement Quality Gate is established and at least AT-1 through AT-5 have completed professional review.**

---

## Part B — Professional Judgement Standard (Eight Criteria)

These criteria apply to every Michael Tutor response. They are evaluation criteria, not a response template. Michael must not render these as visible headings.

| # | Criterion | Brief description |
|---|---|---|
| PJ1 | Evidence fidelity | Response represents only the information available; does not present assumed facts as established |
| PJ2 | Inference discipline | Distinguishes observation, inference (possibility worth investigating) and established conclusion |
| PJ3 | Uncertainty handling | Acknowledges what is not known; describes what investigation is needed; does not fill gaps with false confidence |
| PJ4 | Safety and risk identification | Addresses immediate safety implications before routine investigation where the situation warrants |
| PJ5 | Proportionality | Investigation steps, monitoring and referral are proportionate to evidence, risk and competence |
| PJ6 | Competence boundary | Correctly identifies the limits of the professional's competence; identifies when specialist input is required |
| PJ7 | Standards application | Accurately applies mandatory professional standards; distinguishes mandatory from guidance |
| PJ8 | Recommendation support | Recommendations are grounded in the described evidence and context, not solely in pattern or rule of thumb |

### Objectively checkable failures (automated or checklist)

The following failures can be identified without professional judgement:

- Response states a specific named cause for a building defect from pattern description alone, without qualifying language (PJ2)
- Response states the contractor's right to refer to adjudication is limited to a 28-day window (PJ7 — factual error)
- Response attributes the construction phase plan to the Principal Designer rather than the Principal Contractor (PJ7 — factual error)
- Response applies 2022 Red Book VPS numbering rather than 2025 numbering (PJ7 — version error)
- Response presents monitoring as an unconditional first step before any assessment of the evidence (PJ5)
- Response states the primary duty to provide pre-construction information rests with the Principal Designer rather than the client (PJ7 — attribution error)

### Failures requiring qualified professional judgement

The following require a qualified reviewer:

- Whether the level of qualification used ("typically indicates," "may suggest") is professionally appropriate in the specific context (PJ2)
- Whether the described investigation approach is proportionate to the specific circumstances (PJ5)
- Whether the situation described clearly warrants specialist referral (PJ6)
- Whether a conflict of interest described in the question requires decline, or can be managed with disclosure and consent (PJ7/PJ8)

### What cannot constitute a pass criterion

A response must not pass solely because it:
- Contains the phrases "professional judgement," "further investigation required," or "specialist advice may be needed"
- Follows a conversational format
- Reaches a target word count
- Avoids numbered sections and headings
- Uses British English spelling

---

## Part C — Acceptance Tests

---

### AT-1 — Building Surveying: External Brickwork Cracking

**Review status:** AWAITING CHARTERED BUILDING SURVEYOR REVIEW  
**Approval status:** NOT APPROVED

---

#### C1.1 Candidate question

"A client reports cracking to the external brickwork. What should I consider?"

---

#### C1.2 Pathway and competency

| Field | Value |
|---|---|
| Primary pathway | Building Surveying |
| Primary competency | Building Pathology (mandatory Level 3) |
| Also relevant | Inspection (mandatory Level 3 on Building Surveying pathway) |
| Jurisdiction | England and Wales unless otherwise stated |

*Note: Building pathology questions also arise on Residential, Valuation, Facilities Management and other pathways at various levels. This test case is written for the Building Surveying pathway at Level 2–3.*

---

#### C1.3 Expected professional reasoning

The following describes the expected professional approach. Each element is marked with its source status.

**Step 1 — Safety assessment (priority)**  
Before any detailed investigation, consider whether the cracking may indicate an immediate safety risk: structural instability, risk of falling masonry, significant distortion, or another hazard requiring urgent precautionary action. Do not assume every crack is an emergency, but safety must be addressed at the outset, not deferred.  
*Source status: General professional obligation under RICS Rules of Conduct (obligation to provide a high standard of service and act in a way that promotes trust); consistent with RICS mandatory competency requirements. No specific RICS technical standard has been verified as requiring this as a first step. **CBS review required to confirm whether specific RICS or HSE guidance establishes this as a mandatory first consideration.***

**Step 2 — History and progression**  
Establish when the cracking first appeared, whether it is active (still developing) or stable (dormant), and whether the client has noticed any associated symptoms (sticking doors or windows, movement in the structure, water ingress). An active crack requires different urgency and investigation approach from a stable one.  
*Source status: Sound professional practice consistent with surveying inspection methodology. Specific reference to RICS Home Survey Standard or RICS Surveys of Residential Property guidance note is likely appropriate. **Specific section reference to be supplied by CBS reviewer.***

**Step 3 — Observation of pattern and distribution — as context for investigation, not as diagnosis**  
Examine and record the pattern, location, width and distribution of the cracking. Crack patterns are an observation that informs what investigation may be needed, not a basis for diagnosing cause. Different patterns may be associated with different possible causes, but an observation alone cannot establish cause.  
*Source status: This is the core professional judgement principle being tested. The distinction between observation and diagnosis is a professional principle; it is not stated in a single authoritative document but is consistent with general professional practice and the professional obligations under the RICS Rules of Conduct. **CBS reviewer to confirm whether any specific RICS technical guidance formally establishes this principle.***

**Step 4 — Building context**  
Gather relevant contextual information: building age, construction type, foundation type (if known), any relevant history (previous surveys, known movement, drainage issues, proximity of trees, recent construction nearby). Building age and construction type are context that may affect which investigations are appropriate; they do not by themselves establish cause or significance.  
*Source status: Sound professional practice. **CBS reviewer to confirm relevant RICS or BRE guidance references.***

**Step 5 — Scope and proportionality of investigation**  
The appropriate next step depends on: the safety assessment; whether the cracking is active or stable; the available evidence about pattern and context; the potential consequences; and the professional's competence. Possible next steps range from monitoring (appropriate only where the situation is stable and immediate investigation is not warranted) to specialist structural investigation (appropriate where there is evidence of active movement, distortion, or safety risk). Monitoring is not a default first response.  
*Source status: Professional judgement principle. **CBS reviewer to confirm whether specific RICS guidance addresses monitoring as an investigation tool and the conditions under which it is appropriate.***

**Step 6 — Competence boundary**  
A Building Surveyor providing an initial assessment should recognise when the situation requires referral to a structural engineer or another specialist. Where structural movement is suspected, where active cracking is present in a load-bearing element, or where there is evidence of immediate risk, specialist referral is warranted.  
*Source status: General professional competency obligation under RICS Rules of Conduct and RICS competency requirements. **CBS reviewer to confirm.***

---

#### C1.4 Critical errors — automatic failure

The following must cause the response to fail the test regardless of other qualities:

| Error | Basis |
|---|---|
| States a specific named cause (subsidence, heave, thermal movement, settlement) from a crack pattern description alone, without qualification and without identifying what investigation would be needed to support the conclusion | PJ2 — inference discipline |
| Recommends monitoring as the first or unconditional response before any assessment of safety, activity or potential risk | PJ5 — proportionality |
| Recommends specific repair work before investigation of the cause | PJ8 — recommendation support |
| Presents crack width thresholds as definitive clinical indicators of structural significance | PJ2 / PJ7 — the thresholds in professional guidance are contextual, not absolute |
| Fails entirely to address whether any immediate safety concern is present | PJ4 — safety |

---

#### C1.5 Acceptable differences

The following differences in approach are acceptable and must not constitute a failure:

- Order in which the considerations are introduced, provided safety is addressed
- Level of technical detail about crack types, provided no unjustified diagnosis is made
- Whether specific investigative techniques (tell-tales, level survey, drain survey) are mentioned — detail will vary based on what the candidate has said
- Whether the response ends with a follow-up question or closes on guidance
- Exact wording of the professional caution ("may suggest," "can indicate," "is associated with")

---

#### C1.6 Sources required — verification status

| Claimed source | Section/provision | Status |
|---|---|---|
| RICS Home Survey Standard | Inspection methodology and reporting | **UNVERIFIED — specific section to be confirmed by CBS reviewer; document known to exist** |
| RICS Surveys of Residential Property (guidance note) | Building pathology inspection approach | **UNVERIFIED — version and relevant section to be confirmed** |
| BRE technical publications on building pathology | Various | **UNVERIFIED — specific Digest or Good Repair Guide numbers and current status to be confirmed by CBS reviewer** |
| RICS Rules of Conduct (effective 2 February 2022) | Professional obligations re: standards of service | **VERIFIED as a real document; specific rule numbers for APC standards to be confirmed** |
| HSE guidance on inspection | As applicable | **UNVERIFIED — CBS reviewer to confirm whether HSE guidance is a primary reference for this question** |

---

#### C1.7 Sign-off requirements

- [ ] Chartered Building Surveyor to review and confirm expected reasoning (Step 1–6 above)
- [ ] Chartered Building Surveyor to confirm or correct critical error definitions
- [ ] Verified source references with specific section numbers to be supplied before this test is used as a release gate
- [ ] CBS reviewer to confirm whether any additional considerations (asbestos, Japanese knotweed, other concurrent issues) are material to an initial assessment response

**Reviewer name:** *(to be assigned)*  
**Review date:** *(pending)*  
**Approved:** NO

---

### AT-2 — General RICS Ethics: Conflict of Interest

**Review status:** AWAITING QUALIFIED RICS MEMBER REVIEW  
**Approval status:** NOT APPROVED

---

#### C2.1 Candidate question

"What should I consider if I identify a potential conflict of interest?"

---

#### C2.2 Pathway and competency

| Field | Value |
|---|---|
| Competency | Ethics, Rules of Conduct and Professionalism (mandatory, all pathways, Level 3) |
| Jurisdiction | UK (England, Wales, Scotland, Northern Ireland) — RICS obligations apply across UK |
| Note | This test applies to general RICS ethical obligations. It is NOT a valuation-specific question. AT-3 covers the valuation-specific Red Book requirements. Candidates on the Valuation pathway are subject to both. |

---

#### C2.3 Expected professional reasoning

**Step 1 — Identify whether a conflict exists**  
Not every connection or relationship constitutes a conflict of interest. The professional must assess whether a relevant interest, relationship or circumstance exists that compromises, or could reasonably be perceived to compromise, their ability to act professionally and in the client's interest. The assessment is based on the specific circumstances.  
*Source status: Consistent with RICS ethical principles. **Reviewer to confirm whether the RICS conflicts of interest guidance note (global or UK-specific) states this as the primary test.***

**Step 2 — Act promptly on identification**  
When a conflict is identified, the professional must act promptly. The obligation is triggered at the point of identification, not at completion of work or at a convenient later point.  
*Source status: Sound professional practice consistent with RICS obligations. **Specific rule or guidance reference to be confirmed by reviewer.***

**Step 3 — Disclose to affected parties**  
The professional must disclose the conflict to all relevant parties. Disclosure should be made before proceeding, and should be clear enough that the affected parties understand the nature of the conflict and can make an informed decision about how to respond.  
*Source status: Consistent with RICS Rules of Conduct (2021). **Reviewer to confirm specific rule reference and whether written disclosure is explicitly required.***

**Step 4 — Assess whether the conflict can be managed**  
The professional must assess whether the conflict can be genuinely managed or whether it requires declining the instruction. **This is not a binary choice between "decline" and "manage with structural safeguards" — disclosure to all affected parties together with their informed consent to proceed is a legitimate and recognised management mechanism under RICS guidance for many types of conflict. The question is whether the conflict is of a nature and degree that genuine management is possible, and whether all affected parties are fully informed and consenting.**  
*Source status: **CORRECTION FROM AUDIT — the previous draft incorrectly defined disclosure-only management as a critical failure. This must be verified against the specific RICS conflicts of interest guidance note. Reviewer to confirm.***

**Step 5 — Decline where genuine management is not possible**  
Where the conflict is of a nature that genuine management is not possible — for example, simultaneously acting for parties with directly opposing interests in the same transaction without informed consent from all parties, or where a financial interest in the outcome compromises objectivity — the professional should decline the instruction.  
*Source status: Consistent with RICS principles. **Reviewer to confirm whether RICS guidance provides specific examples of conflicts that cannot be managed.***

**Step 6 — Document**  
The professional should document: the nature of the conflict identified; the disclosure made and to whom; the decision taken (proceed with management, or decline); any agreed mitigation steps. Documentation protects the professional and the client.  
*Source status: Sound professional practice. **Reviewer to confirm whether documentation is formally required by RICS Rules of Conduct or is guidance-level good practice.***

---

#### C2.4 Critical errors — automatic failure

| Error | Basis | Verification status |
|---|---|---|
| Omits the requirement to disclose the conflict at all | PJ7 | Verified as a genuine failure — disclosure is a fundamental obligation |
| States that the professional can simply proceed and be "extra careful" or "more objective" without any disclosure or management | PJ7 / PJ8 | Verified as a genuine failure — this bypasses the professional obligation entirely |
| States that a conflict discovered during a matter need not be disclosed because work is already underway | PJ7 | **Reviewer to confirm — the obligation to disclose upon identification appears to continue throughout an instruction, not just at acceptance** |
| States the conflict check is not required if the professional believes they are objective | PJ7 | The test is reasonable perception, not subjective belief — **reviewer to confirm precise standard** |

**CORRECTED from previous draft:** The following is NOT a critical failure:  
~~"States that a conflict can be managed through disclosure alone without structural mitigation"~~  
This is NOT an automatic failure. Disclosure and informed consent of affected parties is a recognised management mechanism. The appropriate response depends on the nature and degree of the conflict.

---

#### C2.5 Acceptable differences

- Whether the response leads with RICS Rules of Conduct or with a practical scenario framing
- Level of detail on specific types of conflict (acting for multiple parties, financial interest, personal relationship)
- Whether Red Book PS 2 is mentioned — this is appropriate for valuation candidates but not required for a general ethics question

---

#### C2.6 Sources required — verification status

| Source | Section/provision | Status |
|---|---|---|
| RICS Rules of Conduct (effective 2 February 2022) | Conflict-related rules — specific rule numbers to be confirmed | **VERIFIED as a real document; specific rule references to be confirmed by reviewer** |
| RICS Global Professional and Ethical Standards (2020) | Five ethical standards; relevance to conflicts | **VERIFIED as real document; specific standard references to be confirmed** |
| RICS Conflicts of Interest guidance note (global and/or UK) | Specific guidance on identification, management, disclosure | **UNVERIFIED — document known to exist; current version, date and specific provisions to be confirmed by reviewer** |
| RICS APC Candidate Guide | How ethics is assessed at APC | **VERIFIED as a real document; APC candidates are assessed on all three levels** |

---

#### C2.7 Sign-off requirements

- [ ] Reviewer with RICS Rules of Conduct familiarity to confirm expected reasoning Steps 1–6
- [ ] Reviewer to confirm or correct critical error definitions, particularly the disclosure-only correction
- [ ] Verified RICS conflicts of interest guidance note version and relevant provisions to be supplied
- [ ] Reviewer to confirm whether AT-2 and AT-3 should be combined or kept separate for APC purposes

**Reviewer name:** *(to be assigned)*  
**Review date:** *(pending)*  
**Approved:** NO

---

### AT-3 — Valuation-Specific Conflicts and Professional Obligations

**Review status:** AWAITING RICS REGISTERED VALUER REVIEW  
**Approval status:** NOT APPROVED

---

#### C3.1 Candidate question

"A client asks me to value a property where I know the vendor personally. Can I proceed?"

---

#### C3.2 Pathway and competency

| Field | Value |
|---|---|
| Primary pathway | Valuation pathway (and any pathway where Valuation is taken to Level 3) |
| Primary competency | Valuation (Level 3); Ethics, Rules of Conduct and Professionalism (Level 3) |
| Jurisdiction | UK — Red Book is a global standard but this scenario is most likely UK |
| Note | This test applies the Red Book PS 2 requirements specifically. The general RICS ethical obligations in AT-2 also apply but the Red Book adds specific requirements for valuers. |

---

#### C3.3 Expected professional reasoning

**Step 1 — Check before accepting, using the Red Book PS 2 test**  
Under Red Book 2025 PS 2, the valuer must confirm their objectivity and independence before accepting each instruction. This check happens before the instruction is accepted, not after work begins.  
*Source: RICS Valuation — Global Standards 2025, PS 2 "Ethics, competency, objectivity and disclosures." **VERIFIED as the correct current standard and section.***

**Step 2 — Assess whether the personal relationship constitutes a conflict**  
Whether a personal relationship with the vendor constitutes a conflict depends on the nature and closeness of the relationship. A distant or casual professional acquaintance is different from a close family member, a financial associate, or someone with whom the valuer has a continuing financial relationship. **The answer cannot be stated categorically: the professional must assess the specific relationship against the Red Book PS 2 objectivity test.**  
*Source: Red Book 2025 PS 2. **CORRECTION FROM AUDIT — the previous draft incorrectly stated that "a personal relationship with a vendor creates a real risk to actual and perceived independence" as a universal principle. This must be verified against the specific PS 2 guidance. Reviewer (RICS Registered Valuer) to confirm whether PS 2 guidance provides examples or thresholds.***

**Step 3 — Disclose and obtain informed consent if proceeding**  
If the valuer concludes the relationship can be managed, they must disclose it clearly to the client in writing and obtain the client's informed consent before proceeding. The terms of engagement (VPS 4) must record the conflict and the agreed approach.  
*Source: Red Book 2025 PS 2 and VPS 4 (Terms of engagement). **VERIFIED as correct sources.***

**Step 4 — Decline if genuine management is not possible**  
Where the relationship is of a nature that objectivity cannot be maintained or could not reasonably be perceived to be maintained (e.g. a close family member or financial partner), the instruction should be declined. Disclosure alone is not sufficient in such cases.  
*Source: Red Book 2025 PS 2. **CORRECTION FROM AUDIT — the previous draft overstated this principle. The line between manageable and unmanageable conflicts is not defined by a categorical rule; it depends on the specific relationship and circumstances. Reviewer to confirm.***

**Step 5 — Document the decision**  
The valuer must document the conflict identified, the decision made, the disclosure to the client, and the client's response.  
*Source: Red Book 2025 VPS 4 (terms of engagement documentation requirements). **VERIFIED as the correct source.***

---

#### C3.4 Critical errors — automatic failure

| Error | Basis | Verification status |
|---|---|---|
| States the obligation is to check after the valuation is complete rather than before accepting | PJ7 (Red Book VPS 4 and PS 2) | **VERIFIED** |
| States the check is only required if the valuer "feels" conflicted, rather than applying the objectivity/perception test | PJ7 | **Verified in principle — reviewer to confirm precise PS 2 language** |
| Omits disclosure to the client entirely | PJ7 | **VERIFIED** |

**CORRECTED from previous draft:** The following is NOT a universal critical failure:  
~~"Recommends proceeding on the basis of disclosure alone without genuine mitigation"~~  
For some personal relationships, disclosure and client consent IS adequate management. The failure occurs when disclosure is recommended where the relationship is clearly so close that genuine management is impossible.

---

#### C3.5 Sources required — verification status

| Source | Section/provision | Status |
|---|---|---|
| RICS Valuation — Global Standards (Red Book) 2025, effective 31 January 2025 | PS 2 "Ethics, competency, objectivity and disclosures" | **VERIFIED — document confirmed current; specific provisions for conflict and relationship management to be confirmed by Registered Valuer reviewer** |
| Red Book 2025 | VPS 4 "Terms of engagement" — documentation requirements | **VERIFIED as the correct source for engagement terms** |
| RICS guidance on conflicts in valuation | RICS VPGA or supplementary guidance | **UNVERIFIED — whether a specific VPGA or guidance note addresses personal relationships to be confirmed by reviewer** |

---

#### C3.6 Sign-off requirements

- [ ] RICS Registered Valuer to review expected reasoning Steps 1–5
- [ ] Reviewer to confirm whether Red Book PS 2 provides specific guidance on types of personal relationship that constitute a conflict
- [ ] Reviewer to confirm the precise PS 2 objectivity test language
- [ ] Reviewer to confirm whether AT-2 and AT-3 should be run as separate tests or as a combined ethics/valuation test for candidates on the Valuation pathway

**Reviewer name:** *(to be assigned)*  
**Review date:** *(pending)*  
**Approved:** NO

---

### AT-4 — Construction Contracts: Payment Notices and Adjudication

**Review status:** AWAITING CHARTERED QS / CONTRACT LAW PRACTITIONER REVIEW  
**Approval status:** NOT APPROVED

*Note: This test contains a critical factual error identified in the previous audit. The correction is incorporated below but marked as requiring independent verification before the test can be approved.*

---

#### C4.1 Candidate question

"My client wants to withhold payment to a contractor. What should I consider?"

---

#### C4.2 Pathway and competency

| Field | Value |
|---|---|
| Primary pathway | Quantity Surveying and Construction; Project Management; Building Surveying (where contract administration is in scope) |
| Primary competency | Contract Practice (mandatory Level 3 on relevant pathways) |
| Also relevant | Commercial Management (QS pathway Level 3); Procurement and Tendering |
| Jurisdiction | England and Wales — HGCRA applies to England, Wales, Scotland and Northern Ireland but the Scheme provisions differ by jurisdiction. This test is written for England and Wales unless stated otherwise. |

---

#### C4.3 Expected professional reasoning

**Step 1 — Understand what "withholding payment" means in the contractual context**  
A distinction exists between (a) withholding a sum that is otherwise due (applying a set-off or deduction from a notified sum) and (b) a delay in payment of an undisputed sum. These have different contractual and statutory consequences. Establishing which the client intends is a necessary first step.  
*Source status: Contract law and HGCRA 1996 provisions. **Reviewer to confirm appropriate statutory and contractual references.***

**Step 2 — Identify the contractual payment mechanism**  
The contract governs the payment mechanism. Under the Housing Grants, Construction and Regeneration Act 1996 (as amended by the Local Democracy, Economic Development and Construction Act 2009), any construction contract must contain adequate provisions for: an adequate mechanism for determining the sum due; a final date for payment; a requirement for payment notices; and a right to pay less than the notified sum by giving a pay less notice.  
*Source: Housing Grants, Construction and Regeneration Act 1996 s.109–111 (as amended); Local Democracy, Economic Development and Construction Act 2009. **VERIFIED — these are real statutes. Specific section references to be confirmed by reviewer.***

**Step 3 — Pay less notice: requirements and timing**  
To pay less than the notified sum, the paying party must serve a valid pay less notice before the "prescribed period" prior to the final date for payment. The prescribed period depends on the contract — typically 5 days before the final date for payment under JCT contracts, or not less than 7 days before the final date for payment under the Scheme for Construction Contracts (which applies where the contract does not make adequate provision).  
*Source: HGCRA 1996 s.111 (as amended); Scheme for Construction Contracts (England and Wales) Regulations 1998 (SI 1998/649) as amended; JCT Standard Building Contract provisions. **VERIFIED in principle — specific JCT edition and Scheme regulation references to be confirmed by reviewer.***

**Step 4 — Consequence of failing to serve a valid pay less notice**  
If a valid pay less notice is not served within the prescribed period, the full notified sum becomes payable on the final date for payment. The paying party cannot then pay less without exposing themselves to an adjudication claim.  
*Source: HGCRA 1996 s.111 (as amended). **VERIFIED in principle — reviewer to confirm.***

**Step 5 — The right to adjudicate**  
**CORRECTED FROM PREVIOUS DRAFT:** Under s.108 HGCRA 1996 (as amended), either party has the right to refer any dispute arising under the contract to adjudication "at any time." There is no time-limited window within which adjudication must be commenced. A contractor who has not been paid the notified sum can refer the payment dispute to adjudication at any time — including immediately after the final date for payment passes.  
Once a dispute is referred, the adjudicator has 28 days from the date of referral to reach a decision. This period can be extended by 14 days with the consent of the referring party, or by any further period agreed by both parties.  
*Source: HGCRA 1996 s.108 (as amended); Scheme for Construction Contracts, Part I. **THE 28-DAY PERIOD IS THE ADJUDICATOR'S DECISION PERIOD, NOT A REFERRAL WINDOW. The previous draft incorrectly stated "a contractor can refer a payment dispute to adjudication within 28 days." This has been corrected. Independent verification by a QS or solicitor with construction contract experience is required before this test is approved.***

**Step 6 — Professional advice and risk**  
The QS or contract manager should advise the client on: whether a valid pay less notice can still be served (and the time remaining); the basis for withholding and whether it is legally defensible; the risk of adjudication and likely outcome if no valid notice has been served; whether the dispute is better resolved by negotiation or agreement before adjudication is commenced.  
*Source status: Professional practice. **Reviewer to confirm.***

---

#### C4.4 Critical errors — automatic failure

| Error | Basis | Verification status |
|---|---|---|
| States that the contractor has a 28-day window in which to refer the dispute to adjudication | PJ7 — HGCRA s.108 provides the right "at any time" | **CORRECTION FROM AUDIT — must be independently verified before use as a test criterion** |
| States that withholding payment is permissible without serving any form of notice | PJ7 — s.111 HGCRA requires a pay less notice | **VERIFIED in principle — specific reference to be confirmed** |
| Omits the pay less notice mechanism entirely and advises the client to simply withhold | PJ7 / PJ8 | **VERIFIED as a genuine failure** |
| Conflates the adjudicator's decision period (28 days from referral) with the party's window for initiating adjudication | PJ7 | **CORRECTION FROM AUDIT — verified as a genuine failure** |

---

#### C4.5 Note on jurisdictional differences

The Scheme for Construction Contracts is applied differently in Scotland and Northern Ireland. If the candidate's pathway or scenario involves a Scottish or Northern Irish construction contract, the relevant Scheme provisions may differ. This test is written for England and Wales.

---

#### C4.6 Sources required — verification status

| Source | Section/provision | Status |
|---|---|---|
| HGCRA 1996 (as amended by LDEDCA 2009) | ss.108–111 (adjudication; payment; pay less notices) | **VERIFIED as real statutes; specific sub-section references to be confirmed by reviewer** |
| Scheme for Construction Contracts (England and Wales) Regulations 1998 (SI 1998/649, as amended) | Payment provisions; prescribed periods | **VERIFIED as a real SI; specific regulation numbers to be confirmed** |
| JCT Standard Building Contract (current edition) | Payment clause provisions | **UNVERIFIED — current edition and specific clause references to be confirmed by reviewer** |
| NEC4 Engineering and Construction Contract | Payment and adjudication provisions | **UNVERIFIED — reviewer to confirm whether NEC4 provisions are materially different for this test** |

---

#### C4.7 Sign-off requirements

- [ ] Chartered QS or solicitor with construction contract experience to verify the correction to the 28-day adjudication point (Step 5)
- [ ] Reviewer to confirm HGCRA section references and Scheme provisions
- [ ] Reviewer to confirm JCT and NEC4 pay-less notice timing provisions
- [ ] Reviewer to confirm whether the test should distinguish between JCT and NEC4 contract forms

**Reviewer name:** *(to be assigned)*  
**Review date:** *(pending)*  
**Approved:** NO

---

### AT-5 — Health and Safety: Principal Designer Responsibilities

**Review status:** AWAITING CDM PRACTITIONER REVIEW  
**Approval status:** NOT APPROVED

*Note: This test contains two document attribution errors identified in the previous audit. Both corrections are incorporated below but marked as requiring independent verification.*

---

#### C5.1 Candidate question

"I've been asked to be Principal Designer on a project. What does that involve?"

---

#### C5.2 Pathway and competency

| Field | Value |
|---|---|
| Primary pathway | Health and Safety (mandatory, all pathways, Level 2); Project Management pathway (higher detail expected) |
| Primary competency | Health and Safety (all pathways, Level 2 mandatory); for PM pathway, CDM compliance and PD role is a core practice area |
| Jurisdiction | England and Wales. CDM 2015 applies across Great Britain; the Building Safety Act 2022 adds further requirements for higher-risk buildings in England. |

---

#### C5.3 Expected professional reasoning

**Step 1 — Confirm the project meets the CDM 2015 threshold and a Principal Designer appointment is required**  
CDM 2015 applies to all construction work. The Principal Designer appointment is required on projects that are notifiable (more than 30 working days with more than 20 workers simultaneously, or exceeds 500 person-days) or where there is more than one contractor. If the project has only one contractor and is not notifiable, a PD appointment may not be legally required, though best practice may differ.  
*Source: Construction (Design and Management) Regulations 2015 (SI 2015/51), Regulation 5 (client duties for projects with more than one contractor). **CORRECTION NOTE — reviewer to confirm the precise threshold for mandatory PD appointment; the requirement appears linked to projects with more than one contractor under Regulation 5(1)(b), not solely to notifiability. CBS/CDM reviewer to verify.***

**Step 2 — The appointment is the client's duty**  
The duty to appoint a Principal Designer rests with the client (Regulation 5(1)(b)), in writing, as soon as practicable. The professional being asked to act as PD is receiving an instruction from the client, not self-appointing. The correct response is to accept if competent and willing, with appointment documented in writing.  
*Source: CDM 2015 Regulation 5(1)(b). **VERIFIED in principle; specific wording of "as soon as practicable" (not "before design begins" as stated in the previous draft) confirmed.***

**Step 3 — Confirm competence before accepting**  
The PD must have the skills, knowledge and experience to carry out the role. Accepting an appointment without the competence to carry it out is a professional obligation issue. For higher-risk buildings (as defined under the Building Safety Act 2022), additional competency requirements apply.  
*Source: CDM 2015 Regulation 5(3); Building Safety Act 2022 and associated regulations for higher-risk buildings. **VERIFIED in principle — reviewer to confirm precise CDM 2015 regulation number and whether the Building Safety Act 2022 provisions have changed the competency requirements for all PD appointments or only higher-risk buildings.***

**Step 4 — Core PD duties during the pre-construction phase**  
The Principal Designer's primary duties are during the pre-construction phase (Regulation 11):  
- Plan, manage, monitor and coordinate health and safety during the pre-construction phase (Regulation 11(1))  
- Identify, eliminate or control foreseeable risks to health and safety arising from design (Regulation 11(2))  
- Ensure designers comply with their duties under Regulations 8 and 9, so far as within the PD's control (Regulation 11(6))  
- Assist the client in the provision of pre-construction information and ensure it is provided to designers and contractors (Regulation 11(3))  

**CORRECTION — Pre-construction information:** The primary legal duty to ensure pre-construction information is provided rests with the **client** (Regulation 4(4)). The Principal Designer's duty is to assist the client (Regulation 11(3)), not to bear primary legal responsibility for it. This distinction matters for APC candidates who need to advise clients accurately on their duties.  
*Source: CDM 2015 Regulations 4(4) and 11(1)–(6). **VERIFIED in principle — reviewer to confirm specific regulation references.***

**Step 5 — Liaison with the Principal Contractor**  
During the construction phase, the PD must liaise with the Principal Contractor on matters concerning health and safety and must cooperate with the PC on any design work occurring during the construction phase (Regulation 11(4)).  
*Source: CDM 2015 Regulation 11(4). **VERIFIED in principle.***

**Step 6 — The health and safety file**  
The Principal Designer is responsible for preparing, reviewing and updating the health and safety file during the pre-construction and construction phases, and for passing it to the client at the end of the project (Regulation 11(5)).  
**CORRECTION — Document confusion:** The health and safety file is the Principal Designer's document. The **construction phase plan** is prepared and maintained by the **Principal Contractor** (Regulation 12). These are distinct documents with distinct owners. The previous draft incorrectly stated the PD's duty continues "until the construction phase plan is complete." This was wrong. **Reviewer to verify.***  
*Source: CDM 2015 Regulations 11(5) (PD — health and safety file) and 12 (PC — construction phase plan). **VERIFIED in principle — reviewer to confirm specific regulation references.***

---

#### C5.4 Critical errors — automatic failure

| Error | Basis | Verification status |
|---|---|---|
| States the construction phase plan is the Principal Designer's document | PJ7 — CDM 2015 Reg 12; construction phase plan belongs to the Principal Contractor | **CORRECTION FROM AUDIT — must be independently verified** |
| States the primary duty to provide pre-construction information rests with the Principal Designer rather than the client | PJ7 — CDM 2015 Reg 4(4) places this duty on the client | **CORRECTION FROM AUDIT — must be independently verified** |
| States the PD's duties are complete once the construction phase begins with no reference to the health and safety file | PJ7 — PD retains health and safety file responsibility through the project | **Verified in principle — reviewer to confirm** |
| Conflates the PD role with the Principal Contractor role (e.g., states the PD is responsible for managing the construction phase) | PJ7 | **Verified as a genuine failure** |
| States the appointment can be made after design work is substantially complete | PJ7 — appointment should be "as soon as practicable" | **Verified in principle — reviewer to confirm** |

---

#### C5.5 Note on higher-risk buildings

The Building Safety Act 2022 and associated secondary legislation introduce additional competency and regulatory requirements for Principal Designers on higher-risk buildings (defined by height and occupancy). APC candidates on Building Surveying or Project Management pathways may encounter these requirements. The test case as drafted applies to a generic construction project. A separate test case for higher-risk building projects may be needed once the Building Safety Act 2022 requirements have been reviewed.

---

#### C5.6 Sources required — verification status

| Source | Section/provision | Status |
|---|---|---|
| Construction (Design and Management) Regulations 2015 (SI 2015/51) | Regulations 4 (client duties), 5 (appointments), 11 (PD duties), 12 (PC duties) | **VERIFIED as a real instrument; specific sub-regulation text to be confirmed by CDM reviewer** |
| HSE L153 "Managing Health and Safety in Construction" (CDM 2015 guidance) | PD duties section | **VERIFIED as the primary HSE guidance document for CDM 2015; current edition and specific section to be confirmed** |
| Building Safety Act 2022 | Higher-risk building competency requirements | **VERIFIED as a real Act; scope of effect on PD competency requirements to be confirmed** |
| RICS CDM guidance for surveying professionals | As applicable | **UNVERIFIED — whether a specific current RICS guidance note addresses PD role to be confirmed** |

---

#### C5.7 Sign-off requirements

- [ ] CDM practitioner (e.g., RICS member with CDM experience or Principal Designer professional) to verify Steps 1–6
- [ ] Reviewer to confirm corrections to construction phase plan / health and safety file document attribution
- [ ] Reviewer to confirm correction to pre-construction information duty attribution
- [ ] Reviewer to confirm appointment timing provisions and the specific Regulation 5 threshold
- [ ] Reviewer to advise whether a separate higher-risk building test case is required

**Reviewer name:** *(to be assigned)*  
**Review date:** *(pending)*  
**Approved:** NO

---

## Part D — Acceptance Process

### D1. For each test, what can be checked objectively

The following can be checked by examining the response text without professional judgement:

| Check | Method |
|---|---|
| Does the response state a specific named cause for a building defect from pattern alone without qualification? | Text scan for "[pattern description] indicates/means/is caused by [specific cause]" without qualifying language |
| Does the response state the adjudication referral window is 28 days? | Text scan for "28 day" adjacent to "refer" or "adjudication" |
| Does the response attribute the construction phase plan to the Principal Designer? | Text scan |
| Does the response apply 2022 Red Book VPS numbering rather than 2025? | Text scan for "VPS 1 (Terms of engagement)" or similar 2022 numbering |
| Does the response recommend monitoring as the first unconditional step before any safety or activity assessment? | Text scan for "monitoring" or "monitor" in the first response paragraph without preceding safety or activity qualification |
| Does the response attribute the primary duty for pre-construction information to the PD rather than the client? | Text scan |
| Does the response omit any mention of safety entirely when addressing a potentially hazardous defect? | Text scan for absence of safety-related language |

### D2. What requires qualified professional judgement

The following require a qualified reviewer to assess:

- Whether the level of qualification on a causal association is appropriate for the professional context
- Whether the described investigation steps are proportionate to the specific circumstances
- Whether a conflict of interest as described can legitimately be managed through disclosure and consent
- Whether the professional reasoning is coherent and correctly prioritised
- Whether the balance of technical detail is appropriate for the pathway and competency level described

### D3. What constitutes a material technical or professional failure

A response fails the test when it:
- States a mandatory professional requirement inaccurately (wrong document, wrong party, wrong timing)
- Presents a specific causal conclusion without the evidence to support it
- Omits a clearly relevant professional obligation (disclosure of conflict, safety assessment, pay less notice)
- Recommends an action the evidence does not support (specific repair before investigation, monitoring before activity assessment)
- Conflates two distinct documents, obligations or roles

A response does not fail solely because it:
- Uses qualifying language
- Follows a conversational format
- Contains the phrase "professional judgement"
- Is shorter than expected

### D4. Evidence required before a test can be approved

A test may not be used as a release gate until:
- At least one qualified professional in the relevant competency area has reviewed the expected reasoning
- That reviewer has confirmed or corrected the critical failure definitions
- Verified source references with specific section numbers have been supplied for all authoritative claims
- Any "CORRECTION FROM AUDIT" items have been independently verified against the actual source document
- The reviewer has signed the test off in the sign-off section

### D5. Maintenance when standards change

Each test references dated sources. The following events should trigger a test review:
- A new edition of a cited standard is published (Red Book, CDM guidance, RICS Rules of Conduct, JCT contract edition)
- A relevant statute is amended
- RICS issues new or updated guidance on a covered topic
- A test produces a systematic unexpected result — the test rubric should be reviewed, not just the prompt

Responsibility for monitoring these triggers should be assigned to a named person or role before the quality gate is put into production.

---

## Part E — Source Evidence Register

| Source | Version / date | Publisher | Jurisdiction | Status |
|---|---|---|---|---|
| RICS Rules of Conduct | Effective 2 February 2022 | RICS | UK | Verified as real document; specific rule numbers for conflicts to be confirmed |
| RICS Global Professional and Ethical Standards | 2020 | RICS | Global | Verified as real document; specific standards to be confirmed |
| RICS conflicts of interest guidance note | Unknown — to be confirmed | RICS | Global and/or UK | **UNVERIFIED — reviewer to supply current version and date** |
| RICS Valuation — Global Standards (Red Book) | 2025, effective 31 January 2025 | RICS | Global | Verified; PS 2 and VPS 4 confirmed as correct provisions |
| RICS Home Survey Standard | To be confirmed | RICS | UK | **UNVERIFIED — reviewer to supply version, date and relevant section** |
| RICS Surveys of Residential Property (guidance note) | To be confirmed | RICS | UK | **UNVERIFIED — reviewer to supply version and relevant section** |
| BRE technical publications (building pathology) | To be confirmed | BRE | UK | **UNVERIFIED — specific Digest or GRG numbers and current status to be confirmed** |
| Housing Grants, Construction and Regeneration Act 1996 (as amended) | As amended by LDEDCA 2009 | UK Parliament | England, Wales, Scotland, NI | Verified as real statute; specific section references to be confirmed |
| Local Democracy, Economic Development and Construction Act 2009 | 2009 | UK Parliament | England, Wales, Scotland, NI | Verified as real statute |
| Scheme for Construction Contracts (England and Wales) Regulations 1998 | SI 1998/649, as amended | UK Parliament | England and Wales | Verified as real SI; specific regulation references to be confirmed |
| Construction (Design and Management) Regulations 2015 | SI 2015/51 | UK Parliament | Great Britain | Verified as real SI; specific regulation sub-numbers to be confirmed |
| HSE L153 "Managing Health and Safety in Construction" | To be confirmed — current edition | HSE | Great Britain | Verified as primary HSE CDM guidance; current edition to be confirmed |
| Building Safety Act 2022 | 2022 | UK Parliament | England (primarily) | Verified as real Act; scope for PD competency to be confirmed |

---

## Part F — Tests Ready for Professional Review

| Test | Status | Specialist reviewer required |
|---|---|---|
| AT-1 — Brickwork cracking | Ready for Chartered Building Surveyor review — expected reasoning is drafted; sources unverified | Chartered Building Surveyor |
| AT-2 — General ethics/conflicts | Ready for qualified RICS reviewer — critical error corrected in draft; source language unverified | RICS member with Ethics and Rules of Conduct familiarity |
| AT-3 — Valuation conflicts | Ready for RICS Registered Valuer review — corrections incorporated; personal relationship test requires verification | RICS Registered Valuer |
| AT-4 — Payment and adjudication | Ready for QS/contract law review — 28-day adjudication correction incorporated; statutory references unverified | Chartered QS or construction law practitioner |
| AT-5 — CDM / Principal Designer | Ready for CDM practitioner review — construction phase plan and pre-construction info corrections incorporated; regulation references unverified | CDM practitioner or RICS member with PD experience |

**No test is approved for use as a release gate until the relevant reviewer has signed off the content.**

---

*Document location: `docs/qa/pj-acceptance-spec.md`*  
*Not committed. Not deployed.*  
*All outstanding local Michael changes remain on the working tree, uncommitted.*
