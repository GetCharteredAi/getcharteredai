import json, re

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# Module 11B Residential — section content
# ─────────────────────────────────────────────────────────────────────────────
SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Residential is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Residential surveyors work at the point where property meets people's homes — advice given here is rarely abstract to the client receiving it. Whether you're valuing a property for secured lending, managing a block on behalf of leaseholders, or advising on a lease extension, the client is usually a homeowner or occupier for whom the outcome matters personally as well as financially. Assessors expect Residential candidates to demonstrate not just technical competence, but the judgement, currency of knowledge, and professionalism that this responsibility demands — particularly given how fast residential-specific law and regulation moves.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Residential pathway and justify your competency selections</li><li>Apply health and safety principles specific to residential property inspections</li><li>Demonstrate working knowledge of accounting principles as they apply to Residential practice</li><li>Identify and use the data sources and professional tools relied on by Residential practitioners</li><li>Apply RICS client care standards to residential client relationships</li><li>Explain how a residential practice plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to residential scenarios</li><li>Discuss sustainability considerations specific to residential property</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Residential practice."
  },
  {
    "h": "11B.2 The Residential Pathway: Structure and Competency Selection",
    "body": "The Residential pathway is broad-based, covering the full range of residential property work — investment, landlord and tenant, lettings, planning and development, residential management, purchase and sale, valuation, and survey work carried out under the RICS Home Survey Standard.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competencies:</strong> two to Level 3 and two to Level 2, of which you must select Inspection, Measurement, and Valuation to at least Level 2 — chosen from: Building pathology, Housing maintenance/repairs and improvements, Housing management and policy, Housing strategy and provision, Inspection, Leasing/letting, Legal/regulatory compliance, Market appraisal, Measurement, Property management, Purchase and sale, Valuation.<br><br><strong>Optional competencies:</strong> two to Level 3 and one to Level 2 from a broad list including Auctioneering, Capital taxation, Compulsory purchase and compensation, Conflict avoidance (or Sustainability), Data management, Development appraisals, Environmental assessments, Indirect investment vehicles, Investment management, Land use and diversification, Landlord and tenant, Loan security valuation, Local taxation/assessment, Maintenance management, Planning and development management, Procurement and tendering, Property finance and funding, Risk management, Spatial planning policy and infrastructure, Strategic real estate consultancy, and Supplier management — plus one further competency to Level 2 from the full technical list.<br><br>A note worth remembering: if you wish to become an RICS Registered Valuer, you must choose Valuation to Level 3 specifically — this isn't optional if that designation matters to your career plans.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive. Candidates working in a mixed property environment may gain up to 30% of their experience in a commercial or rural property context.<br><br><em>Source: RICS Residential Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Residential candidates, Level 3 means being able to advise a client with the confidence and judgement of a senior colleague on a genuinely consequential decision affecting their home or investment — not simply describing the process involved."
  },
  {
    "h": "11B.3 Health and Safety in Residential Practice",
    "body": "Residential inspections carry familiar property risks, but with a particular emphasis on lone working, since Residential surveyors frequently visit unfamiliar properties alone, often to meet vendor, purchaser, or occupier availability.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Control of Asbestos Regulations — relevant to any pre-2000 residential building, particularly loft spaces and older service installations</li><li>Electricity at Work Regulations — relevant where visible electrical installations are assessed as part of an inspection</li><li>Occupiers' Liability Act — relevant to risks encountered in a client's or occupier's home during inspection</li></ul><strong>Practical application for Residential surveyors:</strong><br>Before any inspection, a competent surveyor assesses property-specific risks — an occupied home with an unpredictable occupant, a vacant property with uncertain condition, or a rural property with limited signal and no immediate help nearby all carry different risk profiles. Lone working is close to universal in residential inspection work, making a properly briefed lone-working policy — check-in protocols, shared location and timing information, a clear escalation route if contact is lost — essential professional discipline.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered in your own residential work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Residential Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and Residential practice brings that knowledge into focus around service charge accounts, client money, and property finance.<br><br><strong>Core areas relevant to Residential candidates:</strong><ul><li><strong>Client money handling</strong> — RICS Client Money Protection scheme requirements, particularly relevant where rent, deposits, or service charge funds are handled on behalf of landlords or leaseholders</li><li><strong>Service charge accounting</strong> — understanding recoverable versus irrecoverable costs, and the reconciliation process for residential blocks, including statutory requirements around service charge demands and consultation</li><li><strong>Reading accounts for lettings and investment work</strong> — understanding a landlord or investor client's financial position where relevant to advice given</li><li><strong>Property finance basics</strong> — understanding mortgage and secured lending structures relevant to residential valuation work</li></ul><strong>Practical application:</strong><br>A Residential surveyor managing a block of flats needs to understand what is and isn't a recoverable service charge cost, and how to handle a leaseholder's formal challenge to a service charge demand — a frequent source of dispute in residential property management, and one that tests both accounting knowledge and client care skill together."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Residential Practice",
    "body": "Residential practice draws on data sources spanning valuation, market appraisal, and legal/regulatory compliance.<br><br><strong>Core data sources:</strong><ul><li><strong>HM Land Registry</strong> — title, ownership, and sold price data</li><li><strong>Rightmove, Zoopla and similar portals</strong> — market listing and comparable evidence, alongside their known limitations (asking prices, not always achieved prices)</li><li><strong>VOA (Valuation Office Agency)</strong> — council tax band data</li><li><strong>RICS Home Survey Standard</strong> — the current framework governing survey levels and reporting requirements</li><li><strong>Automated Valuation Models (AVMs)</strong> — increasingly used in residential lending, alongside an understanding of their limitations</li><li><strong>Local authority and Land Registry planning/title records</strong> — relevant to purchase, sale, and development advice</li></ul><strong>Practical application:</strong><br>When preparing a market appraisal or valuation, a Residential surveyor should be able to explain the limitations of the data relied on — an AVM output, for example, may be a useful sense-check but shouldn't substitute for an inspection-led valuation where the purpose requires one. Assessors want to see that you understand which data source is fit for which purpose, not just that you gathered data."
  },
  {
    "h": "11B.6 Client Care in Residential Practice",
    "body": "RICS client care standards apply to every pathway, but Residential work frequently involves first-time or occasional clients — homeowners, small landlords, individual leaseholders — who may have little prior experience of professional property advice, alongside more sophisticated repeat clients such as institutional investors or managing agents.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement, agreed and confirmed in writing before work begins, explained in terms an inexperienced client can genuinely understand</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures and clear communication about what a report will and won't cover</li><li>Managing expectations proactively, particularly where a valuation, survey finding, or legal position is likely to disappoint the client</li></ul><strong>Practical application:</strong><br>A common Residential scenario at interview: a client is unhappy that a survey identified defects they weren't expecting, or that a valuation came in below their expectations. Good client care here means explaining your findings and methodology clearly and professionally, in plain language, without being pressured into softening a position that isn't supported by the evidence. Assessors want to see that you can communicate difficult findings with genuine empathy while maintaining professional independence."
  },
  {
    "h": "11B.7 Business Planning in Residential Practice",
    "body": "Whether you work for an estate agency, a residential management company, a valuation firm, or in-house, RICS expects every candidate to understand how their business sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee income models specific to Residential — fixed fees for valuation and survey work, percentage-based fees for sales and lettings transactions, and management fees for property management instructions</li><li>Resourcing and capacity planning — particularly relevant given the often high-volume, time-pressured nature of residential valuation and survey instructions</li><li>Managing conflicts of interest that can arise from percentage-based sales fees, where the fee basis could create pressure to favour one outcome over another</li><li>Marketing and business development — how residential practices win and retain instructions in a competitive, often locally-driven market</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your firm manages capacity during high-demand periods (e.g. a busy spring property market), and how percentage-based fee conflicts are managed and disclosed to clients. Assessors are testing commercial and ethical awareness together."
  },
  {
    "h": "11B.8 Conflict Avoidance in Residential Practice",
    "body": "Residential work generates a distinctive pattern of dispute — landlord and tenant relationships, leaseholder and freeholder relationships, and service charge disputes are all common, often involving parties without legal representation.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common Residential dispute scenarios — service charge challenges, disputes over survey findings, landlord and tenant disagreements, and leasehold enfranchisement disputes</li><li>The dispute resolution ladder: negotiation → mediation → First-tier Tribunal (Property Chamber) or equivalent → court proceedings as a last resort</li><li>Conflicts of interest specific to Residential — for example, acting for both a managing agent and individual leaseholders, or having a fee structure that could incentivise a particular sale outcome</li></ul><strong>Practical application:</strong><br>A frequent scenario: a leaseholder formally disputes a service charge demand. Assessors want you to explain how you would investigate and respond to the challenge, when and how to escalate to the First-tier Tribunal if it can't be resolved by agreement, and how to keep the wider group of leaseholders fairly informed throughout — not just resolve the individual complaint in isolation."
  },
  {
    "h": "11B.9 Sustainability in Residential Practice",
    "body": "Sustainability is increasingly central to residential property value, marketability, and regulatory compliance.<br><br><strong>Key areas:</strong><ul><li><strong>EPC ratings</strong> — their role in marketing, mortgage lending decisions, and increasingly minimum standards for let residential property</li><li><strong>Energy efficiency improvements</strong> — retrofit measures, their cost, and their effect on marketability and value</li><li><strong>Sustainability in survey and valuation reporting</strong> — RICS guidance increasingly expects sustainability factors to be considered and commented on where relevant</li><li><strong>Client understanding and expectations</strong> — many residential clients have limited technical understanding of sustainability measures, requiring clear, accessible explanation rather than technical jargon</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would advise a client on the value or marketability impact of a poor EPC rating, and how you would explain retrofit options and their likely cost-benefit in plain, accessible terms. Assessors are testing whether you can translate technical sustainability knowledge into genuinely useful client advice, not just recite regulatory requirements."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Residential — a disappointed client challenging a valuation or survey finding, a service charge dispute, a lease extension enquiry, a sustainability-driven client conversation — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on leasehold or dispute scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Residential-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Residential pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>A client is unhappy that your valuation came in below their expectations. How would you handle this conversation, consistent with RICS client care standards?</li><li>A leaseholder formally disputes a service charge demand. How would you investigate and respond, and when would you escalate to the First-tier Tribunal?</li><li>Explain the limitations of an Automated Valuation Model, and when it would and wouldn't be appropriate to rely on one.</li><li>Outline the health and safety considerations you would apply before conducting a lone inspection of an occupied residential property.</li><li>A property you're valuing has a poor EPC rating. How would you advise the client on the impact this could have on value and marketability?</li><li>Explain how a percentage-based sales fee could create a conflict of interest, and how you would manage and disclose it.</li><li>A client asks whether they should proceed now with a lease extension or wait for anticipated legislative reform. How would you advise them?</li><li>Describe the recoverable versus irrecoverable cost distinction in residential service charge accounting, and why this matters.</li><li>How would your firm manage capacity during a period of high demand, such as a busy spring property market?</li><li>Explain the current requirements of the RICS Home Survey Standard and how you would advise a client on which level of survey is appropriate for their circumstances.</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Residential",
  "h": "12.16 Leasehold and Freehold Reform Act 2024 Currency Test — Residential Pathway",
  "body": "<strong>A leaseholder client asks whether they should proceed now with a Section 42 lease extension under current law, or wait for the anticipated changes under the Leasehold and Freehold Reform Act 2024. Talk me through how you would advise them.</strong><br><br><em>Tests: Legal/regulatory compliance, Client care, Communication and negotiation. Increasingly common given ongoing leasehold reform.</em><br><br><strong>The model answer</strong> treats this as a currency-of-knowledge test as much as a legal one — the correct answer requires knowing precisely which parts of the 2024 Act are actually in force today, not just that reform is happening.<br><br><strong>Key elements:</strong><br><br><strong>1. Current law still governs the calculation.</strong> As things stand, a Section 42 lease extension premium is still calculated under the unamended Leasehold Reform, Housing and Urban Development Act 1993 — including marriage value where the unexpired term is below 80 years. The 2024 Act's abolition of marriage value and move to 990-year extensions is not yet in force.<br><br><strong>2. What has actually changed already.</strong> The two-year ownership rule was removed in January 2025 — a leaseholder no longer has to wait two years after purchase before serving a lease extension or enfranchisement notice. That's a real, current change worth confirming with the client, since some clients (or their other advisers) may still assume the old rule applies.<br><br><strong>3. What hasn't commenced yet, and why.</strong> The headline reforms — marriage value abolition and standardised valuation rates — require a government consultation on the replacement rates, resolution of identified technical flaws in the Act via further primary legislation, and the outcome of an ongoing Court of Appeal challenge from freeholder groups. None of that has concluded.<br><br><strong>4. No credible timeline exists.</strong> Government statements point to these provisions being switched on once the technical and valuation-rate issues are resolved, but practitioner commentary consistently suggests this is unlikely before late 2026 at the earliest, with many expecting 2027–2028. Giving a client a confident prediction here would be professionally reckless.<br><br><strong>5. The genuine trade-off to explain.</strong> Proceeding now gives certainty under known rules and stops the lease term running down further (relevant if it's approaching the 80-year marriage value threshold). Waiting risks years of delay for a benefit that isn't guaranteed to materialise on any particular timeline, or in the form currently proposed.<br><br><strong>6. Document the advice given.</strong> Given the genuine uncertainty and the fact the client may feel differently about the outcome depending on how legislation develops, the advice given — and that it was based on the position as it stood at the time — should be clearly recorded.<br><br><strong>How to frame this:</strong><br><br><em>I explained that the premium calculation today still includes marriage value under current law, and that the abolition isn't yet in force.</em><br><br><em>I confirmed the two-year ownership rule no longer applies, since that's a genuine change already in effect that some clients aren't aware of.</em><br><br><em>I gave the client the current factual position and the genuine uncertainty around timing, rather than guessing when or whether the reform would come into force.</em><br><br><strong>Three things assessors tick:</strong> 1) correctly distinguishing what's actually in force from what's merely proposed, 2) resisting the temptation to predict legislative timing with false confidence, 3) documenting the advice clearly given the genuine uncertainty involved.<br><br><strong>Leasehold reform is one of the most talked-about topics in residential property right now — and one of the easiest to get wrong by assuming proposed changes are already law. Assessors are testing whether you actually know the difference.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":27,"num":"11B","title":"Residential Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#db2777",'
    '"intro":"Residential practice puts professional advice at the heart of decisions that matter most to clients — their homes, their investments, their leaseholds. This module sharpens every mandatory competency through the specific lens of Residential work, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:27 after id:26 closing brace
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":26,"num":"11B"'
assert html.count(old1) == 1
idx26 = html.index(old1)
close_idx = html.index('}];', idx26)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:27 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars — _m11bRes and _isResDash
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bInfra = MODULES.find(m => m.id === 26);"
new2 = ("const _m11bInfra = MODULES.find(m => m.id === 26);\n"
        "const _m11bRes = MODULES.find(m => m.id === 27);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isInfraDash = _m11bInfra && _dashPathway === 'Infrastructure' && plan !== 'sprint';"
new2b = ("const _isInfraDash = _m11bInfra && _dashPathway === 'Infrastructure' && plan !== 'sprint';\n"
         "const _isResDash = _m11bRes && _dashPathway === 'Residential' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain — extend with _isResDash
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isInfraDash ? [..._base.filter(m => m.id <= 11), _m11bInfra, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isInfraDash ? [..._base.filter(m => m.id <= 11), _m11bInfra, ..._base.filter(m => m.id >= 12)]"
        " : _isResDash ? [..._base.filter(m => m.id <= 11), _m11bRes, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip — add Residential branch
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Infrastructure' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:26, code:'11B', label:'Infrastructure pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Infrastructure' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:26, code:'11B', label:'Infrastructure pathway prep'});\n"
        "    } else if (_stripPathway === 'Residential' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:27, code:'11B', label:'Residential pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars — add _isRes
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isInfra = _p === 'Infrastructure' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isInfra = _p === 'Infrastructure' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isRes = _p === 'Residential' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks — id:27, id:11+_isRes, id:12+_isRes
# ─────────────────────────────────────────────────────────────────────────────
# 6a: id===27 after id===26
old6a = ("        } else if (id === 26) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 26) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 27) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

# 6b: id===11 && _isRes after id===11 && _isInfra
old6b = ("        } else if (id === 11 && _isInfra) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(26, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(26)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isInfra) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(26, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(26)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRes) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(27, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(27)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

# 6c: id===12 && _isRes after id===12 && _isInfra
old6c = ("        } else if (id === 12 && _isInfra) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(26)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isInfra) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(26)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isRes) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(27)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:27, id:11+_isRes, id:12+_isRes)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label — add m.id === 27
# ─────────────────────────────────────────────────────────────────────────────
old7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26"
new7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26 || m.id === 27"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked — guard for modId === 27
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 26) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Infrastructure') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 26) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Infrastructure') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 27) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Residential') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1, f"Change 8: {html.count(old8)}"
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:27 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after Infrastructure section
# ─────────────────────────────────────────────────────────────────────────────
infra_end = 'not a commercial negotiation.</strong>"},{"pathwayOnly":"Project Management"'
assert html.count(infra_end) == 1, f"Change 9 anchor: {html.count(infra_end)}"
html = html.replace(
    infra_end,
    'not a commercial negotiation.</strong>"},' + m12_section_json + ',{"pathwayOnly":"Project Management"'
)
print("Change 9: M12 Residential pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":27' in html
assert '"Residential Pathway — Professional Practice' in html
assert '"pathwayOnly":"Residential"' in html
assert 'modId === 27' in html
assert '_isRes =' in html
assert '_isResDash' in html
assert 'm.id === 27' in html
assert "id:27, code:'11B'" in html
print("All assertions passed ✓")
