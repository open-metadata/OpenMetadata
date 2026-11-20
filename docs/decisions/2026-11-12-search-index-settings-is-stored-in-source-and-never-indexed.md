# searchIndexSettings on the search_entity index is stored in _source and never indexed

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Vamsi-klu, OpenMetadata maintainers
- **Guard:** `SearchEntityIndexMappingTest`, `SearchConsumerFieldBehaviorIT`, reviewer for queries targeting `searchIndexSettings.*`
- **Related:** #35796, #37635

## Context

Ingested `searchIndex` entities carry external cluster settings as an open `Map<String, Object>` in
`searchIndexSettings`. OpenSearch k-NN indices emit both scalar keys such as `"index.knn": true`
and nested or dotted keys such as `"index.knn.algo_param.ef_search": 100` (or
`"index": {"knn": {"algo_param": ...}}`). When `searchIndexSettings` is left to dynamic object
mapping in `search_entity_index_mapping.json`, Elasticsearch and OpenSearch expand dotted paths and
reject indexing and reindexing with
`mapper_parsing_exception: can't merge a non object mapping [searchIndexSettings.index.knn] with an object mapping`.
Dynamically indexing arbitrary external cluster settings also risks field-mapping explosion on
`search_entity_search_index`.

## Decision

- `searchIndexSettings` is declared as `"type": "object", "enabled": false` under
  `mappings.properties` in all five locale mappings
  (`openmetadata-spec/src/main/resources/elasticsearch/{en,zh,ko,jp,ru}/search_entity_index_mapping.json`).
- `SearchEntityIndex.buildSearchIndexDoc()` continues emitting `searchIndexSettings` intact in
  `_source`, while the search engine neither parses nor indexes its subfields.
- No backend search query, filter, sort, or aggregation may target `searchIndexSettings` or any
  `searchIndexSettings.*` subfield.

## Consequences

Reindexing and live indexing of `searchIndex` entities succeed regardless of scalar-versus-object
path collisions or arbitrary external setting keys, and `_source.searchIndexSettings` round-trips
losslessly across all supported mapping languages.

On upgraded clusters whose existing `search_entity_search_index` already dynamically mapped
`searchIndexSettings` subfields, an in-place `putMapping` (`OpenSearchIndexManager.updateIndex` and
its Elasticsearch equivalent) is rejected because an already-mapped object cannot be switched to
`enabled: false` in place. Because startup `putMapping` errors are caught and logged, other in-place
mapping updates to `search_entity_search_index` are also skipped until the index is rebuilt.
Operators on affected clusters must run the Search Indexing application once with **Recreate
Indexes** enabled after upgrade.

Revisit only if a feature requires filtering or aggregating on a specific normalized index setting,
in which case extract a dedicated typed top-level mapping field rather than re-enabling dynamic
subfield indexing on `searchIndexSettings`.
