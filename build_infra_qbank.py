import json, re

with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'r') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# INFRA_QUESTIONS data
# ─────────────────────────────────────────────────────────────────────────────
INFRA_QUESTIONS = [
  # ── Category 1: Engineering Science & Technology (Q1–10) ──────────────────
  {
    "q": "A client asks you to recommend between a traditional construction methodology and an offsite/modular approach for a new transport depot. What factors would inform your advice?",
    "why": "Tests whether you understand construction methodology choices as a reasoned trade-off (cost, programme, quality, site constraints) rather than a default preference.",
    "pass": "Explains the basic differences between traditional and offsite methods, and lists relevant factors (programme, site access, labour availability, quality control).",
    "high": "Structures the advice around the client's specific priorities — e.g. programme certainty may favour offsite fabrication, while site constraints or bespoke design needs may favour traditional build — and quantifies the trade-off (cost premium for offsite vs programme saving), rather than giving a generic list of pros and cons.",
    "referral": "States a personal preference for one method without reference to the client's actual priorities or project constraints; treats the question as binary rather than a judgement call.",
    "referralWhy": ["Personal preference given without reference to client priorities or constraints", "Treats the methodology choice as binary rather than a reasoned judgement call"],
    "challenge": ["How would your recommendation change if the site had very restricted access?", "What quality assurance differences exist between the two approaches?"],
    "keyPoints": ["Methodology choice is a reasoned trade-off, not a fixed preference", "Programme certainty is often the strongest driver for offsite methods", "Site constraints and design flexibility often favour traditional build"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "Explain how materials science knowledge influences your advice on whole-life cost for an infrastructure asset.",
    "why": "Tests understanding that material choice affects not just initial cost but long-term maintenance and asset life.",
    "pass": "Explains that different materials have different durability, maintenance requirements, and lifespans, affecting whole-life cost.",
    "high": "Gives a specific example (e.g. choice of surfacing material on a road scheme, or cladding on a structure) and explains how the higher initial cost of a more durable material can be justified through whole-life costing analysis, referencing maintenance cycles and asset life expectancy.",
    "referral": "Focuses only on capital cost without addressing whole-life implications; gives a generic answer with no specific material example.",
    "referralWhy": ["Focuses only on capital cost without addressing whole-life implications", "No specific material example given to demonstrate real understanding"],
    "challenge": ["How would you present this trade-off to a client focused only on capital budget?", "What data would you need to build a credible whole-life cost comparison?"],
    "keyPoints": ["Whole-life costing requires looking beyond capital cost", "Material durability and maintenance cycles are central to this analysis", "Client budget pressures often require you to make the whole-life case explicitly"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "What are the key design constraints you would need to consider when advising on an infrastructure project, and how do they interact?",
    "why": "Tests breadth of understanding of design constraints (legislation, sustainability, economics, technology) and whether the candidate sees them as interacting rather than isolated.",
    "pass": "Lists the main design constraint categories — legislative, sustainability, economic, and technological.",
    "high": "Explains how constraints interact in practice — e.g. a sustainability requirement (such as a carbon target) may conflict with the lowest-cost economic option, and legislative requirements may limit technological choices — and gives a specific example of how this tension was resolved in a real project.",
    "referral": "Lists constraints without explaining any interaction between them, or treats them as a checklist rather than a set of competing pressures to balance.",
    "referralWhy": ["Lists constraints without explaining how they interact", "Treats constraints as a static checklist rather than competing pressures"],
    "challenge": ["Can you give an example where sustainability and cost constraints genuinely conflicted?", "How do you communicate these trade-offs to a client who wants both low cost and high sustainability performance?"],
    "keyPoints": ["Design constraints rarely act in isolation — they interact and sometimes conflict", "Being able to explain a real resolved conflict is stronger than reciting categories", "Client communication about trade-offs is part of this competency"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "How would you advise a client on emerging construction technologies or processes, such as offsite fabrication or smart materials handling, for a specific project?",
    "why": "Tests awareness of current technology trends and the ability to give reasoned, project-specific advice rather than generic enthusiasm for new technology.",
    "pass": "Names one or two relevant emerging technologies or processes and describes what they involve.",
    "high": "Assesses the specific technology against the project's actual needs — cost, programme, risk, and supply chain maturity — and gives a balanced recommendation, including where the technology might not be appropriate.",
    "referral": "Recommends new technology enthusiastically without assessing its actual fit or risk for the specific project; cannot explain any downside or limitation.",
    "referralWhy": ["Enthusiasm for technology without project-specific assessment", "Unable to name a limitation or downside, suggesting surface-level awareness only"],
    "challenge": ["What risks would you flag to a client considering an unproven technology on a critical-path element?", "How do you stay current on emerging construction technologies in your own practice?"],
    "keyPoints": ["New technology advice should be project-specific, not generic", "Supply chain maturity and risk are as important as technical capability", "Being able to name a limitation demonstrates genuine understanding"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "Describe how you would assimilate design information from multiple sources (engineers, architects, cost consultants) to inform a project brief.",
    "why": "Tests understanding of the collaborative, multi-disciplinary nature of infrastructure design and the surveyor's role in synthesising it.",
    "pass": "Describes gathering information from relevant disciplines and using it to inform the brief.",
    "high": "Explains a structured process — for example, identifying which discipline's input is time-critical, resolving conflicting information between sources, and translating technical detail into a brief that is usable by non-technical stakeholders — with a specific example from experience.",
    "referral": "Describes a passive, one-directional process (just receiving information) without addressing how conflicts between sources were resolved or how information was synthesised into a usable output.",
    "referralWhy": ["Treats the process as passive rather than active synthesis", "Does not address how conflicts between disciplines are resolved"],
    "challenge": ["What would you do if the engineer's information conflicted with the architect's design intent?", "How do you handle information that arrives after the brief has been issued?"],
    "keyPoints": ["The surveyor's role is often synthesis and translation, not just collection", "Conflicting information between disciplines is common and needs a resolution process", "A real example of conflict resolution is stronger evidence than a generic process description"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "How does the choice of construction methodology affect a project's cost, time, and productivity?",
    "why": "Tests the ability to connect a technical choice (methodology) to commercial outcomes (cost, time, productivity) — a core surveying skill.",
    "pass": "Explains generally that different methodologies have different cost, time, and productivity implications.",
    "high": "Gives a specific example — e.g. precast versus in-situ concrete — and quantifies or reasons through the trade-offs: precast may cost more per unit but reduce programme and labour requirements on site, improving productivity and reducing weather-related risk.",
    "referral": "States that methodology affects cost, time, and productivity without explaining how, or without a concrete example.",
    "referralWhy": ["States effects without explaining the mechanism or quantifying them", "No concrete example given to demonstrate real-world understanding"],
    "challenge": ["How would you present this analysis to a client deciding between methodologies?", "What productivity data would you rely on to support your recommendation?"],
    "keyPoints": ["Methodology choice has quantifiable, not just qualitative, cost/time/productivity effects", "A specific worked example demonstrates real understanding", "Productivity data and evidence strengthen the advice given"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "What role does inter-disciplinary coordination play in preventing costly design errors on an infrastructure project?",
    "why": "Tests understanding of design coordination as a risk management tool, not just an administrative process.",
    "pass": "Explains that coordination between disciplines helps catch design clashes or errors before construction.",
    "high": "Gives a specific example of a coordination process (e.g. BIM clash detection, or a structured design review) and explains the cost and programme consequences of an error caught late versus early, demonstrating understanding of coordination as active risk management.",
    "referral": "Describes coordination in vague terms without connecting it to specific risk or cost consequences; no example given.",
    "referralWhy": ["Describes coordination vaguely without connecting it to risk or cost consequences", "No specific example or tool referenced to demonstrate practical experience"],
    "challenge": ["How would you handle a clash discovered after construction has started?", "What tools or processes have you used to support design coordination?"],
    "keyPoints": ["Coordination is a risk management activity with real cost consequences", "Errors caught early are dramatically cheaper than errors caught late", "Specific tools and processes (e.g. BIM) demonstrate practical experience"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "Explain the operational and maintenance considerations that should influence design decisions during the construction phase of an infrastructure project.",
    "why": "Tests whether the candidate thinks beyond construction completion to the asset's operational life — a common gap in less experienced candidates.",
    "pass": "States that maintenance access, durability, and operational needs should be considered during design.",
    "high": "Gives a specific example — e.g. designing for maintenance access to a structure, or specifying materials that reduce future maintenance burden — and explains how this was balanced against capital cost pressures during the project.",
    "referral": "Treats design as ending at practical completion, with no consideration of the asset's ongoing operational life.",
    "referralWhy": ["Demonstrates thinking that stops at practical completion", "No connection made between design decisions and operational life of the asset"],
    "challenge": ["How do you make the case for a maintenance-friendly design choice when it increases capital cost?", "Who would you involve to get operational input during design?"],
    "keyPoints": ["Design decisions have consequences well beyond practical completion", "Maintenance-friendly choices often cost more upfront but save more over the asset's life", "Involving operational stakeholders early avoids costly retrofits"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "How would you evaluate the comparative characteristics and performance of different construction materials for a specific infrastructure application?",
    "why": "Tests technical depth in materials science and the ability to apply it to a specific decision rather than recite general material properties.",
    "pass": "Names relevant material properties (durability, strength, cost) and states that these should be compared for the application.",
    "high": "Applies the comparison to a specific application — e.g. selecting a surfacing material for a high-traffic scheme — weighing performance characteristics against the specific loading, environmental exposure, and maintenance regime expected, and reaching a reasoned recommendation.",
    "referral": "Gives a generic materials science answer without applying it to a specific infrastructure application or context.",
    "referralWhy": ["Generic properties recited without application to a specific context", "No reasoned recommendation reached based on the specific project requirements"],
    "challenge": ["What environmental exposure factors would change your material recommendation?", "How would you validate your material choice against relevant standards?"],
    "keyPoints": ["Material evaluation must be applied to a specific application, not generic", "Environmental exposure and loading conditions materially affect the right choice", "Reference to relevant standards strengthens the credibility of the advice"],
    "module": "Engineering Science & Technology"
  },
  {
    "q": "A contractor proposes an alternative construction methodology to the one specified in the design, citing cost savings. How would you assess this proposal?",
    "why": "Tests the ability to evaluate a value engineering proposal critically — balancing cost savings against risk, quality, and design intent.",
    "pass": "States that the proposal should be assessed for cost savings, quality, and risk before being accepted.",
    "high": "Describes a structured assessment process — checking the proposal against the original design intent and performance requirements, quantifying the actual saving (not just the contractor's claimed figure), assessing any programme or risk implications, and involving the design team before making a recommendation to the client.",
    "referral": "Accepts or rejects the proposal based on the headline cost saving alone, without a structured assessment of risk, quality, or design intent.",
    "referralWhy": ["Headline cost saving used as sole basis for decision", "Design intent, quality, and risk implications not assessed"],
    "challenge": ["What would make you recommend rejecting a cost-saving proposal despite the saving being genuine?", "How do you verify a contractor's claimed saving figure independently?"],
    "keyPoints": ["Value engineering proposals need structured assessment, not a headline-figure decision", "Design intent and performance requirements are as important as cost", "Independent verification of claimed savings protects the client's interests"],
    "module": "Engineering Science & Technology"
  },
  # ── Category 2: Cost, Quantification & Project Finance (Q11–20) ─────────────
  {
    "q": "Explain how you would prepare a benchmark cost study for an early-stage infrastructure project, and what key drivers you would consider.",
    "why": "Tests understanding of cost benchmarking as an evidence-based process, not a rule-of-thumb estimate.",
    "pass": "Explains that benchmarking uses historical cost data from comparable projects, adjusted for factors like location and scale.",
    "high": "Describes the specific process — sourcing comparable data (in-house or external databases), adjusting for key cost drivers (location, ground conditions, scale, procurement route, inflation), and presenting a benchmark range with a clear statement of the confidence level and assumptions, rather than a single misleadingly precise figure.",
    "referral": "Presents a single benchmark figure with no adjustment for project-specific factors, and no acknowledgement of accuracy limitations.",
    "referralWhy": ["Single figure presented without adjustment for project-specific cost drivers", "No acknowledgement of accuracy limitations or confidence level"],
    "challenge": ["How would you adjust a benchmark from a project completed five years ago?", "How do you communicate cost uncertainty to a client at an early project stage?"],
    "keyPoints": ["Benchmarking requires adjustment for project-specific cost drivers", "Presenting a range with stated confidence is more defensible than a single misleading figure", "Historical data needs adjustment for time, location, and scale"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "How would you carry out a whole-life costing exercise for an infrastructure asset, and what are its limitations?",
    "why": "Tests technical understanding of whole-life costing methodology and awareness of its inherent uncertainty.",
    "pass": "Explains that whole-life costing includes capital cost plus future maintenance, operation, and replacement costs over the asset's life.",
    "high": "Describes the process in more depth — discounting future costs to present value, the assumptions required about maintenance cycles and asset life, and explicitly addresses the limitation that whole-life costing is highly sensitive to the assumptions used (discount rate, inflation, asset life), meaning results should be presented with sensitivity analysis rather than as a single definitive figure.",
    "referral": "Describes whole-life costing mechanically without acknowledging its sensitivity to assumptions, or presents a single output figure as if it were certain.",
    "referralWhy": ["No acknowledgement of sensitivity to assumptions such as discount rate and asset life", "Single output figure presented as certain rather than as a model output"],
    "challenge": ["How sensitive is a whole-life cost model to the discount rate used?", "How would you present whole-life cost uncertainty to a client making a funding decision?"],
    "keyPoints": ["Whole-life costing requires discounting future costs and clear assumptions", "Results are highly sensitive to the assumptions used", "Sensitivity analysis should accompany any whole-life cost output"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "Explain the different sources of funding and investment finance available for infrastructure projects, and how you would advise a client on choosing between them.",
    "why": "Tests breadth of knowledge of infrastructure funding models and the ability to give client-specific advice rather than a generic list.",
    "pass": "Names common funding sources (public funding, private finance, blended models) and states that the choice depends on project type.",
    "high": "Explains how funding source affects project risk allocation, cost of capital, and delivery structure — for example, private finance models may transfer construction and availability risk to the private sector but at a higher cost of capital than public funding — and gives a reasoned recommendation based on a specific client's risk appetite and project characteristics.",
    "referral": "Lists funding sources without explaining how the choice affects risk, cost of capital, or delivery structure; gives generic advice not tailored to a specific client situation.",
    "referralWhy": ["Funding sources listed without explaining their effect on risk allocation or cost of capital", "Advice not tailored to the specific client's risk appetite or project characteristics"],
    "challenge": ["How would your advice differ for a client with a low risk appetite versus one seeking to transfer risk?", "What happens to project risk allocation under a privately financed model compared to conventional public funding?"],
    "keyPoints": ["Funding source choice affects risk allocation and cost of capital, not just where the money comes from", "Advice should be tailored to the client's specific risk appetite and project characteristics", "Understanding risk transfer is central to this competency"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "Describe how you would prepare a cost plan for an infrastructure project at the design development stage, including your approach to quantification.",
    "why": "Tests practical quantification and cost planning skill at a specific project stage.",
    "pass": "Explains that a cost plan at design development stage uses more detailed design information than an early benchmark, allowing more accurate quantification.",
    "high": "Describes the specific process — quantifying works using appropriate standard methods of measurement, applying current rates from a reliable source (historical data, first-principles build-up, or quotations), and presenting the cost plan with clear identification of risk allowances and areas of design uncertainty still to be resolved.",
    "referral": "Describes cost planning generically without reference to specific quantification methods, rate sources, or how design uncertainty is reflected in the cost plan.",
    "referralWhy": ["No reference to specific quantification methods or rate sources", "Design uncertainty not explicitly reflected or flagged in the cost plan"],
    "challenge": ["How would you handle an element of the design that is not yet finalised at cost plan stage?", "What would you do if your quantities significantly exceeded the client's budget?"],
    "keyPoints": ["Cost planning accuracy should improve as design develops", "Standard methods of measurement and reliable rate sources underpin credible quantification", "Design uncertainty should be explicitly flagged, not hidden in a single cost figure"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "How would you carry out a forensic cost analysis to determine the financial implications of a change on an infrastructure project?",
    "why": "Tests the ability to analyse cost impact retrospectively and reach a defensible, evidence-based conclusion.",
    "pass": "Explains that forensic analysis involves reviewing the change and its cost impact against the original scope and pricing.",
    "high": "Describes a structured process — establishing the baseline scope and pricing basis, identifying exactly what changed, applying appropriate valuation principles (contract rates, fair valuation, or first-principles costing where no rate exists), and presenting a clear, evidenced statement of the cost impact that would stand up to challenge from the other party.",
    "referral": "Reaches a conclusion about cost impact without a clear evidenced methodology, or cannot explain how the figure would be defended if challenged.",
    "referralWhy": ["No clear evidenced methodology for reaching the cost impact figure", "Unable to explain how the analysis would be defended under challenge"],
    "challenge": ["How would you value a change where no directly comparable contract rate exists?", "How would you respond if the other party disputed your forensic analysis?"],
    "keyPoints": ["Forensic cost analysis needs a clear, evidenced, and defensible methodology", "Establishing the baseline accurately is essential before assessing any change", "Being able to defend the analysis under challenge is part of the competency"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "Explain how you would identify and quantify financial risk on an infrastructure project, and how this feeds into cost reporting.",
    "why": "Tests the connection between risk identification and financial reporting — a core cost management skill.",
    "pass": "Explains that risks are identified, assessed, and an allowance is included in the cost plan or report.",
    "high": "Describes a structured process — identifying specific risks (ground conditions, design development, market conditions), assessing likelihood and cost impact, building a risk register with quantified allowances, and explains how this is reported transparently to the client alongside the base cost estimate, distinguishing base cost from risk contingency clearly.",
    "referral": "Includes a generic contingency percentage without identifying specific risks or explaining the basis for the allowance.",
    "referralWhy": ["Generic percentage contingency with no specific risk basis", "Base cost and risk contingency not distinguished in reporting"],
    "challenge": ["How would you respond to a client who wants to remove the risk contingency to reduce the headline budget?", "How do you review and update risk allowances as a project progresses?"],
    "keyPoints": ["Risk quantification should be based on specific identified risks, not a blanket percentage", "Base cost and risk contingency should be reported separately and transparently", "Risk allowances should be reviewed and updated as the project develops"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "What financial modelling techniques would you use to assess the viability of an infrastructure project, and what are their limitations?",
    "why": "Tests technical knowledge of financial modelling and critical awareness of model limitations.",
    "pass": "Names common techniques (discounted cash flow, sensitivity analysis) and states they help assess viability.",
    "high": "Explains how a specific technique (e.g. discounted cash flow) is applied to assess project viability, and critically addresses its limitations — sensitivity to discount rate and cash flow timing assumptions — recommending sensitivity analysis to test how viability changes under different scenarios rather than relying on a single output.",
    "referral": "Names techniques without explaining their application or limitations; treats a single model output as a definitive answer.",
    "referralWhy": ["Techniques named without explaining their application or limitations", "Single model output treated as a certain answer rather than a scenario"],
    "challenge": ["How would viability change if construction costs increased by 15%?", "What would you tell a client about the confidence level of your financial model's output?"],
    "keyPoints": ["Financial modelling techniques have real limitations that should be communicated", "Sensitivity analysis is essential to test viability under different scenarios", "A single model output should never be presented as a certain answer"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "How would you quantify infrastructure works at an early project stage when design information is limited?",
    "why": "Tests practical judgement in quantification under uncertainty — a common real-world scenario.",
    "pass": "States that early-stage quantification uses assumptions and approximate methods where detailed design is not available.",
    "high": "Explains specific approaches — using benchmark data, elemental cost analysis, or first-principles approximate quantities based on similar completed projects — and stresses the importance of clearly stating the basis and limitations of early quantification to avoid the figure being treated with false precision by the client.",
    "referral": "Produces an early-stage quantity or cost estimate without stating the basis or limitations, risking the client treating an approximate figure as definitive.",
    "referralWhy": ["Basis and limitations of early-stage quantification not stated", "Approximate figure presented without accuracy caveat, creating false precision"],
    "challenge": ["How would you explain the accuracy range of an early-stage estimate to a client?", "How would you update your quantification as design information becomes available?"],
    "keyPoints": ["Early-stage quantification relies on approximation methods and benchmark data", "Stating the basis and limitations prevents a client from over-relying on an approximate figure", "Quantification accuracy should improve as design information develops"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "Explain how you would present a cost report to a client with a strong emphasis on the degree of accuracy of your figures.",
    "why": "Tests communication skill around cost certainty — a frequently tested professional practice competency.",
    "pass": "States that a cost report should include an indication of accuracy alongside the headline figures.",
    "high": "Describes a structured approach — presenting figures as a range or with a stated confidence level appropriate to the project stage, clearly separating base cost, risk allowance, and any excluded items, and explaining in plain language (not just percentages) what could cause the actual outturn cost to differ from the reported figure.",
    "referral": "Presents a single, precise-looking figure without any indication of accuracy or the basis for the estimate, risking client over-reliance.",
    "referralWhy": ["Single precise-looking figure with no accuracy indication", "No explanation of what could cause the outturn cost to differ from the estimate"],
    "challenge": ["How would you handle a client who wants a single fixed figure rather than a range?", "What would you do if actual costs later diverged significantly from your reported estimate?"],
    "keyPoints": ["Cost reports should reflect genuine accuracy, not false precision", "Ranges and confidence levels should be explained in plain language, not just numerically", "Managing client expectations about cost certainty is a professional practice skill"],
    "module": "Cost, Quantification & Project Finance"
  },
  {
    "q": "How would you assess market factors and trends in construction costs, and how would this inform your advice to a client at project outset?",
    "why": "Tests market awareness and the ability to translate market conditions into practical client advice.",
    "pass": "States that market conditions (materials prices, labour availability, tender competition) affect construction cost and should be monitored.",
    "high": "Explains specific current market factors relevant to infrastructure (material price volatility, labour and skills shortages, contractor risk appetite and tender pricing behaviour) and gives a reasoned recommendation on timing, procurement strategy, or budget contingency based on the current market position, rather than a generic statement that the market affects cost.",
    "referral": "States generically that market conditions affect cost without identifying specific current factors or translating this into actionable advice for the client.",
    "referralWhy": ["Generic statement that markets affect cost, with no specific current factors named", "No actionable client advice derived from the market assessment"],
    "challenge": ["How would tight contractor capacity in the current market affect your advice on procurement timing?", "How would you monitor and update market cost advice as a project progresses?"],
    "keyPoints": ["Market awareness should translate into specific, actionable client advice", "Current market factors (materials, labour, contractor appetite) should be named specifically", "Market cost advice should be monitored and updated, not fixed at project outset"],
    "module": "Cost, Quantification & Project Finance"
  },
  # ── Category 3: Procurement, Contract & Programme (Q21–30) ──────────────────
  {
    "q": "Explain the main procurement routes available for an infrastructure project and how you would advise a client on selecting between them.",
    "why": "Tests breadth of procurement knowledge and the ability to give reasoned, client-specific advice rather than a generic comparison.",
    "pass": "Names common procurement routes (traditional, design and build, management contracting) and states that the choice depends on project characteristics.",
    "high": "Explains how each route allocates risk and design responsibility differently, and gives a reasoned recommendation based on the client's priorities — for example, recommending design and build where programme certainty is the priority and the client is willing to accept less design control, versus traditional procurement where design certainty and client control are paramount.",
    "referral": "Lists procurement routes with generic pros and cons, without connecting the recommendation to the specific client's priorities or risk appetite.",
    "referralWhy": ["Generic pros and cons listed without tailoring to the client's specific priorities", "No connection made between procurement route and risk allocation"],
    "challenge": ["How would your recommendation change if the client had never delivered a major infrastructure project before?", "What risk allocation differences exist between design and build and traditional procurement?"],
    "keyPoints": ["Procurement route choice is about risk allocation and control, not just a checklist comparison", "Advice should be tailored to the client's specific priorities and experience", "Programme certainty and design control are often the key trade-off"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "Describe the process of preparing tender documentation for an infrastructure project, and the key legal and commercial considerations involved.",
    "why": "Tests practical procurement and tendering process knowledge, plus awareness of the legal and commercial risks in tender documentation.",
    "pass": "Lists typical tender documents (letter of invitation, form of tender, specification) and states the process involves preparing and issuing these to prospective contractors.",
    "high": "Explains the process in more depth, including ensuring tender documentation clearly and consistently allocates risk, avoiding ambiguity that could lead to disputed claims later, and describes how commercial considerations (evaluation criteria, weighting of price versus quality) are built into the documentation from the outset.",
    "referral": "Describes tender documentation preparation mechanically, without addressing risk allocation clarity or how ambiguity in documents can create later disputes.",
    "referralWhy": ["Mechanical description of process without addressing risk allocation clarity", "Ambiguity in documentation and its consequences not addressed"],
    "challenge": ["What happens if tender documentation is ambiguous about risk allocation?", "How would you weight price versus quality in your evaluation criteria for a complex infrastructure project?"],
    "keyPoints": ["Tender documentation clarity directly affects later dispute risk", "Evaluation criteria should be decided and documented before tenders are issued", "Risk allocation should be unambiguous, not left to be resolved during the contract"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "How would you select the appropriate standard form of contract for an infrastructure project, and what factors would influence your choice?",
    "why": "Tests contract practice knowledge and the ability to match contract form to project needs.",
    "pass": "Names common standard forms (e.g. NEC, JCT) and states that the choice depends on the project and procurement route.",
    "high": "Explains how the chosen procurement route, risk allocation intent, and the client's familiarity with a particular form influence the choice — for example, recommending an NEC form where collaborative risk management and early warning mechanisms are valued, and explains any amendments that might be needed to standard clauses for the specific project.",
    "referral": "States a preference for a standard form without connecting the choice to procurement route, risk allocation, or client-specific factors.",
    "referralWhy": ["Preference for a form stated without connecting it to procurement route or risk allocation", "Client familiarity and specific project factors not considered"],
    "challenge": ["Why might a client prefer NEC over a more traditional standard form for a collaborative project?", "What amendments would you typically expect to make to a standard form for an infrastructure project?"],
    "keyPoints": ["Contract form choice should align with the procurement route and risk allocation intent", "Client familiarity and experience with a form is a legitimate factor in the choice", "Standard forms are rarely used entirely unamended in practice"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "Explain how you would develop and manage a project programme for an infrastructure scheme, including your approach to critical path analysis.",
    "why": "Tests practical programming and planning skill, including technical understanding of critical path methodology.",
    "pass": "Explains that a programme sequences activities and identifies the critical path — the sequence of activities determining the overall project duration.",
    "high": "Describes the process in more depth — building the programme from a logical breakdown of activities and dependencies, identifying the critical path and float on non-critical activities, and explains how the programme is used actively for monitoring progress and assessing the time impact of changes, rather than being a static document produced once and filed away.",
    "referral": "Describes programme preparation as a one-off document production exercise, without explaining ongoing use for progress monitoring or change impact assessment.",
    "referralWhy": ["Programme treated as a one-off document rather than a live management tool", "No mention of ongoing use for monitoring progress or assessing change impacts"],
    "challenge": ["How would you assess the time impact of a specific delay event using the programme?", "What is float, and how would you use it when advising a client on programme risk?"],
    "keyPoints": ["A programme should be a live management tool, not a static document", "Critical path and float understanding are essential to assessing delay impact", "Programmes need updating for actual progress and to reflect the impact of changes"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "How would you identify the impact of a contractual variation on the programme, and what would you advise the client?",
    "why": "Tests the connection between contract administration and programme management — a frequently tested area.",
    "pass": "States that a variation should be assessed for its impact on the programme, and the client advised accordingly.",
    "high": "Describes a structured process — assessing whether the variation affects activities on the critical path (rather than simply adding time to any activity), quantifying any resulting delay using recognised delay analysis techniques, and advising the client on both the time and likely cost implications together, since the two are usually connected.",
    "referral": "States that a variation may affect the programme without a structured method for assessing whether it actually affects the critical path or quantifying the impact.",
    "referralWhy": ["No structured method for assessing critical path impact", "Time and cost implications of variations not addressed together"],
    "challenge": ["What would you do if a variation affected a non-critical activity with float remaining?", "How would you defend your delay analysis if the contractor's assessment differed from yours?"],
    "keyPoints": ["Only critical path impacts genuinely extend the overall programme", "A structured delay analysis method is needed, not general judgement alone", "Time and cost implications of a variation are usually connected and should be advised together"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "Explain the key considerations in advising on the tendering strategy for a major infrastructure project, including single-stage versus two-stage tendering.",
    "why": "Tests understanding of tendering strategy options and when each is appropriate.",
    "pass": "Explains the difference between single-stage and two-stage tendering — single-stage tenders a fully designed scheme, while two-stage allows contractor input before the design is finalised.",
    "high": "Explains when two-stage tendering is advantageous — for example, on complex or technically challenging projects where early contractor input on buildability and programme can improve outcomes — versus when single-stage tendering is more appropriate, such as where the design is well-developed and price certainty is the priority, giving a reasoned recommendation for a specific project type.",
    "referral": "Describes the mechanical difference between the two approaches without explaining when each is advantageous or making a reasoned recommendation for a specific scenario.",
    "referralWhy": ["Mechanical difference described without explaining when each approach is appropriate", "No reasoned recommendation made for a specific project scenario"],
    "challenge": ["What are the risks of two-stage tendering from a client's perspective?", "How would you structure the second-stage negotiation to protect the client's cost position?"],
    "keyPoints": ["Tendering strategy choice depends on design maturity and the value of early contractor input", "Two-stage tendering trades some price certainty for improved buildability and programme input", "Client risk in two-stage tendering needs active management during the negotiation stage"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "Describe how you would manage document control and information management systems on a major infrastructure project.",
    "why": "Tests practical understanding of administrative and information management processes that underpin effective contract administration.",
    "pass": "States that document control involves systematically recording and tracking project documentation and correspondence.",
    "high": "Explains why robust document control matters practically — for example, being able to demonstrate exactly when a notice was issued or received is often decisive in a later contractual dispute — and describes a specific system or process used to ensure documents are version-controlled, time-stamped, and readily retrievable when needed.",
    "referral": "Describes document control as a purely administrative task without connecting it to its practical importance in contract administration and dispute avoidance.",
    "referralWhy": ["Described as purely administrative without connecting to contractual or legal significance", "No explanation of how document control supports dispute avoidance or resolution"],
    "challenge": ["How would document control practices support you in a later contractual dispute?", "What would you do if you discovered a gap in the document record for a critical decision?"],
    "keyPoints": ["Document control has real contractual and legal significance, not just administrative tidiness", "Being able to evidence exactly when something was issued or received is often decisive in disputes", "Systems should ensure documents are retrievable when they are needed, not just stored"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "Explain the third-party rights and collateral warranty considerations relevant to an infrastructure project contract.",
    "why": "Tests contract practice knowledge of third-party rights, a technically precise area frequently tested.",
    "pass": "Explains that third parties (such as funders or future owners) may need contractual rights or protections even though they are not party to the main contract.",
    "high": "Explains the mechanisms available — collateral warranties or contractual third-party rights provisions — and the practical considerations in each, such as who needs protection (funders, purchasers, tenants), what obligations are typically warranted, and the practical timing issues of obtaining warranties before they are needed (e.g. at financial close or handover).",
    "referral": "States generically that third parties may need protection without explaining the specific mechanisms available or when they need to be put in place.",
    "referralWhy": ["Specific mechanisms (collateral warranties vs third-party rights) not distinguished", "Timing of when warranties need to be obtained not addressed"],
    "challenge": ["What is the practical difference between a collateral warranty and a third-party rights clause?", "Why does timing matter when arranging collateral warranties?"],
    "keyPoints": ["Third-party protection mechanisms have real practical differences, not just legal technicalities", "Identifying who actually needs protection is the starting point", "Timing of when warranties are obtained matters as much as their content"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "How would you evaluate the appropriateness of a proposed contractual amendment to a standard form of contract?",
    "why": "Tests critical contract review skill — the ability to assess whether an amendment is fair, workable, and consistent with the intended risk allocation.",
    "pass": "States that an amendment should be reviewed to check it does not unfairly shift risk or create ambiguity.",
    "high": "Describes a structured review approach — checking the amendment against the originally intended risk allocation for the project, assessing whether it creates any conflict or ambiguity with other unamended clauses, and considering whether the amendment is market-standard practice or a more unusual departure that warrants specific client advice and possibly further negotiation.",
    "referral": "States that an amendment looks fine or looks risky without a structured basis for the assessment, or without checking for interaction with other contract clauses.",
    "referralWhy": ["No structured basis for the assessment — judgement given without analysis", "Interaction with other unamended contract clauses not checked"],
    "challenge": ["How would you advise a client if a proposed amendment significantly increased their risk exposure compared to market norm?", "What would you check for when an amendment interacts with other unamended standard clauses?"],
    "keyPoints": ["Contractual amendments need to be assessed against the intended risk allocation, not viewed in isolation", "Amendments can create unintended conflicts with unamended clauses", "Departure from market-standard practice warrants specific client advice"],
    "module": "Procurement, Contract & Programme"
  },
  {
    "q": "Explain how you would manage the tendering and negotiation process for an infrastructure contract to ensure a fair and competitive outcome for your client.",
    "why": "Tests process integrity and negotiation skill in a procurement context — a professional practice as much as a technical competency.",
    "pass": "States that the process should be run fairly and transparently, with clear evaluation criteria applied consistently to all bidders.",
    "high": "Describes specific practices that ensure fairness and competitiveness — maintaining consistent information to all bidders, applying pre-agreed evaluation criteria without post-hoc adjustment, managing clarification questions transparently, and negotiating firmly but professionally with a preferred bidder without disadvantaging the process integrity established for other bidders.",
    "referral": "Describes running a competitive process without addressing how consistency and fairness were actually maintained, or suggests adjusting criteria after tenders are received to favour a preferred outcome.",
    "referralWhy": ["Fairness described in principle without explaining how it is maintained in practice", "Adjusting evaluation criteria after receipt of tenders is suggested or implied"],
    "challenge": ["What would you do if you realised partway through the process that one bidder had been given different information to others?", "How do you balance getting the best commercial outcome with maintaining a fair process?"],
    "keyPoints": ["Process fairness and competitiveness are professional obligations, not just good practice", "Evaluation criteria should be fixed before tenders are received and applied consistently", "Managing information consistently across all bidders protects both fairness and the client's legal position"],
    "module": "Procurement, Contract & Programme"
  },
  # ── Category 4: Risk, Project Controls & Stakeholder Management (Q31–40) ────
  {
    "q": "Explain how you would identify and take ownership of a risk register on an infrastructure project, and how this feeds into client advice.",
    "why": "Tests practical risk management skill and the ability to translate a risk register into meaningful client advice, not just a compliance document.",
    "pass": "Explains that a risk register lists identified risks with an assessment of likelihood and impact, and is used to inform project decisions.",
    "high": "Describes a structured, ongoing process — identifying risks collaboratively with the project team, assessing likelihood and cost/time impact, assigning risk ownership to the party best placed to manage each risk, and reviewing the register regularly rather than treating it as a one-off exercise, with a clear example of how a specific identified risk changed a client's decision.",
    "referral": "Describes a risk register as a static document produced once at project outset, without ongoing review or a specific example of it influencing a real decision.",
    "referralWhy": ["Risk register treated as a static document rather than a live management tool", "No example of the register influencing a real client decision"],
    "challenge": ["How would you decide who should own a specific identified risk?", "Can you give an example where identifying a risk early changed the client's approach to a project?"],
    "keyPoints": ["Risk registers should be live, reviewed documents, not one-off exercises", "Risk ownership should sit with the party best placed to manage it", "A real example of risk-informed decision-making is stronger evidence than describing the process alone"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "How would you advise a client on the appropriate procurement route in relation to their attitude to risk?",
    "why": "Tests the connection between risk management and procurement strategy — a frequently tested cross-competency area.",
    "pass": "States that risk-averse clients may prefer procurement routes that transfer more risk to the contractor.",
    "high": "Explains the trade-offs in more depth — a client seeking to transfer risk (e.g. via design and build) typically pays a risk premium in price, while a client willing to retain more risk (e.g. via traditional procurement) may achieve better value but needs stronger in-house risk management capability, and gives a reasoned recommendation based on the specific client's risk appetite and organisational capability.",
    "referral": "States that risk-averse clients should transfer risk without explaining the cost trade-off or connecting the advice to the client's actual capability to manage retained risk.",
    "referralWhy": ["Risk transfer recommended without acknowledging the associated cost premium", "Client's actual capability to manage retained risk not considered"],
    "challenge": ["What would you advise a client with a low risk appetite but limited in-house project management capability?", "How would you quantify the risk premium associated with a risk-transfer procurement route?"],
    "keyPoints": ["Risk transfer comes with a cost premium, not a free option", "Advice should consider the client's actual capability to manage retained risk, not just stated risk appetite", "Procurement and risk strategy are inseparable in practice"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "Explain how you would establish a communication and reporting regime for project controls on a major infrastructure scheme.",
    "why": "Tests practical project controls knowledge, specifically the ability to design reporting that is genuinely useful rather than administrative box-ticking.",
    "pass": "States that a reporting regime should provide regular, structured updates on cost, time, and risk to relevant stakeholders.",
    "high": "Describes tailoring the reporting regime to its audience — for example, board-level stakeholders needing high-level dashboard summaries while the project team needs detailed data — and explains how the regime is designed to surface problems early (e.g. through exception reporting or trend analysis) rather than just presenting a status snapshot.",
    "referral": "Describes a generic reporting template used identically for all audiences, without addressing how the regime helps surface emerging problems early.",
    "referralWhy": ["Single generic reporting template applied to all audiences regardless of their needs", "No mechanism for surfacing problems early — only status snapshots"],
    "challenge": ["How would you adapt your reporting for a board audience versus the project delivery team?", "How would your reporting regime help identify a problem before it became critical?"],
    "keyPoints": ["Reporting should be tailored to its audience, not one-size-fits-all", "Good project controls reporting surfaces problems early, not just current status", "Exception reporting and trend analysis are more valuable than static snapshots"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "How would you use earned value management or a similar productivity and resource analysis technique on an infrastructure project?",
    "why": "Tests technical project controls knowledge and the ability to apply it practically rather than describe it theoretically.",
    "pass": "Explains that earned value management compares planned progress, actual progress, and cost to assess project performance.",
    "high": "Explains the specific metrics involved (planned value, earned value, actual cost) and how they combine to give schedule and cost performance indices, and describes how this data would be used practically — for example, to identify early that a project is trending toward cost or time overrun, prompting corrective action before the issue becomes severe.",
    "referral": "Names earned value management without explaining how the metrics are calculated or used to prompt any practical action.",
    "referralWhy": ["Metrics named without explaining what they measure or how they are calculated", "No connection made between EVM data and prompting practical corrective action"],
    "challenge": ["What would a cost performance index below 1.0 tell you about a project?", "How would you use this data to have a difficult conversation with a client about project performance?"],
    "keyPoints": ["Earned value management gives leading indicators of performance, not just historical record", "Understanding the specific metrics demonstrates real technical competence", "The purpose of the analysis is to prompt timely corrective action"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "Explain how you would identify and engage with the relevant stakeholders on a large, complex infrastructure project.",
    "why": "Tests stakeholder management skill, particularly the ability to move beyond identifying stakeholders to genuine engagement strategy.",
    "pass": "States that stakeholders should be identified and a plan developed for engaging with them appropriately.",
    "high": "Describes a structured approach — mapping stakeholders by their level of interest and influence, tailoring the engagement approach accordingly (e.g. close collaboration with high-influence stakeholders, appropriate but lighter-touch communication with lower-influence ones), and gives a specific example of adjusting an engagement strategy in response to a stakeholder's changing position during a project.",
    "referral": "Describes stakeholder identification without any structured prioritisation or tailored engagement approach; treats all stakeholders identically.",
    "referralWhy": ["All stakeholders treated identically regardless of interest or influence", "No tailored engagement strategy developed from the mapping exercise"],
    "challenge": ["How would you handle a stakeholder whose position on the project changed significantly partway through?", "What tools have you used to map and prioritise stakeholders?"],
    "keyPoints": ["Stakeholder engagement should be tailored based on influence and interest, not uniform", "Engagement strategies need to adapt as stakeholder positions evolve", "A specific real example demonstrates genuine practical skill"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "How would you manage a supplier or group of suppliers on an infrastructure project to ensure service and cost expectations are met?",
    "why": "Tests supplier management skill, particularly the ability to scale the management approach appropriately to risk and scale.",
    "pass": "States that suppliers should be managed through regular performance review and monitoring against agreed service levels.",
    "high": "Describes an approach scaled to the scale and risk of the service — for example, a critical, high-value supplier warranting close, structured performance review meetings and key performance indicators, versus a lower-risk supplier requiring lighter-touch monitoring — and explains how underperformance would be identified and addressed through a defined escalation process.",
    "referral": "Describes a single generic supplier management process applied uniformly regardless of the supplier's risk or criticality to the project.",
    "referralWhy": ["Single generic process applied uniformly regardless of supplier risk or criticality", "No escalation process described for managing underperformance"],
    "challenge": ["How would your approach differ for a critical single-source supplier versus one with readily available alternatives?", "What would you do if a key supplier consistently underperformed against agreed KPIs?"],
    "keyPoints": ["Supplier management intensity should scale with risk and criticality, not be applied uniformly", "Clear KPIs and an escalation process are essential for managing underperformance", "Critical suppliers warrant closer, more structured oversight"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "Explain how you would advise on the appropriate methodologies and approach to risk on a specific infrastructure project.",
    "why": "Tests the ability to tailor risk management methodology to project characteristics, rather than apply a one-size-fits-all approach.",
    "pass": "States that risk management methodology should be appropriate to the scale and complexity of the project.",
    "high": "Explains how project characteristics inform the choice — for example, a large, complex, novel project may warrant quantitative risk analysis (such as Monte Carlo simulation) to model cost and time uncertainty, while a smaller, more conventional project may be adequately served by a qualitative risk register — and gives a reasoned recommendation for a specific project scenario.",
    "referral": "Recommends the same risk methodology regardless of project scale or complexity, without justifying the choice against the specific project's characteristics.",
    "referralWhy": ["Same methodology recommended regardless of project scale or complexity", "No justification of the choice against the specific project's characteristics"],
    "challenge": ["When would you recommend quantitative risk modelling over a simpler qualitative risk register?", "How would you explain the output of a quantitative risk model to a non-technical client?"],
    "keyPoints": ["Risk methodology should be proportionate to project scale and complexity", "Quantitative techniques add value on complex, novel, or high-value projects", "Communicating technical risk analysis in accessible terms is part of the competency"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "How would you advise a client on the appropriate level of contingency for an infrastructure project, and how would you justify this to them?",
    "why": "Tests the ability to move beyond a generic percentage contingency to a justified, risk-based figure.",
    "pass": "States that contingency should be based on the assessed risks for the project rather than an arbitrary percentage.",
    "high": "Describes deriving the contingency figure from the quantified risk register — summing the probability-weighted cost impact of identified risks — and explains how this would be presented to the client transparently, distinguishing the base estimate from the risk-based contingency, and addressing how the contingency might reduce as risks are resolved or retired through the project lifecycle.",
    "referral": "Recommends a standard percentage contingency (e.g. ten per cent as usual) without deriving it from the actual assessed risks on the specific project.",
    "referralWhy": ["Standard percentage contingency applied without deriving from specific assessed risks", "No distinction made between base estimate and risk-based contingency"],
    "challenge": ["How would you respond to a client who thinks your recommended contingency is too high?", "How should contingency change as the project progresses and risks are resolved?"],
    "keyPoints": ["Contingency should be derived from specific assessed risks, not a standard percentage", "Transparency about the basis for contingency builds client trust and defensibility", "Contingency should reduce over time as risks are resolved or retired"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "Explain the barriers and risks involved in implementing (and in not implementing) formal project or asset management systems on an infrastructure project or portfolio.",
    "why": "Tests balanced, critical thinking about management systems — recognising that implementation itself carries risk and cost, not just benefit.",
    "pass": "States that formal management systems improve control and decision-making, but implementation can be costly and time-consuming.",
    "high": "Explains the trade-off in more depth — the risk of not implementing a system (poor data, inconsistent decision-making, difficulty demonstrating due diligence) against the real costs and risks of implementation (disruption, cost, resistance to change, and the risk of adopting a system disproportionate to the organisation's actual needs) — and gives a reasoned recommendation appropriate to a specific client's scale and maturity.",
    "referral": "Presents formal systems as an unambiguous good without acknowledging genuine implementation costs, risks, or the possibility that a lighter-touch approach may be more appropriate for a smaller client.",
    "referralWhy": ["Implementation costs and risks not acknowledged", "Possibility that a formal system may be disproportionate to the client's needs not considered"],
    "challenge": ["When might you advise a client against implementing a formal system that seems attractive in principle?", "How would you scale your recommendation to a smaller organisation with limited resources?"],
    "keyPoints": ["Formal systems carry genuine implementation costs and risks, not just benefits", "Recommendations should be proportionate to the client's actual scale and maturity", "Critical, balanced advice is stronger than presenting any single approach as unambiguously correct"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  {
    "q": "How would you advise upon the structure and make-up of a project or delivery team for a complex infrastructure scheme?",
    "why": "Tests leadership and team structuring competency, connecting technical project needs to people and organisational design.",
    "pass": "States that the team structure should reflect the skills and roles needed to deliver the project successfully.",
    "high": "Describes a structured approach — assessing the project's specific technical, commercial, and stakeholder management demands, identifying any skill gaps in the existing team, and advising on team structure, reporting lines, and any additional recruitment or consultant appointments needed, with a specific example of adapting a team structure in response to identified gaps or changing project needs.",
    "referral": "Describes team structuring in generic organisational terms without connecting it to the specific technical or commercial demands of the project, or without a real example.",
    "referralWhy": ["Generic organisational structure proposed without connecting to specific project demands", "No real example of adapting a team structure in response to identified needs"],
    "challenge": ["How would you identify a skill gap in an existing project team?", "What would you do if a team structure that worked well at project outset needed to change as the project progressed?"],
    "keyPoints": ["Team structure should be driven by the specific demands of the project, not generic organisational templates", "Identifying and addressing skill gaps is an active, ongoing responsibility", "Team structures may need to evolve as a project progresses through different phases"],
    "module": "Risk, Project Controls & Stakeholder Management"
  },
  # ── Category 5: Professional Practice & Client Care (Q41–50) ─────────────────
  {
    "q": "A pluralistic client (such as a government department or utility company) has multiple internal stakeholders with different priorities. How would you scope and confirm their requirements for an infrastructure project?",
    "why": "Tests client care competency in the specific context of complex, multi-stakeholder public or corporate clients common in infrastructure work.",
    "pass": "States that requirements should be gathered from relevant stakeholders and confirmed in a project brief.",
    "high": "Describes a structured approach — identifying the different internal stakeholders and their potentially competing priorities, facilitating a process to reconcile or prioritise these into a single coherent client brief, and confirming the agreed brief formally in writing to avoid later disputes about scope, with a specific example of managing conflicting internal client priorities.",
    "referral": "Treats the client as a single entity with one voice, without addressing how competing internal priorities were identified or reconciled.",
    "referralWhy": ["Client treated as a single entity without identifying competing internal priorities", "No process described for reconciling conflicting requirements into a coherent brief"],
    "challenge": ["What would you do if two internal stakeholders gave you conflicting instructions?", "How do you formally confirm a brief once competing priorities have been reconciled?"],
    "keyPoints": ["Pluralistic clients often have internal priorities that need active reconciliation", "A formally confirmed brief protects against later scope disputes", "Facilitating agreement between internal stakeholders is a genuine client care skill"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "Explain how you would negotiate and set fees for an infrastructure consultancy instruction, and the ethical considerations involved.",
    "why": "Tests client care and business planning competency together, including RICS ethical standards around fee-setting.",
    "pass": "States that fees should be agreed transparently with the client before work begins, reflecting the scope and complexity of the instruction.",
    "high": "Explains the process in more depth — how fee structure (fixed fee, percentage, time-based) is matched to the nature of the instruction, and addresses the ethical dimension: ensuring the fee basis does not create a conflict of interest (for example, a percentage fee tied to project cost could incentivise inflated costs) and that the fee proposal is transparent and justifiable if challenged.",
    "referral": "Describes fee-setting purely as a commercial negotiation without addressing the ethical dimension of conflicts of interest that certain fee structures can create.",
    "referralWhy": ["Fee-setting treated as purely commercial without addressing ethical considerations", "Conflict of interest risk in certain fee structures not identified"],
    "challenge": ["What conflict of interest could arise from a percentage-based fee tied to project cost?", "How would you respond to a client who felt your fee proposal was not transparent?"],
    "keyPoints": ["Fee structure choice has ethical as well as commercial dimensions", "Certain fee bases can create real or perceived conflicts of interest", "Transparency in fee-setting is a professional obligation, not just good client relations"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "How would you handle a situation where a client's instructions conflict with your professional judgement on an infrastructure project?",
    "why": "Tests ethics and professional conduct — specifically the ability to maintain professional independence under client pressure.",
    "pass": "States that professional advice should be given honestly, even where it differs from what the client wants to hear.",
    "high": "Describes a specific approach — clearly explaining the professional basis for the advice, documenting the advice given (protecting both client and surveyor), and if the client proceeds against that advice, ensuring this is recorded so the professional position is clear, while maintaining a constructive working relationship rather than an adversarial one.",
    "referral": "Suggests simply following client instructions to preserve the relationship, without addressing the professional obligation to give honest advice or the importance of documenting the position taken.",
    "referralWhy": ["Following client instructions prioritised over professional obligation to give honest advice", "Importance of documenting professional advice given not recognised"],
    "challenge": ["What would you do if a client asked you to change a report to remove advice they did not want to hear?", "How do you maintain a good working relationship while still disagreeing professionally with a client?"],
    "keyPoints": ["Professional independence must be maintained even under client pressure", "Documenting advice given protects both the client and the surveyor", "Disagreement can be handled constructively without damaging the working relationship"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "Explain how you would identify and manage a dispute arising on an infrastructure project before it escalates to formal proceedings.",
    "why": "Tests conflict avoidance and dispute resolution competency — a mandatory competency tested across all pathways but with infrastructure-specific context.",
    "pass": "States that early identification and negotiation can often resolve disputes before they escalate to formal processes like adjudication or arbitration.",
    "high": "Describes the dispute resolution ladder in more depth — negotiation, followed by structured options like mediation, dispute resolution boards, or adjudication before litigation as a last resort — and explains how early warning systems and clear contractual communication reduce the likelihood of disputes escalating, with a specific example of a dispute resolved before reaching formal proceedings.",
    "referral": "Jumps straight to describing formal dispute resolution mechanisms without addressing avoidance and early-stage negotiation, or has no real example of dispute avoidance in practice.",
    "referralWhy": ["Jumps to formal mechanisms without addressing avoidance and early negotiation", "No real example of a dispute resolved before reaching formal proceedings"],
    "challenge": ["What early warning signs would prompt you to escalate your own management attention to a potential dispute?", "When would you recommend adjudication over mediation?"],
    "keyPoints": ["Dispute avoidance and early negotiation should always be tried before formal processes", "A structured dispute resolution ladder exists between negotiation and litigation", "A real example of early resolution demonstrates practical skill, not just theoretical knowledge"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "How would you advise a client on the sustainability implications of a major infrastructure decision, such as choosing between refurbishment and new build?",
    "why": "Tests sustainability competency applied to a genuinely infrastructure-relevant decision.",
    "pass": "States that sustainability factors, including carbon impact, should be considered alongside cost and technical factors in the decision.",
    "high": "Explains the trade-off in more depth — for example, weighing the embodied carbon saved by refurbishment against the potential operational efficiency gains of a new-build solution — and gives a reasoned recommendation that balances sustainability, cost, and technical performance rather than treating sustainability as a separate add-on consideration.",
    "referral": "Mentions sustainability as a general consideration without engaging with the specific trade-off between embodied and operational carbon, or without connecting it to a reasoned recommendation.",
    "referralWhy": ["Sustainability mentioned generically without engaging with the embodied vs operational carbon trade-off", "No reasoned recommendation that integrates sustainability with cost and technical factors"],
    "challenge": ["How would you quantify the embodied carbon difference between refurbishment and new build for a client?", "How would you handle a decision where the more sustainable option was also significantly more expensive?"],
    "keyPoints": ["Sustainability decisions on infrastructure often involve a genuine embodied-versus-operational carbon trade-off", "Sustainability should be integrated into the decision, not treated as separate from cost and technical factors", "Being able to quantify sustainability impact strengthens the advice given"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "Explain the cross-cultural considerations you would need to be aware of when working on an infrastructure project with international stakeholders or teams.",
    "why": "Tests cross-cultural awareness in a global business context — directly relevant given infrastructure's frequently international nature.",
    "pass": "States that different business cultures have different communication styles, expectations, and ways of working that need to be understood and respected.",
    "high": "Gives a specific example of a cross-cultural consideration that affected a real project — for example, differing expectations around contractual formality, decision-making hierarchy, or negotiation style between jurisdictions — and explains how the team's approach was adapted to work effectively across these differences, rather than assuming a single approach would work universally.",
    "referral": "Makes generic statements about cultural awareness without a specific example or explanation of how an approach was actually adapted in practice.",
    "referralWhy": ["Generic cultural awareness stated without a specific example", "No explanation of how the team's approach was actually adapted in practice"],
    "challenge": ["How would you adapt your communication style working with a team from a culture with a different approach to hierarchy and decision-making?", "What would you do if a cultural misunderstanding caused a breakdown in a working relationship?"],
    "keyPoints": ["Cross-cultural awareness needs to translate into actual adapted behaviour, not just acknowledgement of difference", "Decision-making hierarchy and communication style are common areas of cross-cultural friction", "A specific real example is much stronger evidence than a general statement of awareness"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "How would you advise a client on the compulsory purchase process where land needs to be acquired for an infrastructure scheme?",
    "why": "Tests compulsory purchase and compensation knowledge, a technically distinct optional competency relevant to major infrastructure schemes.",
    "pass": "Explains that compulsory purchase allows land to be acquired for schemes in the public interest, with compensation payable to those affected.",
    "high": "Explains the process and principles in more depth — the stages of making, confirming, and implementing a compulsory purchase order, the basic compensation principles (such as the before-and-after approach), and gives a reasoned view on managing the process efficiently while remaining fair to affected landowners, referencing the role of negotiation before formal proceedings such as a public inquiry.",
    "referral": "Describes compulsory purchase in only the vaguest terms, without reference to the process stages, compensation principles, or a balance between efficiency and fairness to affected parties.",
    "referralWhy": ["Process stages not described — only the general concept of CPO referenced", "Compensation principles not mentioned; balance between efficiency and fairness not considered"],
    "challenge": ["What are the basic principles used to assess compensation in a compulsory purchase claim?", "How would you try to avoid a formal public inquiry through early negotiation with affected landowners?"],
    "keyPoints": ["Compulsory purchase involves defined process stages that must be followed correctly", "Compensation principles need to be understood and correctly applied, not just referenced generally", "Early negotiation with affected parties can avoid the time and cost of a formal public inquiry"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "Explain how you would approach the implementation of a Building Information Modelling (BIM) strategy on an infrastructure project.",
    "why": "Tests BIM management knowledge and its practical, collaborative application on an infrastructure scheme.",
    "pass": "Explains that BIM involves creating a shared digital model of the asset to support collaboration and information management across the project team.",
    "high": "Describes the practical implementation process — preparing a BIM execution plan, agreeing information exchange protocols and responsibilities between the project team, and explains the tangible benefits realised (such as improved design coordination and clash detection) alongside the practical challenges of adoption, such as varying levels of BIM maturity across different team members or organisations.",
    "referral": "Describes BIM only as a general digital design tool without addressing execution planning, information exchange protocols, or the practical challenges of team-wide adoption.",
    "referralWhy": ["BIM described only as a general digital tool without execution planning or protocols", "Practical challenges of team-wide adoption — including varying BIM maturity — not acknowledged"],
    "challenge": ["How would you manage a project where team members had significantly different levels of BIM maturity?", "What specific benefits has BIM delivered on a project you have worked on?"],
    "keyPoints": ["BIM implementation requires a structured execution plan and clear information exchange protocols", "Varying BIM maturity across a project team is a common, real practical challenge", "Being able to name specific realised benefits demonstrates genuine practical experience"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "How would you demonstrate the diversity, inclusion, and teamworking mandatory competency in the context of leading an infrastructure project team?",
    "why": "Tests the mandatory diversity, inclusion and teamworking competency in a leadership-relevant infrastructure context.",
    "pass": "States that an inclusive approach to leadership involves valuing different perspectives and ensuring all team members feel able to contribute.",
    "high": "Gives a specific example of actively fostering inclusion in a team context — for example, adapting communication or meeting approaches to ensure quieter team members or those from different professional backgrounds were genuinely heard — and connects this to a tangible project benefit, such as identifying a risk or issue that might otherwise have been missed.",
    "referral": "Makes a general statement about valuing diversity without a specific example of action taken or connecting it to any tangible project outcome.",
    "referralWhy": ["General statement of values without specific action taken to foster inclusion", "No tangible project benefit connected to inclusive practice"],
    "challenge": ["Can you describe a time when actively seeking a different perspective changed a project decision?", "How do you ensure less senior or more junior team members feel able to raise concerns?"],
    "keyPoints": ["Diversity and inclusion competency should be demonstrated through specific action, not general statements of value", "Genuinely inclusive practice can surface risks or issues that would otherwise be missed", "Real examples are essential evidence for this mandatory competency"],
    "module": "Professional Practice & Client Care"
  },
  {
    "q": "Reflecting on your experience across infrastructure projects, describe a situation where you had to exercise significant professional judgement, and explain how you arrived at your decision.",
    "why": "This is a closing, integrative question testing overall professional judgement and the ability to synthesise technical, commercial, and ethical considerations into a single reasoned decision — the hallmark of Level 3 competency.",
    "pass": "Describes a situation involving a decision and the factors considered, reaching a reasonable conclusion.",
    "high": "Describes a genuinely complex situation involving competing pressures (for example, technical risk, client budget constraints, and programme pressure all pulling in different directions), explains the reasoning process used to weigh these factors, the decision reached, and reflects honestly on what was learned from the outcome — including anything that would be done differently with hindsight.",
    "referral": "Describes a straightforward situation with an obvious answer, presented as if it required significant judgement; shows no genuine reflection on the reasoning process or what was learned.",
    "referralWhy": ["Straightforward situation with an obvious answer presented as if it required significant judgement", "No genuine reflection on the reasoning process or what was learned from the outcome"],
    "challenge": ["What would you have done differently with the benefit of hindsight?", "How did you communicate your reasoning to the client or stakeholders affected by the decision?"],
    "keyPoints": ["Genuine professional judgement questions should involve real competing pressures, not an obvious answer", "Assessors want to see the reasoning process, not just the final decision", "Honest reflection, including what might be done differently, demonstrates real professional maturity"],
    "module": "Professional Practice & Client Care"
  }
]

assert len(INFRA_QUESTIONS) == 50, f"Expected 50 questions, got {len(INFRA_QUESTIONS)}"
print(f"INFRA_QUESTIONS: {len(INFRA_QUESTIONS)} questions validated")

# Verify category counts
from collections import Counter
cats = Counter(q['module'] for q in INFRA_QUESTIONS)
for cat, count in cats.items():
    print(f"  {cat}: {count}")
assert all(v == 10 for v in cats.values()), "Each category should have 10 questions"

infra_json = json.dumps(INFRA_QUESTIONS, ensure_ascii=False, separators=(', ', ': '))
# Reformat as JS array with single-entry objects on one line
# Use compact JSON and wrap as const declaration
infra_js_array = 'const INFRA_QUESTIONS = ' + json.dumps(INFRA_QUESTIONS, ensure_ascii=False, separators=(',', ':')) + ';'
print(f"INFRA_QUESTIONS JS: {len(infra_js_array):,} chars")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: PATHWAYS array — add Infrastructure between Geomatics and Land
# ─────────────────────────────────────────────────────────────────────────────
old1 = "'Geomatics','Land and Resources'"
new1 = "'Geomatics','Infrastructure','Land and Resources'"
assert html.count(old1) == 1, f"Change 1: found {html.count(old1)}"
html = html.replace(old1, new1)
print("Change 1: Infrastructure added to PATHWAYS")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Remove the incorrect note paragraph at line 2200
# ─────────────────────────────────────────────────────────────────────────────
old2 = '    <p style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.65;max-width:620px;margin:0 auto 20px;text-align:center;font-style:italic">Infrastructure is not a standalone RICS APC pathway — please select the pathway that matches your role, typically one of the following depending on your specialism: Project Management (infrastructure projects, programme delivery), Quantity Surveying &amp; Construction (cost management on infrastructure schemes), Building Surveying (building/structures elements), Planning &amp; Development (infrastructure planning, DCO work), Geospatial (utilities, mapping, land referencing).</p>\n'
assert html.count(old2) == 1, f"Change 2: found {html.count(old2)}"
html = html.replace(old2, '')
print("Change 2: Incorrect Infrastructure note removed")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: CSS overlay selectors — add #infraOverlay
# ─────────────────────────────────────────────────────────────────────────────
old3 = '#mcOverlay,#saOverlay{display:none;position:fixed;inset:0;background:#0D0F1C;z-index:9998;overflow-y:auto;flex-direction:column}'
new3 = '#mcOverlay,#saOverlay,#infraOverlay{display:none;position:fixed;inset:0;background:#0D0F1C;z-index:9998;overflow-y:auto;flex-direction:column}'
assert html.count(old3) == 1, f"Change 3: found {html.count(old3)}"
html = html.replace(old3, new3)

old3b = '#mcOverlay .bso-question,#saOverlay .bso-question{'
new3b = '#mcOverlay .bso-question,#saOverlay .bso-question,#infraOverlay .bso-question{'
assert html.count(old3b) == 1
html = html.replace(old3b, new3b)

old3c = '#mcOverlay .bso-reveal-btn,#saOverlay .bso-reveal-btn{'
new3c = '#mcOverlay .bso-reveal-btn,#saOverlay .bso-reveal-btn,#infraOverlay .bso-reveal-btn{'
assert html.count(old3c) == 1
html = html.replace(old3c, new3c)

old3d = '#mcOverlay .bso-reveal-btn.revealed,#saOverlay .bso-reveal-btn.revealed{'
new3d = '#mcOverlay .bso-reveal-btn.revealed,#saOverlay .bso-reveal-btn.revealed,#infraOverlay .bso-reveal-btn.revealed{'
assert html.count(old3d) == 1
html = html.replace(old3d, new3d)

old3e = '#mcOverlay .bso-reveal-content,#saOverlay .bso-reveal-content{'
new3e = '#mcOverlay .bso-reveal-content,#saOverlay .bso-reveal-content,#infraOverlay .bso-reveal-content{'
assert html.count(old3e) == 1
html = html.replace(old3e, new3e)
print("Change 3: CSS overlay selectors updated for infraOverlay")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Dashboard card — insert before saQuestionBank div
# ─────────────────────────────────────────────────────────────────────────────
infra_card = '''      <div class="bs-qbank" id="infraQuestionBank" style="display:none">
        <div class="panel-eyebrow panel-eyebrow-light">INFRASTRUCTURE PATHWAY</div>
        <div class="bs-qbank-title">&#x1F3D7;&#xFE0F; Your Infrastructure Question Bank</div>
        <div class="bs-qbank-sub">50 assessor-led questions every Infrastructure candidate should be able to answer before final assessment</div>
        <div class="bs-qbank-stats" id="infraQBankStats">
          <span class="bs-stat-pill" id="infraStatAttempted">0 of 50 attempted</span>
          <span class="bs-stat-pill" id="infraStatGot" style="background:rgba(22,163,74,.15);color:#86efac;border-color:rgba(22,163,74,.2)">0 &#x2713; confident</span>
          <div class="bs-mini-bar"><div class="bs-mini-bar-fill" id="infraMiniBarFill" style="width:0%"></div></div>
        </div>
        <button id="infraStartBtn" onclick="openInfraOverlay()" style="background:#2563EB;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;letter-spacing:.01em;cursor:pointer;font-family:var(--f)">Start Question Bank</button>
      </div>
'''
old4 = '      <div class="bs-qbank" id="saQuestionBank" style="display:none">'
assert html.count(old4) == 1, f"Change 4: found {html.count(old4)}"
html = html.replace(old4, infra_card + '      <div class="bs-qbank" id="saQuestionBank" style="display:none">')
print("Change 4: infraQuestionBank dashboard card added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: renderPathwayBadge — add infra variable, show/hide, stats call
# ─────────────────────────────────────────────────────────────────────────────
old5a = "  const sa = document.getElementById('saQuestionBank');"
new5a = "  const sa = document.getElementById('saQuestionBank');\n  const infra = document.getElementById('infraQuestionBank');"
assert html.count(old5a) == 1
html = html.replace(old5a, new5a)

old5b = "  if (sa) sa.style.display = (pathway === 'Sustainability Advisory') ? 'block' : 'none';"
new5b = "  if (sa) sa.style.display = (pathway === 'Sustainability Advisory') ? 'block' : 'none';\n  if (infra) infra.style.display = (pathway === 'Infrastructure') ? 'block' : 'none';"
assert html.count(old5b) == 1
html = html.replace(old5b, new5b)

old5c = "  saUpdateDashboardStats();\n}"
new5c = "  saUpdateDashboardStats();\n  infraUpdateDashboardStats();\n}"
# Find the specific instance inside renderPathwayBadge
assert html.count(old5c) == 1, f"Change 5c: found {html.count(old5c)}"
html = html.replace(old5c, new5c)
print("Change 5: renderPathwayBadge wired for Infrastructure")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: INFRA_QUESTIONS array — insert after SA_QUESTIONS
# ─────────────────────────────────────────────────────────────────────────────
old6 = "];\n\n// ── MICHAEL IN-MODULE CHAT PANEL"
new6 = "];\n\n" + infra_js_array + "\n\n// ── MICHAEL IN-MODULE CHAT PANEL"
assert html.count(old6) == 1, f"Change 6: found {html.count(old6)}"
html = html.replace(old6, new6)
print("Change 6: INFRA_QUESTIONS array inserted")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: JS functions — insert before MICHAEL IN-MODULE CHAT PANEL comment
# ─────────────────────────────────────────────────────────────────────────────
infra_js = '''

// ── INFRASTRUCTURE QUESTION BANK UI ───────────────────────────────────────────
let _infraIndex = 0;
let _infraRevealed = false;
let _infraFiltered = null;

function openInfraOverlay() {
  _infraFiltered = null;
  _infraRevealed = false;
  const saved = JSON.parse(localStorage.getItem('gca_infra_progress') || '{}');
  const isFirstTime = Object.keys(saved).length === 0;
  const resume = INFRA_QUESTIONS.findIndex(function(_, i){ return saved[i] === undefined; });
  _infraIndex = resume === -1 ? 0 : resume;
  const el = document.getElementById('infraOverlay');
  el.style.display = 'flex';
  const sel = document.getElementById('infraModuleFilter');
  if (sel) sel.value = '';
  const closeBtn = document.querySelector('#infraOverlay .bso-close');
  if (closeBtn) closeBtn.textContent = '\\u2715 Save & Exit';
  if (isFirstTime) {
    document.getElementById('infraBody').innerHTML = '<div style="max-width:960px;margin:0 auto;padding:40px 20px;text-align:center"><div style="font-size:48px;margin-bottom:24px">&#x1F3D7;&#xFE0F;</div><h2 style="color:#fff;font-size:24px;margin-bottom:16px">How to use your Question Bank</h2><div style="text-align:left;background:#1e2235;border-radius:12px;padding:40px 48px;margin-bottom:28px"><p style="color:#f0f4ff;margin-bottom:16px">Each question works like a real APC assessor conversation. Here is how to get the most from it:</p><ol style="color:#f0f4ff;line-height:2"><li><strong style="color:#60a5fa">Read the question</strong> \\u2014 think about how you would answer it out loud</li><li><strong style="color:#60a5fa">Reveal why assessors ask it</strong> \\u2014 understand what they are really testing</li><li><strong style="color:#60a5fa">Check the pass-level answer</strong> \\u2014 the minimum expected from a chartered candidate</li><li><strong style="color:#60a5fa">Read the high-scoring answer</strong> \\u2014 this is what separates passes from strong passes</li><li><strong style="color:#60a5fa">See the referral answer</strong> \\u2014 understand exactly what to avoid</li><li><strong style="color:#60a5fa">Mark your confidence</strong> \\u2014 "I got this" or "Need more practice" tracks your progress</li></ol></div><p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:28px">You can close at any time and your progress is saved. Use the module filter to jump to specific topics.</p><button onclick="infraRender()" style="background:#2563EB;color:#fff;border:none;border-radius:8px;padding:14px 32px;font-size:16px;font-weight:600;cursor:pointer">Start with Question 1 \\u2192</button></div>';
  } else {
    infraRender();
  }
}

function closeInfraOverlay() {
  document.getElementById('infraOverlay').style.display = 'none';
  const btn = document.getElementById('infraStartBtn');
  if (btn) btn.textContent = 'Continue from Q' + (_infraIndex + 1);
}

function infraQuestions() {
  return _infraFiltered || INFRA_QUESTIONS;
}

function infraJumpToModule(mod) {
  _infraFiltered = mod ? INFRA_QUESTIONS.filter(function(q){ return q.module === mod; }) : null;
  _infraIndex = 0;
  infraRender();
}

function infraRender() {
  var qs = infraQuestions();
  var q = qs[_infraIndex];
  var prog = Math.round((_infraIndex / qs.length) * 100);
  document.getElementById('infraCounter').textContent = 'Question ' + (_infraIndex + 1) + ' of ' + qs.length;
  document.getElementById('infraModule').textContent = q.module;
  document.getElementById('infraProgressFill').style.width = prog + '%';
  var saved = JSON.parse(localStorage.getItem('gca_infra_progress') || '{}');
  var globalIdx = INFRA_QUESTIONS.indexOf(q);
  var verdict = saved[globalIdx];
  document.getElementById('infraBody').innerHTML =
    '<div class="bso-question">' + q.q + '</div>' +
    '<div class="bso-reveal-content show" style="margin-bottom:16px">' + q.why + '</div>' +
    (_infraRevealed ?
      '<div class="bso-reveal-content show"><strong style="color:#93c5fd;display:block;margin-bottom:6px">Pass-level answer</strong>' + q.pass + '</div>' +
      '<div class="bso-reveal-content show"><strong style="color:#93c5fd;display:block;margin-bottom:6px">High-distinction answer</strong>' + q.high + '</div>' +
      '<div class="bso-reveal-content bso-referral-content show"><strong>Referral answer \\u2014 avoid this</strong><br>' + q.referral + '<ul>' + q.referralWhy.map(function(r){return '<li>'+r+'</li>';}).join('') + '</ul></div>' +
      '<div class="bso-challenge"><strong>\\uD83C\\uDFAF Challenge Questions</strong><ul>' + q.challenge.map(function(c){return '<li>'+c+'</li>';}).join('') + '</ul></div>' +
      '<div class="bso-keypoints"><strong>\\uD83D\\uDCCC Key Learning Points</strong><ol>' + q.keyPoints.map(function(k){return '<li>'+k+'</li>';}).join('') + '</ol></div>' +
      '<div class="bso-actions">' +
        '<button class="bso-got" onclick="infraMark(\\'got\\')" ' + (verdict==='got'?'style="background:#16a34a"':'') + '>\\u2713 Got it</button>' +
        '<button class="bso-practice" onclick="infraMark(\\'practice\\')" ' + (verdict==='practice'?'style="border-color:#f59e0b;color:#fbbf24"':'') + '>\\u2717 Struggled</button>' +
      '</div>'
    :
      '<button class="bso-reveal-btn" onclick="infraReveal()">Reveal answer</button>'
    ) +
    '<div class="bso-nav">' +
      '<button onclick="infraNav(-1)" ' + (_infraIndex===0?'disabled':'') + '>\\u2190 Previous</button>' +
      '<button onclick="infraNav(1)" ' + (_infraIndex===qs.length-1?'disabled':'') + '>Next \\u2192</button>' +
    '</div>';
  var closeBtn = document.querySelector('#infraOverlay .bso-close');
  if (closeBtn) closeBtn.textContent = '\\u2715 Save & Exit';
}

function infraReveal() {
  _infraRevealed = true;
  infraRender();
}

function infraMark(val) {
  var qs = infraQuestions();
  var globalIdx = INFRA_QUESTIONS.indexOf(qs[_infraIndex]);
  var saved = JSON.parse(localStorage.getItem('gca_infra_progress') || '{}');
  saved[globalIdx] = val;
  localStorage.setItem('gca_infra_progress', JSON.stringify(saved));
  infraUpdateDashboardStats();
  var ql = qs.length;
  if (_infraIndex < ql - 1) { infraNav(1); } else { infraRender(); }
}

function infraNav(dir) {
  var qs = infraQuestions();
  _infraIndex = Math.max(0, Math.min(qs.length - 1, _infraIndex + dir));
  _infraRevealed = false;
  infraRender();
  document.getElementById('infraOverlay').scrollTop = 0;
}

function infraUpdateDashboardStats() {
  var saved = JSON.parse(localStorage.getItem('gca_infra_progress') || '{}');
  var attempted = Object.keys(saved).length;
  var got = Object.values(saved).filter(function(v){return v==='got';}).length;
  var pct = Math.round((attempted / INFRA_QUESTIONS.length) * 100);
  var aEl = document.getElementById('infraStatAttempted');
  var gEl = document.getElementById('infraStatGot');
  var bEl = document.getElementById('infraMiniBarFill');
  if (aEl) aEl.textContent = attempted + ' of ' + INFRA_QUESTIONS.length + ' attempted';
  if (gEl) gEl.textContent = got + ' \\u2713 confident';
  if (bEl) bEl.style.width = pct + '%';
}

'''

old7 = "// ── MICHAEL IN-MODULE CHAT PANEL"
assert html.count(old7) == 1
html = html.replace(old7, infra_js + "// ── MICHAEL IN-MODULE CHAT PANEL")
print("Change 7: Infrastructure JS functions inserted")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: Overlay HTML — insert before michaelPanel
# ─────────────────────────────────────────────────────────────────────────────
infra_overlay = '''
<!-- INFRASTRUCTURE QUESTION BANK OVERLAY -->
<div id="infraOverlay" style="display:none;flex-direction:column">
  <div class="bso-topbar">
    <span class="bso-counter" id="infraCounter">Question 1 of 50</span>
    <span class="bso-module" id="infraModule"></span>
    <div class="bso-progress"><div class="bso-progress-fill" id="infraProgressFill" style="width:0%"></div></div>
    <select class="bso-filter" id="infraModuleFilter" onchange="infraJumpToModule(this.value)">
      <option value="">All modules</option>
      <option value="Engineering Science &amp; Technology">Module 1 &mdash; Engineering Science &amp; Technology</option>
      <option value="Cost, Quantification &amp; Project Finance">Module 2 &mdash; Cost, Quantification &amp; Project Finance</option>
      <option value="Procurement, Contract &amp; Programme">Module 3 &mdash; Procurement, Contract &amp; Programme</option>
      <option value="Risk, Project Controls &amp; Stakeholder Management">Module 4 &mdash; Risk, Project Controls &amp; Stakeholder Management</option>
      <option value="Professional Practice &amp; Client Care">Module 5 &mdash; Professional Practice &amp; Client Care</option>
    </select>
    <button class="bso-close" onclick="closeInfraOverlay()">&#x2715;</button>
  </div>
  <div class="bso-body" id="infraBody"></div>
</div>

'''

old8 = '<div id="michaelPanel"'
assert html.count(old8) == 1
html = html.replace(old8, infra_overlay + '<div id="michaelPanel"')
print("Change 8: infraOverlay HTML inserted")

# ─────────────────────────────────────────────────────────────────────────────
# Write output
# ─────────────────────────────────────────────────────────────────────────────
with open('/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/index.html', 'w') as f:
    f.write(html)

print(f"\nAll 8 changes applied. File size: {len(html):,} chars")
