/**
 * Erase an individual manager's roster record — GDPR right-to-erasure path.
 *
 * Before using this script, confirm:
 *   • The manager's roster entry has been deactivated (active: false).
 *   • There is no legal, contractual or regulatory obligation to retain this record.
 *   • The request has been verified as a legitimate right-to-erasure request.
 *
 * Concurrency note:
 *   This script performs a double-check — it re-reads the roster record immediately
 *   before deletion. If the record has been re-activated between the initial check and
 *   the re-read, the erasure is aborted. However, Netlify Blobs does not support
 *   conditional delete, so a sub-millisecond race between the re-read and the delete
 *   call cannot be fully eliminated. Run this script when the employer dashboard is
 *   not in active use to avoid this window.
 *
 * Dry-run by default. Pass --confirm to execute.
 *
 * Usage:
 *   node scripts/erase-manager-record.mjs --employer-key <UUID> --email <email> [--reason "text"]
 *   node scripts/erase-manager-record.mjs --employer-key <UUID> --email <email> [--reason "text"] --confirm
 *
 * Required env: NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN
 *               (or NETLIFY_BLOBS_CONTEXT=1 for local/test use)
 */

import { getStore }      from '@netlify/blobs';
import crypto            from 'crypto';
import { fileURLToPath } from 'url';

const PREFIX   = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function writeAudit(auditStore, entry) {
  const key = `${new Date().toISOString()}-${crypto.randomUUID()}`;
  await auditStore.setJSON(key, entry);
  return key;
}

// ── Core logic (exported for testing) ────────────────────────────────────────

export async function runErasure({ employerKey, email, reason, confirm }, { rosterStore, auditStore }) {
  const messages = [];

  // Validate inputs before accessing storage
  if (!employerKey || !UUID_RE.test(employerKey)) {
    return { exitCode: 1, messages: ['Error: --employer-key must be a valid UUID'] };
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return { exitCode: 1, messages: ['Error: --email must be a valid email address'] };
  }

  const normalised = email.trim().toLowerCase();
  const rosterKey  = `${employerKey}/${Buffer.from(normalised).toString('base64url')}`;

  // Initial read
  const entry = await rosterStore.get(rosterKey, { type: 'json' });
  if (!entry) {
    return { exitCode: 1, messages: [`Error: No roster record found for ${normalised} under ${employerKey}`] };
  }

  // Refuse erasure while the manager entry is active — deactivate first
  if (entry.active) {
    return {
      exitCode: 1,
      messages: [
        'Error: Cannot erase an active manager record.',
        "       Revoke access via the cohort dashboard or p1-manager-roster (action:'remove') first,",
        '       then re-run this script once the entry shows active: false.'
      ]
    };
  }

  messages.push('');
  messages.push('── Individual manager erasure ──────────────────────────────────');
  messages.push(`  EmployerKey:  ${employerKey}`);
  messages.push(`  Roster key:   ${rosterKey}`);
  messages.push('  Status:       active=false (confirmed inactive)');
  messages.push(`  Reason:       ${reason || '(none provided)'}`);
  messages.push('');
  messages.push('  What this operation WILL do:');
  messages.push("    • Delete this manager’s roster record");
  messages.push('    • Write a pre-erasure and post-erasure audit entry');
  messages.push('    • Store the email only as a SHA-256 hash in the audit log');
  messages.push('');
  messages.push('  What this operation will NOT do:');
  messages.push('    • Delete the employer agreement record');
  messages.push("    • Delete any other manager’s records");
  messages.push('    • Delete any Benchmark data');
  messages.push('──────────────────────────────────────────────────────────────');
  messages.push('');

  if (!confirm) {
    messages.push('DRY RUN — no changes made. Re-run with --confirm to execute.');
    messages.push('');
    return { exitCode: 0, messages };
  }

  const emailHash   = crypto.createHash('sha256').update(normalised).digest('hex');
  const initiatedAt = new Date().toISOString();

  // Write intent before any destructive change. Abort if this fails — no changes have been made.
  let intentKey;
  try {
    intentKey = await writeAudit(auditStore, {
      type:          'individual-erasure-initiated',
      emailHash,
      employerKey,
      erasureReason: reason || null,
      initiatedAt
    });
    messages.push(`Pre-erasure audit entry: ${intentKey}`);
  } catch (e) {
    messages.push('Error: Failed to write pre-erasure audit entry — aborting. No changes have been made.');
    messages.push(`       ${e.message}`);
    return { exitCode: 1, messages };
  }

  // Double-check: re-read immediately before deletion.
  // Reduces (but cannot eliminate) the TOCTOU window — see concurrency note at top of file.
  const recheck = await rosterStore.get(rosterKey, { type: 'json' });
  if (!recheck || recheck.active) {
    // Record was re-activated or removed concurrently — abort and audit
    const abortReason = !recheck
      ? 'Record no longer exists on re-read'
      : 'Record was re-activated between initial check and deletion';
    messages.push(`Error: Erasure aborted — ${abortReason}.`);
    messages.push('       No deletion performed. Review the roster state before retrying.');
    try {
      const abortKey = await writeAudit(auditStore, {
        type:           'individual-erasure-aborted',
        emailHash,
        employerKey,
        erasureReason:  reason || null,
        intentAuditKey: intentKey,
        abortReason,
        abortedAt:      new Date().toISOString()
      });
      messages.push(`Abort audit entry: ${abortKey}`);
    } catch (e) {
      messages.push(`WARNING: Abort audit entry could not be written (${e.message}).`);
    }
    return { exitCode: 1, messages };
  }

  // Delete the specified roster record — exactly once
  let deleteError;
  try {
    await rosterStore.delete(rosterKey);
    messages.push(`Deleted roster record: ${rosterKey}`);
  } catch (e) {
    deleteError = e;
    messages.push(`Error: Failed to delete roster record: ${e.message}`);
  }

  // Write outcome — always attempt, even after a failed deletion
  let postAuditError;
  try {
    const outcomeKey = await writeAudit(auditStore, {
      type:           deleteError ? 'individual-erasure-failed' : 'individual-erasure-completed',
      emailHash,
      employerKey,
      erasureReason:  reason || null,
      intentAuditKey: intentKey,
      completedAt:    new Date().toISOString(),
      error:          deleteError ? deleteError.message : null
    });
    messages.push(`Post-erasure audit entry: ${outcomeKey}`);
  } catch (e) {
    postAuditError = e;
    if (!deleteError) {
      messages.push('WARNING: The roster record was deleted but the post-erasure audit record');
      messages.push(`         could not be written (${e.message}).`);
      messages.push('         The record is gone. This erasure is not fully audited.');
      messages.push('         Verify the deletion and write a manual audit record.');
    } else {
      messages.push(`WARNING: Deletion failed and the post-erasure audit record could not be written (${e.message}).`);
    }
  }

  if (deleteError || postAuditError) {
    return { exitCode: 1, messages };
  }

  messages.push('');
  messages.push('Manager record erased. Audit entries written.');
  messages.push('');
  return { exitCode: 0, messages };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

function makeStores() {
  const s = (name) => process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}${name}`)
    : getStore({ name: `${PREFIX}${name}`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  return {
    rosterStore: s('p1-manager-roster'),
    auditStore:  s('p1-deletion-audit')
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  return {
    employerKey: get('--employer-key'),
    email:       get('--email'),
    reason:      get('--reason'),
    confirm:     args.includes('--confirm')
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts   = parseArgs();
  const result = await runErasure(opts, makeStores());
  for (const msg of result.messages) console.log(msg);
  process.exit(result.exitCode);
}
