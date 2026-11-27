# An approval preview lists the change since its cycle began

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Vamsi-klu; pending agreement from yan-3005, who decided the record this supersedes
- **Guard:** `ApprovalTaskPreviewIT`, `ApprovalCycleHistoryTest`, `ApprovalCycleTest`,
  `ChangePreviewUtilsTest`, `TriggeringChangeTest`, `VersionDiffTest`,
  `CreateTaskTest#testAnApprovalWithNoCarriedPreviewMarksAFailedReadIncomplete`,
  `TaskEntityCreatedTemplateTest`
- **Related:** #35456, #29627, `ChangePreviewUtils`, `ApprovalCycleHistory`, `ApprovalCycle`,
  `CreateTask.PreviewChanges`;
  supersedes ADR:2026-11-03-an-approval-preview-opens-with-the-edit-that-started-the-cycle;
  keeps ADR:2026-10-22-an-approval-preview-omits-the-workflows-own-status-move

## Context

An approval task's Proposed Changes card was a running merge: each task copied the preview stored
on the open task it superseded and folded in one change read off the entity when the task was
created. Nothing ever recomputed it, so it went wrong in three ways that persisted for the rest of
the cycle:

- a wrong preview carried from an earlier task, including one stored before an upgrade, was copied
  into every later task;
- an edit that started no run (a bot's, or one the trigger filter skipped) was approved or rolled
  back with the cycle but never appeared;
- with two open tasks to supersede, the preview carried forward was an arbitrary one of them.

## Decision

1. An approval task that is not a change request review or a lifecycle move previews every change
   the entity's version history holds since the cycle's base version: the stored change of each
   version newer than the base, folded oldest first with the same set cancellation as before, with
   `entityStatus` left out (ADR:2026-10-22-an-approval-preview-omits-the-workflows-own-status-move).
   It is recomputed at every task write and replaces the stored preview, never merges into it.
2. The payload records the base as `proposedChangesBaseVersion`. A task that opens a cycle takes
   the earlier of the triggering edit's previous version and the newest approved version the
   history walk can find using the same approval rule as rejection (`ApprovedBaseline`). This
   includes edits made before the triggering edit that rejection would roll back. A task that
   supersedes or reenters takes the earliest triggering or carried base.
3. A carried task without the key (one stored before this change) or a run without a triggering
   version starts from the newest version a reviewer accepted, found with the rule rejection uses
   to restore one (`ApprovedBaseline`), else from the version before the latest change. A task's own
   payload without the key on the reentry path starts from the version before the latest change.
4. The history is read inside a fresh read scope by following each change's recorded previous
   version, one stored row at a time, newest first, and stops at the base. It reads at most
   `ApprovalCycleHistory.MAX_VERSIONS` = 200 versions. The walk does not page the version list
   because that list is ordered by extension name, which sorts version 10.0 before 9.0.
5. When the walk cannot reach the base, because a version row is missing or unreadable or the cycle
   is longer than 200 versions, the preview compares the base version with the current one instead
   (`VersionDiff`), which needs two row reads, and logs a warning naming the entity and the
   base. The comparison can hide changes within a list item when the item has the same name
   in both snapshots. When the base version cannot be read either, the preview lists the changes
   after the gap. Both cases set `proposedChangesIncomplete: true`.
6. The history is read when the preview is applied. If the read fails, the task opens with any
   carried changes and the incomplete flag. The Proposed Changes card and task-created
   notification render a warning even when there are no preview entries. A successful walk to
   the base clears the flag.

## Consequences

- An edit that started no run now shows in the next task when it is newer than the cycle's
  approved baseline. Fields a trigger excludes appear too, except the status.
- No migration. An open task stored before this change keeps its preview until its next task
  write, which recomputes it through the fallback in 3; a task never written again keeps its
  stored preview until it is decided.
- An approval task write walks up to 200 versions for changes and reads two more rows when
  it needs the snapshot comparison. Recovering an approved base for an opening or older task can
  require a separate walk under the same cap.
- Revisit if task reads must show changes made since the task was written, or if the version
  list gains a numeric order that makes paging it correct.
