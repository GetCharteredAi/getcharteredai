// netlify/functions/try-michael.js
// Public "Try Michael" demo — two-stage AI interaction, no JWT required.
// Stage 1 (free, ungated): brief level read via Haiku.
// Stage 2 (email-gated): full assessor breakdown via Sonnet.
// Fixed question and both system prompts are hardcoded server-side.
// Visitor answer goes into the user message slot only — never into a system prompt.

const { getStore } = require('@netlify/blobs');

const FIXED_QUESTION = 'Tell me about a time you identified a conflict of interest during your work. What did you do?';

const STAGE_1_SYSTEM = `You are Michael, an AI coach for Get Chartered AI, giving a brief initial reaction for a public demo.

A prospective candidate has answered a single RICS APC-style ethics question. Give a short, genuine first read.

State plainly which level their answer currently reflects — Level 1 (awareness), Level 2 (application), or Level 3 (reasoned advice) — and the single most important reason why, specifically tied to what they wrote.

Keep this to 40-60 words. Do not soften it, do not explain this is a demo, do not mention pricing.`;

const STAGE_2_SYSTEM = `You are Michael, an AI coach for Get Chartered AI, operating in Assessor Mode for a public product demonstration.

A prospective candidate has already seen a brief initial level assessment of their answer to an ethics question, and has now given their email specifically to see your full breakdown. This is their only interaction with you.

Structure your response in exactly three parts:
1. Show them, grounded specifically in what they wrote (not a generic example), what a stronger answer at the next level up would actually look like.
2. If their answer is Level 1, also briefly show what Level 3 would look like, so they see the full range.
3. One sharp, genuine follow-up question — the kind a real assessor would ask next, testing whether they can go deeper.

Keep the entire response to 150-200 words. This response IS the product demonstration — sharp and specific, not generic encouragement.

End with exactly one unchanged line: "This is Assessor Mode — every module, every competency, works this way."

Do not mention pricing or ask them to sign up — that's handled separately after your response.`;

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

  // Accept only these three fields — everything else ignored
  const { stage, answer, email } = body;

  if (stage !== 1 && stage !== 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid stage' }) };
  }

  if (!answer || typeof answer !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Answer required' }) };
  }
  // Sanitize: strip control characters, cap at 800 chars
  const sanitizedAnswer = answer.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, 800);
  if (sanitizedAnswer.trim().length < 10) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Answer too short' }) };
  }

  if (stage === 2 && (!email || typeof email !== 'string' || !email.includes('@'))) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required for full breakdown' }) };
  }

  // IP extraction — x-forwarded-for is set by Netlify CDN
  const rawIp = (event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || '').split(',')[0].trim();
  const ip = rawIp || 'unknown';
  const isUnknown = ip === 'unknown';

  // Rate limiting — object-form Blobs, matching get-cpd.js/save-cpd.js pattern
  const store = getStore({
    name: 'try-michael',
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
  });

  const rlKey = `rl-s${stage}:${ip}`;
  const limit = stage === 1 ? (isUnknown ? 3 : 15) : (isUnknown ? 2 : 5);
  const windowMs = 60 * 60 * 1000;

  try {
    const rlRaw = await store.get(rlKey);
    const rl = rlRaw ? JSON.parse(rlRaw) : { count: 0, windowStart: Date.now() };
    if (Date.now() - rl.windowStart > windowMs) {
      rl.count = 0;
      rl.windowStart = Date.now();
    }
    if (rl.count >= limit) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests — please try again in an hour.' }) };
    }
    rl.count++;
    await store.set(rlKey, JSON.stringify(rl));
  } catch (e) {
    console.error('Rate limit check failed:', e.message);
    // Allow through — don't gate visitors on Blobs infrastructure failures
  }

  // Per-email usage gate — Stage 2 only, fail-closed.
  // Rate limiting fails open (availability over enforcement); this check fails closed
  // (a Blobs outage returns 503 rather than silently permitting the call).
  if (stage === 2) {
    const cleanEmail = email.toLowerCase().trim();
    let emailRecord;
    try {
      emailRecord = await store.get(`em:${cleanEmail}`);
    } catch (e) {
      console.error('Email usage check failed:', e.message);
      return { statusCode: 503, headers, body: JSON.stringify({ error: 'Please try again shortly.' }) };
    }
    if (emailRecord) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'This email has already received a full breakdown. Try a different email address.' }) };
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI service not configured' }) };
  }

  // Message construction — fixed question + candidate answer in user message only.
  // System prompts are pure constants; no visitor data touches either system prompt.
  const userMsg = `Question: "${FIXED_QUESTION}"\n\nCandidate's answer:\n${sanitizedAnswer}`;

  const model = stage === 1 ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
  const maxTokens = stage === 1 ? 120 : 400;
  const system = stage === 1 ? STAGE_1_SYSTEM : STAGE_2_SYSTEM;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
    }

    const reply = data.content[0].text;

    // Stage 2 only: write email to Blobs AFTER successful AI call
    if (stage === 2) {
      try {
        const cleanEmail = email.toLowerCase().trim();
        await store.set(`em:${cleanEmail}`, JSON.stringify({ ts: Date.now() }));
      } catch (e) {
        console.error('Email write failed:', e.message);
        // Don't fail — visitor still gets their response
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (e) {
    console.error('try-michael error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};
