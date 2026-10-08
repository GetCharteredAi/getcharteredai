// tofy-speak.js
// Spoken-answer prototype: transcribes audio (OpenAI Whisper) then returns
// Michael articulation coaching (Anthropic). No API keys exposed to the client.

const crypto = require('crypto');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

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

async function transcribeAudio(audioBuffer, mimeType) {
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
  const modelPart = Buffer.from(
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-1${CRLF}` +
    `--${boundary}--${CRLF}`,
    'utf8'
  );

  const body = Buffer.concat([filePart, audioBuffer, modelPart]);

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

async function getCoaching(apiKey, question, keyPoints, transcript, attemptNum, attempt1Transcript, practiceArea) {
  const isRetry = attemptNum > 1 && attempt1Transcript;
  const cfg = _areaConfig[practiceArea] || _areaConfig.apc;

  const systemPrompt =
    `${cfg.systemContext} ` +
    'Return only valid JSON — no markdown, no preamble, no trailing text.';

  const capSchema = `{"name":"<one of: ${cfg.caps}>","label":"<one of: Strong|Improve|Try again>","note":"<one short honest sentence>"}`;

  const userPrompt = isRetry
    ? `Evaluate attempt 2 of this spoken answer and compare it honestly with attempt 1.
${cfg.emphasis}

Question: ${question}
Key points to cover: ${(keyPoints || []).join('; ')}

Attempt 1 transcript: ${attempt1Transcript}
Attempt 2 transcript: ${transcript}

Return JSON exactly matching this structure:
{
  "capabilities": [${capSchema}, ${capSchema}, ${capSchema}, ${capSchema}, ${capSchema}],
  "try_again": "<one sentence: what to focus on next time>",
  "improvements": ["<what specifically got better, or honest statement if nothing improved>"],
  "overall": "<one of: Improved|Stronger overall|No change|Weaker — try again>"
}`
    : `Evaluate this spoken answer.
${cfg.emphasis}

Question: ${question}
Key points to cover: ${(keyPoints || []).join('; ')}

Transcript: ${transcript}

Return JSON exactly matching this structure:
{
  "capabilities": [${capSchema}, ${capSchema}, ${capSchema}, ${capSchema}, ${capSchema}],
  "try_again": "<one sentence coaching instruction for the next attempt>"
}`;

  console.log('[tofy-speak] calling Anthropic feedback — area:', practiceArea, 'attempt:', attemptNum, 'isRetry:', isRetry);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
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

  const { audioBase64, audioMimeType, question, keyPoints, attemptNum, attempt1Transcript, practiceArea, token } = body;

  console.log('[tofy-speak] parsed body — mimeType:', audioMimeType, '| audioBase64 length:', (audioBase64 || '').length, '| question length:', (question || '').length, '| area:', practiceArea);

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

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const mimeType = (audioMimeType || 'audio/webm').split(';')[0];

    console.log('[tofy-speak] audioBuffer size (bytes):', audioBuffer.length, '| mimeType (stripped):', mimeType);

    const transcript = await transcribeAudio(audioBuffer, mimeType);

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
      attemptNum || 1, attempt1Transcript || null, practiceArea || 'apc'
    );

    console.log('[tofy-speak] success — returning transcript + coaching');
    return { statusCode: 200, headers, body: JSON.stringify({ transcript, coaching }) };

  } catch (e) {
    console.error('[tofy-speak] caught error — name:', e.name, '| message:', e.message);
    if (e.stack) console.error('[tofy-speak] stack:', e.stack.split('\n').slice(0, 4).join(' | '));
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Processing failed — please try again.' }) };
  }
};
