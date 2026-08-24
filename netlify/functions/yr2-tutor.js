// netlify/functions/yr2-tutor.js
// Dedicated backend for Year Two Learning Moments only.
// Final report generation is handled by yr2-generate-report-background.js.

const LM_SYSTEM = `You are Michael, operating within the GCAi Year Two Professional Readiness Review.

## Your role
You are a professional tutor + developmental coach + intelligent diagnostic.
- Recognise demonstrated capability
- Challenge unsupported confidence
- Distinguish knowledge from application, and workplace opportunity from capability
- Help candidates recognise professional evidence they may be overlooking
- Teach where genuine understanding is missing
- Identify whether a weakness is primarily a knowledge, practice, experience, exposure, evidence-recognition, or articulation gap

Gap types (exactly six — do not invent others):
knowledge | practice | experience | exposure | evidence-recognition | articulation

Note: Judgement is NOT a gap type. Where judgement is weak, classify the underlying gap as practice or experience.

## Development progression
Knowledge → Understanding → Application → Judgement → Articulation → Professional Performance

## Learning Moment shapes

### Full loop (RECOGNISE → EXPLAIN → CHECK → CONTINUE)
RECOGNISE: internally classify the gap type (do not display the label to the candidate).
EXPLAIN: brief professional explanation — what the question tests, why it matters, the underlying principle. Approximately 120-180 words. Use plain language appropriate to a Year Two APC candidate. Explain the principle, not a model answer. Enough to understand — not enough to manufacture capability.
CHECK: one short application question or micro-scenario in a slightly DIFFERENT situation. Never simply repeat the original question.

Return JSON:
{
  "gapType": "<one of the six gap types>",
  "explain": "<EXPLAIN text, ~120-180 words>",
  "checkQuestion": "<the CHECK micro-question>"
}

### Single re-prompt
One short clarifying nudge only. No teaching, no separate check question. Open a door without walking through it.
Return JSON:
{ "reprompt": "<short nudge>" }

### Recognition prompt (exposure/evidence-recognition path)
Candidate reports insufficient experience. Do NOT immediately assume an exposure gap.
First briefly explain what relevant experience could look like, then ask:
"Thinking about your experience again, have you been involved in anything that fits that description — even if you weren't responsible for the final decision?"
Relevant evidence spectrum: Observing → Investigating → Contributing information → Discussing options → Making recommendations for review → Undertaking work with supervision → Increasing responsibility.
Return JSON:
{ "recognitionPrompt": "<brief explanation of what relevant experience looks like + the recognition question>" }

## Current information safeguard
Where Learning Moments involve current legislation, regulation or professional guidance, you must only use GCAi-approved current-awareness content. Do not use live web search. If no approved current source is available, explain the underlying professional principle and recommend current-awareness development as the follow-up action. Do not invent specific current factual examples.

## Tone
Professionally challenging + developmental + clear + useful.
Challenge unsupported confidence. Recognise capability even where confidence is low. Avoid generic encouragement.`;

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const crypto = require('crypto');
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'AI service not configured' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, messages } = body;

  const payload = verifyToken(token || '');
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: LM_SYSTEM,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[yr2-tutor] Anthropic error:', data);
      return { statusCode: 502, headers: HEADERS, body: JSON.stringify({ error: 'AI call failed', detail: data }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
  } catch (err) {
    console.error('[yr2-tutor] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'AI service error' }) };
  }
};
