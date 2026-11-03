# A metric is restored with its parent, never on its own under a deleted one

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Anujkumar Yadav
- **Guard:** `MetricResourceIT#restore_childOfDeletedParent_isRejectedUntilTheParentIsRestored`
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
- The check runs only for the metric a restore request names (`EntityRepository.validateRestore`,
  called from `restoreEntityInternal` and from the async pre-check). A cascade restore brings
  children back before their parent is flipped, through `bulkRestoreSubtree`, which does not call it.
- The restore endpoint never cuts the parent edge.
- A PUT upsert (SDK, ingestion, CSV import) of a deleted metric is a full replace and stays as it
  is: it restores the metric with the parent the request names. Naming no parent removes the edge,
  so the metric becomes a root; naming the deleted parent fails, because it cannot be resolved.
  Neither leaves a live metric pointing at a deleted parent.

## Consequences
- No live metric can point at a deleted parent through these APIs, so read, write and delete paths
  need no deleted-parent handling of their own.
- A user who wants the child back without its parent restores the parent, then moves or deletes
  what they do not want.
- Metrics restored on their own before this rule may still point at a deleted parent (their
  hierarchy and PATCH return 404). Restoring the parent repairs them.
