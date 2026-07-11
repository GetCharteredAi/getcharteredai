import json, re

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# Module 11B Infrastructure content
# All section bodies converted from markdown to HTML (no outer container)
# ─────────────────────────────────────────────────────────────────────────────
SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": """Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Infrastructure is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Infrastructure surveyors work across some of the largest, longest-running, and most technically complex projects in the built environment — transport, energy, water, and resources schemes that combine engineering complexity with high-value commercial and contractual risk. Assessors expect Infrastructure candidates to demonstrate not just technical fluency in cost, procurement, and programme management, but the professionalism, commercial judgement, and stakeholder awareness that a client relies on when delivering a project that may take years and involve dozens of parties.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Infrastructure pathway and justify your competency selections</li><li>Apply health and safety principles specific to infrastructure projects and sites</li><li>Demonstrate working knowledge of accounting principles as they apply to Infrastructure practice</li><li>Identify and use the data sources and professional tools relied on by Infrastructure practitioners</li><li>Apply RICS client care standards to infrastructure client relationships, including complex pluralistic clients</li><li>Explain how an infrastructure consultancy or delivery team plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to infrastructure contractual scenarios</li><li>Discuss sustainability considerations specific to infrastructure practice</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Infrastructure practice."""
  },
  {
    "h": "11B.2 The Infrastructure Pathway: Structure and Competency Selection",
    "body": """The Infrastructure pathway covers the global delivery of projects across transport, energy, petrochemicals, oil and gas, mining and resources, and water — fusing project and cost management competencies to reflect the specific demands of infrastructure delivery from inception to post-completion.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core Infrastructure competency</strong> (mandatory, Level 3):<ul><li>Engineering science and technology</li></ul><strong>Plus four further competencies to Level 3, chosen from:</strong><br>Client care, Contract practice, Cost prediction and analysis, Procurement and tendering, Programming and planning, Project controls, Quantification, costing and price analysis, Risk management.<br><br><strong>Optional competencies:</strong> two to Level 2 from the full technical list not already chosen from the core list — including Asset management, BIM management, Compulsory purchase and compensation, Conflict avoidance/management and dispute resolution procedures (or Sustainability), Contract administration, Cross cultural awareness in a global business, Leading projects/people and teams, Managing projects, Project finance, Stakeholder management, and Supplier management — plus one further competency to Level 2 from the full list, including any not already chosen.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive.<br><br><em>Source: RICS Infrastructure Pathway Guide, cross-checked against the current live RICS sector pathways listing — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Infrastructure candidates, Level 3 means being able to advise a client on a genuinely complex, multi-party infrastructure decision with the same judgement and confidence you'd expect from a senior colleague — not simply describing the process involved."""
  },
  {
    "h": "11B.3 Health and Safety in Infrastructure Practice",
    "body": """Infrastructure projects carry health and safety exposure on a different scale to most other pathways — live transport corridors, energy sites, deep excavations, and major civil works, often running over years with a constantly changing site population.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Construction (Design and Management) Regulations (CDM) — of particular relevance on infrastructure schemes, given the scale of design coordination and the number of parties typically involved</li><li>Sector-specific regulation — depending on the field (e.g. rail industry safety standards, or process safety regulation on energy and petrochemical sites)</li><li>Confined spaces and excavation-specific regulations — highly relevant to below-ground infrastructure works</li></ul><strong>Practical application for Infrastructure surveyors:</strong><br>Before engaging with any site, a competent Infrastructure practitioner checks the project's specific health and safety management plan, understands sector-specific hazards (live rail possessions, energy site permit-to-work systems, confined space entry procedures), and recognises that infrastructure sites often involve multiple contractors and a constantly changing workforce, making clear coordination and communication of site rules essential.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered in your own infrastructure work — not recite the regulations in the abstract."""
  },
  {
    "h": "11B.4 Accounting Principles in Infrastructure Practice",
    "body": """Every RICS member needs a working grasp of accounting principles, and Infrastructure practice brings that knowledge into focus around large-scale project cost and funding structures.<br><br><strong>Core areas relevant to Infrastructure candidates:</strong><ul><li><strong>Project finance structures</strong> — understanding how infrastructure projects are often funded through blended public/private finance models, and how this affects cost reporting and financial governance</li><li><strong>Client money and fee handling</strong> — RICS Client Money Protection requirements where applicable, and understanding appropriate fee structures for infrastructure consultancy work</li><li><strong>Whole-life cost accounting</strong> — reading and interpreting whole-life cost models, including discounting and net present value concepts</li><li><strong>Understanding client financial governance</strong> — many infrastructure clients are public sector or regulated utilities with formal financial approval and reporting requirements that shape how cost information must be presented</li></ul><strong>Practical application:</strong><br>An Infrastructure surveyor advising a client on a major scheme needs to understand how the client's financial governance structure (e.g. a public sector business case approval process, or a regulated utility's price control framework) shapes the format and timing of cost reporting required — not just produce a technically accurate cost report in isolation from how the client actually needs to use it."""
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Infrastructure Practice",
    "body": """Infrastructure practice draws on a distinct set of data sources reflecting its technical and large-scale nature.<br><br><strong>Core data sources:</strong><ul><li><strong>Sector-specific cost databases</strong> — benchmarking data specific to transport, energy, and water infrastructure, often held in-house or through specialist industry data-sharing arrangements</li><li><strong>BCIS and general construction cost data</strong> — used alongside sector-specific sources for elements common to general construction</li><li><strong>BIM models and information exchange platforms</strong> — increasingly central to infrastructure design coordination and cost/quantity extraction</li><li><strong>RICS professional guidance</strong> — including guidance relevant to cost prediction, whole-life costing, and project controls</li><li><strong>Government and regulatory guidance</strong> — relevant to publicly funded or regulated infrastructure, including business case frameworks and regulatory price control methodologies</li></ul><strong>Practical application:</strong><br>When benchmarking cost for an infrastructure scheme, a surveyor should be able to explain why a specific data source was used and its limitations — sector-specific data may be more directly comparable but less transparent in its assumptions, while general construction data may be more accessible but less representative of infrastructure-specific cost drivers (ground conditions, specialist plant, regulatory compliance costs).<br><br>At Level 3, you're expected to weigh and reconcile data from multiple sources to reach a defensible position, particularly given how much of infrastructure cost data is proprietary or sector-restricted."""
  },
  {
    "h": "11B.6 Client Care in Infrastructure Practice",
    "body": """RICS client care standards apply to every pathway, but Infrastructure work frequently involves pluralistic clients — government departments, utility companies, or major corporates with multiple internal stakeholders whose priorities don't always align.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement, agreed and confirmed in writing before work begins, including an agreed process for handling instructions from multiple internal client stakeholders</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures, appropriate to the scale and nature of infrastructure instructions</li><li>Proactive, structured communication appropriate to long-running, multi-year infrastructure projects, where clients expect regular formal reporting rather than ad hoc updates</li></ul><strong>Practical application:</strong><br>A common Infrastructure scenario at interview: a pluralistic client's internal stakeholders give you conflicting priorities or instructions. Good client care here means actively facilitating a resolution — clarifying instructions in writing, escalating where necessary to secure a single coherent client position — rather than simply proceeding on the most recent or most senior-sounding instruction received."""
  },
  {
    "h": "11B.7 Business Planning in Infrastructure Practice",
    "body": """Whether you work for a large multidisciplinary firm, a specialist infrastructure consultancy, or in-house for a client organisation, RICS expects every candidate to understand how their business sustains itself commercially on infrastructure work.<br><br><strong>Core areas:</strong><ul><li>Fee income models specific to infrastructure — often fixed fee or resource-based fees for long-running instructions, given the scale and duration of typical projects</li><li>Resourcing and capacity planning — infrastructure instructions often run over years and require careful long-term resource planning, including managing team continuity across a long project lifecycle</li><li>Risk management at the business level — professional indemnity insurance considerations given the scale and value typically involved in infrastructure advice</li><li>Framework and repeat-client relationships — many infrastructure consultancies operate under long-term frameworks with regulated utilities or government bodies, which shapes business planning differently to one-off instructions</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your team resources a long-running infrastructure instruction and maintains continuity of knowledge and relationships over a multi-year project. Assessors are testing commercial awareness — do you understand the business model you work within, not just the technical work you do."""
  },
  {
    "h": "11B.8 Conflict Avoidance in Infrastructure Practice",
    "body": """Infrastructure projects, given their scale, duration, and number of parties, carry substantial dispute risk — and Infrastructure surveyors are frequently at the centre of managing that risk through contract administration.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Early identification of dispute risk — particularly around contractual notice mechanisms (compensation events, extensions of time, variations), which are common flashpoints on infrastructure contracts</li><li>The dispute resolution ladder: negotiation → mediation → adjudication (common under construction contracts) → arbitration or litigation as a last resort</li><li>Conflicts of interest specific to Infrastructure — particularly relevant given long-term framework relationships, where a consultant may act for a client across multiple related instructions</li></ul><strong>Practical application:</strong><br>A frequent scenario: a contractual notice deadline (such as a compensation event notification) is at risk of being missed. Assessors want you to identify the contractual consequence of missing that deadline, explain how you would manage the situation professionally, and reference the relevant contract mechanism — not simply say the deadline \\"should be met.\""""
  },
  {
    "h": "11B.9 Sustainability in Infrastructure Practice",
    "body": """Sustainability is central to modern infrastructure decision-making — affecting design choices, funding conditions, and whole-life value simultaneously.<br><br><strong>Key areas:</strong><ul><li><strong>Embodied and operational carbon</strong> — a major consideration in infrastructure, given the scale of materials used and the long operational life of most infrastructure assets</li><li><strong>Whole-life carbon assessment</strong> — increasingly required by public sector and regulated infrastructure clients as part of business case approval</li><li><strong>Sustainable materials and construction methods</strong> — including the growing role of offsite fabrication and lower-carbon material alternatives in infrastructure delivery</li><li><strong>Funding and regulatory sustainability conditions</strong> — many infrastructure funding sources (both public and private) now attach sustainability performance conditions to funding approval</li></ul><strong>Practical application:</strong><br>Be ready to discuss how sustainability considerations would inform a specific infrastructure decision — for example, weighing the embodied carbon of a new structure against the operational efficiency gains it might deliver, or explaining how a funding body's sustainability conditions shaped a project's design approach. Assessors are testing whether you treat sustainability as integrated into infrastructure decision-making, not as a separate compliance exercise."""
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": """This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Infrastructure — a pluralistic client conflict, a compensation event notification deadline, a risk-based contingency justification, a sustainability-driven design decision — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the "what would you advise" follow-up, not just "what happened" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on contractual notice mechanics or pluralistic client management, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Infrastructure-specific scenarios before moving to the module assessment."""
  },
  {
    "h": "11B.11 Module Assessment",
    "body": """Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Infrastructure pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>A pluralistic client's internal stakeholders give you conflicting instructions on a major infrastructure scheme. How would you resolve this, consistent with RICS client care standards?</li><li>Explain how you would advise a client on the appropriate procurement route in relation to their attitude to risk on an infrastructure project.</li><li>A contractual notice deadline for a compensation event is at risk of being missed. What would you advise, and what is the contractual consequence of missing it?</li><li>Outline the health and safety considerations specific to a live infrastructure site with a constantly changing contractor population.</li><li>How would you carry out a whole-life costing exercise for a major infrastructure asset, and what are its key limitations?</li><li>Explain the sustainability trade-off between embodied and operational carbon in a specific infrastructure design decision.</li><li>A dispute is emerging over the financial impact of a variation on an infrastructure contract. How would you approach resolving it before it escalates to formal proceedings?</li><li>Describe how your team would resource and maintain continuity of knowledge on a multi-year infrastructure instruction.</li><li>Explain how you would derive a risk-based contingency figure for an infrastructure project, rather than applying a standard percentage.</li><li>What data sources would you rely on for cost benchmarking on an infrastructure scheme, and how would you address the limitations of sector-specific data?</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."""
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Infrastructure",
  "h": "12.16 NEC Compensation Event Time Bar — Infrastructure Pathway",
  "body": """<strong>Your contractor believes they have a valid compensation event under an NEC contract, but seven weeks have passed since they became aware of it and no notification has been submitted. Talk me through the situation and what you would advise.</strong><br><br><em>Tests: Contract practice, Risk management, Client care. One of the most frequently tested Infrastructure scenarios.</em><br><br><strong>The model answer</strong> treats the NEC compensation event notification period as an absolute contractual deadline, not a general guideline — under NEC3/NEC4 clause 61.3, missing it doesn't weaken the contractor's claim, it extinguishes it entirely, regardless of how genuine the underlying entitlement is.<br><br><strong>Key elements:</strong><br><br><strong>1. The eight-week time bar is absolute.</strong> Under clause 61.3, if the contractor doesn't notify a compensation event within eight weeks of becoming aware of it, they lose all entitlement to a change in the prices, completion date, or key date for that event — there is no partial or proportionate outcome.<br><br><strong>2. The exception that doesn't apply here.</strong> The time bar doesn't apply where the project manager should have notified the event under clause 61.1 (events arising from an instruction, certificate, or changed decision) but failed to — that's a narrow exception, not a general safety net, and doesn't rescue a contractor-side event the contractor was aware of.<br><br><strong>3. "Becoming aware" is the trigger, not the event itself.</strong> The clock starts from when the contractor became aware the event happened, which can itself be a point of genuine dispute — but with one week left, this is not the moment to start litigating that question; it's the moment to notify immediately.<br><br><strong>4. Urgent, unambiguous advice is needed now.</strong> With one week remaining, the professional priority is making sure the notification is submitted correctly and immediately — not debating the merits of the underlying claim, which can be assessed afterwards.<br><br><strong>5. The employer-side incentive.</strong> It's worth understanding that the time bar operates in the employer's favour — some project managers may be inclined to let a deadline lapse rather than proactively remind the contractor, which is a live commercial dynamic on the other side of this scenario.<br><br><strong>6. Document everything from this point.</strong> Whatever the outcome, the advice given and the timeline of events from this point forward should be clearly documented, given how commercially significant a missed deadline is.<br><br><strong>How to frame this:</strong><br><br><em>"I would advise the contractor to submit the notification immediately, regardless of any uncertainty about the exact date of awareness."</em><br><br><em>"I'd check whether this event falls under the project manager's own notification duty under clause 61.1, since that's the only exception to the time bar."</em><br><br><em>"I would not spend the remaining time debating the merits of the claim — that can be assessed after notification, but the deadline itself can't be recovered once missed."</em><br><br><strong>Three things assessors tick:</strong> 1) understanding that the eight-week bar is binary, not proportionate, 2) correctly identifying the narrow clause 61.1 exception rather than treating it as a general safety net, 3) prioritising immediate action over debating the underlying merits with time running out.<br><br><strong>The NEC compensation event time bar doesn't care how strong the underlying claim is — miss the deadline and the entitlement is gone. Assessors are testing whether you understand this as a binary, procedural risk, not a commercial negotiation.</strong>"""
}

