// netlify/functions/utils/alan-products.js
// Single maintained source of truth for all products and resources Alan may surface.
// _pricing fields are stored for data integrity only — excluded from model context
// and not rendered in Phase 1 recommendation cards.
// All facts traced to docs/ask-alan-proposal-v2.md Section 22.

const PRODUCTS = [
  {
    id: 'programme',
    canonicalName: 'APC Full 12 Module Programme',
    aliases: ['Full Programme — Annual Access', 'Structured Monthly'],
    url: '/programme',
    _pricing: { annual: '£497 one-off / 18 months access', monthly: '£49/month / up to 12 months' },
    audience: 'APC candidates at any stage of their preparation journey — whether they are just starting out or partway through',
    stage: 'Full preparation — any stage',
    purpose: 'Structured preparation across all 11 mandatory RICS competencies, from wherever the candidate is now through to assessment day. Monthly subscribers unlock one module per month; annual subscribers get immediate access to all 12 from day one.',
    keyFeatures: [
      '12 modules: introduction, 10 competency modules, testing and mock interview',
      'Michael — AI Tutor available throughout',
      '5,000+ practice questions and answers',
      '60-minute AI-scored mock interview (all 22 RICS pathways)',
      'Monthly access: one module per month, paced to training timeline',
      'Annual access: all 12 modules from day one'
    ],
    accessPeriod: 'Annual: 18 months | Monthly: up to 12 months',
    pathwayCoverage: 'Mock interview covers all 22 RICS pathways',
    restrictions: [],
    ctaLabel: 'View the 12-Module Programme',
    isLive: true,
    isDirectPurchase: true
  },
  {
    id: 'sprint',
    canonicalName: 'APC Final Sprint',
    aliases: [],
    url: '/sprint',
    _pricing: { oneOff: '£297 / 70 days access' },
    audience: 'APC candidates who have submitted their APC and are in final preparation',
    stage: 'Final preparation — post-submission',
    purpose: 'Pathway-specific revision, practice questions and mock interview confidence for candidates in the final stage before assessment.',
    keyFeatures: [
      'Six focused stages — Module 1, pathway question bank, Module 12',
      '50 pathway-specific assessor-led questions (16 active pathways)',
      '60-minute AI-scored mock interview (all 22 RICS pathways)',
      'Michael — AI Tutor available throughout',
      '11 mandatory competency revision sheets',
      'Sprint fee credited against the full programme if upgrading later'
    ],
    accessPeriod: '70 days from purchase',
    pathwayCoverage: 'Question bank: 16 active pathways. Mock interview: all 22 RICS pathways',
    notYetLivePathways: [
      'Arts and Antiques',
      'Environmental Surveying',
      'Geomatics',
      'Mineral and Waste Management',
      'Research',
      'Valuation of Business and Intangible Assets'
    ],
    doesNotInclude: 'Modules 2–11 (full structured teaching content across all competencies)',
    restrictions: [],
    ctaLabel: 'Explore the APC Final Sprint',
    isLive: true,
    isDirectPurchase: true
  },
  {
    id: 'referred',
    canonicalName: 'Referred Candidate Support',
    aliases: ['Referred Candidate Recovery Programme', 'APC Confidence Reset', 'APC Referred — Confidence Reset'],
    url: '/referred-programme',
    _pricing: { oneOff: '£397 / 90 days access' },
    audience: 'APC candidates who have received a referral result and are preparing to resit',
    stage: 'Post-referral recovery',
    purpose: 'A structured nine-module programme that starts from the referral letter and builds towards resit readiness, with Michael in Assessor Mode throughout.',
    keyFeatures: [
      '9 modules (CR01–CR09, with pathway-specific module at CR07)',
      'Michael in Assessor Mode throughout',
      'Starts from the referral letter — addresses what went wrong',
      'Case study review add-on available separately',
      'Sprint fee credited if held previously'
    ],
    accessPeriod: '90 days from purchase',
    pathwayCoverage: null,
    restrictions: ['Intended for candidates who have already received an APC referral result'],
    ctaLabel: 'Explore Referred Candidate Support',
    isLive: true,
    isDirectPurchase: true
  },
  {
    id: 'year-one',
    canonicalName: 'APC Apprenticeship Mid-Programme Professional Readiness Review',
    aliases: ['Mid-Programme Review', 'Apprenticeship Mid-Programme Professional Readiness Review'],
    url: '/year-two-review',
    _pricing: { oneOff: '£127' },
    audience: 'APC apprentices at the mid-point of their programme; candidates who want a structured self-assessment of where they stand',
    stage: 'Mid-programme check-in',
    purpose: 'A structured professional readiness diagnostic across five key areas, delivering a personalised Michael report that identifies gaps to focus remaining programme time on.',
    keyFeatures: [
      '30 diagnostic questions across 5 structured areas',
      'Personalised professional readiness report from Michael',
      'Identifies priority areas for remaining programme time'
    ],
    accessPeriod: 'Up to 3 diagnostic attempts',
    pathwayCoverage: null,
    restrictions: ['Diagnostic self-assessment only — not an EPA or formal assessment; not a substitute for any part of the apprenticeship standard'],
    ctaLabel: 'Explore the Mid-Programme Review',
    isLive: true,
    isDirectPurchase: true
  },
  {
    id: 'apprentice',
    canonicalName: 'Advanced Technical Pathway Benchmark',
    aliases: ['Apprenticeship Readiness Review', 'Apprentice Professional Readiness Review'],
    url: '/apprentice-review',
    _pricing: { oneOff: '£165' },
    audience: 'APC apprentices approaching end-point assessment; candidates wanting a technical readiness benchmark before assessment day',
    stage: 'Late-programme / pre-assessment readiness',
    purpose: 'A structured technical readiness benchmark across seven areas, delivering a personalised Michael report that identifies gaps against APC assessment expectations.',
    keyFeatures: [
      '36 diagnostic questions across 7 structured areas',
      'Personalised professional readiness report from Michael',
      'Up to 3 diagnostic attempts'
    ],
    accessPeriod: 'Up to 3 diagnostic attempts',
    pathwayCoverage: null,
    restrictions: ['Diagnostic only — not an EPA or formal apprenticeship assessment; cannot be substituted for the apprenticeship end-point assessment'],
    ctaLabel: 'Explore the Advanced Technical Pathway Benchmark',
    isLive: true,
    isDirectPurchase: true
  },
  {
    id: 'employer',
    canonicalName: 'Employer and Team Support',
    aliases: [],
    url: '/employer',
    _pricing: { note: 'Individual programmes at standard prices. Professional Readiness for teams: priced on enquiry.' },
    audience: 'Employers and managers seeking structured APC support for their team',
    stage: 'Any',
    purpose: 'Access to the full GCAi programme suite for employer-sponsored candidates. Team arrangements are handled through the employer page — not a direct purchase.',
    keyFeatures: [
      'Individual programmes available for employer-sponsored candidates',
      'Team support arrangements handled through enquiry'
    ],
    accessPeriod: null,
    pathwayCoverage: null,
    restrictions: ['Team arrangements are not directly purchasable — handled through the employer page'],
    ctaLabel: 'Explore Employer Support',
    isLive: true,
    isDirectPurchase: false
  }
];

