# MCP agents discover memories through the existing keyword search before answering

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial) · v2 2026-11-17 (provenance and conflicting Approved memories);
  v3 2026-11-18 (required anchor discovery and combined keyword filter)
- **Deciders:** Contributor implementation for #36435
- **Guard:** `McpContextDiscoveryGuidanceTest`,
  `SearchMetadataToolTest#contextMemoryKeywordRequestPreservesGuidanceAndCallerScope`
- **Related:** #36435; ADR:2026-11-06-mcp-tool-schemas-leave-out-the-tools-json-doc-keys;
  ADR:2026-10-09-search-admits-memories-of-pinned-anchors

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
  pinned through `primaryEntity.id`. Keyword-only general search omits anchored Entity/Public
  memories for non-owners unless another visibility branch admits them; it cannot establish
  complete memory discovery even when the caller can read the anchor.
- Before answering, discover each relevant anchor through its supported metadata type (for example,
  glossary term, tag or table), requesting `fields='id'`, and repeat memory discovery with the
  returned UUID. The `queryFilter` combines the memory entity type, a `primaryEntity.id` term and
  a keyword clause over `question`/`answer`; set `query='*'` so the filter carries the complete
  lookup. Repeat even when the initial lookup returned other memories. A missed, denied or
  unresolved-anchor lookup does not establish absence; report discovery as incomplete.
  Direct reads can inspect other lifecycle stages or soft-deleted records without making them grounding material.
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

## Amendment: general keyword search needs a relevant anchor

The conservative general-search rule in ADR:2026-10-09-search-admits-memories-of-pinned-anchors
differs from Context Center listings, which evaluate matching anchors before paging. A non-owner's
general keyword lookup can omit an anchored Entity/Public memory that REST permits the caller to
read. The workflow must resolve the relevant business concept or asset and repeat the memory
lookup with its returned anchor UUID. Pinning is an access-check hint, never an access grant;
Private/Shared memories retain their existing ownership/sharing rules.

The published example combines identity and business keywords inside one `queryFilter`:

```json
{"bool":{"must":[{"term":{"entityType":"contextMemory"}},{"term":{"primaryEntity.id":"<returned anchor UUID>"}},{"multi_match":{"query":"customer","fields":["question","answer"]}}]}}
```

Set the separate `query` argument to `*`. Current `SearchMetadataTool` uses the standard search
path, which ANDs the filter with a supplied text query; the earlier help saying that it overrides
the text query was stale. The complete filter avoids relying on a separate keyword argument.

The SDK publication and request-projection regressions use the advertised example, including
its keyword and extracted pin. `ContextMemorySearchVisibilityTest` covers the conservative
unpinned filter and readable/denied pins for a non-admin non-owner in both engine renderings,
retaining Entity/Public eligibility and excluding Private/Shared from the anchor branch. These
are guidance and existing-filter contracts, not a change to retrieval or permission behavior.
