#!/usr/bin/env node
// Splits support ticket #4471 into the problems it really holds.
// Runs the kb's own rule (support-kb/src/lib/kb/causes.ts, ported 1:1) over the export,
// and keeps the desk's own view of the five one-day moves (desk-notes.json): counted in parser, footnoted, here also a row.
//
// usage: node tools/split-4471.mjs <path-to-unzipped>/support-kb > tools/split-4471.json
// Read-only. Needs Node 20+. No dependencies.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) { console.error('usage: node tools/split-4471.mjs <support-kb dir>'); process.exit(2); }
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const reports = read('src/lib/data/reports-4471.json');
const notes = read('src/lib/data/desk-notes.json');
const tdir = path.join(root, 'src/lib/data/tenants');
const tenants = fs.readdirSync(tdir).map((f) => read(`src/lib/data/tenants/${f}`));
const byHandle = new Map(tenants.map((t) => [t.handle, t]));

// --- causes.ts, ported ---------------------------------------------------------------
const DATE_HINT = { 'booking-v2': 'DD/MM/YYYY', 'booking-v3': 'MM/DD/YYYY' };
function dayFirst(locale) {
  const order = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.UTC(2026, 0, 2, 12)))
    .map((p) => p.type);
  return order.indexOf('day') < order.indexOf('month');
}
function causeOf(r, t) {
  if (!t || !dayFirst(t.locale)) return null;
  return r.channel === 'form' && DATE_HINT[t.form].startsWith('MM') ? 'hint' : 'parser';
}
const uniqueById = (rs) => [...new Map(rs.map((r) => [r.id, r])).values()];
// -------------------------------------------------------------------------------------

const unique = uniqueById(reports);
const merged = unique.filter((r) => r.mergedInto === 4471);
const oneDay = new Set(notes.oneDayMove);

const problems = { parser: [], hint: [], unplaced: [] };
for (const r of merged) problems[causeOf(r, byHandle.get(r.tenant)) ?? 'unplaced'].push(r);
// The desk's view, as exported: the one-day moves stay counted where they are filed (parser) and
// are footnoted (causes.ts readAs). They get a row and a ticket of their own, counted the desk's way.
problems['one-day-move'] = merged.filter((r) => oneDay.has(r.id));

const count = (rs, f) => rs.reduce((n, r) => ((n[f(r)] = (n[f(r)] ?? 0) + 1), n), {});
const summary = (rs) => {
  const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
  return {
    reports: rs.length,
    firstSeen: days[0] ?? null,
    lastSeen: days[days.length - 1] ?? null,
    tenants: count(rs, (r) => r.tenant),
    channels: count(rs, (r) => r.channel),
    intakeTaggedAs: count(rs, (r) => r.meta.intakeTag),
    ids: rs.map((r) => r.id),
  };
};

const out = {
  source: { rows: reports.length, uniqueIds: unique.length, duplicateRows: reports.length - unique.length, mergedInto4471: merged.length },
  // What the kb's CauseTable prints today (its rule alone, one-day moves counted where filed).
  kbRuleAlone: { parser: merged.filter((r) => causeOf(r, byHandle.get(r.tenant)) === 'parser').length, hint: merged.filter((r) => causeOf(r, byHandle.get(r.tenant)) === 'hint').length },
  problems: Object.fromEntries(Object.entries(problems).filter(([, rs]) => rs.length).map(([k, rs]) => [k, summary(rs)])),
  intakeDisagreements: count(merged.filter((r) => { const c = causeOf(r, byHandle.get(r.tenant)); return c && c !== r.meta.intakeTag; }), (r) => `${r.meta.intakeTag}→${causeOf(r, byHandle.get(r.tenant))}`),
  duplicateIds: [...new Set(reports.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i))],
};
const placed = (out.problems.parser?.reports ?? 0) + (out.problems.hint?.reports ?? 0) + (out.problems.unplaced?.reports ?? 0);
if (placed !== merged.length) throw new Error(`cause rows lost reports: ${placed} != ${merged.length}`);
out.problems['one-day-move'].countedIn = 'parser';
console.log(JSON.stringify(out, null, 2));
