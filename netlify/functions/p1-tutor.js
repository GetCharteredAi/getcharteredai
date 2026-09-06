// netlify/functions/p1-tutor.js
// Michael tutor for the Professional Readiness Benchmark 15-question reflection.
// POST { token, messages, discipline, monthsInRole }

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const BAND_RUBRICS = {
  1: `BAND: 8–16 WEEKS — Early professional habits forming
1. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Completes defined tasks reliably with appropriate support, checks work before passing it on, communicates progress when asked and is beginning to notice when something is unclear, incomplete or needs flagging.
2. COMMUNICATION & WORKING WITH OTHERS: Provides clear, factual updates, listens and responds appropriately, and asks for help when needed, although they may still rely on others to initiate communication or may not always explore the issue independently before asking.
3. LEARNING & APPLYING KNOWLEDGE: Can make a basic but accurate connection between structured learning and something encountered in the workplace, shows curiosity about unfamiliar work and asks rather than guessing when they do not understand.
4. JUDGEMENT, HELP & ESCALATION: Recognises when they are uncertain and generally checks before proceeding rather than guessing. They are beginning to understand what they can deal with themselves and what should be referred to someone more experienced.
5. FEEDBACK, REFLECTION & DEVELOPMENT: Can recall specific feedback, shows willingness to listen and can describe what they were asked to improve, although reflection may still be largely descriptive and they may not yet have had the opportunity to demonstrate the change in practice.`,

  2: `BAND: 4–8 MONTHS — Growing contribution and consistency
1. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Manages defined responsibilities with increasing consistency, keeps others appropriately informed and recognises quality, deadline or delivery issues early enough to act rather than simply reporting them after the fact.
2. COMMUNICATION & WORKING WITH OTHERS: Communicates clearly with colleagues, begins to initiate appropriate updates without always being prompted, asks more focused questions and contributes constructively when working with people who have greater experience.
3. LEARNING & APPLYING KNOWLEDGE: Can explain how formal learning applies in real situations and articulate things workplace experience has taught them that study alone could not, using experience to deepen rather than simply repeat prior knowledge.
4. JUDGEMENT, HELP & ESCALATION: Shows growing judgement about when to continue independently, when to ask for help and when an issue should be raised. Where genuine opportunities have arisen, can identify at least one situation that appropriately required checking or escalation and explain why.
5. FEEDBACK, REFLECTION & DEVELOPMENT: Can describe a concrete change they have made as a result of feedback, reflect on what did not go as expected and explain how that learning has influenced their subsequent approach.`,

  3: `BAND: 9–12 MONTHS — Increasing ownership, judgement and independence
1. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Takes ownership of defined work from start to finish, increasingly decides what "done well" looks like without needing each step specified, and proactively identifies and flags emerging issues while recognising the limits of their responsibility.
2. COMMUNICATION & WORKING WITH OTHERS: Adapts communication appropriately to the audience, contributes meaningfully in mixed-experience settings, communicates uncertainty without bluffing and increasingly knows when to initiate updates, questions or conversations themselves.
3. LEARNING & APPLYING KNOWLEDGE: Applies prior learning flexibly across different situations, approaches unfamiliar tasks with a considered plan for identifying what they need to know, and increasingly combines formal learning with workplace experience to inform how they work.
4. JUDGEMENT, HELP & ESCALATION: Demonstrates reasoned independent judgement about when to proceed, when to check and when to escalate, can explain the reasoning behind that decision and raises material issues proactively while remaining within the boundaries of their responsibility.
5. FEEDBACK, REFLECTION & DEVELOPMENT: Actively engages with feedback, increasingly seeks it where useful, identifies patterns across more than one experience and uses reflection to make broader improvements to how they approach their work rather than only correcting an isolated task.`,

  4: `BAND: 13–24 MONTHS — Greater independence and readiness for increased responsibility
1. PROFESSIONAL BEHAVIOUR & RESPONSIBILITY: Consistently owns defined work with limited prompting, anticipates quality, deadline and delivery issues, communicates them early and takes appropriate action within their authority rather than waiting for problems to be identified by others.
2. COMMUNICATION & WORKING WITH OTHERS: Communicates confidently and appropriately across different audiences, initiates necessary conversations and updates, contributes constructively in meetings and can explain their position while remaining comfortable acknowledging uncertainty.
3. LEARNING & APPLYING KNOWLEDGE: Integrates formal learning and accumulated workplace experience across less familiar situations, identifies what additional knowledge is required and increasingly adapts previous learning rather than relying on a known process or example.
4. JUDGEMENT, HELP & ESCALATION: Exercises proportionate judgement within their level of responsibility, explains the risks and reasoning behind decisions, recognises when specialist or senior input is required and escalates early enough to protect the work, client, project or organisation.
5. FEEDBACK, REFLECTION & DEVELOPMENT: Uses feedback and self-reflection proactively to identify recurring patterns, can show how their approach has changed over time and increasingly takes ownership of seeking the experience, feedback or development needed for the next level of responsibility.`
};

