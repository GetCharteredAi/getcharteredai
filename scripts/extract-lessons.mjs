// scripts/extract-lessons.mjs
// Extracts the full MODULES array from index.html into:
//   netlify/functions/lessons-data.json  (full content, server-side only)
// Then patches index.html MODULES to a heading-only stub (no lesson bodies, no quiz).
//
// Run once on the feature branch: node scripts/extract-lessons.mjs

import { readFileSync, writeFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const html = readFileSync(join(root, 'public/index.html'), 'utf8');

// ── Extract MODULES value via sandboxed JS eval ───────────────────────────────
const MARKER = 'const MODULES = ';
const markerIdx = html.indexOf(MARKER);
if (markerIdx === -1) throw new Error('MODULES constant not found in index.html');

// Find the end of the script block that contains MODULES
const scriptEnd = html.indexOf('</script>', markerIdx);
if (scriptEnd === -1) throw new Error('Could not find closing </script> after MODULES');

const scriptContent = html.slice(markerIdx, scriptEnd);

// Run in a minimal VM context — only MODULES assignment, nothing else callable
const sandbox = {};
createContext(sandbox);
// Wrap in a try — only extract MODULES, abort on anything else
// We run just the first statement (up to the next `const ` keyword after the array close)
const afterMarker = scriptContent.slice(MARKER.length);
// Find `];` followed by optional whitespace then `const` — that's the array end
const arrayEndMatch = afterMarker.match(/\];(?:\s*const\s)/);
let arrayStr;
if (arrayEndMatch) {
  arrayStr = afterMarker.slice(0, arrayEndMatch.index + 1); // up to and including ]
} else {
  // fallback: take everything up to first \n
  const nl = afterMarker.indexOf('\n');
  arrayStr = nl !== -1 ? afterMarker.slice(0, nl).replace(/;$/, '') : afterMarker.replace(/;$/, '');
}

let modules;
try {
  modules = JSON.parse(arrayStr);
} catch (e) {
  throw new Error(`Failed to parse extracted array as JSON: ${e.message}\nFirst 200 chars: ${arrayStr.slice(0,200)}`);
}

console.log(`Parsed ${modules.length} modules`);

// ── Write full content to lessons-data.json ──────────────────────────────────
const lessonsPath = join(root, 'netlify/functions/lessons-data.json');
const fullJson = JSON.stringify(modules);
writeFileSync(lessonsPath, fullJson);
const sizeKb = Math.round(Buffer.byteLength(fullJson) / 1024);
console.log(`Written lessons-data.json (${sizeKb}KB, ${modules.length} modules)`);

// ── Build stub array (headings only, no body text or quiz) ───────────────────
function stubSection(s) {
  const stub = { h: s.h };
  if (s.isDivider) { stub.isDivider = true; if (s.sub) stub.sub = s.sub; }
  return stub;
}

const stub = modules.map(m => ({
  id: m.id,
  num: m.num,
  title: m.title,
  ...(m.level ? { level: m.level } : {}),
  ...(m.color ? { color: m.color } : {}),
  ...(m.intro ? { intro: m.intro } : {}),
  sections: (m.sections || []).map(stubSection),
}));

// ── Patch index.html — replace only the MODULES array literal ────────────────
// Replace `[...original array...]` with the stub array
// We know arrayStr is the original array content starting with `[`
const originalAssignment = MARKER + arrayStr + ';';
const stubAssignment = MARKER + JSON.stringify(stub) + ';';

if (!html.includes(originalAssignment)) {
  throw new Error('Could not locate original MODULES assignment for replacement. Manual patch required.');
}

const newHtml = html.replace(originalAssignment, stubAssignment);
writeFileSync(join(root, 'public/index.html'), newHtml, 'utf8');

const saved = Math.round((Buffer.byteLength(html) - Buffer.byteLength(newHtml)) / 1024);
console.log(`Patched index.html — removed ~${saved}KB of lesson content from public file`);
console.log('Done.');
