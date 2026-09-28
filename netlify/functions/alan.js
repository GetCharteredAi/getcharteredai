// netlify/functions/alan.js
// Ask Alan — public programme guide for GCAi.
// Model interprets visitor intent and returns a structured response (ID + tag).
// All product facts and visible recommendation text are assembled server-side
// from approved records and templates. The model never generates product names,
// prices, URLs, access periods or feature claims that reach the visitor.
// Design: docs/ask-alan-proposal-v2.md

const { getStore } = require('@netlify/blobs');
const {
  VALID_IDS, VALID_TAGS, NOT_YET_LIVE_PATHWAYS,
  getModelContext, getRecord, buildCard
} = require('./utils/alan-products');

// Situation-tag template strings — from approved proposal Section 23.
// These are the only text Alan's visitors see. Model output never enters here directly.
const TEMPLATES = {
  SUBMITTED_IMMINENT: (primaryId) =>
    "If you've submitted and your assessment is approaching, the APC Final Sprint is likely to be the most useful place to start. It's built for exactly this stage — pathway-specific practice, revision materials, and a 60-minute mock interview.",

  SUBMITTED_DISTANT: () =>
    "You've already submitted, so Sprint is the programme to look at for final-stage preparation. Because your assessment is still some way off, you can explore what it includes now and decide when the timing feels right.",

  PRE_SUBMISSION_EARLY: () =>
    "If you're earlier in your APC journey, the 12-module programme is likely to be the most useful place to start. It covers all 11 mandatory RICS competencies in a structured way, with Michael — the AI tutor — available throughout, and a mock interview built in at module 12.",

  PRE_SUBMISSION_MID: () =>
    "You're in a solid preparation window. The 12-module programme is likely to be the most useful option — it gives you structured coverage of all 11 competencies, with time to work through it at pace before submission.",

  REFERRED: () =>
    "The Referred Candidate Support programme is built specifically for this situation — it starts from the referral letter and works through a structured nine-module approach to get you ready to resit. It's designed to address what went wrong, not just review everything from scratch.",

  EARLY_CAREER: (primaryId) => {
    if (primaryId === 'year-one') {
      return "If you're an apprentice at the mid-point of your programme, the Mid-Programme Professional Readiness Review is designed specifically for that stage — a structured diagnostic across five key areas with a personalised Michael report.";
    }
    if (primaryId === 'apprentice') {
      return "If you're an apprentice approaching your assessment, the Advanced Technical Pathway Benchmark is designed for this stage — it benchmarks your technical readiness across seven areas and delivers a personalised report from Michael.";
    }
    return "If you're at an early stage in your APC journey, the 12-module programme gives you the most complete foundation — covering all 11 mandatory competencies from the beginning, paced to your training timeline.";
  },

  EMPLOYER: () =>
    "The employer page is the best place to see what support is available — it covers the different ways GCAi can work with employer-sponsored candidates and their teams.",

  FREE_FIRST: () =>
    "There are a few free resources that might be a useful starting point. The APC Industry Briefing covers what's likely to come up at assessment; the Competency Checker helps with competency selection; and the APC Guide gives a good overview of the whole process.",

  NOT_YET_LIVE_PATHWAY: (primaryId, detectedPathway) => {
    const safePathway = NOT_YET_LIVE_PATHWAYS.has(detectedPathway) ? detectedPathway : null;
    const pathwayClause = safePathway
      ? `for ${safePathway}`
      : 'for your pathway';
    return `The pathway-specific question bank isn't yet available ${pathwayClause}, but the mock interview simulator covers all 22 RICS pathways — including yours. If you're in final preparation, Sprint still includes the mock interview, competency revision sheets and Michael throughout.`;
  }
};

// Hard-routed tag responses — model output overridden entirely
const HARD_ROUTES = {
  TECHNICAL_QUESTION: {
    text: "That sounds like a technical APC question — Michael is built to help with those. You can try him on the homepage. Once you've got a sense of where you are, I can help you find the right programme.",
    cards: [],
    clarifyQuestion: null
  },
  PRICE_QUERY: null, // built dynamically with primaryId
  UNCLEAR: {
    text: null,
    cards: [],
    clarifyQuestion: "To point you in the right direction, it helps to know a bit more about where you are. Have you submitted your APC yet, or are you still working through it?"
  }
};