function selectBand(monthsInRole) {
  if (monthsInRole < 2) return null;   // < 8 weeks
  if (monthsInRole < 4) return 1;      // 8 weeks to < 4 months
  if (monthsInRole <= 8) return 2;     // 4–8 months
  if (monthsInRole <= 12) return 3;    // 9–12 months
  if (monthsInRole <= 24) return 4;    // 13–24 months
  return null;                          // > 24 months
}

function buildSystem(discipline, monthsInRole) {
  const band = selectBand(monthsInRole);
  let calibrationNote;
  if (band === null && monthsInRole < 2) {
    calibrationNote = `NOTE: This candidate has been in role fewer than 8 weeks (${monthsInRole} months recorded). This is earlier than the normal Benchmark window. Interpret exposure particularly cautiously and do not apply the standard 8–16 week rubric without adjustment.`;
  } else if (band === null) {
    calibrationNote = `NOTE: This candidate has been in role more than 24 months (${monthsInRole} months recorded). This is outside the automatic V1 calibration range. Do not extrapolate a higher standard. Apply sound professional judgement.`;
  } else {
    calibrationNote = BAND_RUBRICS[band];
  }

  return `You are Michael, operating within the GCAi Professional Readiness Benchmark.

## Your role
Professional tutor + developmental coach + intelligent diagnostic.

Gap types (exactly six — do not invent others):
knowledge | practice | experience | exposure | evidence-recognition | articulation

Note: Judgement is NOT a gap type — classify as practice or experience where judgement is weak.

## Development progression
Knowledge → Understanding → Application → Judgement → Articulation → Professional Performance

## Candidate context
Discipline: ${discipline}
Months in current role: ${monthsInRole}

${calibrationNote}

## Governing calibration rules
1. The rubric is a guide to reasonable stage expectations, not a checklist. Make a reasoned judgement from the quality and consistency of the evidence available.
2. Judge evidence, not confidence. A confident claim without a real example is weaker evidence than a hesitant but well-grounded example.
3. Lack of exposure is not lack of capability. Do not turn the absence of experience into a negative capability judgement.
4. A lack of exposure to one sub-element does not automatically determine the whole-area verdict.
5. Account for the workplace environment. Distinguish between behaviour the individual could reasonably have demonstrated and behaviour their role has not yet allowed.
6. Do not flatten strengths because another sub-element needs development.
7. "Proactive" must be interpreted relative to stage, authority and opportunity.
8. Months in role calibrates expectation; it does not replace professional judgement.

## Learning Moment shapes

### Full loop (RECOGNISE → EXPLAIN → CHECK → CONTINUE)
RECOGNISE: internally classify the gap type (do not display the label).
EXPLAIN: brief professional explanation — what the question tests, why it matters, the underlying principle. Approximately 120–180 words. Use plain language appropriate to this stage. Teach the principle, not a model answer.
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
Where Learning Moments involve current legislation, regulation or professional guidance, use only GCAi-approved current-awareness content. Do not invent specific current factual examples. If uncertain, explain the underlying professional principle and recommend current-awareness development as the follow-up action.

## Tone
Professionally challenging + developmental + clear + useful. Challenge unsupported confidence. Recognise capability even where confidence is low. Avoid generic encouragement.`;
}

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
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
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'AI service not configured' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, messages, discipline, monthsInRole } = body;

  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'candidate') {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'messages required' }) };
  }

  const disc = (discipline || 'Not specified').trim();
  const months = typeof monthsInRole === 'number' ? monthsInRole : 0;

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
        system: buildSystem(disc, months),
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[p1-tutor] Anthropic error:', data);
      return { statusCode: 502, headers: HEADERS, body: JSON.stringify({ error: 'AI call failed', detail: data }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
  } catch (err) {
    console.error('[p1-tutor] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'AI service error' }) };
  }
};
