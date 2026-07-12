import json

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

assert html.count("'Property Finance and Investment'") >= 1, "PFI pathway string not found"
print("PFI pathway string confirmed: 'Property Finance and Investment'")

SECTIONS = [
  {
    "h": "11B.1 Introduction and Learning Outcomes",
    "body": "Welcome to Module 11B — your final period of structured learning before Module 12's revision and mock APC simulation. This module exists because technical competence in Property Finance and Investment is only half of what RICS assesses at final assessment. The other half is professional practice: how you conduct yourself, manage risk, communicate with clients, run a viable business, and operate ethically and sustainably within the profession.<br><br>Property Finance and Investment surveyors sit at the point where property meets capital markets — advising on financing structures, investment performance, and portfolio strategy for clients ranging from banks and institutional investors to property companies. Assessors expect candidates on this pathway to demonstrate not just technical fluency in financial modelling and investment analysis, but the judgement, independence, and commercial awareness that comes with advising on decisions where large sums of capital, and real financial risk, are directly at stake.<br><br><strong>By the end of this module, you will be able to:</strong><ul><li>Explain the structure of the Property Finance and Investment pathway and justify your competency selections</li><li>Apply health and safety principles specific to property finance and investment practice</li><li>Demonstrate working knowledge of accounting principles as they apply to this pathway</li><li>Identify and use the data sources and professional tools relied on by property finance and investment practitioners</li><li>Apply RICS client care standards to property finance and investment client relationships</li><li>Explain how a property finance or investment practice plans and sustains a viable business</li><li>Apply conflict avoidance and dispute resolution principles to relevant scenarios</li><li>Discuss sustainability considerations specific to property finance and investment</li><li>Practise applying this knowledge to realistic APC scenarios with Michael, your AI tutor</li><li>Demonstrate readiness through a full module assessment</li></ul>This module assumes you have already worked through Modules 1–10 and hold a solid grounding in the eleven mandatory competencies. What follows sharpens that knowledge specifically for Property Finance and Investment practice."
  },
  {
    "h": "11B.2 The Property Finance and Investment Pathway: Structure and Competency Selection",
    "body": "The Property Finance and Investment pathway is tailored for those working in property investment services or property finance provision — whether within a bank, a financial institution, or a property firm pursuing an investment or finance-focused career path.<br><br><strong>Mandatory competencies</strong> (common to all APC candidates, assessed at the levels required by your pathway):<br>Ethics, RICS Rules of Conduct and professionalism; Client care; Communication and negotiation; Health and safety; Accounting principles and procedures; Business planning; Conflict avoidance, management and dispute resolution procedures; Data management; Diversity, inclusion and teamworking; Inclusive environments; Sustainability.<br><br><strong>Core competencies:</strong> three to Level 3 and one to Level 2, from: Financial modelling, Inspection, Investment management (including fund and portfolio management), Property finance and funding.<br><br><strong>Core competency (Level 1, mandatory):</strong> Valuation — notably only required to Level 1 on this pathway, though it can be selected as an optional competency at a higher level if that better reflects your role.<br><br><strong>Optional competencies:</strong> one to Level 3 and one to Level 2, from: Accounting principles and procedures, Capital taxation, Corporate finance, Development appraisals, Indirect investment vehicles, Landlord and tenant, Leasing/letting, Local taxation/assessment, Property management, Purchase and sale, Research methodologies and techniques, Strategic real estate consultancy, Valuation.<br><br>Plus one further competency to Level 2 from the full technical list, including any not already chosen from the optional list.<br><br>Your actual selection should be driven entirely by what you do in your own role, agreed with your counsellor — not by which competencies sound most impressive. This pathway is distinctive in that its focus is the financial attributes of property as an investment class, rather than its physical attributes — though inspection experience remains a core requirement for all candidates.<br><br><em>Source: RICS Property Finance and Investment Pathway Guide (published December 2025) — always check your specific declaration against the current guide on the RICS website before finalising it with your counsellor, since RICS updates these periodically.</em><br><br>Assessors mark candidates against the level of competency claimed (Level 1: knowledge and understanding; Level 2: application of knowledge; Level 3: reasoned advice, depth and synthesis). For Property Finance and Investment candidates, Level 3 means being able to advise a client on a genuinely consequential financing or investment decision with the judgement and independence expected of a senior colleague — not simply describing financial modelling techniques."
  },
  {
    "h": "11B.3 Health and Safety in Property Finance and Investment Practice",
    "body": "Although this pathway's focus is financial rather than physical, inspection remains a core requirement, and health and safety discipline applies whenever a candidate conducts a physical inspection of an asset.<br><br><strong>Key legal framework:</strong><ul><li>Health and Safety at Work etc. Act 1974 — the foundation duty of care for employers and the self-employed</li><li>Control of Asbestos Regulations and other standard property inspection hazards — relevant to any pre-2000 building inspected as part of due diligence or valuation review</li><li>Occupiers' Liability Act — relevant to risks encountered during inspection of an occupied investment asset</li></ul><strong>Practical application for Property Finance and Investment candidates:</strong><br>Before inspecting an asset — whether for due diligence, portfolio review, or loan security purposes — a competent practitioner assesses the specific risks of the property type and its occupancy status. Since inspections on this pathway are often less frequent than for a purely physical-practice pathway, it's important not to let familiarity lapse — the same lone-working discipline (check-in protocols, shared location information, a clear escalation route) applies whenever an inspection does take place.<br><br>At Level 3, you should be able to explain how you would identify, assess, and mitigate a specific health and safety risk you've encountered during an inspection relevant to your own work — not recite the regulations in the abstract."
  },
  {
    "h": "11B.4 Accounting Principles in Property Finance and Investment Practice",
    "body": "Accounting principles sit unusually close to the technical core of this pathway, given its focus on financial analysis and investment decision-making.<br><br><strong>Core areas relevant to Property Finance and Investment candidates:</strong><ul><li><strong>Reading and interpreting company accounts</strong> — assessing the financial strength of a counterparty, borrower, or investment vehicle, including balance sheets, profit and loss statements, and cash flow statements</li><li><strong>Common financial measures</strong> — gearing ratio, loan-to-value, interest cover, and other metrics used to assess financial risk and covenant compliance</li><li><strong>Accounting standards affecting property</strong> — understanding how property is treated under relevant accounting standards, and how this affects the figures you're relying on</li><li><strong>Service charge and management accounts</strong> — where relevant to a specific asset or portfolio</li></ul><strong>Practical application:</strong><br>A Property Finance and Investment surveyor advising on a lending or investment decision needs to be able to read a borrower's or investee's accounts well enough to assess genuine financial strength — not just accept headline figures at face value, but understand what a declining interest cover ratio or a qualified auditor's opinion might signal about underlying risk."
  },
  {
    "h": "11B.5 Data Sources and Professional Tools in Property Finance and Investment Practice",
    "body": "Property Finance and Investment practice draws on a distinctive set of data sources spanning capital markets, investment performance, and financing terms.<br><br><strong>Core data sources:</strong><ul><li><strong>Investment performance benchmarking data</strong> — used to assess and compare fund and portfolio performance against relevant indices</li><li><strong>Financial modelling software</strong> — used to build bespoke property cash flow models, sensitivity analyses, and investment appraisals</li><li><strong>Lending market data</strong> — margin, loan-to-value, and covenant benchmarks across different lenders and asset classes</li><li><strong>Company and fund financial disclosures</strong> — audited accounts, prospectuses, and regulatory filings relevant to counterparty or investment analysis</li><li><strong>RICS Valuation – Global Standards</strong> — relevant wherever valuation informs a financing or investment decision</li></ul><strong>Practical application:</strong><br>When advising on an investment or financing decision, a Property Finance and Investment surveyor should be able to explain which data sources informed the analysis, and be transparent about the limitations of any single source — benchmarking data, for example, may not fully reflect asset-specific risk factors relevant to the actual transaction being considered."
  },
  {
    "h": "11B.6 Client Care in Property Finance and Investment Practice",
    "body": "RICS client care standards apply to every pathway, but this pathway's clients — banks, institutional investors, property companies — are typically sophisticated, repeat-instructing organisations, requiring a correspondingly high level of technical rigour and transparency.<br><br><strong>Core requirements:</strong><ul><li>Clear terms of engagement agreed and confirmed in writing before work begins</li><li>A complaints handling procedure that meets RICS requirements, and that you can explain to a client if asked</li><li>Transparent fee structures, and clear disclosure of any potential conflict of interest — particularly relevant where a surveyor advises on both sides of a financing relationship at different points</li><li>Managing expectations proactively where financial modelling or investment analysis produces an unwelcome or unexpected conclusion</li></ul><strong>Practical application:</strong><br>A common scenario at interview: a client's financial model produces a return projection significantly below what they expected or hoped for. Good client care here means explaining the modelling assumptions and methodology clearly and professionally, without being pressured into adjusting assumptions to produce a more favourable-looking output that isn't genuinely supportable."
  },
  {
    "h": "11B.7 Business Planning in Property Finance and Investment Practice",
    "body": "Whether you work for a bank, an investment management firm, or a specialist consultancy, RICS expects every candidate to understand how their business sustains itself commercially.<br><br><strong>Core areas:</strong><ul><li>Fee and remuneration models specific to this pathway — advisory fees, management fees on assets under management, and performance-related fees, each carrying different commercial and conflict-of-interest considerations</li><li>Resourcing and capacity planning — particularly relevant given the often deadline-driven, transaction-based nature of financing and investment work</li><li>Risk management at the business level — professional indemnity insurance considerations given the scale of capital typically involved in advice given</li><li>Regulatory context — understanding how financial services regulation may intersect with property advisory work, depending on the specific role</li></ul><strong>Practical application:</strong><br>Be ready to discuss, from your own experience, how your business's fee or remuneration model is structured, and how any potential conflicts arising from performance-related fees are managed and disclosed. Assessors are testing commercial and ethical awareness together."
  },
  {
    "h": "11B.8 Conflict Avoidance in Property Finance and Investment Practice",
    "body": "This pathway carries a distinctive conflict risk: the surveyor's independence and objectivity are central to the credibility of financial and investment advice, and any compromise to that independence — real or perceived — undermines the value of the advice given.<br><br><strong>Core framework:</strong><ul><li>RICS Conflict Avoidance, Management and Dispute Resolution Professional Statement</li><li>Common conflict scenarios — advising both a lender and a borrower on related transactions, or a fee structure tied to a particular investment outcome that could incentivise biased advice</li><li>The dispute resolution ladder: negotiation &#x2192; mediation &#x2192; independent expert determination or arbitration &#x2192; litigation as a last resort, particularly relevant to valuation-related disputes underpinning financing decisions</li><li>Understanding lender rights and covenant mechanics — many disputes in this pathway arise from loan covenant breaches, where understanding the contractual position precisely matters as much as the commercial relationship</li></ul><strong>Practical application:</strong><br>A frequent scenario: you're asked to provide a valuation that will be used to test a loan covenant, and you're aware the client would prefer a higher figure to avoid a breach. Assessors want you to explain how you maintain independence and objectivity under that pressure, and how you would handle the situation professionally if the valuation genuinely does trigger a covenant issue — not simply produce a figure that keeps the client comfortable."
  },
  {
    "h": "11B.9 Sustainability in Property Finance and Investment Practice",
    "body": "Sustainability increasingly shapes property finance and investment decisions directly, affecting both asset performance and the availability and cost of finance itself.<br><br><strong>Key areas:</strong><ul><li><strong>Green and sustainability-linked finance</strong> — an increasing feature of the property lending market, where financing terms are linked to sustainability performance targets</li><li><strong>ESG considerations in investment management</strong> — increasingly central to institutional investor mandates and fund reporting requirements</li><li><strong>Sustainability risk in asset valuation and financing</strong> — poor EPC ratings or high transition risk can affect both asset value and a lender's willingness to finance</li><li><strong>Reporting and disclosure requirements</strong> — investment funds and financial institutions face growing regulatory expectations around sustainability disclosure</li></ul><strong>Practical application:</strong><br>Be ready to discuss how sustainability-linked financing terms or ESG mandate requirements would affect your advice on a specific financing or investment decision — for example, how a poor EPC rating might affect both the asset's value and a lender's terms, and how you would advise a client navigating that combined risk."
  },
  {
    "h": "11B.10 APC Scenarios and Michael AI Guided Practice",
    "body": "This section is your space to practise applying everything above to realistic APC-style scenarios, working through them with Michael, your AI tutor.<br><br>Michael can run you through scenario-based questions specific to Property Finance and Investment — a loan covenant breach, an independence-under-pressure scenario, a financial modelling assumption challenge, a sustainability-linked financing decision — and probe your answers the way an assessor would: asking you to justify your reasoning, challenging your position, and pushing you past description into advice.<br><br><strong>How to use this section effectively:</strong><ul><li>Bring real examples from your own PDR wherever possible — Michael will help you structure and sharpen them, but the substance should be yours</li><li>Practise the \"what would you advise\" follow-up, not just \"what happened\" — assessors mark judgement, not narrative</li><li>Use Michael to stress-test weak points — if you're less confident on covenant mechanics or independence-under-pressure scenarios, spend deliberate time there rather than defaulting to your strongest area</li></ul>Open a session with Michael now and work through at least three Property Finance and Investment-specific scenarios before moving to the module assessment."
  },
  {
    "h": "11B.11 Module Assessment",
    "body": "Complete the following ten questions to check your readiness for Module 12. These mirror the style and difficulty of real APC interview questions on the Property Finance and Investment pathway — read each one as if a panel member had just asked it, and answer as you would in the room.<br><br><ol><li>You're asked to provide a valuation that will be used to test a loan covenant, and the client would prefer a higher figure. How would you maintain your independence in this situation?</li><li>Explain the key inputs and assumptions in a property financial model, and how you would present sensitivity analysis to a client.</li><li>A client's financial model produces a return projection significantly below their expectations. How would you handle this conversation?</li><li>Describe how gearing affects equity returns, and how you would explain this numerically to a client.</li><li>Outline the health and safety considerations you would apply before inspecting an investment asset for due diligence purposes.</li><li>Explain how a sustainability-linked financing arrangement might affect the terms available to a client, and how you would advise them on this.</li><li>How would you assess a borrower's or counterparty's financial strength from their company accounts before advising a client?</li><li>Describe how you would manage a potential conflict of interest arising from a performance-related fee structure.</li><li>Explain the difference between direct and indirect property investment, and the risk and management considerations that differ between them.</li><li>A loan facility is approaching a compliance test and the numbers suggest a loan-to-value covenant may be breached. How would you advise your client?</li></ol>Once you've worked through all ten and are satisfied with your answers — ideally after testing them against Michael's follow-up questions — you're ready for Module 12: Revision, Mock Tests and APC Simulation."
  }
]

