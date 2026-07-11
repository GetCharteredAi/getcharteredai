import json, re

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Project Management is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Project managers occupy a central, coordinating role across the entire development process — appointed early, developing the brief, assembling and leading the project team, and representing the client's interests through to completion. Assessors expect Project Management candidates to demonstrate not just technical competence in programming, procurement, and cost control, but the leadership, judgement, and stakeholder management skill that this coordinating role genuinely demands.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Project Management pathway and justify your competency selections</li><li>Apply health and safety principles specific to project management practice</li><li>Demonstrate working knowledge of accounting principles as they apply to Project Management</li><li>Identify and use the data sources and professional tools relied on by project managers</li><li>Apply RICS client care standards to project management client relationships</li><li>Explain how a project management consultancy plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to project management scenarios</li><li>Discuss sustainability considerations specific to project management practice</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Project Management practice."
  },
  {
    "h": "11B.2 The Project Management Pathway: Structure and Competency Selection",
    "body": "The Project Management pathway centres on the coordinating role project managers play across the whole development process — from developing the client brief, through team assembly and procurement, to delivery and completion.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core Project Management competencies (Level 3):</strong><br>Contract practice, Development/project briefs, Leading projects/people and teams, Managing projects, Programming and planning.<br><br><strong>Core Project Management competencies (Level 2):</strong><br>Construction technology and environmental services, Procurement and tendering, Project finance.<br><br><strong>Optional competencies:</strong> one to Level 2 from a group including Accounting principles and procedures, Communication and negotiation (which must be taken to Level 3 if chosen here), Conflict avoidance, or Sustainability — you elevate only one of these to a higher level, not all four. Beyond that group, the optional list includes BIM management, Commercial management, Consultancy Services, Contract administration, Development appraisals, Legal/regulatory compliance, Maintenance management, Performance management, Purchase and sale, Stakeholder management, Supplier management, and Works progress and quality management — plus one further competency to Level 2 from the full technical list, including any not already chosen.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive.<br><br><em>Source: RICS Project Management Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Project Management candidates, Level 3 means being able to lead a project decision with the confidence and judgement of a senior colleague — coordinating and advising across the whole project team, not just managing your own piece of the work."
  },
  {
    "h": "11B.3 Health and Safety in Project Management Practice",
    "body": "Project managers sit across the whole project lifecycle and often across the whole site team, giving them a distinctive, overarching health and safety responsibility even where they aren't the principal contractor or designer.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Construction (Design and Management) Regulations (CDM) — of central relevance to project managers, given their role in coordinating design and construction across multiple parties</li><li>Sector- and project-specific regulation, depending on the type of scheme being delivered</li></ul><strong>Practical application for project managers:</strong><br>A competent project manager understands their specific duties (and those of other duty-holders) under CDM, and actively coordinates health and safety information flow between designers, contractors, and the client throughout the project lifecycle — rather than assuming it's solely the principal contractor's responsibility once construction starts.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered in your own project management work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Project Management Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and project management practice brings that knowledge into focus around project cost control and client financial reporting.<br><br><strong>Core areas relevant to Project Management candidates:</strong><ul><li><strong>Reading company accounts</strong> — assessing the financial standing of consultants, contractors, or clients where relevant to project decisions (e.g. assessing a contractor's financial stability before appointment)</li><li><strong>Cash flow and cost reporting</strong> — preparing and interpreting project cash flows and cost reports for client presentation</li><li><strong>Common financial measures</strong> — understanding metrics such as return on capital employed and gearing ratio where relevant to advising a client or assessing a counterparty</li><li><strong>Service charge and management accounts</strong> — where relevant to a specific project or role</li></ul><strong>Practical application:</strong><br>A project manager assessing whether to recommend a particular contractor for appointment needs to be able to read the headline indicators in that contractor's accounts — not perform a full credit analysis, but understand what a declining net asset position or a qualified auditor's opinion might signal, and know when to escalate to a formal financial check."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Project Management Practice",
    "body": "Project management practice draws on data sources spanning programme, cost, and delivery information.<br><br><strong>Core data sources:</strong><ul><li><strong>Programme and scheduling software</strong> — Gantt chart and critical path analysis tools used to build and monitor project programmes</li><li><strong>Cost and benchmarking data</strong> — historical project data used to inform cost planning and reporting</li><li><strong>BIM models and information exchange platforms</strong> — increasingly central to coordinating design information across a multidisciplinary project team</li><li><strong>RICS professional guidance</strong> — relevant to project controls, procurement, and contract administration</li><li><strong>Project management information systems</strong> — used for document control, reporting, and audit trail purposes across the project lifecycle</li></ul><strong>Practical application:</strong><br>When reporting project progress to a client, a project manager should be able to explain not just the current status but the trend — is the project accelerating, on track, or slipping — and the specific data supporting that assessment. Assessors want to see that you use data to inform genuine judgement, not just to produce a status report."
  },
  {
    "h": "11B.6 Client Care in Project Management Practice",
    "body": "RICS client care standards apply to every pathway, but project management work often involves representing the client's interests across a large team of consultants and contractors, making transparent, structured communication especially important.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement agreed and confirmed in writing before work begins, including the scope of the project manager's authority to act on the client's behalf</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures appropriate to the nature and duration of the instruction</li><li>Proactive, structured reporting appropriate to a role that sits across the whole project team, so the client always has a clear, honest picture of progress</li></ul><strong>Practical application:</strong><br>A common Project Management scenario at interview: a client is unhappy that a project has fallen behind programme, and questions why they weren't warned sooner. Good client care here means having a structured, honest reporting regime from the outset that surfaces problems early — not a reporting process that only confirms good news and leaves bad news to be discovered late."
  },
  {
    "h": "11B.7 Business Planning in Project Management Practice",
    "body": "Whether you work for a large multidisciplinary consultancy, a specialist project management practice, or in-house for a client organisation, RICS expects every candidate to understand how their business sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee income models specific to project management — often fixed fee, percentage of construction cost, or resource-based fees depending on the nature of the instruction</li><li>Resourcing and capacity planning — project management instructions can run over long periods and require consistent team continuity</li><li>Risk management at the business level — professional indemnity insurance considerations given the coordinating, advisory nature of the role</li><li>Repeat client and framework relationships — many project management practices operate under long-term client relationships, which shapes business planning differently to one-off instructions</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your practice resources a project management instruction and maintains continuity of client relationship and project knowledge over its full duration. Assessors are testing commercial awareness — do you understand the business you work in, not just the technical work you do within it."
  },
  {
    "h": "11B.8 Conflict Avoidance in Project Management Practice",
    "body": "Project managers sit at the centre of a multi-party project team, making them frequently the first point of contact for emerging disputes between consultants, contractors, and the client.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Early identification of dispute risk — performance failures, contract variations, payment disputes, and contractual interpretation disagreements are all common flashpoints</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; adjudication (common under construction contracts) &#x2192; arbitration or litigation as a last resort</li><li>Active negotiation on behalf of clients — project managers frequently negotiate directly on issues like extensions of time or loss and expense claims before any third-party referral is needed</li></ul><strong>Practical application:</strong><br>A frequent scenario: a contractor raises a claim for loss and expense that the project manager believes is only partially justified. Assessors want you to explain how you would investigate the claim, negotiate a fair resolution, and know when to escalate to formal dispute resolution if agreement can't be reached — not simply accept or reject the claim outright."
  },
  {
    "h": "11B.9 Sustainability in Project Management Practice",
    "body": "Sustainability is central to modern project management, affecting design decisions, procurement strategy, and whole-life project value.<br><br><strong>Key areas:</strong><ul><li><strong>Whole-life carbon and cost analysis</strong> — increasingly required as part of project appraisal and reporting</li><li><strong>Sustainability rating schemes</strong> — familiarity with frameworks such as BREEAM, LEED, SKA Rating, and Passivhaus, and how they're incorporated into project delivery</li><li><strong>Sustainable material and construction method selection</strong> — balancing sustainability performance against cost and programme</li><li><strong>Regulatory and policy drivers</strong> — understanding how national and international sustainability legislation and taxation affect construction project decisions</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would advise a client balancing a sustainability rating target (e.g. a specific BREEAM rating) against cost and programme pressures — explaining the trade-offs involved and giving a reasoned recommendation, rather than treating the sustainability target as a fixed, non-negotiable constraint or an optional extra."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Project Management — a slipping programme, a contested loss and expense claim, a team structure decision, a sustainability-versus-cost trade-off — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on contract administration or dispute scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Project Management-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Project Management pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>A client is unhappy that a project has fallen behind programme and asks why they weren't warned sooner. How would you respond, and what does this tell you about your own reporting regime?</li><li>A contractor raises a loss and expense claim you believe is only partially justified. How would you investigate and negotiate a resolution?</li><li>Explain your specific duties under the Construction (Design and Management) Regulations as a project manager, and how you coordinate health and safety information across the project team.</li><li>Outline how you would advise a client on the appropriate procurement route for a specific project, and the factors that would inform your recommendation.</li><li>Describe how you would build and manage a project programme, including your approach to identifying and communicating the critical path.</li><li>Explain how you would assess a contractor's financial standing before recommending their appointment.</li><li>A client wants to hit a specific sustainability rating target but is under significant cost pressure. How would you advise them?</li><li>Describe the fee structure your practice uses for project management instructions, and how you manage continuity of knowledge on a long-running project.</li><li>Explain how you would advise on the structure and make-up of a project delivery team for a complex scheme.</li><li>What data would you use to report project progress to a client, and how would you communicate whether a project is trending on track, ahead, or behind?</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")

module_entry = (
    '{"id":28,"num":"11B","title":"Project Management Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#0369a1",'
    '"intro":"Project managers coordinate the full development process on behalf of the client — from brief to completion. This module sharpens every mandatory competency through the specific lens of Project Management practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:28 after id:27 closing }];
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":27,"num":"11B"'
assert html.count(old1) == 1
idx27 = html.index(old1)
close_idx = html.index('}];', idx27)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:28 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bRes = MODULES.find(m => m.id === 27);"
new2 = ("const _m11bRes = MODULES.find(m => m.id === 27);\n"
        "const _m11bPM = MODULES.find(m => m.id === 28);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isResDash = _m11bRes && _dashPathway === 'Residential' && plan !== 'sprint';"
new2b = ("const _isResDash = _m11bRes && _dashPathway === 'Residential' && plan !== 'sprint';\n"
         "const _isPMDash = _m11bPM && _dashPathway === 'Project Management' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isResDash ? [..._base.filter(m => m.id <= 11), _m11bRes, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isResDash ? [..._base.filter(m => m.id <= 11), _m11bRes, ..._base.filter(m => m.id >= 12)]"
        " : _isPMDash ? [..._base.filter(m => m.id <= 11), _m11bPM, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Residential' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:27, code:'11B', label:'Residential pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Residential' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:27, code:'11B', label:'Residential pathway prep'});\n"
        "    } else if (_stripPathway === 'Project Management' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:28, code:'11B', label:'PM pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isRes = _p === 'Residential' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isRes = _p === 'Residential' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isPM = _p === 'Project Management' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks
# ─────────────────────────────────────────────────────────────────────────────
# 6a: id===28 after id===27
old6a = ("        } else if (id === 27) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 27) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 28) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a: {html.count(old6a)}"
html = html.replace(old6a, new6a)

# 6b: id===11 && _isPM after id===11 && _isRes
old6b = ("        } else if (id === 11 && _isRes) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(27, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(27)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isRes) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(27, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(27)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isPM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(28, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(28)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b: {html.count(old6b)}"
html = html.replace(old6b, new6b)

# 6c: id===12 && _isPM after id===12 && _isRes
old6c = ("        } else if (id === 12 && _isRes) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(27)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isRes) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(27)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isPM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(28)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:28, id:11+_isPM, id:12+_isPM)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26 || m.id === 27"
new7 = old7 + " || m.id === 28"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 28
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 27) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Residential') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 27) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Residential') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 28) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Project Management') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1, f"Change 8: {html.count(old8)}"
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:28 added")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 8 changes applied. File size: {len(html):,} chars")

assert '"id":28' in html
assert '"Project Management Pathway — Professional Practice' in html
assert 'modId === 28' in html
assert '_isPM =' in html
assert '_isPMDash' in html
assert 'm.id === 28' in html
assert "id:28, code:'11B'" in html
# Confirm no new pathwayOnly was added for PM (it already exists)
import re
pm_sections = [m.group(1) for m in re.finditer(r'"pathwayOnly":"([^"]+)"', html)]
pm_count = pm_sections.count('Project Management')
assert pm_count == 1, f"Expected 1 PM pathwayOnly, found {pm_count}"
print(f"PM pathwayOnly count: {pm_count} (correct — pre-existing, not duplicated)")
print("All assertions passed ✓")
