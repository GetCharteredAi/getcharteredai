'use strict';

// manager-learning.js — Build 2 (Phase C)
// Handles claim, re-auth, sign-out, topic fetch, section rendering,
// Michael conversation (coach + practice + debrief), and voice input.

const TOKEN_KEY       = 'gca_mgr_learning_token';
const PRIVACY_ACK_KEY = 'gca_mgr_privacy_ack';

// ── State helpers ─────────────────────────────────────────────────────────────

function show(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}
function hide(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}
function showOnly(id) {
  ['state-loading','state-sign-in','state-sent','state-authorized','state-error'].forEach(hide);
  show(id);
}
function showError(title, body) {
  const t = document.getElementById('error-title');
  const b = document.getElementById('error-body');
  if (t) t.textContent = title;
  if (b) b.textContent = body;
  showOnly('state-error');
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function decodeToken(token) {
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot === -1) return null;
    return JSON.parse(atob(token.slice(0, lastDot)));
  } catch { return null; }
}
function storedToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload) return false;
  if (payload.role !== 'manager-learning') return false;
  if (payload.expires && Date.now() > payload.expires) return false;
  return true;
}
function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Claim flow — ?claim=TOKEN ─────────────────────────────────────────────────

async function handleClaim(claimToken) {
  showOnly('state-loading');
  try {
    const res  = await fetch('/.netlify/functions/p1-manager-learning-claim', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ claimToken })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(
        'Invitation link not valid',
        data.error === 'This invitation has already been used'
          ? 'This invitation link has already been used. Ask your employer to send a new one.'
          : 'This invitation link is not valid or has expired. Ask your employer to send a new one.'
      );
      return;
    }
    storeToken(data.learningToken);
    const url = new URL(window.location);
    url.searchParams.delete('claim');
    window.history.replaceState({}, '', url.toString());
    initAuthorized();
  } catch {
    showError('Could not connect', 'Please check your connection and try again.');
  }
}

// ── Magic-link flow — ?auth=TOKEN ─────────────────────────────────────────────

async function handleAuth(magicToken) {
  showOnly('state-loading');
  try {
    const res  = await fetch('/.netlify/functions/p1-manager-learning-reauth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ step: 'verify', magicToken })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(
        'Sign-in link not valid',
        data.error === 'This sign-in link has already been used'
          ? 'This sign-in link has already been used. Request a new one below.'
          : 'This sign-in link is not valid or has expired. Request a new one below.'
      );
      return;
    }
    storeToken(data.learningToken);
    const url = new URL(window.location);
    url.searchParams.delete('auth');
    window.history.replaceState({}, '', url.toString());
    initAuthorized();
  } catch {
    showError('Could not connect', 'Please check your connection and try again.');
  }
}

// ── Sign-in request ───────────────────────────────────────────────────────────

async function requestSignIn() {
  const input = document.getElementById('email-input');
  const btn   = document.getElementById('send-btn');
  const msgEl = document.getElementById('sign-in-msg');
  if (!input || !btn || !msgEl) return;
  const email = input.value.trim();
  if (!email || !email.includes('@')) {
    msgEl.className = 'form-msg err';
    msgEl.textContent = 'Please enter a valid email address.';
    msgEl.hidden = false;
    return;
  }
  btn.disabled = true;
  msgEl.hidden = true;
  try {
    await fetch('/.netlify/functions/p1-manager-learning-reauth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ step: 'request', email })
    });
    showOnly('state-sent');
  } catch {
    btn.disabled = false;
    msgEl.className = 'form-msg err';
    msgEl.textContent = 'Could not connect. Please try again.';
    msgEl.hidden = false;
  }
}

// ── Sign out ──────────────────────────────────────────────────────────────────

function signOut() {
  clearToken();
  showOnly('state-sign-in');
}

// ── Handle expired session ────────────────────────────────────────────────────

function handleExpiredSession() {
  clearToken();
  showOnly('state-sign-in');
}

// ── Authorized: sub-view helper ───────────────────────────────────────────────

const VIEWS = ['view-topics-loading','view-topics-empty','view-topics-list','view-topic-detail'];

