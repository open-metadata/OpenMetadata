# Context Center authorizes memory anchors before pagination

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryAnchorIT`, `ContextMemoryVisibilityTest`, `ContextMemorySearchVisibilityTest`
- **Related:** ADR:2026-10-09-search-admits-memories-of-pinned-anchors;
  ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read

## Context

A reader could GET an Approved Entity memory of a table they could view, but could not find it in
the Context Center Memories page or its search unless they selected that table as a filter. The
search visibility rule required a pinned anchor.

## Decision

Search-backed context-memory listings evaluate the current reader's access to every distinct
memory anchor before constructing the visibility filter. Anchors are read by UUID keyset in pages
of 100, using the same live APPLIED_TO and legacy HAS edges as direct memory reads. Legacy domain
assignment edges are excluded. The page size bounds each database read, not the authorized set.
Authorized ids are split into terms clauses of at most 1,024 ids to stay below the engine's terms limit.

Both Elasticsearch and OpenSearch admit Entity and Public memories anchored to that authorized set.
Visibility and status filters run before the engine counts, sorts, or paginates results. Shared and
Private memories retain their existing rules. Pending memories still list only to their owners and
admins. An administrator can inspect everyone's pending memories for review.

General search, vector search, and chat grounding retain the pinned-anchor rule. This change applies
to context-memory listings and their text search, not every broad catalog query.

## Consequences

Context Center agrees with direct reads about anchor access without a new index field or reindex.
A non-admin listing costs a policy check per distinct memory anchor. Access is evaluated for the
current request, so a role, policy, or file-sharing change applies immediately. Database read failures
fail the listing instead of returning an empty authorized set.
