// netlify/functions/try-michael.js
// Michael Starter Session — public multi-stage practice journey.
// Stages: q1 | s1 | capture | resend | s2 | freetext
//
// Security model:
//   s2 and freetext require a valid session token issued at capture.
//   The one-free-text-question limit is enforced server-side on the session record.
//   resend is a separate rate-limited action keyed by session token;
//   it does not write a new lead record or trigger an admin notification.

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { EVIDENCE_INTEGRITY_CLAUSE, NO_SOURCE_GENERATION_RULE } = require('./utils/professional-standards');
const { extractPKREntry } = require('./utils/pkr-loader');

let _pkr01;
try { _pkr01 = extractPKREntry('PKR-01') || ''; }
catch (e) { console.error('[try-michael] PKR-01 load error:', e.message); _pkr01 = ''; }

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Question bank — 8 pathway groups x 3 starting-point codes = 24 pairs
//
// Pathways with dedicated question pairs (pathway-specific):
//   Building Surveying (bs), Quantity Surveying and Construction (qs),
//   Valuation (val), Project Management (pm), Commercial Real Estate (cre),
//   Planning and Development (plan), Residential (res)
//
// All other RICS pathways fall back to gen-{startCode}.
// The UI labels generic-mapped pathways as "representative professional scenario"
// so visitors are not misled about the level of tailoring.
// ---------------------------------------------------------------------------

