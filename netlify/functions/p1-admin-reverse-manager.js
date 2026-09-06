// netlify/functions/p1-admin-reverse-manager.js
// Admin endpoint: reverses manager-lapsed → awaiting-manager.
// Discards candidate-only synthesis (if any), generates new manager invite,
// then triggers p1-manager-safe-background to regenerate manager-safe and issue invite.
// POST { adminSecret, sessionId }

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getInviteStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-invites`)
    : getStore({ name: `${PREFIX}p1-invites`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { adminSecret, sessionId } = body;

  if (!adminSecret || adminSecret !== process.env.P1_ADMIN_SECRET) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }
  if (!sessionId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'sessionId required' }) };

  try {
    const sessionStore = getSessionStore();
    const inviteStore  = getInviteStore();

    const meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
    if (!meta) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Session not found' }) };

    if (meta.status !== 'manager-lapsed') {
      return {
        statusCode: 409,
        headers: HEADERS,
        body: JSON.stringify({ error: `Cannot reverse: session status is '${meta.status}', expected 'manager-lapsed'` })
      };
    }

    // Supersede the current manager invite record (if any)
    if (meta.currentManagerInviteKey) {
      const existing = await inviteStore.get(meta.currentManagerInviteKey, { type: 'json' });
      if (existing) {
        await inviteStore.setJSON(meta.currentManagerInviteKey, {
          ...existing,
          supersededAt: Date.now()
        });
      }
    }

    // Discard any candidate-only synthesis
    await sessionStore.setJSON(`${sessionId}/synthesis`, null);

    // Reset metadata to awaiting-manager state
    await sessionStore.setJSON(`${sessionId}/metadata`, {
      ...meta,
      status: 'awaiting-manager',
      managerInvitedAt: null,
      currentManagerInviteKey: null,
      reminderEmail4SentAt: null,
      selfPlanSetAt: null,
      selfPlanReviewDate: null
    });

    // Trigger manager-safe generation (which also issues the new manager invite)
    const siteUrl = process.env.URL || 'https://getcharteredai.com';
    const internalSecret = process.env.P1_INTERNAL_SECRET;

    if (internalSecret) {
      fetch(`${siteUrl}/.netlify/functions/p1-manager-safe-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, internalSecret })
      }).catch(e => console.error('[p1-admin-reverse] Manager-safe trigger failed:', e.message));
    } else {
      console.warn('[p1-admin-reverse] P1_INTERNAL_SECRET not set — manager-safe not triggered');
    }

    console.log(`[p1-admin-reverse] Reversed manager-lapsed for session ${sessionId}`);
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, sessionId, newStatus: 'awaiting-manager' })
    };

  } catch (err) {
    console.error('[p1-admin-reverse] Error:', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Reversal failed' }) };
  }
};
