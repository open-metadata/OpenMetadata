# A missing search lineage root returns 404

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Pere Brull
- **Guard:** `EsUtilsTest`, `OsUtilsTest`, `LineageBidirectionalIT`
- **Related:** open-metadata/OpenMetadata#36333, open-metadata/ai-platform#1946

## Context
The search lineage endpoints load their root by FQN hash. The Elasticsearch and OpenSearch
single-entity lookup helpers throw `SearchException` both when no hit exists and when the lookup
is ambiguous. That reports a nonexistent lineage root as HTTP 500 to the UI, SDKs and AI tools.

## Decision
Both helpers throw `EntityNotFoundException` for a successful search with no matching document,
so the existing exception mapper returns HTTP 404. Multiple matches remain `SearchException`;
backend and transport failures propagate unchanged. No server error text is parsed.

## Consequences
This applies to every caller of the single-entity lookup, including paged lineage and lineage
node reads, on both search engines. A 404 means absent from the search index; it does not prove
the asset is absent from the database. Clients that need that distinction must use the
database-backed entity-by-name API. No schema, request parameter or successful response changes.
