// netlify/functions/pilot-speak.js
// Handles all AI and transcription calls for the APC Mock Interview Pilot.
// Auth: pilot token (HMAC-SHA256, JWT_SECRET). Credits tracked in Netlify Blobs.
//
// Modes:
//   verify         — validate token, return payload + current credits (initialises if first call)
//   transcribe     — Whisper transcription of audio (no credit consumed)
//   assess         — per-question assessor feedback during mock (no credit consumed; mock credit covers the session)
//   debrief        — generate practice debrief from all answers (no extra credit)
//   start-mock     — consume mock credit and confirm start
//   michael        — Michael practice conversation (1 credit per response)
//   tofy-start     — start a Think on Your Feet challenge (1 credit consumed)
//   tofy-respond   — Michael feedback on candidate's Tofy answer (no extra credit)

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const PILOT_EXPIRES_AT = new Date('2026-11-14T23:59:59Z').getTime();

const INITIAL_CREDITS = {
  mockRemaining: 2,
  michaelRemaining: 18,
  tofyRemaining: 6,
  attempt1Started: false,
  attempt1Completed: false,
  attempt2Started: false,
  attempt2Completed: false,
  createdAt: 0
};

// RICS vocabulary for Whisper
const RICS_VOCAB = 'RICS APC cost plan bills of quantities NRM1 NRM2 NRM3 JCT NEC procurement ' +
  'extension of time variation loss and expense interim certificate final account ' +
  'professional indemnity RICS Rules of Conduct mandatory competency optional competency ' +
  'Quantity Surveying tender schedule of rates measured works prelims overheads profit ' +
  'Housing Grants Act Construction Act RIBA stages PAS 2035 Building Safety Levy';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ── Token helpers ─────────────────────────────────────────────────────────────

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

// ── Credit store helpers ──────────────────────────────────────────────────────

function pilotStore() {
  return getStore({
    name: 'pilot-credits',
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN,
  });
}

async function loadCredits(token) {
  try {
    const data = await pilotStore().get(tokenKey(token), { type: 'json' });
    return data || null;
  } catch {
    return null;
  }
}

async function saveCredits(token, credits) {
  await pilotStore().set(tokenKey(token), JSON.stringify(credits));
}

function initCredits() {
  return { ...INITIAL_CREDITS, createdAt: Date.now() };
}

// ── Whisper transcription ─────────────────────────────────────────────────────

async function transcribeAudio(audioBuffer, mimeType, questionHint) {
  const boundary = '----PilotWhisper' + Date.now().toString(16);
  const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
            : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const CRLF = '\r\n';

  const filePart = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="answer.${ext}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`, 'utf8'
  );
  const modelPart = Buffer.from(
    `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}whisper-1`, 'utf8'
  );
  const promptText = questionHint ? `${questionHint.slice(0, 400)} ${RICS_VOCAB}` : RICS_VOCAB;
  const promptPart = Buffer.from(
    `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="prompt"${CRLF}${CRLF}${promptText}`, 'utf8'
  );
  const langPart = Buffer.from(
    `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}en`, 'utf8'
  );
  const closing = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');

  const body = Buffer.concat([filePart, audioBuffer, modelPart, promptPart, langPart, closing]);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });
  const json = await res.json();
  return json.text || '';
}

// ── Anthropic helper ──────────────────────────────────────────────────────────