M12_PATHWAY_SECTION = {
  "pathwayOnly": "Property Finance and Investment",
  "h": "12.17 Loan Covenant Breach — Property Finance and Investment Pathway",
  "body": "<strong>A client's loan facility is approaching its quarterly compliance test date, and your review suggests the loan-to-value covenant is likely to be breached. Talk me through how you would advise them.</strong><br><br><em>Tests: Property finance and funding, Investment management, Accounting principles. One of the most frequently tested Property Finance and Investment scenarios.</em><br><br><strong>The model answer</strong> treats a covenant breach as a situation requiring immediate, transparent engagement rather than a problem to be quietly managed until the test date arrives — lenders generally respond far better to early warning than to a surprise breach.<br><br><strong>Key elements:</strong><br><br><strong>1. Identify the exact mechanism first.</strong> Confirm precisely how the loan-to-value covenant is calculated and tested under the facility agreement — the specific valuation basis required, the testing frequency, and whether any cure period or grace mechanism exists before a breach becomes a formal Event of Default.<br><br><strong>2. Diagnose the cause.</strong> A covenant breach can be driven by a falling asset value, an increased loan balance, or both — the right response differs depending on which is driving the issue, so this needs to be established before recommending any course of action.<br><br><strong>3. Engage the lender proactively, before the test date.</strong> Lenders generally prefer early, transparent engagement to discovering a breach after the fact — approaching them ahead of time preserves goodwill and negotiating position that's harder to recover once a formal default has technically occurred.<br><br><strong>4. Consider the available remedies.</strong> Options typically include a partial loan repayment (cash sweep) to bring the ratio back into compliance, an additional equity injection from the sponsor, providing additional security, or negotiating a covenant waiver or amendment with the lender.<br><br><strong>5. Get a robust, defensible valuation.</strong> Since valuation is usually the key lever in an LTV test, ensure the valuation used is current, properly instructed, and methodologically sound — not artificially optimistic to avoid the breach, which would compromise professional independence and create a much larger problem if later challenged.<br><br><strong>6. Document the advice given.</strong> Given the financial significance of a covenant breach, the advice given and the reasoning behind the recommended course of action should be clearly recorded.<br><br><strong>How to frame this:</strong><br><br><em>\"I first confirmed exactly how the covenant was calculated and tested under the facility agreement, rather than assuming a standard mechanism.\"</em><br><br><em>\"I identified whether the breach was being driven by falling value or rising debt, since that changed which remedy made sense to recommend.\"</em><br><br><em>\"I advised engaging the lender proactively ahead of the test date, rather than waiting to see if the breach would actually materialise.\"</em><br><br><strong>Three things assessors tick:</strong> 1) understanding the specific covenant mechanism rather than treating all covenants generically, 2) correctly diagnosing the cause before recommending a remedy, 3) recognising that proactive lender engagement is almost always better than waiting for a formal breach to occur.<br><br><strong>A covenant breach isn't just a numbers problem — it's a relationship and timing problem. Assessors are testing whether you understand that the response needs to start well before the test date, not after.</strong>"
}