function showView(viewId) {
  VIEWS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = id !== viewId;
  });
}

// ── Topics fetch ──────────────────────────────────────────────────────────────

async function fetchTopics() {
  const token = storedToken();
  if (!token) { handleExpiredSession(); return; }
  try {
    const res  = await fetch('/.netlify/functions/get-manager-lesson', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token })
    });
    const data = await res.json();
    if (res.status === 401 || res.status === 403) { handleExpiredSession(); return; }
    if (!res.ok) {
      showError('Learning content unavailable', 'Please try again later or contact your administrator.');
      return;
    }
    if (!Array.isArray(data.topics) || data.topics.length === 0) {
      showView('view-topics-empty');
      return;
    }
    renderTopicList(data.topics);
    showView('view-topics-list');
  } catch {
    showError('Could not load modules', 'Please check your connection and try again.');
  }
}

// ── Topic list rendering ──────────────────────────────────────────────────────

function renderTopicList(topics) {
  const grid = document.getElementById('topics-grid');
  if (!grid) return;
  grid.innerHTML = '';
  topics.forEach(topic => {
    const card = document.createElement('button');
    card.className = 'topic-card';
    card.dataset.topicId = topic.id;
    const titleEl = document.createElement('span');
    titleEl.className = 'topic-card-title';
    titleEl.textContent = topic.title;
    const ctaEl = document.createElement('span');
    ctaEl.className = 'topic-card-cta';
    ctaEl.textContent = 'Start →';
    card.appendChild(titleEl);
    card.appendChild(ctaEl);
    card.addEventListener('click', () => openTopicDetail(topic));
    grid.appendChild(card);
  });
}

// ── Topic detail ──────────────────────────────────────────────────────────────

function openTopicDetail(topic) {
  const container = document.getElementById('topic-detail-content');
  if (!container) return;
  container.innerHTML = '';
  const heading = document.createElement('h2');
  heading.className = 'topic-detail-heading';
  heading.textContent = topic.title;
  container.appendChild(heading);
  (topic.sections || []).forEach((section, idx) => {
    const block = renderSection(section, idx, topic);
    if (block) container.appendChild(block);
  });
  showView('view-topic-detail');
}

function renderSection(section, sectionIndex, topic) {
  // Compound key ensures conversations from different topics never share state,
  // even when section indices coincide.
  const panelId = topic.id + '_' + sectionIndex;
  const block = document.createElement('div');
  block.className = 'section-block';

  if (section.sectionType === 'content') {
    const label = document.createElement('p');
    label.className = 'section-label';
    label.textContent = section.stageLabel || 'Learning content';
    block.appendChild(label);
    const body = document.createElement('div');
    body.className = 'section-body prose';
    body.innerHTML = sanitiseHtml(section.body || '');
    block.appendChild(body);

  } else if (section.sectionType === 'practice') {
    const label = document.createElement('p');
    label.className = 'section-label section-label--michael';
    label.textContent = section.stageLabel || 'Practise with Michael';
    block.appendChild(label);
    if (section.practicePrompt) {
      const prompt = document.createElement('p');
      prompt.className = 'section-prompt';
      prompt.textContent = section.practicePrompt;
      block.appendChild(prompt);
    }
    block.appendChild(createConversationPanel(panelId, topic.id, sectionIndex, 'practice'));

  } else if (section.sectionType === 'reflect') {
    const label = document.createElement('p');
    label.className = 'section-label section-label--michael';
    label.textContent = section.stageLabel || 'Reflect with Michael';
    block.appendChild(label);
    if (section.reflectionPrompt) {
      const prompt = document.createElement('p');
      prompt.className = 'section-prompt';
      prompt.textContent = section.reflectionPrompt;
      block.appendChild(prompt);
    }
    block.appendChild(createConversationPanel(panelId, topic.id, sectionIndex, 'coach'));
  }

  return block;
}

// ── Conversation state ────────────────────────────────────────────────────────

const panelState = {};
let loadingCounter = 0;

// ── Conversation panel ────────────────────────────────────────────────────────

