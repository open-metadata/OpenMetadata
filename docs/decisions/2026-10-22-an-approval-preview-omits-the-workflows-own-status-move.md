# An approval preview omits the workflow's own status move

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `ChangePreviewUtilsTest`, `CreateTaskLifecycleMoveTest`
- **Related:** open-metadata/OpenMetadata#35972;
  ADR:2026-10-15-a-lifecycle-approval-names-the-stage-move-it-gates (Decision 3 superseded)

## Context

ADR:2026-10-15-a-lifecycle-approval-names-the-stage-move-it-gates kept non-lifecycle approvals
listing `payload.proposedChanges` exactly as before. Those approvals have the same problem the
lifecycle had: `GlossaryApprovalWorkflow` sets a new term to In Review right before it opens the
approval task, so the entity's latest change description is that write. A new term's task listed
only "Entity Status: Draft → In Review", a change nobody proposed.

## Decision

1. When an approval task's preview is built from the entity's change description (no
   change-request revision), `proposedChanges` omits `entityStatus`, including an entry carried
   from a prior task's payload.
2. When the task reviews a change request, the pending revision is listed as it is, `entityStatus`
   included, because a status edit there is one the requester asked for.
3. Lifecycle approvals are unchanged: they carry `lifecycleMove` and no `proposedChanges`.

## Consequences

- A new term's approval task shows no proposed changes; an edit shows only the fields edited.
- If an approval workflow that does not hold changes fires on a user's own status edit, that status
  change no longer appears in the preview. A workflow that needs reviewers to see it should hold
  changes, so the edit reaches the task as a change-request revision.
- Payloads stored on tasks opened before this change keep their status entry until the task is
  next updated.
