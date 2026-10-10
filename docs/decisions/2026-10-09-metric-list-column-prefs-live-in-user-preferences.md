# Metric list column visibility lives in the user-preferences store under `metricList`

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** @anuj-kumary
- **Guard:** reviewer — no test pins the key; renaming it resets every user's columns silently
- **Related:** #26777, #35022

## Context

The Metrics list moved onto `TableV2`, whose Customize menu owns column visibility for every table
that passes it an `entityType`. Before the move the list kept its own copy of that state in
`localStorage` under `metricsList.columnPrefs.v2`, written by a hand-rolled column menu. Keeping
both would leave two sources of truth for one setting, and the card view, which has no Customize
menu of its own, would read whichever one the table did not write.

## Decision

- Metric list column visibility is stored in `preferences.selectedEntityTableColumns.metricList`
  of the user-preferences store (`useCurrentUserPreferences`), the key being
  `METRIC_TABLE_PREFERENCE_KEY` in `MetricListPage.tsx`, passed to `TableV2` as `entityType`.
- `TableV2`'s Customize menu is the only writer. The table view and the card view both read it, so
  hiding a column hides it in both.
- The store is persisted on-device (`localStorage` key `user-preferences-store`, partitioned by
  user name). `selectedEntityTableColumns` is not in `BACKEND_SYNCED_KEYS`, so the choice is per
  user **per browser**, not per account.
- The legacy key `metricsList.columnPrefs.v2` is abandoned without migration: each user sees the
  default columns once after upgrade. The view-mode key `metricsList.viewMode.v1` is unaffected.

## Consequences

- One source of truth, shared with every other `TableV2` table and its existing customize UX.
- Changing `METRIC_TABLE_PREFERENCE_KEY`, or the `entityType` passed to `TableV2`, silently resets
  every user's saved columns. Such a change needs a migration or a superseding record.
- A migration from the legacy key was judged not worth carrying: the cost is one reset to defaults.
  Revisit if column choices start syncing to the backend, at which point the key becomes a server
  contract.
