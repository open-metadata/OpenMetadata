# Query cost documents inherit the query access-control fields

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `QueryCostRecordIndexTest`
- **Related:** #38197, #38219

## Context
Query cost documents contain the query SQL. Search authorization applies top-level domain, owner,
tag and tier predicates, so nested query fields alone cannot protect those documents.

## Decision
Index the parent query's owners, domains, classification/glossary tags and dedicated tier at the top
level. All language mappings declare the matching keyword fields and nested owners. Both search
engines consume these mappings. A missing parent query must fail indexing instead of creating an
unprotected document.

## Consequences
Existing cost indexes must be rebuilt with the new mapping and reindexed from source; an in-place
mapping update cannot convert a dynamically created object owner field to nested. Run Search
Indexing for `queryCostRecord` with the job's `recreateIndex` option enabled. Keep the existing index
until the rebuild succeeds using the application's normal index-switch workflow. A normal incremental
indexing run alone does not repair the old mapping or populate every historical document.
