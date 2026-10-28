# Paged search indexes sort last on id.keyword, and paginate_es refuses a null tiebreaker

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `ingestion/tests/unit/ometa/test_es_mixin_pagination.py`
  (`test_pagination_raises_before_yielding_a_page_with_no_id_tiebreaker`),
  `KnowledgePageIndexMappingTest`
- **Related:** #36012, open-metadata/openmetadata-collate#7201

## Context

`paginate_es` walks a search index with `search_after`, passing back the last hit's `sort` values.
The server makes that walk deterministic by appending `name.keyword` and then `id.keyword` to every
sort (`appendDeterministicTiebreak` in `ElasticSearchSearchManager` and `OpenSearchSearchManager`).
`knowledge_page_search_index` mapped `id` as text with no `id.keyword`, so the tiebreaker sorted as
null. Each next page then started again with the previous page's last hit, and an AI Automation over
Context Center articles processed boundary articles twice and, at the end, the same article forever.

## Decision

- The server's search sort ends with `id.keyword` (unless the caller sorts on `id.keyword` itself).
- Every index mapping the ingestion client pages through `ES_INDEX_MAP` exposes `id.keyword`.
- `paginate_es` treats a null last sort value as a missing tiebreaker and raises
  `SearchCursorStalledError` ("Reindex it") before it yields that page, so no entity is handed out
  twice. A cursor that comes back unchanged raises the same error.

## Consequences

- Reordering or dropping the server tiebreak, or adding a paged index without `id.keyword`, makes
  `paginate_es` fail on that index; restore the tiebreak or add the subfield.
- An index built before its mapping gained `id.keyword` fails until it is reindexed.
- A caller that sorts on `id.keyword` gets `name.keyword` as its last sort value; revisit the guard
  if such a caller appears.
