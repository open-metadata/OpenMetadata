# Bulk entity deletes pin the primary-key index with an optimizer hint

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Ontology Studio program
- **Guard:** `OntologyConcurrentHardDeleteIT.concurrentRecursiveHardDeletesOfLargeOntologiesBothSucceed`
- **Related:** `EntityDAO.deleteByIds`, `EntityDAO.primaryKeyHint`

## Context
Two large ontologies hard-deleted at the same moment deadlocked on MySQL. A recursive hard delete
removes rows in chunks with `DELETE FROM <table> WHERE id IN (...)`. When table statistics are
stale, as right after a bulk load, MySQL planned a full scan. Under REPEATABLE READ the scan takes
next-key locks on every row it passes, including rows of the other ontology that the other delete
had already locked in its earlier statements. Each delete then waited on the other.

## Decision
`EntityDAO.deleteByIds` emits `DELETE /*+ INDEX(<table> PRIMARY) */ FROM <table> WHERE id IN
(...)` for every entity type, so the statement locks only the primary-key ranges of the rows it
deletes.

Tried and rejected:
- READ COMMITTED for the delete transaction did not remove the deadlock.
- `FORCE INDEX (PRIMARY)` is a syntax error in a single-table `DELETE`.

PostgreSQL reads the hint as a comment. JDBI does not expand `<table>` inside a comment, so the
hint is built whole and passed as a define.

## Consequences
- Concurrent bulk deletes of different entities no longer lock each other's rows when statistics
  are stale.
- The hint names `PRIMARY`, so a table renamed away from a primary key on `id` would need the hint
  revisited.
- `OntologyConcurrentHardDeleteIT` seeds two 400-concept ontologies, purges them together for
  three rounds and asserts both succeed and the database deadlock counter does not rise. It runs
  on MySQL only.
