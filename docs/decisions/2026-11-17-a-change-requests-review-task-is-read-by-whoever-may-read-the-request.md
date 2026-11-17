# A change request's review task shows its proposed values to whoever may read the request

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT.test_taskReadsShowAPendingValueOnlyToWhoMaySeeItsChangeRequest`
- **Related:** `ChangeRequestVisibility`, `TaskResource`, `TaskAboutVisibility`

## Context
A change request holds an edit until it is reviewed. The change request API shows a request to
admins, the entity's owners and reviewers (owners as the entity reports them, inherited ones
included), the user who made it, and whoever may resolve its review task. The review task carries
the same proposed values in its `payload`, but the task API applied only the entity's view
permission, so any viewer of the entity read them.

## Decision
- Every viewer of an entity still sees its tasks: lists, counts, and the task by id or name are
  unchanged, so pages stay full and counts match the list.
- For a viewer the request's rule does not admit, a change request's review task comes back
  without its `payload`, the field that carries the proposed values. The decision is the change
  request API's own (`ChangeRequestVisibility`), so inherited owners, team membership and
  policy-based resolve rights count exactly as they do there. It applies to the lists and the task
  by id or name.
- A task's versions, and the comment and PATCH routes, return the task's payload as stored, so they
  return 403 to such a viewer. The write routes are refused rather than stripped because the change
  event, and the webhooks fed from it, record the response entity: a stripped response would record
  a task without its values.
- A request links only its current review task: revising the request closes the earlier task and
  unlinks it. Its request is found through the workflow run that created it, which records
  `global_changeRequestId`.
- A page's links, runs and requests are read in one query each; admins are not checked.

## Consequences
- A user who may view an entity but not a change request on it still sees the review task exists,
  with its title, status and assignees, but not the proposed values, and cannot comment on it.
- Tasks that review no change request are unchanged.
- A new field that carries proposed values on a review task must be removed here too.
