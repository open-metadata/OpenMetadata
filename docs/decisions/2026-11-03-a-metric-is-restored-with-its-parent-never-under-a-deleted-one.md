# A metric is restored with its parent, never on its own under a deleted one

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Anujkumar Yadav
- **Guard:** `MetricResourceIT#restore_childOfDeletedParent_isRejectedUntilTheParentIsRestored`,
  `MetricResourceIT#put_childOfDeletedParent_withoutParent_restoresItAsARoot`
- **Related:** `MetricRepository.validateRestore`, `EntityRepository.validateRestore`

## Context
A recursive soft delete of a metric deletes its whole subtree but keeps every `CONTAINS` edge, so
restoring the parent brings the subtree back. Restoring one child on its own left a live metric
whose parent edge still pointed at a deleted metric. Every path that resolves the parent then broke:
`GET /metrics/{id}/hierarchy` and every PATCH of the child returned 404 for the deleted parent, the
Metrics list hid the child (it is not a root, and its parent is not listed), and a recursive hard
delete of the old parent hard-deleted the live child with it.

## Decision
- `PUT /v1/metrics/restore` (sync or `?async=true`) for a metric whose parent is soft-deleted is
  rejected with 400, naming the parent to restore instead. Restoring that parent restores the
  subtree, as before.
- The check runs only on the restore endpoint, for the metric the request names
  (`EntityRepository.validateRestore`, called from `EntityResource.restoreEntity` and from the async
  pre-check). It is not in the repository's `restoreEntity`, because PUT and CSV-import upserts of a
  deleted entity restore through it before applying the update. A cascade restore brings children
  back before their parent is flipped, through `bulkRestoreSubtree`, which does not call it either.
- The restore endpoint never cuts the parent edge.
- This relies on how a PUT upsert (SDK, ingestion, CSV import) of a deleted metric behaves today,
  without deciding it: a PUT that names no parent removes the edge, so the metric comes back as a
  root, and naming the deleted parent fails because it cannot be resolved. Neither leaves a live
  metric pointing at a deleted parent. If PUT starts keeping the stored parent, the deleted-parent
  restore must be rejected on that path too.

## Consequences
- No live metric can point at a deleted parent through these APIs, so read, write and delete paths
  need no deleted-parent handling of their own.
- A user who wants the child back without its parent restores the parent, then moves or deletes
  what they do not want.
- Metrics restored on their own before this rule may still point at a deleted parent (their
  hierarchy and PATCH return 404). Restoring the parent repairs them. Restore the parent before
  permanently deleting it, or the orphaned metric is hard-deleted with it.
