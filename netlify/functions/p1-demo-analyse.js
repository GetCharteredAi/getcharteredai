// netlify/functions/p1-demo-analyse.js
// Employer pitch demo — Michael analyses employee + manager perspectives.
// No auth required (employer pitch tool — not indexed, not advertised).
// Inputs sanitised, length-capped. Same Anthropic call pattern as try-michael.js.

const { TAXONOMY_DEFINITIONS_BLOCK } = require('./utils/p1-taxonomy');

const DEMO_SYSTEM = `You are Michael, the AI coach inside Get Chartered AI Professional Readiness.

You are analysing two perspectives about a developing professional in a built-environment role:

1. The employee's private response to a professional readiness question about client care
2. The manager's observed perspective on the same development area

Your task is to bring these two perspectives together, identify the most likely development need using the taxonomy below, and produce a short structured output that would be useful in a real development conversation.

${TAXONOMY_DEFINITIONS_BLOCK}

## What this analysis must demonstrate

The same apparently weaker outcome can have different causes — and therefore requires a different response.

An employee who understands the right professional behaviour but lacks the workplace opportunity to practise it needs something different from an employee who has the opportunity but is not yet converting it into changed practice.

Your analysis must be specific to what was actually written — not generic. Name the limiting factor clearly, show the evidence from both sides, and give a concrete next step.

## Output schema

Return ONLY valid JSON. No markdown, no code fences, no preamble, no trailing text.

{
  "developmentType": "<plain readable label — e.g. 'Workplace Exposure' or 'Application'>",
  "gapType": "<exact taxonomy type: knowledge|application|practice|exposure|observed-exposure|evidence-recognition|articulation|judgement|responsibility-escalation|confidence-calibration>",
  "rationale": "<2-3 sentences: why this type specifically — not another — is the right conclusion from these two inputs>",
  "employeeEvidence": "<one or two sentences: what specifically in the employee answer supports this conclusion>",
  "managerEvidence": "<one or two sentences: what specifically in the manager observation corroborates or adds to this>",
  "suggestedNextAction": "<one concrete, specific, actionable next step — not generic advice>",
  "managerConversationPrompt": "<one open question a manager could use to open this development conversation>"
}`;

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { employeeAnswer, managerAnswer } = body;

  if (!employeeAnswer || typeof employeeAnswer !== 'string' || employeeAnswer.trim().length < 10) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Employee answer required (minimum 10 characters)' }) };
  }
  if (!managerAnswer || typeof managerAnswer !== 'string' || managerAnswer.trim().length < 10) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Manager observation required (minimum 10 characters)' }) };
  }

  // Strip control characters, cap length
  const clean = s => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, 800).trim();
  const cleanEmployee = clean(employeeAnswer);
  const cleanManager = clean(managerAnswer);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'AI service not configured' }) };
  }

  const userMsg = `## Employee answer\n\n${cleanEmployee}\n\n## Manager observation\n\n${cleanManager}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: DEMO_SYSTEM,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Analysis failed. Please try again.' }) };
    }

    let raw = data.content[0].text.trim();
    // Strip code fences if the model wraps despite instructions
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { analysis = JSON.parse(match[0]); }
        catch {
          console.error('JSON parse failed after extraction. Raw:', raw.slice(0, 200));
          return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Analysis could not be parsed. Please try again.' }) };
        }
      } else {
        console.error('No JSON object found in response. Raw:', raw.slice(0, 200));
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Analysis could not be parsed. Please try again.' }) };
      }
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ analysis }) };

  } catch (e) {
    console.error('p1-demo-analyse error:', e.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};
