import json, re

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

# Confirm localStorage pathway string before writing anything
assert "pathway === 'Facility Management'" in html, "FM pathway string mismatch"
print("FM pathway string confirmed: 'Facility Management'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Facilities Management is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Facilities managers carry a distinctive, ongoing responsibility that other pathways don't face in quite the same way — you're rarely advising on a single transaction or project, but on the continuous, day-to-day operation of buildings that people work in, use, and depend on being safe. Assessors expect FM candidates to demonstrate not just technical fluency in asset management, maintenance, and supplier oversight, but the judgement, statutory compliance discipline, and business alignment skill that this ongoing operational responsibility genuinely demands.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Facilities Management pathway and justify your competency selections</li><li>Apply health and safety principles specific to facilities management practice</li><li>Demonstrate working knowledge of accounting principles as they apply to FM</li><li>Identify and use the data sources and professional tools relied on by FM practitioners</li><li>Apply RICS client care standards to facilities management client relationships</li><li>Explain how an FM practice or in-house team plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to FM scenarios</li><li>Discuss sustainability considerations specific to facilities management</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Facilities Management practice."
  },
  {
    "h": "11B.2 The Facilities Management Pathway: Structure and Competency Selection",
    "body": "Facilities Management is the total management of all services and built environment infrastructure that support the core business of an organisation — spanning asset management, workspace strategy, maintenance, supplier oversight, and business alignment.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competencies:</strong> two to Level 3 and two to Level 2, from: Asset management, Business alignment, Client care (must be taken to Level 3 if chosen here), Legal/regulatory compliance, Maintenance management, Performance management, Procurement and tendering, Project finance, Supplier management, Workspace strategy.<br><br><strong>Optional competencies:</strong> two to Level 3 and one to Level 2, including any not already chosen from the core list, from a broad group including Big data, BIM management, Business case, Change management, Commercial management, Construction technology and environmental services, Consultancy services, Contract administration, Contract practice, Design and specification, Environmental management, Landlord and tenant, Managing projects, Measurement, Risk management, Smart cities and intelligent buildings, Stakeholder management, Strategic real estate consultancy, Waste management, and Works progress and quality management — plus one of Conflict avoidance, Data management, Health and safety (must be Level 3 if chosen here), Inclusive environments, or Sustainability, elevating only one of this group to a higher level.<br><br>Plus one further competency to Level 2 from the full technical list, including any not already chosen.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive.<br><br><em>Source: RICS Facilities Management Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For FM candidates, Level 3 means being able to advise on a genuine operational decision — balancing cost, compliance, and business alignment — with the confidence and judgement of a senior colleague, not simply describing FM processes."
  },
  {
    "h": "11B.3 Health and Safety in Facilities Management Practice",
    "body": "Health and safety sits at the centre of the FM discipline in a way that goes beyond most other pathways — facilities managers are frequently the person responsible, day to day, for the safety of the people occupying and using a building.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Regulatory Reform (Fire Safety) Order 2005 (as strengthened by the Fire Safety Act 2021 and the Fire Safety (England) Regulations 2022) — placing duties on the \"responsible person\" to ensure a suitable and sufficient fire risk assessment is in place and kept current</li><li>Building Safety Act 2022 — introducing accountable person duties and a duty to cooperate with the responsible person, particularly relevant for higher-risk buildings</li><li>Control of Asbestos Regulations, Legionella (ACOP L8) guidance, and other statutory compliance regimes relevant to occupied buildings</li></ul><strong>Practical application for FM candidates:</strong><br>A competent facilities manager treats statutory compliance (fire risk assessments, legionella management, asbestos registers) as a living, ongoing responsibility rather than a one-off exercise — reviewing and updating records whenever circumstances change, not just when an audit is due. Given that breach of duties under the Fire Safety Order is a criminal offence, understanding your specific role (whether as the responsible person, or advising one) is essential professional knowledge, not background detail.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety or statutory compliance risk you've encountered in your own FM work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Facilities Management Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and FM practice brings that knowledge into focus around running cost management and whole-life value.<br><br><strong>Core areas relevant to FM candidates:</strong><ul><li><strong>Running costs and costs-in-use</strong> — understanding the ongoing operational cost of a building, and how this differs from capital expenditure</li><li><strong>Whole-life cost data</strong> — using costs-in-use data to inform business case decisions, not just capital cost at the point of investment</li><li><strong>Service charge and budget management</strong> — preparing and monitoring maintenance and operational budgets</li><li><strong>People costs</strong> — understanding the impact of minimum wage, pension obligations, and TUPE liabilities on FM service delivery costs, particularly relevant where services are outsourced or insourced</li></ul><strong>Practical application:</strong><br>An FM professional preparing a business case for a maintenance or service change needs to present a genuine whole-life cost comparison — not just the headline capital or contract cost, but the ongoing running cost implications over the asset's operational life, including any people-cost liabilities that a change in service provision might trigger."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Facilities Management Practice",
    "body": "FM practice draws on a distinctive and increasingly data-rich set of sources, reflecting the discipline's shift toward smart building technology and performance data.<br><br><strong>Core data sources:</strong><ul><li><strong>Computer-Aided Facilities Management (CAFM) systems</strong> — used for asset records, maintenance scheduling, and performance reporting</li><li><strong>BIM models</strong> — increasingly used in operational phase, not just design and construction, to inform maintenance and lifecycle strategies</li><li><strong>Building sensor and IoT data</strong> — used to monitor occupancy, energy performance, and building condition in real time</li><li><strong>Benchmarking data</strong> — used to compare running costs and performance across a portfolio of buildings</li><li><strong>Occupier satisfaction data</strong> — feedback used to inform workspace strategy and performance management decisions</li></ul><strong>Practical application:</strong><br>When advising on a maintenance strategy or workspace change, an FM professional should be able to explain which data informed the recommendation — benchmark cost comparisons, occupier satisfaction scores, sensor-derived utilisation data — and be transparent about any limitations in that data, rather than presenting a recommendation as if it were based on complete information when it isn't."
  },
  {
    "h": "11B.6 Client Care in Facilities Management Practice",
    "body": "RICS client care standards apply to every pathway, but FM work often means the \"client\" is really an internal business function or senior management team, requiring the facilities manager to translate FM decisions into terms that align with wider business objectives.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement or service scope, agreed and confirmed in writing, including complaints handling procedures where relevant</li><li>Understanding that \"client\" in FM often means multiple internal stakeholders — HR, IT, finance, and senior leadership — each with different priorities that need reconciling</li><li>Transparent reporting on cost, compliance, and performance, structured to be genuinely useful to a business audience, not just an FM specialist one</li><li>Managing expectations proactively, particularly where a compliance or cost issue is likely to require unwelcome investment</li></ul><strong>Practical application:</strong><br>A common FM scenario at interview: senior management wants to reduce the FM budget, but a proposed reduction would compromise statutory compliance obligations. Good client care here means clearly explaining the compliance risk in business terms — potential enforcement action, reputational harm, and safety consequences — rather than either capitulating to the budget pressure or refusing to engage with the commercial reality facing the business."
  },
  {
    "h": "11B.7 Business Planning in Facilities Management Practice",
    "body": "Whether you work for an FM service provider, a specialist consultancy, or in-house for an occupier, RICS expects every candidate to understand how their business or function sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee and cost models specific to FM — service contracts, management fees, and in-house cost centre budgeting all operate differently and require different commercial understanding</li><li>Resourcing and capacity planning — FM services often need to flex to occupier demand and seasonal or operational peaks</li><li>Supply chain and outsourcing decisions — understanding the commercial and people-cost implications (including TUPE) of moving services in-house or out to a provider</li><li>Business alignment — demonstrating how FM strategy connects to, and is justified by, the core business's wider objectives and performance</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your FM function or business justifies its budget and resourcing to senior management, and how a specific outsourcing or insourcing decision was commercially and operationally evaluated. Assessors are testing commercial and business alignment awareness — do you understand how FM fits into the wider business, not just the operational tasks you perform."
  },
  {
    "h": "11B.8 Conflict Avoidance in Facilities Management Practice",
    "body": "FM work generates a distinctive pattern of dispute — supplier performance failures, contract disputes with service providers, and disagreements between occupiers over shared space or service standards are all common.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common FM dispute scenarios — supplier performance disputes, disagreements over service scope or standard, and disputes arising from outsourcing or insourcing transitions</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; adjudication or formal contractual dispute mechanisms &#x2192; litigation as a last resort</li><li>Active negotiation on behalf of the business — facilities managers frequently negotiate directly with suppliers on performance failures before any formal escalation is needed</li></ul><strong>Practical application:</strong><br>A frequent scenario: a key supplier is consistently underperforming against agreed KPIs, and the relationship is deteriorating. Assessors want you to explain how you would investigate the underperformance, negotiate a resolution or improvement plan, and know when and how to escalate to formal contractual remedies or contract termination if performance doesn't improve — not simply terminate the contract at the first sign of difficulty."
  },
  {
    "h": "11B.9 Sustainability in Facilities Management Practice",
    "body": "Sustainability sits close to the core of modern facilities management, given the discipline's direct control over a building's ongoing operational performance.<br><br><strong>Key areas:</strong><ul><li><strong>Operational energy performance</strong> — FM has direct, ongoing influence over a building's actual energy consumption, distinct from its design-stage sustainability rating</li><li><strong>Whole-life sustainability decisions</strong> — balancing capital cost of sustainability improvements against operational savings and compliance requirements</li><li><strong>Waste management</strong> — a distinct FM responsibility, covering regulatory compliance, technology choices, and cost implications</li><li><strong>ESG and corporate sustainability reporting</strong> — increasingly, FM data (energy use, waste, water) feeds directly into an organisation's wider ESG reporting obligations</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would build the business case for an operational sustainability improvement — for example, an upgrade to building services that reduces energy consumption — weighing capital cost against operational savings and any compliance or ESG reporting benefit, and giving a reasoned recommendation rather than treating sustainability spend as automatically justified or automatically discretionary."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Facilities Management — a lapsed statutory compliance discovery, a supplier performance dispute, a budget-versus-compliance tension, a sustainability business case — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on statutory compliance or supplier dispute scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Facilities Management-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Facilities Management pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>You discover during a routine review that a building's fire risk assessment hasn't been updated despite a significant change of use. Talk me through what you would do.</li><li>Senior management wants to reduce the FM budget in a way that would compromise statutory compliance obligations. How would you handle this conversation?</li><li>A key supplier is consistently underperforming against agreed KPIs. How would you investigate and manage this before considering contract termination?</li><li>Explain how you would build a business case comparing an operational sustainability investment against its capital cost and payback.</li><li>Describe how CAFM system data would inform a maintenance strategy decision, and what limitations you would flag in that data.</li><li>Explain the commercial and people-cost implications (including TUPE) of moving a service from outsourced to in-house provision.</li><li>How would you reconcile competing priorities between different internal stakeholders (e.g. HR, IT, and finance) when developing an FM strategy?</li><li>Outline your understanding of the \"responsible person\" concept under fire safety legislation, and what this means practically for your own role.</li><li>Explain how whole-life costing differs from capital cost alone, and why this matters in an FM business case.</li><li>Describe how you would use occupier satisfaction data to inform a workspace strategy recommendation.</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Facility Management",
  "h": "12.16 Fire Risk Assessment Lapse — Facilities Management Pathway",
  "body": "<strong>During a routine review, you discover that a building's fire risk assessment hasn't been reviewed in over two years, despite a significant change of use in one part of the building. Talk me through what you would do.</strong><br><br><em>Tests: Health and safety, Legal/regulatory compliance, Risk management. One of the most frequently tested Facilities Management scenarios.</em><br><br><strong>The model answer</strong> treats this as an immediate compliance and life-safety issue, not an administrative backlog item — a lapsed fire risk assessment isn't just a paperwork gap, it's a live breach of a duty that carries criminal liability under the Fire Safety Order.<br><br><strong>Key elements:</strong><br><br><strong>1. Identify the responsible person.</strong> The Regulatory Reform (Fire Safety) Order 2005 places the duty on a \"responsible person\" — the employer, the person in control of the premises, or the owner. Before anything else, you need to establish exactly who holds that duty in this specific building, since it may not be you personally.<br><br><strong>2. The assessment is a living document, not a one-off.</strong> A fire risk assessment must be reviewed whenever there's reason to believe it's no longer valid — a significant change of use is a textbook trigger for review, and the fact this wasn't picked up sooner is itself a process failure worth addressing.<br><br><strong>3. Immediate risk assessment, not just paperwork.</strong> Before worrying about the record itself, the priority is understanding whether the change of use has created a genuine, current fire risk — arrange an urgent, competent review of the affected area rather than treating this as something that can wait for the next scheduled cycle.<br><br><strong>4. This is a criminal compliance matter.</strong> Breach of the risk assessment duty under the Order is a criminal offence, with penalties including unlimited fines and, in serious cases, imprisonment. This isn't a commercial risk to be weighed against cost — it needs to be treated with that level of seriousness from the outset.<br><br><strong>5. Escalate and document immediately.</strong> Notify the responsible person (or relevant senior stakeholder) without delay, commission an updated assessment from a competent assessor, and document the timeline of discovery and remedial action clearly — this protects both the occupiers and the professional position of everyone involved.<br><br><strong>6. Fix the underlying process, not just this instance.</strong> Once the immediate risk is addressed, the real question is why the change-of-use trigger wasn't caught by the existing review process — and what needs to change so this doesn't happen again.<br><br><strong>How to frame this:</strong><br><br><em>My first step was establishing exactly who the responsible person was for this building, since the duty doesn't automatically sit with me.</em><br><br><em>I treated this as an urgent life-safety issue first, and a compliance paperwork issue second — commissioning an immediate updated assessment rather than waiting for the next scheduled review.</em><br><br><em>I documented the discovery and the remedial steps taken clearly, given the criminal liability that attaches to this duty.</em><br><br><strong>Three things assessors tick:</strong> 1) correctly identifying the responsible person rather than assuming it's automatically the candidate, 2) treating the lapse as an urgent life-safety matter, not just an administrative gap, 3) addressing the underlying process failure, not just the immediate instance.<br><br><strong>A lapsed fire risk assessment isn't a scheduling problem — it's a live legal exposure and a genuine safety risk. Assessors are testing whether you understand the seriousness of that distinction, not just the theoretical content of the regulations.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":29,"num":"11B","title":"Facilities Management Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#dc2626",'
    '"intro":"Facilities managers carry ongoing, day-to-day responsibility for buildings and the people within them — balancing statutory compliance, cost control, and business alignment continuously, not just at a single transaction point. This module sharpens every mandatory competency through the specific lens of FM practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:29 after id:28
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":28,"num":"11B"'
assert html.count(old1) == 1
idx28 = html.index(old1)
close_idx = html.index('}];', idx28)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:29 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bPM = MODULES.find(m => m.id === 28);"
new2 = ("const _m11bPM = MODULES.find(m => m.id === 28);\n"
        "const _m11bFM = MODULES.find(m => m.id === 29);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isPMDash = _m11bPM && _dashPathway === 'Project Management' && plan !== 'sprint';"
new2b = ("const _isPMDash = _m11bPM && _dashPathway === 'Project Management' && plan !== 'sprint';\n"
         "const _isFMDash = _m11bFM && _dashPathway === 'Facility Management' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isPMDash ? [..._base.filter(m => m.id <= 11), _m11bPM, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isPMDash ? [..._base.filter(m => m.id <= 11), _m11bPM, ..._base.filter(m => m.id >= 12)]"
        " : _isFMDash ? [..._base.filter(m => m.id <= 11), _m11bFM, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Project Management' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:28, code:'11B', label:'PM pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Project Management' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:28, code:'11B', label:'PM pathway prep'});\n"
        "    } else if (_stripPathway === 'Facility Management' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:29, code:'11B', label:'FM pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isPM = _p === 'Project Management' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isPM = _p === 'Project Management' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isFM = _p === 'Facility Management' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks
# ─────────────────────────────────────────────────────────────────────────────
# 6a: id===29 after id===28
old6a = ("        } else if (id === 28) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 28) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 29) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a: {html.count(old6a)}"
html = html.replace(old6a, new6a)

# 6b: id===11 && _isFM after id===11 && _isPM
old6b = ("        } else if (id === 11 && _isPM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(28, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(28)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isPM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(28, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(28)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isFM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(29, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(29)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b: {html.count(old6b)}"
html = html.replace(old6b, new6b)

# 6c: id===12 && _isFM after id===12 && _isPM
old6c = ("        } else if (id === 12 && _isPM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(28)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isPM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(28)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isFM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(29)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:29, id:11+_isFM, id:12+_isFM)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26 || m.id === 27 || m.id === 28"
new7 = old7 + " || m.id === 29"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 29
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 28) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Project Management') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 28) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Project Management') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 29) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Facility Management') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:29 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after PM section (last before quiz array)
# ─────────────────────────────────────────────────────────────────────────────
pm_end_anchor = 'did not."}],"quiz":['
assert html.count(pm_end_anchor) == 1, f"Change 9 anchor count: {html.count(pm_end_anchor)}"
html = html.replace(
    pm_end_anchor,
    'did not."},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 FM pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":29' in html
assert '"Facilities Management Pathway — Professional Practice' in html
assert '"pathwayOnly":"Facility Management"' in html
assert 'modId === 29' in html
assert "_isFM = _p === 'Facility Management'" in html
assert '_isFMDash' in html
assert 'm.id === 29' in html
assert "id:29, code:'11B'" in html
# Confirm FM pathwayOnly count is exactly 1
fm_count = html.count('"pathwayOnly":"Facility Management"')
assert fm_count == 1, f"Expected 1 FM pathwayOnly, found {fm_count}"
print(f"FM pathwayOnly count: {fm_count} ✓")
print("All assertions passed ✓")
