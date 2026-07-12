import json

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

assert html.count("'Building Control'") >= 1, "BC pathway string not found"
print("BC pathway string confirmed: 'Building Control'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Building Control is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Building Control surveyors carry a public safety responsibility that few other pathways share so directly — ensuring building regulations and other legislation are followed at every stage of design and construction, and stepping in decisively when they aren't. Whether working in the public or private sector, you're relied on for judgement calls that genuinely protect public safety, from routine compliance checking through to advising on dangerous structures and enforcement action. Assessors expect Building Control candidates to demonstrate not just technical fluency in inspection and fire safety, but the procedural precision, currency of knowledge, and professional authority that this responsibility demands.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Building Control pathway and justify your competency selections</li><li>Apply health and safety principles specific to Building Control practice</li><li>Demonstrate working knowledge of accounting principles as they apply to this pathway</li><li>Identify and use the data sources and professional tools relied on by Building Control practitioners</li><li>Apply RICS client care standards to Building Control client and stakeholder relationships</li><li>Explain how a Building Control practice or team plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to enforcement and compliance scenarios</li><li>Discuss sustainability considerations specific to Building Control</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Building Control practice."
  },
  {
    "h": "11B.2 The Building Control Pathway: Structure and Competency Selection",
    "body": "Building Control surveyors ensure that building regulations and other legislation are followed in the design and construction of new and altered buildings, working alongside architects, designers, builders, and contractors from conception through to completion and use.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competencies (all four required, Level 3):</strong> Building control inspections; Fire safety; Inspection; Legal/regulatory compliance.<br><br><strong>Optional competencies:</strong> two to Level 3 and one to Level 2, from: BIM management, Building pathology, Client care (to Level 3) or Data management (grouped as one choice), Conservation and restoration, Construction technology and environmental services, Contaminated land, Measurement, Planning and development management, Risk management, Sustainability, and Works progress and quality management.<br><br>Plus one further competency to Level 2 from the full list of technical competencies, including any not already chosen from the optional list.<br><br><strong>Chartered alternative designation:</strong> unlike many other pathways, this one isn't optional — all candidates qualifying through Building Control, whether working in the public or private sector, are automatically entitled to use the designation \"Chartered Building Control Surveyor.\"<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive.<br><br><em>Source: RICS Building Control Pathway Guide (published December 2025, Version 1.2) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Building Control candidates, Level 3 means being able to exercise the same authoritative judgement a senior colleague would when a project fails to meet standards or a genuine safety issue is found on site — not simply describing the inspection process."
  },
  {
    "h": "11B.3 Health and Safety in Building Control Practice",
    "body": "Building Control surveyors work across live construction sites at every stage, and are frequently called on to inspect potentially dangerous structures — carrying a distinctive dual responsibility for their own safety and the public's.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Construction (Design and Management) Regulations (CDM) — relevant to coordinating safely with contractors on live sites</li><li>Powers relating to dangerous structures under the Building Act 1984 — a distinctive Building Control responsibility involving direct public safety risk</li></ul><strong>Practical application for Building Control candidates:</strong><br>A competent practitioner treats a live construction site inspection, and especially a dangerous structure inspection, with heightened caution — structural instability, fire-damaged buildings, and demolition sites all carry acute risk that requires careful, case-specific assessment before entering. Given how frequently Building Control surveyors are the ones called to assess a structure others have already deemed unsafe, this isn't a generic property inspection risk profile.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered in your own Building Control work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Building Control Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and Building Control practice brings that knowledge into focus around fee-setting and, where relevant, recovering enforcement costs.<br><br><strong>Core areas relevant to Building Control candidates:</strong><ul><li><strong>Fee structures for building control services</strong> — particularly relevant where competing with registered building control approvers in a mixed public/private market</li><li><strong>Cost recovery in enforcement</strong> — where a local authority undertakes remedial work itself and recovers costs from a non-compliant owner</li><li><strong>Basic business accounting</strong> — relevant to private sector Building Control practices operating commercially</li><li><strong>Client money handling</strong> — where relevant to fee arrangements</li></ul><strong>Practical application:</strong><br>Whether working in the public or private sector, a Building Control surveyor should understand how their service is priced and, on the enforcement side, how costs are recovered when a local authority steps in to carry out remedial work itself — a distinctive financial mechanism not found in most other pathways."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Building Control Practice",
    "body": "Building Control practice draws on a distinctive set of data sources centred on regulatory compliance and construction standards.<br><br><strong>Core data sources:</strong><ul><li><strong>Building Regulations and Approved Documents</strong> — the core technical standards governing compliance</li><li><strong>The Building Act 1984 and Building Safety Act 2022</strong> — the statutory framework for enforcement powers, notably reshaped by the Building Safety Act</li><li><strong>Local authority and Building Safety Regulator guidance</strong> — particularly relevant given the evolving higher-risk building regime</li><li><strong>RICS professional guidance</strong> — relevant to inspection, fire safety, and enforcement practice</li></ul><strong>Practical application:</strong><br>Given how significantly the regulatory landscape has shifted since the Building Safety Act 2022 — extended enforcement time limits, new compliance and stop notice powers, personal liability provisions for company officers — Building Control candidates should be able to explain not just the current rules, but which recent changes reshaped them, rather than relying on training or knowledge that predates these reforms."
  },
  {
    "h": "11B.6 Client Care in Building Control Practice",
    "body": "RICS client care standards apply to every pathway, but Building Control work involves a distinctive tension: the surveyor often has to give advice, and sometimes take enforcement action, that a client or building owner doesn't want to hear.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement (in the private sector) or clear communication of statutory role and process (in the public sector), agreed and confirmed before work begins</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent, professional communication when non-compliant work or a dangerous structure is identified</li><li>Managing expectations proactively where enforcement action may be necessary</li></ul><strong>Practical application:</strong><br>A common scenario at interview: an owner is unhappy that their completed work has been found non-compliant and now faces potentially costly remedial requirements. Good client care here means explaining the finding and the realistic options clearly and professionally — including the possibility of a regularisation certificate where relevant — without softening a genuine compliance issue to keep the client comfortable."
  },
  {
    "h": "11B.7 Business Planning in Building Control Practice",
    "body": "Whether you work for a local authority, a private registered building control approver, or a specialist consultancy, RICS expects every candidate to understand how their business or function sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee structures in a competitive market — since the introduction of competition in building control, public authorities and private approvers compete for instructions, changing the commercial dynamics of the sector</li><li>Resourcing and capacity planning — particularly relevant given the volume and unpredictability of inspection demand</li><li>Business development — how a Building Control function or private practice wins and retains instructions</li><li>Risk management at the business level — professional indemnity and liability considerations given the public safety dimension of the role</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your organisation prices and resources building control instructions, and how it competes (or operates, in the public sector context) within the current market structure. Assessors are testing commercial awareness specific to this pathway's distinctive market."
  },
  {
    "h": "11B.8 Conflict Avoidance in Building Control Practice",
    "body": "Building Control work generates a distinctive pattern of dispute — disagreements over compliance findings, enforcement notices, and dangerous structure determinations are all common, sometimes escalating to formal appeal.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common dispute scenarios — disagreement over whether work complies with regulations, disputes over enforcement notices, and appeals against Section 35 or Section 36 notices</li><li>The formal appeal route — appeals against certain notices can be made, generally within a set time limit, to the appropriate court or tribunal</li><li>Understanding statutory time limits precisely — several distinct deadlines apply to different enforcement mechanisms under the Building Act 1984, and confusing them is a common and serious error</li></ul><strong>Practical application:</strong><br>A frequent scenario: an owner disputes an enforcement notice, believing too much time has passed for the local authority to act. Assessors want you to explain the correct current time limits precisely — and to recognise that recent legislative change (the Building Safety Act 2022) significantly altered these limits, meaning outdated assumptions can lead to seriously wrong advice."
  },
  {
    "h": "11B.9 Sustainability in Building Control Practice",
    "body": "Sustainability is directly relevant to Building Control, given the pathway's role in checking compliance with energy conservation and environmental standards at every stage of construction.<br><br><strong>Key areas:</strong><ul><li><strong>Energy conservation compliance</strong> — a core part of the Building Regulations that Building Control surveyors check and enforce</li><li><strong>Sustainable material and construction method assessment</strong> — relevant when assessing alternative solutions for regulatory compliance</li><li><strong>Life cycle cost considerations</strong> — relevant when advising on sustainability-related design or remedial options</li><li><strong>Regulatory evolution</strong> — building regulations relating to energy performance and sustainability are updated periodically, requiring Building Control surveyors to stay current</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would assess and advise on a sustainability-related compliance question — for example, an alternative construction method proposed to meet energy conservation requirements — explaining both the regulatory compliance angle and the broader sustainability implications."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Building Control — an enforcement notice time limit query, a dangerous structure assessment, a disputed compliance finding, a sustainability-related compliance question — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on enforcement time limits or recent Building Safety Act changes, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Building Control-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Building Control pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>An owner believes it's too late for the local authority to serve an enforcement notice on unauthorised work completed 18 months ago. Is this correct, and why?</li><li>Explain the health and safety considerations specific to inspecting a potentially dangerous structure.</li><li>An owner disputes a compliance finding and is unhappy about the potential cost of remedial works. How would you handle this conversation?</li><li>Describe how your organisation prices and resources building control instructions in a competitive market.</li><li>Explain a sustainability-related compliance question you might be asked to assess, and how you would approach it.</li><li>Outline the difference between the time limits for prosecuting a building regulations contravention and for serving an enforcement notice requiring its removal.</li><li>Describe the process and criteria for assessing a proposed alternative construction solution against building regulations requirements.</li><li>Explain the appeal process available to an owner who disputes an enforcement notice.</li><li>How would you approach the inspection and assessment of a fire-damaged structure, balancing thoroughness with personal safety?</li><li>Explain why all Building Control candidates receive the \"Chartered Building Control Surveyor\" designation automatically, unlike most other pathways.</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Building Control",
  "h": "12.21 Section 36 Enforcement Notice Time Limit — Building Control Pathway",
  "body": "<strong>An owner argues that a Section 36 enforcement notice can no longer be served on their unauthorised building work because more than 12 months have passed since completion. Talk me through whether they're correct.</strong><br><br><em>Tests: Legal/regulatory compliance, Building control inspections, Risk management. Tests currency of knowledge on a recently changed area of law — one of the most frequently tested Building Control scenarios.</em><br><br><strong>The model answer</strong> corrects a genuinely common and dangerous misconception — the 12-month time limit the owner is relying on was replaced by a 10-year limit under the Building Safety Act 2022, and getting this wrong could mean wrongly advising a client that they're safe from enforcement when they aren't.<br><br><strong>Key elements:</strong><br><br><strong>1. The old 12-month limit is no longer current law.</strong> Before the Building Safety Act 2022, a Section 36 enforcement notice couldn't be served more than 12 months after completion of the contravening work — but this was extended to 10 years, effective from 1 October 2023 (with slightly different timing for Wales). Advice based on the old 12-month rule is now simply wrong.<br><br><strong>2. Don't confuse this with the separate prosecution time limit.</strong> A different, shorter time limit applies to prosecuting the underlying contravention as an offence under Section 35 — generally six months from when the offence occurred — which is a genuinely separate mechanism from the Section 36 enforcement notice route, and conflating the two is a common candidate error.<br><br><strong>3. The notice mechanism itself hasn't changed.</strong> A Section 36 notice still requires the owner to alter or remove non-compliant work, and if they don't comply, the authority can carry out the work itself and recover the cost — what changed is how long the authority has to act, not the substance of what the notice requires.<br><br><strong>4. Some exceptions still apply.</strong> A Section 36 notice generally can't be served where plans were properly deposited, the work matches those plans, and it was executed in accordance with any conditions the authority imposed when passing the plans — a specific statutory protection worth knowing precisely, not just in outline.<br><br><strong>5. Injunction powers sit outside this time limit entirely.</strong> Separately from the Section 36 notice mechanism, a local authority (or others) can apply for an injunction to require removal of non-compliant work — and this route isn't subject to the same time limit, though it's typically reserved for the most serious cases given the cost involved.<br><br><strong>6. Advise based on current law, not outdated training.</strong> Given how significant this change is, and how recently it came into force, a Building Control surveyor giving advice based on stale knowledge could seriously mislead a client about their actual risk exposure.<br><br><strong>How to frame this:</strong><br><br><em>\"I corrected the assumption immediately — the 12-month limit was extended to 10 years under the Building Safety Act 2022, so the notice could still validly be served.\"</em><br><br><em>\"I made sure not to conflate the Section 36 enforcement time limit with the separate, shorter Section 35 prosecution time limit, since they're genuinely different mechanisms.\"</em><br><br><em>\"I checked whether the specific plans-deposited exception applied here before confirming the notice could be served.\"</em><br><br><strong>Three things assessors tick:</strong> 1) correctly identifying the current 10-year time limit rather than the outdated 12-month rule, 2) distinguishing the enforcement notice route from the separate prosecution time limit, 3) checking for the specific statutory exception before giving definitive advice.<br><br><strong>This is exactly the kind of area where relying on training from a few years ago gives dangerously wrong advice. Assessors are testing whether you actively keep your legal knowledge current, not just whether you learned the rules once.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":35,"num":"11B","title":"Building Control Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#881337",'
    '"intro":"Building Control surveyors carry a direct public safety responsibility — ensuring building regulations are followed at every stage of design and construction, and stepping in decisively when they aren\'t. This module sharpens every mandatory competency through the specific lens of Building Control practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:35 after id:34
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":34,"num":"11B"'
assert html.count(old1) == 1
idx34 = html.index(old1)
close_idx = html.index('}];', idx34)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:35 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bLR = MODULES.find(m => m.id === 34);"
new2 = ("const _m11bLR = MODULES.find(m => m.id === 34);\n"
        "const _m11bBC = MODULES.find(m => m.id === 35);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isLRDash = _m11bLR && _dashPathway === 'Land and Resources' && plan !== 'sprint';"
new2b = ("const _isLRDash = _m11bLR && _dashPathway === 'Land and Resources' && plan !== 'sprint';\n"
         "const _isBCDash = _m11bBC && _dashPathway === 'Building Control' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isLRDash ? [..._base.filter(m => m.id <= 11), _m11bLR, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isLRDash ? [..._base.filter(m => m.id <= 11), _m11bLR, ..._base.filter(m => m.id >= 12)]"
        " : _isBCDash ? [..._base.filter(m => m.id <= 11), _m11bBC, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Land and Resources' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:34, code:'11B', label:'L&R pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Land and Resources' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:34, code:'11B', label:'L&R pathway prep'});\n"
        "    } else if (_stripPathway === 'Building Control' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:35, code:'11B', label:'BC pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isLR = _p === 'Land and Resources' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isLR = _p === 'Land and Resources' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isBC = _p === 'Building Control' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks (id:35, id:11+_isBC, id:12+_isBC)
# ─────────────────────────────────────────────────────────────────────────────
old6a = ("        } else if (id === 34) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 34) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 35) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

old6b = ("        } else if (id === 11 && _isLR) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(34, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(34)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isLR) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(34, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(34)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isBC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(35, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(35)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

old6c = ("        } else if (id === 12 && _isLR) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(34)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isLR) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(34)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isBC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(35)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:35, id:11+_isBC, id:12+_isBC)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = ("m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || "
        "m.id === 26 || m.id === 27 || m.id === 28 || m.id === 29 || m.id === 30 || m.id === 31 || "
        "m.id === 32 || m.id === 33 || m.id === 34")
new7 = old7 + " || m.id === 35"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 35
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 34) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Land and Resources') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 34) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Land and Resources') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 35) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Building Control') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:35 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after L&R section (last before quiz)
# ─────────────────────────────────────────────────────────────────────────────
lr_end_anchor = "shapes the ultimate risk.</strong>\"}],\"quiz\":["
assert html.count(lr_end_anchor) == 1, f"Change 9 anchor count: {html.count(lr_end_anchor)}"
html = html.replace(
    lr_end_anchor,
    'shapes the ultimate risk.</strong>"},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 BC pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":35' in html
assert '"Building Control Pathway — Professional Practice' in html
assert '"pathwayOnly":"Building Control"' in html
assert 'modId === 35' in html
assert "_isBC = _p === 'Building Control'" in html
assert '_isBCDash' in html
assert 'm.id === 35' in html
assert "id:35, code:'11B'" in html
bc_count = html.count('"pathwayOnly":"Building Control"')
assert bc_count == 1, f"Expected 1 BC pathwayOnly, found {bc_count}"
lr_count = html.count('"pathwayOnly":"Land and Resources"')
assert lr_count == 1, f"L&R pathwayOnly disturbed: found {lr_count}"
total_pathwayonly = html.count('"pathwayOnly":')
print(f"BC pathwayOnly count: {bc_count} ✓  L&R pathwayOnly count: {lr_count} ✓")
print(f"Total pathwayOnly sections in M12: {total_pathwayonly}")
print("All assertions passed ✓")
