// scripts/mock-server.mjs
// Local-only mock server for browser verification.
// Serves /public static files and mocks all Netlify function endpoints.
// NOT for production use — no real auth, no real AI, no real data.
//
// Usage:  node scripts/mock-server.mjs
// Then open:  http://127.0.0.1:9876/manager-learning-browsertest.html

import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.resolve(__dirname, '../public');
const PORT      = 9876;

// ── Scenario state ─────────────────────────────────────────────────────────────
// Can be changed at runtime via POST /.netlify/test/scenario { scenario: "..." }
let currentScenario = 'default';

// ── Mock token (not cryptographically signed — local only) ────────────────────
function mockToken(email = 'manager@example.com') {
  const payload = {
    role:        'manager-learning',
    email,
    employerKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    expires:     Date.now() + 86_400_000,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64') + '.mock-local-sig';
}

// ── Load draft module topics ───────────────────────────────────────────────────
// Reads the four unpublished draft JSON files and strips server-only
// practiceCharacter before serving, exactly as get-manager-lesson.js does.
// Draft files stay published:false — this is local test tooling only.
function loadDraftTopics() {
  const drafts = [
    '../netlify/functions/manager-lessons-draft-m1.json',
    '../netlify/functions/manager-lessons-draft-m2.json',
    '../netlify/functions/manager-lessons-draft-m3.json',
    '../netlify/functions/manager-lessons-draft-m4.json',
  ];
  const topics = [];
  for (const rel of drafts) {
    try {
      const full = path.resolve(__dirname, rel);
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      for (const topic of (data.topics || [])) {
        topics.push({
          id:       topic.id,
          title:    topic.title,
          sections: (topic.sections || []).map(({ practiceCharacter: _pc, ...rest }) => rest),
        });
      }
    } catch (e) {
      console.warn('  [mock]  could not load', rel, '—', e.message);
    }
  }
  return topics;
}

const DRAFT_TOPICS = loadDraftTopics();

// XSS test section appended to M1 so DOMPurify sanitisation can be verified in-browser.
const XSS_SECTION = {
  sectionType: 'content',
  stageLabel:  'XSS test (should not execute)',
  body: '<h3>HTML sanitisation test</h3>'
      + '<p><a href="https://example.com">Valid link</a> — should render as a hyperlink.</p>'
      + '<p><script>alert("XSS test — should not execute")<\/script>Script tag should be stripped.</p>',
};

// Serve all four draft modules; append XSS section to M1 for sanitisation testing.
const TEST_TOPICS = DRAFT_TOPICS.length > 0
  ? DRAFT_TOPICS.map((t, i) => i === 0 ? { ...t, sections: [...t.sections, XSS_SECTION] } : t)
  : [];

console.log(`  [mock]  loaded ${TEST_TOPICS.length} draft module(s)`);
if (TEST_TOPICS.length === 0) {
  console.warn('  [mock]  WARNING: no draft modules found — check draft JSON files exist');
}

// ── Michael mock responses ─────────────────────────────────────────────────────
function michaelReply(mode, messages, endPractice) {
  if (endPractice) {
    return '**Feedback on your practice conversation**\n\n'
         + '**Specificity** — You identified a specific, observable behaviour '
         + 'and connected it to a broader pattern. '
         + 'Your use of SBI was clear.\n\n'
         + '**Listening** — Consider pausing more after stating the impact '
         + "to genuinely invite the other person's response before moving to solutions.\n\n"
         + '**Curiosity** — There were moments where you moved to directing '
         + 'before fully exploring their perspective. An open question here '
         + 'would have strengthened the conversation.\n\n'
         + '**Tone** — Professional and calm throughout.';
  }
  if (mode === 'coach') {
    if (!messages || messages.length <= 1) {
      return "That's a thoughtful starting point. What specific behaviour do you think led "
           + 'to that outcome? Being precise will help you apply the SBI model more effectively.';
    }
    return "It sounds like you've identified a clear pattern. Before acting, consider: "
         + "what impact is this having on the wider team? That's the 'I' in SBI — "
         + "and it's often the most motivating part of the feedback for the person receiving it.";
  }
  if (mode === 'practice') {
    if (!messages || messages.length <= 1) {
      return "Oh — I didn't realise it was that noticeable. "
           + "I've had a lot on recently... is this something you've noticed more than once?";
    }
    return "Okay, I hear you. I think I've been struggling to stay motivated. "
         + 'What support is available if I\'m finding it hard to keep up?';
  }
  return 'Received.';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html;charset=UTF-8', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type',
  });
  res.end(body);
}

