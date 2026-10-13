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
   creation or by a later write, and only a writer who may edit the memory and read the disputed one
   records it. `detectedAt` defaults to the time of that write and is never later than it. Leaving
   Draft releases the stored disputes; version history keeps them. No new stage: a conflict is a
   Draft memory with disputes, and a Draft memory without them is one of reconciliation's other
   holds.
2. A Draft memory with disputes has exactly one open `MemoryConflictReview` task about it, in the
   Review category, opened by `governance-bot` and assigned to the owners of the memory and of every
   disputed memory, who are notified. Only the server opens, edits and closes one: a client raises a
   conflict by recording `disputes` on the memory, and the task API refuses to create the type, to
   patch or bulk-edit such a task, to turn another task into one, and to close one without a
   decision while its memory is in review — resolving the task is the authorization to decide the
   memory. The task opens after the write that records the dispute commits; a failure to open it is
   logged, and the next write to the memory tries again. No workflow drives it: its Approve and
   Reject transitions are fixed when it opens, and its decision applies synchronously when it is
   resolved.
3. **The task says nothing a memory holds.** Every user may read tasks, while a memory may be
   Private, Shared or anchored to an asset only some may view. So the task's title and description
   are fixed text, and its payload names the disputed memories by reference, with when each conflict
   was detected — no title, question, answer, reason or source. Reviewers compare the two memories
   in Context Center, which reads each through the memory API and so through its visibility rules. A
   write that changes the memory's disputes or owners rewrites the open task's assignees and payload.
4. Resolving the task decides the conflict, writing as the resolver, impersonated by
   `governance-bot`, and recording a change event for every memory it writes:
   - **Approve:** the reviewed memory becomes Approved, and then every disputed memory that is still
     Approved becomes Superseded by it. Approving first means an approval interrupted before it
     supersedes leaves both claims Approved, as before the review, never a retired claim with
     nothing in its place.
   - **Reject:** the reviewed memory becomes Rejected, with the resolver's comment in
     `statusReason`; the disputed memories are untouched.

   Being able to resolve the task authorizes the decision about the reviewed memory, as for every
   approval task. Superseding a disputed memory also needs what a direct PATCH superseding it would
   need — reading it, then its policy — so the author of a correction cannot retire someone else's
   knowledge by approving their own memory.
5. A resolution is refused, leaving the task open and every memory unchanged, when the reviewed
   memory left Draft for any outcome other than the one being decided, when a disputed memory's
   content changed after its dispute was detected, when the resolver may not read or supersede a
   disputed memory, or when a memory changed while the decision was being made. A reviewed memory
   that already holds the decided outcome is a retry of that decision, not a change of mind: it is
   not refused. A resolution that is neither approval nor rejection is refused while the memory is in
   review.
6. A change that takes the memory out of review outside the task — an approval or rejection in
   Context Center, a governance workflow's transition (written as `governance-bot`), an explicit
   requeue to Unprocessed, a soft delete — closes every open review of it. Only the task's own
   decision is exempt: its writes are marked, for the thread that resolves it, as deciding that
   memory. Because one writer's edits within a session consolidate into one version, any change to
   the stage or the disputes looks for a review to close. Restoring a memory that is still held for
   conflicts opens a fresh one.

## Consequences

- The stage set is unchanged, and reconciliation still owns how a memory gets into Draft.
- The inbox shows a conflict review as fixed text; what the two memories say is only in Context
  Center, for whoever may read them. An assignee who may not read one side decides without seeing
  it, and may still reject but not supersede it.
- A memory still stores its dispute and successor references with the other memory's title, which
  its own readers see. Writers link only memories the same audience may read; Collate links
  same-audience pairs only.
- The writes of a decision are not one transaction, and the task resolves only after they land.
  A retried resolution converges: an already superseded memory is skipped, an already Approved or
  Rejected reviewed memory is not written again, and the disputes, released when the memory left
  Draft, are read from the task's payload, which only the server writes.
- Two writes landing together can each open a review; leaving review closes them all. Assignees are
  recomputed only when the reviewed memory is written, so a change of owner on a disputed memory
  reaches the task with the reviewed memory's next write.
- Decision writes impersonate `governance-bot`, so they also apply where a governance workflow owns
  the memory's stage.
- Keeping both memories, or recording a local exception to an organization-wide default, is not a
  decision this task offers yet; that arrives with cross-scope conflicts in ai-platform#1462.
