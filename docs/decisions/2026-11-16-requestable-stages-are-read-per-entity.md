# The stages a user can request are read per entity, from the check that accepts the request

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-17 (the check now accepts a status update task) ·
  v3 2026-11-17 (offers follow the transitions leaving the entity's current stage) · v4 2026-11-17 (an
  offer also needs the transition's conditions to hold)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT#test_requestableStagesFollowTheLifecycleThatOwnsTheEntity`,
  `#test_aStatusRequestIsOfferedAndAcceptedOnlyWhileItsConditionsHold`,
  `#test_aTransitionIsOfferedOnlyFromItsStagesAndMovesTheAssetBackOntoThePath`
- **Related:** ADR:2026-11-16-a-lifecycle-request-triggers-only-lifecycle-playbooks

## Context
Which stages an entity can be requested to move to depends on the lifecycle that owns that entity's
stage: the first applicable stage workflow by name, after its trigger filter. A per-type list, the
union over every lifecycle on the type, offered Deprecated on glossary terms whose owning workflow
takes no requests, and the server then rejected the request with a 400.

## Decision
`GET /v1/metadata/types/lifecycleStages/{entityType}/{id}/requestableStages` returns the stages the
entity can be requested to move to: the targets of the on-request transitions that leave the stage it
is in, in the lifecycle owning its stage, whose conditions the entity meets. A transition with no from
stages leaves every stage but its own target; no transition moves an asset to Unprocessed. It needs `ViewBasic` on the entity. `EntityRepository.getRequestableStages`
backs both this read and the check that creating a `StatusUpdate` task runs, so what is offered is
what is accepted. `EntityLifecycleStages` carries no per-type requestable list.

## Consequences
A page asks once per asset and again after the asset's stage or request changes; the answer cannot
disagree with the task's check. The same asset is offered different moves in different stages, such
as Reopen only while Approved. Reading it loads the entity with all fields, as the trigger filter does.
