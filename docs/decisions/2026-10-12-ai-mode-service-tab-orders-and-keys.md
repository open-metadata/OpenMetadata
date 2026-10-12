# AI-mode service details built-in tabs own orders 40–50 and their keys are stable deep links

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Sai Vinay Potluri
- **Guard:** `ConnectionServiceDetailsPage.test.tsx` (category-specific tabs describe block)
- **Related:** #35270, #35278

## Context
The AI-mode service details page (`/connections/<category>/<fqn>/<tab>`) merges its built-in tabs
with tabs contributed through `SERVICE_DETAILS_TABS` (Collate adds its own) and sorts the merged list
by `order`. Neither side imports the other, so the order values and the tab keys are the only thing
both agree on. #35270 adds category-specific built-in tabs that classic service details already had.

## Decision
- Built-in tabs use these orders: Data Assets 40, Files 42, Spreadsheets 44, Data Model 45,
  Connection 50. Files and Spreadsheets appear only for drive services, Data Model only for
  dashboard services.
- A contributed tab picks an order outside these slots: below 40 to land before Data Assets, above
  50 to land after Connection, or a free value in between to sit among the built-ins.
- The built-in tab keys `dataAssets`, `files`, `spreadsheets`, `data-model` and `connection` are
  the deep-link segments under `/connections/<category>/<fqn>/`. They are stable; a contribution's
  key must differ from all of them.
- A deep link to a tab the service's category does not have falls back to the default tab.

## Consequences
Contributed tabs keep their positions as category-specific built-ins come and go. Renumbering a
built-in or renaming its key breaks downstream tab placement and bookmarked links silently, so do it
only together with the consumers and amend this record. A new built-in tab takes a free order in
40–50 and is added here.
