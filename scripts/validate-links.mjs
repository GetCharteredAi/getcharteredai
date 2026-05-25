import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const fnDir = path.join(root, 'netlify/functions');

const htmlFiles = fs.readdirSync(publicDir).filter((f) => f.endsWith('.html'));
const htmlSet = new Set(htmlFiles.map((f) => f.replace(/\.html$/, '')));
const pdfFiles = new Set(fs.readdirSync(publicDir).filter((f) => f.endsWith('.pdf')));

const hrefRe = /href=["'](\/[^"'#?]+)["']/g;
const missing = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
  let m;
  while ((m = hrefRe.exec(content)) !== null) {
    const href = m[1];
    if (href.startsWith('//') || href.includes('@')) continue;
    if (href.endsWith('.pdf')) {
      const name = path.basename(href);
      if (!pdfFiles.has(name)) missing.push({ from: file, href, reason: 'pdf missing' });
      continue;
    }
    const clean = href.replace(/^\//, '').replace(/\/$/, '');
    if (!clean) continue;
    const htmlName = clean.endsWith('.html') ? clean : `${clean}.html`;
    const slug = htmlName.replace(/\.html$/, '');
    if (slug === 'index' && href === '/') continue;
    if (!htmlSet.has(slug) && !fs.existsSync(path.join(publicDir, htmlName))) {
      missing.push({ from: file, href });
    }
  }
}

const fnRe = /\.netlify\/functions\/([a-z0-9-]+)/g;
const fnFiles = new Set(fs.readdirSync(fnDir).map((f) => f.replace(/\.js$/, '')));
const fnMissing = new Set();

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
  let m;
  while ((m = fnRe.exec(content)) !== null) {
    if (!fnFiles.has(m[1])) fnMissing.add(m[1]);
  }
}

console.log('LINK_CHECK:', missing.length === 0 ? 'PASS' : `FAIL (${missing.length})`);
if (missing.length) console.log(JSON.stringify(missing.slice(0, 30), null, 2));
console.log('FUNCTION_CHECK:', fnMissing.size === 0 ? 'PASS' : `FAIL ${[...fnMissing].join(', ')}`);
process.exit(missing.length || fnMissing.size ? 1 : 0);