// Bridge text validation — strips model-generated connector if it contains
// any product claim that should only come from approved records
function validateBridgeText(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim().slice(0, 120);
  if (t.length < 3) return null;
  if (/£\d+/.test(t)) return null;           // price pattern £\d+
  if (/\/[a-z]/.test(t)) return null;             // URL pattern /word
  if (/\d+\s*(days|months|questions|modules|attempts)/i.test(t)) return null; // quantity claims
  const BLOCKED = [
    'apc final sprint', 'apc full 12', 'referred candidate support',
    'mid-programme professional readiness', 'advanced technical pathway',
    'employer and team support', 'sprint programme', 'full programme',
    'recovery programme', 'confidence reset'
  ];
  const lower = t.toLowerCase();
  for (const blocked of BLOCKED) {
    if (lower.includes(blocked)) return null;
  }
  return t;
}

// Assembles the final visitor-facing response from approved templates + records
function assembleResponse(parsed) {
  const { primaryId, secondaryId, situationTag, bridgeText: rawBridgeText, clarifyQuestion, detectedPathway } = parsed;

  // Hard routes — override everything
  if (situationTag === 'TECHNICAL_QUESTION') return HARD_ROUTES.TECHNICAL_QUESTION;

  if (situationTag === 'UNCLEAR' || (!primaryId && !clarifyQuestion)) {
    return HARD_ROUTES.UNCLEAR;
  }

  if (situationTag === 'PRICE_QUERY') {
    const record = primaryId ? getRecord(primaryId) : null;
    const namePart = record ? record.canonicalName : 'the programme';
    return {
      text: `You can see the current price alongside everything that's included in ${namePart} on the programme page — it's the clearest place to see what you get and what it costs.`,
      cards: record ? [buildCard(record)].filter(Boolean) : [],
      clarifyQuestion: null
    };
  }

  if (clarifyQuestion) {
    return { text: null, cards: [], clarifyQuestion };
  }

  // Validate bridge text
  const bridgeText = validateBridgeText(rawBridgeText);

  // Get template text
  const templateFn = TEMPLATES[situationTag];
  const templateText = templateFn ? templateFn(primaryId, detectedPathway) : null;

  if (!templateText) {
    return HARD_ROUTES.UNCLEAR;
  }

  const text = bridgeText ? `${bridgeText} ${templateText}` : templateText;

  // Build cards from approved records only
  const cards = [];
  if (primaryId) {
    const rec = getRecord(primaryId);
    const card = rec && rec.isLive ? buildCard(rec) : null;
    if (card) cards.push(card);
  }
  if (secondaryId && secondaryId !== primaryId) {
    const rec = getRecord(secondaryId);
    const card = rec && rec.isLive ? buildCard(rec) : null;
    if (card) cards.push(card);
  }

  return { text, cards, clarifyQuestion: null };
}

