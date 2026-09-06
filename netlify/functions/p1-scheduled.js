// netlify/functions/p1-scheduled.js
// Daily cron: candidate reminder (5d), manager reminder (5d), manager lapse (14d).
// Progress reflection trigger (Phase 4, pending D-new-8 resolution) — stub only.
//
// PRODUCTION GUARD: This function refuses to run in any non-production deploy context.
// Blobs stores are site-scoped and shared across all deploy contexts.
// Running this function against branch/preview deploy data would mutate production records.
//
// Schedule: daily (configured in netlify.toml under [functions."p1-scheduled"])

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const CANDIDATE_REMINDER_DAYS = 5;
const MANAGER_REMINDER_DAYS   = 5;
const LAPSE_THRESHOLD_DAYS    = 14;

const FROM = 'Get Chartered AI <info@getcharteredai.com>';

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function daysSince(timestamp) {
  if (!timestamp) return Infinity;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[p1-scheduled] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) { console.error('[p1-scheduled] Email error:', e.message); }
}

function wrap(content) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff">
    <div style="background:#0D0F1C;padding:20px 28px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#fff">Get Chartered <span style="color:#f59e0b">AI</span></span>
      <span style="font-size:11px;color:rgba(255,255,255,.4)">getcharteredai.com</span>
    </div>
    <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">${content}</div>
    <div style="padding:14px 28px;text-align:center">
      <p style="font-size:11px;color:#94a3b8;margin:0">Get Chartered AI &middot; getcharteredai.com</p>
    </div>
  </div>`;
}

async function triggerCandidateOnlySynthesis(sessionId) {
  // Phase 3: candidate-only synthesis for lapsed sessions.
  // Stub for Phase 1 — logs intent; actual synthesis implemented in Phase 3.
  console.log(`[p1-scheduled] Candidate-only synthesis stub triggered for session ${sessionId}`);
}

exports.handler = async (event) => {
  // ── Production guard ──────────────────────────────────────────────────────
  const context = process.env.NETLIFY_CONTEXT || process.env.CONTEXT;
  if (context && context !== 'production') {
    console.log(`[p1-scheduled] Refusing to run in non-production context: ${context}`);
    return;
  }
  // ──────────────────────────────────────────────────────────────────────────

  const sessionStore = getSessionStore();
  const cohortStore  = getCohortStore();
  const siteUrl      = process.env.URL || 'https://getcharteredai.com';

  let cohorts;
  try {
    cohorts = await cohortStore.get('index', { type: 'json' }) || [];
  } catch (e) {
    console.error('[p1-scheduled] Could not read cohort index:', e.message);
    return;
  }

  const activeCohorts = cohorts.filter(c => c.status === 'active');
  console.log(`[p1-scheduled] Processing ${activeCohorts.length} active cohort(s)`);

  for (const cohort of activeCohorts) {
    let sessionIds;
    try {
      sessionIds = await cohortStore.get(`${cohort.cohortId}/sessions`, { type: 'json' }) || [];
    } catch (e) {
      console.error(`[p1-scheduled] Could not read sessions for cohort ${cohort.cohortId}:`, e.message);
      continue;
    }

    for (const sessionId of sessionIds) {
      let meta;
      try {
        meta = await sessionStore.get(`${sessionId}/metadata`, { type: 'json' });
      } catch (e) {
        console.error(`[p1-scheduled] Could not read metadata for session ${sessionId}:`, e.message);
        continue;
      }
      if (!meta) continue;

      // ── Candidate reminder (5 days from invite) ───────────────────────────
      if (meta.status === 'invited' && !meta.reminderEmail2SentAt) {
        if (daysSince(meta.createdAt) >= CANDIDATE_REMINDER_DAYS) {
          try {
            const candidateLink = meta.candidateInviteKey
              ? `${siteUrl}/professional-readiness-benchmark?token=${meta.candidateInviteKey}`
              : siteUrl;

            await sendEmail(
              meta.candidateEmail,
              `Reminder: your Professional Readiness Benchmark is waiting`,
              wrap(`
                <p style="font-size:15px;color:#374151;line-height:1.7">Your Professional Readiness Benchmark from ${meta.firmName} is still waiting for you to begin.</p>
                <div style="margin:24px 0;text-align:center">
                  <a href="${candidateLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Begin your Benchmark →</a>
                </div>
                <p style="font-size:13px;color:#94a3b8;line-height:1.6">This is a one-time reminder. Your personal link expires 30 days from issue.</p>
              `),
              `Your Professional Readiness Benchmark is waiting. Begin here: ${candidateLink}`
            );

            await sessionStore.setJSON(`${sessionId}/metadata`, {
              ...meta,
              reminderEmail2SentAt: Date.now()
            });
          } catch (e) { console.error(`[p1-scheduled] Candidate reminder error for ${sessionId}:`, e.message); }
        }
      }

      // ── Manager checks ────────────────────────────────────────────────────
      if (meta.status === 'awaiting-manager') {
        const daysWaiting = daysSince(meta.managerInvitedAt);

        // Lapse (14 days) — evaluated before reminder
        if (daysWaiting >= LAPSE_THRESHOLD_DAYS) {
          try {
            console.log(`[p1-scheduled] Manager lapse triggered for session ${sessionId}`);

            const updatedMeta = { ...meta, status: 'manager-lapsed' };
            await sessionStore.setJSON(`${sessionId}/metadata`, updatedMeta);

            await triggerCandidateOnlySynthesis(sessionId);

            await sendEmail(
              meta.candidateEmail,
              `Your Benchmark development report is ready`,
              wrap(`
                <p style="font-size:15px;color:#374151;line-height:1.7">Your Professional Readiness Benchmark development report is ready to view.</p>
                <p style="font-size:15px;color:#374151;line-height:1.7">We were unable to include your manager's perspective at this stage, but your personal development report is complete and ready for you.</p>
                <div style="margin:24px 0;text-align:center">
                  <a href="${siteUrl}/professional-readiness-benchmark" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">View your report →</a>
                </div>
              `),
              `Your Professional Readiness Benchmark development report is ready. Log in to view it at: ${siteUrl}/professional-readiness-benchmark`
            );
          } catch (e) { console.error(`[p1-scheduled] Lapse processing error for ${sessionId}:`, e.message); }

        } else if (!meta.reminderEmail4SentAt && daysWaiting >= MANAGER_REMINDER_DAYS) {
          // Manager reminder (5 days) — only if not already lapsing
          try {
            const managerLink = meta.currentManagerInviteKey
              ? `${siteUrl}/professional-readiness-benchmark?token=${meta.currentManagerInviteKey}`
              : siteUrl;

            await sendEmail(
              meta.managerEmail,
              `Reminder: your Benchmark input is still needed`,
              wrap(`
                <p style="font-size:15px;color:#374151;line-height:1.7">A team member is waiting for your perspective on their Professional Readiness Benchmark.</p>
                <p style="font-size:15px;color:#374151;line-height:1.7">Your input takes approximately 10–15 minutes. Please complete it when you have a moment.</p>
                <div style="margin:24px 0;text-align:center">
                  <a href="${managerLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Share your perspective →</a>
                </div>
              `),
              `A team member is waiting for your Benchmark input. Complete it here: ${managerLink}`
            );

            await sessionStore.setJSON(`${sessionId}/metadata`, {
              ...meta,
              reminderEmail4SentAt: Date.now()
            });
          } catch (e) { console.error(`[p1-scheduled] Manager reminder error for ${sessionId}:`, e.message); }
        }
      }

      // ── Progress reflection trigger (Phase 4 stub) ────────────────────────
      // D-new-8 unresolved. Not implemented in Phase 1.
    }
  }

  console.log('[p1-scheduled] Run complete');
};
