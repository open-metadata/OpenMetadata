# A scheduled repair on one server at a time replaces the weekly search reindex

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `SearchRepairIT`, `SearchIndexRecoveryIT`, `SearchRepairJobTest`,
  `ChangedDocumentsRepairTest`, `SearchIndexCheckTest`, `RepairByEntityTypeTest`,
  `ReindexScheduleMigrationTest`
- **Related:** `docs/plans/2026-10-06-database-search-indexing-design.md`,
  `docs/plans/2026-10-06-database-projection-implementation.md` (step 3),
  ADR:2026-10-10-the-api-never-waits-for-search

## Context

With search written after the commit, a write can be lost with its process, a propagation can
miss a child, and an index can disappear or lose its alias. The weekly full reindex was the only
thing that caught these, a week late and at the cost of rewriting every document.

## Decision

- Every 15 minutes, starting 2 minutes after startup, one server runs a repair pass, holding
  `SEARCH_REPAIR_LOCK` in `search_reindex_lock` (30 minute lease); the window it has checked is
  kept in `projection_repair_state`, so any server can run the next pass.
- A pass rebuilds the documents of rows changed since the last pass (5 minutes of overlap, the
  newest minute left to live writes, one hour back on the first pass) whose document is missing or
  was read before the row last changed, and the children of a changed parent read in the 10
  minutes before it changed. Once a day it deletes documents whose rows are gone.
- Each pass checks that every type's index exists and carries its alias; a type still broken a
  minute later gets its templates rewritten, its index created and a forced reindex of just that
  type.
- A failure on one row or type is queued for retry and does not stop the pass; only a database or
  search outage keeps the window for the next pass. A type whose table has no `updatedAt` column is
  covered by the daily sweep and full rebuilds only.
- The search reindex app ships with no schedule. The 2.2.0 migration moves installs on the shipped
  Sunday 00:30 schedule to on-demand runs and keeps any schedule an operator set.

## Consequences

Search heals within about 15 minutes of a lost write, without a weekly full rewrite; a full
reindex is for upgrades that change mappings and for emergencies. A repair pass reads the changed
rows of every type through the `(updatedAt, id)` index, so a type without that column or index is
slower to heal.
