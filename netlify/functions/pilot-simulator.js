// netlify/functions/pilot-simulator.js
// Restricted wrapper around the established APC simulator AI calls for pilot candidates.
// Two permitted actions only:
//   generate — produce questions for a simulator section and persist them against this invitation
//   score    — score a candidate answer, reading the question from the saved attempt (not from the browser)
// All prompts are server-constructed using the same text as the established simulator in index.html.
// No user-supplied system prompt is accepted. Questions are never returned before they are saved.

const crypto  = require('crypto');
const { getStore } = require('@netlify/blobs');

const PILOT_EXPIRES_AT = new Date('2026-11-14T23:59:59Z').getTime();

// Sections that require AI generation (section 1 uses the pre-written QS pool instead)
const AI_SECTIONS = new Set([0, 2, 3, 4]);

// Section names matching SIM_SECTIONS in index.html — used in scoring prompt
const SECTION_NAMES = { 0: 'Case Study', 1: 'QS Technical', 2: 'Mandatory Competencies', 3: 'Ethics Scenarios', 4: 'Final Questions' };

// Pre-written QS technical questions — exact pool from PATHWAY_QUESTIONS['Quantity Surveying and Construction'] in index.html
const QS_TECHNICAL_POOL = ["Describe the cost planning process from inception to tender stage. What are the key deliverables at each RIBA stage?", "A client's project is over budget at Stage 3. What options do you present and how do you advise on value engineering without compromising quality?", "Walk us through the procurement route selection process. When would you recommend a JCT Design & Build contract versus a traditional contract?", "How do you manage a contractor's interim application for payment? What does the process involve and what are the key contract obligations?", "Describe how you handle a contractor's loss and expense claim. What information do you request and how do you assess it?", "A project is running behind programme. How does delay affect your cost advice and what contractual mechanisms are available to the employer?", "The Building Safety Levy applies from 1 October 2026 to new residential development in England with more than 10 units, and to purpose-built student accommodation with 30 or more bedspaces (affordable housing is exempt). How do you factor this into a pre-contract cost plan, and how does the affordable-housing exemption affect mixed-tenure scheme apportionment?", "Second staircases are mandatory in England for new residential buildings over 18 metres where building notices, initial notices or full-plans applications are submitted from 30 September 2026. Where a qualifying notice was submitted before that date, the original Approved Document B rules continue to apply provided construction starts and reaches the defined progress condition (foundations poured or permanent piling commenced) within 18 months of 30 September 2026. What are the cost and programme implications and how would you advise a developer client at feasibility stage?", "Describe the formal communication process under a JCT contract. What are the requirements for valid written notices, CVIs and delay notices and why does getting this right matter to the project QS?", "What measurement standard is used when preparing bills of quantities for a commercial building and how does this relate to IPMS and the RICS Code of Measuring Practice?", "A client instructs you verbally to add scope to an ongoing contract. What is the correct procedure under JCT and what risk does the contractor face if you do not follow it?", "Explain the JCT payment notice regime. What are the strict timescales for interim certificates and pay-less notices and what happens if a deadline is missed?", "Convert 1,000 square metres of floor area to square feet. Why is this conversion relevant to QS practice, particularly on international projects?", "You are preparing your APC case study and wish to use a project involving a client's confidential information. What consent is required, from whom, and what must you do if that consent is not available?", "Are you aware of any RICS professional standards relating to bribery and money laundering? Provide an overview of the key requirements.", "What are the five Red Flag Indicator categories under the RICS professional standard on countering bribery and corruption? Give an example from the built environment for each.", "What is a facilitation payment and how should you deal with one if asked to make it?", "What is tipping off and why is it a criminal offence?", "What is the Failure to Prevent Fraud offence under the Economic Crime and Corporate Transparency Act 2023 and when did it come into force?", "Describe a scenario in the built environment where a quantity surveyor might be exposed to bribery risk and explain how you would respond.", "What are the mandatory anti-money laundering obligations for RICS regulated firms and how do these affect your day-to-day client onboarding?", "What enhanced due diligence is required when a client proposes to use cryptocurrency in a property transaction?", "You are managing a commercial property for a landlord client when the tenant approaches you directly asking you to also represent them in lease renewal negotiations. Walk me through your thinking and what you would do.", "Two teams in your firm are acting for both buyer and seller in the same transaction. How should this conflict of interest be managed, and what would need to be in place before either team proceeds?", "You discover mid-project that your firm previously acted for the contractor you are now administering the contract against. You were not aware of this when you took the instruction. What do you do?", "Explain the four offences under the Bribery Act 2010 and the six prevention principles a firm must demonstrate are in place.", "You are working on a large infrastructure tender. The winning contractor's representative calls to congratulate you on a successful project and mentions they are sending a case of wine to your office as a thank you. How do you respond and why?", "Your client asks you to make a small payment to a local official to accelerate a planning approval in an overseas jurisdiction where such payments are customary. What is your position and why?", "The Economic Crime and Corporate Transparency Act 2023 introduced a Failure to Prevent Fraud offence, which came into force on 1 September 2025. It applies to large organisations meeting at least two of: 250 or more employees, £36 million or more turnover, £18 million or more total assets. Explain its scope, what it means for a firm in scope, and what the six prevention principles require.", "A colleague asks you to sign off a valuation figure you believe has been inflated to satisfy a lender's requirements. Walk me through how you would handle this situation.", "A close friend who is setting up a small development asks you informally over dinner for your professional opinion on a planning matter. You are not formally appointed. What issues does this raise and how do you manage them?", "What is professional indemnity insurance, why does RICS require it and what are the consequences for a firm that allows its PII to lapse?", "You become aware that a senior colleague in your firm is consistently over-valuing properties for a specific lender client. You have raised it informally and nothing has changed. What do you do next?", "What whistleblowing protections exist for employees who report concerns about their firm's professional conduct, and what is your firm's obligation to have in place?", "A mortgage broker offers to refer residential clients to your firm in return for a percentage of your fee. Explain how you would respond and what the RICS position is on referral arrangements.", "Your firm receives a referral from a contractor who expects preferential treatment on future tenders as a result. How do you identify and manage this conflict?", "You pass your APC and a friend who is renovating their home asks you to provide a structural survey informally as a favour. You are newly chartered. What issues does this raise and how do you respond?", "During a competitive tender process a client contacts you to advise that your fee proposal is close but that a small reduction would secure the appointment. What concerns does this raise and how do you handle it?", "You are on a tender shortlist and at a networking event another bidder attempts to discuss fee levels with you. What is the issue and what do you do?", "The RICS Rules of Conduct were updated in 2022. What are the five rules and give a practical example of how Rule 3 — integrity — applies to your day-to-day work?", "A client instructs you to omit a significant defect from a survey report because they are concerned it will affect the sale price. How do you respond and what are your professional obligations?", "Your firm is considering marketing itself as a RICS regulated firm in an overseas jurisdiction where it has no qualified RICS members. What are the ethical issues and how should the firm proceed?", "Explain the difference between NRM1, NRM2 and NRM3 — what does each cover and at what RIBA stage is each most relevant?", "A client asks you to prepare an Order of Cost Estimate at RIBA Stage 1. What methodology do you use and what level of contingency would you include and why?", "What are the main differences between a JCT 2024 Design and Build contract and a JCT 2024 Standard Building Contract? When would you recommend each to a client? Note that the JCT 2016 suite was formally withdrawn in March 2026.", "Walk me through the process of preparing and agreeing a final account under a JCT Standard Building Contract. What disputes commonly arise and how are they resolved?", "A contractor submits an interim valuation that you believe is significantly overstated. Walk me through how you assess and respond to it.", "Explain extension of time under JCT 2024 contracts — what are the Relevant Events and how does the process work? What is the difference between an EOT and a loss and expense claim?", "A variation order is disputed by the contractor who claims it is outside the scope of the contract. How do you assess this and what is your advice to the client?", "What is the Construction Act and how does it affect payment provisions in construction contracts? What is the consequence of failing to issue a pay less notice in time?", "A contractor goes into administration mid-project. What are your immediate obligations as contract administrator and what options does the client have?", "How do you approach cost planning for a net zero carbon new build, with reference to the UK Net Zero Carbon Buildings Standard V1 (published March 2026) and the RICS Whole Life Carbon Assessment Professional Standard 2nd edition (September 2023)? What additional costs should the client anticipate compared to a conventional building?"];

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ── Token helpers (copied verbatim from pilot-speak.js) ───────────────────────

