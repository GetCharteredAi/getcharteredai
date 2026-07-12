import json

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

assert html.count("'Land and Resources'") >= 1, "L&R pathway string not found"
print("L&R pathway string confirmed: 'Land and Resources'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Land and Resources is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Land and Resources is one of the broadest RICS pathways, combining environmental, geospatial, minerals and waste management, planning and development, and rural expertise into a single \"land professional\" chartered surveyor. Assessors expect candidates on this pathway to demonstrate not just deep technical competence in their chosen specialism, but the breadth of professional judgement, procedural precision, and stakeholder management skill that comes with advising across the entire land and property lifecycle — from registration and mapping through to development, remediation, and re-use.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Land and Resources pathway and justify your competency selections</li><li>Apply health and safety principles specific to land and resources practice</li><li>Demonstrate working knowledge of accounting principles as they apply to this pathway</li><li>Identify and use the data sources and professional tools relied on by land and resources practitioners</li><li>Apply RICS client care standards to land and resources client relationships</li><li>Explain how a land and resources practice plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to relevant scenarios</li><li>Discuss sustainability considerations specific to land and resources</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Land and Resources practice."
  },
  {
    "h": "11B.2 The Land and Resources Pathway: Structure and Competency Selection",
    "body": "The Land and Resources pathway is designed to be applicable across a wide-ranging group of land and resource-related sectors, combining the best of the environmental, geospatial surveying, minerals and waste management, planning and development, and rural professional groups.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br>Unlike many other pathways, Land and Resources doesn't split into separate \"core\" and \"optional\" categories — instead, you select <strong>five competencies to Level 3 and one to Level 2</strong> from a single broad technical list: Access and rights over land, Agriculture, Big data, Cadastre and land administration, Client care (must be taken to Level 3 if chosen here), Compulsory purchase and compensation, Consultancy services, Contaminated land, Development appraisals, Economic development, Energy and renewable resources, Engineering surveying, Environmental management, Geodesy, GIS, Hydrographic surveying, Inspection, Land use and diversification, Landlord and tenant, Legal/regulatory compliance, Management of the natural environment and landscape, Masterplanning and urban design, Measurement, Minerals management, Planning and development management, Property management, Risk management, Smart cities and intelligent buildings, Spatial planning policy and infrastructure, Strategic real estate consultancy, Surveying and mapping, Sustainability, Valuation, and Waste management.<br><br>Plus two further competencies to Level 2 from the full list of technical competencies, including any not already chosen.<br><br>RICS identifies 12 competencies as the primary skillset for a \"land professional\" worth considering first: access and rights over land, cadastre and land administration, compulsory purchase and compensation, GIS, inspection, landlord and tenant, legal/regulatory compliance, planning and development management, property management, surveying and mapping, sustainability, and valuation.<br><br><strong>Chartered alternative designations</strong> are available for candidates taking specific competencies to Level 3: Engineering surveying → Chartered Engineering Surveyor; Environmental management → Chartered Environmental Surveyor; Hydrographic surveying → Chartered Hydrographic Surveyor; Minerals management or Waste management → Chartered Minerals Surveyor; Planning and development management or Spatial planning policy and infrastructure → Chartered Planning and Development Surveyor; Surveying and mapping → Chartered Land Surveyor. Candidates not pursuing one of these designations receive the standard \"Chartered Surveyor\" title.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive. Given the sheer breadth of this pathway, resist the temptation to select competencies too widely spread across unrelated specialisms — a coherent, defensible selection tied to your genuine experience is far stronger than a scattered one.<br><br><em>Source: RICS Land and Resources Pathway Guide (published December 2025, Version 1.4) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em>"
  },
  {
    "h": "11B.3 Health and Safety in Land and Resources Practice",
    "body": "Given the breadth of this pathway, health and safety risk varies enormously depending on specialism — from office-based GIS and cadastral work to fieldwork on active mineral extraction sites, contaminated land, or remote rural locations.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Site-specific regulation depending on specialism — including regulation relevant to contaminated land investigation, minerals and waste site safety, and construction/development site hazards</li><li>Lone-working considerations — particularly relevant to rural, environmental, and remote site inspection work</li></ul><strong>Practical application for Land and Resources candidates:</strong><br>A competent practitioner assesses the specific risks of their own specialism and site — contaminated land investigation carries very different risks to a rural boundary survey or an office-based planning appraisal. Whatever your specific area of practice, you should be able to explain how you identify, assess, and mitigate the specific health and safety risks relevant to your own work, rather than defaulting to generic property-inspection risk language that doesn't actually reflect what you do.<br><br>At Level 3, you should be able to give a specific, real example from your own experience — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Land and Resources Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and Land and Resources practice brings that knowledge into focus around development viability, minerals/waste economics, and land-related financial appraisal.<br><br><strong>Core areas relevant to Land and Resources candidates:</strong><ul><li><strong>Development and viability appraisal financial principles</strong> — relevant to planning and development-focused practice</li><li><strong>Minerals and waste economics</strong> — royalties, rents, and rating issues relevant to extraction or waste management specialisms</li><li><strong>Grant and funding mechanisms</strong> — relevant to environmental, economic development, and regeneration-focused work</li><li><strong>Compensation valuation principles</strong> — relevant to compulsory purchase and access/rights work</li></ul><strong>Practical application:</strong><br>Whatever your specific specialism, you should be able to explain the financial principles most relevant to your own area of practice — for example, a minerals specialist explaining royalty and rating structures, or a planning-focused practitioner explaining viability appraisal inputs — rather than giving a generic answer disconnected from your actual work."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Land and Resources Practice",
    "body": "Land and Resources practice draws on an unusually broad range of data sources, reflecting the pathway's combination of specialisms.<br><br><strong>Core data sources:</strong><ul><li><strong>HM Land Registry and cadastral records</strong> — title, ownership, and boundary information</li><li><strong>GIS and mapping platforms</strong> — used across nearly every specialism within this pathway</li><li><strong>Environmental and contamination databases</strong> — relevant to environmental management and contaminated land work</li><li><strong>Planning policy documents and precedent decisions</strong> — relevant to planning and development-focused practice</li><li><strong>Sector-specific technical data</strong> — mineral resource data, waste management regulatory data, or agricultural/rural market data depending on specialism</li></ul><strong>Practical application:</strong><br>Whatever your specific specialism, you should be able to explain exactly which data sources you rely on, why they're fit for purpose, and their limitations — a genuine, specific answer grounded in your own practice, rather than a generic list spanning specialisms you don't actually work in."
  },
  {
    "h": "11B.6 Client Care in Land and Resources Practice",
    "body": "RICS client care standards apply to every pathway, but Land and Resources work often involves a genuinely varied client base — private landowners, developers, local authorities, utility companies, and government bodies — sometimes with directly competing interests.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement agreed and confirmed in writing before work begins</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures appropriate to the nature of the instruction</li><li>Managing expectations proactively, particularly where technical findings (environmental, planning, or legal) are likely to disappoint the client</li></ul><strong>Practical application:</strong><br>A common scenario at interview: a client is unhappy that a technical finding — a contamination result, a rights of light constraint, a planning policy conclusion — limits what they hoped to achieve. Good client care here means explaining the finding clearly and professionally, without softening a position that isn't supported by the evidence, while helping the client understand their realistic options going forward."
  },
  {
    "h": "11B.7 Business Planning in Land and Resources Practice",
    "body": "Whether you work for a specialist land consultancy, a multidisciplinary firm, a local authority, or in-house for a landowner or developer, RICS expects every candidate to understand how their business sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee structures specific to your specialism — fixed fees, time-based fees, or value-based fees, each with different commercial and independence considerations</li><li>Resourcing and capacity planning — particularly relevant given how project-based and often unpredictable land and resources work can be</li><li>Business development — how practices in this space win and retain instructions in a specialist, relationship-driven market</li><li>Risk management at the business level — professional indemnity insurance considerations relevant to your specific specialism</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your practice or team resources instructions in your specialism, and how fee structures are set and disclosed to avoid conflicts of interest. Assessors are testing commercial awareness specific to your actual area of practice."
  },
  {
    "h": "11B.8 Conflict Avoidance in Land and Resources Practice",
    "body": "Given this pathway's breadth, dispute patterns vary by specialism — but boundary and access disputes, planning disagreements, contamination liability disputes, and rights-related conflicts are all common across the pathway generally.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common dispute scenarios across specialisms — boundary and access disputes, rights of light claims, contamination liability disagreements, and planning or compulsory purchase disputes</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; expert determination, arbitration, or a public inquiry (depending on specialism) &#x2192; litigation as a last resort</li><li>Understanding that some disputes in this pathway (particularly rights-related claims) carry genuine legal risk that planning permission or good intentions don't eliminate</li></ul><strong>Practical application:</strong><br>A frequent scenario across several specialisms in this pathway: a development risks infringing a neighbouring right — whether access, light, or another easement-based interest — and the client needs advice on how to manage that risk before it becomes a formal dispute. Assessors want you to explain the specific legal framework relevant to the right in question, the realistic remedies available to the affected party, and how early, professional engagement reduces risk — not just that \"disputes should be avoided\" in the abstract."
  },
  {
    "h": "11B.9 Sustainability in Land and Resources Practice",
    "body": "Sustainability runs through nearly every specialism within this pathway, from environmental management and minerals/waste through to rural land use and planning.<br><br><strong>Key areas:</strong><ul><li><strong>Sustainability within your specific specialism</strong> — the specific sustainability drivers, regulation, and practice relevant to your area (e.g. biodiversity net gain in environmental/rural contexts, embodied carbon in planning and development, restoration standards in minerals and waste)</li><li><strong>Whole-life and lifecycle considerations</strong> — relevant across most specialisms in this pathway</li><li><strong>Regulatory and policy drivers</strong> — national and international legislation, regulation, and taxation affecting sustainability in your area of practice</li><li><strong>Balancing sustainability against commercial and practical realities</strong> — a genuine trade-off relevant across the pathway's different specialisms</li></ul><strong>Practical application:</strong><br>Be ready to discuss a specific sustainability consideration genuinely relevant to your own specialism — not a generic sustainability answer disconnected from your actual practice area. Assessors are testing depth in your actual specialism, not breadth across the whole pathway."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Land and Resources — tailored to your specific specialism within the pathway, whether environmental, geospatial, minerals and waste, planning, or rural-adjacent — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible, specific to your actual specialism — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points specific to your specialism, rather than trying to cover the entire breadth of this pathway generically</li></ul>Open a session with Michael now and work through at least three scenarios specific to your own Land and Resources specialism before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Land and Resources pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>A client is unhappy that a technical finding (environmental, planning, or legal) limits what they hoped to achieve. How would you handle this conversation professionally?</li><li>Explain the health and safety considerations specific to your own specialism within this pathway, with a real example.</li><li>Describe a boundary, access, or rights-related dispute you've encountered, and how you approached resolving it.</li><li>Explain a sustainability consideration genuinely relevant to your specific specialism, and how you would advise a client on it.</li><li>How would you assess and communicate the limitations of the data sources you rely on in your own area of practice?</li><li>Describe the fee structure your practice or team uses for instructions in your specialism, and any conflict of interest considerations.</li><li>Explain the financial or economic principles most relevant to your specific specialism (e.g. viability appraisal, minerals royalties, compensation valuation).</li><li>A development risks infringing a neighbouring right (access, light, or similar). How would you advise a client to manage this risk?</li><li>Explain which chartered alternative designation, if any, is relevant to your competency selection, and why.</li><li>Describe how your competency selection reflects your actual day-to-day practice, and why you avoided spreading your selection too broadly across unrelated specialisms.</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Land and Resources",
  "h": "12.20 Rights of Light — Land and Resources Pathway",
  "body": "<strong>A neighbour has raised concerns that your client's development may infringe their right to light, but your client wants to proceed with construction regardless. Talk me through how you would advise them.</strong><br><br><em>Tests: Access and rights over land, Risk management, Client care. One of the most frequently tested Land and Resources scenarios, particularly for candidates specialising in rights of light.</em><br><br><strong>The model answer</strong> treats this as a genuine legal risk requiring careful, proactive management — not a pricing problem that can be resolved later with a cheque, and not something planning permission makes safe.<br><br><strong>Key elements:</strong><br><br><strong>1. Planning permission does not extinguish the right.</strong> A right to light is a private property right, and having planning permission for the development is no defence to a rights of light claim — this is a common and dangerous misconception that needs correcting for the client immediately.<br><br><strong>2. Injunctions are still a real risk, not a thing of the past.</strong> Since Coventry v Lawrence (2014), courts have more flexibility to award damages instead of an injunction, and the rigid Shelfer test is no longer applied mechanically — but courts can and still do grant injunctions, including after construction is complete, particularly where a developer has proceeded \"with their eyes open\" after being warned.<br><br><strong>3. Conduct matters enormously to the outcome.</strong> Courts have penalised developers who acted in a \"high-handed\" or \"unneighbourly\" manner after a claim was raised — proceeding regardless of a raised concern, rather than engaging properly, significantly increases the risk of an injunction rather than damages.<br><br><strong>4. Early engagement is the best risk management.</strong> The right approach is to address rights of light risk as early as possible — ideally before or during planning, not after a neighbour has already raised a formal concern — through proper light modelling, negotiation, and where appropriate, a negotiated release.<br><br><strong>5. Damages, if awarded, are not automatically small.</strong> Where damages are awarded instead of an injunction, courts have assessed them on a hypothetical negotiation basis, historically awarding around a third of the developer's profit attributable to the infringing part of the scheme — a genuinely significant sum, not a token payment.<br><br><strong>6. Advise proceeding at risk only with full, documented understanding.</strong> If the client insists on proceeding despite the concern, that decision needs to be made with full knowledge of the genuine risk, clearly documented — not on the assumption that rights of light claims are toothless or that damages will always be modest.<br><br><strong>How to frame this:</strong><br><br><em>\"I made clear that planning permission provided no protection against a private rights of light claim, since these are separate legal frameworks entirely.\"</em><br><br><em>\"I explained that proceeding after a concern had been raised, without proper engagement, increased the risk of an injunction rather than reducing it.\"</em><br><br><em>\"I recommended early, proper engagement — including a professional light assessment — rather than treating this as something to resolve financially after the fact.\"</em><br><br><strong>Three things assessors tick:</strong> 1) correctly distinguishing planning permission from private property rights, 2) understanding that injunction risk remains real post-Coventry v Lawrence, particularly where conduct is poor, 3) recommending early engagement rather than a reactive, after-the-fact approach.<br><br><strong>Rights of light claims punish developers who proceed carelessly after a warning far more than those who engage properly from the outset. Assessors are testing whether you understand that the client's conduct, not just the legal technicalities, shapes the ultimate risk.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":34,"num":"11B","title":"Land and Resources Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#a16207",'
    '"intro":"Land and Resources is one of the broadest RICS pathways — combining environmental, geospatial, minerals and waste, planning and development, and rural expertise. This module sharpens every mandatory competency through the specific lens of your Land and Resources specialism, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:34 after id:33
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":33,"num":"11B"'
assert html.count(old1) == 1
idx33 = html.index(old1)
close_idx = html.index('}];', idx33)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:34 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bMC = MODULES.find(m => m.id === 33);"
new2 = ("const _m11bMC = MODULES.find(m => m.id === 33);\n"
        "const _m11bLR = MODULES.find(m => m.id === 34);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isMCDash = _m11bMC && _dashPathway === 'Management Consultancy' && plan !== 'sprint';"
new2b = ("const _isMCDash = _m11bMC && _dashPathway === 'Management Consultancy' && plan !== 'sprint';\n"
         "const _isLRDash = _m11bLR && _dashPathway === 'Land and Resources' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isMCDash ? [..._base.filter(m => m.id <= 11), _m11bMC, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isMCDash ? [..._base.filter(m => m.id <= 11), _m11bMC, ..._base.filter(m => m.id >= 12)]"
        " : _isLRDash ? [..._base.filter(m => m.id <= 11), _m11bLR, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Management Consultancy' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:33, code:'11B', label:'MC pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Management Consultancy' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:33, code:'11B', label:'MC pathway prep'});\n"
        "    } else if (_stripPathway === 'Land and Resources' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:34, code:'11B', label:'L&R pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isMC = _p === 'Management Consultancy' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isMC = _p === 'Management Consultancy' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isLR = _p === 'Land and Resources' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks (id:34, id:11+_isLR, id:12+_isLR)
# ─────────────────────────────────────────────────────────────────────────────
old6a = ("        } else if (id === 33) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 33) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 34) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

old6b = ("        } else if (id === 11 && _isMC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(33, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(33)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isMC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(33, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(33)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isLR) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(34, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(34)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

old6c = ("        } else if (id === 12 && _isMC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(33)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isMC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(33)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isLR) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(34)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:34, id:11+_isLR, id:12+_isLR)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = ("m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || "
        "m.id === 26 || m.id === 27 || m.id === 28 || m.id === 29 || m.id === 30 || m.id === 31 || "
        "m.id === 32 || m.id === 33")
new7 = old7 + " || m.id === 34"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 34
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 33) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Management Consultancy') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 33) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Management Consultancy') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 34) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Land and Resources') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:34 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after MC section (last before quiz)
# ─────────────────────────────────────────────────────────────────────────────
mc_end_anchor = 'defend the former honestly, rather than bluffing the latter.</strong>"}],"quiz":['
assert html.count(mc_end_anchor) == 1, f"Change 9 anchor count: {html.count(mc_end_anchor)}"
html = html.replace(
    mc_end_anchor,
    'defend the former honestly, rather than bluffing the latter.</strong>"},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 L&R pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":34' in html
assert '"Land and Resources Pathway — Professional Practice' in html
assert '"pathwayOnly":"Land and Resources"' in html
assert 'modId === 34' in html
assert "_isLR = _p === 'Land and Resources'" in html
assert '_isLRDash' in html
assert 'm.id === 34' in html
assert "id:34, code:'11B'" in html
lr_count = html.count('"pathwayOnly":"Land and Resources"')
assert lr_count == 1, f"Expected 1 L&R pathwayOnly, found {lr_count}"
mc_count = html.count('"pathwayOnly":"Management Consultancy"')
assert mc_count == 1, f"MC pathwayOnly disturbed: found {mc_count}"
print(f"L&R pathwayOnly count: {lr_count} ✓  MC pathwayOnly count: {mc_count} ✓")
print("All assertions passed ✓")
