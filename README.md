# wake-4471 — what #4471 shows

Support ticket **#4471** ("dates parse mm/dd in eu locales") holds 412 merged reports and is
marked *known: one issue, one fix queued*. Read report by report, it holds **three problems**.
This repo files one ticket per problem (the issues here) and adds a signed page about them to
the support desk's knowledge base (kb).

Made for MEGA.dev Challenge S01E03 "what it shows". The kb export belongs to the support desk,
a team in the course story, and is not copied here; the tools take its path as an argument.

## The split

| problem | reports | what it is | ticket |
|---|---:|---|---|
| `parser` | 379 | the shared parser reads every date month first; all tenants write the day first | [#1](https://github.com/AlejandroCoronadoN/wake-4471/issues/1) |
| `hint` | 33 | `booking-v3` prints `MM/DD/YYYY` under the date field; people obey it, the form reads day first | [#2](https://github.com/AlejandroCoronadoN/wake-4471/issues/2) |
| `one-day-move` | 5 | the day shifts by one, the month does not: a date treated as an instant, crossing midnight | [#3](https://github.com/AlejandroCoronadoN/wake-4471/issues/3) |

379 + 33 = 412 by cause; the 5 one-day moves are counted inside `parser` by the desk (as exported) and have a ticket of their own. The export has 427 rows; 15 are duplicate ids from overlapping export pages.

## How the numbers are made

- `tools/split-4471.mjs` ports the kb's own rule (`src/lib/kb/causes.ts`: place a report by its
  tenant's locale and booking form, never by intake's browser guess) and keeps the desk's own view
  of the five one-day moves (`src/lib/data/desk-notes.json`): counted in `parser`, footnoted, here a row.
- `tools/split-4471.json` is its output: counts per problem by tenant, channel and intake tag,
  and every report id.
- The kb's current `CauseTable` prints 379 / 33 with a footnote of 5. The counts here are the same,
  the desk's view as exported; the footnote becomes a row with a ticket of its own.

```
node tools/split-4471.mjs <support-kb dir> > tools/split-4471.json
node tools/render.mjs kb/src/routes/kb/incidents/4471-what-it-shows/+page.svx tools/split-4471.json > rendered/4471-what-it-shows.html
```

## The kb page

- `kb/src/routes/kb/incidents/4471-what-it-shows/+page.svx` — the page, signed as the kb's
  README asks: `signature:` in the frontmatter, `<RenderStamp {signature} />` at the end.
- `kb/src/lib/kb/split.ts` and `kb/src/lib/kb/SplitTable.svelte` — the logic and the table the
  page uses. Words in the page, numbers in a component, as the kb's conventions say.
- `rendered/4471-what-it-shows.html` — the page as the desk will see it, with the tables built
  from the data and the desk ref printed from the signature.

Drop the `kb/src` tree onto the export's `src/` to add the page to the kb.