function createConversationPanel(panelId, topicId, sectionIndex, mode) {
  panelState[panelId] = { messages: [], practiceEnded: false };

  const panel = document.createElement('div');
  panel.className = 'conv-panel';
  panel.id = 'conv-panel-' + panelId;

  const messages = document.createElement('div');
  messages.className = 'conv-messages';
  messages.id = 'conv-messages-' + panelId;
  panel.appendChild(messages);

  if (mode === 'practice') {
    const endBtn = document.createElement('button');
    endBtn.className = 'btn-secondary conv-end-practice';
    endBtn.id = 'end-practice-' + panelId;
    endBtn.textContent = 'Finish practice and get feedback';
    endBtn.hidden = true;
    endBtn.addEventListener('click', () => runEndPractice(panelId, topicId, sectionIndex));
    panel.appendChild(endBtn);

    const debriefArea = document.createElement('div');
    debriefArea.className = 'debrief-area';
    debriefArea.id = 'debrief-area-' + panelId;
    debriefArea.hidden = true;
    panel.appendChild(debriefArea);
  }

  const errorEl = document.createElement('p');
  errorEl.className = 'conv-error';
  errorEl.id = 'conv-error-' + panelId;
  errorEl.hidden = true;
  panel.appendChild(errorEl);

  const inputArea = document.createElement('div');
  inputArea.className = 'conv-input-area';
  inputArea.id = 'conv-input-area-' + panelId;

  const inputRow = document.createElement('div');
  inputRow.className = 'conv-input-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'conv-textarea';
  textarea.id = 'conv-textarea-' + panelId;
  textarea.placeholder = 'Type your message…';
  textarea.rows = 2;
  textarea.setAttribute('aria-label', 'Message input');
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      handleSend(panelId, topicId, sectionIndex, mode);
    }
  });

  const micBtn = document.createElement('button');
  micBtn.className = 'btn-mic';
  micBtn.id = 'btn-mic-' + panelId;
  micBtn.textContent = 'Mic';
  micBtn.title = 'Record voice message';
  micBtn.setAttribute('aria-label', 'Record voice message');
  micBtn.addEventListener('click', () => toggleMic(panelId));

  inputRow.appendChild(textarea);
  inputRow.appendChild(micBtn);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'conv-input-actions';

  const voiceStatus = document.createElement('span');
  voiceStatus.className = 'voice-status';
  voiceStatus.id = 'voice-status-' + panelId;
  voiceStatus.hidden = true;

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn-primary conv-send';
  sendBtn.id = 'conv-send-' + panelId;
  sendBtn.textContent = 'Send';
  sendBtn.addEventListener('click', () => handleSend(panelId, topicId, sectionIndex, mode));

  actionsRow.appendChild(voiceStatus);
  actionsRow.appendChild(sendBtn);
  inputArea.appendChild(inputRow);
  inputArea.appendChild(actionsRow);
  panel.appendChild(inputArea);

  return panel;
}

// ── Send a message ────────────────────────────────────────────────────────────

// The user message is NOT committed to panelState.messages until callMichael
// succeeds.  This prevents duplicate history entries if the same message is
// retried after a failed request: the history remains valid (alternating
// user/assistant) and the backend receives a consistent array every time.
function handleSend(panelId, topicId, sectionIndex, mode) {
  const textarea = document.getElementById('conv-textarea-' + panelId);
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  // Prevent a second send while a request is already in flight (send button
  // is disabled by callMichael; this guard handles rapid double-clicks before
  // the first await point).
  const sendBtn = document.getElementById('conv-send-' + panelId);
  if (sendBtn && sendBtn.disabled) return;

  ensurePrivacyAck(() => {
    hideConvError(panelId);
    callMichael(panelId, topicId, sectionIndex, mode, false, text);
  });
}

