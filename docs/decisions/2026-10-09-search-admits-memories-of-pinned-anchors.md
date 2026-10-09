# Search admits an anchored memory when the query pins its anchor and the caller can read it

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemorySearchVisibilityTest`, `VectorSearchQueryBuilderTest`,
  `ContextMemoryAnchorPinsTest`, `ContextMemoryVisibilityTest` (the pinned-anchor cases), and the
  pinned-search cases of `ContextMemoryAnchorIT`
- **Related:** ai-platform#1580 (option 1); OpenMetadata#34647, which introduced the conservative
  anchor rule this refines; ADR:2026-10-09-data-consumers-create-context-memories

## Context

Since #34647 search admits an `Entity` or `Public` memory to a non-admin only when its document is
marked `anchorId: unanchored`. An anchored memory matches only its owners, its `Shared` principals
and admins, because search cannot evaluate the anchor's policy for every indexed hit. REST applies
the real rule: whoever may `ViewBasic` the anchor reads the memory (`ContextMemoryVisibility`).

The agent reads an asset's memories through Collate's hybrid search as the user: the entity memory
fetch behind both "Institutional knowledge" blocks, and capture's duplicate probe. So knowledge
anchored to an asset reached only its authors and admins, while `/context` and
`GET /v1/contextCenter/memories?primaryEntityId=` showed the same memories to every reader of the
asset.

## Decision

- A search can name the anchors it asks about (`ContextMemoryAnchorPins`): the `primaryEntityId`
  filter of vector and hybrid search, and `term` or `terms` clauses on `primaryEntity.id` (or
  `primaryEntity.id.keyword`) anywhere in a query or post filter except under `must_not`, which
  covers `/v1/search/query`, entity-type counts, the aggregation endpoint and the search-backed
  Context Center listing (`assets=`).
- For a restricted subject (identified and not an admin), each named anchor is resolved to its type
  through the memory anchor edge that `ContextMemoryRepository#getPrimaryEntity` reads (APPLIED_TO,
  or the older HAS from anything but a domain) and evaluated by the REST rule
  (`ContextMemoryAnchorAccess`: `ViewBasic`, plus the file's own sharing for a `ContextFile`
  anchor). The memory clause then also admits `Entity` and `Public` memories whose `anchorId` is one
  of the readable anchors. `Private` and `Shared` memories are never admitted through an anchor.
- At most 20 named anchors are evaluated per filter (`ContextMemoryVisibility.MAX_PINNED_ANCHORS`).
  Ids past the cap, ids that do not parse and entities that anchor no memory are ignored. An anchor
  whose lookup or authorization fails is not readable.
- The ids are only a hint of which anchors to evaluate. A memory is admitted through the new branch
  only when its own anchor passed the REST rule, so a hint the query does not actually filter on
  cannot reveal a memory REST would hide.
- The lookup reads edges into context memories only: MySQL serves it from `idx_entity_rel_cascade`,
  PostgreSQL from the partial index `idx_entity_relationship_memory_anchor` added in 2.1.0. Without
  it a pinned domain or team would scan an edge per asset or user it holds.
- The three renderings of the rule change together: `ContextMemorySearchVisibility`
  (`OMQueryBuilder`), `VectorSearchQueryBuilder` (raw JSON) and `ContextMemoryVisibility` (REST,
  whose anchor rule is the one being evaluated).

## Consequences

- The agent's entity memory fetch and capture's duplicate probe, which both pin `primaryEntityId`,
  get an asset's memories exactly when REST shows them; ranking and paging stay the engine's.
- Free text that names no anchor keeps the conservative rule, so a non-owner's global search still
  does not find anchored memories. Closing that needs anchor access in the index (option 3 of the
  issue), with a reindex whenever an anchor's access changes.
- The anchors are evaluated each time a visibility filter is built: once or twice for a search, per
  entity type for entity-type counts, per page for paged vector search. Each evaluation is one
  indexed lookup and up to 20 policy checks, and none happens for admins, anonymous callers or
  queries that pin nothing.
- Search reads the anchor and visibility a memory was indexed with. If re-anchoring a memory or
  making it private fails to reindex, readers of the old anchor still find it by pinning that
  anchor, where before they could not. REST stays exact.
- Search does not repeat REST's `ViewBasic` check on the memory itself unless search RBAC filtering
  is on, the same as for every other search hit.
- Collate's hybrid search must pass the pinned anchors to its lexical leg
  (`buildVisibilityFilter(subject, statuses, ContextMemoryAnchorPins.of(filters, queryFilter))`);
  the KNN leg reads them from the filters it already passes. Until it does, the lexical leg keeps
  the conservative rule.
- A query that pins more than 20 anchors admits the memories of the first 20 only. Raise the cap
  only with a reason: each anchor is a policy evaluation on the request path.
