# A memory cites its supporting Queries, and retiring one holds the memory for review

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `MemoryEvidenceHoldsTest`, `ContextMemoryEvidenceAccessTest`, `ContextMemoryQueryEvidenceIT`
- **Related:** open-metadata/ai-platform#1582; ADR:ai-platform/2026-10-15-a-captured-memory-links-the-saved-queries-that-support-it; ADR:2026-10-09-an-approved-memory-can-return-to-review-and-records-its-last-review; ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory

## Context

AskCollate saves the SQL behind an answer as a `Query`, and a correction deletes the Query it
replaces. Memory capture now links a learning to the saved Queries that support it, through the
existing `relatedEntities` field. When one of those Queries is retired, the memory loses its
evidence, but it stays Approved and keeps grounding answers.

Three facts shape the fix. First, a Query has no `deleted` field, so every delete of one is a hard
delete, including `hardDelete=false`. That delete removes the relationship rows that say which
memories cite the Query. Second, Collate's Memory Reconciliation approves Unprocessed memories
without looking at `relatedEntities`, and it never moves a Draft memory. Third, a Query reference
carries the question its SQL answered, and some people who can read a memory are not allowed to
read the Query.

## Decision

1. **Meaning.** A `query` in a memory's `relatedEntities` (a `RELATED_TO` row from the Query to the
   memory) is evidence: a saved Query whose successful run supports the memory's claim. There is no
   new field, and no SQL text is stored on the memory.
2. **Retirement.** Deleting a Query moves every memory that cites it and is Approved, Unprocessed or
   has no stage to Draft. The `statusReason` is "Supporting query `<id>` was deleted; review whether
   this memory still holds without it". A Draft memory keeps its hold and its reason. A retired
   memory keeps its stage. An Unprocessed memory goes to Draft, not back to Unprocessed, so
   reconciliation cannot approve it without its evidence. The same write removes the Query from
   `relatedEntities`, so the memory's version history records which evidence was lost and its
   search document stops listing a Query that no longer exists. The hold records no disputes, so
   it opens no conflict review task: Draft is the human review queue.
3. **Ordering.** The hold runs in `QueryRepository.preDelete`, before the row removal. Every delete
   path reaches it: a direct delete, and a cascade from the service. If the hold fails, the delete
   is refused. A hold left behind by a failed delete is a false alarm that a reviewer clears. A
   delete with no hold would leave an Approved memory resting on nothing.
4. **Concurrency and idempotency.** For each memory, the hold:
   - reads the memory again and checks that it still cites the Query;
   - writes as `governance-bot` with a guarded PATCH: an `updatedAt` test plus the ETag;
   - on a concurrent edit, reads and decides again, at most three times, then refuses the delete.

   A memory that is already Draft is skipped. So a repeated delete, or a retry after a partial
   failure, writes only what is still missing.
5. **Late links.** Resolving a reference silently drops one to a Query that no longer exists. A
   memory written citing a Query that is gone or deleted is therefore created in Draft with the
   same reason. This covers a capture that races the supersession of its own Query.
6. **Audit.** The reason names the Query by id only. The memory's version history records the move
   to Draft by `governance-bot`. The Query's delete event records its FQN and who deleted it.
7. **Permissions.** Every memory response applies the rule below: get, get by name, list, both
   version endpoints, and the memory that a create, update, patch, pin, unpin, restore or delete
   answers with. When the caller lacks `ViewBasic` on a Query, its reference is reduced to `{id,
   type}`, in place, so the list keeps its order. This also covers the references that a change to
   the links records in the change descriptions. A write's change event is built from its
   response, so it records what that writer may see. Concept-context evidence already requires
   the caller to see both the memory and the Query.
8. **Review queue.** The Context Center Memories list shows Approved, Unprocessed and Draft by
   default, so an evidence hold, which opens no review task, is visible where people look. The
   "Needs review" count keeps counting open conflict review tasks. The sidebar badge and dashboard
   keep counting Approved and Unprocessed memories.

## Consequences

- Saving byte-identical SQL is an upsert of the same Query, not a delete, so it holds nothing.
- A deleted Query cannot be restored, and the held memory does not recover its link. A reviewer
  decides from the reason and the memory's history. If the delete fails after the hold, the
  memory is in review with its link already removed: a false alarm a reviewer clears.
- Deleting a Query costs one relationship lookup. A service delete pays that lookup once for each
  of its Queries.
- One race remains. A memory write that resolves a Query after the delete's lookup, but before the
  row removal, loses its link without a hold. Closing it needs Memory Reconciliation to re-verify
  evidence, which is a Collate change.
