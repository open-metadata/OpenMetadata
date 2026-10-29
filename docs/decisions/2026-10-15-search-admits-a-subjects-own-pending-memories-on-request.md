# Search admits a subject's own pending memories when the caller asks for them

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemorySearchVisibilityTest` (the owner-pending cases),
  `VectorSearchQueryBuilderTest` (the owner-pending cases)
- **Related:** https://github.com/open-metadata/ai-platform/issues/1728;
  ADR:2026-10-09-search-admits-memories-of-pinned-anchors;
  ADR:ai-platform/2026-10-05-new-memories-await-reconciliation-and-approved-memories-stay-authoritative

## Context

A memory the agent saves, or a user saves through it, is written `Unprocessed` and becomes
`Approved` only when reconciliation or a person approves it. Normal search admits Approved memories
only (`SEARCHABLE_STATUSES`), so until then its author's next conversation cannot find it, and the
user has to repeat themselves. Approval decides what everyone else reads; it should not decide
whether the author can use what they said.

## Decision

- `ContextMemorySearchVisibility.OWNER_PENDING_STATUSES` is `Unprocessed` and `Draft`, the two
  stages of a memory still awaiting review.
- A vector or hybrid caller asks for them through its `entityStatus` filter;
  `ContextMemorySearchVisibility.ownerStatuses(filters)` returns the requested values that are in
  that list. No other value widens anything: a caller asking for `Superseded` still gets nothing
  the status constraint does not admit.
- For an identified subject, the memory clause then also admits memories the subject owns
  (`owners.id`) in those stages, whatever their visibility: an admin is widened to their own
  memories, never to everyone's. An unidentified subject is never widened.
- Without the request the filter is exactly what it was. Two renderings change together:
  `ContextMemorySearchVisibility.buildVisibilityFilter` (the four-argument overload) and
  `VectorSearchQueryBuilder`, where the owner's branch comes last so the others keep their place.
  REST needs no change: an owner already reads their own memories in every stage there.

## Consequences

- Collate's hybrid search passes `ownerStatuses(filters)` to its lexical leg; its KNN leg derives
  it from the same filters inside `VectorSearchQueryBuilder`. The agent asks for
  `Approved, Unprocessed, Draft` where it reads memories to ground an answer, and keeps asking for
  `Approved` only where a memory is a comparison reference.
- A pending memory reaches its author and nobody else. Whether it should outweigh an Approved one
  it contradicts is the reader's decision, not search's.
- `Archived`, `Superseded`, `Invalidated`, `Rejected` and `Deprecated` stay out of normal search
  for everyone; the Context Center listing still selects stages explicitly with `statuses=`.