const QUESTIONS = {
  'bs-so': {
    q1: 'During a site visit you notice staining around a window and cracking to the internal plaster. Your manager is unavailable. What would you record, what would you avoid assuming, and what would you do next?',
    q2: 'You have taken photographs and noted the staining and cracking clearly. The client asks whether it is "just cosmetic". What could you say now, what would you not claim, and what information would you seek before advising further?',
    context: 'Building surveying, early career. Themes: observation vs. diagnosis, evidence recording, knowing the limits of a site visit finding.'
  },
  'bs-br': {
    q1: 'You are preparing a schedule of condition for a commercial property before a lease is signed. During inspection you find evidence of active water ingress the client has not mentioned. How would you record this, raise it with the client, and decide whether the schedule can be completed as instructed?',
    q2: 'The client says the ingress has been there for years and asks you to leave it out of the schedule. How would you respond, and what are your professional obligations as the person preparing the document?',
    context: 'Building surveying, intermediate level. Themes: completeness of professional documents, client pressure, professional duty.'
  },
  'bs-apc': {
    q1: 'A client instructs you to advise on a planned roof replacement. You notice the existing finish appears to be asbestos-containing material. The client wants to proceed quickly. How would you manage your duty of care, your professional obligations, and the client\'s expectations?',
    q2: 'The client says the roof was surveyed five years ago and "signed off as fine". They want to rely on that report rather than commission new surveys. How would you advise them, and what would you document?',
    context: 'Building surveying APC level. Themes: duty of care, asbestos obligations, managing client expectations against professional responsibility.'
  },

  'qs-so': {
    q1: 'You are assisting on a live project and notice a subcontractor has started work in an area not covered by their current instruction. Your supervisor is in a meeting. What would you do, what would you record, and who would you involve?',
    q2: 'Your supervisor confirms the work was unauthorised. The subcontractor says they were told verbally by site management to proceed. How would you help document this, and what principle does it illustrate about contract management?',
    context: 'Quantity surveying, early career. Themes: unauthorised variations, verbal instructions, record-keeping on site.'
  },
  'qs-br': {
    q1: 'You are reviewing a subcontractor\'s interim payment application and find it includes items for work you are not satisfied has been completed to the required standard. How would you assess and respond to the application, and what records would you maintain?',
    q2: 'The subcontractor disputes your assessment and threatens to suspend work. How would you manage the situation while protecting the employer\'s position and keeping the project moving?',
    context: 'Quantity surveying, intermediate level. Themes: interim valuations, payment disputes, employer protection.'
  },
  'qs-apc': {
    q1: 'You are preparing a final account for a contract that overran its budget significantly. The client asks you to find reasons to reduce the contractor\'s entitlement. How do you balance your duty to the client with your professional obligation to act fairly?',
    q2: 'The contractor submits a substantial extension of time claim for delays they attribute to employer risk events. Some events are clearly employer risk; others are contested. How would you approach the assessment?',
    context: 'Quantity surveying APC level. Themes: professional independence, final accounts, extension of time assessment.'
  },

  'val-so': {
    q1: 'You are preparing your first residential valuation report. Your supervisor asks you to review a comparable sale that appears significantly above the other evidence you have gathered. What would you do before including or excluding it, and who would you involve?',
    q2: 'Your supervisor confirms the comparable was an atypical transaction. The client asks why their property is not being valued at the same level. How would you explain the approach taken without undermining confidence in the report?',
    context: 'Valuation, early career. Themes: comparable selection, atypical transactions, explaining professional judgement to clients.'
  },
  'val-br': {
    q1: 'You are undertaking a commercial valuation for secured lending. The property has a lease with a break clause in 18 months. The borrower says the tenant is very unlikely to exercise it. How do you approach the valuation, and what do you document?',
    q2: 'After completing the valuation, you are told the break option has been exercised. The lender asks whether this affects your opinion of value. How do you respond, and what are your obligations?',
    context: 'Valuation, intermediate level. Themes: break clauses, lending valuations, post-instruction developments.'
  },
  'val-apc': {
    q1: 'A client instructs you to value a mixed-use property where the residential upper floors are occupied under regulated tenancies. Comparable evidence is thin and the client has suggested a figure they expect. How do you manage the instruction, the evidence and your professional independence?',
    q2: 'The client is unhappy with your opinion and asks you to revise the figure upward. They hint they will not use you again if you do not. How do you respond, and what do you document?',
    context: 'Valuation APC level. Themes: regulated tenancies, professional independence under client pressure, Red Book obligations.'
  },

  'pm-so': {
    q1: 'You are supporting a project manager on site. A contractor\'s operative tells you directly they have a concern about a safety issue. Your line manager is not on site. What would you do, and what would you not do?',
    q2: 'Your line manager confirms the concern was valid. The contractor\'s supervisor had dismissed it. How would you help document this event, and what lesson does it carry for how risks should be escalated on a managed project?',
    context: 'Project management, early career. Themes: safety reporting, escalation, acting within your level of authority.'
  },
  'pm-br': {
    q1: 'You are managing the design programme for a complex project. One consultant has fallen significantly behind programme without warning you. The delay is now affecting other disciplines. How would you respond, and what should you have had in place to identify this sooner?',
    q2: 'The consultant says the brief changed significantly after appointment and they were waiting for formal instruction. How do you establish what was agreed, manage the immediate programme risk, and prevent this from recurring?',
    context: 'Project management, intermediate level. Themes: programme management, consultant coordination, brief management.'
  },
  'pm-apc': {
    q1: 'You are project manager for a retail fit-out. The client asks you to accelerate the programme to meet a trading deadline. To achieve this, some contractor submissions would need to bypass the normal review period. How do you advise the client, and how do you manage the risk?',
    q2: 'The client accepts the risk in writing but then raises concerns when a design issue emerges that might have been caught during a review. How do you handle this, and what does this demonstrate about the project manager\'s duty of care?',
    context: 'Project management APC level. Themes: programme acceleration, risk acceptance, duty of care documentation.'
  },

  'cre-so': {
    q1: 'You are supporting a rent review negotiation. Your supervisor asks you to research comparable lettings, but the available comparables have different lease structures to the subject property. What do you do with this information, and how do you present it?',
    q2: 'The landlord\'s solicitor provides comparables more favourable to their position. Your supervisor asks you to review them. How do you approach the analysis, and what do you say if you think they are not genuinely comparable?',
    context: 'Commercial real estate, early career. Themes: comparable analysis, lease structure adjustments, presenting conflicting evidence.'
  },
  'cre-br': {
    q1: 'You are advising a tenant on a lease renewal under the Landlord and Tenant Act 1954. The landlord has served a section 25 notice opposing renewal on grounds of redevelopment. What do you establish first, and how do you structure your initial advice to the tenant?',
    q2: 'Further investigation suggests the landlord\'s redevelopment plans are at an early stage and may not be viable within a reasonable timeframe. How does this change your advice, and what are the procedural risks if the tenant does not act promptly?',
    context: 'Commercial real estate, intermediate level. Themes: LTA 1954 procedure, ground (f) redevelopment, tenant procedural obligations.'
  },
  'cre-apc': {
    q1: 'A landlord client asks you to advise on the best strategy for a city-centre office building that is 40% vacant with leases expiring over the next two years. How would you structure your advice, and what market, financial and physical factors would you need to assess?',
    q2: 'One of the remaining tenants approaches you informally and says they would consider expanding if the terms were right. How do you manage this alongside your duty to the landlord, and what conflict considerations arise?',
    context: 'Commercial real estate APC level. Themes: asset strategy, lease re-gear, conflicts of interest.'
  },

  'plan-so': {
    q1: 'You are reviewing a planning application for a residential extension in a conservation area. You notice the design uses materials that may not be appropriate under the local authority\'s design guidance. Your line manager is not available. What would you record, what would you avoid concluding, and who would you involve?',
    q2: 'Your line manager confirms the materials are non-compliant with the design SPD. The applicant says a neighbouring extension was approved with similar materials five years ago. How would you respond to this point?',
    context: 'Planning, early career. Themes: design policy compliance, conservation area materials, consistency arguments.'
  },
  'plan-br': {
    q1: 'You are preparing a planning appraisal for a proposed housing development on greenbelt land. The client believes there is a strong case for very special circumstances. What is your obligation in terms of the advice you give, and how do you balance advocating for your client with your professional duty to give honest opinion?',
    q2: 'Your appraisal concludes a planning application would be unlikely to succeed on the current evidence. The client asks you to present the findings more positively in a report to their board. How do you respond?',
    context: 'Planning, intermediate level. Themes: greenbelt very special circumstances, honest professional advice, client vs. professional duty.'
  },
  'plan-apc': {
    q1: 'A developer asks you to advise on a site where they want to build 60 apartments. The site has a heritage asset immediately adjacent and may have ecological constraints. How do you structure the pre-application strategy, and what consultations would you recommend before submitting?',
    q2: 'Pre-application discussions reveal the local planning authority would support 40 units but not 60. The developer does not want to revise the scheme. How do you advise them, and what are your professional obligations if you disagree with their chosen approach?',
    context: 'Planning APC level. Themes: heritage impact, ecological constraints, pre-application strategy, professional independence.'
  },

  'res-so': {
    q1: 'You are conducting a viewing at a residential property on behalf of a buyer client. You notice signs of potential damp in a ground-floor corner but the seller has not disclosed it. What would you tell your client, what would you record, and how would you manage the relationship with the selling agent?',
    q2: 'The buyer asks you directly whether this means they should not buy the property. What can you say, what are the limits of your role at this stage, and what further step would you recommend?',
    context: 'Residential property, early career. Themes: disclosure obligations, limits of a viewing, buyer protection.'
  },
  'res-br': {
    q1: 'You are acting as agent for a landlord in a dispute with a residential tenant over the return of a deposit. The tenant claims the deductions are unfair. How do you advise the landlord, and what does the landlord need to demonstrate to retain any part of the deposit?',
    q2: 'You review the check-in report and find it was not properly prepared at the start of the tenancy. How does this affect the landlord\'s position, and what does it illustrate about the importance of documentation at the outset?',
    context: 'Residential property, intermediate level. Themes: deposit disputes, check-in reports, landlord obligations.'
  },
  'res-apc': {
    q1: 'A landlord asks your advice on a residential property where the tenant has been in arrears for three months. The landlord wants to regain possession as quickly as possible. How do you structure your advice, and what factors would affect the route available?',
    q2: 'The property is in an area where selective licensing applies and the landlord is not currently licensed. How does this affect the advice you give, and what are the consequences if the landlord proceeds without addressing this?',
    context: 'Residential APC level. Themes: possession procedures, selective licensing, advising on compliance risk.'
  },

  'gen-so': {
    q1: 'You are early in your career and have been asked to attend a client meeting alongside a senior colleague. During the meeting the client asks you a technical question directly that you are not confident about. What would you say, what would you avoid doing, and how would you follow up?',
    q2: 'After the meeting, your senior colleague asks what you would do differently next time to be better prepared. What would you say, and what does this experience illustrate about professional development at this stage?',
    context: 'General professional context, early career. Themes: knowing the limits of your knowledge, professional conduct in client settings, follow-through.'
  },
  'gen-br': {
    q1: 'You have been given sole responsibility for a piece of client advice for the first time. Partway through, you realise the original brief was not as clear as you assumed and your work so far may need to be revised. How would you handle this, and who would you involve?',
    q2: 'Your supervisor suggests leaving the original scope unchanged, as the client was partly responsible for the ambiguity. You are not comfortable with this. How do you raise the concern professionally?',
    context: 'General professional context, intermediate. Themes: scope management, escalation, professional disagreement with a senior colleague.'
  },
  'gen-apc': {
    q1: 'A client asks you to provide advice in an area where you have relevant knowledge but limited direct experience at the required level. You believe you can do the work well, but you are uncertain whether this falls within your competence. How do you assess this, and how do you proceed?',
    q2: 'You complete the work and the client is satisfied. Later, a colleague suggests you should have referred part of the instruction to a more experienced team member. How do you reflect on this?',
    context: 'General APC level. Themes: competence, referral obligations, honest self-assessment of professional limits.'
  }
};

