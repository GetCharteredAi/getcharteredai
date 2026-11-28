// netlify/functions/utils/ai-providers.js
// Thin wrappers around Anthropic (Claude) and OpenAI (Whisper) API calls.
// Injected via require.cache in tests — no live provider calls are made in test suites.

'use strict';

const ROLLING_CONTEXT_SIZE = 12; // most recent N messages sent per turn

/**
 * Sends a conversation to Claude Haiku and returns the response text.
 *
 * Throws with e.code set to:
 *   'NOT_CONFIGURED'  — ANTHROPIC_API_KEY env var is absent
 *   'RATE_LIMITED'    — Anthropic returned 429
 *   'API_ERROR'       — any other non-2xx Anthropic response
 *
 * @param {string}   system     System prompt
 * @param {object[]} messages   Conversation history [{role,content}]
 * @param {number}   maxTokens  Output token ceiling
 * @returns {Promise<string>}
 */
async function callClaude(system, messages, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const e = new Error('ANTHROPIC_API_KEY not configured');
    e.code = 'NOT_CONFIGURED';
    throw e;
  }

  const contextMessages = messages.slice(-ROLLING_CONTEXT_SIZE);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json'
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages:   contextMessages
    })
  });

  if (!res.ok) {
    if (res.status === 429) {
      const e = new Error('Rate limited by Anthropic');
      e.code = 'RATE_LIMITED';
      throw e;
    }
    const e = new Error(`Anthropic API error ${res.status}`);
    e.code = 'API_ERROR';
    throw e;
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

/**
 * Transcribes audio via OpenAI Whisper and returns the transcript string.
 *
 * Throws with e.code set to:
 *   'VOICE_NOT_AVAILABLE' — OPENAI_API_KEY env var is absent
 *   'WHISPER_ERROR'       — any non-2xx Whisper response
 *
 * @param {Buffer} audioBuffer  Raw audio bytes
 * @param {string} mimeType     e.g. 'audio/webm' (no codec suffix)
 * @returns {Promise<string>}
 */
async function transcribeAudio(audioBuffer, mimeType) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    const e = new Error('OPENAI_API_KEY not configured');
    e.code = 'VOICE_NOT_AVAILABLE';
    throw e;
  }

  const boundary = '----MgrWhisper' + Date.now().toString(16);
  const ext  = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
             : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const CRLF = '\r\n';
  const vocab = 'feedback development conversation coaching delegation professional ' +
    'development apprentice candidate performance line manager RICS APC appraisal';

  const filePart   = Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="input.${ext}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`, 'utf8');
  const modelPart  = Buffer.from(`${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}whisper-1`, 'utf8');
  const promptPart = Buffer.from(`${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="prompt"${CRLF}${CRLF}${vocab}`, 'utf8');
  const langPart   = Buffer.from(`${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}en`, 'utf8');
  const closing    = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');

  const reqBody = Buffer.concat([filePart, audioBuffer, modelPart, promptPart, langPart, closing]);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type':  `multipart/form-data; boundary=${boundary}`
    },
    body: reqBody
  });

  if (!res.ok) {
    const e = new Error(`Whisper error ${res.status}`);
    e.code = 'WHISPER_ERROR';
    throw e;
  }

  const json = await res.json();
  return json.text || '';
}

module.exports = { callClaude, transcribeAudio };