function verifyPilotToken(token, jwtSecret) {
  if (!token) throw new Error('missing');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('malformed');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  if (payload.purpose !== 'mock-pilot') throw new Error('wrong-purpose');
  if (payload.exp && Date.now() > payload.exp) throw new Error('expired');
  if (Date.now() > PILOT_EXPIRES_AT) throw new Error('expired');
  const expected = crypto.createHmac('sha256', jwtSecret).update(parts[0]).digest('base64url');
  if (parts[1] !== expected) throw new Error('invalid');
  return payload;
}

function tokenKey(token) {
  const sig = token.split('.')[1] || token;
  return crypto.createHash('sha256').update(sig).digest('hex');
}

// ── Attempt blob helpers ──────────────────────────────────────────────────────

function attemptStore() {
  return getStore({
    name: 'pilot-credits',
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN,
  });
}

async function loadAttempt(token, attemptNum) {
  try {
    const key = `attempt${attemptNum}-${tokenKey(token)}`;
    return await attemptStore().get(key, { type: 'json' }) || null;
  } catch {
    return null;
  }
}

// Merges patch into the existing attempt blob.
// Deep-merges only the questions map; all other fields (answers, sectionStartedAt,
// currentSection, currentQuestion, etc.) are preserved from the existing record
// and only overwritten if explicitly present in the patch.
async function saveAttemptPatch(token, attemptNum, patch) {
  const key = `attempt${attemptNum}-${tokenKey(token)}`;
  const store = attemptStore();
  let existing = {};
  try { existing = await store.get(key, { type: 'json' }) || {}; } catch { /* ok — treat as empty */ }
  const merged = { ...existing, ...patch };
  if (patch.questions && existing.questions) merged.questions = { ...existing.questions, ...patch.questions };
  await store.set(key, JSON.stringify(merged));
}

