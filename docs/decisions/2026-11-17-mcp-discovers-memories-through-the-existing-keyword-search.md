# MCP agents discover memories through the existing keyword search before answering

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Contributor implementation for #36435
- **Guard:** `McpContextDiscoveryGuidanceTest`
- **Related:** #36435; ADR:2026-10-09-search-admits-memories-of-pinned-anchors

## Context

An organizational question can depend on a Context Center Memory, for example one about how
customers are identified. `search_metadata` already returns memories when asked for
`entityType='contextMemory'`, but nothing in the published tools told an agent to look. For a
non-owner, a memory attached to a glossary term, tag or asset is returned only when the query
pins that anchor (ADR:2026-10-09-search-admits-memories-of-pinned-anchors), so a keyword search
alone misses it.

## Decision

- No new tool and no change to retrieval. `search_metadata` says, in a few sentences, to check
  memories before answering a business question, which fields to request, and that an anchored
  memory needs a `term` on `primaryEntity.id` in `queryFilter` with the anchor's id.
- `find_context` says it does not search memories and points to `search_metadata`.
- The guidance stays short because every tool description is sent to every MCP client on each
  `tools/list`. Trust, provenance and conflict handling are left to the client.

## Consequences

- An agent that follows the descriptions finds anchored memories it can read; one that skips the
  pin still misses them.
- A server-side lookup (for example `find_context` returning memories) would remove the pin step;
  it is not part of this change.
