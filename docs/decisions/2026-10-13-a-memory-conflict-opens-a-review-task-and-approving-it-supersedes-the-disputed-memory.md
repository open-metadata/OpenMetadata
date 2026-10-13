# A memory conflict opens a review task, and approving it supersedes the disputed memory

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryLifecycleTest`, `MemoryConflictDecisionTest`,
  `MemoryConflictReviewTasksTest`, `MemoryConflictResolutionTest`, `ContextMemoryLifecycleIT`,
  `ContextMemoryConflictReviewIT`
- **Related:** open-metadata/ai-platform#1462;
  ADR:2026-10-09-an-approved-memory-can-return-to-review-and-records-its-last-review;
  ADR:ai-platform/2026-10-05-new-memories-await-reconciliation-and-approved-memories-stay-authoritative

## Context

Collate's Memory Reconciliation moves a memory that contradicts Approved knowledge to Draft and
explains why in a free-text `statusReason`. Three things were missing for a person to settle it.
Nothing told anyone a decision was waiting. The Draft memory did not say which memory it
contradicted, so a reviewer could not open the other side. And approving it left the contradicted
memory Approved, so both claims went on grounding answers until a later revalidation noticed.
`disputes` existed for a different idea — two owners' contradicting memories that both stay
Approved — and nothing wrote it.

## Decision

1. `disputes` are the unresolved conflicts that hold a Draft memory in review: each names an
   Approved memory that contradicts it, at most once. Only a Draft memory records a dispute, at
   creation or by a later write. `detectedAt` defaults to the time of that write. Leaving Draft
   releases the stored disputes; version history keeps them. No new stage: a conflict is a Draft
   memory with disputes, and a Draft memory without them is one of reconciliation's other holds.
2. A Draft memory with disputes has exactly one open `MemoryConflictReview` task about it, in the
   Review category, opened by `governance-bot` and assigned to the owners of the memory and of every
   disputed memory. Only the server opens one: the task API refuses to create the type or to patch a task into or out of it. The task opens after the
   write that records the dispute commits; a failure to open it is logged, and the next write to the
   memory tries again. No workflow drives it: its Approve and Reject transitions are fixed when it
   opens, and its decision applies synchronously when it is resolved. The task names every memory
   by its title, because memory names are generated: its payload records the reviewed memory's
   `memoryTitle` and each disputed memory with its title as the display name, as do the
   `supersededBy` and dispute references a memory stores. A write that changes
   the memory's title, disputes or owners rewrites the open task's title, description, assignees
   and payload, so the task shows what its decision acts on.
3. Resolving the task decides the conflict, writing as the resolver, impersonated by
   `governance-bot`:
   - **Approve:** every disputed memory that is still Approved becomes Superseded by the reviewed
     memory, and then the reviewed memory becomes Approved.
   - **Reject:** the reviewed memory becomes Rejected, with the resolver's comment in
     `statusReason`; the disputed memories are untouched.

   Being able to resolve the task authorizes the decision about the reviewed memory, as for every
   approval task. Superseding a disputed memory also needs the right to supersede it directly — the
   policy check its own PATCH would face — so the author of a correction cannot retire someone
   else's knowledge by approving their own memory.
4. A resolution is refused, leaving the task open and every memory unchanged, when the reviewed
   memory is no longer Draft, when a disputed memory's content changed after its dispute was
   detected, or when the resolver may not supersede a disputed memory. A decision made against claims
   that no longer hold, or by someone without authority over them, is not applied.
5. A change that takes the memory out of review outside the task — an approval or rejection in
   Context Center, an explicit requeue to Unprocessed, a soft delete — closes the open task.
   Restoring a memory that is still held for conflicts opens a fresh one.

## Consequences

- The stage set is unchanged, and reconciliation still owns how a memory gets into Draft.
- The server checks that whoever records a dispute can read the disputed memory, but it cannot check
  every assignee. Writers link only memories the review audience may read; Collate links
  same-audience pairs only.
- The writes of an approval are not one transaction. Superseding before approving makes a retried
  resolution converge: an already superseded memory is skipped.
- Keeping both memories, or recording a local exception to an organization-wide default, is not a
  decision this task offers yet; that arrives with cross-scope conflicts in ai-platform#1462.