// ── API handler ────────────────────────────────────────────────────────────────
async function handleApi(url, body, res) {
  const ep = url.split('?')[0].replace('/.netlify/functions/', '');

  // Runtime scenario override
  const sc = currentScenario;

  // ── Test control endpoint ──────────────────────────────────────────────────
  if (url.startsWith('/.netlify/test/scenario')) {
    if (body.scenario !== undefined) {
      currentScenario = String(body.scenario);
      console.log('  [mock]  scenario →', currentScenario);
      return json(res, 200, { scenario: currentScenario });
    }
    return json(res, 200, { scenario: currentScenario });
  }

  // ── Claim ──────────────────────────────────────────────────────────────────
  if (ep === 'p1-manager-learning-claim') {
    if (sc === 'claim-used')    return json(res, 400, { error: 'This invitation has already been used' });
    if (sc === 'claim-invalid') return json(res, 400, { error: 'Invalid or expired invitation link' });
    console.log('  [mock]  claim → issued token');
    return json(res, 200, { learningToken: mockToken() });
  }

  // ── Reauth ─────────────────────────────────────────────────────────────────
  if (ep === 'p1-manager-learning-reauth') {
    if (body.step === 'request') {
      console.log('  [mock]  reauth request →', body.email || '(no email)');
      return json(res, 200, {});
    }
    if (sc === 'auth-used')    return json(res, 400, { error: 'This sign-in link has already been used' });
    if (sc === 'auth-invalid') return json(res, 400, { error: 'Invalid or expired sign-in link' });
    console.log('  [mock]  magic-link verify → issued token');
    return json(res, 200, { learningToken: mockToken() });
  }

  // ── Get lesson ─────────────────────────────────────────────────────────────
  if (ep === 'get-manager-lesson') {
    if (sc === '401')   return json(res, 401,  { error: 'Unauthorized' });
    if (sc === 'empty') return json(res, 200,  { authorized: true, topics: [] });
    if (sc === '503')   return json(res, 503,  { error: 'Learning content is temporarily unavailable' });
    console.log('  [mock]  get-manager-lesson →', TEST_TOPICS.length, 'topic(s)');
    return json(res, 200, { authorized: true, topics: TEST_TOPICS });
  }

  // ── AI coach ───────────────────────────────────────────────────────────────
  if (ep === 'ai-manager-coach') {
    if (body.mode === 'transcribe') {
      if (sc === 'voice-na')  return json(res, 503, { error: 'voice-not-available' });
      if (sc === 'trlimit')   return json(res, 429, { error: 'Daily transcription limit reached. Please type your message instead.' });
      console.log('  [mock]  transcribe → mock transcript');
      return json(res, 200, { transcript: 'This is a mock transcript of the recorded audio.' });
    }
    if (sc === 'ai-503') return json(res, 503, { error: 'AI service temporarily unavailable. Please try again in a moment.' });
    if (sc === 'limit') {
      const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
      return json(res, 429, { error: 'monthly-allowance-exhausted', monthlyAllowed: 50, periodEnd });
    }
    const reply = michaelReply(body.mode, body.messages, body.endPractice);
    console.log('  [mock]  ai-manager-coach mode=' + body.mode + (body.endPractice ? ' endPractice=true' : ''));
    return json(res, 200, { text: reply });
  }

  return json(res, 404, { error: 'Unknown endpoint: ' + ep });
}

// ── Static file server ─────────────────────────────────────────────────────────
function serveStatic(url, res) {
  const rawPath  = url.split('?')[0];
  const filePath = path.resolve(PUBLIC, '.' + rawPath);

  // Path traversal guard
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404); return res.end('Not found: ' + rawPath);
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    serveStatic(rawPath.replace(/\/?$/, '/') + 'index.html', res);
    return;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
}

// ── HTTP server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
    return res.end();
  }

  if (req.url.startsWith('/.netlify/')) {
    const body = await readBody(req);
    return handleApi(req.url, body, res);
  }

  serveStatic(req.url === '/' ? '/manager-learning-browsertest.html' : req.url, res);
});

server.listen(PORT, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${PORT}`;
  console.log('\n  Manager Learning — mock server (local only)');
  console.log('  ══════════════════════════════════════════════════════');
  console.log(`\n  Test page:   ${base}/manager-learning-browsertest.html`);
  console.log('\n  Auth flows:');
  console.log(`    Claim:     ${base}/manager-learning-browsertest.html?claim=mock-claim`);
  console.log(`    Magic:     ${base}/manager-learning-browsertest.html?auth=mock-auth`);
  console.log('\n  Scenario API (use test panel in browser or curl):');
  console.log('    default     — all four draft modules');
  console.log('    empty       — no published modules (empty state)');
  console.log('    limit       — monthly AI allowance exhausted');
  console.log('    ai-503      — AI service error');
  console.log('    401         — expired session (clears token)');
  console.log('    503         — lesson data unavailable');
  console.log('    voice-na    — voice input unavailable');
  console.log('    trlimit     — daily transcription limit hit');
  console.log('    claim-used  — already-used invitation link');
  console.log('    auth-used   — already-used magic link');
  console.log('\n  Ctrl+C to stop.\n');
});
