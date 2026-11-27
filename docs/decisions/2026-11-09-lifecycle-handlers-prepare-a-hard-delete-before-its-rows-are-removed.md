# Lifecycle handlers prepare a hard delete before its rows are removed and clean up after it commits

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `EntityLifecycleHardDeleteTest`
- **Related:** PR #37431; `EntityRepository.preparePostDeleteCleanup`, the repository-side pattern
  this extends

## Context

A hard delete removes an entity's relationships, `entity_extension` rows and other references
(`cleanup()` for a single entity, `bulkDeleteReferencesAndRows` for a bulk subtree chunk) before
`onEntityDeleted` reaches the lifecycle handlers. A handler that keeps data of its own next to the
entity, and must clean up something outside the database when the entity goes (a secret, a file,
an external registration), therefore cannot read that data from `onEntityDeleted`: it is already
gone, and the cleanup silently does nothing.

Repositories already solve this for themselves: `preparePostDeleteCleanup` captures what is needed
while the rows exist and returns an action the delete hands to `PostCommitActionQueue`. Handlers had
no equivalent.

## Decision

- `EntityLifecycleEventHandler.prepareHardDelete(entity)` is the handler-side hook. It returns a
  no-op by default.
- It runs during a hard delete, **before** the entity's relationships and extensions are removed,
  in both hard-delete paths. A handler reads what its cleanup needs there and returns the cleanup.
  It must not change the entity's rows itself.
- The returned cleanup runs **only after the delete's rows are gone for good**. The delete hands it
  to `PostCommitActionQueue.runOrDefer`, as it does the repository's own cleanup. Inside a
  repository transaction boundary (`flushInOneTransaction`, `executeInTransaction`) it runs after
  the commit and is dropped on rollback or a deadlock replay. Outside one, each statement commits on
  its own, and it runs right after the delete's statements. A delete that fails before that point
  never runs it.
- Handlers' cleanups run in handler priority order, after the repository's cleanup. The
  repository's cleanup failing does not stop them.
- A handler that throws while preparing or cleaning up is logged and skipped. It never fails the
  delete or another handler's cleanup.

## Consequences

- A handler can remove what it stored alongside an entity when that entity is hard deleted,
  without the repository knowing the handler exists.
- Cleanup is best effort after the fact: a cleanup that fails leaves its external resource behind,
  logged, and the delete stands. A handler that needs all-or-nothing must keep its data in the same
  database transaction instead.
- Soft deletes do not call the hook; `onEntitySoftDeletedOrRestored` covers them.
- A new hard-delete path must call `prepareHardDeleteCleanup` before it removes references, and
  queue the result with `PostCommitActionQueue.runOrDefer`, or the handlers it skips lose their
  cleanup without any error.
