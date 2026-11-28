/**
 * scripts/cleanup-claim-markers-v2-clean.mjs
 *
 * Removes expired claim markers from the p1-mgr-claimed store.
 *
 * DEFAULTS TO DRY-RUN. Pass --apply to delete.
 *
 * ENVIRONMENT RESTRICTION (Build 1):
 *   This utility only operates against an isolated local `netlify dev` environment.
 *   It refuses to run if NETLIFY_BLOBS_CONTEXT does not decode to a JSON object
 *   containing an edgeURL whose hostname is localhost or 127.0.0.1. This check runs
 *   for every execution path, including direct imports, unless the caller supplies
 *   opts.env pointing at a local context (used exclusively by mocked tests that
 *   inject a dependency-injected mock store — real storage is never involved in
 *   that path, so there is no production bypass risk).
 *
 * Scan complexity:
 *   Bounded by maxMarkers (default 500). The limit is enforced inline during
 *   pagination — the utility aborts as soon as it discovers a (maxMarkers + 1)th
 *   marker blob, before reading any marker records. It never silently processes a
 *   partial set.
 *
 * Deletion rules (applied in order):
 *   1. Markers WITHOUT a safeToDeleteAfter field → never deleted (skippedNoExpiry).
 *   2. Markers WHERE safeToDeleteAfter cannot be parsed as a valid finite date →
 *      never deleted (skippedNotYet).
 *   3. Markers WHERE safeToDeleteAfter is in the future → never deleted (skippedNotYet).
 *   4. Markers WHERE safeToDeleteAfter is a valid, past timestamp → eligible.
 *      In dry-run mode: counted in `eligible` only. In apply mode: deleted.
 *
 * Usage:
 *   # dry-run (default):
 *   node scripts/cleanup-claim-markers-v2-clean.mjs
 *
 *   # write deletes (local dev only):
 *   node scripts/cleanup-claim-markers-v2-clean.mjs --apply
 *
 *   # override scan limit:
 *   node scripts/cleanup-claim-markers-v2-clean.mjs --max-markers 200
 */

import { getStore }      from '@netlify/blobs';
import { fileURLToPath } from 'url';

import { checkLocalEnv } from './reconcile-mgr-email-index.mjs';

const PREFIX              = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const DEFAULT_MAX_MARKERS = 500;

// ── Core cleanup logic ────────────────────────────────────────────────────────

/**
 * Removes expired claim markers from the given store.
 *
 * @param {object} claimStore — injected; mocked in tests, real in CLI
 * @param {{ dryRun?: boolean, maxMarkers?: number, env?: object }} opts
 *   opts.env is for mocked tests only. When omitted, process.env is used.
 * @returns {Promise<{
 *   checked: number,
 *   eligible: number,
 *   deleted: number,
 *   skippedNoExpiry: number,
 *   skippedNotYet: number,
 *   dryRun: boolean
 * }>}
 */
export async function cleanupClaimMarkers(claimStore, opts = {}) {
  const envToCheck = opts.env !== undefined ? opts.env : process.env;
  const envErrors = checkLocalEnv(envToCheck);
  if (envErrors) {
    throw new Error(`Environment safety check failed — ${envErrors[0]}`);
  }

  const dryRun = opts.dryRun !== false;

  if (
    opts.maxMarkers !== undefined &&
    (!Number.isInteger(opts.maxMarkers) || opts.maxMarkers <= 0)
  ) {
    throw new Error('maxMarkers must be a positive integer');
  }

  const maxMarkers = opts.maxMarkers ?? DEFAULT_MAX_MARKERS;
  const now = Date.now();

  // Phase 0 — paginate marker blobs with an inline scan-limit guard.
  // The limit is enforced as each blob arrives during pagination, not after all
  // pages are loaded. If a (maxMarkers + 1)th blob is found we abort before
  // reading any marker records.
  const allKeys = [];
  {
    let cursor;
    do {
      const result = cursor
        ? await claimStore.list({ cursor })
        : await claimStore.list({});
      for (const blob of result.blobs) {
        allKeys.push(blob.key);
        if (allKeys.length > maxMarkers) {
          throw new Error(
            `Marker count exceeds the scan limit of ${maxMarkers}. ` +
            `Increase maxMarkers or run cleanup more frequently.`
          );
        }
      }
      cursor = result.cursor;
    } while (cursor);
  }

  let eligible        = 0;
  let deleted         = 0;
  let skippedNoExpiry = 0;
  let skippedNotYet   = 0;

  // Phase 1 — evaluate each marker and delete if eligible.
  for (const key of allKeys) {
    const marker = await claimStore.get(key, { type: 'json' });
    if (!marker) continue;

    // Rule 1: no safeToDeleteAfter field → keep.
    if (typeof marker.safeToDeleteAfter !== 'string') {
      skippedNoExpiry++;
      continue;
    }

    // Rules 2 & 3: invalid or future safeToDeleteAfter → keep.
    const safeTime = new Date(marker.safeToDeleteAfter).getTime();
    if (!Number.isFinite(safeTime) || safeTime > now) {
      skippedNotYet++;
      continue;
    }

    // Rule 4: eligible (valid, past safeToDeleteAfter).
    eligible++;
    if (!dryRun) {
      await claimStore.delete(key);
      deleted++;
    }
  }

  return { checked: allKeys.length, eligible, deleted, skippedNoExpiry, skippedNotYet, dryRun };
}

// ── Store factory (local dev only — CLI entry point) ──────────────────────────

function makeStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-mgr-claimed`)
    : getStore({ name: `${PREFIX}p1-mgr-claimed`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cliEnvErrors = checkLocalEnv(process.env);
  if (cliEnvErrors) {
    for (const line of cliEnvErrors) console.error(line);
    process.exit(1);
  }

  const args       = process.argv.slice(2);
  const iMax       = args.indexOf('--max-markers');
  const maxMarkers = iMax !== -1 ? parseInt(args[iMax + 1], 10) : DEFAULT_MAX_MARKERS;
  const apply      = args.includes('--apply');
  const dryRun     = !apply;

  if (iMax !== -1 && (!Number.isInteger(maxMarkers) || maxMarkers <= 0)) {
    console.error(`--max-markers must be a positive integer; got: ${args[iMax + 1]}`);
    process.exit(1);
  }

  try {
    const { checked, eligible, deleted, skippedNoExpiry, skippedNotYet } =
      await cleanupClaimMarkers(makeStore(), { dryRun, maxMarkers });

    if (dryRun) {
      console.log(`Dry-run (no deletes): checked ${checked} marker(s).`);
      if (eligible > 0)        console.log(`  Eligible to delete:  ${eligible} marker(s).`);
      if (skippedNoExpiry > 0) console.log(`  Skipped (no expiry): ${skippedNoExpiry} marker(s).`);
      if (skippedNotYet > 0)   console.log(`  Skipped (not yet):   ${skippedNotYet} marker(s).`);
      if (eligible === 0)      console.log('  No markers eligible for deletion.');
      console.log('Pass --apply to delete.');
    } else {
      console.log(`Applied: checked ${checked} marker(s).`);
      if (deleted > 0)         console.log(`  Deleted:             ${deleted} marker(s).`);
      if (skippedNoExpiry > 0) console.log(`  Skipped (no expiry): ${skippedNoExpiry} marker(s).`);
      if (skippedNotYet > 0)   console.log(`  Skipped (not yet):   ${skippedNotYet} marker(s).`);
      if (deleted === 0)       console.log('  No markers deleted.');
    }
  } catch (e) {
    console.error(`Cleanup failed: ${e.message}`);
    process.exit(1);
  }
}
