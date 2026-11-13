# An approval preview opens with the edit that started the cycle

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** yan-3005
- **Guard:** `ChangePreviewUtilsTest#buildProposedChangesPayload_firstTask_previewsTheOpeningEditNotTheStatusWrite`,
  `WorkflowDefinitionResourceIT#test_approvalPreviewShowsTheChainOfEditsNotTheWorkflowsStatusWrite`,
  `WorkflowDefinitionResourceIT#test_approvalPreviewShowsTheNetOfEditsTakenBackWithinTheCycle`
- **Related:** #29627, `ChangePreviewUtils`, `CreateTask.PreviewChanges`,
  ADR:2026-11-02-an-event-triggered-workflow-run-judges-the-change-its-event-made

## Context

An approval task's Proposed Changes card is a running merge: each edit in an approval cycle
supersedes the open task, and the new task folds that edit's own hop
(`incrementalChangeDescription`) into the preview it carries. Folding hops rather than the
entity's cumulative `changeDescription` keeps edits taken back within the cycle from returning
(#29627).

Approval workflows set the entity's status to In Review before their approval node, so when the
first task of a cycle is created the entity's latest hop is that status write, not the edit that
started the run. The status entry is stripped from the preview, so the first task showed nothing
the user changed, and every later task carried that gap forward.

## Decision

A task that opens an approval cycle (no open approval to supersede) previews the change of the
version its triggering edit produced (`TriggeringChange.of` with the run's `triggeringVersion`).
That version's change already combines the edits consolidated into it within the session. A task
that supersedes an open approval keeps folding in the latest hop. A change-request run keeps
previewing the revision it reviews.

## Consequences

- The card lists every edit in the cycle, starting with the one that opened it, and edits taken
  back still cancel out.
- A run without a triggering version (a workflow not yet redeployed with the variable, or a batch
  run) previews the entity's current change, as before the triggering version existed.