# Build JSON strings (single-escaped — these go directly into the JS data)
sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

# Full MODULES entry for id:26
module_entry = (
    '{"id":26,"num":"11B","title":"Infrastructure Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#ea580c",'
    '"intro":"Infrastructure practice combines engineering-scale technical complexity with the full weight of RICS professional obligations — client care, commercial judgement, sustainability, and dispute management across multi-year, multi-party schemes. This module sharpens every mandatory competency through the specific lens of Infrastructure work, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:26 before closing ];
# Anchor: the end of the Valuation module (id:25) entry which ends with }];
# ─────────────────────────────────────────────────────────────────────────────
# Find the MODULES array close — it ends with the Valuation module then ];
# The Valuation module (id:25) is the last one, ending with }];
old1 = '"id":25,"num":"11B"'
assert html.count(old1) == 1, f"Change 1 anchor: {html.count(old1)}"
# Find end of id:25 object
idx25 = html.index(old1)
# Find the }]; that closes the MODULES array after id:25
close_idx = html.index('}];', idx25)
assert close_idx > idx25
anchor1 = html[close_idx:close_idx+3]
assert anchor1 == '}];'

# Insert new module before the }]; (inside the last module's closing, then append new entry)
# Actually we need to insert AFTER the closing } of id:25 and before ];
# The }]; means: } closes id:25 object, ]; closes MODULES array
old1_anchor = html[close_idx:close_idx+3]
# Replace }]; with },<new entry>];
new1_insert = '},' + module_entry + '];'
html = html[:close_idx] + new1_insert + html[close_idx+3:]
print("Change 1: id:26 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars — add _m11bInfra and _isInfraDash
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bVal = MODULES.find(m => m.id === 25);"
new2 = ("const _m11bVal = MODULES.find(m => m.id === 25);\n"
        "const _m11bInfra = MODULES.find(m => m.id === 26);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isValDash = _m11bVal && _dashPathway === 'Valuation' && plan !== 'sprint';"
new2b = ("const _isValDash = _m11bVal && _dashPathway === 'Valuation' && plan !== 'sprint';\n"
         "const _isInfraDash = _m11bInfra && _dashPathway === 'Infrastructure' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain — extend with _isInfraDash
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isValDash ? [..._base.filter(m => m.id <= 11), _m11bVal, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isValDash ? [..._base.filter(m => m.id <= 11), _m11bVal, ..._base.filter(m => m.id >= 12)]"
        " : _isInfraDash ? [..._base.filter(m => m.id <= 11), _m11bInfra, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip — add Infrastructure branch
# ─────────────────────────────────────────────────────────────────────────────
old4 = "    } else if (_stripPathway === 'Valuation' && plan !== 'sprint') {\n      twelveMods.splice(11, 0, {id:25, code:'11B', label:'Valuation pathway prep'});"
new4 = ("    } else if (_stripPathway === 'Valuation' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:25, code:'11B', label:'Valuation pathway prep'});\n"
        "    } else if (_stripPathway === 'Infrastructure' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:26, code:'11B', label:'Infrastructure pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars — add _isInfra
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isVal = _p === 'Valuation' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isVal = _p === 'Valuation' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isInfra = _p === 'Infrastructure' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks — add id===26, id===11&&_isInfra, id===12&&_isInfra
# ─────────────────────────────────────────────────────────────────────────────
# 6a: id===26 nav block (goes after id===25 block)
old6a = ("        } else if (id === 25) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 25) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 26) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

# 6b: id===11 && _isInfra (goes after id===11 && _isVal)
old6b = ("        } else if (id === 11 && _isVal) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(25, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(25)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isVal) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(25, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(25)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isInfra) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(26, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(26)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

# 6c: id===12 && _isInfra (goes after id===12 && _isVal)
old6c = ("        } else if (id === 12 && _isVal) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(25)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isVal) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(25)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isInfra) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(26)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:26, id:11+_isInfra, id:12+_isInfra)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label — add m.id === 26
# ─────────────────────────────────────────────────────────────────────────────
old7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25"
new7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked — add guard for modId === 26
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 25) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Valuation') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 25) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Valuation') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 26) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Infrastructure') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1, f"Change 8: {html.count(old8)}"
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:26 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly section — insert after Valuation section
# ─────────────────────────────────────────────────────────────────────────────
# The Valuation M12 section ends with: ...guarantee a figure will hold up forever.</strong>"}
# Then immediately followed by ,{"pathwayOnly":"Project Management"
val_m12_end = 'guarantee a figure will hold up forever.</strong>"}'
assert html.count(val_m12_end) == 1, f"Change 9 anchor: {html.count(val_m12_end)}"
html = html.replace(
    val_m12_end,
    val_m12_end + ',' + m12_section_json
)
print("Change 9: M12 Infrastructure pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

# Verify key presence
assert '"id":26' in html, "id:26 not found"
assert '"Infrastructure Pathway — Professional Practice' in html, "module title not found"
assert '"pathwayOnly":"Infrastructure"' in html, "M12 pathwayOnly not found"
assert 'modId === 26' in html, "isModuleUnlocked guard not found"
assert '_isInfra =' in html, "nav var not found"
assert '_isInfraDash' in html, "dash var not found"
assert 'm.id === 26' in html, "dmcard check not found"
assert "id:26, code:'11B'" in html, "milestone strip not found"
print("All assertions passed ✓")