const RESOURCES = [
  { id: 'resource-hot-topics', title: 'APC Industry Briefing', url: '/hot-topics', audience: 'Any APC candidate wanting current market and regulatory context', description: 'Regularly updated briefing on topics likely to arise at assessment', isLive: true },
  { id: 'resource-why-referred', title: 'Why Candidates Are Referred', url: '/why-candidates-are-referred', audience: 'Any APC candidate — particularly those concerned about referral risk', description: 'Analysis of the most common reasons candidates are referred at APC assessment', isLive: true },
  { id: 'resource-competency-checker', title: 'APC Competency Choice Checker', url: '/competency-checker', audience: 'Early-stage APC candidates unsure which optional competencies to select', description: 'Interactive tool to help candidates identify suitable competency choices', isLive: true },
  { id: 'resource-apc-guide', title: 'APC Guide', url: '/apc-guide', audience: 'Candidates at any stage wanting a structured overview of the APC process', description: 'Free guide to the APC — process, structure, what assessors are looking for', isLive: true },
  { id: 'resource-case-study-checklist', title: '10 Checks: APC Case Study', url: '/case-study-checklist', audience: 'Candidates preparing their case study submission', description: '10-point checklist for case study quality before submission', isLive: true },
  { id: 'resource-confidence-checklist', title: 'Confidence Checklist', url: '/confidence-checklist', audience: 'Candidates approaching assessment wanting a self-assessment tool', description: 'Self-assessment checklist for APC readiness', isLive: true },
  { id: 'resource-assocrics-guide', title: 'AssocRICS Guide', url: '/assocrics-guide', audience: 'Candidates considering or pursuing the AssocRICS route', description: 'Free guide to the AssocRICS pathway', isLive: true },
  { id: 'resource-guides-hub', title: 'All Guides', url: '/guides', audience: 'Any visitor', description: 'Hub page for all free GCAi guides and resources', isLive: true }
];

const VALID_IDS = new Set([
  ...PRODUCTS.map(p => p.id),
  ...RESOURCES.map(r => r.id)
]);

const VALID_TAGS = new Set([
  'SUBMITTED_IMMINENT', 'SUBMITTED_DISTANT', 'PRE_SUBMISSION_EARLY', 'PRE_SUBMISSION_MID',
  'REFERRED', 'EARLY_CAREER', 'EMPLOYER', 'FREE_FIRST', 'TECHNICAL_QUESTION',
  'UNCLEAR', 'NOT_YET_LIVE_PATHWAY', 'PRICE_QUERY'
]);

const NOT_YET_LIVE_PATHWAYS = new Set([
  'Arts and Antiques', 'Environmental Surveying', 'Geomatics',
  'Mineral and Waste Management', 'Research', 'Valuation of Business and Intangible Assets'
]);

// Returns product context snapshot for the model — _pricing fields excluded
function getModelContext() {
  const products = PRODUCTS.map(({ _pricing, keyFeatures, restrictions, ctaLabel, accessPeriod, doesNotInclude, ...rest }) => rest);
  const resources = RESOURCES.map(({ isLive, ...rest }) => rest);
  return JSON.stringify({ products, resources });
}

// Returns full record by ID (for server-side card assembly)
function getRecord(id) {
  return PRODUCTS.find(p => p.id === id) || RESOURCES.find(r => r.id === id) || null;
}

// Builds a safe card object for the client — no _pricing, no internal fields
function buildCard(record) {
  if (!record || !record.isLive) return null;
  if (record.title) {
    // Resource record
    return { id: record.id, title: record.title, url: record.url, description: record.description, isResource: true };
  }
  return {
    id: record.id,
    canonicalName: record.canonicalName,
    url: record.url,
    purpose: record.purpose,
    ctaLabel: record.ctaLabel,
    isDirectPurchase: record.isDirectPurchase,
    isResource: false
  };
}

module.exports = { PRODUCTS, RESOURCES, VALID_IDS, VALID_TAGS, NOT_YET_LIVE_PATHWAYS, getModelContext, getRecord, buildCard };
