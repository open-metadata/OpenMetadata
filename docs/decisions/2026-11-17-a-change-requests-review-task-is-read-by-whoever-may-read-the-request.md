# A change request's review task is read by whoever may read the request

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT.test_taskReadsShowAPendingEditOnlyToWhoMaySeeItsChangeRequest`
- **Related:** `ChangeRequestVisibility`, `TaskResource`, `TaskAboutVisibility`

## Context
A change request holds an edit until it is reviewed. The change request API shows a request to
admins, the entity's owners and reviewers, the user who made it, and whoever may resolve its review
task. The review task carries the same proposed values, but the task API applied only the entity's
view permission, so its reads followed a different rule from the request's.

## Decision
- A task that reviews a change request is read under the request's rule
  (`ChangeRequestVisibility`): the task by id or name and its versions return 403 to anyone else,
  and the task lists leave the task out.
- An entity's task counts (`/tasks/count?aboutEntity=`) leave out the same tasks, so the count
  matches the list the caller sees.
- A task that reviews no change request keeps the task API's own checks.
- Admins are not checked; a page of tasks costs one query for its change requests.

## Consequences
- A user who may view an entity but not a change request on it sees no review task for that
  request, open or closed.
- The caller's own task queues are unaffected: a requester or assignee passes the rule.
- A list page or count can come back shorter than the page size, as `TaskAboutVisibility` already
  makes it.
