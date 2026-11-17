# A lifecycle status request is a status update task, decided by the approvers of the transition it requests

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial: a `lifecycleRequest` entity field) · v2 2026-11-17 (a status update
  task instead of the field, after review) · v3 2026-11-17 (exits generalised to transitions between any stages) ·
  v4 2026-11-17 (any transition takes conditions and approvers; path steps on request; the lifecycle carries on
  after an approved request)
- **Deciders:** Ram Narayan Balaji, Pere Miquel Brull, Adrià Manero
- **Guard:** `WorkflowDefinitionResourceIT#test_approvedStatusRequestMovesTheAssetAndEndsItsOnboardingApproval`,
  `#test_rejectedStatusRequestLeavesTheStageAndTheOnboardingApproval`,
  `#test_statusRequestForAStageTheLifecycleDoesNotOfferIsRejected`,
  `#test_secondStatusRequestWhileOneIsOpenIsRejected`, `#test_withdrawnStatusRequestCanBeRaisedAgain`,
  `#test_aTransitionIsOfferedOnlyFromItsStagesAndMovesTheAssetBackOntoThePath`,
  `#test_aStatusRequestIsOfferedAndAcceptedOnlyWhileItsConditionsHold`,
  `#test_anApprovedRequestMovesTheAssetAndTheLifecycleCarriesOnAtOnce`, `EntityStatusWorkflowsTest`,
  `LifecycleTransitionRulesTest`, `CreateTaskTest#aLifecycleApprovalReplacesOnlyAnEarlierApprovalOfTheSameMove`
- **Related:** ADR:2026-11-16-requestable-stages-are-read-per-entity

## Context
A lifecycle playbook has an onboarding path (Draft, In Review, Approved) and needs other moves besides
it: retiring an asset from any stage, rejecting it from review, sending a rejected asset back to Draft,
reopening an approved one. The first version stored a request on the asset as a `lifecycleRequest`
field and allowed only "exits" to Deprecated or Archived from any stage. The field put workflow state
in the asset: every asset type with a lifecycle needed it, every write path had to handle it, the
request lived both on the asset and in its approval task and could drift apart, and a request whose run
went away stayed on the asset with no way to cancel it. Fixing the targets to Deprecated and Archived
would have needed rework the first time a lifecycle wanted any other move.

## Decision
`lifecycleConfiguration.transitions` lists the moves a lifecycle makes besides the automatic steps of its
onboarding path. Each one has `from` stages (none means any stage other than its target), a `to` stage (any
stage but Unprocessed), a `trigger`, optional `conditions` and optional `approval`:
- **automatic**: needs `conditions`. It compiles to a check before the onboarding path; with approvers it
  asks them first, and only an approval makes the move (a rejection goes on to the next check). One with no
  from stages never fires from a stage another such transition moves to, so two cannot bounce an asset.
- **onRequest**: needs approvers. It compiles to no node. `conditions`, when set, must hold for the move to
  be offered and accepted, evaluated by the same rule engine and entity view as the run's own checks.
- **onPath**: a step of the onboarding path made on request. Its stage's checks become the transition's
  conditions and its approval names the request's approvers; the path's stage holds the asset until then.

A request is a `StatusUpdate` task on the task framework: created with `POST /v1/tasks`, decided by
`StatusUpdateTaskWorkflow`, and applied on approval by setting `entityStatus` from `newStatus`, written for
the approver with governance-bot as impersonator. Creating one requires an on-request transition leaving the
asset's current stage whose conditions hold, refuses a second open request on the asset, and assigns the
transition's approvers (admins when no one but the requester is left). Approving re-checks the same against
the stage the asset is in then. Withdrawing closes the task and ends its run. Once an approved request has
moved the asset, the owning lifecycle starts again through a signal of its own (`LifecycleRestart`), on the
async executor, so its next step runs at once; only an approved request restarts it, so no chain of moves
loops by itself.

A lifecycle may hold several approvals on one asset at once, one per move, so a new approval replaces only an
earlier one for the same move (`CreateTask.decidesSameMove`); approvals that gate no move replace as before.
Whenever a transition moves the asset, the lifecycle's open approval runs on it end and its tasks for other
stages close (`LifecycleTransitionRuns`). The server refuses on save what the editor refuses: a move to or
from Unprocessed or from its own target, an on-request transition with no approvers, an automatic one with no
conditions, a path step that is not on request from one stage, and two transitions that could both move an
asset from one stage to the same stage (`LifecycleTransitionRules`).

## Consequences
No asset schema carries request state, and a new asset type with a lifecycle needs nothing to offer requests.
Every move of a lifecycle, on its path or besides it, can be automatic or requested, with or without
conditions and approvers, so lifecycles branch and loop with one model. Statuses remain the fixed set of
`status.json`.
