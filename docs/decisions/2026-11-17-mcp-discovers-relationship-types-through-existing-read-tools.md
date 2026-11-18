# MCP discovers relationship types through the existing read tools

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial); v2 2026-11-18 (link the ontology write follow-up)
- **Deciders:** Contributor implementation for #33459
- **Guard:** `RelationshipTypeToolDiscoveryTest`, `RelationshipTypeReadContractTest`,
  `SearchMetadataToolTest#relationshipCatalogSearchPreservesConstraintsAndContinuesTheCallersPage`
- **Related:** #33459; ADR:2026-11-05-search-metadata-counts-exactly-and-pages-within-the-result-window

## Context

The governed `relationshipType` catalog has its own search index. Explicit `search_metadata`
and named `get_entity_details` reads already work without RDF, but their advertised descriptions
did not explain how to discover the catalog or retrieve its semantic constraints. Adding another
search-backed read tool would duplicate that capability.

## Decision

- Advertise the explicit `relationshipType` search, its additional constraint/lifecycle fields,
  cursor continuation and named detail reads in the existing client-visible tool descriptions.
- Preserve the existing authorization model. Search follows the deployment's search access-control
  setting; named details authorize the caller against the entity. Discovering a definition is no
  permission to use or edit it. This guidance does not claim that search and the canonical REST
  catalog listing have identical authorization behavior.
- Reject negative search sizes and offsets, including offsets decoded from cursors, before querying
  the backend. Size zero remains a count request; existing coercion, maximum page size and result
  window remain unchanged.

## Consequences

Agents can discover the existing read path and inspect governed constraints without a new tool,
RDF dependency or permission change. Search remains index-backed and subject to its existing
result window and access-control configuration. The typed relation and change-set workflow is
specified separately in ADR:2026-11-18-mcp-ontology-writes-reuse-authorized-rest-actions.
