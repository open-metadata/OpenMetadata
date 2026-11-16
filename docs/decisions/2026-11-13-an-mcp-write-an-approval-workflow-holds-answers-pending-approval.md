# An MCP write an approval workflow holds answers pending approval

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `PatchEntityToolTest#execute_reportsAWriteAnApprovalWorkflowHeldAsPendingApproval`,
  `CreateTestCaseToolTest#aHeldOverwriteIsReportedAsPendingApproval`
- **Related:** #37757; ADR:2026-11-03-held-changes-to-one-field-merge-by-part-and-a-held-column-write-answers-202;
  ADR:ai-platform/2026-11-03-a-write-an-approval-workflow-holds-is-reported-as-held

## Context

When an approval workflow holds a write, the repository returns the entity as published with the
id of the pending change request, and REST answers `202 Accepted` with
`X-OpenMetadata-Pending-Change`. `patch_entity` and `create_test_case` dropped that id and answered
`_operation: "updated"` with the old values and an unchanged version, so an agent told the user a
change was applied that no reviewer had approved yet.

## Decision

- A held MCP write answers `_operation: "pendingApproval"` and `changeRequestId`, the id REST sends
  in `X-OpenMetadata-Pending-Change`. The entity in the reply is the published one, and `changed`
  is left out, since it would list the previous version's fields.
- An applied write answers as before.
- Every MCP tool whose repository write can be held (a patch or a `createOrUpdate`) passes its
  reply through `McpResponseUtils.markHeld`, and its `tools.json` description says how a held write
  comes back. A plain create is never held.

## Consequences

- An MCP client tells "submitted for approval" from "applied" by `_operation` alone.
- A new write tool that skips `markHeld` reports a held write as done again; review checks for it.
