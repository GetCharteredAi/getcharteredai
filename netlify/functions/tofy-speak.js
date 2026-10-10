// tofy-speak.js
// Spoken-answer prototype: transcribes audio (OpenAI Whisper) then returns
// Michael articulation coaching (Anthropic). No API keys exposed to the client.

const crypto = require('crypto');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Pathways with completed 50-question technical banks in questions-data.json.
// Must stay in sync with VALID_PATHWAYS in get-questions.js.
const _TECHNICAL_BANK_PATHWAYS = new Set([
  'Building Surveying', 'Quantity Surveying and Construction', 'Taxation Allowances',
  'Valuation', 'Planning and Development', 'Project Management', 'Residential',
  'Commercial Real Estate', 'Property Finance and Investment', 'Facility Management',
  'Rural', 'Land and Resources', 'Building Control', 'Corporate Real Estate',
  'Management Consultancy', 'Infrastructure'
]);

// RICS vocabulary for Whisper — helps transcribe specialist terms accurately
const _RICS_VOCAB = 'RICS APC dilapidations schedule of condition marketing particulars ' +
  'capital allowances MEES professional indemnity CPD mandatory competency optional competency ' +
  'Leasehold Reform party wall Red Book RICS Valuation Standards comparable evidence yield ' +
  'net present value discounted cash flow schedule of dilapidations landlord tenant ' +
  'building survey valuation RICS Rules of Conduct Ethics in Practice';

function verifyToken(token, jwtSecret) {
  if (!token) throw new Error('missing');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('malformed');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  if (payload.expires && Date.now() > payload.expires) throw new Error('expired');
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(parts[0]).digest('base64url');
  const legacySig = Buffer.from(`${parts[0]}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (parts[1] !== hmacSig && parts[1] !== legacySig) throw new Error('invalid');
}

// questionHint: question text for Whisper vocabulary priming (truncated to 400 chars)
async function transcribeAudio(audioBuffer, mimeType, questionHint) {
  const boundary = '----GCAWhisper' + Date.now().toString(16);
  const ext = (mimeType.includes('mp4') || mimeType.includes('m4a')) ? 'm4a'
             : mimeType.includes('ogg') ? 'ogg'
             : 'webm';
  const filename = `answer.${ext}`;
  const CRLF = '\r\n';

  const filePart = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`,
    'utf8'
  );

  // Model field without closing boundary — added after prompt field
  const modelPart = Buffer.from(
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-1`,
    'utf8'
  );

  // Vocabulary prompt: question context + RICS specialist terms (≤ 224 tokens)
  const promptText = questionHint
    ? `${questionHint.slice(0, 400)} ${_RICS_VOCAB}`
    : _RICS_VOCAB;

  const promptPart = Buffer.from(
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="prompt"${CRLF}${CRLF}` +
    `${promptText}`,
    'utf8'
  );

  const closing = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');

  const body = Buffer.concat([filePart, audioBuffer, modelPart, promptPart, closing]);

  console.log('[tofy-speak] calling OpenAI Whisper — mimeType:', mimeType, 'filename:', filename, 'bodyBytes:', body.length);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  });

  console.log('[tofy-speak] Whisper response status:', res.status);

  if (!res.ok) {
    const errText = await res.text();
    console.error('[tofy-speak] Whisper error body:', errText.slice(0, 500));
    throw new Error(`Transcription request failed: ${res.status}`);
  }
  const data = await res.json();
  return (data.text || '').trim();
}

const _areaConfig = {
  apc: {
    systemContext: 'You are Michael, an experienced RICS assessor giving direct coaching on spoken APC answers.',
    caps: 'Answer|Structure|Reasoning|Judgement|Professional communication',
    emphasis: 'Weight your feedback on: direct answer to the question, technical/professional application, reasoning, judgement, and professional tone.'
  },
  manager: {
    systemContext: 'You are Michael, an experienced professional development coach giving direct coaching on spoken manager conversations.',
    caps: 'Ownership|Reflection|Evidence|Development awareness|Clarity',
    emphasis: 'Weight your feedback on: taking ownership, genuine reflection, supporting claims with evidence, development self-awareness, and clarity of communication.'
  },
  team: {
    systemContext: 'You are Michael, an experienced professional development coach giving direct coaching on spoken team contributions.',
    caps: 'Relevance|Confidence|Concision|Reasoning|Usefulness',
    emphasis: 'Weight your feedback on: relevance to what matters, confidence of delivery, concision (not rambling), reasoning explained, and whether the contribution moves things forward.'
  }
};

