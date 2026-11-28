# Data contract search documents carry their governed entity's domains

- **Status:** Accepted
- **Revisions:** v1 2026-11-28 (initial)
- **Deciders:** Vamsi Krishna
- **Guard:** `DataContractIndexTest`, `DataContractSearchDomainAccessIT`
- **Related:** #39191, #38982, #39118, ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads, ADR:2026-11-19-query-cost-documents-inherit-query-access-fields

## Context

`DataContract` does not have a `domains` field in its entity schema, so `SearchIndex.populateCommonFields` wrote `domains: []` into `data_contract_search_index`. Under search RBAC (`enableAccessControl = true`), `RBACConditionEvaluator.hasDomain()` treats documents with no `domains.id` as domainless and visible to everyone, allowing users confined by `DomainOnlyAccessRole` to discover other domains' data contracts through `/v1/search/query`, `/v1/search/aggregate`, `/v1/search/export`, and other search endpoints.

Post-filtering search responses was rejected because it skews `hits.total`, breaks pagination, cannot protect aggregations or CSV exports, and leaves hidden hit counts observable.

## Decision

Populate top-level `domains` on `data_contract_search_index` documents from the governed entity's effective (direct or inherited) domains in `DataContractIndex.buildSearchIndexDoc(DocBuildContext)`, using batch prefetching in `ReindexingUtil.populateDocBuildContext` for bulk/full reindex and failing closed with `EntityNotFoundException` if the governed entity no longer exists rather than writing an unprotected domainless document.

Keep `data_contract_search_index` synchronized when domains change:

1. Reindex affected data contracts (including soft-deleted contracts via `Include.ALL`) when a direct target entity or any domain-inheriting ancestor changes domains, whether via standard entity updates, CSV bulk imports (`updateManyEntitiesForImport`), bulk/domain asset edits, or `DataProduct` domain moves (`propagateInheritedDomainsToChildren`).
2. Include `data_contract_search_index` (and its staged index during reindexing) in domain FQN prefix rewrites (`updateAssetDomainFqnByPrefix`), domain reference relabels (`referenceCopyTargets`), and domain hard-delete cleanup (`deleteOrUpdateChildren`).

All language variants of `data_contract_index_mapping.json` already map `domains`, and `dataContract` has `parentAliases: []`, so indexing `domains` does not require a mapping change and does not surface data contracts under global `"all"` domain-asset listings.

## Consequences

Existing deployments with historical `data_contract_search_index` documents written before this change must run Search Indexing for `dataContract` so existing documents receive their governed entity's `domains` before relying on domain-scoped search access control. No index recreation or mapping change is required.
