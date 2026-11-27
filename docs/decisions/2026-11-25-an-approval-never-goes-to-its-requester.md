# An approval never goes to its requester

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial); v2 2026-11-27 (owner fallback, later approval steps)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT.test_editorWhoIsTheOnlyApproverIsNeverAskedToApprove`,
  `WorkflowDefinitionResourceIT.test_editorIsLeftOffTheApprovalWhenSomeoneElseCanApprove`,
  `SetApprovalAssigneesImplTest.testSelfApprovalPrevention_eventDrivenSoleRequester_*`,
  `WorkflowDefinitionResourceIT.test_taskWithoutAssigneesNeverFallsBackToItsCreator`,
  `WorkflowDefinitionResourceIT.test_secondApprovalStepWithNobodyToAskApprovesOnItsOwn`,
  `TaskRepositoryAssigneesTest.neverFallsBackToTheTaskCreator`
- **Related:** ADR:2026-11-12-approval-threshold-never-exceeds-eligible-voters;
  amends ADR:2026-10-22-agent-glossary-proposals-are-decided-through-the-approval-workflow
  (withdraws its "a sole one keeps it" consequence)

## Context

An approval node resolves its assignees from the entity's owners, reviewers and named candidates,
then removes the requester, the user whose edit started the run. For workflows not managed by a
task workflow, an emptied list was given back to the requester when the node's empty-assignee
strategy was `none`, to keep the task "actionable". It was not actionable: the task is filed by the
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
- `assignAdmins` assigns the platform admins other than the requester;
- `wait` opens the task with no assignee.

## Consequences

A workflow that must never approve an edit on its own when the editor is the only approver
configures `assignAdmins` or `wait`; lifecycle playbooks and the data access request workflow
already do. Under `none`, an edit by an entity's only approver is approved without review, which is
the documented meaning of `none`. Revisit only if `none` itself should stop approving automatically.

On upgrade, an existing workflow under `none` stops opening these tasks: an edit by the entity's
only approver, which used to wait for an admin to step in, is approved automatically. A workflow
that relied on that wait switches the node to `wait` or `assignAdmins`.

## Amendment — 2026-11-27: the owner fallback and later approval steps

Two paths still reached the requester or opened a task the strategy did not ask for:

- **The owner fallback.** A task created with no assignee falls back to the asset's owners unless
  its node chose `wait`. Under `assignAdmins`, when the requester is the only admin, that fallback
  could assign the requester. The fallback now never assigns the task's creator, the requester of a
  workflow task, for every task, not only approvals.
- **A later approval step.** The first approval step's task id stays in the run, and a step read it
  as a sign of a task workflow. A second step in an entity workflow therefore opened a task under
  `none` instead of approving. A task id whose task belongs to an entity-event workflow no longer
  marks a step as a task workflow's; a task workflow's start still sets `taskWorkflowManaged`.
  Periodic-batch workflows are not covered: their later steps still read the earlier step's task
  id.

The workflow builder shows each strategy with its outcome, including the owner fallback, and on a
task workflow (`noOp` trigger) shows `none` as sending the open task to the asset's owners.

