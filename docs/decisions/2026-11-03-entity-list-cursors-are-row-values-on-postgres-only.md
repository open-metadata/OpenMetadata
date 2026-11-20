# Entity list cursors are row values on PostgreSQL and the expanded OR on MySQL

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Sergei Glotov (proposed); OpenMetadata maintainers (review)
- **Guard:** `EntityListCursorPlanTest` (each PostgreSQL row-value query starts its index scan at
  the cursor); `PaginationIT.testTablePaginationWithSameNameInSeveralSchemas` and
  `PaginationIT.testSchemaPaginationWithSameNameInSeveralDatabases` (order and completeness under
  name ties, on both databases)
- **Related:** #36977; `EntityDAO.listBefore` / `listAfter`; #28888

## Context

`EntityDAO.listAfter` and `listBefore` page entity lists by `(name, id)`. The cursor condition was
`name > :afterName OR (name = :afterName AND id > :afterId)` on both databases. PostgreSQL derives
no index bound from that `OR`: under `ORDER BY name, id LIMIT n` it walks the name index from the
first row and filters out every row before the cursor, so one page costs time proportional to its
position and a full listing is quadratic. On 1M tables a page in the middle of the list took
~590 ms; paging all 100k tables of a smaller catalog took 24.4 s.

A row value, `(name, id) > (:afterName, :afterId)`, means the same rows (SQL-standard row
comparison; both columns are `NOT NULL`) and becomes an `Index Cond` on the table's name index
(`idx_table_entity_name_id` in the benchmark), so the scan starts at the cursor. The same page takes
~1.2 ms and the full listing 1.06 s.

MySQL is the opposite. It range-scans the expanded `OR`, but a row constructor that follows another
predicate on the index (`deleted = FALSE AND (name, id) > (...)`) uses only the index prefix, and
the MySQL manual recommends the `OR` form ("Row Constructor Expression Optimization").
`WsRelayDAO.fetchAfter` records the same limitation.

## Decision

- The `POSTGRES` variants of the `EntityDAO` `listBefore` / `listAfter` queries that take a
  `<cond>` or a `<mysqlCond>` / `<postgresCond>` pair compare the cursor as a row value: `(<table>.name, <table>.id) > (:afterName, :afterId)`
  for `listAfter`, `<` with `:beforeName, :beforeId` for `listBefore`.
- MySQL variants keep `name > :afterName OR (name = :afterName AND id > :afterId)` and its mirror.
- Queries shared by both databases are split into `MYSQL` and `POSTGRES`
  `@ConnectionAwareSqlQuery` variants rather than using one form for both.
- DAOs that declare their own list SQL still use the expanded `OR` on both databases, among them
  `DirectoryDAO`, `FileDAO` and `SpreadsheetDAO` (which override the shared pair),
  `ContainerDAO.listRootBefore` / `listRootAfter`, `IngestionPipelineDAO`, `QueryDAO` and the
  users-in-team listing. Converting one follows this record.
- The `EntityDAO` pair that takes `<groupBy>` (test suites) keeps the `OR` on PostgreSQL too. Its
  `GROUP BY` reduces to the primary key, so PostgreSQL hashes and sorts the page instead of reading
  it in `(name, id)` order; a plan check showed no index bound gained from the row value.

## Consequences

Paging cost of these queries on PostgreSQL no longer depends on how deep the cursor is. The cost is two SQL texts
per query that must stay equivalent; a change to one variant's filter or ordering has to be made in
the other. Unifying them on the row value would regress MySQL; unifying them on the `OR` would
bring back the PostgreSQL rescan. A bounded form,
`name >= :afterName AND (name > :afterName OR (name = :afterName AND id > :afterId))`, works on
both but adds a redundant predicate to MySQL's plan; revisit if the per-database split becomes a
maintenance burden.
