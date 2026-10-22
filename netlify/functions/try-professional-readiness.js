// netlify/functions/try-professional-readiness.js
// Public, bounded Michael demo for employer/professional-readiness conversations.
// The visitor answer is passed only as user content; the system prompt stays server-side.

const { getStore } = require('@netlify/blobs');

const MODEL = process.env.MICHAEL_DEMO_MODEL || 'claude-haiku-4-5-20251001';
const HOURLY_LIMIT = 20;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function ipFromEvent(event) {
  return (
    event.headers?.['x-nf-client-connection-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    'unknown'
  );
}

async function rateLimit(ip) {
  try {
    const store = getStore('professional-readiness-demo-rate-limit');
    const hour = new Date().toISOString().slice(0, 13);
    const key = `${hour}:${ip}`;
    const currentRaw = await store.get(key);
    const current = currentRaw ? Number(currentRaw) : 0;
    if (current >= HOURLY_LIMIT) return false;
    await store.set(key, String(current + 1));
    return true;
  } catch (e) {
    // Do not break a live employer demonstration if Blobs is temporarily unavailable.
    console.error('[readiness-demo] rate-limit error', e.message);
    return true;
  }
}

function systemPrompt(mode) {
  const common = `
You are Michael, the adaptive professional-development coach for Get Chartered AI.

This is a short live demonstration for an employer. The participant has answered one professional-readiness question. Read the answer closely. Your response must be specific to the exact words, decision and reasoning in the answer.

LANGUAGE AND TONE
- Use British English throughout.
- Sound like an experienced UK built-environment professional-development mentor.
- Keep the language grounded in work, responsibility, judgement and decision-making.
- Use plain UK workplace language: ask for guidance, raise it, discuss it, check, clarify, take responsibility, act, escalate, explain your reasoning, risk, evidence, urgency.
- Do not use Americanisms or generic coaching language. Banned phrases include: "reach out", "help-seeking", "show up", "lean into", "step into", "own your journey", "growth mindset", "safe space", "circle back", "touch base", "navigate this", "what comes up for you", "I'm curious", "that's a sensible instinct", "that's a good instinct", or anything similar.
- Do not use the word "people" as a generic label for the participant.
- Do not praise automatically. Only note something positive if it is directly relevant to what you are probing next.
- Do not invent facts, motives, experience or workplace context the participant did not provide.
- Silently correct obvious spelling or typing mistakes when referring to the answer. Never echo a clear typo back.

THE "NOTICED" LINE
Write one or two sentences stating what you identified from the answer. This is a concise professional observation, not a coaching opener.

Start with what the participant did, decided, omitted, or expressed uncertainty about. Where relevant, name the professional dimension this raises — risk, timing, responsibility, escalation, evidence or judgement.

Do not open with praise, affirmation, a rhetorical opener or a coaching phrase.

Weak: "That's a sensible instinct, but I'm curious what made you wait before raising it."
Strong: "You tried to work it out independently first, then used the team meeting to check your thinking. The important question is whether waiting carried any risk."

WHAT TO PROBE
Base the follow-up question on a specific decision, action, omission, uncertainty or piece of reasoning in the answer. Do not ask broad questions about personality, habits or feelings unless the answer specifically makes those relevant.

Probe, where relevant:
- what informed the decision
- what evidence was available
- what the risk or consequence was
- what could reasonably wait and what should have been raised sooner
- what sat within their responsibility
- what would have changed their decision
- when guidance or escalation became necessary

When timing is relevant: probe what could reasonably wait and what should have been raised sooner.
When the participant seeks guidance: explore what made it necessary and what they could still have progressed themselves.
When the participant acts independently: probe what gave them confidence the matter sat within their responsibility, and what would have caused them to stop or escalate.
If the answer is thin or the participant has not faced the situation: move to a short realistic scenario rather than treating lack of exposure as lack of ability.

GRAMMAR AND PHRASING
Before generating output, check every sentence for grammatical correctness, natural British phrasing, and no malformed or dangling constructions. Read each sentence as a whole before including it.

OTHER RULES
- Ask ONE focused next question only, not a compound list.
- The follow-up must be clearly connected to the answer just given.
- The deeper question should move the reasoning one further step.
- Do not provide a model answer.
- Do not refer to "assessment" unless the question itself is assessment-related.

Return ONLY valid JSON:
{
  "noticed": "one or two sentences: a concise professional observation of what you identified — specific, factual, no coaching openers, no automatic praise",
  "question": "one focused follow-up question grounded in the specific decision or reasoning in the answer",
  "deeper": "one further question that moves the reasoning one level further"
}`;

  if (mode === 'technical') {
    return common + `
This is the profession-specific technical example. Probe the reasoning, evidence, judgement, communication and limits of responsibility shown in the answer. Do not decide the technical issue for them.`;
  }

  return common + `
This is an early-career / settling-in example. Focus on initiative, boundaries, escalation, confidence to act, use of support, and what the participant could safely own next.`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ip = ipFromEvent(event);
  if (!(await rateLimit(ip))) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Demo limit reached. Please try again later.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const answer = String(body.answer || '').trim().slice(0, 3000);
  const question = String(body.question || '').trim().slice(0, 1500);
  const mode = body.mode === 'technical' ? 'technical' : 'early';

  if (answer.length < 3 || question.length < 10) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Question and answer are required' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Demo is not configured' }) };
  }

  const userContent = `Question shown to the participant:
"${question}"

Their answer:
"${answer}"

Generate Michael's adaptive response.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.2,
        system: systemPrompt(mode),
        messages: [{ role: 'user', content: userContent }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic ${response.status}: ${err.slice(0, 250)}`);
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object returned');

    const parsed = JSON.parse(match[0]);
    if (!parsed.question || !parsed.noticed) throw new Error('Incomplete adaptive response');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        noticed: String(parsed.noticed),
        question: String(parsed.question),
        deeper: String(parsed.deeper || '')
      })
    };
  } catch (e) {
    console.error('[readiness-demo] error', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Michael could not respond just now. Please try again.' })
    };
  }
};
