// UI audit: opens every tab, lesson and simulator in headless Chrome at one width and reports
// console errors, horizontal overflow, wrapped or small code, targets under 44px, expanded solutions,
// forbidden words, and missing lesson sections. Needs `npx vite preview --port 4173` running.
// Usage: node scripts/audit-ui.mjs 380 && node scripts/audit-ui.mjs 1280
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const width = Number(process.argv[2] || 380);
const root = process.cwd();
const mods = readdirSync(`${root}/content/modules`).map((f) => JSON.parse(readFileSync(`${root}/content/modules/${f}`, 'utf8')));
const lessons = mods.filter((m) => m.lesson);
const sims = ['event-loop','join-fanout','btree-walk','lock-race','idempotent-retry','cache-stampede','react-race','vue-reactivity','lru-cache','queue-backoff','tenant-isolation','design-canvas'];
const tabs = ['', 'learn', 'learn/sql', 'practice', 'practice/sql-indexes', 'drill', 'interview', 'mock', 'more', 'more/progress', 'more/settings', 'more/stories', 'more/glossary', 'more/cheatsheets', 'more/cheatsheets/sql', 'more/canvas', 'more/simulators'];
const routes = [
  ...tabs.map((r) => ({ r, kind: 'tab' })),
  ...lessons.map((m) => ({ r: `learn/${m.track}/${m.id}`, kind: 'lesson', m })),
  ...sims.map((id) => ({ r: `more/simulators/${id}`, kind: 'sim' })),
];
const port = 9340 + (width % 7);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/prep-audit-profile-${width}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); let errs = [];
async function connect() { for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://localhost:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {} await sleep(300); } throw new Error('no chrome'); }
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws = new WebSocket(await connect()); await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || '').slice(0, 120)); else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push(d.params.args.map((a) => a.value || a.description).join(' ').slice(0, 160)); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });

const CHECK = `(() => {
  const out = { text: document.body.innerText, scrollW: document.documentElement.scrollWidth, pres: [], smallCode: [], smallBtns: [], hideSolutions: 0, showSolutions: 0, bad: [] };
  for (const pre of document.querySelectorAll('pre')) {
    const cs = getComputedStyle(pre);
    if (cs.display === 'none') continue;
    if (cs.whiteSpace !== 'pre') out.pres.push((cs.whiteSpace) + ':' + pre.innerText.slice(0, 40).replace(/\\n/g, ' '));
    if (parseFloat(cs.fontSize) < 13.5) out.smallCode.push(cs.fontSize + ':' + pre.innerText.slice(0, 30));
    if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') out.bad.push('pre overflow ' + cs.overflowX);
  }
  for (const c of document.querySelectorAll('code')) { const cs = getComputedStyle(c); if (parseFloat(cs.fontSize) < 13.5 && c.offsetParent) out.smallCode.push('code ' + cs.fontSize + ':' + c.innerText.slice(0, 20)); }
  for (const b of document.querySelectorAll('button, a[href]')) { const r = b.getBoundingClientRect(); if (r.height > 0 && r.height < 44 && b.offsetParent && !b.closest('.prose')) out.smallBtns.push(Math.round(r.height) + ':' + b.textContent.trim().slice(0, 18)); }
  out.hideSolutions = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Hide solution').length;
  out.showSolutions = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Show solution').length;
  return out;
})()`;

const findings = [];
for (const { r, kind, m } of routes) {
  errs = [];
  await send('Page.navigate', { url: `http://localhost:4173/prep-platform/${r}` });
  await sleep(kind === 'sim' ? 3500 : 2200);
  const res = await send('Runtime.evaluate', { expression: CHECK, returnByValue: true });
  const o = res?.result?.value;
  const f = [];
  if (!o) { findings.push({ r, f: ['no result (page did not evaluate)'] }); continue; }
  if (errs.length) f.push('console: ' + errs.slice(0, 2).join(' | '));
  if (o.scrollW > width) f.push(`overflow ${o.scrollW}>${width}`);
  if (o.pres.length && !r.startsWith('mock') && !r.startsWith('more/progress')) f.push('wrapped pre: ' + o.pres.slice(0, 2).join(' ; '));
  if (o.smallCode.length) f.push('code <13.5px: ' + o.smallCode.slice(0, 2).join(' ; '));
  if (o.smallBtns.length) f.push('targets <44: ' + o.smallBtns.slice(0, 4).join(' ; '));
  if (o.hideSolutions) f.push('a solution is expanded by default');
  if (/\bclaude\b/i.test(o.text)) f.push('mentions Claude');
  if (/\[object Object\]|\bNaN\b|\bundefined\b/.test(o.text) && kind !== 'sim') f.push('rendering artefact: ' + o.text.match(/[^\n]*(\[object Object\]|NaN|undefined)[^\n]*/)?.[0].slice(0, 80));
  if (kind === 'lesson') {
    const L = m.lesson;
    const need = [['CONCEPT', true], ['PICTURE IT', !!L.picture], ['THE SITUATION', !!L.problem], ['REMEMBER THIS', !!L.hook], ['বাংলা সারসংক্ষেপ', true], ['WHAT CHANGED ACROSS VERSIONS', (L.versions || []).length > 0], ['ACROSS STACKS', (L.crossStack || []).length > 0], ['TRY IT', !!L.simulator], ['OFFICIAL DOCS', (L.docs || []).length > 0], ['THE WRONG WAY', !!L.wrong], [L.wrong ? 'THE RIGHT WAY' : 'CODE', !!L.right], ['Practice', (m.practice || []).length > 0], ['Interview questions', (m.interview || []).length > 0], ['My notes', true]];
    for (const [label, req] of need) if (req && !o.text.includes(label)) f.push('missing section: ' + label);
    if (L.bn && !o.text.includes(L.bn.slice(0, 20))) f.push('Bangla summary text not rendered');
    if (o.showSolutions !== (m.practice || []).length) f.push(`solutions: ${o.showSolutions} Show buttons for ${(m.practice || []).length} tasks`);
    if (L.simulator && !o.text.includes('What do you think will happen?')) f.push('simulator did not render its predict prompt');
  }
  if (kind === 'sim' && r !== 'more/simulators/design-canvas' && !o.text.includes('What do you think will happen?')) f.push('predict prompt missing');
  if (f.length) findings.push({ r, f });
}
console.log(`=== width ${width}: ${routes.length} routes, ${findings.length} with findings`);
for (const x of findings) console.log(`- /${x.r}\n    ${x.f.join('\n    ')}`);
chrome.kill(); process.exit(0);
