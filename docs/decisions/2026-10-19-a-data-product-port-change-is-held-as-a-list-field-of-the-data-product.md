# A data product port change is held as a list field of the data product, gated only by its workflow

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT` (`test_dataProductPortAddIsHeldUntilApproved`, `test_dataProductPortRemovalIsHeldAndARejectionKeepsThePort`, `test_botPortEditIsNotHeld`, `test_heldDescriptionAndPortChangesApplyTogether`, `test_dataProductPortCannotBecomeBothKindsThroughOneRequest`, `test_heldPortToAnAssetDeletedBeforeApprovalIsNotAdded`)
- **Related:** open-metadata/OpenMetadata#35740

## Context

A data product's input and output ports are `INPUT_PORT` / `OUTPUT_PORT` relationships, not fields of
the data product's JSON. The approval gate only holds edits it can express as a change of entity JSON,
and a change request is applied as a JSON Patch, so a port change was written immediately even when an
Enforce approval workflow covered data products. `inputPorts` and `outputPorts` were already trigger
fields of `dataProduct` (`workflowTriggerFields.json`), so a workflow could name them and do nothing.

A port also relates two entities, so it has to be decided whose workflow gates it.

## Decision

- A relation the entity JSON does not carry is held as a **list field of the owning entity**, named by
  `EntityRepository.getStagedRelationFields()`. For a data product these are `inputPorts` and
  `outputPorts`; each element is the port's entity reference and its identity is the reference id, so a
  change request holds `add` / `remove` ops with `key` = reference id and `value` = the reference JSON.
- The gate judges the owning entity's JSON with those list fields added (`addStagedRelations`), through
  the same staging as a PATCH (`ApprovalGate.admitRelations`).
- On approval, these ops are published by `applyStagedRelations`, in the same transaction as the request's
  field ops, which still go through the JSON Patch path. Before publishing, every added relation is checked
  again against the relations as published and the other additions of the same request
  (`validateStagedRelations`); a relation that can no longer be made leaves the request unapplied.
- **Only the owning entity's workflow gates the relation.** Adding a port does not change the port's asset,
  so the asset's workflow is not asked. One gate per change: two workflows never decide one edit.
- Adding assets to a domain or data product is unchanged: it edits each asset's `domains` / `dataProducts`
  field, so each asset's workflow gates it.

## Consequences

- An Enforce workflow on data products holds port changes made by people; bots write through, as for any
  gated field.
- Another relation that should be gated follows the same hooks: name it in `getStagedRelationFields`,
  render it in `addStagedRelations`, and validate and write it in `validateStagedRelations` /
  `applyStagedRelations`.
- A UI or change-request consumer reads port ops like any other list op of the data product.
- Revisit if ports become fields of the data product entity again; then the JSON Patch path holds them and
  these hooks can go.