async function callMichael(panelId, topicId, sectionIndex, mode, endPracticeFlag, pendingUserMessage) {
  const token = storedToken();
  if (!token) { handleExpiredSession(); return; }

  setSendDisabled(panelId, true);
  const loadingId = addLoadingIndicator(panelId);

  // Build the request payload.  pendingUserMessage (if present) is appended
  // to the committed history here but NOT yet stored — it is committed only
  // after a confirmed successful response so retries send an identical, valid
  // array without duplicating the pending entry.
  const messagesToSend = pendingUserMessage
    ? [...panelState[panelId].messages, { role: 'user', content: pendingUserMessage }]
    : panelState[panelId].messages;

  try {
    const body = { token, mode, topicId, sectionIndex, messages: messagesToSend };
    if (endPracticeFlag) body.endPractice = true;

    const res  = await fetch('/.netlify/functions/ai-manager-coach', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const data = await res.json();
    removeLoadingIndicator(loadingId);

    if (res.status === 401) { handleExpiredSession(); return; }

    if (res.status === 429) {
      setSendDisabled(panelId, false);
      if (data.error === 'monthly-allowance-exhausted') {
        const when = data.periodEnd
          ? new Date(data.periodEnd).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
          : 'next month';
        showConvError(panelId,
          'You have used all your Michael conversations for this period. Your allowance resets ' + when + '.');
        disableConvInput(panelId);
      } else {
        showConvError(panelId, 'Daily voice limit reached. Please type your message.');
      }
      return;
    }

    if (!res.ok) {
      setSendDisabled(panelId, false);
      showConvError(panelId, 'Michael is not available right now. Please try again shortly.');
      return;
    }

    // Success — now commit the user message so history stays consistent
    if (pendingUserMessage) {
      panelState[panelId].messages.push({ role: 'user', content: pendingUserMessage });
      addMessageToPanel(panelId, 'user', pendingUserMessage);
      const textarea = document.getElementById('conv-textarea-' + panelId);
      if (textarea) textarea.value = '';
    }

    const assistantText = data.text || '';

    if (endPracticeFlag) {
      showDebrief(panelId, assistantText);
    } else {
      panelState[panelId].messages.push({ role: 'assistant', content: assistantText });
      addMessageToPanel(panelId, 'michael', assistantText);
      if (mode === 'practice') {
        const endBtn = document.getElementById('end-practice-' + panelId);
        if (endBtn) endBtn.hidden = false;
      }
      setSendDisabled(panelId, false);
    }

  } catch {
    removeLoadingIndicator(loadingId);
    setSendDisabled(panelId, false);
    showConvError(panelId, 'Could not reach Michael. Please check your connection and try again.');
  }
}

// ── End practice / debrief ────────────────────────────────────────────────────

// practiceEnded is set only after a confirmed successful response so that a
// failed debrief request re-enables the button and allows the manager to retry.
async function runEndPractice(panelId, topicId, sectionIndex) {
  const endBtn = document.getElementById('end-practice-' + panelId);
  if (endBtn) endBtn.disabled = true;

  const token = storedToken();
  if (!token) { handleExpiredSession(); return; }

  const loadingId = addLoadingIndicator(panelId);

  // The Anthropic API does not generate a fresh response when the messages array ends
  // with an assistant role (it treats it as a completed turn). Append a user trigger
  // so the API reliably produces a new Michael debrief. The trigger is not stored in
  // panelState, so retries re-derive an identical array from the unchanged history.
  const END_PRACTICE_TRIGGER = { role: 'user', content: 'That is the end of the practice conversation. Please give me your feedback.' };

  try {
    const res  = await fetch('/.netlify/functions/ai-manager-coach', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        token, mode: 'practice', topicId, sectionIndex,
        messages: [...panelState[panelId].messages, END_PRACTICE_TRIGGER], endPractice: true
      })
    });
    const data = await res.json();
    removeLoadingIndicator(loadingId);

    if (res.status === 401) { handleExpiredSession(); return; }

    if (!res.ok) {
      if (endBtn) endBtn.disabled = false;
      showConvError(panelId, 'Could not load feedback. Please try again.');
      return;
    }

    // Success — permanently end practice
    if (endBtn) endBtn.hidden = true;
    panelState[panelId].practiceEnded = true;
    disableConvInput(panelId);
    showDebrief(panelId, data.text || '');

  } catch {
    removeLoadingIndicator(loadingId);
    if (endBtn) endBtn.disabled = false;
    showConvError(panelId, 'Could not load feedback. Please try again.');
  }
}

