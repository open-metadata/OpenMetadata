# An approval never goes to its requester

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial); v2 2026-11-27 (owner fallback)
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

## Amendment — 2026-11-27: the owner fallback

A task created with no assignee falls back to the asset's owners. Under `assignAdmins`, when the
requester is the only admin, the task stays open with no assignee and that fallback could assign the
requester. The fallback now never assigns the task's creator, the requester of a workflow task, for
every task, not only approvals. Guard: `TaskRepositoryAssigneesTest.neverFallsBackToTheTaskCreator`,
`WorkflowDefinitionResourceIT.test_taskWithoutAssigneesNeverFallsBackToItsCreator`.

The workflow builder shows each strategy with its outcome, including the owner fallback, and on a
task workflow (`noOp` trigger) shows `none` as sending the open task to the asset's owners.

On 2.0 these outcomes hold for an entity workflow's first approval step. A later step reads the
earlier step's task id: it counts as workflow-managed, copies that task's assignees and reuses that
task, so under `none` it keeps a task open instead of approving. Main fixes this with the
lifecycle-gate changes (#34693), which 2.0 does not have. The task's creator on 2.0 is the asset's
last editor, so if someone other than the requester last edited the asset, the owner fallback skips
that editor rather than the requester.

