// Renders every widget variant with the browser shim and saves a gallery PNG.
// Usage (needs playwright-core + Chrome): node render.mjs <out.png> [ru]
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = process.env.SAILAU_WIDGET_PREVIEW_DIR || path.dirname(fileURLToPath(import.meta.url));
const shim = fs.readFileSync(path.join(here, 'shim.js'), 'utf8');
const script = fs.readFileSync(path.join(here, '..', 'Sailau Widget.js'), 'utf8');
const out = process.argv[2] || path.join(here, 'widgets-preview.png');
const lang = process.argv[3] === 'ru' ? ' ru' : '';

const CELLS = [
  ['today', 'small'], ['kassa', 'small'], ['stock', 'small'], ['reminders', 'small'],
  ['today', 'medium'], ['boxes', 'medium'], ['kassa', 'medium'], ['week', 'medium'], ['stock', 'medium'], ['reminders', 'medium'],
  ['dash', 'large'], ['today', 'large'], ['week', 'large'],
  ['today', 'accessoryCircular'], ['today', 'accessoryRectangular'], ['today', 'accessoryInline'],
];

const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL@20..48,500,1&display=block" rel="stylesheet">
<style>body{margin:0;padding:28px;background:linear-gradient(160deg,#3a4a5c,#1b2430);font-family:Nunito,sans-serif;display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start;width:1240px}
.cell{display:flex;flex-direction:column;gap:8px;align-items:flex-start}.cap{color:#dfe7ee;font:600 13px Nunito}.lock{background:#000;padding:10px;border-radius:16px}</style>
<body></body>`;

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
await p.addScriptTag({ content: shim });
for (const [kind, family] of CELLS) {
  await p.evaluate(async ({ kind, family, script, lang }) => {
    window.args = { widgetParameter: `${kind} demo${lang}` };
    window.config = { widgetFamily: family, runsInWidget: true, runsInApp: false };
    window.__out = null;
    const fn = new Function(`return (async () => { ${script.replace(/^\/\/.*$/gm, '')} })();`);
    await fn();
    const cell = document.createElement('div');
    cell.className = 'cell';
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = `${kind} · ${family}`;
    cell.appendChild(cap);
    const wrap = document.createElement('div');
    if (family.startsWith('accessory')) wrap.className = 'lock';
    wrap.appendChild(window.__out);
    cell.appendChild(wrap);
    document.body.appendChild(cell);
  }, { kind, family, script, lang });
}
await p.waitForTimeout(1500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('saved', out);
