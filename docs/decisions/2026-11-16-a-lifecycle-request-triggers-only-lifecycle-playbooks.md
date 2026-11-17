# A lifecycle status request is a status update task, decided by the lifecycle's exit approvers

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial: a `lifecycleRequest` entity field) · v2 2026-11-17 (a status update
  task instead of the field, after review)
- **Deciders:** Ram Narayan Balaji, Pere Miquel Brull, Adrià Manero
- **Guard:** `WorkflowDefinitionResourceIT#test_approvedStatusRequestMovesTheAssetAndEndsItsOnboardingApproval`,
  `#test_rejectedStatusRequestLeavesTheStageAndTheOnboardingApproval`,
  `#test_statusRequestForAStageTheLifecycleDoesNotOfferIsRejected`,
  `#test_secondStatusRequestWhileOneIsOpenIsRejected`, `#test_withdrawnStatusRequestCanBeRaisedAgain`
- **Related:** ADR:2026-11-16-requestable-stages-are-read-per-entity

## Context
A lifecycle playbook can offer exits, such as Deprecated or Archived, that a user requests. The first version
stored the request on the asset as a `lifecycleRequest` field. That put workflow state in the asset: every asset
type with a lifecycle needed the field, every write path had to handle it (PUT, CSV import), the request lived both
on the asset and in its approval task and could drift apart, and a request whose run went away stayed on the asset
with no way to cancel it. Requests also ran inside the lifecycle's own run, where an exit's approval replaced the
pending onboarding approval and an exit without approval left that approval open to undo the move.

## Decision
A request is a task of type `StatusUpdate` on the task framework, like the other update tasks: created with
`POST /v1/tasks`, decided by `StatusUpdateTaskWorkflow`, and applied on approval by setting `entityStatus` from the
task's `newStatus`, written for the approver with governance-bot as impersonator, so the lifecycle's ownership of the
status holds. The lifecycle governs it: creating one requires a stage the asset's owning lifecycle offers on request
(`EntityRepository.getRequestableStages`), refuses a second open request on the asset, and assigns it to the approvers
the exit names (owners, reviewers, named users; admins when no one but the requester is left). Approving re-checks the
stage is still offered. Withdrawing closes the task and ends its run. An on-request exit always names approvers, since
an approval with no assignees approves without applying the task's change; a move needing no approval is an
automatic exit. Whenever the asset moves to one of its lifecycle's exit stages, by an approved request or an
automatic exit, the lifecycle's open approval runs on it end and its tasks for other stages close
(`LifecycleExitRuns`). On-request exits compile to no lifecycle node; automatic exits never move an asset from one exit
stage to another.

## Consequences
No asset schema carries request state, and a new asset type with a lifecycle needs nothing to offer requests. The
request lives in one task: pending, approved, rejected or withdrawn. A request and the onboarding approval no longer
replace each other. Revisit if requests need to change a stage on the onboarding path, which the lifecycle's gates
own.
