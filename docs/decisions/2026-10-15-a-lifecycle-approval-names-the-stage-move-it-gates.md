# A lifecycle approval names the stage move it gates

- **Status:** Accepted; Decision 3 superseded by
  ADR:2026-10-22-an-approval-preview-omits-the-workflows-own-status-move
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `CreateTaskLifecycleMoveTest`, `LifecycleApprovalCard.test.tsx`
- **Related:** open-metadata/OpenMetadata#34694;
  ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task

## Context

A guided lifecycle gates a stage move with an ordinary `userApprovalTask`, which opens a
`RequestApproval` task. For approval tasks the server fills `payload.proposedChanges` from the
entity's latest change description, so the reviewer can accept an edit. In a lifecycle the latest
change is usually the workflow's own move into the stage (Draft → In Review), or whatever edit last
met the stage's conditions. The task therefore asked the reviewer to approve a change nobody proposed,
and never said which move the approval would make.

## Decision

1. A `userApprovalTask` config may carry `lifecycleMove` (`stage`, `targetStage`). The lifecycle
   compiler sets it on every approval it generates.
2. When it is set, `CreateTask` writes `payload.lifecycleMove` and removes `proposedChanges`; the task
   UI shows a card saying approval is needed to move from `stage` to `targetStage`.
3. Approvals without it — glossary approval, data access requests, change requests — keep listing
   proposed changes exactly as before. The task type stays `RequestApproval`, so thresholds, votes,
   assignee resolution and transitions are shared rather than duplicated.

## Consequences

- The lifecycle editor reads a playbook back without comparing `lifecycleMove`, which it derives from
  the stages around the approval, so playbooks published before this change still open as playbooks.
- A canvas edit that removes `lifecycleMove` from a lifecycle approval brings proposed changes back
  for that approval.
