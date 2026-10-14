# A lifecycle stage asks for its missing metadata in one task

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `LifecycleMetadataTasksIT`, `CollectMetadataTaskTest`
- **Related:** open-metadata/OpenMetadata#34694;
  ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory

## Context

A guided lifecycle holds an asset in a stage until its required fields are filled in. The stage's
`checkEntityAttributesTask` gate already enforces that on every event; what was missing was telling
someone what to fill in. The first attempt opened one `CustomTask` per missing field. A custom task
is bound to `CustomTaskWorkflow`, so each one offered Approve and Reject, approving it changed
nothing on the asset, and the next edit reopened it; the task panel showed neither its description
nor its payload. An asset missing four fields produced four such tasks.

## Decision

1. A `collectMetadataTask` node keeps **one** `MetadataCompletion` task per asset and node, with a
   deterministic id derived from the asset, the workflow and the node, so concurrent runs on any
   server converge on the same task. The node lists the stage's required fields, each with the JSON
   Logic condition that is true once it is filled in.
2. The task's payload (`type/metadataCompletionPayload.json`) names the workflow, the node, the stage,
   the next stage, and the required fields that are **still empty**. Every reconcile rewrites the
   list as fields are filled in, completes the task when none is missing, and reopens the same task
   — with its history — when the asset is back in the stage with fields missing.
3. The node runs where its stage is evaluated: after the route that finds the asset in that stage and
   after the move into it, so the task opens as soon as the asset enters the stage. An asset is in one
   stage at a time: when any collect node runs, an open task for a stage the asset has left is
   cancelled.
4. **No workflow drives the task.** It is server-opened like `MemoryConflictReview`: the task API
   refuses to create, patch or bulk-edit one, and its only transition is **Re-check**. Re-check
   reads the fields the stored workflow's node asks for now: it completes the task when they are
   filled in, or when the asset has left the stage, and is refused with the missing fields named
   otherwise. It never changes the asset; the gate moves it on the next event. Closing the task is
   allowed: the next reconcile reopens it while fields are still missing.
5. Assignees are the asset's owners, its reviewers, or named users and teams. An asset with nobody to
   ask gets no task; the gate still holds it.

## Consequences

- A field that is filled in completes the task through the asset's own update event; Re-check only
  covers an update whose event has not been processed yet.
- An asset whose stage is changed directly, with no further event, or that moves to a stage without a
  collect node keeps its last task open until the next run of the workflow or a Re-check closes it.
- The guided editor's per-field options — recommended and optional checks, conditional checks,
  completeness scores, guidance text — are not part of the lifecycle configuration. Completeness
  scoring stays available as its own node in the workflow builder.
