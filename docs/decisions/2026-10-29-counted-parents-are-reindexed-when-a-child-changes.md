# Counted parents are reindexed when a child changes

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `FolderResourceIT#test_folderKeepsItsChildrenCountInSearchThroughAPlainEdit`,
  `GlossaryTermResourceIT#test_parentTermChildrenCountFollowsItsChildrenInSearch`,
  `MetricGroupResourceIT#searchCountsSurviveChildCreateAndPlainEdits`
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
  `postUpdate`, so a move through PATCH, PUT or a bulk update is covered.
- The parent is read again before the refresh, because a reference kept in stored JSON can call a
  deleted parent live. A deleted or missing parent is skipped. So is every child of a hard-delete
  cascade, whose parent goes with it; the soft-delete cascade never calls `postDelete` per child.
- The domain-inheritance parent (`getParentReference`) is a separate hook on purpose: a metric
  does not inherit domains from its parent metric.

## Consequences
- Each create, delete, restore or move of a child costs one parent read and one parent reindex.
- A context file loaded without its folder looks it up, one query, and captures it before a hard
  delete removes the edge.
- Known gaps: a context file moved by a plain PUT, not the move endpoint, does not know its old
  folder, so that folder stays stale. A CSV import cannot move a glossary term, since terms match
  by FQN, and metric CSV moves are refreshed by the metric import path.
