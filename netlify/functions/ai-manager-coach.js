// netlify/functions/ai-manager-coach.js
// Manager AI coaching endpoint.
//
// Modes:
//   coach     — Michael as coaching presence (reflect sections)
//   practice  — Michael plays a candidate character (practice sections)
//   practice + endPractice:true — Michael steps out of role and gives debrief feedback
//   transcribe — routes audio to Whisper, returns transcript; no AI credit consumed
//
// Auth:  manager-learning JWT → employer agreement → active roster
// Usage: Lua-based atomic Redis credit reservation (monthly per manager)
// Voice: Whisper STT via OpenAI; server-enforced daily transcription limit

'use strict';

const crypto  = require('crypto');
const { getStore } = require('@netlify/blobs');
const { checkAndReserveCredit, refundCredit } = require('./utils/redis-client');
const { callClaude, transcribeAudio }         = require('./utils/ai-providers');
const { loadPublishedTopics }                 = require('./utils/lessons-loader');

const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json'
};

const ALLOWED_MIME_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/ogg']);
const MAX_AUDIO_BYTES    = 2 * 1024 * 1024;                   // 2 MB decoded
const MAX_B64_CHARS      = Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 4;
const MAX_MESSAGES       = 20;
const MAX_MSG_LENGTH     = 2000;
const COACH_MAX_TOKENS   = 400;
const PRACTICE_MAX_TOKENS = 350;
const DEBRIEF_MAX_TOKENS  = 600;

// Published topics loaded at module startup; test suites inject via require.cache.
const publishedTopics = loadPublishedTopics();

// ── Store helpers ─────────────────────────────────────────────────────────────

function getAgreementStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-employer-agreements`)
    : getStore({ name: `${PREFIX}p1-employer-agreements`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getRosterStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-manager-roster`)
    : getStore({ name: `${PREFIX}p1-manager-roster`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

// ── Token verification ────────────────────────────────────────────────────────

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot  = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig       = token.slice(lastDot + 1);
  const hmacSig   = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  if (sig !== hmacSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (typeof payload.expires !== 'number' || !isFinite(payload.expires) || Date.now() >= payload.expires) return null;
    return payload;
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(statusCode, message, extra = {}) {
  return { statusCode, headers: HEADERS, body: JSON.stringify({ error: message, ...extra }) };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array';
  if (messages.length > MAX_MESSAGES) return `messages must not exceed ${MAX_MESSAGES}`;
  if (messages[0].role !== 'user') return 'first message must have role user';
  for (let i = 0; i < messages.length; i++) {
    const { role, content } = messages[i];
    if (role !== 'user' && role !== 'assistant') return 'messages may only have role user or assistant';
    if (typeof content !== 'string' || content.length === 0 || content.length > MAX_MSG_LENGTH) {
      return `each message content must be a non-empty string of at most ${MAX_MSG_LENGTH} characters`;
    }
    if (i > 0 && messages[i].role === messages[i - 1].role) return 'messages must alternate between user and assistant';
  }
  return null;
}

// ── System prompt builders ────────────────────────────────────────────────────

function buildCoachSystem(topicTitle, promptText, firmName) {
  const firm = firmName ? ` at ${firmName}` : '';
  return `You are Michael — a professional development coach for managers supervising RICS APC candidates and degree apprentices${firm}.

Your role is to deepen the manager's thinking, not to evaluate their performance. Ask one focused question at a time. Affirm what is working. Surface the tension or difficulty in what they have described rather than resolving it for them.

You are not coaching a candidate on RICS competencies. You are coaching a manager on their own professional practice.

Topic: ${topicTitle}
Context: ${promptText}

Keep responses to 3–5 sentences. End each response with one open question. Never give a verdict on whether the manager is doing well or poorly. Never generate RICS APC competency advice.`;
}

function buildPracticeSystem(character, firmName) {
  const firm = firmName ? ` at ${firmName}` : '';
  return `You are playing ${character.name} — a ${character.yearDescription} on the ${character.pathway} pathway${firm}.

${character.scenarioContext}

Respond as ${character.name} would: realistically, not perfectly. You may be uncertain, slightly defensive, or underconfident depending on the situation.

Stay in character for every response. Do not break role to coach the manager. Do not acknowledge you are an AI. Keep responses to 2–3 sentences.`;
}

function buildDebriefSystem(character, promptText, firmName) {
  const firm = firmName ? ` at ${firmName}` : '';
  return `You are Michael — a professional development coach reviewing a practice conversation that just took place.

The manager was practising a conversation with ${character.name}, a ${character.yearDescription}${firm}. The scenario: ${character.scenarioContext}

NOTE: This was a formative practice exercise. Your feedback supports the manager's own development and does not constitute independently verified performance evidence.

Review the full conversation and give the manager honest, specific feedback. Where the evidence allows, refer to what was actually said — quote or paraphrase a specific exchange rather than making a general observation. Prioritise the most consequential findings; do not force equal commentary on every dimension.

Cover these areas as the conversation warrants:
1. Specificity — was the SBI feedback concrete enough to act on?
2. Listening — did the manager pause after stating the impact and genuinely invite a response before moving to solutions?
3. Curiosity — did the manager ask open questions to understand the candidate's perspective, or move quickly to directing?
4. Support — did the manager explore what the candidate might need, or offer any concrete next step?
5. Demonstrated strengths — where the manager did something well, name it briefly and specifically.
6. Tone — was professional respect maintained throughout?

Aim for 5–7 sentences. No verdicts. Never invent an observation or automatically praise the manager. If the manager omitted something important, say so honestly.`;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function endOfMonthUnix() {
  const d    = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return Math.floor(next.getTime() / 1000);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function endOfDayUnix() {
  const d        = new Date();
  const tomorrow = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return Math.floor(tomorrow.getTime() / 1000);
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')    return err(405, 'Method not allowed');

  let body;
  try { body = JSON.parse(event.body); }
  catch { return err(400, 'Invalid JSON body'); }

  const { token } = body;
  if (!token || typeof token !== 'string') return err(401, 'token is required');

  // Verify JWT
  let payload;
  try { payload = verifyToken(token); }
  catch { return err(500, 'Server configuration error'); }
  if (!payload) return err(401, 'Invalid or expired token');
  if (payload.role !== 'manager-learning') return err(403, 'Forbidden: manager-learning token required');

  const { email, employerKey } = payload;
  if (!employerKey || !UUID_RE.test(employerKey)) return err(403, 'Malformed token');

  // Verify employer agreement
  const agreementStore = getAgreementStore();
  const agreement = await agreementStore.get(employerKey, { type: 'json' });
  if (!agreement)               return err(403, 'Employer agreement not found');
  if (!agreement.serviceActive) return err(403, 'Employer agreement is not active');
  if (new Date(agreement.serviceExpiresAt) <= new Date()) return err(403, 'Employer agreement has expired');

  const firmName = agreement.firmName || '';

  // Verify active roster entry
  const rosterStore  = getRosterStore();
  const rosterKey    = `${employerKey}/${Buffer.from(email).toString('base64url')}`;
  const rosterEntry  = await rosterStore.get(rosterKey, { type: 'json' });
  if (!rosterEntry || !rosterEntry.active) return err(403, 'Manager is not on the active roster');

  const { mode } = body;
  if (!mode || !['coach', 'practice', 'transcribe'].includes(mode)) {
    return err(400, 'mode must be coach, practice or transcribe');
  }

  const email64 = Buffer.from(email).toString('base64url');

  // ── transcribe ──────────────────────────────────────────────────────────────

  if (mode === 'transcribe') {
    const { audioBase64, audioMimeType } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') return err(400, 'audioBase64 is required');

    const cleanMime = typeof audioMimeType === 'string' ? audioMimeType.split(';')[0].trim() : '';
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      return err(400, 'audioMimeType must be one of: audio/webm, audio/mp4, audio/m4a, audio/ogg');
    }

    if (audioBase64.length > MAX_B64_CHARS) return err(400, 'Audio exceeds maximum size of 2 MB');

    // Server-side daily transcription limit (Lua atomic)
    const transcribeLimit = parseInt(process.env.MGR_TRANSCRIBE_DAILY_LIMIT, 10);
    if (!Number.isInteger(transcribeLimit) || transcribeLimit <= 0) {
      console.error('[ai-manager-coach] MGR_TRANSCRIBE_DAILY_LIMIT must be set to a positive integer');
      return err(500, 'AI service not configured');
    }

    const transcribeKey = `mgr:transcribe:${employerKey}:${email64}:${todayKey()}`;

    let transcribeResult;
    try {
      transcribeResult = await checkAndReserveCredit(transcribeKey, transcribeLimit, endOfDayUnix());
    } catch (e) {
      console.error('[ai-manager-coach] Redis transcribe check error:', e.message);
      return err(503, 'Service temporarily unavailable. Please try again.');
    }

    if (transcribeResult === -1) {
      return err(429, 'Daily transcription limit reached. Please type your message instead.');
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      // Refund the slot we just reserved since we are rejecting the request
      try { await refundCredit(transcribeKey); } catch { console.error('[ai-manager-coach] transcribe credit refund failed'); }
      return err(400, 'Audio exceeds maximum size of 2 MB');
    }

    try {
      const transcript = await transcribeAudio(audioBuffer, cleanMime);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ transcript }) };
    } catch (e) {
      try { await refundCredit(transcribeKey); } catch { console.error('[ai-manager-coach] transcribe credit refund failed'); }
      if (e.code === 'VOICE_NOT_AVAILABLE') return err(503, 'voice-not-available');
      console.error('[ai-manager-coach] Whisper error:', e.message);
      return err(500, 'Transcription failed. Please type your message instead.');
    }
  }

  // ── coach / practice ────────────────────────────────────────────────────────

  const { topicId, sectionIndex, messages, endPractice } = body;

  if (!topicId || typeof topicId !== 'string') return err(400, 'topicId is required');

  if (typeof sectionIndex !== 'number' || !Number.isInteger(sectionIndex) || sectionIndex < 0) {
    return err(400, 'sectionIndex must be a non-negative integer');
  }

  const topic = publishedTopics.find(t => t.id === topicId);
  if (!topic) return err(400, 'Topic not found or not published');

  const section = topic.sections[sectionIndex];
  if (!section) return err(400, 'Section not found');

  if (mode === 'practice' && section.sectionType !== 'practice') {
    return err(400, 'practice mode requires a practice section');
  }
  if (mode === 'coach' && section.sectionType !== 'reflect') {
    return err(400, 'coach mode requires a reflect section');
  }

  const msgError = validateMessages(messages);
  if (msgError) return err(400, msgError);

  // Monthly AI credit check (Lua atomic)
  const monthlyAllowed = parseInt(process.env.MGR_AI_MONTHLY_ALLOWANCE, 10);
  if (!Number.isInteger(monthlyAllowed) || monthlyAllowed <= 0) {
    console.error('[ai-manager-coach] MGR_AI_MONTHLY_ALLOWANCE must be set to a positive integer');
    return err(500, 'AI service not configured');
  }

  const creditKey = `mgr:usage:${employerKey}:${email64}:${currentMonthKey()}`;

  let creditResult;
  try {
    creditResult = await checkAndReserveCredit(creditKey, monthlyAllowed, endOfMonthUnix());
  } catch (e) {
    console.error('[ai-manager-coach] Redis credit check error:', e.message);
    return err(503, 'Service temporarily unavailable. Please try again.');
  }

  if (creditResult === -1) {
    const periodEnd = new Date(endOfMonthUnix() * 1000).toISOString().slice(0, 10);
    return err(429, 'monthly-allowance-exhausted', { monthlyAllowed, periodEnd });
  }

  // Build system prompt
  const isDebrief = (mode === 'practice' && endPractice === true);
  let systemPrompt, maxTokens;

  if (mode === 'coach') {
    systemPrompt = buildCoachSystem(topic.title, section.reflectionPrompt || '', firmName);
    maxTokens    = COACH_MAX_TOKENS;
  } else if (isDebrief) {
    systemPrompt = buildDebriefSystem(section.practiceCharacter, section.practicePrompt || '', firmName);
    maxTokens    = DEBRIEF_MAX_TOKENS;
  } else {
    systemPrompt = buildPracticeSystem(section.practiceCharacter, firmName);
    maxTokens    = PRACTICE_MAX_TOKENS;
  }

  // AI call with credit refund on failure
  try {
    const text = await callClaude(systemPrompt, messages, maxTokens);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ text }) };
  } catch (e) {
    try { await refundCredit(creditKey); } catch { console.error('[ai-manager-coach] AI credit refund failed'); }
    if (e.code === 'RATE_LIMITED')    return err(503, 'AI service temporarily unavailable. Please try again in a moment.');
    if (e.code === 'NOT_CONFIGURED')  return err(500, 'AI service not configured');
    console.error('[ai-manager-coach] callClaude error:', e.message);
    return err(500, 'Michael is not available right now. Please try again.');
  }
};
