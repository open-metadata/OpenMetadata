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
- Restoring a metric whose parent is soft-deleted is rejected with 400, naming the parent to
  restore instead. Restoring that parent restores the subtree, as before.
- The check runs only for the metric a restore request names (`EntityRepository.validateRestore`,
  called from `restoreEntityInternal`). A cascade restore brings children back before their parent
  is flipped, through `bulkRestoreSubtree`, which does not call it.
- The edge is never cut on restore, so a metric never leaves its hierarchy because it was restored.

## Consequences
- No live metric can point at a deleted parent through the restore API, so read, write and delete
  paths need no deleted-parent handling of their own.
- A user who wants the child back without its parent restores the parent, then moves or deletes
  what they do not want.
