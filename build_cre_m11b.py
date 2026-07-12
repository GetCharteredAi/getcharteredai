import json

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

assert html.count("'Corporate Real Estate'") >= 1, "CRE pathway string not found"
print("CRE pathway string confirmed: 'Corporate Real Estate'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Corporate Real Estate is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Corporate Real Estate surveyors sit inside — or work closely alongside — the organisations they serve, ensuring property decisions genuinely align with the business's core objectives rather than being treated as a standalone technical exercise. Assessors expect CRE candidates to demonstrate not just technical fluency in workspace strategy, business cases, and portfolio management, but the business acumen, stakeholder skill, and strategic judgement that comes with representing the occupier's interests, often from inside the organisation itself.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Corporate Real Estate pathway and justify your competency selections</li><li>Apply health and safety principles specific to corporate real estate practice</li><li>Demonstrate working knowledge of accounting principles as they apply to CRE</li><li>Identify and use the data sources and professional tools relied on by CRE practitioners</li><li>Apply RICS client care standards to corporate real estate stakeholder relationships</li><li>Explain how a CRE function or consultancy plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to relevant scenarios</li><li>Discuss sustainability considerations specific to corporate real estate</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Corporate Real Estate practice."
  },
  {
    "h": "11B.2 The Corporate Real Estate Pathway: Structure and Competency Selection",
    "body": "Corporate Real Estate (CRE) is about ensuring an organisation's property requirements are met as efficiently and effectively as possible — whether advising on a consultancy basis or working directly in-house for a single organisation.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competency (Level 3):</strong> Business alignment <em>or</em> Strategic real estate consultancy (you select one of this pair).<br><br><strong>Core competencies (Level 2):</strong> Business case; and Landlord and tenant <em>or</em> Property management (you select one of this pair).<br><br><strong>Core competency (Level 1):</strong> Valuation.<br><br><strong>Optional competencies:</strong> three to Level 3 and one to Level 2, including any not already chosen from the core list, from: Change management, Inspection, Leasing and letting, Local taxation/assessment, Measurement, Performance management, Procurement and tendering, Programming and planning, Purchase and sale, Strategic real estate consultancy, Supplier management, Sustainability, Valuation, Workspace strategy.<br><br>Plus one further competency to Level 2 from the full technical list, including any not already chosen from the optional list.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive. This pathway is distinctive in that its core skills blend traditional technical property competencies with business-facing skills like business case development and organisational alignment.<br><br><em>Source: RICS Corporate Real Estate Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For CRE candidates, Level 3 means being able to advise on a genuinely consequential property decision that's explicitly connected to the organisation's wider business strategy — not simply describing a property transaction in isolation from the business context around it."
  },
  {
    "h": "11B.3 Health and Safety in Corporate Real Estate Practice",
    "body": "CRE professionals inspect and manage a wide range of occupied corporate premises, often across a portfolio spanning multiple sites and building types.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Regulatory Reform (Fire Safety) Order 2005 and related occupied-building compliance regimes — particularly relevant where the CRE function has responsibility for portfolio-wide compliance</li><li>Occupiers' Liability Act — relevant to risks encountered while inspecting occupied corporate premises</li></ul><strong>Practical application for CRE candidates:</strong><br>A competent CRE professional understands the specific health and safety responsibilities that attach to their organisation's portfolio — particularly relevant where the CRE function sits alongside, or overlaps with, a wider facilities management responsibility. Where inspections are carried out across a multi-site portfolio, consistent lone-working discipline (check-in protocols, shared location information, a clear escalation route) should apply across every site, not just the ones visited most frequently.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered in your own CRE work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Corporate Real Estate Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and CRE practice brings that knowledge into focus around business case financial justification and portfolio cost management.<br><br><strong>Core areas relevant to CRE candidates:</strong><ul><li><strong>Business case financial analysis</strong> — the financial metrics and standards needed to support a property-related business case, and how these connect to the organisation's wider financial reporting</li><li><strong>Portfolio running costs</strong> — understanding occupancy cost per head, cost-in-use, and other metrics used to benchmark and manage a corporate property portfolio</li><li><strong>Lease accounting</strong> — understanding how property leases are treated on an organisation's balance sheet, and the financial reporting implications this can have for property decisions</li><li><strong>Client money and fee handling</strong> — where relevant to a consultancy-side CRE role</li></ul><strong>Practical application:</strong><br>A CRE professional preparing a business case for a workspace or portfolio decision needs to be able to present a financial case that genuinely aligns with how the organisation's finance function actually evaluates investment decisions — not just property-specific metrics in isolation, but the language and standards the wider business uses to approve spend."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Corporate Real Estate Practice",
    "body": "CRE practice draws on data sources spanning portfolio performance, occupier experience, and business alignment.<br><br><strong>Core data sources:</strong><ul><li><strong>Portfolio benchmarking data</strong> — used to compare occupancy cost, space utilisation, and performance across a corporate property portfolio</li><li><strong>Occupier and employee satisfaction data</strong> — increasingly central to workspace strategy decisions</li><li><strong>Utilisation and space analytics</strong> — sensor and badge-swipe data used to understand how workspace is actually being used</li><li><strong>CAFM and portfolio management systems</strong> — used for asset records and performance reporting across a multi-site portfolio</li><li><strong>Business performance data</strong> — connecting property decisions back to the organisation's own KPIs and strategic objectives</li></ul><strong>Practical application:</strong><br>When advising on a workspace strategy decision, a CRE professional should be able to explain which data informed the recommendation — utilisation studies, occupier feedback, cost benchmarking — and be transparent about the limitations of any single data source, particularly where utilisation data doesn't fully capture qualitative factors like collaboration needs or employee wellbeing."
  },
  {
    "h": "11B.6 Client Care in Corporate Real Estate Practice",
    "body": "RICS client care standards apply to every pathway, but in CRE the \"client\" is often the CRE professional's own employer, or an internal business function, requiring a distinct approach to stakeholder management.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement (for consultancy-side roles) or an equivalent internal service agreement, understood by relevant stakeholders</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Understanding that \"client\" in a CRE context often means multiple internal stakeholders — finance, HR, operations, senior leadership — each with different priorities requiring active reconciliation</li><li>Managing expectations proactively, particularly where a property recommendation conflicts with a stakeholder's preferred outcome</li></ul><strong>Practical application:</strong><br>A common CRE scenario at interview: a business unit wants to retain more space than the utilisation data supports, creating tension with the CRE function's cost and efficiency objectives. Good client care here means engaging genuinely with the business unit's underlying needs, presenting the data transparently, and finding a solution that respects both the evidence and the relationship — rather than simply imposing a decision based on utilisation figures alone."
  },
  {
    "h": "11B.7 Business Planning in Corporate Real Estate Practice",
    "body": "Whether you work in-house or for a CRE consultancy, RICS expects every candidate to understand how their function or business sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee and cost models specific to CRE — consultancy fees, or in-house cost centre budgeting and cross-charging arrangements</li><li>Resourcing and capacity planning — particularly relevant given the portfolio-wide, ongoing nature of most CRE responsibilities</li><li>Demonstrating value — CRE functions are frequently required to justify their own cost and contribution to the wider business, distinct from most property pathways</li><li>Change and transformation programme resourcing — CRE-led change programmes (workspace consolidation, portfolio rationalisation) often require dedicated project resourcing alongside business-as-usual activity</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your CRE function or consultancy demonstrates its value and justifies its resourcing to the wider business. Assessors are testing commercial and business alignment awareness — do you understand how CRE is evaluated within the organisation, not just the technical work it delivers."
  },
  {
    "h": "11B.8 Conflict Avoidance in Corporate Real Estate Practice",
    "body": "CRE work generates disputes distinct in character from most other pathways — disagreements between business units competing for space, and lease-related disputes arising from the occupier's (rather than landlord's) side of the relationship, are both common.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common CRE dispute scenarios — internal disputes over space allocation between competing business units, and lease-related disputes with landlords, particularly around break clause exercise or dilapidations</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; independent expert determination or arbitration &#x2192; litigation as a last resort</li><li>Understanding strict, unforgiving contractual conditions — lease break clauses in particular carry conditions that courts interpret strictly, where getting a technical detail wrong can be as damaging as a genuine dispute</li></ul><strong>Practical application:</strong><br>A frequent scenario: your organisation wants to exercise a lease break clause, and you need to ensure every condition is met precisely. Assessors want you to explain the specific conditions typically attached to a break clause, why courts interpret them strictly, and how you would manage the process to protect your organisation's position — not simply assume that giving notice of intent to leave is sufficient."
  },
  {
    "h": "11B.9 Sustainability in Corporate Real Estate Practice",
    "body": "Sustainability sits close to the centre of CRE practice, given the CRE function's direct influence over an organisation's property footprint and its associated environmental impact.<br><br><strong>Key areas:</strong><ul><li><strong>Portfolio-wide carbon strategy</strong> — CRE functions increasingly own the property dimension of an organisation's wider sustainability and net-zero commitments</li><li><strong>Workspace consolidation and sustainability</strong> — reducing an organisation's property footprint often serves both cost and sustainability objectives simultaneously</li><li><strong>ESG reporting</strong> — CRE data (energy use, space utilisation, portfolio carbon) increasingly feeds directly into corporate ESG disclosure requirements</li><li><strong>Sustainable material and design selection</strong> — relevant where CRE is involved in fit-out or refurbishment decisions</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would build the business case for a sustainability-driven portfolio decision — for example, a workspace consolidation that reduces both cost and carbon footprint — connecting the property recommendation explicitly to the organisation's wider sustainability commitments and reporting obligations."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Corporate Real Estate — a break clause exercise, a business case under stakeholder pressure, a space allocation dispute between business units, a sustainability-driven consolidation decision — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on business case or lease-condition scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Corporate Real Estate-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Corporate Real Estate pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>Your organisation wants to exercise a lease break clause. What conditions would you need to ensure are precisely satisfied, and why do courts interpret these strictly?</li><li>A business unit wants to retain more space than utilisation data supports. How would you manage this stakeholder relationship while respecting the evidence?</li><li>Explain how you would build a business case for a workspace consolidation, connecting it to both cost savings and sustainability objectives.</li><li>Describe the financial metrics and standards you would use to present a property business case in terms the wider business would recognise.</li><li>Outline the health and safety considerations relevant to inspecting a portfolio of occupied corporate premises across multiple sites.</li><li>How would you demonstrate the value and justify the resourcing of your CRE function to senior stakeholders?</li><li>Explain how occupancy data limitations (e.g. utilisation studies not capturing collaboration needs) should be reflected in a workspace strategy recommendation.</li><li>Describe how lease accounting treatment might influence a corporate occupier's decision on lease versus buy for a new site.</li><li>A change management programme (e.g. a portfolio consolidation) is facing resistance from affected business units. How would you approach stakeholder engagement?</li><li>Explain the difference between business alignment and strategic real estate consultancy as competencies, and which better reflects your own role.</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Corporate Real Estate",
  "h": "12.18 Lease Break Clause Exercise — Corporate Real Estate Pathway",
  "body": "<strong>Your organisation holds a lease with a break option coming up, and the business has decided to exercise it. Talk me through what you would need to get right, and why the conditions matter so much.</strong><br><br><em>Tests: Landlord and tenant, Legal/regulatory compliance, Business alignment. One of the most frequently tested Corporate Real Estate scenarios.</em><br><br><strong>The model answer</strong> treats break clause conditions as a strict, unforgiving checklist rather than a general statement of intent — English courts have consistently held that conditions precedent to a break must be complied with exactly, and there's little room for \"close enough.\"<br><br><strong>Key elements:</strong><br><br><strong>1. Notice form and timing must be exact.</strong> The break notice must be served in exactly the form and within exactly the timeframe the lease specifies — courts have made clear that even a technically clear notice fails if it doesn't match the precise requirements set out in the lease.<br><br><strong>2. Vacant possession is the classic pitfall.</strong> If the lease requires vacant possession, this generally means the premises must be free of people, of the tenant's moveable property and fixtures, and of any legal interests — case law has shown that even leaving partitioning or having contractors still on site at the break date can be enough to invalidate the break.<br><br><strong>3. Rent and other payment conditions are strictly enforced.</strong> If the lease requires all rent (or \"all sums\") to be paid up to the break date, this needs careful checking — including any outstanding interest on previously late payments, which is a common oversight.<br><br><strong>4. Once served, a break notice can't be taken back.</strong> The organisation needs to be genuinely certain before the notice is served, since it can't be unilaterally withdrawn once given.<br><br><strong>5. A surveyor should be instructed to manage compliance.</strong> Given how strictly these conditions are construed and how easily a technical slip can invalidate the break, RICS guidance (the Code for Leasing Business Premises) recommends limiting break conditions to the essentials, and a surveyor's involvement in managing compliance is standard, prudent practice.<br><br><strong>6. Document everything.</strong> Given the financial exposure of a failed break (being locked into the lease for a further term), the steps taken to satisfy each condition should be clearly recorded, including dates, communications, and evidence of vacant possession.<br><br><strong>How to frame this:</strong><br><br><em>\"I treated every condition in the break clause as something that had to be satisfied exactly, not just substantially, given how strictly the courts have interpreted these in the past.\"</em><br><br><em>\"I paid particular attention to vacant possession, making sure nothing was left on site that could be argued to prevent it — including things as easy to overlook as partitioning or a lingering contractor.\"</em><br><br><em>\"I made sure the organisation understood the break notice couldn't be withdrawn once served, so the decision needed to be genuinely final before we acted.\"</em><br><br><strong>Three things assessors tick:</strong> 1) understanding that break conditions require strict, not substantial, compliance, 2) correctly identifying vacant possession as the most common and easily-missed pitfall, 3) recognising the irreversible nature of a served break notice.<br><br><strong>A lease break clause doesn't reward good intentions — it rewards exact compliance. Assessors are testing whether you understand that a single overlooked detail can cost the organisation a further lease term.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":32,"num":"11B","title":"Corporate Real Estate Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#92400e",'
    '"intro":"Corporate Real Estate surveyors ensure property decisions genuinely align with the organisation\'s business strategy — whether working in-house or on a consultancy basis. This module sharpens every mandatory competency through the specific lens of Corporate Real Estate practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:32 after id:31
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":31,"num":"11B"'
assert html.count(old1) == 1
idx31 = html.index(old1)
close_idx = html.index('}];', idx31)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:32 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bPFI = MODULES.find(m => m.id === 31);"
new2 = ("const _m11bPFI = MODULES.find(m => m.id === 31);\n"
        "const _m11bCRE = MODULES.find(m => m.id === 32);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isPFIDash = _m11bPFI && _dashPathway === 'Property Finance and Investment' && plan !== 'sprint';"
new2b = ("const _isPFIDash = _m11bPFI && _dashPathway === 'Property Finance and Investment' && plan !== 'sprint';\n"
         "const _isCREDash = _m11bCRE && _dashPathway === 'Corporate Real Estate' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isPFIDash ? [..._base.filter(m => m.id <= 11), _m11bPFI, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isPFIDash ? [..._base.filter(m => m.id <= 11), _m11bPFI, ..._base.filter(m => m.id >= 12)]"
        " : _isCREDash ? [..._base.filter(m => m.id <= 11), _m11bCRE, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Property Finance and Investment' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:31, code:'11B', label:'PFI pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Property Finance and Investment' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:31, code:'11B', label:'PFI pathway prep'});\n"
        "    } else if (_stripPathway === 'Corporate Real Estate' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:32, code:'11B', label:'CRE pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isPFI = _p === 'Property Finance and Investment' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isPFI = _p === 'Property Finance and Investment' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isCRE = _p === 'Corporate Real Estate' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks (id:32, id:11+_isCRE, id:12+_isCRE)
# ─────────────────────────────────────────────────────────────────────────────
old6a = ("        } else if (id === 31) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 31) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 32) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

old6b = ("        } else if (id === 11 && _isPFI) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(31, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(31)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isPFI) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(31, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(31)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isCRE) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(32, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(32)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

old6c = ("        } else if (id === 12 && _isPFI) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(31)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isPFI) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(31)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isCRE) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(32)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:32, id:11+_isCRE, id:12+_isCRE)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = ("m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || "
        "m.id === 26 || m.id === 27 || m.id === 28 || m.id === 29 || m.id === 30 || m.id === 31")
new7 = old7 + " || m.id === 32"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 32
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 31) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Property Finance and Investment') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 31) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Property Finance and Investment') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 32) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Corporate Real Estate') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:32 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after PFI section (last before quiz)
# ─────────────────────────────────────────────────────────────────────────────
pfi_end_anchor = 'start well before the test date, not after.</strong>"}],"quiz":['
assert html.count(pfi_end_anchor) == 1, f"Change 9 anchor count: {html.count(pfi_end_anchor)}"
html = html.replace(
    pfi_end_anchor,
    'start well before the test date, not after.</strong>"},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 CRE pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":32' in html
assert '"Corporate Real Estate Pathway — Professional Practice' in html
assert '"pathwayOnly":"Corporate Real Estate"' in html
assert 'modId === 32' in html
assert "_isCRE = _p === 'Corporate Real Estate'" in html
assert '_isCREDash' in html
assert 'm.id === 32' in html
assert "id:32, code:'11B'" in html
cre_count = html.count('"pathwayOnly":"Corporate Real Estate"')
assert cre_count == 1, f"Expected 1 CRE pathwayOnly, found {cre_count}"
pfi_count = html.count('"pathwayOnly":"Property Finance and Investment"')
assert pfi_count == 1, f"PFI pathwayOnly disturbed: found {pfi_count}"
print(f"CRE pathwayOnly count: {cre_count} ✓  PFI pathwayOnly count: {pfi_count} ✓")
print("All assertions passed ✓")
