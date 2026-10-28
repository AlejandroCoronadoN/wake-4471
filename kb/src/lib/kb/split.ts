// Splits one big ticket into the problems it really holds. Pages explain it; this file is what runs.
//
// The desk's rule (causes.ts) places every report by tenant and channel: `parser` or `hint`.
// The desk also keeps a list of reports it read as something else (desk-notes.json, `oneDayMove`).
// causes.ts counts those where they are filed and footnotes them. This file keeps the desk's count
// as exported, and gives the footnote a row of its own, so it can have a ticket of its own.
import { causeOf, uniqueById, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'one-day-move' | 'unplaced';
export const PROBLEMS: readonly Problem[] = ['parser', 'hint', 'one-day-move', 'unplaced'];

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  taggedAs: Record<string, number>;
  tenants: number;
  channels: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // Set when the desk counts these reports inside another row (the desk's view, as exported).
  countedIn?: Problem;
};

export function splitTicket(
  reports: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  readAsOneDay: readonly string[],
): ProblemGroup[] {
  const merged = uniqueById(reports).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p: Problem = causeOf(r, tenantOf(r)) ?? 'unplaced';
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const oneDay = merged.filter((r) => readAsOneDay.includes(r.id));
  if (oneDay.length) by.set('one-day-move', oneDay);
  const tally = (rs: Report[], key: (r: Report) => string) =>
    rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});
  return PROBLEMS.filter((p) => by.has(p)).map((problem) => {
    const rs = by.get(problem)!;
    const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
    return {
      problem,
      reports: rs,
      taggedAs: tally(rs, (r) => r.meta.intakeTag),
      tenants: new Set(rs.map((r) => r.tenant)).size,
      channels: tally(rs, (r) => r.channel),
      firstSeen: days[0],
      lastSeen: days[days.length - 1],
      ...(problem === 'one-day-move' ? { countedIn: (causeOf(rs[0], tenantOf(rs[0])) ?? 'unplaced') as Problem } : {}),
    };
  });
}

// The cause rows must add up to the ticket. If they do not, the page is lying and should not build.
export function assertPartition(groups: ProblemGroup[], reports: Report[], ticket: number): void {
  const total = groups.filter((g) => !g.countedIn).reduce((n, g) => n + g.reports.length, 0);
  const merged = uniqueById(reports).filter((r) => r.mergedInto === ticket).length;
  if (total !== merged) throw new Error(`#${ticket}: ${total} reports in rows, ${merged} merged`);
}
