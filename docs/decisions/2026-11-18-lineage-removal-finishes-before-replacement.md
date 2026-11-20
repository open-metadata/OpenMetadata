# Lineage search removal completes before a sequential replacement can be indexed

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** iamcsharper
- **Guard:** `LineageRepositoryTest`, `LineageUtilTest`, `LineageIndexWriteOrderIT`, `ElasticSearchEntityManagerUpdateByQueryRetryTest`, `OpenSearchEntityManagerUpdateByQueryRetryTest`
- **Related:** #38145, #38143, ADR:2026-11-11-a-global-alias-rewrite-targets-only-the-indices-holding-a-match, ADR:2026-11-03-a-failed-background-propagation-is-replayed

## Context

An ingestion workflow can delete an edge and immediately add its replacement with the same
`docUniqueId`. Submitting the removal as a background search task lets it execute after the add,
erasing the replacement from search even though the relationship exists in the catalog database.

## Decision

- Both `LineageRepository` asset-edge removal and `LineageUtil` derived service, domain and
data-product edge removal use synchronous, refreshed update-by-query. The removal operation
finishes before its caller continues, including when a captured `LineageUtil` write is drained
after the database transaction. A sequential replacement cannot be erased by that removal later.
- Before updating, search for the indices containing the matching `upstreamLineage.docUniqueId`.
Skip the update when there are no matches; otherwise update and refresh those indices, using the
existing conflict reconciliation. Preserve the existing bounded aggregation's handling of a full
page and its rejection of partial shard results.
- Checked and runtime search failures during derived-edge removal are logged and enqueue the
downstream entity in `SearchIndexRetryQueue`, because its search document carries the edge. A
search failure must not interrupt catalog operations, whether the write runs inline or is drained
after commit.
- This ordering is specific to removing an individual lineage edge. Inherited-field propagation
retains its asynchronous, sliced, rate-limited execution and recovery policy. It may fan out to
many children; lineage removal must order against a subsequent write of the same edge.

## Consequences

Deletion pays for the pre-search and matching-index update on the calling thread, but does not
open update scroll contexts on every unrelated index behind the global alias. Existing search
failure recovery remains in place; this does not guarantee atomicity with the database or serialize
concurrent callers. Historical missing edges still require repair or reindexing.