// Exported so the frontend can label non-listed pathways as "representative scenario"
const SPECIFIC_PATHWAY_NAMES = [
  'Building Surveying',
  'Quantity Surveying and Construction',
  'Valuation',
  'Project Management',
  'Commercial Real Estate',
  'Planning and Development',
  'Residential'
];

const START_LABELS = {
  'starting-out': 'Starting out at work',
  'building-responsibility': 'Building responsibility',
  'preparing-apc': 'Preparing for APC',
  'company-team': 'Developing my team'
};

function pathwayToCode(pathway) {
  if (!pathway) return 'gen';
  const p = pathway.toLowerCase();
  if (p.includes('building surv')) return 'bs';
  if (p.includes('quantity') || p.includes('construction')) return 'qs';
  if (p.includes('valuation') || p.includes('property finance')) return 'val';
  if (p.includes('project management')) return 'pm';
  if (p.includes('commercial real') || p.includes('corporate real')) return 'cre';
  if (p.includes('planning')) return 'plan';
  if (p.includes('residential')) return 'res';
  return 'gen';
}

function startToCode(startingPoint) {
  if (startingPoint === 'starting-out') return 'so';
  if (startingPoint === 'building-responsibility') return 'br';
  if (startingPoint === 'preparing-apc') return 'apc';
  if (startingPoint === 'company-team') return 'br';
  return 'so';
}

