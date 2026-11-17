# MSSQL ALTER TABLE ... SWITCH lineage comes from the definitions of procedures that ran

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/database/test_mssql_switch_lineage.py`
- **Related:** #32616

## Context

A stored procedure that moves data with `ALTER TABLE a SWITCH [PARTITION p] TO b` produced no
lineage. SQL Server records no statement for DDL: on SQL Server 2022, a procedure that only
switches a partition leaves no row in Query Store or in `sys.dm_exec_query_stats`, so both
stored procedure history reads return nothing for it. Only `sys.dm_exec_procedure_stats` shows
that it ran. No SQL parser we use understands `SWITCH` either.

## Decision

- The MSSQL lineage source reads `sys.dm_exec_procedure_stats` for procedures that ran in the
  query log window and whose definition mentions `SWITCH`, and yields every `ALTER TABLE ... SWITCH`
  statement in the definition as a query of that procedure. Statements are matched on a copy of
  the definition with string literals and comments (which nest in T-SQL) blanked and the inside of
  quoted names masked, so `SWITCH` text that is printed, commented out or part of a name is never
  read as a statement. It is read in Query Store and
  plan-cache mode alike, through `StoredProcedureLineageMixin.yield_supplementary_stored_procedure_queries`.
- The read is best effort. It needs `VIEW SERVER STATE` (`VIEW SERVER PERFORMANCE STATE` on 2022),
  which a user who only reads Query Store may lack, so a failed read, including a raw `OSError` that
  mssql+pytds raises on a socket timeout or reset, logs a warning, records a status warning and loses
  only the `SWITCH` lineage. It is not reported as a failure of the run and does not stop the
  lineage read after it. A connection that failed with an `OSError` is invalidated so the pool
  does not hand it out again.
- `LineageParser` rewrites each `SWITCH` into `INSERT INTO b SELECT * FROM a` before parsing, for
  the `tsql` dialect only, so the edge runs from the switched table to the `TO` table, which is the
  direction the rows move. The rewrite uses the same masked matching, so a quoted name that contains
  `SWITCH` text is left as written.

## Consequences

A `SWITCH` is attributed to the procedure's last execution only, since the procedure stats keep
no per-run history, and a procedure evicted from the plan cache before the run is missed. A
`SWITCH` in a branch the run did not take still yields its edge, since only the definition is
known, and a `SWITCH` built in dynamic SQL is not in the definition and stays invisible.
Revisit if SQL Server starts recording DDL statements in Query Store.
