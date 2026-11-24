# The approval gate judges its filter before and after an edit

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** yan-3005
- **Guard:** `WorkflowDefinitionResourceIT#test_anEditThatLeavesTheFilterIsHeld`, `WorkflowDefinitionResourceIT#test_anEditThatStaysOutsideTheFilterIsNotHeld`
- **Related:** `ApprovalGate`

## Context

An Enforce-mode workflow's trigger filter excludes the assets it does not review. The gate judged the
filter only on the asset as edited, so an edit that changed what the filter reads moved the asset out
of review together with every other change in the same request.

## Decision

The gate leaves an edit unreviewed only when the workflow's filter excludes the asset both as stored
and as edited. An edit that brings the asset into the filter, or takes it out, is reviewed.

## Consequences

- An edit to an asset the filter excludes before and after is published directly, as before.
- Change-request runs are admitted by the gate and are not filtered again by the trigger, so a held
  edit is always reviewed by the workflow that held it.