// ---------------------------------------------------------------------------
// System prompts — all three AI stages use Haiku, plain prose, no markdown.
// Token budgets are set so the model can reach the word target with headroom.
// ---------------------------------------------------------------------------

// s1: 50-70 words, 180-token budget
function s1System(entry, startingPoint) {
  return `You are Michael, a professional development coach for Get Chartered AI.

A candidate is in their very first practice scenario. Context: ${entry.context}

Their starting point is: ${START_LABELS[startingPoint] || startingPoint}.

${_pkr01}

${EVIDENCE_INTEGRITY_CLAUSE}

${NO_SOURCE_GENERATION_RULE}

Give a 2-3 sentence first read that:
1. Names what the candidate has shown — even at a basic level, acknowledge what is there.
2. Identifies the single clearest gap in their response.
3. Names the one improvement that would most strengthen it.

Target length: 50-70 words. Be honest and direct, but not discouraging — this is early-stage practice.
Write in plain prose. No markdown. No bullet points. No headers.`;
}

// s2: 80-100 words, 220-token budget
function s2System(entry, startingPoint) {
  return `You are Michael, a professional development coach for Get Chartered AI.

A candidate has just completed a follow-up scenario in their starter session. This is their second practice question. Context: ${entry.context}

Starting point: ${START_LABELS[startingPoint] || startingPoint}.

${_pkr01}

${EVIDENCE_INTEGRITY_CLAUSE}

${NO_SOURCE_GENERATION_RULE}

Give a 3-4 sentence response that:
1. Names what is stronger in their answer compared to a Level 1 response.
2. Explains what a Level 2 or 3 response would add or do differently.
3. Gives one concrete, actionable piece of advice for their next practice attempt.

Target length: 80-100 words. Write in plain prose. No markdown. No bullet points. No headers.`;
}

// freetext: 100-130 words, 280-token budget
function freetextSystem(entry, startingPoint) {
  return `You are Michael, a professional development coach for Get Chartered AI.

A candidate is in a starter practice session. Context: ${entry.context}. Starting point: ${START_LABELS[startingPoint] || startingPoint}.

${_pkr01}

${EVIDENCE_INTEGRITY_CLAUSE}

${NO_SOURCE_GENERATION_RULE}

Answer the candidate's question honestly and helpfully.

If the question cannot be usefully addressed here (personal legal advice, specific regulatory rulings, personal circumstances outside professional practice), explain that clearly and briefly, and suggest what type of resource or person would help instead.

Target length: 100-130 words. Write in plain prose. No markdown. No bullet points. No headers.`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function respond(statusCode, data) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

function sanitize(str, maxLen) {
  return (str || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLen).trim();
}

async function rateLimit(store, key, limit, windowMs) {
  try {
    const raw = await store.get(key);
    const rl = raw ? JSON.parse(raw) : { count: 0, windowStart: Date.now() };
    if (Date.now() - rl.windowStart > windowMs) { rl.count = 0; rl.windowStart = Date.now(); }
    if (rl.count >= limit) return false;
    rl.count++;
    await store.set(key, JSON.stringify(rl));
    return true;
  } catch (e) {
    console.error('[try-michael] rate-limit error:', e.message);
    return true; // fail-open — a Blobs outage should not block visitors
  }
}

async function callAI(apiKey, system, userMsg, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'AI service error');
  return data.content[0].text;
}