async function callClaude(system, messages, maxTokens = 600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { mode, token: pilotToken } = body;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };

  let payload;
  try {
    payload = verifyPilotToken(pilotToken, jwtSecret);
  } catch (err) {
    const isExpired = err.message === 'expired';
    return {
      statusCode: isExpired ? 410 : 401,
      headers,
      body: JSON.stringify({ error: isExpired ? 'expired' : 'Invalid or expired access link' })
    };
  }

  // ── verify ────────────────────────────────────────────────────────────────
  if (mode === 'verify') {
    let credits = await loadCredits(pilotToken);
    if (!credits) {
      credits = initCredits();
      try { await saveCredits(pilotToken, credits); } catch { /* non-fatal */ }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, payload, credits }) };
  }

  // ── transcribe ────────────────────────────────────────────────────────────
  if (mode === 'transcribe') {
    const { audioBase64, audioMimeType, questionHint } = body;
    if (!audioBase64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio data' }) };
    if (!process.env.OPENAI_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Transcription not available' }) };
    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const mimeType = (audioMimeType || 'audio/webm').split(';')[0];
      const transcript = await transcribeAudio(audioBuffer, mimeType, questionHint);
      return { statusCode: 200, headers, body: JSON.stringify({ transcript }) };
    } catch (err) {
      console.error('[pilot-speak] transcription error:', err.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Transcription failed' }) };
    }
  }

  // ── start-mock ────────────────────────────────────────────────────────────
  if (mode === 'start-mock') {
    const attemptNum   = body.attemptNum === 2 ? 2 : 1;
    const startedKey   = `attempt${attemptNum}Started`;
    const completedKey = `attempt${attemptNum}Completed`;
    let credits = await loadCredits(pilotToken);
    if (!credits) credits = initCredits();
    // Completed attempt — permanently blocked
    if (credits[completedKey]) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'attempt-complete', credits }) };
    }
    // Attempt 2 requires attempt 1 to be finished
    if (attemptNum === 2 && !credits.attempt1Completed) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'attempt1-incomplete', credits }) };
    }
    // Resume in-progress attempt — no credit deducted
    if (credits[startedKey]) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, credits }) };
    }
    // Fresh start — consume one credit
    if (credits.mockRemaining <= 0) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'mock-used', credits }) };
    }
    credits.mockRemaining -= 1;
    credits[startedKey] = true;
    await saveCredits(pilotToken, credits);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, credits }) };
  }

  // ── complete-mock ─────────────────────────────────────────────────────────
  if (mode === 'complete-mock') {
    const attemptNum   = body.attemptNum === 2 ? 2 : 1;
    const startedKey   = `attempt${attemptNum}Started`;
    const completedKey = `attempt${attemptNum}Completed`;
    let credits = await loadCredits(pilotToken);
    if (!credits) credits = initCredits();
    credits[completedKey] = true;
    credits[startedKey]   = true;
    try { await saveCredits(pilotToken, credits); } catch { /* non-fatal */ }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  // ── save-state ────────────────────────────────────────────────────────────
  if (mode === 'save-state') {
    const { attemptNum = 1, state } = body;
    if (!state) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No state' }) };
    const key = `attempt${attemptNum}-${tokenKey(pilotToken)}`;
    try {
      const store = pilotStore();
      let existing = {};
      try { existing = await store.get(key, { type: 'json' }) || {}; } catch { /* ok */ }
      const merged = { ...existing, ...state };
      // Deep-merge sub-maps rather than overwrite
      if (state.questions && existing.questions) merged.questions = { ...existing.questions, ...state.questions };
      if (state.sectionStartedAt && existing.sectionStartedAt) merged.sectionStartedAt = { ...existing.sectionStartedAt, ...state.sectionStartedAt };
      await store.set(key, JSON.stringify(merged));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('[pilot-speak] save-state error:', err.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'State save failed' }) };
    }
  }

  // ── load-state ────────────────────────────────────────────────────────────
  if (mode === 'load-state') {
    const { attemptNum = 1 } = body;
    const key = `attempt${attemptNum}-${tokenKey(pilotToken)}`;
    try {
      const attempt = await pilotStore().get(key, { type: 'json' });
      return { statusCode: 200, headers, body: JSON.stringify({ attempt: attempt || null }) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ attempt: null }) };
    }
  }

  // ── assess ────────────────────────────────────────────────────────────────
  if (mode === 'assess') {
    const { question, answer, section } = body;
    if (!question || !answer) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question or answer' }) };

    const system = `You are an RICS APC assessor giving structured practice feedback.
The candidate is on a Quantity Surveying pathway. This is practice, not a formal assessment.

Return ONLY valid JSON in this exact format — no markdown, no preamble:
{
  "clear": "One or two sentences: what came through clearly in this answer",
  "develop": "One specific, precise thing to develop or add",
  "probe": "One follow-up question the panel might ask"
}

Do NOT:
- Include scores, numbers or percentages
- Use pass/fail language or readiness verdicts
- Reference assessment outcomes`;

    const userMsg = `Section: ${section || 'Interview'}
Question: ${question}
Candidate answer: ${answer}`;

    try {
      const text = await callClaude(system, [{ role: 'user', content: userMsg }], 400);
      const clean = text.replace(/```json|```/g, '').trim();
      const feedback = JSON.parse(clean);
      return { statusCode: 200, headers, body: JSON.stringify({ feedback }) };
    } catch (err) {
      console.error('[pilot-speak] assess error:', err.message);
      return { statusCode: 200, headers, body: JSON.stringify({ feedback: { clear: 'Your answer addressed the question.', develop: 'Consider adding a specific example from your own experience.', probe: 'What would you do differently with hindsight?' } }) };
    }
  }

  // ── debrief ───────────────────────────────────────────────────────────────
  if (mode === 'debrief') {
    const { answers } = body; // array of { section, question, answer }
    if (!answers || !answers.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No answers provided' }) };

    // Mark mock completed in credits
    let credits = await loadCredits(pilotToken);
    if (!credits) credits = initCredits();
    credits.mockCompleted = true;
    credits.mockRemaining = 0;
    try { await saveCredits(pilotToken, credits); } catch { /* non-fatal */ }

    const answersText = answers.map((a, i) =>
      `Answer ${i + 1} [${a.section}]\nQ: ${a.question}\nA: ${a.answer || '(skipped)'}`
    ).join('\n\n');

    const system = `You are an experienced RICS APC assessor reviewing a Quantity Surveying candidate's practice mock interview answers.
Your role is to give them a focused, honest practice debrief that helps them use their remaining preparation time well.

Return ONLY valid JSON in this exact format — no markdown, no preamble:
{
  "strengths": ["Specific strength 1 (concrete, references what they said)", "Specific strength 2"],
  "strengthen": ["Precise area 1 (max 3 items)", "Precise area 2", "Precise area 3"],
  "category": "Knowledge",
  "categoryReasoning": "One sentence explaining why this is the main gap category"
}

For the category field, choose exactly one from: Knowledge, Practice, Experience, Exposure, Evidence recognition, Articulation

Rules:
- Strengths must be specific to what the candidate actually said — not generic praise
- Strengthen items must be precise and actionable, not vague
- Maximum 3 strengthen items (fewer if fewer gaps are genuinely significant)
- Do NOT include: scores, numbers, pass/fail language, readiness predictions, or any reference to assessment outcomes`;

    try {
      const text = await callClaude(system, [{ role: 'user', content: answersText }], 800);
      const clean = text.replace(/```json|```/g, '').trim();
      const debrief = JSON.parse(clean);
      return { statusCode: 200, headers, body: JSON.stringify({ debrief, credits }) };
    } catch (err) {
      console.error('[pilot-speak] debrief error:', err.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Debrief generation failed' }) };
    }
  }

  // ── michael ───────────────────────────────────────────────────────────────
  if (mode === 'michael') {
    let credits = await loadCredits(pilotToken);
    if (!credits) credits = initCredits();

    if (credits.michaelRemaining <= 0) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'michael-exhausted', credits }) };
    }

    const { messages, focusArea, categoryHint } = body;
    if (!messages || !messages.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No messages' }) };

    credits.michaelRemaining = Math.max(0, credits.michaelRemaining - 1);
    await saveCredits(pilotToken, credits);

    const focusLine = focusArea ? `\nThe candidate's identified practice focus from their debrief: ${focusArea}` : '';
    const categoryLine = categoryHint ? `\nMain gap category from debrief: ${categoryHint}` : '';

    const system = `You are Michael — a focused APC coaching AI for Get Chartered AI, specifically supporting a Quantity Surveying candidate in their final week before their APC assessment on 14 November.

This candidate has just completed a practice mock interview and is using their remaining practice credits to target specific gaps.${focusLine}${categoryLine}

Your role here:
- Ask one focused APC practice question at a time, or give a direct coaching response
- Reference QS-specific scenarios: cost planning, procurement, JCT contracts, NRM, valuation, BQ preparation, final accounts, extension of time, variations
- When giving feedback, name the level (Level 1 / Level 2 / Level 3) and say specifically what would lift the answer
- Never give a readiness verdict or pass/fail prediction
- Keep responses concise — the candidate has limited credits remaining

The candidate has ${credits.michaelRemaining} Michael practice credits remaining after this response. If they have 3 or fewer remaining, acknowledge this briefly at the end.`;

    try {
      const text = await callClaude(system, messages, 500);
      return { statusCode: 200, headers, body: JSON.stringify({ text, credits }) };
    } catch (err) {
      console.error('[pilot-speak] michael error:', err.message);
      credits.michaelRemaining = Math.min(18, credits.michaelRemaining + 1); // refund on error
      await saveCredits(pilotToken, credits);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Michael is not available right now. Please try again.' }) };
    }
  }

  // ── tofy-start ────────────────────────────────────────────────────────────
  if (mode === 'tofy-start') {
    let credits = await loadCredits(pilotToken);
    if (!credits) credits = initCredits();

    if (credits.tofyRemaining <= 0) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'tofy-exhausted', credits }) };
    }

    credits.tofyRemaining = Math.max(0, credits.tofyRemaining - 1);
    await saveCredits(pilotToken, credits);

    // Pick a QS question for the challenge
    const { previousQuestions = [] } = body;
    const QS_CHALLENGES = [
      { q: 'Your client calls at 4pm on a Friday. The contractor has suspended works under the Housing Grants Construction and Regeneration Act 1996, citing a disputed payment. What is your immediate advice?', topic: 'Construction Act / payment dispute' },
      { q: 'You are three weeks from practical completion. The contractor submits a loss and expense claim worth 15% of the contract sum. Walk me through how you evaluate it.', topic: 'Loss and expense' },
      { q: 'A client asks why your tender cost plan came in 12% above the contractor\'s tender return. How do you explain and advise?', topic: 'Cost plan vs tender' },
      { q: 'You are advising a developer on procurement route. The design is 60% complete and the programme is tight. Which contract route do you recommend and why?', topic: 'Procurement advice' },
      { q: 'The contractor claims an extension of time for exceptionally adverse weather. The contract is JCT Standard Building Contract. What is the process and what do you check?', topic: 'Extension of time' },
      { q: 'You discover mid-project that your cost plan significantly underestimated MEP works. The client is committed to the contractor. What do you do?', topic: 'Cost overrun / professional judgement' }
    ];

    const unused = QS_CHALLENGES.filter(c => !previousQuestions.includes(c.q));
    const pool = unused.length ? unused : QS_CHALLENGES;
    const challenge = pool[Math.floor(Math.random() * pool.length)];

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ challenge, credits })
    };
  }

  // ── tofy-respond ──────────────────────────────────────────────────────────
  if (mode === 'tofy-respond') {
    const { question, answer } = body;
    if (!question || !answer) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question or answer' }) };

    const system = `You are Michael — an APC coaching AI giving rapid, direct feedback on a Quantity Surveying candidate's Think on Your Feet answer.

The candidate is in their final week before their APC assessment. They answered a timed challenge question. Give them:
1. What was strong (1 sentence, specific)
2. What to add or sharpen (1 sentence, specific)
3. The sentence that would lift it to Level 3 (give them the actual words they could use)

Keep it tight — 4–6 sentences total. No scores, no verdicts.`;

    try {
      const text = await callClaude(system, [
        { role: 'user', content: `Question: ${question}\n\nMy answer: ${answer}` }
      ], 350);
      return { statusCode: 200, headers, body: JSON.stringify({ text }) };
    } catch (err) {
      console.error('[pilot-speak] tofy-respond error:', err.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Feedback not available right now. Please try again.' }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown mode' }) };
};