function showDebrief(panelId, text) {
  const area = document.getElementById('debrief-area-' + panelId);
  if (!area) return;
  area.hidden = false;
  const heading = document.createElement('p');
  heading.className = 'debrief-heading';
  heading.textContent = 'Feedback from Michael';
  const content = document.createElement('div');
  content.className = 'debrief-content prose';
  content.innerHTML = renderMarkdown(text);
  area.appendChild(heading);
  area.appendChild(content);
}

// ── Message rendering helpers ─────────────────────────────────────────────────

function addMessageToPanel(panelId, role, text) {
  const container = document.getElementById('conv-messages-' + panelId);
  if (!container) return;
  const msgEl = document.createElement('div');
  if (role === 'michael') {
    msgEl.className = 'conv-message conv-message--michael prose';
    msgEl.innerHTML = renderMarkdown(text);
  } else {
    msgEl.className = 'conv-message conv-message--user';
    msgEl.textContent = text;
  }
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function addLoadingIndicator(panelId) {
  const container = document.getElementById('conv-messages-' + panelId);
  if (!container) return null;
  const id = 'loading-' + panelId + '-' + (loadingCounter++);
  const el = document.createElement('div');
  el.className = 'conv-message conv-loading';
  el.id = id;
  el.textContent = 'Michael is thinking…';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeLoadingIndicator(loadingId) {
  if (!loadingId) return;
  const el = document.getElementById(loadingId);
  if (el) el.remove();
}

// ── Panel input helpers ───────────────────────────────────────────────────────

function setSendDisabled(panelId, disabled) {
  const sendBtn = document.getElementById('conv-send-' + panelId);
  const micBtn  = document.getElementById('btn-mic-' + panelId);
  if (sendBtn) sendBtn.disabled = disabled;
  if (micBtn)  micBtn.disabled  = disabled;
}

function disableConvInput(panelId) {
  const area = document.getElementById('conv-input-area-' + panelId);
  if (area) area.hidden = true;
}

function showConvError(panelId, msg) {
  const el = document.getElementById('conv-error-' + panelId);
  if (el) { el.textContent = msg; el.hidden = false; }
}

function hideConvError(panelId) {
  const el = document.getElementById('conv-error-' + panelId);
  if (el) el.hidden = true;
}

// ── Voice recording ───────────────────────────────────────────────────────────

let activeRecorder      = null;
let activeRecorderPanel = null;

async function toggleMic(panelId) {
  if (activeRecorder && activeRecorderPanel === panelId) {
    activeRecorder.stop();
    return;
  }
  if (activeRecorder) activeRecorder.stop();
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showConvError(panelId, 'Voice recording is not supported on this device. Please type your message.');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showConvError(panelId, 'Microphone access was denied. Please type your message.');
    return;
  }
  const chunks   = [];
  const recorder = new window.MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    activeRecorder      = null;
    activeRecorderPanel = null;
    setMicRecording(panelId, false);
    if (chunks.length === 0) return;
    const mimeType = recorder.mimeType || 'audio/webm';
    await transcribeBlob(panelId, new Blob(chunks, { type: mimeType }), mimeType);
  };
  recorder.start();
  activeRecorder      = recorder;
  activeRecorderPanel = panelId;
  setMicRecording(panelId, true);
  setTimeout(() => { if (activeRecorder === recorder) recorder.stop(); }, 90000);
}

function setMicRecording(panelId, recording) {
  const btn    = document.getElementById('btn-mic-' + panelId);
  const status = document.getElementById('voice-status-' + panelId);
  if (btn) {
    btn.textContent = recording ? 'Stop' : 'Mic';
    btn.classList.toggle('btn-mic--recording', recording);
    btn.setAttribute('aria-label', recording ? 'Stop recording' : 'Record voice message');
  }
  if (status) { status.textContent = recording ? 'Recording…' : ''; status.hidden = !recording; }
}

