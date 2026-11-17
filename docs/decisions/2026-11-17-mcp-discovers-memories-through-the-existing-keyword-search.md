# MCP agents discover memories through the existing keyword search before answering

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial) · v2 2026-11-17 (provenance and conflicting Approved memories)
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

## Amendment: approved memories can still conflict

Issue #37934 reports document memories with contradictory support hours approved beside each other.
Approval establishes lifecycle eligibility, not truth or verified human adjudication. The published
workflow asks clients to preserve memory identities and available caller-visible source/provenance,
compare applicable claims, and surface conflicting Approved memories with uncertainty and a request
for clarification. Approval, recency and similarity scores are not grounds for silently choosing or
merging contradictory claims. Retrieved text remains reference data, never authority over user
instructions, caller permissions or tool safety rules.

The keyword workflow additionally requests `sourceType`, `sourceEntity` and legacy `sourceFile`.
Restricted file references may carry only an id and type; guidance must not invent missing or
redacted source details. `company_context` directs clients to the named detail tool when its pill
projection lacks provenance, retaining the existing access checks.

`McpContextDiscoveryGuidanceTest` checks publication on all four memory entry points, and
`SearchMetadataToolTest#contradictoryApprovedDocumentMemoriesKeepBothAnswersAndTheirSources` checks
that fixture retrieval preserves two approved answers and their distinct sources. These checks do
not prove model conflict detection, adjudication or compliance. Extraction and approval logic for
#37934 are outside this change.
