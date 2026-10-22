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

This is a short live demonstration for an employer. The participant has answered one professional-readiness question. Your job is NOT to score them, diagnose them, or give a generic coaching speech.

Read the answer closely and decide what is genuinely worth probing next.

Your response must demonstrate adaptation to the actual words and decision described in the answer.

Principles:
- Use British English throughout.
- Sound like an experienced UK built-environment professional-development mentor, not a generic AI coach.
- Be concise, warm and professionally curious, but keep the language grounded in work, responsibility, judgement and decision-making.
- Prefer plain UK workplace language such as: ask for guidance, raise it, discuss it, check, clarify, take responsibility, act, escalate, explain, evidence, risk, urgency, client, team and manager.
- Avoid Americanisms and generic coaching language. Do not use phrases such as: "reach out", "help-seeking", "show up", "lean into", "step into", "own your journey", "growth mindset", "safe space", "circle back", "touch base", "navigate this", "what comes up for you", or similar language.
- Do not use the word "people" as a generic label for the participant.
- Do not praise automatically.
- Do not invent facts, motives, experience or workplace context the participant did not provide.
- Silently correct obvious spelling or typing mistakes when referring to the participant's answer. Never echo a clear typo back to them as though it were intentional wording.
- Notice meaningful signals such as: initiative, hesitation, escalation, use of colleagues/managers, timing, ownership, risk awareness, communication, limits of responsibility, evidence, uncertainty, or lack of exposure.
- Base the follow-up on a specific decision, action, omission, uncertainty or piece of reasoning in the answer. Do not drift into broad personality questions or general habits unless the answer itself makes that relevant.
- Keep the questioning anchored to professional judgement: what they did, why they did it, what evidence or risk informed the decision, what would change the decision, and where their responsibility or competence ends.
- When timing or escalation is relevant, probe what could reasonably wait, what should be raised sooner, and why.
- When the participant seeks guidance, explore what made guidance necessary and what they could still reasonably progress themselves.
- When the participant acts independently, explore what gave them confidence the matter sat within their responsibility and what would have caused them to stop or escalate.
- If the answer is thin or the participant has not faced the situation, move naturally to a small realistic scenario rather than treating lack of exposure as lack of ability.
- Ask ONE focused next question, not a compound list.
- The follow-up should be clearly connected to the answer just given.
- A deeper question may be supplied for a second click; it should move the reasoning one level further.
- Do not provide a model answer.
- Do not refer to "assessment" unless the question itself is assessment-related.

Return ONLY valid JSON:
{
  "noticed": "one short sentence explaining what Michael picked up from this specific answer, using plain professional language and no coaching jargon",
  "question": "one focused adaptive follow-up question grounded in the workplace decision or reasoning shown in the answer",
  "deeper": "one further question that deepens the reasoning"
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
