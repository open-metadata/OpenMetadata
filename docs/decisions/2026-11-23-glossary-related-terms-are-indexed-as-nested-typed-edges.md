# Glossary related terms are indexed as nested typed edges with exact keyword values

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Search and Ontology / Governance maintainers
- **Guard:** `GlossaryTermIndexMappingTest`, `IndexMappingNestedFieldConsistencyTest`,
  `GlossaryTermIndexTest`, `GlossaryTermRepositoryOntologyTest`,
  `SearchConsumerFieldBehaviorIT`, `GlossaryTermRelatedTermsSearchIT`
- **Related:** #33457, #33454, ADR:2026-10-29-search-documents-load-computed-counts-on-every-write

## Context

`GlossaryTerm.relatedTerms` stores `TermRelation` edges (`type/termRelation.json`), each carrying
`id`, `relationType`, `relationshipType`, `term`, `provenance` (`Manual`, `Inferred`, `Imported`,
`AiSuggested`), `status` (`EntityStatus`), `createdBy`, and `createdAt`. All five localized
`glossary_term_index_mapping.json` files (`en`, `jp`, `ko`, `ru`, `zh`) still mapped `relatedTerms`
as a flat `object` holding only legacy `EntityReference` keys (`id`, `type`, `name`,
`fullyQualifiedName`, `description`, `deleted`, `href`).

As a result, `relationType`, `provenance`, `status`, and `term.*` had no explicit mappings: queries
and aggregations against fresh indexes could not filter on them, dynamic mapping turned enum strings
into analyzed `text` fields (breaking exact-match filters and `terms` aggregations), and plain
`object` array flattening allowed cross-edge false positives when combining predicates such as
`provenance=AiSuggested` with `status=Draft`. Live writes also left peer terms' inverse edges stale
in search and failed to clear `relatedTerms` when the last edge was removed.

## Decision

- Map `relatedTerms` as `"type": "nested"` in every localized `glossary_term_index_mapping.json`
  (`en`, `jp`, `ko`, `ru`, `zh`) with explicit properties matching `type/termRelation.json`:
  `id`, `relationType`, `provenance`, `status`, `createdBy`, `createdAt` (`date`, `epoch_millis`),
  `relationshipType`, and `term`.
- Map `relationType`, `provenance`, `status`, `createdBy`, `term.fullyQualifiedName`, and
  `relationshipType.fullyQualifiedName` as plain `keyword` without `lowercase_normalizer`. Callers
  query exact schema values (`broader`, `partOf`, `AiSuggested`, `Draft`, `In Review`) inside a
  `nested` query on path `relatedTerms`, and `terms` aggregations preserve canonical bucket keys.
- Require recreating/reindexing `glossary_term_search_index` on upgrade, because Elasticsearch and
  OpenSearch cannot convert an existing `object` mapping to `nested` in place.
  `IndexMappingVersionTracker` detects the hash change across the locale mappings and schedules
  `glossaryTerm` for recreate-reindex.
- Keep live search documents consistent on both sides of a relation without waiting for reindex:
  stamp persisted metadata (`id`, `relationshipType`, `createdBy`, `createdAt`) onto added
  `TermRelation` instances during storage, write an explicit empty list `[]` when a term's last
  relation is removed so `DEFAULT_UPDATE_SCRIPT` clears `ctx._source.relatedTerms`, and refresh
  affected peer glossary terms via `searchRepository.updateEntitiesByReference` on create, update,
  rename, soft/hard delete, and restore. Cascade renames and soft deletes also refresh peers of
  affected descendants. If the batch cannot reload the peer documents, queue a retry for each peer.

## Consequences

- Agents, stewardship review queues, and REST/MCP search callers can query per-edge combinations
  (such as `provenance=AiSuggested` AND `status=Draft`) and aggregate by `relationType`,
  `provenance`, or `status` accurately on `glossary_term_search_index` in every supported language.
- Callers querying `relatedTerms.*` must wrap predicates in a `nested` query targeting path
  `relatedTerms` (just like `owners` and `customPropertiesTyped`).
- Existing clusters must run a recreate reindex of `glossary_term_search_index` after upgrading for
  `nested` queries on `relatedTerms` to succeed; pre-reindex clusters continue serving normal term
  searches because no unconditional query filters on `relatedTerms`.
- `VectorDocBuilder` embedding text and fingerprints are unchanged, so upgrading does not trigger
  extra embedding calls.
