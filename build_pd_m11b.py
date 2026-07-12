import json, re

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

assert html.count("pathway === 'Planning and Development'") >= 1 or \
       html.count("'Planning and Development'") >= 1, "P&D pathway string not found"
print("P&D pathway string confirmed: 'Planning and Development'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Planning and Development is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Planning and Development surveyors sit at the intersection of strategic policy and practical delivery — advising on everything from a single planning application to major regeneration and masterplanning schemes, working for both public authorities and private developers. Assessors expect candidates on this pathway to demonstrate not just technical competence in planning appraisal and development viability, but the procedural precision, commercial judgement, and public-interest awareness that this dual public/private role genuinely demands.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Planning and Development pathway and justify your competency selections</li><li>Apply health and safety principles specific to planning and development practice</li><li>Demonstrate working knowledge of accounting principles as they apply to Planning and Development</li><li>Identify and use the data sources and professional tools relied on by planning and development practitioners</li><li>Apply RICS client care standards to planning and development client relationships</li><li>Explain how a planning and development consultancy plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to planning-related scenarios</li><li>Discuss sustainability considerations specific to planning and development</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Planning and Development practice."
  },
  {
    "h": "11B.2 The Planning and Development Pathway: Structure and Competency Selection",
    "body": "The Planning and Development pathway spans strategic policy work and operational development activity — planning appraisal, development management, viability, and regeneration — across both public and private sectors.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competencies (Level 3):</strong> Development appraisals; and Planning and development management <em>or</em> Spatial planning policy and infrastructure (you select one of this pair as core).<br><br><strong>Core competencies (Level 2):</strong> Legal/regulatory compliance; Valuation.<br><br><strong>Core competencies (Level 1):</strong> Measurement; Surveying and mapping.<br><br><strong>Optional competencies:</strong> two to Level 3 from a broad list including Access and rights over land, BIM management, Cadastre and land administration, Compulsory purchase and compensation, Contaminated land, Design and specification, Development/project briefs, Economic development, Environmental assessment, Housing strategy and provision, Leasing/letting, Management and regeneration of the built environment, Masterplanning and urban design, Measurement, whichever of Planning and development management or Spatial planning policy and infrastructure wasn't chosen as core, Project finance, Purchase and sale, Risk management, Strategic real estate consultancy, Surveying and mapping, and Sustainability. Plus one further competency to Level 3, or two to Level 2, from the full technical list, including any not already chosen.<br><br><strong>Important variant:</strong> if you take Valuation to Level 3 (rather than the standard Level 2 core requirement), the optional structure changes — you then select one to Level 3 and one to Level 2 from the optional list, plus one to Level 3 or two to Level 2 from the full technical list.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive. Candidates on this pathway may gain experience in either the public or private sector, or a mixture of both.<br><br><em>Source: RICS Planning and Development Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Planning and Development candidates, Level 3 means being able to advise a client — public or private — on a genuinely complex planning or development decision with the same judgement and procedural precision you'd expect from a senior colleague, not simply describing the planning system."
  },
  {
    "h": "11B.3 Health and Safety in Planning and Development Practice",
    "body": "Planning and Development surveyors regularly visit development sites at all stages, from vacant land through active construction, each carrying different and evolving risks.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Construction (Design and Management) Regulations (CDM) — relevant where site visits coincide with active construction works</li><li>Site-specific hazards — including contamination, unstable ground, and partially demolished structures, all common on development sites</li></ul><strong>Practical application for Planning and Development candidates:</strong><br>Before any site visit, a competent practitioner assesses the specific risks of the site's current condition and stage of development — a vacant brownfield site with potential contamination carries very different risks to an active construction site mid-build. Lone site visits are common in this pathway, making a properly briefed lone-working policy — check-in protocols, shared location information, a clear escalation route — essential professional discipline.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered in your own planning and development work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Planning and Development Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and Planning and Development practice brings that knowledge into focus around development viability and public funding structures.<br><br><strong>Core areas relevant to Planning and Development candidates:</strong><ul><li><strong>Development viability</strong> — understanding how a scheme's financial viability is assessed and reported, including the relationship between residual land value, build cost, and required developer profit</li><li><strong>Public sector funding and grant accounting</strong> — understanding how grant funding, Community Infrastructure Levy (CIL) receipts, and Section 106 contributions are accounted for and reported</li><li><strong>Client money handling</strong> — where relevant to fee or deposit arrangements</li><li><strong>Business case financial appraisal</strong> — reading and interpreting the financial case for a development or regeneration scheme</li></ul><strong>Practical application:</strong><br>A Planning and Development surveyor preparing or reviewing a viability appraisal needs to be able to explain the key inputs driving the outcome — build cost assumptions, sales values, required profit margin — and be transparent about the sensitivity of the conclusion to changes in those assumptions, particularly where viability is being used to negotiate down affordable housing or Section 106 contributions."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Planning and Development Practice",
    "body": "Planning and Development practice draws on a distinctive set of data sources spanning planning policy, market, and site-specific information.<br><br><strong>Core data sources:</strong><ul><li><strong>Local plans, core strategies, and neighbourhood plans</strong> — the statutory planning policy framework relevant to any site</li><li><strong>Planning application and appeal databases</strong> — precedent decisions and appeal outcomes relevant to a specific proposal</li><li><strong>HM Land Registry and local authority records</strong> — title, ownership, and planning history</li><li><strong>Development viability and appraisal software</strong> — used to model residual land value and scheme viability</li><li><strong>Census, demographic, and economic data</strong> — used to inform housing need, economic development, and regeneration strategy work</li></ul><strong>Practical application:</strong><br>When preparing a planning appraisal, a surveyor should be able to explain which policy documents and precedent decisions were relied on, and how a specific site history or local context shaped the assessment — not simply list generic planning policy considerations without connecting them to the specific site in question."
  },
  {
    "h": "11B.6 Client Care in Planning and Development Practice",
    "body": "RICS client care standards apply to every pathway, but Planning and Development work often involves a genuinely varied client base — from individual developers and landowners to local authorities, government agencies, and community groups, sometimes with directly opposing interests on the same scheme.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement agreed and confirmed in writing before work begins</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures appropriate to the nature of the instruction, whether public or private sector</li><li>Managing expectations proactively, particularly around planning outcomes that are inherently uncertain and outside the surveyor's control</li></ul><strong>Practical application:</strong><br>A common Planning and Development scenario at interview: a client is frustrated that a planning application has been refused or significantly delayed. Good client care here means having clearly explained from the outset that planning outcomes carry genuine uncertainty, and now explaining the realistic options — resubmission, appeal, or negotiation — professionally and honestly, rather than either overpromising a future outcome or leaving the client without a clear way forward."
  },
  {
    "h": "11B.7 Business Planning in Planning and Development Practice",
    "body": "Whether you work for a planning consultancy, a developer, or a local authority, RICS expects every candidate to understand how their business or function sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee income models specific to Planning and Development — fixed fees, percentage of development value, or success-based fees tied to planning outcomes, each carrying different commercial and ethical considerations</li><li>Resourcing and capacity planning — planning instructions can run over long, uncertain timeframes given the unpredictability of the planning process</li><li>Managing conflicts of interest — particularly relevant where a success-based fee structure could create pressure around the advice given</li><li>Public sector business planning — where relevant, understanding budget cycles and resourcing constraints distinct from private consultancy</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your practice or team resources long-running, uncertain planning instructions, and how any success-based fee arrangements are structured and disclosed to avoid a conflict of interest. Assessors are testing commercial and ethical awareness together."
  },
  {
    "h": "11B.8 Conflict Avoidance in Planning and Development Practice",
    "body": "Planning and Development work generates disputes distinct in character from other pathways — disagreements over planning policy interpretation, viability assumptions, and Section 106/CIL contributions are all common, often between a developer and a local authority.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common dispute scenarios — disagreement over viability assessment assumptions, planning appeal proceedings, and disputes over CIL or Section 106 obligation compliance</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; formal appeal (to the Planning Inspectorate) or litigation as a last resort</li><li>Understanding formal, statutory deadlines — planning and development work involves several strict procedural deadlines where missing them has real financial or legal consequences, regardless of the merits of the underlying case</li></ul><strong>Practical application:</strong><br>A frequent scenario: a client disputes a local authority's viability assessment that has significantly reduced the affordable housing contribution the authority is willing to accept. Assessors want you to explain how you would review and challenge the assumptions professionally, negotiate a resolution, and know when escalation to appeal is the appropriate route — not simply accept or reject the authority's position without a reasoned basis."
  },
  {
    "h": "11B.9 Sustainability in Planning and Development Practice",
    "body": "Sustainability sits close to the centre of modern planning and development practice, shaping policy requirements, viability, and development design simultaneously.<br><br><strong>Key areas:</strong><ul><li><strong>Sustainability within planning policy</strong> — increasingly embedded as a requirement within local plans and national planning policy, not a separate add-on consideration</li><li><strong>Whole-life carbon in development appraisal</strong> — a growing consideration in assessing and comparing development options</li><li><strong>Environmental assessment</strong> — understanding when and how a formal Environmental Impact Assessment is required, and its role in the planning process</li><li><strong>Sustainability and viability tension</strong> — sustainability requirements can materially affect a scheme's viability, requiring genuine trade-off analysis rather than treating either as fixed</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would advise a client where a local authority's sustainability policy requirements are placing pressure on scheme viability — explaining the genuine trade-off involved and giving a reasoned recommendation, rather than treating sustainability compliance as simply non-negotiable or dismissing it as an obstacle to be minimised."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Planning and Development — a viability dispute, a CIL or Section 106 compliance issue, a planning appeal decision, a sustainability-versus-viability trade-off — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on viability or statutory procedure scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Planning and Development-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Planning and Development pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>A client is frustrated that a planning application has been refused. How would you advise them on their realistic options, consistent with RICS client care standards?</li><li>Explain the key inputs that drive a residual development viability appraisal, and how sensitive the outcome is to changes in those assumptions.</li><li>A local authority's viability assessment has significantly reduced the affordable housing contribution it's willing to accept. How would you review and challenge this professionally?</li><li>Outline a scenario where sustainability policy requirements placed pressure on a scheme's viability, and how you would advise a client through that trade-off.</li><li>Describe the process and timing considerations involved in submitting a CIL Commencement Notice, and the consequences of missing the deadline.</li><li>Explain the health and safety considerations you would apply before visiting a partially developed brownfield site.</li><li>How would a success-based fee structure on a planning instruction create a potential conflict of interest, and how would you manage it?</li><li>Describe how you would use precedent planning decisions and appeal outcomes to inform a planning appraisal for a specific site.</li><li>Explain the process of escalating a planning dispute to appeal, and when this is the appropriate course of action rather than continued negotiation.</li><li>How would you assess and report on the environmental impact of a proposed development, and when would a formal Environmental Impact Assessment be required?</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Planning and Development",
  "h": "12.16 CIL Commencement Notice Deadline — Planning and Development Pathway",
  "body": "<strong>Your client is due to start development in two days' time, and you realise the Community Infrastructure Levy Commencement Notice hasn't been submitted yet. Talk me through what you would do, and why the timing matters so much.</strong><br><br><em>Tests: Legal/regulatory compliance, Accounting principles, Risk management. One of the most frequently tested Planning and Development scenarios.</em><br><br><strong>The model answer</strong> treats the Commencement Notice deadline as an absolute, unforgiving procedural requirement — under Regulation 67 of the CIL Regulations 2010, the notice must reach the authority no later than the day before development starts, and the regulations are strict even where a genuine mistake was made.<br><br><strong>Key elements:</strong><br><br><strong>1. The deadline is absolute, not a guideline.</strong> The Commencement Notice must be received by the collecting authority no later than the day before the day development commences — there's no grace period, and the Planning Inspectorate has upheld surcharges even where an applicant sent an informal letter expressing clear intent, because it wasn't in the correct form.<br><br><strong>2. The consequence is a genuine financial penalty.</strong> If the notice isn't submitted in time, the authority must impose a surcharge equal to 20% of the chargeable amount or £2,500, whichever is lower — and the client also loses the ability to pay by instalments, meaning the full liability becomes due immediately.<br><br><strong>3. Submitting the right form, to the right place, matters as much as timing.</strong> A notice submitted to the wrong department (such as building control rather than the actual collecting authority function) has been held not to satisfy the requirement — it needs to reach the correct collecting authority function, in the prescribed form.<br><br><strong>4. Get written acknowledgement.</strong> Given how strict and unforgiving these regulations are, obtaining the authority's written acknowledgement of receipt is essential — without it, a dispute over whether the notice was properly received becomes very difficult to win.<br><br><strong>5. This is urgent, not optional admin.</strong> With two days remaining, submitting the correctly completed notice today, to the confirmed correct address, and chasing written confirmation of receipt, is the immediate priority — not something to fit in once other tasks are cleared.<br><br><strong>6. Once development starts, it's too late to fix.</strong> Once development commences, the CIL liability becomes fixed and generally can't be challenged under the regulations — there's no opportunity to correct a missed notice retrospectively.<br><br><strong>How to frame this:</strong><br><br><em>I treated this as an immediate priority rather than routine admin, given how unforgiving the CIL regulations are around timing.</em><br><br><em>I confirmed exactly which authority function the notice needed to go to, since submitting it to the wrong department wouldn't satisfy the requirement.</em><br><br><em>I made sure we obtained written acknowledgement of receipt from the authority, rather than just assuming the notice had been properly received.</em><br><br><strong>Three things assessors tick:</strong> 1) understanding that the deadline is absolute with no grace period, 2) recognising the genuine financial consequence — surcharge plus loss of instalment payment rights, 3) prioritising written confirmation of receipt, not just submission.<br><br><strong>The CIL regulations don't care whether missing the deadline was a genuine oversight — the surcharge applies regardless. Assessors are testing whether you treat this with the procedural seriousness it demands, not whether you know CIL exists in the abstract.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":30,"num":"11B","title":"Planning and Development Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#4d7c0f",'
    '"intro":"Planning and Development surveyors work at the intersection of policy and delivery, advising across public and private sectors on everything from individual applications to major regeneration schemes. This module sharpens every mandatory competency through the specific lens of Planning and Development practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:30 after id:29
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":29,"num":"11B"'
assert html.count(old1) == 1
idx29 = html.index(old1)
close_idx = html.index('}];', idx29)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:30 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bFM = MODULES.find(m => m.id === 29);"
new2 = ("const _m11bFM = MODULES.find(m => m.id === 29);\n"
        "const _m11bPD = MODULES.find(m => m.id === 30);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isFMDash = _m11bFM && _dashPathway === 'Facility Management' && plan !== 'sprint';"
new2b = ("const _isFMDash = _m11bFM && _dashPathway === 'Facility Management' && plan !== 'sprint';\n"
         "const _isPDDash = _m11bPD && _dashPathway === 'Planning and Development' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isFMDash ? [..._base.filter(m => m.id <= 11), _m11bFM, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isFMDash ? [..._base.filter(m => m.id <= 11), _m11bFM, ..._base.filter(m => m.id >= 12)]"
        " : _isPDDash ? [..._base.filter(m => m.id <= 11), _m11bPD, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Facility Management' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:29, code:'11B', label:'FM pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Facility Management' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:29, code:'11B', label:'FM pathway prep'});\n"
        "    } else if (_stripPathway === 'Planning and Development' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:30, code:'11B', label:'P&D pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isFM = _p === 'Facility Management' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isFM = _p === 'Facility Management' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isPD = _p === 'Planning and Development' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks
# ─────────────────────────────────────────────────────────────────────────────
old6a = ("        } else if (id === 29) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 29) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 30) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a: {html.count(old6a)}"
html = html.replace(old6a, new6a)

old6b = ("        } else if (id === 11 && _isFM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(29, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(29)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isFM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(29, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(29)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isPD) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(30, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(30)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b: {html.count(old6b)}"
html = html.replace(old6b, new6b)

old6c = ("        } else if (id === 12 && _isFM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(29)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isFM) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(29)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isPD) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(30)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:30, id:11+_isPD, id:12+_isPD)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26 || m.id === 27 || m.id === 28 || m.id === 29"
new7 = old7 + " || m.id === 30"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 30
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 29) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Facility Management') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 29) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Facility Management') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 30) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Planning and Development') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:30 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after FM section (last before quiz)
# ─────────────────────────────────────────────────────────────────────────────
fm_end_anchor = 'the regulations.</strong>"}],"quiz":['
assert html.count(fm_end_anchor) == 1, f"Change 9 anchor: {html.count(fm_end_anchor)}"
html = html.replace(
    fm_end_anchor,
    'the regulations.</strong>"},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 P&D pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":30' in html
assert '"Planning and Development Pathway — Professional Practice' in html
assert '"pathwayOnly":"Planning and Development"' in html
assert 'modId === 30' in html
assert "_isPD = _p === 'Planning and Development'" in html
assert '_isPDDash' in html
assert 'm.id === 30' in html
assert "id:30, code:'11B'" in html
pd_count = html.count('"pathwayOnly":"Planning and Development"')
assert pd_count == 1, f"Expected 1 P&D pathwayOnly, found {pd_count}"
fm_count = html.count('"pathwayOnly":"Facility Management"')
assert fm_count == 1, f"FM pathwayOnly disturbed: found {fm_count}"
print(f"P&D pathwayOnly count: {pd_count} ✓  FM pathwayOnly count: {fm_count} ✓")
print("All assertions passed ✓")
