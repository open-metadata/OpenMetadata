# OpenSearch vector indexes keep embeddings in stored source

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OpenSearchVectorReaderIT` and `OsUtilsTest`
- **Related:** [#35914](https://github.com/open-metadata/OpenMetadata/issues/35914), [k-NN#3138](https://github.com/opensearch-project/k-NN/pull/3138)

## Context

On OpenSearch 3.4.0, concurrent updates, merges and scroll cleanup can leave derived-source
vector readers closed. Subsequent embedding updates fail with `already_closed_exception`
even while the cluster is healthy. The regression test reproduced this for entity and chunk indexes.

## Decision

Create OpenSearch vector indexes with `index.knn.derived_source.enabled=false` and
`index.knn=true`. Entity mappings and both live and staged chunk mappings load these settings
from `openmetadata-spec/src/main/resources/elasticsearch/opensearch_vector_index_mapping.json`.
The resource is OpenSearch-specific; Elasticsearch mappings do not consume it.

## Consequences

Embedding generation, vector indexing and kNN queries remain enabled. Keeping vectors in
`_source` increases disk usage; the increase depends on the data and is not measured here.
The setting is static, so existing indexes need a full reindex that recreates the indexes.
Revisit the workaround when every supported OpenSearch version contains the upstream reader fix
and the regression passes with derived source enabled.
