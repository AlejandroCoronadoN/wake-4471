<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { type Report } from '#lib/kb/causes';
  import { assertPartition, splitTicket } from '#lib/kb/split';
  import { tenantOf } from '#lib/kb/locales';

  // One row per problem inside a ticket, with the ticket each row now has.
  let { ticket, filed = {} }: { ticket: number; filed?: Record<string, string> } = $props();

  const groups = $derived(splitTicket(reports as Report[], ticket, tenantOf, notes.oneDayMove));
  $effect(() => assertPartition(groups, reports as Report[], ticket));
  const total = $derived(groups.filter((g) => !g.countedIn).reduce((n, g) => n + g.reports.length, 0));
  const list = (o: Record<string, number>) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ×${n}`)
      .join(' · ');
</script>

<p class="sum">
  <strong>{total}</strong> reports merged into #{ticket} ·
  <strong>{groups.length}</strong> {groups.length === 1 ? 'problem' : 'problems'}
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>tagged at intake as</th><th>via</th><th>tenants</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each groups as g (g.problem)}
      <tr>
        <td><code>{g.problem}</code></td>
        <td>{g.reports.length}</td>
        <td class="tags">{list(g.taggedAs)}</td>
        <td class="tags">{list(g.channels)}</td>
        <td>{g.tenants}</td>
        <td>{g.firstSeen} → {g.lastSeen}</td>
        <td>{#if filed[g.problem]}<a href={filed[g.problem]}>{filed[g.problem].split('/').slice(-2).join('#').replace('issues#', '#')}</a>{:else}none yet{/if}</td>
      </tr>
    {/each}
  </tbody>
</table>

{#each groups.filter((g) => g.countedIn) as g (g.problem)}
  <p class="note">{g.reports.length} reports read as a <code>{g.problem}</code>: the desk counts them in <code>{g.countedIn}</code>, as exported; they have a ticket of their own.</p>
{/each}

<style>
  .sum { font-size: 1.1rem; }
  .tags, .note { color: var(--muted); font-size: 0.85em; }
</style>