async function transcribeBlob(panelId, blob, mimeType) {
  const token = storedToken();
  if (!token) { handleExpiredSession(); return; }
  const statusEl = document.getElementById('voice-status-' + panelId);
  if (statusEl) { statusEl.textContent = 'Transcribing…'; statusEl.hidden = false; }
  try {
    const audioBase64 = await blobToBase64(blob);
    const res  = await fetch('/.netlify/functions/ai-manager-coach', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, mode: 'transcribe', audioBase64, audioMimeType: mimeType })
    });
    const data = await res.json();
    if (statusEl) statusEl.hidden = true;
    if (res.status === 401) { handleExpiredSession(); return; }
    if (res.status === 429) {
      showConvError(panelId, 'Daily voice limit reached. Please type your message.');
      return;
    }
    if (!res.ok) {
      showConvError(panelId,
        data.error === 'voice-not-available'
          ? 'Voice input is not available right now. Please type your message.'
          : 'Could not transcribe audio. Please type your message.');
      return;
    }
    const textarea = document.getElementById('conv-textarea-' + panelId);
    if (textarea && data.transcript) { textarea.value = data.transcript; textarea.focus(); }
  } catch {
    if (statusEl) statusEl.hidden = true;
    showConvError(panelId, 'Could not process audio. Please type your message.');
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Privacy acknowledgement ───────────────────────────────────────────────────

function ensurePrivacyAck(callback) {
  if (sessionStorage.getItem(PRIVACY_ACK_KEY)) { callback(); return; }
  const modal     = document.getElementById('privacy-modal');
  const acceptBtn = document.getElementById('privacy-accept-btn');
  if (!modal || !acceptBtn) { callback(); return; }
  modal.hidden = false;
  function onAccept() {
    sessionStorage.setItem(PRIVACY_ACK_KEY, '1');
    modal.hidden = true;
    acceptBtn.removeEventListener('click', onAccept);
    callback();
  }
  acceptBtn.addEventListener('click', onAccept);
}

// ── Content sanitisation ──────────────────────────────────────────────────────

function sanitiseHtml(html) {
  if (typeof window.DOMPurify !== 'undefined') {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','ul','ol','li','strong','em','h2','h3','h4','a','blockquote','br'],
      ALLOWED_ATTR: ['href']
    });
  }
  return '';
}

function renderMarkdown(text) {
  if (typeof window.marked !== 'undefined' && typeof window.DOMPurify !== 'undefined') {
    return window.DOMPurify.sanitize(window.marked.parse(text));
  }
  if (typeof window.DOMPurify !== 'undefined') {
    return window.DOMPurify.sanitize(text);
  }
  return escapeHtml(text);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Initialise authorised view ────────────────────────────────────────────────

async function initAuthorized() {
  showOnly('state-authorized');
  // Attach sign-out listener — covers returning users who bypass the sign-in state
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => showView('view-topics-list'));
  showView('view-topics-loading');
  await fetchTopics();
}

// ── Initialise ────────────────────────────────────────────────────────────────

function init() {
  // Attach sign-in form listeners unconditionally so they are available
  // regardless of which branch of init() runs.
  const btn   = document.getElementById('send-btn');
  const input = document.getElementById('email-input');
  if (btn)   btn.addEventListener('click', requestSignIn);
  if (input) input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') requestSignIn(); });

  const params     = new URLSearchParams(window.location.search);
  const claimToken = params.get('claim');
  const authToken  = params.get('auth');

  if (claimToken) { handleClaim(claimToken); return; }
  if (authToken)  { handleAuth(authToken);   return; }

  const stored = storedToken();
  if (isTokenValid(stored)) { initAuthorized(); return; }

  clearToken();
  showOnly('state-sign-in');
}

document.addEventListener('DOMContentLoaded', init);

// ── Test hook (Node.js only) ──────────────────────────────────────────────────
// Exposes internals for the focused frontend test suite.
// In a browser `module` is undefined so this block is never reached.
if (typeof module !== 'undefined') {
  module.exports = {
    _panelState:              panelState,
    _createConversationPanel: createConversationPanel,
    _callMichael:             callMichael,
    _handleSend:              handleSend,
    _runEndPractice:          runEndPractice,
    _handleClaim:             handleClaim,
    _handleAuth:              handleAuth,
    _initAuthorized:          initAuthorized,
    _signOut:                 signOut,
    _storeToken:              storeToken,
    _clearToken:              clearToken,
    _isTokenValid:            isTokenValid,
  };
}
