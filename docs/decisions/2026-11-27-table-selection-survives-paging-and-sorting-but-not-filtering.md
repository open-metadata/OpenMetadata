# A bulk-action table's row selection survives paging and sorting but not filtering

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** UI maintainers
- **Guard:** `IngestinoPipelineList.test.tsx`, `MetricListPage.test.tsx` (selection-on-page/sort/filter cases)
- **Related:** openmetadata-collate#8369, #35635

## Context
Bulk-action tables disagreed: the ingestion pipeline list kept its ticks across pages yet resolved
its bulk re-deploy against the current page only, so ticks made on another page were silently
skipped while the toast reported success; the metric list cleared ticks on every page change.

## Decision
This applies to tables whose selection feeds a bulk action (re-deploy, bulk edit, bulk delete).
- **Paging and sorting keep the selection.** A bulk action acts on every ticked row, including
  rows not on the current page, so the selection must hold the selected records (or resolve them),
  never re-derive them from the rendered page. Collapsing a hierarchy group counts as paging.
- **Changing a filter or search clears the selection.** A filter redefines the result set, and a
  selection that outlives it can include rows the user can no longer see in that set.
- A table may hide its filter controls while rows are selected (the metric list does); that
  satisfies the rule without an explicit clear.
- Tables use TableV2 `rowSelection.preserveSelectedRowKeys: true` so toggling a row on one page
  keeps the keys from other pages.

**Form pickers are excluded.** When the selection is the value a form saves (the data contract
Schema and Quality tabs), it survives filtering too: clearing it would delete saved entries on the
next save (#35635).

## Consequences
Bulk actions must handle records that are not loaded: the metric bulk delete fetches parent links
for off-page selections before choosing which recursive deletes to send. Revisit if a bulk-action
table needs selections that survive a filter, for example a "select across filters" basket.