const SYSTEM_PROMPT = `You are Alan, a programme guide for Get Chartered AI — an APC preparation platform for RICS candidates.

Your role is to understand where a visitor is in their APC journey and return a structured JSON object identifying the most appropriate programme or resource. You guide — you do not assess, qualify, or determine eligibility.

## Available products and resources

${getModelContext()}

## Response format

Return ONLY a valid JSON object in this exact format — no prose, no explanation, no markdown:

{
  "primaryId": "<id from the list above, or null>",
  "secondaryId": "<id or null>",
  "situationTag": "<one tag from the list below>",
  "bridgeText": "<max 120-char connector describing the visitor's situation, or null — must not contain product names, prices, URLs, numbers or access periods>",
  "clarifyQuestion": "<one follow-up question if insufficient context, or null>",
  "detectedPathway": "<RICS pathway name if visitor mentions one, or null>"
}

## Valid situation tags

SUBMITTED_IMMINENT — submitted APC, assessment within ~8 weeks
SUBMITTED_DISTANT — submitted APC, assessment still some time away
PRE_SUBMISSION_EARLY — not yet submitted, more than ~12 months out
PRE_SUBMISSION_MID — not yet submitted, ~6–12 months out
REFERRED — explicitly states they received a referral result
EARLY_CAREER — graduate, Year 1–2, or apprentice, early in journey
EMPLOYER — employer or manager seeking team support
FREE_FIRST — wants to explore before purchasing
TECHNICAL_QUESTION — asks a substantive APC technical or competency question
UNCLEAR — insufficient context to recommend
NOT_YET_LIVE_PATHWAY — on one of the 6 pathways with no Sprint question bank
PRICE_QUERY — asks about price, cost or affordability

## Rules

- primaryId must be a valid id from the product/resource list, or null
- secondaryId must be a valid id different from primaryId, or null
- If TECHNICAL_QUESTION or PRICE_QUERY: set primaryId to null unless the visitor clearly names a product (PRICE_QUERY may have a primaryId)
- If REFERRED: only use primaryId "referred" when visitor explicitly states they have been referred
- If UNCLEAR: set primaryId to null and set clarifyQuestion
- bridgeText must not contain product names, prices, URLs, numbers or access periods
- Return ONLY the JSON object`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { message } = body;

  if (!message || typeof message !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };
  }

  // Sanitize input
  const sanitized = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, 600).trim();
  if (sanitized.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message too short' }) };
  }

  // IP extraction — same pattern as try-michael.js
  const rawIp = (event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || '').split(',')[0].trim();
  const ip = rawIp || 'unknown';
  const isUnknown = ip === 'unknown';

  // Rate limiting — Blobs-based, fail-open
  const store = getStore({
    name: 'alan-rl',
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
  });

  const rlKey = `rl-alan:${ip}`;
  const limit = isUnknown ? 5 : 15;
  const windowMs = 60 * 60 * 1000;
  try {
    const rlRaw = await store.get(rlKey);
    const rl = rlRaw ? JSON.parse(rlRaw) : { count: 0, windowStart: Date.now() };
    if (Date.now() - rl.windowStart > windowMs) {
      rl.count = 0;
      rl.windowStart = Date.now();
    }
    if (rl.count >= limit) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          rateLimited: true,
          text: "You've asked Alan a lot of questions — that's fine, but we've reached today's limit. If you'd like to talk to a person, email us at info@getcharteredai.com.",
          cards: [],
          clarifyQuestion: null
        })
      };
    }
    rl.count++;
    await store.set(rlKey, JSON.stringify(rl));
  } catch (e) {
    console.error('[alan] Rate limit check failed (fail-open):', e.message);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service not available' }) };
  }

  // Call Claude Haiku — model returns structured JSON only
  let modelRaw;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: sanitized }]
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[alan] Anthropic error:', JSON.stringify(data));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
    }

    modelRaw = data.content[0].text;
    console.log('[alan] model token usage:', JSON.stringify(data.usage));
  } catch (e) {
    console.error('[alan] fetch error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }

  // Parse and validate model response
  let parsed;
  try {
    const jsonMatch = modelRaw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : modelRaw);
  } catch (e) {
    console.error('[alan] JSON parse failed:', modelRaw);
    parsed = { primaryId: null, secondaryId: null, situationTag: 'UNCLEAR', bridgeText: null, clarifyQuestion: null, detectedPathway: null };
  }

  // Validate IDs and tag — reject anything not in approved sets
  if (parsed.primaryId && !VALID_IDS.has(parsed.primaryId)) {
    console.warn('[alan] invalid primaryId rejected:', parsed.primaryId);
    parsed.primaryId = null;
  }
  if (parsed.secondaryId && !VALID_IDS.has(parsed.secondaryId)) {
    parsed.secondaryId = null;
  }
  if (!VALID_TAGS.has(parsed.situationTag)) {
    console.warn('[alan] invalid tag rejected:', parsed.situationTag);
    parsed.situationTag = 'UNCLEAR';
    parsed.primaryId = null;
  }

  // Validate detectedPathway — only allow known strings
  if (parsed.detectedPathway && typeof parsed.detectedPathway !== 'string') {
    parsed.detectedPathway = null;
  }
  if (parsed.detectedPathway) {
    parsed.detectedPathway = parsed.detectedPathway.slice(0, 80).replace(/[\x00-\x1F]/g, '');
  }

  // Assemble final response from templates + records
  const response = assembleResponse(parsed);

  // Write analytics — structured fields only, no free text, no IP
  const analyticsStore = getStore({
    name: 'alan-analytics',
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
  });
  try {
    const analyticsKey = `ev:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    await analyticsStore.set(analyticsKey, JSON.stringify({
      ts: Date.now(),
      situationTag: parsed.situationTag,
      primaryRecommendation: parsed.primaryId || null,
      secondaryRecommendation: parsed.secondaryId || null,
      clarifyQuestion: !!response.clarifyQuestion,
      detectedPathway: parsed.detectedPathway || null,
      outcome: response.clarifyQuestion ? 'clarify_asked' : (response.cards.length > 0 ? 'recommendation' : 'template_only')
    }));
  } catch (e) {
    console.error('[alan] analytics write failed (non-critical):', e.message);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ...response, rateLimited: false })
  };
};