async function sendConfirmationEmail(resendKey, { name, email, pathway, startingPoint, assessmentDate, sessionToken }) {
  const firstName = name.split(' ')[0];
  const startLabel = START_LABELS[startingPoint] || startingPoint;
  const dateRow = assessmentDate ? `<br>Assessment: <strong>${assessmentDate}</strong>` : '';
  const dateTxt  = assessmentDate ? `\nAssessment: ${assessmentDate}` : '';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Get Chartered AI <info@getcharteredai.com>',
      to: [email],
      subject: 'Your Michael starter session — continue your practice',
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
        <div style="background:#0D0F1C;border-radius:12px 12px 0 0;padding:28px;text-align:center">
          <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0 0 6px;letter-spacing:.12em;text-transform:uppercase">Michael Starter Session</p>
          <h1 style="color:#fff;font-size:20px;margin:0;font-family:Georgia,serif">Get Chartered <span style="color:#2563EB">AI</span></h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="font-size:18px;color:#0f172a;margin-bottom:12px">Hi ${firstName},</h2>
          <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:16px">Your starter session is saved. Here is what you told us:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#334155;line-height:1.9">
            Starting point: <strong>${startLabel}</strong><br>
            Pathway or area: <strong>${pathway}</strong>${dateRow}
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:20px">Your next practice question is waiting on the site.</p>
          <a href="https://getcharteredai.com/#try-michael-sec?resume=${encodeURIComponent(sessionToken)}" style="display:block;background:#2563EB;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;text-align:center;margin-bottom:20px">Continue your practice &#x2192;</a>
          <p style="font-size:13px;color:#64748b;line-height:1.7">This is a private practice environment. It supports learning and reflection — it does not replace your manager, counsellor or supervisor.</p>
          <p style="font-size:13px;color:#334155;line-height:1.6;margin-top:20px">Best,<br>Angela<br><span style="color:#64748b">Get Chartered AI</span></p>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px">Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a></p>
        </div>
      </div>`,
      text: `Hi ${firstName},\n\nYour starter session is saved.\n\nStarting point: ${startLabel}\nPathway or area: ${pathway}${dateTxt}\n\nContinue your practice: https://getcharteredai.com/#try-michael-sec?resume=${encodeURIComponent(sessionToken)}\n\nThis is private practice — it supports reflection but does not replace your manager, counsellor or supervisor.\n\nBest,\nAngela\nGet Chartered AI\ninfo@getcharteredai.com`
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

async function sendAdminNotification(resendKey, { name, email, pathway, startingPoint, assessmentDate, consentMarketing, companyReferral }) {
  const startLabel = START_LABELS[startingPoint] || startingPoint;
  const dateRow = assessmentDate ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b">Assessment</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${assessmentDate}</td></tr>` : '';
  const companyRow = companyReferral ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b">Context</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#2563EB">Company / team</td></tr>` : '';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Get Chartered AI <info@getcharteredai.com>',
      to: ['info@getcharteredai.com'],
      subject: `Michael starter — ${name} · ${pathway} · ${startLabel}${companyReferral ? ' [company]' : ''}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
        <h2 style="color:#0f172a;margin-bottom:16px">New Michael Starter Session</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:140px">Name</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a">${name}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Email</td><td style="padding:6px 0;font-size:13px;color:#0f172a"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Pathway</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${pathway}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Starting point</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${startLabel}</td></tr>
          ${dateRow}
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Marketing consent</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${consentMarketing ? 'Yes' : 'No'}</td></tr>
          ${companyRow}
        </table>
      </div>`,
      text: `New Michael starter session\n\nName: ${name}\nEmail: ${email}\nPathway: ${pathway}\nStarting point: ${startLabel}${assessmentDate ? '\nAssessment: ' + assessmentDate : ''}\nMarketing consent: ${consentMarketing ? 'Yes' : 'No'}${companyReferral ? '\nContext: Company / team' : ''}`
    })
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return respond(400, { error: 'Invalid request' }); }

  const { stage } = body;
  if (!stage) return respond(400, { error: 'Stage required' });

  const rawIp = (
    event.headers['x-forwarded-for'] ||
    event.headers['x-nf-client-connection-ip'] ||
    ''
  ).split(',')[0].trim() || 'unknown';

  const store = getStore({
    name: 'try-michael',
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // -------------------------------------------------------------------------
  // q1 — return first question for given startingPoint + pathway
  //      No session required; called before the user has entered any details.
  // -------------------------------------------------------------------------
  if (stage === 'q1') {
    const startingPoint = sanitize(body.startingPoint, 40);
    const pathway       = sanitize(body.pathway, 80);
    if (!startingPoint) return respond(400, { error: 'Starting point required' });

    const allowed = await rateLimit(store, `rl-q1:${rawIp}`, 20, 60 * 60 * 1000);
    if (!allowed) return respond(429, { error: 'Too many requests — please try again in an hour.' });

    const pCode = pathwayToCode(pathway);
    const sCode = startToCode(startingPoint);
    const qKey  = `${pCode}-${sCode}`;
    const entry = QUESTIONS[qKey] || QUESTIONS[`gen-${sCode}`] || QUESTIONS['gen-so'];

    return respond(200, { question: entry.q1, qKey });
  }

  // -------------------------------------------------------------------------
  // s1 — first Michael read on Q1 answer (Haiku, 50-70 words)
  //      No session required; feedback is given before capture.
  // -------------------------------------------------------------------------
  if (stage === 's1') {
    const qKey         = sanitize(body.qKey, 20);
    const answer       = sanitize(body.answer, 1000);
    const startingPoint = sanitize(body.startingPoint, 40);

    if (!answer || answer.length < 10) return respond(400, { error: 'Answer too short' });
    if (!apiKey) return respond(500, { error: 'AI service not configured' });

    const allowed = await rateLimit(store, `rl-s1:${rawIp}`, 10, 60 * 60 * 1000);
    if (!allowed) return respond(429, { error: 'Too many requests — please try again in an hour.' });

    const entry  = QUESTIONS[qKey] || QUESTIONS['gen-so'];
    const userMsg = `Question: "${entry.q1}"\n\nCandidate's answer:\n${answer}`;

    try {
      const reply = await callAI(apiKey, s1System(entry, startingPoint), userMsg, 180);
      return respond(200, { reply });
    } catch (e) {
      console.error('[try-michael] s1 error:', e.message);
      return respond(500, { error: 'Something went wrong. Please try again.' });
    }
  }

  // -------------------------------------------------------------------------
  // capture — save lead + session, send emails, return session token + Q2
  //           Issues the session token that gates s2 and freetext.
  // -------------------------------------------------------------------------
  if (stage === 'capture') {
    const name           = sanitize(body.name, 80);
    const email          = sanitize(body.email, 120).toLowerCase();
    const pathway        = sanitize(body.pathway, 80);
    const startingPoint  = sanitize(body.startingPoint, 40);
    const qKey           = sanitize(body.qKey, 20);
    const assessmentDate = sanitize(body.assessmentDate, 60);
    const consentMarketing = body.consentMarketing === true;
    const companyReferral  = body.companyReferral === true;

    if (!name)                              return respond(400, { error: 'Name required' });
    if (!email || !email.includes('@'))     return respond(400, { error: 'Valid email required' });
    if (!pathway)                           return respond(400, { error: 'Pathway or role required' });
    if (!startingPoint)                     return respond(400, { error: 'Starting point required' });

    const ipAllowed = await rateLimit(store, `rl-cap:${rawIp}`, 5, 60 * 60 * 1000);
    if (!ipAllowed) return respond(429, { error: 'Too many requests — please try again in an hour.' });

    const pCode       = pathwayToCode(pathway);
    const sCode       = startToCode(startingPoint);
    const resolvedKey = QUESTIONS[qKey] ? qKey : `${pCode}-${sCode}`;
    const entry       = QUESTIONS[resolvedKey] || QUESTIONS['gen-so'];

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now          = Date.now();
    const consentTs    = now;

    // Session record (gates s2 + freetext)
    try {
      await store.set(`session:${sessionToken}`, JSON.stringify({
        email, name, pathway, startingPoint, companyReferral,
        q2Key: resolvedKey, assessmentDate, consentMarketing,
        consentTs, freetextUsed: false,
        ts: now, expiresAt: now + SESSION_TTL_MS
      }));
    } catch (e) {
      console.error('[try-michael] session write error:', e.message);
      return respond(503, { error: 'Could not create session. Please try again.' });
    }

    // Lead record (non-fatal if it fails — session is already written)
    try {
      await store.set(`lead:${email}`, JSON.stringify({
        name, email, pathway, startingPoint, companyReferral,
        assessmentDate, consentMarketing, consentTs,
        sessionToken, ts: now
      }));
    } catch (e) {
      console.error('[try-michael] lead write error:', e.message);
    }

    // Confirmation email to candidate
    let emailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        await sendConfirmationEmail(process.env.RESEND_API_KEY, {
          name, email, pathway, startingPoint, assessmentDate, sessionToken
        });
        emailSent = true;
      } catch (e) {
        console.error('[try-michael] confirmation email error:', e.message);
      }
      // Admin notification — non-fatal
      try {
        await sendAdminNotification(process.env.RESEND_API_KEY, {
          name, email, pathway, startingPoint, assessmentDate, consentMarketing, companyReferral
        });
      } catch (e) {
        console.error('[try-michael] admin email error:', e.message);
      }
    }

    console.log(`[try-michael] capture: ${email} | ${pathway} | ${startingPoint} | emailSent=${emailSent}`);
    return respond(200, {
      success: true, emailSent, email,
      sessionToken,
      q2: entry.q2, q2Key: resolvedKey,
      companyReferral
    });
  }

  // -------------------------------------------------------------------------
  // resend — re-send confirmation email only
  //          Rate-limited by session token (not IP), 3/hr.
  //          Does NOT write a new lead or trigger an admin notification.
  // -------------------------------------------------------------------------
  if (stage === 'resend') {
    const sessionToken = sanitize(body.sessionToken, 80);
    if (!sessionToken) return respond(400, { error: 'Session token required' });

    const tokenAllowed = await rateLimit(store, `rl-resend:${sessionToken}`, 3, 60 * 60 * 1000);
    if (!tokenAllowed) return respond(429, { error: 'Too many resend attempts — please wait a moment.' });

    let session;
    try {
      const raw = await store.get(`session:${sessionToken}`);
      if (!raw) return respond(404, { error: 'Session not found. Please complete the form again.' });
      session = JSON.parse(raw);
    } catch (e) {
      console.error('[try-michael] resend session read error:', e.message);
      return respond(503, { error: 'Could not retrieve session. Please try again.' });
    }

    if (Date.now() > session.expiresAt) {
      return respond(410, { error: 'Session has expired. Please start a new practice session.' });
    }

    if (!process.env.RESEND_API_KEY) {
      return respond(200, { success: false, emailSent: false, reason: 'Email service unavailable' });
    }

    try {
      await sendConfirmationEmail(process.env.RESEND_API_KEY, {
        name: session.name, email: session.email,
        pathway: session.pathway, startingPoint: session.startingPoint,
        assessmentDate: session.assessmentDate,
        sessionToken
      });
      return respond(200, { success: true, emailSent: true });
    } catch (e) {
      console.error('[try-michael] resend email error:', e.message);
      return respond(200, { success: false, emailSent: false });
    }
  }

  // -------------------------------------------------------------------------
  // s2 — Michael feedback on Q2 answer (Haiku, 80-100 words)
  //      Requires a valid, unexpired session token.
  // -------------------------------------------------------------------------
  if (stage === 's2') {
    const sessionToken = sanitize(body.sessionToken, 80);
    const answer       = sanitize(body.answer, 1000);

    if (!sessionToken) return respond(401, { error: 'Session required. Please complete the form to continue.' });
    if (!answer || answer.length < 10) return respond(400, { error: 'Answer too short' });
    if (!apiKey) return respond(500, { error: 'AI service not configured' });

    let session;
    try {
      const raw = await store.get(`session:${sessionToken}`);
      if (!raw) return respond(401, { error: 'Session not found. Please complete the form to continue.' });
      session = JSON.parse(raw);
    } catch (e) {
      console.error('[try-michael] s2 session read error:', e.message);
      return respond(503, { error: 'Could not verify session. Please try again.' });
    }

    if (Date.now() > session.expiresAt) {
      return respond(410, { error: 'Your session has expired. Please start a new practice session.' });
    }

    const allowed = await rateLimit(store, `rl-s2:${rawIp}`, 10, 60 * 60 * 1000);
    if (!allowed) return respond(429, { error: 'Too many requests — please try again in an hour.' });

    const entry  = QUESTIONS[session.q2Key] || QUESTIONS['gen-so'];
    const userMsg = `Follow-up question: "${entry.q2}"\n\nCandidate's answer:\n${answer}`;

    try {
      const reply = await callAI(apiKey, s2System(entry, session.startingPoint), userMsg, 220);
      return respond(200, { reply });
    } catch (e) {
      console.error('[try-michael] s2 error:', e.message);
      return respond(500, { error: 'Something went wrong. Please try again.' });
    }
  }

  // -------------------------------------------------------------------------
  // freetext — one free-text question per session (Haiku, 100-130 words)
  //            Requires valid session; limit enforced server-side before AI call.
  //            freetextUsed is set before the AI call; reverted on AI failure.
  // -------------------------------------------------------------------------
  if (stage === 'freetext') {
    const sessionToken = sanitize(body.sessionToken, 80);
    const question     = sanitize(body.question, 600);

    if (!sessionToken) return respond(401, { error: 'Session required. Please complete the form to continue.' });
    if (!question || question.length < 5) return respond(400, { error: 'Question too short' });
    if (!apiKey) return respond(500, { error: 'AI service not configured' });

    let session;
    try {
      const raw = await store.get(`session:${sessionToken}`);
      if (!raw) return respond(401, { error: 'Session not found. Please complete the form to continue.' });
      session = JSON.parse(raw);
    } catch (e) {
      console.error('[try-michael] freetext session read error:', e.message);
      return respond(503, { error: 'Could not verify session. Please try again.' });
    }

    if (Date.now() > session.expiresAt) {
      return respond(410, { error: 'Your session has expired. Please start a new practice session.' });
    }

    if (session.freetextUsed) {
      return respond(429, { error: 'You have already used your free-text question for this session.' });
    }

    const allowed = await rateLimit(store, `rl-ft:${rawIp}`, 5, 60 * 60 * 1000);
    if (!allowed) return respond(429, { error: 'Too many requests — please try again in an hour.' });

    // Mark used before the AI call so a network-retry cannot bypass the per-session limit
    try {
      await store.set(`session:${sessionToken}`, JSON.stringify({ ...session, freetextUsed: true }));
    } catch (e) {
      console.error('[try-michael] freetext session update error:', e.message);
      // Proceed — IP rate limit still applies
    }

    const entry   = QUESTIONS[session.q2Key] || QUESTIONS['gen-so'];
    const userMsg = `Candidate's question:\n${question}`;

    try {
      const reply = await callAI(apiKey, freetextSystem(entry, session.startingPoint), userMsg, 280);
      return respond(200, { reply, companyReferral: session.companyReferral, startingPoint: session.startingPoint });
    } catch (e) {
      console.error('[try-michael] freetext AI error:', e.message);
      // Revert freetextUsed so the candidate can try again
      try {
        await store.set(`session:${sessionToken}`, JSON.stringify({ ...session, freetextUsed: false }));
      } catch (_) { /* ignore revert failure */ }
      return respond(500, { error: 'Something went wrong. Please try again.' });
    }
  }

  // -------------------------------------------------------------------------
  // resume — validate token + expiry; return only what the frontend needs
  //          to restore the session at panel 4 (Q2).
  //          Read-only: does not modify the session record.
  //          Rate-limited by IP (fail-open).
  // -------------------------------------------------------------------------
  if (stage === 'resume') {
    const sessionToken = sanitize(body.sessionToken, 80);
    if (!sessionToken) return respond(400, { error: 'Session token required' });

    const allowed = await rateLimit(store, `rl-resume:${rawIp}`, 20, 60 * 60 * 1000);
    if (!allowed) return respond(429, { error: 'Too many requests — please try again in an hour.' });

    let session;
    try {
      const raw = await store.get(`session:${sessionToken}`);
      if (!raw) return respond(404, { error: 'The link may be invalid or expired. Please start a new practice session.' });
      session = JSON.parse(raw);
    } catch (e) {
      console.error('[try-michael] resume session read error:', e.message);
      return respond(503, { error: 'Could not retrieve session. Please try again.' });
    }

    if (Date.now() > session.expiresAt) {
      return respond(410, { error: 'Your practice session has expired — sessions last 24 hours. Please start a new one.' });
    }

    const entry = QUESTIONS[session.q2Key] || QUESTIONS['gen-so'];

    return respond(200, {
      q2: entry.q2,
      q2Key: session.q2Key,
      pathway: session.pathway,
      startingPoint: session.startingPoint,
      companyReferral: session.companyReferral,
      freetextUsed: session.freetextUsed
    });
  }

  return respond(400, { error: 'Invalid stage' });
};
