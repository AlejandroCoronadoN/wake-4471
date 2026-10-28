#!/usr/bin/env node
// Renders the page as the desk will see it: the runbook frame, the tables built from data,
// the desk ref derived from the signature. No SvelteKit needed, so anyone can read it.
//
// usage: node tools/render.mjs kb/src/routes/kb/incidents/4471-what-it-shows/+page.svx tools/split-4471.json > rendered/4471-what-it-shows.html
import fs from 'node:fs';

const [svxPath, splitPath] = process.argv.slice(2);
const svx = fs.readFileSync(svxPath, 'utf8');
const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));

// --- frontmatter -------------------------------------------------------------------
const fm = Object.fromEntries(
  svx.split('---')[1].trim().split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^'|'$/g, '')]; }),
);
const filed = Object.fromEntries([...svx.matchAll(/^\s*'?([a-z-]+)'?: '([^']*)',?$/gm)].map((m) => [m[1], m[2]]));

// --- desk-ref.ts, ported -----------------------------------------------------------------
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const fnv1a = (t, seed) => { let h = seed >>> 0; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const deskRef = (s) => { const t = s.trim(); const a = fnv1a(t, 0x811c9dc5), b = fnv1a(t, 0x9e3779b9); let bits = (BigInt(a) << 8n) | BigInt(b & 0xff); let out = ''; for (let i = 0; i < 8; i++) { out = ALPHABET[Number(bits & 31n)] + out; bits >>= 5n; } return `DR-${out.slice(0, 4)}-${out.slice(4)}`; };

// --- staleness.ts, ported -----------------------------------------------------------------
const STALE_AFTER_DAYS = 180;
const age = Math.floor((Date.now() - Date.parse(fm.reviewed)) / 86_400_000);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const list = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(' · ');
const issueLabel = (u) => (u && !u.startsWith('__') ? `<a href="${u}">#${u.split('/').pop()}</a>` : 'none yet');

const splitTable = () => {
  const rows = Object.entries(split.problems).map(([p, g]) => `<tr><td><code>${p}</code></td><td>${g.reports}</td><td class="tags">${list(g.intakeTaggedAs)}</td><td class="tags">${list(g.channels)}</td><td>${Object.keys(g.tenants).length}</td><td>${g.firstSeen} → ${g.lastSeen}</td><td>${issueLabel(filed[p])}</td></tr>`).join('\n');
  const total = Object.values(split.problems).filter((g) => !g.countedIn).reduce((n, g) => n + g.reports, 0);
  const foot = Object.entries(split.problems).filter(([, g]) => g.countedIn).map(([p, g]) => `<p class="note">${g.reports} reports read as a <code>${p}</code>: the desk counts them in <code>${g.countedIn}</code>, as exported; they have a ticket of their own.</p>`).join("\n");
  return `<p class="sum"><strong>${total}</strong> reports merged into #4471 · <strong>${Object.keys(split.problems).length}</strong> problems</p>
<table><thead><tr><th>problem</th><th>reports</th><th>tagged at intake as</th><th>via</th><th>tenants</th><th>seen</th><th>ticket</th></tr></thead><tbody>
${rows}
</tbody></table>
${foot}`;
};
const causeTable = () => {
  const k = split.kbRuleAlone;
  const p = split.problems.parser, h = split.problems.hint, o = split.problems['one-day-move'];
  return `<p class="sum"><strong>${k.parser + k.hint}</strong> reports merged into #4471 · <strong>2</strong> causes</p>
<table><thead><tr><th>cause</th><th>reports</th><th>tagged as</th><th>tenants</th><th>seen</th><th></th></tr></thead><tbody>
<tr><td><code>parser</code></td><td>${k.parser}</td><td class="tags">${list(p.intakeTaggedAs)}</td><td>${Object.keys(p.tenants).length}</td><td>${p.firstSeen} → ${p.lastSeen}</td><td>#4471</td></tr>
<tr class="wrong"><td><code>hint</code></td><td>${k.hint}</td><td class="tags">${list(h.intakeTaggedAs)}</td><td>${Object.keys(h.tenants).length}</td><td>${h.firstSeen} → ${h.lastSeen}</td><td>not this ticket — no ticket of its own</td></tr>
</tbody></table>
<p class="note">${o?.reports ?? 0} reports read as a one-day move; filed under <code>parser</code> by tenant.</p>`;
};

// --- body: svx markdown → html (the subset this page uses) ----------------------------------
let body = svx.split('---').slice(2).join('---');
body = body.replace(/<script>[\s\S]*?<\/script>/, '');
body = body.replace(/<SplitTable[^>]*\/>/, splitTable());
body = body.replace(/<CauseTable[^>]*\/>/, causeTable());
body = body.replace(/<RenderStamp[^>]*\/>/, `<p class="stamp">desk ref <b>${deskRef(fm.signature)}</b></p>`);
body = body.replace(/<Callout kind="warn">([\s\S]*?)<\/Callout>/g, (_, t) => `<aside class="warn">${t.trim()}</aside>`);
body = body.replace(/<Callout>([\s\S]*?)<\/Callout>/g, (_, t) => `<aside class="note">${t.trim()}</aside>`);
const inline = (s) => s
  .replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
const html = body.split(/\n{2,}/).map((block) => {
  const b = block.trim();
  if (!b) return '';
  if (b.startsWith('<')) return b;
  if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
  if (/^\d+\. /.test(b)) return `<ol>${b.split(/\n(?=\d+\. )/).map((li) => `<li>${inline(li.replace(/^\d+\. /, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</ol>`;
  if (b.startsWith('- ')) return `<ul>${b.split(/\n(?=- )/).map((li) => `<li>${inline(li.slice(2).replace(/\n\s+/g, ' '))}</li>`).join('')}</ul>`;
  return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
}).join('\n');

process.stdout.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fm.title)} · support kb</title>
<style>
:root { --bg: #fbfaf7; --fg: #1d1d1b; --muted: #6b6a66; --line: #e3e0d8; --accent: #2f6f5e; --warn: #b4501f; --warn-bg: #fbeee6; --note-bg: #eef5f2; --mono: ui-monospace, 'Cascadia Code', Menlo, monospace; }
@media (prefers-color-scheme: dark) { :root { --bg: #171716; --fg: #ecebe6; --muted: #9c9a93; --line: #34332f; --accent: #6fbfa6; --warn: #f0905d; --warn-bg: #3a2418; --note-bg: #1d2c27; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
.kb table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92rem; }
.kb th, .kb td { border-bottom: 1px solid var(--line); padding: 0.35rem 0.5rem; text-align: left; }
.kb code { font-family: var(--mono); font-size: 0.88em; }
.kb a { color: var(--accent); }
.kb { max-width: 760px; margin: 0 auto; padding: 2rem 16px 4rem; }
.crumb { font: 0.8rem var(--mono); text-decoration: none; color: var(--muted); }
h1 { margin: 0.25rem 0 0.5rem; line-height: 1.2; }
.meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; color: var(--muted); font-size: 0.85rem; margin: 0; }
.status { border: 1px solid var(--line); border-radius: 99px; padding: 0 0.6rem; }
footer { margin-top: 3rem; color: var(--muted); font-size: 0.8rem; border-top: 1px solid var(--line); padding-top: 1rem; }
aside { border-left: 4px solid var(--accent); padding: 0.5rem 1rem; margin: 1rem 0; background: var(--note-bg); }
aside.warn { border-color: var(--warn); background: var(--warn-bg); }
.sum { font-size: 1.1rem; } .tags, .note { color: var(--muted); font-size: 0.85em; }
.wrong td { background: var(--warn-bg); } .wrong td:last-child { color: var(--warn); font-weight: 600; }
.stamp { margin: 2rem 0 0; font: 0.85rem var(--mono); color: var(--muted); } .stamp b { color: var(--accent); letter-spacing: 0.04em; }
</style></head>
<body><div class="kb">
<header>
<a class="crumb" href="/kb">support desk · kb</a>
<h1>${esc(fm.title)}</h1>
<p class="meta"><span>owner <b>${esc(fm.owner)}</b></span><span class="status ${fm.status}">${fm.status}</span><span>reviewed ${fm.reviewed} · ${age} days ago${age > STALE_AFTER_DAYS ? ' · stale' : ''}</span></p>
</header>
<main>
${html}
</main>
<footer>Pages are written by people. Tables and charts are built from data at render time.</footer>
</div></body></html>
`);
