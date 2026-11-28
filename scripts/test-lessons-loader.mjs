// scripts/test-lessons-loader.mjs
// Focused tests for lessons-loader.js.
// No live provider calls. Temp files written to os.tmpdir() for each test case.

import { createRequire }    from 'module';
import { strict as assert } from 'assert';
import os   from 'os';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath }    from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const require    = createRequire(import.meta.url);

const LOADER_PATH = path.resolve(__dirname, '../netlify/functions/utils/lessons-loader.js');

// Load once — loadPublishedTopicsFrom is a pure function over a file path.
const { loadPublishedTopicsFrom, LessonsLoadError } = require(LOADER_PATH);

// ── Helpers ───────────────────────────────────────────────────────────────────

function tmpPath(suffix) {
  return path.join(os.tmpdir(), `gcai-loader-test-${suffix}-${Date.now()}.json`);
}

function writeJson(p, content) {
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
}

function cleanup(...paths) {
  for (const p of paths) {
    try { fs.unlinkSync(p); } catch { /* already gone */ }
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${e.message}`);
    failures.push({ label, message: e.message });
    failed++;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

await test('LDR-01  missing file — throws LessonsLoadError and logs error', async () => {
  const p = path.join(os.tmpdir(), `gcai-does-not-exist-${Date.now()}.json`);

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    assert.throws(
      () => loadPublishedTopicsFrom(p),
      (e) => {
        assert.ok(e instanceof LessonsLoadError, `expected LessonsLoadError, got ${e.constructor.name}`);
        return true;
      }
    );
    assert.ok(errors.length > 0, 'expected at least one console.error call');
    assert.ok(errors.some(m => m.includes('not found')), `expected "not found" in error log, got: ${errors.join('; ')}`);
  } finally {
    console.error = origError;
  }
});

await test('LDR-02  malformed JSON — throws LessonsLoadError and logs error', async () => {
  const p = tmpPath('malformed');
  writeJson(p, '{ not valid json }');

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    assert.throws(
      () => loadPublishedTopicsFrom(p),
      (e) => {
        assert.ok(e instanceof LessonsLoadError, `expected LessonsLoadError, got ${e.constructor.name}`);
        return true;
      }
    );
    assert.ok(errors.some(m => m.includes('not valid JSON')), `expected "not valid JSON" in error log, got: ${errors.join('; ')}`);
  } finally {
    console.error = origError;
    cleanup(p);
  }
});

await test('LDR-03  topics not an array — throws LessonsLoadError and logs error', async () => {
  const p = tmpPath('badstructure');
  writeJson(p, { data: [] }); // valid JSON, wrong structure

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    assert.throws(
      () => loadPublishedTopicsFrom(p),
      (e) => {
        assert.ok(e instanceof LessonsLoadError, `expected LessonsLoadError, got ${e.constructor.name}`);
        return true;
      }
    );
    assert.ok(errors.some(m => m.includes('"topics" array')), `expected '"topics" array' in error log, got: ${errors.join('; ')}`);
  } finally {
    console.error = origError;
    cleanup(p);
  }
});

await test('LDR-04  valid JSON with empty topics array — returns []', async () => {
  const p = tmpPath('empty');
  writeJson(p, { topics: [] });
  try {
    const result = loadPublishedTopicsFrom(p);
    assert.deepStrictEqual(result, []);
  } finally {
    cleanup(p);
  }
});

await test('LDR-05  published and unpublished topics — returns only published with full structure', async () => {
  const p = tmpPath('mixed');
  const published = {
    id:        'topic-gcf-01',
    title:     'Giving Constructive Feedback',
    published: true,
    sections:  [
      { sectionType: 'content', body: '<p>Introduction</p>' },
      { sectionType: 'reflect', reflectionPrompt: 'Think about a recent feedback conversation.' },
      {
        sectionType:       'practice',
        practicePrompt:    'You are about to speak with Priya.',
        practiceCharacter: {
          name:            'Priya Kapoor',
          yearDescription: 'second-year APC candidate',
          pathway:         'Building Surveying',
          scenarioContext: 'Priya has missed two CPD deadlines.'
        }
      }
    ]
  };
  const draft = { id: 'topic-draft', title: 'Draft Topic', published: false, sections: [] };
  writeJson(p, { topics: [published, draft] });
  try {
    const result = loadPublishedTopicsFrom(p);
    assert.strictEqual(result.length, 1, 'expected exactly one published topic');
    const t = result[0];
    assert.strictEqual(t.id, 'topic-gcf-01');
    assert.strictEqual(t.title, 'Giving Constructive Feedback');
    assert.ok(Array.isArray(t.sections), 'sections must be an array');
    assert.strictEqual(t.sections.length, 3);
    // practiceCharacter is retained at load time for server-side use
    const practiceSection = t.sections.find(s => s.sectionType === 'practice');
    assert.ok(practiceSection, 'practice section must be present');
    assert.ok(practiceSection.practiceCharacter, 'practiceCharacter must be retained by loader');
    assert.strictEqual(practiceSection.practiceCharacter.name, 'Priya Kapoor');
  } finally {
    cleanup(p);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${passed}/${total} passed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ${f.label}: ${f.message}`);
  process.exitCode = 1;
}
