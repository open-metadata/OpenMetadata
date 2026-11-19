# A repeat vote on a multi-approval task is refused with 409

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata backend maintainers
- **Guard:** `WorkflowDefinitionResourceIT.test_WorkflowApprovalThresholdRefusesRepeatVote` (`openmetadata-integration-tests`)
- **Related:** Issue #35992, PR #37621, ADR:2026-11-02-resolving-a-task-takes-the-checks-of-the-equivalent-patch, ADR:2026-11-02-ontology-reviewers-vote-without-edit-rights

## Context

A voter already counted on a multi-approval workflow task could resolve it again through
`POST /v1/tasks/{id}/resolve`, `POST /v1/tasks/{id}/suggestion/apply` or a bulk Approve or Reject on
`/v1/tasks/bulk`. A team assignee got 200 and the vote was dropped silently. A direct assignee is
pruned from the assignees once they vote, so the task policy answered them 403. The same mistake got
two different answers, and neither one said what was wrong.

## Decision

A resolve request from a user already recorded as a voter on a multi-approval workflow task gets
409 `TASK_STATE_CONFLICT` with "User '<name>' has already voted on task '<id>'", and nothing is
written. `TaskRepository.checkPermissionsForResolveTask` runs this check before the task policy, so
team and direct assignees get the same answer. It is safe to run before authorization because it
can only be true for a caller who is already a recorded voter, and the message tells them only
about their own vote. Closing a task (`closeTask=true`) skips the check.

`WorkflowHandler` raises the same 409 when one voter races two requests past that check, so the
second vote is neither counted twice nor dropped silently.

Deciding what a reviewer may read (`ChangeRequestVisibility.mayResolve`) calls the policy-only
`TaskRepository.checkPolicyForResolveTask`, because a reviewer who has already voted must still see
the task.

## Consequences

Clients that relied on 200 for a team member's repeat vote, or 403 for a direct assignee's, now get
409 and should treat it as "already voted". A new resolve route has to go through
`checkPermissionsForResolveTask`, and a new read-visibility check through
`checkPolicyForResolveTask`. Revisit if a voter is ever allowed to change their vote.
