# Context Center authorizes memory anchors before pagination

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial); v2 2026-11-12 (evaluate only matching anchors); v3 2026-11-25 (memory-only searches too)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryAnchorIT`, `ContextMemoryVisibilityTest`, `ContextMemorySearchVisibilityTest`
- **Related:** ADR:2026-10-09-search-admits-memories-of-pinned-anchors;
  ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read

## Context

A reader could GET an Approved Entity memory of a table they could view, but could not find it in
the Context Center Memories page or its search unless they selected that table as a filter. The
search visibility rule required a pinned anchor.

## Decision

Search-backed context-memory listings first page a composite aggregation of distinct anchors from
memories matching the listing's text, asset/query filters, non-pending statuses, and Entity/Public
visibility. Each search page contains at most 100 anchors. Only those candidates are resolved through
the same live APPLIED_TO and legacy HAS edges as direct memory reads, in database batches of 100.
Legacy domain assignment edges are excluded. Private, Shared, unanchored and pending-only matches
need no anchor evaluation. An incomplete or timed-out aggregation fails the listing instead of
producing an undercount. Authorized ids are split into terms clauses of at most 1,024 ids.

This supersedes the pinned-anchor requirement and 20-anchor total cap of
ADR:2026-10-09-search-admits-memories-of-pinned-anchors for Context Center listings only. Page sizes
bound each read; they do not truncate the set and hide older matching assets.

Both Elasticsearch and OpenSearch admit Entity and Public memories anchored to that authorized set.
Visibility and status filters run before the engine counts, sorts, or paginates results. Shared and
Private memories retain their existing rules. Pending memories still list only to their owners and
admins. An administrator can inspect everyone's pending memories for review.

General search, vector search, and chat grounding retain the pinned-anchor rule. This change applies
to context-memory listings and their text search, not every broad catalog query.

## Consequences

Context Center agrees with direct reads about anchor access without a new index field or reindex.
A non-admin listing costs a policy check per distinct matching Entity/Public memory anchor. A broad
unfiltered listing still needs every matching anchor to produce exact visibility-filtered totals;
selective requests no longer evaluate unrelated anchors. Access is evaluated for the current request,
so a role, policy, or file-sharing change applies immediately. Database read failures fail the listing
instead of returning an empty authorized set.

## Amendment — 2026-11-25: memory-only searches evaluate matching anchors too

An MCP agent searching memories with `search_metadata(entityType='contextMemory')` could not find a
memory anchored to a glossary term, tag or asset it may read, because it cannot know which anchor to
pin (#36435). A keyword search of the memory index alone now builds its visibility filter the way
the listing does: it collects the anchors of the memories the full query matches (text query and
`queryFilter`), keeps those the caller may read, and admits Entity and Public memories anchored to
them. "Alone" is decided on the resolved name, so `contextMemory` and
`context_memory_search_index` count, and a list of indexes never does. This covers
`/v1/search/query`, its NLQ variant (so the NLQ answer and its fallback agree), `/v1/search/preview`,
`/v1/search/export` and its async form, and `/v1/search/entityTypeCounts` when it counts the memory
index alone, so counts and hits agree.
A search over several indexes keeps the pinned-anchor rule, and so does the memory bucket of a count
over several indexes, so an Explore total matches what that search lists. Hybrid, vector,
chat-grounding, direct-query and aggregation searches keep the pinned-anchor rule too.

Each non-admin memory-only search pages a composite aggregation of its matching anchors (100 per
page) and checks the caller's access to each distinct one, once per query stage: a count with a
fuzzy stage and an exact-identifier search run two stages. It fails, like a listing, when the
aggregation is incomplete. Guard:
`ContextMemoryAnchorIT#aSearchPinnedToAnAnchor_agreesWithRestOnItsMemories`.
