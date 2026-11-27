# A rejected lifecycle approval asks for a revision, and the next edit resubmits it

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `MetadataCollectionServiceTest`, `TaskWorkflowHandlerTest`, `WorkflowDefinitionResourceIT` (`test_rejectedApprovalAsksForARevisionAndTheNextEditResubmitsIt`)
- **Related:** open-metadata/OpenMetadata#35740, ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task

## Context

A lifecycle approval that was rejected could only move the asset to another stage (back to Draft, or
to a terminal Rejected) or leave it where it was. Left where it was, nobody was told the approval had
been rejected or why, and the approval opened again on the next edit whether or not the edit
addressed anything. The reviewer's comment was stored on the approval task but never reached the
workflow: the resolve path passed Flowable only the result, the user and the transition.

## Decision

- When an approval task is rejected, the resolve path sets two **global** workflow variables before
  completing the Flowable task: `rejectionComment` (the reviewer's comment, or empty) and `rejectedBy`
  (the user). They are global so any step after the approval can read them without the approval node
  declaring them as outputs. A rejection that carries no comment of its own (the task page's Reject
  asks for none) takes the reviewer's latest comment on the task thread.
- A `collectMetadataTask` with `revision: request` asks the stage's assignees to revise the asset: it
  opens a **Revise and resubmit** task of type `MetadataCompletion`, whose payload carries
  `revision.comment` and `revision.requestedBy` and lists no missing fields. There is one such task per
  asset, workflow and stage (`revisionTaskId`); a later rejection reopens it with the new comment.
- A `collectMetadataTask` with `revision: resubmit`, placed before the stage's approval, completes that
  task ("Resubmitted for approval") when the approval opens again. The next edit to the asset is the
  resubmission: the lifecycle runs on edits and reaches the approval again once the stage's checks
  pass. A Revise and resubmit task offers no transition of its own.
- The task also closes, like every Metadata Completion task, when the asset leaves the stage.
- A revision task is a `MetadataCompletion` task rather than a new task type, so it reuses its
  assignment (the stage's group, the admins when the group is empty), its stage scoping and its
  rendering; the UI tells the two apart by the presence of `revision`, and shows a revision task
  without action buttons.

## Consequences

- A reviewer's rejection comment reaches the people who have to act on it, and the approval is asked
  again only after the asset is edited.
- Any workflow can read `rejectionComment` and `rejectedBy` after a rejection; an approval that is
  approved leaves them unset, and a rejection with no comment, on the decision or in the task
  thread, leaves the comment empty.
- An edit that does not address the comment still resubmits; the reviewer decides again on the new
  version. Requiring an explicit "Resubmit" action would need a task transition that advances the
  workflow, which Metadata Completion tasks do not have.
