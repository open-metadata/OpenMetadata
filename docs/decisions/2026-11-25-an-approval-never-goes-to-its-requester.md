# An approval never goes to its requester

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT.test_editorWhoIsTheOnlyApproverIsNeverAskedToApprove`,
  `WorkflowDefinitionResourceIT.test_editorIsLeftOffTheApprovalWhenSomeoneElseCanApprove`,
  `SetApprovalAssigneesImplTest.testSelfApprovalPrevention_eventDrivenSoleRequester_*`
- **Related:** ADR:2026-11-12-approval-threshold-never-exceeds-eligible-voters

## Context

An approval node resolves its assignees from the entity's owners, reviewers and named candidates,
then removes the requester, the user whose edit started the run. For workflows not managed by a
task workflow, an emptied list was given back to the requester, whatever the node's empty-assignee
strategy, to keep the task "actionable"; with `assignAdmins` the admin fallback never ran. It was not actionable: the task is filed by the
requester, and `TaskAuthorPolicy` denies a task's filer `ResolveTask`. The requester was the only
assignee and could not approve, so the run waited until an admin, who bypasses the policy, found
and resolved a task assigned to someone else. This hit any workflow whose approval node kept the
default strategy, for example a reviewers-only approval of a data contract edited by its only
reviewer.

## Decision

The requester is never an assignee of an approval their own edit started, in any workflow and
under any empty-assignee strategy. When removing the requester leaves no one, the node's strategy
decides:

- `none` approves automatically, as it does when no approver resolves at all;
- `assignAdmins` assigns the platform admins other than the requester, and keeps the task open
  with no assignee when the requester is the only admin.

## Consequences

A workflow that must never approve an edit on its own when the editor is the only approver
configures `assignAdmins`. Under `none`, an edit by an entity's only approver is approved without
review, which is the documented meaning of `none`. Revisit only if `none` itself should stop approving automatically.

On upgrade, an existing workflow under `none` stops opening these tasks: an edit by the entity's
only approver, which used to wait for an admin to step in, is approved automatically. A workflow
that relied on that wait switches the node to `assignAdmins`.
