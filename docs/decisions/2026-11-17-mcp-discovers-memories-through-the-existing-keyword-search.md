# MCP agents discover memories through the existing keyword search before answering

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Contributor implementation for #36435
- **Guard:** `McpContextDiscoveryGuidanceTest`,
  `ContextMemoryAnchorIT#aSearchPinnedToAnAnchor_agreesWithRestOnItsMemories`
- **Related:** #36435; ADR:2026-10-09-search-admits-memories-of-pinned-anchors;
  ADR:2026-11-12-context-center-authorizes-memory-anchors-before-paging

## Context

An organizational question can depend on a Context Center Memory, for example one about how
customers are identified. `search_metadata` already returned memories when asked for
`entityType='contextMemory'`, but nothing in the published tools told an agent to look. And for a
non-owner, a memory attached to a glossary term, tag or asset was returned only when the query
pinned that anchor. In a test with a real MCP client, the agent searched memories when told to but
never pinned the right anchor among a dozen candidate glossary terms, so it answered without the
memory.

## Decision

- `search_metadata` says, in one sentence, to check memories with `entityType='contextMemory'`
  before answering a business question, and which fields to request. `find_context` says it does
  not search memories.
- A search of the memory index alone evaluates the anchors of its matching memories, as Context
  Center listings do (ADR:2026-11-12-context-center-authorizes-memory-anchors-before-paging, v3),
  so the agent needs no anchor pin.
- No new tool. The guidance stays short because every tool description is sent to every MCP client
  on each `tools/list`.

## Consequences

- An agent that follows the description finds the memories, anchored or not, that the caller may
  read.
- A non-admin memory-only search also aggregates its matching anchors and checks access to each
  distinct one (ADR:2026-11-12-context-center-authorizes-memory-anchors-before-paging, v3).
