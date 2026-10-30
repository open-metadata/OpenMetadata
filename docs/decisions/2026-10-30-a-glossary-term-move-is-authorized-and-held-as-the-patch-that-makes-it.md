# A glossary term move is authorized and held as the PATCH that makes it

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `WorkflowDefinitionResourceIT` (`test_glossaryTermMoveIsHeldForApproval`,
  `test_rejectedGlossaryTermMoveLeavesTheTermInPlace`,
  `test_glossaryTermMoveOutsideTheGatedFieldsRunsAsAJob`);
  `GlossaryTermResourceIT.test_moveTermNeedsTheAccessChangingItsParentNeeds`;
  `ChangeParentHierarchy.test.tsx`
- **Related:** ADR:2026-10-21-domain-moves-are-authorized-in-the-write-pipeline

## Context
A glossary term moves two ways. Dragging it in the terms table sends a PATCH of `parent` (and
`glossary`), which is authorized per field and admitted by the approval gate. The Change Parent
action calls `PUT /glossaryTerms/{id}/moveAsync`, which runs the move as a background job. A move
changes the same fields either way, so it has to answer to the same policies and the same approval
workflows either way.

## Decision
- `moveAsync` expresses the move as the PATCH that makes it: whole-field operations on `/parent`
  and `/glossary` (`GlossaryTermRepository.planMove`). The request is authorized with that patch,
  exactly as the PATCH endpoint authorizes it.
- The approval gate judges that patch on the same prepared entity a real PATCH admits
  (`previewPatch`). When a workflow holds it, the PATCH path stages it as a change request; when
  approved, the change request applies it as that PATCH.
- A held move answers `202` with the `X-OpenMetadata-Pending-Change` header naming the change
  request, and a body with no `jobId`: no job runs and no websocket update follows. A move nothing
  holds answers `202` with a `jobId` and runs as a job, as before.
- A move request without a parent is refused with `400`.

## Consequences
- The UI's pending-change interceptor tells the user a held move awaits approval; the Change Parent
  dialog closes on a response without a `jobId` instead of waiting for a job.
- Moving a term requires the operations the equivalent PATCH requires. The Change Parent action is
  shown only to users with `EditAll`, so it is offered to the same users as before.
- Moves the ontology impact service makes when it deletes a term are not affected: they belong to
  a release-governed path and call the repository move directly.