// Detects explicit help requests vs genuine answer attempts (even uncertain ones).
// Only triggers on unambiguous non-attempts — explicit "I don't know / explain this to me" phrases.
// Does NOT trigger on uncertainty within a genuine attempt ("I think...", "I'm not sure but...").
function _isHelpRequest(transcript) {
  const t = transcript.toLowerCase().trim();
  const helpPatterns = [
    /^i don'?t know/,
    /^i'?m not sure what (to say|this means|this is|the answer)/,
    /^(can you |could you )(explain|tell me|help me|describe) (this|what|how|why|the)/,
    /^i have no idea/,
    /^i need (help|a hint)/,
    /^sorry,? i (don'?t|couldn'?t|can'?t)/
  ];
  return helpPatterns.some(p => p.test(t));
}

async function getCoaching(
  apiKey, question, keyPoints, transcript, attemptNum, attempt1Transcript,
  practiceArea, pathway, practiceMode, questionWhy, questionPass, questionHigh
) {
  const isRetry = attemptNum > 1 && attempt1Transcript;
  const isTutor = practiceMode === 'tutor';
  const cfg = _areaConfig[practiceArea] || _areaConfig.apc;

  // In tutor mode on a first attempt, route explicit help requests to explanation rather than scoring
  if (isTutor && !isRetry && _isHelpRequest(transcript)) {
    console.log('[tofy-speak] tutor mode — detected help request, returning teaching response');
    return await _getTeachingResponse(apiKey, question, questionWhy, questionPass, keyPoints, cfg);
  }

  const pathwayLine = (pathway && _TECHNICAL_BANK_PATHWAYS.has(pathway)) ? `Pathway: ${pathway}\n` : '';

  const modeInstruction = isTutor
    ? 'You are in Practice Mode. Encourage genuine attempts. Be direct and honest but constructive.'
    : 'You are in Assessor Mode. Evaluate as a RICS panel assessor would. Be direct and unsparing.';

  const systemPrompt = `${cfg.systemContext} ${modeInstruction} Return only valid JSON — no markdown, no preamble, no trailing text.`;

  // Technical context from question bank — always include keyPoints and why; model answers in tutor mode only
  const contextLines = [];
  if (questionWhy) contextLines.push(`What assessors are testing: ${questionWhy}`);
  if (keyPoints && keyPoints.length) contextLines.push(`Key points to cover: ${keyPoints.join('; ')}`);
  if (isTutor && questionPass) contextLines.push(`Pass-level benchmark: ${questionPass}`);
  if (isTutor && questionHigh) contextLines.push(`High-level benchmark: ${questionHigh}`);
  const techContext = contextLines.length ? contextLines.join('\n') + '\n\n' : '';

  const capSchema = `{"name":"<one of: ${cfg.caps}>","label":"<one of: Strong|Improve|Try again>","note":"<one short honest sentence>"}`;

  const userPrompt = isRetry
    ? `${pathwayLine}Evaluate attempt 2 of this spoken answer and compare it honestly with attempt 1.\n${cfg.emphasis}\n\n${techContext}Question: ${question}\n\nAttempt 1 transcript: ${attempt1Transcript}\nAttempt 2 transcript: ${transcript}\n\nReturn JSON exactly matching this structure:\n{"response_type":"coaching","capabilities":[${capSchema},${capSchema},${capSchema},${capSchema},${capSchema}],"try_again":"<one sentence: what to focus on next time>","improvements":["<what specifically got better, or honest statement if nothing improved>"],"overall":"<one of: Improved|Stronger overall|No change|Weaker — try again>"}`
    : `${pathwayLine}Evaluate this spoken answer.\n${cfg.emphasis}\n\n${techContext}Question: ${question}\n\nTranscript: ${transcript}\n\nReturn JSON exactly matching this structure:\n{"response_type":"coaching","capabilities":[${capSchema},${capSchema},${capSchema},${capSchema},${capSchema}],"try_again":"<one sentence coaching instruction for the next attempt>"}`;

  console.log('[tofy-speak] calling Anthropic feedback — area:', practiceArea, 'pathway:', pathway || '(none)', 'mode:', practiceMode || 'tutor', 'attempt:', attemptNum, 'isRetry:', isRetry);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  console.log('[tofy-speak] Anthropic response status:', res.status);

  const data = await res.json();
  if (!res.ok) {
    console.error('[tofy-speak] Anthropic error:', JSON.stringify(data.error || data).slice(0, 300));
    throw new Error(`Feedback request failed: ${data.error?.message || res.status}`);
  }

  const raw = (data.content?.[0]?.text || '')
    .replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
  return JSON.parse(raw);
}

// Returns an explanation when a tutor-mode candidate explicitly requests help
async function _getTeachingResponse(apiKey, question, questionWhy, questionPass, keyPoints, cfg) {
  const systemPrompt = `${cfg.systemContext} You are in Tutor Mode. A candidate has asked for help rather than attempting an answer. Give a concise, useful explanation (under 80 words) of what the question is looking for, then invite them to attempt their own answer. Return only valid JSON — no markdown, no preamble.`;

  const context = [
    questionWhy ? `What this question is testing: ${questionWhy}` : '',
    keyPoints && keyPoints.length ? `Key points: ${keyPoints.join('; ')}` : '',
    questionPass ? `A passing answer covers: ${questionPass}` : ''
  ].filter(Boolean).join('\n');

  const userPrompt = `Question: ${question}\n\n${context}\n\nReturn JSON exactly:\n{"response_type":"teaching","explanation":"<concise explanation under 80 words>","try_again":"<one sentence inviting them to try answering>"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!res.ok) {
    const d = await res.json();
    throw new Error(`Teaching response failed: ${d.error?.message || res.status}`);
  }
  const data = await res.json();
  const raw = (data.content?.[0]?.text || '')
    .replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
  return JSON.parse(raw);
}

exports.handler = async (event) => {
  console.log('[tofy-speak] invoked — method:', event.httpMethod);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const jwtSecret = process.env.JWT_SECRET;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  console.log('[tofy-speak] env check — JWT_SECRET present:', !!jwtSecret, '| ANTHROPIC_API_KEY present:', !!anthropicKey, '| OPENAI_API_KEY present:', !!openaiKey);
  console.log('[tofy-speak] Content-Type:', event.headers['content-type'] || event.headers['Content-Type'] || '(none)');
  console.log('[tofy-speak] raw body size (chars):', (event.body || '').length);

  if (!jwtSecret || !anthropicKey) {
    console.error('[tofy-speak] missing JWT_SECRET or ANTHROPIC_API_KEY');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }
  if (!openaiKey) {
    console.error('[tofy-speak] missing OPENAI_API_KEY');
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Transcription not yet configured — please use typed practice for now.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    console.error('[tofy-speak] JSON parse failed:', e.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid audio payload' }) };
  }

  const {
    audioBase64, audioMimeType, question, keyPoints,
    attemptNum, attempt1Transcript, practiceArea, token,
    pathway, practiceMode, questionWhy, questionPass, questionHigh
  } = body;

  console.log('[tofy-speak] parsed body — mimeType:', audioMimeType, '| audioBase64 length:', (audioBase64 || '').length, '| question length:', (question || '').length, '| area:', practiceArea, '| pathway:', pathway || '(none)', '| mode:', practiceMode || 'tutor');

  try {
    verifyToken(token, jwtSecret);
  } catch (e) {
    console.error('[tofy-speak] token verification failed:', e.message);
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!audioBase64 || !question) {
    console.error('[tofy-speak] missing audioBase64 or question — audioBase64 present:', !!audioBase64, '| question present:', !!question);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Accept pathway only if it has a completed technical bank; unrecognised values degrade gracefully
  const validatedPathway = (pathway && _TECHNICAL_BANK_PATHWAYS.has(pathway)) ? pathway : null;
  if (pathway && !validatedPathway) {
    console.warn('[tofy-speak] pathway without completed technical bank:', pathway, '— coaching proceeds without pathway context');
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const mimeType = (audioMimeType || 'audio/webm').split(';')[0];

    console.log('[tofy-speak] audioBuffer size (bytes):', audioBuffer.length, '| mimeType (stripped):', mimeType);

    const transcript = await transcribeAudio(audioBuffer, mimeType, question);

    console.log('[tofy-speak] transcript length:', transcript.length);

    if (!transcript || transcript.length < 5) {
      console.log('[tofy-speak] transcript too short or empty — returning no-speech response');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ transcript: '', error: 'No speech detected — please try again.' })
      };
    }

    const coaching = await getCoaching(
      anthropicKey, question, keyPoints || [], transcript,
      attemptNum || 1, attempt1Transcript || null, practiceArea || 'apc',
      validatedPathway, practiceMode || 'tutor', questionWhy || '', questionPass || '', questionHigh || ''
    );

    console.log('[tofy-speak] success — response_type:', coaching.response_type || 'coaching');
    return { statusCode: 200, headers, body: JSON.stringify({ transcript, coaching }) };

  } catch (e) {
    console.error('[tofy-speak] caught error — name:', e.name, '| message:', e.message);
    if (e.stack) console.error('[tofy-speak] stack:', e.stack.split('\n').slice(0, 4).join(' | '));
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Processing failed — please try again.' }) };
  }
};
