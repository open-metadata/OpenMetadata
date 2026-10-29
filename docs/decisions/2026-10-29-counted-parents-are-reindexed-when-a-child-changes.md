# Counted parents are reindexed when a child changes

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `FolderResourceIT#test_folderKeepsItsChildrenCountInSearchThroughAPlainEdit`,
  `GlossaryTermResourceIT#test_parentTermChildrenCountFollowsItsChildrenInSearch`,
  `MetricGroupResourceIT#searchCountsSurviveChildCreateAndPlainEdits`,
  `MetricGroupResourceIT#patchMovesRefreshEveryParentAMetricPassesThrough`,
  `MetricGroupResourceIT#csvReparentRefreshesBothParentsChildrenCount`
- **Related:** #36494, ADR:2026-10-29-search-documents-load-computed-counts-on-every-write

## Context
A parent metric, a parent glossary term and a folder each index a count of their children. Adding,
removing, restoring or moving a child changes that count, but only the child's own document was
rewritten, so the parent's count stayed stale until the parent's next write or a full reindex.
Metrics had their own copy of the refresh; glossary terms and folders had none.

## Decision
- `EntityRepository#getCountingParents` names the entities whose documents count this one. Empty
  by default; a metric returns its parent metric and a context file its folder. A glossary term
  returns every ancestor term, because a term's `childrenCount` counts all nested terms by FQN
  prefix (soft-deleted ones included, as REST reports it).
- The base `postCreate` (single and batch), `postDelete`, `postRestore` and, when the parent
  changed, `postUpdate` refresh that parent's search document. Every updater path reaches
  `postUpdate`, so a move through PATCH, PUT or the bulk API is covered.
- An edit consolidated into the user's previous in-session version reaches `postUpdate` with that
  older version as the original, so the move is also checked against the request's own original.
- The CSV batch update (`updateManyEntitiesForImport`) never runs `postUpdate`. It reads each
  original's counting parents before its flush rewrites the edges and compares them afterwards. A
  repository whose parent lives only in relationships loads it onto the originals first.
- The parent is read again before the refresh, because a reference kept in stored JSON can call a
  deleted parent live. A deleted or missing parent is skipped. So is every child of a hard-delete
  cascade, whose parent goes with it; the soft-delete cascade never calls `postDelete` per child.
- The domain-inheritance parent (`getParentReference`) is a separate hook on purpose: a metric
  does not inherit domains from its parent metric.

## Consequences
- Each create, delete or restore of a child costs one read and one reindex per counting parent: one
  for a metric or context file, one per ancestor for a glossary term. A move pays that for the old
  and the new parent, and a move consolidated into the previous version reindexes the new parent
  twice.
- A context file loaded without its folder looks it up, one query, and captures it before a hard
  delete removes the edge.
- Restoring a glossary subtree refreshes the live ancestors once per restored term. Those
  refreshes change nothing, since the count includes soft-deleted terms, but restore is rare.
