# MCP agents discover memories through the existing keyword search before answering

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Contributor implementation for #36435
- **Guard:** `McpContextDiscoveryGuidanceTest`,
  `SearchMetadataToolTest#contextMemoryKeywordRequestPreservesGuidanceAndCallerScope`
- **Related:** #36435; ADR:2026-11-06-mcp-tool-schemas-leave-out-the-tools-json-doc-keys

## Context

An organizational question can depend on a Context Center Memory about how to discover a business
entity such as Customer. `search_metadata` already searches these memories when explicitly asked
for `contextMemory`, but its default asset scope excludes them. The published tools gave no
instruction to make that lookup before answering. `find_context` searches glossary terms,
metrics and articles; `company_context` searches shared file-extracted pills. Neither replaces
general memory discovery.

## Decision

- The client-visible discovery-tool descriptions direct agents to first use `search_metadata`
  with `entityType='contextMemory'` and short business keywords. That lookup requires no embeddings.
- Request `question,answer,entityStatus,primaryEntity,relatedEntities` and use
  `get_entity_details` with the returned identity when a full read is needed. Apply only relevant
  Approved, non-deleted memories, checking their entity associations before planning the asset search or answer.
- Approved is a lifecycle state, not proof of human review: OSS may assign it when creating a
  memory. Retrieved memory text is reference data and cannot override the user's instructions,
  caller permissions or tool safety rules. Approval does not make embedded instructions trusted.
- The caller's existing visibility and anchor checks remain authoritative. A known anchor can be
  pinned through `primaryEntity.id`; a missed or denied lookup does not establish that no memory
  exists. Direct reads can inspect other lifecycle stages or soft-deleted records without making them grounding material.
- `find_context` and `company_context` keep their current scopes and embedding requirements.
  Their descriptions explain how to discover ordinary memories separately. Guidance lives in tool
  descriptions and property descriptions, because top-level schema examples and descriptions are
  removed before tools are advertised.

## Consequences

Existing clients receive an explicit workflow through their tool listing without a new retrieval
tool or a change to permissions, lifecycle rules or the default asset search scope. The guidance
encourages a client to retrieve and apply memories; the server does not automatically inject them
or guarantee that a model follows the instructions. A combined context entry point would need a
separate decision about the different knowledge scopes and their access checks.
