# Hard-deleting an assignee hands a task it leaves unassigned to the owners of the asset

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `TaskAssigneeCleanupTest`, `EntityDeleteTaskCleanupIT`, `UserHardDeleteWithSoftDeletedTaskIT`
- **Related:** #37315, PR #37332, PR #37942, ADR:2026-11-20-suggestion-tasks-fall-back-through-every-owner-to-the-admins, ADR:2026-11-25-an-approval-never-goes-to-its-requester, ADR:2026-10-22-deleting-a-user-removes-only-their-suggestions-on-hard-delete

## Context
A hard delete of a user or a team first runs `entitySpecificCleanup`, then removes every
relationship of the entity. A task keeps its assignees as `ASSIGNED_TO` relationships, so the second
step already drops the deleted entity from every task. What it does not do is rewrite the task: it
gets no new version and no change event. Teams were not cleaned up at all, because the cleanup was written as an overload that no
repository dispatched. A task whose only assignee was deleted was left with nobody to ask, and
nobody was told. Assignees are decided once, when a task is created.

## Decision
- The cleanup runs **before** the relationship removal. It rewrites the live tasks the deleted
  user or team was assigned to, and the removal then drops the edges of the soft-deleted ones.
  Moving the cleanup after the removal makes it find nothing.
- A soft-deleted task is never rewritten or restored.
- A live task is read from its locked row (`FOR UPDATE`) and only `assignees` changes, so an edit
  that committed in between is kept. A task that was deleted first is skipped, and a soft delete
  that arrives later waits for the write.
- Users and teams are handled the same way.
- An open task that loses its last assignee gets the owners of the asset it is about, by the rule
  a task gets at creation (`TaskRepository.setDefaultAssigneesFromEntityOwners`): teams become
  their members, the task's creator is never chosen, and a task with `useEntityOwnerFallback` off
  is left alone. The deleted user or team is never chosen either.
- When nobody qualifies, the task stays unassigned. The owners of the asset and the admins can
  still act on it.
- A task that is already closed is not handed over.

## Consequences
The new assignees get a change event for the task. A task about an asset owned only by the deleted
user, or only by the task's creator, ends up unassigned. Reviewers and watchers are not rewritten;
their edges go with the removal. An assignee change does not touch workflow state, as for any other
assignee edit. Each live task is locked and rewritten inside the delete transaction, so deleting a
user or team assigned to very many tasks takes longer. A fallback beyond the asset's owners, such as
the service owners or the admins that a suggestion task uses, would need its own record.