// ── Anthropic helper ──────────────────────────────────────────────────────────
// model is passed explicitly: Haiku for generation, Sonnet for scoring —
// matching ai-tutor.js (scoring=false → Haiku, scoring=true → claude-sonnet-4-5).

async function callClaude(system, messages, maxTokens, model) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI service not configured' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { mode, token: pilotToken, attemptNum = 1 } = body;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };

  let payload;
  try { payload = verifyPilotToken(pilotToken, jwtSecret); }
  catch (err) {
    const isExpired = err.message === 'expired';
    return { statusCode: isExpired ? 410 : 401, headers, body: JSON.stringify({ error: isExpired ? 'expired' : 'Invalid access link' }) };
  }

  const pathway = payload.pathway || 'Quantity Surveying and Construction';
  const safeAttemptNum = attemptNum === 2 ? 2 : 1;

  // ── generate ───────────────────────────────────────────────────────────────
  // Accepts sectionIdx ∈ {0,1,2,3,4}. Returns cached questions if already saved
  // for this invitation's attempt. Persists newly generated/selected questions
  // before returning — questions are never returned unless storage succeeds.
  if (mode === 'generate') {
    const sectionIdx = Number(body.sectionIdx);
    if (![0, 1, 2, 3, 4].includes(sectionIdx)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Section not permitted' }) };
    }

    // Return cached questions if already generated for this attempt
    const existing = await loadAttempt(pilotToken, safeAttemptNum);
    if (existing?.questions?.[sectionIdx]) {
      return { statusCode: 200, headers, body: JSON.stringify({ questions: existing.questions[sectionIdx] }) };
    }

    let questions;

    if (sectionIdx === 1) {
      // Section 1 uses the pre-written QS pool — same as PATHWAY_QUESTIONS['Quantity Surveying and Construction'] in index.html
      questions = [...QS_TECHNICAL_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
    } else {
      // Sections 0,2,3,4 — AI generation using exact prompts from generateQuestions() in index.html
      const legislation2026 = `2026 legislation context: BSR fully independent (27 Jan 2026), Building Safety Levy on new residential 10+ units England from 1 Oct 2026 (affordable housing and <10-unit schemes exempt), Two Staircase Rule 18m+ England from 30 Sep 2026 (18-month transition for pre-30-Sep notices), RICS AI Standard mandatory (9 Mar 2026, applies where AI has material impact on service delivery), Renters' Rights Act abolishes s21 (1 May 2026), EPCs retain 10-year validity (5-year reduction rejected — new 4-metric system no earlier than H2 2027), BNG 10% mandatory for NSIPs from 2 Nov 2026 (not May 2026), Capital Allowances 40% FYA on plant from 1 Jan 2026 + WDA 14% from 1 Apr 2026 (plant/M&E only; 50% FYA + 12% WDA planned Jan 2027), Leasehold Reform Act 2024 partially in force (RTM and 2-year rule removed 2025; marriage value abolition uncommenced), RICS Service Charges in Commercial Property 2nd edition mandatory from 31 Dec 2025. Incorporate where pathway-relevant.`;

      const prompts = {
        0: `Generate 4 APC assessor panel questions about a case study for a ${pathway} candidate. Questions should probe: decision making, risk, costs/value, technical standards, commercial judgement, ethics. Where relevant reference 2026 legislation. ${legislation2026} Return as JSON array of strings only. No preamble.`,
        2: `Generate 8 APC mandatory competency questions covering ethics, client care, communication, H&S, accounting, data management, sustainability, conflict avoidance and teamworking. Mix Level 1, 2 and 3 questions. Include questions on 2026 updates: RICS AI Standard, CPD Framework, Building Safety Levy, EPC methodology change, Capital Allowances. Return as JSON array of strings only.`,
        3: `Generate 4 realistic APC ethics scenario dilemmas including: conflict of interest, gifts/bribery, use of AI tools in professional advice without disclosure (RICS AI Standard 2026), unsafe instruction from client, duty to public interest. Frame as "You are in the following situation..." Return as JSON array of strings only.`,
        4: `Generate 3 APC final wrap-up questions including: "Is there anything you'd like to add?", "What would you do differently in your case study?", "Why should we award you chartered status today?". Return as JSON array of strings only.`
      };

      // Fallbacks copied from generateQuestions() in index.html
      const fallbacks = {
        0: ["Tell us about your case study and the key challenge you faced.", "What were the main risks and how did you manage them?", "How did you apply RICS standards in this project?", "What would you do differently?"],
        2: ["What are the five Ethical Standards?", "Describe a time you managed a difficult client.", "How did you apply H&S on a recent site visit?", "What is BATNA?", "Explain the difference between cash and profit.", "What GDPR principle is most relevant to your work?", "What does MEES stand for?", "Describe a conflict you helped prevent."],
        3: ["A client offers you tickets worth £500 to a sporting event. What do you do?", "You discover a colleague has shared confidential client information. How do you respond?", "A client asks you to overlook a health and safety issue to avoid delaying the project. What do you do?", "You realise you made a significant error in a report already sent to the client. What are your next steps?"],
        4: ["Is there anything you would like to add or clarify from today's interview?", "What would you do differently in your case study if you could start again?", "Why should we award you chartered status today?"]
      };

      try {
        const text = await callClaude(
          'You are an RICS APC assessor. Return only valid JSON arrays of question strings. No markdown, no explanation.',
          [{ role: 'user', content: prompts[sectionIdx] }],
          1000,
          'claude-haiku-4-5-20251001'
        );
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('invalid response');
        questions = parsed;
      } catch {
        questions = fallbacks[sectionIdx] || ['Tell us more about your experience.'];
      }
    }

    // Persist before returning — questions must be saved to allow score validation
    try {
      await saveAttemptPatch(pilotToken, safeAttemptNum, { questions: { [sectionIdx]: questions } });
    } catch (err) {
      console.error('[pilot-simulator] question persist failed:', err.message);
      return { statusCode: 503, headers, body: JSON.stringify({ error: 'Could not save questions. Please retry.' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ questions }) };
  }

  // ── score ──────────────────────────────────────────────────────────────────
  // Reads the question from the saved attempt using sectionIdx + qIdx.
  // Never trusts browser-submitted question text.
  if (mode === 'score') {
    const { sectionIdx, qIdx, answer } = body;
    if (typeof answer !== 'string' || !answer.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing answer' }) };
    }
    if (answer.length > 10000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Answer too long' }) };
    }

    const attempt = await loadAttempt(pilotToken, safeAttemptNum);
    const question = attempt?.questions?.[sectionIdx]?.[qIdx];
    if (!question) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Question not found in saved attempt' }) };
    }

    const sectionName = SECTION_NAMES[sectionIdx] || 'Interview';

    // Exact scoring system prompt from submitAnswer() in index.html
    const system = `You are a strict but fair RICS APC assessor. Score this APC interview answer and provide coaching.
Current QS standards (2026): JCT 2024 suite (JCT 2016 withdrawn 31 March 2026); NEC4 (current suite — no NEC5 published); NRM1 3rd ed./NRM2 2nd ed./NRM3 2nd ed. with updated logic tables (January 2026); RICS WLCA Professional Standard 2nd edition (September 2023, mandatory July 2024); UK Net Zero Carbon Buildings Standard V1 (10 March 2026); HGCRA 1996 as amended by LDEDCA 2009 (in force 1 October 2011); ECCTA 2023 Failure to Prevent Fraud in force 1 September 2025 (large organisations meeting size threshold only); Building Safety Levy from 1 October 2026 (10+ unit residential or 30+ bedspaces PBSA, England, affordable housing exempt); second staircase rule from 30 September 2026 (18m+, England); PPN 026 on social value (published August 2026): replaces PPN 002 for procurements commenced from 1 January 2027; PPN 002 remains applicable to procurements commenced before that date — do not score down a PPN 002 reference in a 2026 procurement context. Score down where a candidate references withdrawn or superseded contract editions.
Return ONLY valid JSON in this exact format:
{
  "structure": 75,
  "relevance": 80,
  "depth": 65,
  "confidence": 70,
  "judgement": 72,
  "concerns": ["concern 1","concern 2"],
  "strengths": ["strength 1","strength 2"],
  "improvement": "One specific sentence on how to improve this answer",
  "verdict": "Brief 2-sentence assessor verdict"
}
Scores are 0-100. Be honest and specific.`;

    const userMsg = `Section: ${sectionName}\nQuestion: ${question}\nCandidate answer: ${answer.slice(0, 5000)}`;

    const fallbackScore = { structure:65, relevance:70, depth:60, confidence:68, judgement:62, concerns:['Consider referencing specific RICS standards','Add more personal examples'], strengths:['Relevant answer','Good structure'], improvement:'Reference specific legislation or RICS guidance to strengthen your answer.', verdict:'Answer shows understanding but could be strengthened with specific examples and RICS references.' };

    try {
      const text = await callClaude(system, [{ role: 'user', content: userMsg }], 800, 'claude-sonnet-4-5');
      const score = JSON.parse(text.replace(/```json|```/g, '').trim());
      return { statusCode: 200, headers, body: JSON.stringify({ score }) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ score: fallbackScore }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown mode' }) };
};
