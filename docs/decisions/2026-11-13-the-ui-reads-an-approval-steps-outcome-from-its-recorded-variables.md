# The UI reads an approval step's outcome from its recorded variables

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowRunApprovalOutcome.spec.ts` (a real run approved by the workflow and one
  approved by the owner); `WorkflowApprovalOutcomeUtils.test.ts`
- **Related:** `WorkflowExecutionHistory.tsx`, `WorkflowHistory.component.tsx`

## Context
An approval step can be decided by people or by the workflow itself: when no one is left to assign
the task to, the auto-approve step approves it. The execution history showed both as a finished
run, so a change that published without review looked the same as one a reviewer approved. The run
record carries only the trigger's variables, but each step record (stored when the workflow sets
`storeStageStatus`, which the workflow builder, lifecycle playbooks and seeded workflows all do)
carries the variables the step ended with. Reading them needs no new field, works for runs recorded
before this change, and needs no migration.

## Decision
- The execution history and the glossary term's workflow card read an approval step named `N` from
  its step record:
  - `N_result`: the decision, `approve`/`reject` or `true`/`false`.
  - `N_updatedBy`: the user who resolved the task.
  - `N_autoApprovalReason`: set by the auto-approve step.
  - `hasAssignees` (`false` when the step had no one to assign) and `submitterIsReviewer` (`true`
    when the requester was the reviewer): un-namespaced, set afresh on every pass of the step.
- A step reads as approved by the workflow when `N_autoApprovalReason` is set and `hasAssignees` is
  `false` or `submitterIsReviewer` is `true`; the second tells the two reasons apart. A looped step
  keeps `N_autoApprovalReason` from an earlier automatic pass, which is why the per-pass variables
  decide.
- The UI never matches the text of `N_autoApprovalReason`.

## Consequences
- Renaming any of these variables on the server, or writing the decision elsewhere, removes the
  line from every run; the Playwright spec above fails when that happens.
- The history reads one run's steps per listed run. A run of a workflow without step records shows
  no line.
- Revisit by recording a typed outcome on the run when per-run reads become a cost, or when the
  history needs outcomes for workflows that do not store step status.
