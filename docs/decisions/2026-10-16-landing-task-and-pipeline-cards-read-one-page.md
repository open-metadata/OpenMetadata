# The My Tasks and Pipeline Status cards read one page, and say so where it shows

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial) · v2 2026-10-23 (the My Tasks notice moves to the card footer)
- **Deciders:** Landing page owners
- **Guard:** `useMyTasks.test.tsx`, `MyTasksWidget.test.tsx` ("says how much of the total the page holds, under every chip"), `usePipelineStatus.test.tsx`
- **Related:** ADR:2026-10-16-landing-overview-cards-match-the-pages-they-open

## Context

Both cards summarise lists that can be long. `/tasks/assigned` — the only endpoint that resolves a
viewer's teams server-side, so a task assigned to their team shows up as it does in the inbox —
cannot filter by category, so the card cannot ask the server how many open tasks fall in each
bucket. The pipeline status endpoint can filter by state and returns a total per request, but
requires a time window.

## Decision

- **My Tasks** reads one page of `MY_TASKS_PAGE_SIZE = 100` open tasks from `/tasks/assigned`.
  "All" is the server's total; the Incidents, Access and Approvals chips and the incident headline
  are counted over that page. When the total exceeds the page, the card says "Showing N of M", so
  a bucket count that covers only the loaded tasks is never presented as the whole.
- **Pipeline Status** chip counts are the server's per-bucket totals (one request per state). Only
  the rows are capped — `PIPELINE_STATUS_PAGE_SIZE = 10` per bucket — and runs are read from the
  last `PIPELINE_RUN_WINDOW_DAYS = 30` days, enough for ten runs of anything scheduled at least
  every three days.

## Consequences

- A viewer with more than 100 open tasks sees bucket counts for the loaded page, labelled as such;
  the inbox the footer opens holds the rest.
- A pipeline whose last run is older than 30 days shows no run history on the card.
- Revisit My Tasks when `/tasks/assigned` can count or filter by category: the chips should then
  become server totals like Pipeline Status's.

## Amendment — v2: the My Tasks notice moves to the card footer

The landing page design review (Set 4) removed the strip above the rows that carried "N of M
loaded" and its select-all checkbox. The notice now sits in the card footer as the loaded and total
counts ("100/250 Tasks"), under every chip including All, whenever the total exceeds the page.
