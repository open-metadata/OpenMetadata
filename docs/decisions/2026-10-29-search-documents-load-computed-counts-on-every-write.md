# Search documents load computed counts on every write

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial) · v2 2026-11-14 (folders index no `childrenCount`)
- **Deciders:** Vishnu Jain
- **Guard:** `SearchIndexFactoryTest#fieldsLoadedOnWriteAreAlsoReindexFields`,
  `SearchIndexFactoryTest#computedCountsAreLoadedOnWrite`,
  `TeamMembershipSearchIT#teamCreatedWithAUserKeepsItsUserCountThroughAPlainEdit`,
  `MetricGroupResourceIT#csvReimportKeepsAParentsChildrenCount`,
  `FolderResourceIT#test_folderSearchDocumentCarriesNoChildrenCount`,
  `SearchRepositoryTest#testUpdateEntitiesBulkQueuesRetryWhenFieldsLoadedOnWriteFail`,
  `SearchRepositoryTest#testCreateEntitiesIndexQueuesRetryWhenFieldsLoadedOnWriteFail`,
  `EntityRepositoryBulkFieldsTest#loadFieldsForSearchIndex_rejectsAFieldWithNoFetcher`
- **Related:** #36494, ADR:2026-10-29-parent-metric-reads-carry-up-to-25-variant-expressions

## Context
A live create, a versioned update and a CSV import each build the search document from the entity
that operation holds, which carries only what it loaded. A count computed on read, such as a
team's `userCount` or a metric's `childrenCount`, arrives as null or as a placeholder 0 and is
written as 0, so search filters, sorts and MCP results report a wrong count until a full reindex.
The bulk updater path already reloads every reindex field before it writes; the live paths did not.

## Decision
- `SearchIndex#getFieldsLoadedOnWrite()` names the computed fields an index writes that a live
  write never carries. Today: metric `childrenCount`, metric group `metricCount`, team
  `userCount`, glossary term `childrenCount`.
- `SearchRepository` loads those fields onto a copy of the entity, with the repository's field
  fetchers, before building the document on create, on a full-document update, on bulk create and
  on bulk update (CSV import). The caller's entity, and so the API response, is not changed.
- Every field loaded on write is also in `getRequiredReindexFields()`, so reindex writes the same
  value, and has a fetcher in its repository's `fieldFetchers`. Loading one without a fetcher fails
  the write to the retry queue rather than indexing 0.
- A type that declares no fields pays nothing: no copy and no read.
- The bulk paths load once per batch. If that load fails, the batch goes to the search retry queue,
  which re-reads every reindex field, instead of being written with zeros or not written at all.
- Folder reindex also loads `parent`, which `FolderIndex` writes but reindex never loaded.
- Glossary term documents now carry `childrenCount`, which the mapping declared but no write
  path or reindex ever loaded.

## Consequences
- Each write of a declaring type reads its counts once, batched on the bulk paths. A metric or
  metric group count is one query; a team's `userCount` walks the team's sub-tree, so a
  write to a large team or the organization costs that walk. A glossary term count is one prefix
  query per term, so a glossary reindex also runs one per term.
- The parent refresh path, which already reads every reindex field, counts once more.
- This replaces the per-repository `postUpdate` loading of `childrenCount` and `metricCount` that
  MetricRepository and MetricGroupRepository carried. Metric and metric group PATCH/PUT responses
  no longer include those counts unless asked for.
- A new computed field that an index writes has to be declared here, or it is indexed as 0 again.
  Loading every reindex field on every write would remove that step, but adds reads such as table
  joins and usage to every write of every type.

## Amendment

### v2 2026-11-14 — folders index no `childrenCount`

A folder's `childrenCount` counts only the files its reader may see
(ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read), so no single
indexed value is right for every reader. `FolderIndex` no longer writes it, and a folder declares
no field loaded on write. Documents indexed earlier keep the old value until the folder is next
written or reindexed.
