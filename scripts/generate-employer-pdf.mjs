// scripts/generate-employer-pdf.mjs
// Generates public/employer-guide.pdf from the live production page.
// Run: node scripts/generate-employer-pdf.mjs
// Requires: playwright (already in node_modules)

import { chromium } from '../node_modules/playwright/index.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT    = path.join(__dirname, '../public/employer-guide.pdf');
const SOURCE    = 'https://getcharteredai.com/employer-guide';

console.log('Launching headless Chromium…');
const browser = await chromium.launch();
const page    = await browser.newPage();

// Full-width viewport so layout matches the real site
await page.setViewportSize({ width: 1280, height: 900 });

console.log(`Loading ${SOURCE}`);
await page.goto(SOURCE, { waitUntil: 'networkidle', timeout: 30000 });

// PDF-specific overrides injected at render time — source HTML unchanged
await page.addStyleTag({ content: `
  /* Reveal all fade-in elements (IntersectionObserver does not fire in headless) */
  .fu { opacity: 1 !important; transform: none !important; transition: none !important; }

  /* Sticky nav becomes static so it does not repeat on every page */
  nav { position: static !important; }

  /* Keep cards and sections intact across page breaks */
  .pr-card, .jstep, .what-card, .value-point, .why-card,
  .why-card, .step, .dl-card, .closing-inner { page-break-inside: avoid; break-inside: avoid; }

  /* Avoid orphaned section headings */
  .lbl, .h2, h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
` });

// Short pause to let any deferred fonts/paints settle
await page.waitForTimeout(1500);

console.log(`Writing PDF → ${OUTPUT}`);
await page.pdf({
  path:            OUTPUT,
  format:          'A4',
  printBackground: true,           // preserve navy/dark backgrounds and card colours
  margin:          { top: '12mm', right: '14mm', bottom: '14mm', left: '14mm' },
});

await browser.close();
console.log('Done.');
