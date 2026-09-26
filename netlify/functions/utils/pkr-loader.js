// netlify/functions/utils/pkr-loader.js
// Shared utility: extract entries from the GCAi Professional Knowledge Register.
//
// Consuming functions must list the PKR file in netlify.toml included_files:
//   [functions."function-name"]
//     included_files = ["scripts/professional-knowledge-register.md"]
//
// The PKR file is read once on cold-start and cached for the function lifetime.

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

let _cache = null;

function _resolvePKRPath() {
  const candidates = [
    resolve(process.cwd(), 'scripts/professional-knowledge-register.md'),
    resolve(__dirname, '../../../scripts/professional-knowledge-register.md'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`PKR file not found (tried: ${candidates.join(', ')})`);
}

function _loadPKR() {
  if (_cache) return _cache;
  _cache = readFileSync(_resolvePKRPath(), 'utf8');
  return _cache;
}

/**
 * Extract a full PKR entry by ID (e.g. 'PKR-01').
 * Returns the complete entry text from its ## header to the next ## PKR- header.
 * Returns null if the entry is not found.
 */
function extractPKREntry(id) {
  const pkr = _loadPKR();
  const start = pkr.indexOf(`## ${id}:`);
  if (start === -1) return null;
  const next = pkr.indexOf('\n## PKR-', start + 5);
  return pkr.slice(start, next === -1 ? pkr.length : next).trim();
}

module.exports = { extractPKREntry };
