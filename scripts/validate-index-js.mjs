import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'public', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

const stripeMarker = '<script src="https://js.stripe.com';
const stripeIdx = html.indexOf(stripeMarker);
if (stripeIdx === -1) {
  console.error('INDEX_JS_CHECK: FAIL — Stripe script tag not found');
  process.exit(1);
}

const scriptStart = html.indexOf('<script>', stripeIdx);
const scriptEnd = html.lastIndexOf('</script>');
if (scriptStart === -1 || scriptEnd === -1 || scriptEnd <= scriptStart) {
  console.error('INDEX_JS_CHECK: FAIL — inline script block not found');
  process.exit(1);
}

const js = html.slice(scriptStart + '<script>'.length, scriptEnd);

try {
  new Function(js);
  console.log('INDEX_JS_CHECK: PASS');
} catch (err) {
  console.error('INDEX_JS_CHECK: FAIL —', err.message);
  process.exit(1);
}
