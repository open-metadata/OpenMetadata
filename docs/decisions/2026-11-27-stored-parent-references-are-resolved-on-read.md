# Parent references kept in a child's stored JSON are resolved on read

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** #38950 author and reviewers
- **Guard:** `DatabaseHierarchyIT#childrenShowRenamedParentDisplayNames`, `EntityRepositoryCurrentReferenceTest`
- **Related:** #38939, #38950

## Context

Tables keep `databaseSchema` and `database`, and schemas keep `database`, in their stored JSON,
so reads skip a relationship lookup. The copy holds the parent's name, displayName and
description from when the child was last written. Nothing rewrites it when the parent changes,
so GET, list and a full search reindex returned a renamed parent's old displayName (#38939).

## Decision

A parent reference kept in a child's stored JSON is re-resolved by id on every read:
`EntityRepository.currentReference` on the single-entity path (entity cache), and
`EntityRepository.refreshStoredReferences` on the bulk path (one reference-only query per parent
type per page, never one per entity). A parent that cannot be found keeps its stored copy.
Parent renames are not cascaded onto child rows on write.

## Consequences

A rename stays a single-row write, and rows that are already stale are correct on read without a
migration. Each read pays one cached lookup per stored parent ref, and each bulk page one small
query per parent type. Other entities that keep parent refs in stored JSON (for example
`File.service`/`directory` on the bulk path, `DataContract.entity`) should use the same helpers
rather than cascading on write. Revisit if the stored copies are removed from storage JSON
altogether.
