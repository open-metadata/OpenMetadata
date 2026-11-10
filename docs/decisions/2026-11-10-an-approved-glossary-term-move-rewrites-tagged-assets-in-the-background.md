# An approved glossary term move rewrites its tagged assets in the background, in commit order

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `WorkflowDefinitionResourceIT#test_approvedGlossaryTermMoveRewritesTaggedAssetsInSearch`, `GlossaryTermMoveApproval.spec.ts`, reviewer
- **Related:** #37466, #37467, #36705, ADR:2026-10-30-a-glossary-term-move-is-authorized-and-held-as-the-patch-that-makes-it, ADR:2026-11-03-a-failed-background-propagation-is-replayed

## Context

A move or rename of a glossary term rewrites the tag FQN of every asset tagged with the term or a
descendant. The rewrite is one `_update_by_query` with `refresh=true` across the global search alias.
An unheld move runs as a background job (`moveAsync`), so nobody waits for it. A held move, once
accepted, is applied inside the reviewer's `POST /tasks/{id}/resolve`. In nightly AUT that rewrite
took about 60 s and then failed with `429 too many scroll contexts`, so the review request timed out.

## Decision

- The database side of an approved move or rename (term, descendants, tag usages, relationships)
  stays in the request's transaction.
- When the update applies an approved change request (`EntityUpdater.isApprovedChange()`), the
  tagged-asset rewrite is submitted after commit and the request does not wait for it. Search is
  eventually consistent for that path. A failed rewrite is queued in `SearchIndexRetryQueue` by
  `updateGlossaryTermByFqnPrefix`, as before.
- A direct PATCH still waits for its rewrite, so it keeps read-your-write behaviour.
- Every glossary-term tagged-asset rewrite, waited on or not, runs on one single-threaded lane per
  server (`GlossaryTermRepository.ASSET_REWRITES`), in the order the post-commit drains submit
  them. A later rename (B→C) therefore cannot scan its matches while an earlier rewrite (A→B) is
  still going through the index, which would leave documents tagged `B` with no failure reported.

## Consequences

A reviewer's accept returns as quickly as an unheld move does. The cost is that rewrites queue
behind one another on a server: a PATCH rename can wait for a slow background rewrite that started
before it. Ordering is per server and starts at the post-commit drain, so it does not cover two
servers, or two commits whose drains run in the opposite order to their commits. Neither was
covered before either. Glossary renames (`GlossaryRepository`) and replays from the retry queue
still run outside the lane. Revisit with per-glossary lanes if the queue becomes a bottleneck, or
with a task-based rewrite (`wait_for_completion=false`, as ADR:2026-11-03-a-failed-background-propagation-is-replayed
does for propagation) if the waiting PATCH path also needs to drop its synchronous wait.