sections_json = json.dumps(SECTIONS, ensure_ascii=False, separators=(',', ':'))
m12_section_json = json.dumps(M12_PATHWAY_SECTION, ensure_ascii=False, separators=(',', ':'))
print(f"Section data: {len(sections_json):,} chars")
print(f"M12 section: {len(m12_section_json):,} chars")

module_entry = (
    '{"id":31,"num":"11B","title":"Property Finance and Investment Pathway — Professional Practice and Technical Foundations",'
    '"level":"Pathway Module","color":"#0f766e",'
    '"intro":"Property Finance and Investment surveyors work where property meets capital markets — advising on financing structures, investment performance, and portfolio strategy for banks, institutional investors, and property companies. This module sharpens every mandatory competency through the specific lens of Property Finance and Investment practice, completing your preparation for Module 12.",'
    '"sections":' + sections_json + '}'
)
print(f"Module entry: {len(module_entry):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: MODULES array — insert id:31 after id:30
# ─────────────────────────────────────────────────────────────────────────────
old1 = '"id":30,"num":"11B"'
assert html.count(old1) == 1
idx30 = html.index(old1)
close_idx = html.index('}];', idx30)
assert html[close_idx:close_idx+3] == '}];'
html = html[:close_idx] + '},' + module_entry + '];' + html[close_idx+3:]
print("Change 1: id:31 module added to MODULES array")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Dashboard vars
# ─────────────────────────────────────────────────────────────────────────────
old2 = "const _m11bPD = MODULES.find(m => m.id === 30);"
new2 = ("const _m11bPD = MODULES.find(m => m.id === 30);\n"
        "const _m11bPFI = MODULES.find(m => m.id === 31);")
assert html.count(old2) == 1
html = html.replace(old2, new2)

old2b = "const _isPDDash = _m11bPD && _dashPathway === 'Planning and Development' && plan !== 'sprint';"
new2b = ("const _isPDDash = _m11bPD && _dashPathway === 'Planning and Development' && plan !== 'sprint';\n"
         "const _isPFIDash = _m11bPFI && _dashPathway === 'Property Finance and Investment' && plan !== 'sprint';")
assert html.count(old2b) == 1
html = html.replace(old2b, new2b)
print("Change 2: Dashboard vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: dashMods chain
# ─────────────────────────────────────────────────────────────────────────────
old3 = ": _isPDDash ? [..._base.filter(m => m.id <= 11), _m11bPD, ..._base.filter(m => m.id >= 12)] : _base;"
new3 = (": _isPDDash ? [..._base.filter(m => m.id <= 11), _m11bPD, ..._base.filter(m => m.id >= 12)]"
        " : _isPFIDash ? [..._base.filter(m => m.id <= 11), _m11bPFI, ..._base.filter(m => m.id >= 12)] : _base;")
assert html.count(old3) == 1
html = html.replace(old3, new3)
print("Change 3: dashMods chain extended")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Milestone strip
# ─────────────────────────────────────────────────────────────────────────────
old4 = ("    } else if (_stripPathway === 'Planning and Development' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:30, code:'11B', label:'P&D pathway prep'});")
new4 = ("    } else if (_stripPathway === 'Planning and Development' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:30, code:'11B', label:'P&D pathway prep'});\n"
        "    } else if (_stripPathway === 'Property Finance and Investment' && plan !== 'sprint') {\n"
        "      twelveMods.splice(11, 0, {id:31, code:'11B', label:'PFI pathway prep'});")
assert html.count(old4) == 1
html = html.replace(old4, new4)
print("Change 4: Milestone strip wired")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Nav vars
# ─────────────────────────────────────────────────────────────────────────────
old5 = "        var _isPD = _p === 'Planning and Development' && plan !== 'sprint' && plan !== 'referred';"
new5 = ("        var _isPD = _p === 'Planning and Development' && plan !== 'sprint' && plan !== 'referred';\n"
        "        var _isPFI = _p === 'Property Finance and Investment' && plan !== 'sprint' && plan !== 'referred';")
assert html.count(old5) == 1
html = html.replace(old5, new5)
print("Change 5: Nav vars added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Nav blocks (id:31, id:11+_isPFI, id:12+_isPFI)
# ─────────────────────────────────────────────────────────────────────────────
old6a = ("        } else if (id === 30) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
new6a = ("        } else if (id === 30) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 31) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(11)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(12, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(12)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isRural) {")
assert html.count(old6a) == 1, f"6a count: {html.count(old6a)}"
html = html.replace(old6a, new6a)

old6b = ("        } else if (id === 11 && _isPD) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(30, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(30)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
new6b = ("        } else if (id === 11 && _isPD) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(30, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(30)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 11 && _isPFI) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(10)\">← Previous Module</button>';\n"
         "          nxt = isModuleUnlocked(31, _np, _na) ? '<button class=\"btn btn-blue\" onclick=\"openModule(31)\">Next Module →</button>' : '<button class=\"btn btn-outline\" onclick=\"showView(\\'dashboard\\')\">⌂ Home Dashboard</button>';\n"
         "        } else if (id === 12 && _isRural) {")
assert html.count(old6b) == 1, f"6b count: {html.count(old6b)}"
html = html.replace(old6b, new6b)

old6c = ("        } else if (id === 12 && _isPD) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(30)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
new6c = ("        } else if (id === 12 && _isPD) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(30)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else if (id === 12 && _isPFI) {\n"
         "          prev = '<button class=\"btn btn-outline\" onclick=\"openModule(31)\">← Previous Module</button>';\n"
         "          nxt = '<button class=\"btn btn-green\" onclick=\"showView(\\'dashboard\\')\">✓ Back to Dashboard</button>';\n"
         "        } else {")
assert html.count(old6c) == 1, f"6c count: {html.count(old6c)}"
html = html.replace(old6c, new6c)
print("Change 6: Nav blocks added (id:31, id:11+_isPFI, id:12+_isPFI)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: dmcard unlock label
# ─────────────────────────────────────────────────────────────────────────────
old7 = "m.id === 20 || m.id === 21 || m.id === 22 || m.id === 23 || m.id === 24 || m.id === 25 || m.id === 26 || m.id === 27 || m.id === 28 || m.id === 29 || m.id === 30"
new7 = old7 + " || m.id === 31"
assert html.count(old7) == 1
html = html.replace(old7, new7)
print("Change 7: dmcard unlock label updated")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: isModuleUnlocked guard for modId === 31
# ─────────────────────────────────────────────────────────────────────────────
old8 = ("  if (modId === 30) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Planning and Development') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
new8 = ("  if (modId === 30) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Planning and Development') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (modId === 31) {\n"
        "    if (localStorage.getItem('gca_pathway') !== 'Property Finance and Investment') return false;\n"
        "    if (plan === 'sprint' || plan === 'referred') return false;\n"
        "    return getUnlockedCount(plan, activatedAt) >= 11;\n"
        "  }\n"
        "  if (plan === 'referred') {")
assert html.count(old8) == 1
html = html.replace(old8, new8)
print("Change 8: isModuleUnlocked guard for id:31 added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 9: M12 pathwayOnly — insert after P&D section (last before quiz)
# ─────────────────────────────────────────────────────────────────────────────
pd_end_anchor = 'the abstract.</strong>"}],"quiz":['
assert html.count(pd_end_anchor) == 1, f"Change 9 anchor count: {html.count(pd_end_anchor)}"
html = html.replace(
    pd_end_anchor,
    'the abstract.</strong>"},' + m12_section_json + '],"quiz":['
)
print("Change 9: M12 PFI pathwayOnly section inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write and verify
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 9 changes applied. File size: {len(html):,} chars")

assert '"id":31' in html
assert '"Property Finance and Investment Pathway — Professional Practice' in html
assert '"pathwayOnly":"Property Finance and Investment"' in html
assert 'modId === 31' in html
assert "_isPFI = _p === 'Property Finance and Investment'" in html
assert '_isPFIDash' in html
assert 'm.id === 31' in html
assert "id:31, code:'11B'" in html
pfi_count = html.count('"pathwayOnly":"Property Finance and Investment"')
assert pfi_count == 1, f"Expected 1 PFI pathwayOnly, found {pfi_count}"
pd_count = html.count('"pathwayOnly":"Planning and Development"')
assert pd_count == 1, f"P&D pathwayOnly disturbed: found {pd_count}"
print(f"PFI pathwayOnly count: {pfi_count} ✓  P&D pathwayOnly count: {pd_count} ✓")
print("All assertions passed ✓")
