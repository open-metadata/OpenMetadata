# A workflow run records how each of its approval steps was decided

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT` (`test_runRecordsWhoApprovedAndWhoRejectedEachHeldChange`,
  `test_runRecordsEveryVoterOfAnApprovalThatNeedsTwoVotes`,
  `test_runRecordsEveryReviewerAChangeRequestCountedVotesFrom`,
  `test_runRecordsAChangeRequestApprovedOnlyInPart`,
  `test_runRecordsAnAdministratorWhoPublishedWithoutReview`,
  `test_runRecordsAnApprovalTheWorkflowGaveItselfWithoutStoringItsSteps`);
  `WorkflowInstanceRepositoryTest.aDecidedApprovalStepOutlivesTheRunBeingSuperseded`;
  `WorkflowRunApprovalOutcome.spec.ts`
- **Related:** `ApprovalOutcomeRecorder`, `ApprovalTaskCompletionValidator`, `RecordVotedApprovalImpl`,
  `AutoApproveServiceTaskImpl`

## Context
An approval step is decided by people, by the workflow itself when no one is left to ask, or by an
administrator who publishes a held change without review. The execution history showed all of them
as a finished run, so a change that published without review looked the same as one a reviewer
approved. The run record carried only the trigger's variables. The step records carry a decision's
variables, but only when the workflow stores them, and reading them from the UI costs a request per
run and still cannot name every voter of a multi-vote step or tell a partial approval from a whole
one.

## Decision
- A run keeps one `approvalOutcome` (`approvalOutcome.json`) per decided approval step: the node,
  the decision (`Approved`, `PartiallyApproved`, `Rejected`, `Overridden`), the users who decided
  it, an `automaticReason` (`NoAssignees`, `SubmitterIsReviewer`) when the workflow decided it, and
  when it was decided.
- The list lives in the run's `variables`, under `approvals`, not in a field of its own. Every
  server version reads `variables` as a free-form map, and the run schema rejects unknown fields,
  so a run written by this version stays readable by the previous one during a rolling upgrade.
- The server records the outcome where the decision is made:
  - the auto-approve step records an automatic outcome;
  - the approval task's completion validator, once it accepts the completion, records the people's
    decision: every voter on the deciding side of a multi-vote task, else the user who completed it;
  - when the step reviewed a change request, the change request counts the votes, so its settled
    review names the reviewers on the deciding side, and an approval whose settled selection
    dropped a change is `PartiallyApproved`;
  - an administrator override records `Overridden`, naming the administrator.
- The write runs after the step's Flowable transaction commits, and appends with a partial-JSON
  update of the run row. A run ended from outside it (superseded or cancelled) is ended the same
  way, so neither write overwrites the other.
- The recording adds nothing to the BPMN. A deployed workflow keeps the BPMN it was deployed with,
  and stored definitions are not redeployed at startup, so a new listener would reach existing
  workflows only through a migration that redeploys every one of them. The completion validator is
  already on every deployed approval task and Flowable loads it by class name, so the recording
  reaches existing workflows, and runs already waiting on a task, as soon as the server is upgraded.
- The UI reads `variables.approvals` from the run it already lists; it reads no step records for
  this.

## Consequences
- The execution history costs no extra request and shows outcomes for workflows that store no step
  records. The glossary term's workflow card shows an outcome under its approval step, so it needs
  the step records the card already reads.
- Runs decided before this change have no `approvals` and show nothing; no migration backfills
  them, and no migration redeploys a workflow for this.
- A server of the previous version runs the same BPMN; it records nothing, and the runs it decides
  during a rolling upgrade show no line.
- A step that ends by its expiry timer records no outcome; nobody decided it.
- A new decision path (another task type or exit) must record its outcome here, or its runs show no
  line.
