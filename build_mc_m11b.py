import json

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

assert html.count("'Management Consultancy'") >= 1, "MC pathway string not found"
print("MC pathway string confirmed: 'Management Consultancy'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Management Consultancy is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Management Consultancy surveyors provide strategic business advice to organisations where real estate plays a significant part in the business — identifying and implementing solutions to real estate problems across the whole property lifecycle. Assessors expect candidates on this pathway to demonstrate not just technical competence in business case development and research methodology, but the analytical rigour, independence, and communication skill that genuine strategic consultancy demands — including the ability to defend a recommendation under genuine, informed challenge.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Management Consultancy pathway and justify your competency selections</li><li>Apply health and safety principles specific to management consultancy practice</li><li>Demonstrate working knowledge of accounting principles as they apply to this pathway</li><li>Identify and use the data sources and professional tools relied on by management consultancy practitioners</li><li>Apply RICS client care standards to management consultancy client relationships</li><li>Explain how a management consultancy plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to relevant scenarios</li><li>Discuss sustainability considerations specific to management consultancy</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Management Consultancy practice."
  },
  {
    "h": "11B.2 The Management Consultancy Pathway: Structure and Competency Selection",
    "body": "Management Consultancy is for those trained in economics, business, and management skills who provide consultancy advice to identify and implement business solutions to real estate problems, at any stage of the land and property lifecycle.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competencies (all four required):</strong> Business case; Business planning; Consultancy services; Research methodologies and techniques.<br><br><strong>Optional competencies:</strong> you select three, from a broad list including Business alignment, Change management, Corporate finance, Corporate recovery and insolvency, Data management, Development appraisals, Development/project briefs, Economic development, Managing resources, Performance management, Programming and planning, Property finance and funding, Smart cities and intelligent buildings, Strategic real estate consultancy, and Workspace strategy. Plus one further competency to Level 2 from either the core or optional list.<br><br>A note worth remembering: RICS specifically advises against choosing both Strategic real estate consultancy and a closely overlapping competency together, given their significant overlap — your selection should reflect genuinely distinct areas of your actual experience.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive. Note that there is no separate Associate (AssocRICS) pathway for Management Consultancy — candidates interested in a similar area at Associate level are directed toward Project Management instead.<br><br><em>Source: RICS Management Consultancy Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Management Consultancy candidates, Level 3 means being able to defend a strategic recommendation with the analytical rigour and independence expected of a senior colleague — not simply describing a consultancy process in the abstract."
  },
  {
    "h": "11B.3 Health and Safety in Management Consultancy Practice",
    "body": "Management Consultancy work is often desk- and analysis-based, but candidates should still be able to demonstrate genuine health and safety understanding, particularly where consultancy work involves site visits or client premises inspections as part of a wider engagement.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Occupiers' Liability Act — relevant to any client site visits undertaken as part of a consultancy engagement</li></ul><strong>Practical application for Management Consultancy candidates:</strong><br>Even where the bulk of your work is analytical or advisory, you should be able to explain how you assess and manage health and safety risk whenever a site visit or client premises inspection forms part of an engagement — treating this with the same discipline as a purely technical pathway would, rather than assuming it's less relevant because your primary focus is strategic advice.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk relevant to your own consultancy work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Management Consultancy Practice",
    "body": "Every RICS member needs a working grasp of accounting principles, and Management Consultancy practice brings that knowledge into direct focus, given the discipline's core reliance on business case development.<br><br><strong>Core areas relevant to Management Consultancy candidates:</strong><ul><li><strong>Business case financial analysis</strong> — the financial standards and metrics needed to build a credible, defensible business case for a client</li><li><strong>Reading company accounts</strong> — assessing a client organisation's financial position where relevant to strategic recommendations</li><li><strong>Cost-benefit analysis</strong> — a core analytical tool for consultancy recommendations, and understanding its limitations</li><li><strong>Return on investment and payback analysis</strong> — common financial measures used to justify a recommended course of action</li></ul><strong>Practical application:</strong><br>A Management Consultancy professional building a business case needs to present a financial analysis that would genuinely withstand scrutiny from a client's own finance function — not just property-specific reasoning, but the financial rigour and standards that a board or senior stakeholder would expect before committing significant investment."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Management Consultancy Practice",
    "body": "Management Consultancy practice draws on a distinctive set of data sources spanning research, market intelligence, and organisational performance.<br><br><strong>Core data sources:</strong><ul><li><strong>Primary research</strong> — surveys, interviews, and stakeholder consultation conducted specifically for a consultancy engagement</li><li><strong>Secondary research and market intelligence</strong> — published reports, industry benchmarking, and economic data used to support strategic recommendations</li><li><strong>Client organisational data</strong> — internal performance, cost, and operational data relevant to the specific engagement</li><li><strong>Academic and professional research methodology standards</strong> — underpinning the credibility of any research-based recommendation</li></ul><strong>Practical application:</strong><br>When presenting a strategic recommendation, a Management Consultancy professional should be able to explain exactly which research methodology was used — the sample size, data sources, and any limitations — and be transparent about how confident the underlying evidence genuinely is, rather than presenting a recommendation with more certainty than the evidence actually supports."
  },
  {
    "h": "11B.6 Client Care in Management Consultancy Practice",
    "body": "RICS client care standards apply to every pathway, but Management Consultancy work often means presenting recommendations that a client's senior stakeholders may not want to hear, requiring particular skill in maintaining the relationship while holding a professionally independent position.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement, agreed and confirmed in writing before work begins, including the scope and methodology of any research to be undertaken</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures appropriate to the nature and duration of the consultancy engagement</li><li>Managing expectations proactively, particularly where research findings or strategic analysis produce a conclusion the client didn't expect or want</li></ul><strong>Practical application:</strong><br>A common Management Consultancy scenario at interview: a client challenges the methodology behind a research-based recommendation because they're uncomfortable with the conclusion. Good client care here means engaging with the challenge professionally and transparently, defending the methodology on its merits, and being honest about genuine limitations — rather than either becoming defensive or quietly softening the recommendation to keep the client comfortable."
  },
  {
    "h": "11B.7 Business Planning in Management Consultancy Practice",
    "body": "Whether you work for a large multidisciplinary firm or a specialist management consultancy, RICS expects every candidate to understand how their business sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee structures specific to consultancy work — time-based, fixed-fee, or value-based fee models, each carrying different commercial and independence considerations</li><li>Resourcing and capacity planning — consultancy engagements often require specialist research or analytical resource alongside core project delivery</li><li>Business development — how consultancy practices win and retain instructions in a relationship- and reputation-driven market</li><li>Risk management at the business level — professional indemnity insurance considerations given the strategic, high-stakes nature of consultancy advice</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your practice structures its fees for consultancy engagements, and how it manages the tension between value-based fees and maintaining genuine independence in the advice given. Assessors are testing commercial and ethical awareness together."
  },
  {
    "h": "11B.8 Conflict Avoidance in Management Consultancy Practice",
    "body": "Management Consultancy work carries a distinctive independence risk: the value of strategic advice depends entirely on it being genuinely objective, and any compromise to that independence — real or perceived — undermines the whole engagement.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common conflict scenarios — advising multiple parties with competing interests on related matters, or a fee structure that could incentivise a particular recommendation</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; independent expert determination or arbitration &#x2192; litigation as a last resort</li><li>Managing genuine challenge to a recommendation professionally — distinguishing legitimate scrutiny of methodology from pressure to change a conclusion for reasons unrelated to the evidence</li></ul><strong>Practical application:</strong><br>A frequent scenario: a client challenges your research methodology because they're unhappy with where your recommendation leads. Assessors want you to explain how you would engage with that challenge on its actual merits — defending genuinely sound methodology, acknowledging genuine limitations honestly — rather than either capitulating to pressure or dismissing legitimate scrutiny defensively."
  },
  {
    "h": "11B.9 Sustainability in Management Consultancy Practice",
    "body": "Sustainability increasingly forms a core strand of the strategic advice Management Consultancy professionals are asked to provide.<br><br><strong>Key areas:</strong><ul><li><strong>Sustainability as a strategic business driver</strong> — increasingly a core input to strategic real estate decisions, not a separate add-on consideration</li><li><strong>ESG-informed recommendations</strong> — client organisations increasingly expect consultancy advice to be explicitly informed by ESG commitments and reporting requirements</li><li><strong>Economic and social development considerations</strong> — relevant where consultancy advice touches on regeneration, economic development, or community impact</li><li><strong>Balancing sustainability ambition against commercial reality</strong> — a genuine trade-off that strategic advice needs to navigate, not resolve by ignoring one side</li></ul><strong>Practical application:</strong><br>Be ready to discuss how you would build a strategic recommendation that genuinely integrates sustainability considerations with commercial and operational priorities — explaining the trade-offs honestly, rather than treating sustainability as either automatically decisive or as an afterthought layered on top of a decision already made."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Management Consultancy — a challenged research methodology, an independence-under-pressure scenario, a business case defence, a sustainability-versus-commercial trade-off — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on research methodology or independence scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Management Consultancy-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Management Consultancy pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>A board member challenges the research methodology underpinning your strategic recommendation. How would you respond?</li><li>Explain how you would build a business case that would genuinely withstand scrutiny from a client's own finance function.</li><li>A client is unhappy with where your research-based recommendation leads and pressures you to reconsider. How would you maintain your independence?</li><li>Describe the difference between primary and secondary research, and how you would combine them in a consultancy engagement.</li><li>Outline the health and safety considerations relevant to a client site visit undertaken as part of a consultancy engagement.</li><li>Explain how you would integrate sustainability considerations into a strategic recommendation without treating them as either decisive or an afterthought.</li><li>How would a value-based fee structure on a consultancy engagement create a potential conflict of interest, and how would you manage it?</li><li>Describe how you would present cost-benefit analysis to a client, including its limitations.</li><li>Explain why RICS advises against selecting both Strategic real estate consultancy and a closely overlapping competency together, and how you'd justify your own selection.</li><li>A client organisation's internal data conflicts with your external research findings. How would you reconcile this in your final recommendation?</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Management Consultancy",
  "h": "12.19 Research Methodology Challenge — Management Consultancy Pathway",
  "body": "<strong>You've presented a strategic recommendation to a client board based on your research findings, and a board member challenges the methodology behind your data, questioning whether your conclusions are robust enough to justify the investment. Talk me through how you would respond.</strong><br><br><em>Tests: Research methodologies and techniques, Consultancy services, Client care. One of the most frequently tested Management Consultancy scenarios.</em><br><br><strong>The model answer</strong> treats a methodology challenge as a normal, healthy part of rigorous consultancy work, not a personal attack — the right response depends on genuinely understanding your own methodology well enough to defend it honestly, including its real limitations.<br><br><strong>Key elements:</strong><br><br><strong>1. Know your own methodology cold.</strong> Before anything else, you need to be able to explain precisely what research was done — sample size, data sources, whether it was primary or secondary research, and how any qualitative input was weighted alongside quantitative data.<br><br><strong>2. Distinguish correlation from causation.</strong> A common weak point under genuine challenge is a recommendation that implies more causal certainty than the underlying data actually supports — be ready to explain precisely what your evidence does and doesn't establish.<br><br><strong>3. Acknowledge genuine limitations honestly.</strong> Every piece of research has limitations — sample size constraints, data recency, a specific market context that may not generalise perfectly. Acknowledging this honestly builds more credibility than pretending the analysis is beyond challenge.<br><br><strong>4. Separate data robustness from professional judgement.</strong> A recommendation can still be sound professional judgement even where the underlying data has genuine limitations — as long as that's disclosed, and the judgement itself is reasoned and defensible on the evidence available.<br><br><strong>5. Offer to strengthen the evidence, where appropriate.</strong> If the challenge reveals a genuine gap, offering further research, a pilot, or sensitivity testing shows you're engaging with the substance of the challenge, not just defending a position reflexively.<br><br><strong>6. Stay composed and professional throughout.</strong> Treating rigorous challenge as an attack, rather than a legitimate part of the process, undermines your credibility more than any weakness in the methodology itself would.<br><br><strong>How to frame this:</strong><br><br><em>\"I explained exactly what the research methodology involved — the sample size and data sources — before addressing the specific concern raised.\"</em><br><br><em>\"I was honest about the genuine limitations of the data, rather than defending it as beyond challenge.\"</em><br><br><em>\"Where the challenge identified a genuine gap, I offered to strengthen the evidence with further research rather than simply holding my original position.\"</em><br><br><strong>Three things assessors tick:</strong> 1) genuine command of your own methodology, not just the headline conclusion, 2) honest acknowledgement of real limitations rather than defensive denial, 3) professional composure under legitimate challenge.<br><br><strong>A methodology challenge tests whether your recommendation was built on genuine analytical rigour or just a confident conclusion. Assessors are testing whether you can tell the difference — and defend the former honestly, rather than bluffing the latter.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":33,"num":"11B","title":"Management Consultancy Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#1e3a8a",'
    '"intro":"Management Consultancy surveyors provide strategic business advice to organisations where real estate plays a significant part — identifying and implementing solutions across the whole property lifecycle. This module sharpens every mandatory competency through the specific lens of Management Consultancy practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:33 after id:32
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":32,"num":"11B"'
assert html.count(old1) == 1
idx32 = html.index(old1)
close_idx = html.index('}];', idx32)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:33 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bCRE = MODULES.find(m => m.id === 32);"
new2 = ("const _m11bCRE = MODULES.find(m => m.id === 32);\n"
        "const _m11bMC = MODULES.find(m => m.id === 33);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isCREDash = _m11bCRE && _dashPathway === 'Corporate Real Estate' && plan !== 'sprint';"
new2b = ("const _isCREDash = _m11bCRE && _dashPathway === 'Corporate Real Estate' && plan !== 'sprint';\n"
         "const _isMCDash = _m11bMC && _dashPathway === 'Management Consultancy' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isCREDash ? [..._base.filter(m => m.id <= 11), _m11bCRE, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isCREDash ? [..._base.filter(m => m.id <= 11), _m11bCRE, ..._base.filter(m => m.id >= 12)]"
        " : _isMCDash ? [..._base.filter(m => m.id <= 11), _m11bMC, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Corporate Real Estate' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:32, code:'11B', label:'CRE pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Corporate Real Estate' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:32, code:'11B', label:'CRE pathway prep'});\n"
        "    } else if (_stripPathway === 'Management Consultancy' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:33, code:'11B', label:'MC pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isCRE = _p === 'Corporate Real Estate' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isCRE = _p === 'Corporate Real Estate' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isMC = _p === 'Management Consultancy' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks (id:33, id:11+_isMC, id:12+_isMC)
# ─────────────────────────────────────────────────────────────────────────────
old6a = ("        } else if (id === 32) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 32) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 33) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

old6b = ("        } else if (id === 11 && _isCRE) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(32, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(32)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isCRE) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(32, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(32)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isMC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(33, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(33)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

old6c = ("        } else if (id === 12 && _isCRE) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(32)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isCRE) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(32)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isMC) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(33)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:33, id:11+_isMC, id:12+_isMC)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = ("m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || "
        "m.id === 26 || m.id === 27 || m.id === 28 || m.id === 29 || m.id === 30 || m.id === 31 || m.id === 32")
new7 = old7 + " || m.id === 33"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 33
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 32) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Corporate Real Estate') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 32) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Corporate Real Estate') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 33) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Management Consultancy') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:33 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after CRE section (last before quiz)
# ─────────────────────────────────────────────────────────────────────────────
cre_end_anchor = 'cost the organisation a further lease term.</strong>"}],"quiz":['
assert html.count(cre_end_anchor) == 1, f"Change 9 anchor count: {html.count(cre_end_anchor)}"
html = html.replace(
    cre_end_anchor,
    'cost the organisation a further lease term.</strong>"},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 MC pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":33' in html
assert '"Management Consultancy Pathway — Professional Practice' in html
assert '"pathwayOnly":"Management Consultancy"' in html
assert 'modId === 33' in html
assert "_isMC = _p === 'Management Consultancy'" in html
assert '_isMCDash' in html
assert 'm.id === 33' in html
assert "id:33, code:'11B'" in html
mc_count = html.count('"pathwayOnly":"Management Consultancy"')
assert mc_count == 1, f"Expected 1 MC pathwayOnly, found {mc_count}"
cre_count = html.count('"pathwayOnly":"Corporate Real Estate"')
assert cre_count == 1, f"CRE pathwayOnly disturbed: found {cre_count}"
print(f"MC pathwayOnly count: {mc_count} ✓  CRE pathwayOnly count: {cre_count} ✓")
print("All assertions passed ✓")
