# A missing search lineage root returns 404

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Pere Brull
- **Guard:** `EsUtilsTest`, `OsUtilsTest`, `ESLineageGraphBuilderTest`,
  `OSLineageGraphBuilderTest`, `LineageBidirectionalIT`, `LineageBrokenReferenceIT`
- **Related:** open-metadata/OpenMetadata#36333, open-metadata/ai-platform#1948

## Context
The search lineage endpoints load their root by FQN hash. The Elasticsearch and OpenSearch
single-entity lookup helpers throw `SearchException` both when no hit exists and when the lookup
is ambiguous. That reports a nonexistent lineage root as HTTP 500 to the UI, SDKs and AI tools.

## Decision
Both helpers throw a typed `MissingLineageEntityException` for a successful search with no
matching document. It remains a `SearchException` with HTTP 500 until the root loader converts
it to `EntityNotFoundException` and HTTP 404. Multiple matches, backend failures and transport
failures propagate unchanged. Timed-out responses are rejected before their hit metadata is
discarded, so a partial empty response cannot prove the root is absent. No server error text is parsed.

## Consequences
Only a missing root produces HTTP 404 on either engine. A stale reference to a missing non-root
document remains an operational search failure; it never claims the existing root is absent or
silently returns an incomplete graph. A root 404 means absent from the search index; it does not
prove the asset is absent from the database. Clients that need that distinction must use the
database-backed entity-by-name API. No schema, request parameter or successful response changes.
