# Approval rejection restores the reviewed edit

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** Vamsi-klu, based on yan-3005's review of #38857
- **Guard:** `ApprovalTaskPreviewIT`, `ApprovalCycleHistoryTest`
- **Related:** #35456, #38857, ADR:2026-11-26-an-approval-preview-lists-the-change-since-its-cycle-began

## Context

An approval workflow can write its own statuses, carry an existing status across a review, or
leave statuses alone. Starting a preview at the last Approved version therefore mixes different
cycles in some workflows. Restoring that whole snapshot on rejection also discards work that
automation did outside review.

## Decision

1. The triggering edit's predecessor opens the cycle. A replacement task carries the oldest start
   recorded in the workflow runtime for the open tasks it supersedes. The task payload shows the
   start to readers. Only runtime state can set the rollback interval. A task without a recorded
   start uses the triggering edit's predecessor, or the latest edit's predecessor when the trigger
   is unavailable. A create begins at version zero. The preview requires no lifecycle status to
   find its start.
2. Rebuild the preview from stored changes at every approval task write. Follow recorded
   predecessor versions for up to 200 changes and check the oldest change's predecessor. Use the
   workflow's bot bypass rule to skip changes
   written outside review by bots or workflow automation. Preserve edits consolidated in one
   version, and cancel changes taken back within the cycle.
3. The reject step uses the interval the task previewed. Undo reviewed changes newest first,
   leaving later writes in place. On a shared field, a later bot write survives, and a later user
   edit restores the bot's value when rejected. Independent properties and named list elements
   merge separately. If a later edit consolidates into the reviewed version, reject fails and
   the reviewer can retry after the task refreshes. The entity's status returns to the latest
   recorded approval or rejection at the start of the cycle, or to Rejected when no decision is
   recorded. An edit carrying an existing Approved status records another approval only when made
   by a reviewer.
4. A partial history keeps the changes that can still be attributed and reversed, and sets
   `proposedChangesIncomplete`. The task card and task-created notification show the warning. A
   rollback requires a readable predecessor to undo a version. Two snapshots across a missing
   version cannot show which changes came from automation.

## Consequences

- The task payload keeps its existing shape, including `proposedChangesBaseVersion` and
  `proposedChangesIncomplete`. The matching workflow step stores the reviewed interval internally.
- Rollback steps outside this approval flow keep their existing behavior.
- Reading the history is bounded. An incomplete history can show and undo only the changes it can
  still identify, so a partially retained cycle can require manual review.
