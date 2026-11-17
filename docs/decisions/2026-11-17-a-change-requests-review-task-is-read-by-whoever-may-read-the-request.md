# A change request's review task is read by whoever may read the request

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT.test_taskReadsShowAPendingEditOnlyToWhoMaySeeItsChangeRequest`
- **Related:** `ChangeRequestVisibility`, `ListFilter`, `TaskResource`, `TaskAboutVisibility`

## Context
A change request holds an edit until it is reviewed. The change request API shows a request to
admins, the entity's owners and reviewers, the user who made it, and whoever may resolve its review
task. The review task carries the same proposed values, but the task API applied only the entity's
view permission, so its reads followed a different rule from the request's.

## Decision
- Task lists and counts carry one SQL condition in `ListFilter`
  (`getChangeRequestReviewCondition`), set for every reader who is not an admin. A task is kept
  unless it is the current review task of another user's change request, and then only if the
  reader is assigned to or reviews the task, or owns or reviews the entity it is about. The reader
  is matched by user id and the ids of the reader's teams. Lists and counts filter in the query, so
  pages are full and counts match the list.
- The task by id or name, its versions, and the comment routes check the task with
  `ChangeRequestVisibility`, which also admits whoever a policy lets resolve the task, and return
  403 otherwise.
- A request links only its current review task: revising the request closes the earlier task and
  unlinks it. A single read finds the request of such a task through the workflow run that created
  it, which records `global_changeRequestId`.
- A task that reviews no change request keeps the task API's own checks; admins are not checked.

## Consequences
- A user who may view an entity but not a change request on it does not see the request's open
  review task in lists or counts, and cannot read or comment on any of its review tasks.
- The caller's own task queues are unaffected: a requester, assignee or task reviewer passes.
- Known limits: lists and counts do not link an earlier revision's closed review task, since only
  its workflow run records the request; and a reader allowed to resolve a task only through a
  policy, not by assignment, ownership or review, reads the task directly but does not find it in
  lists.
