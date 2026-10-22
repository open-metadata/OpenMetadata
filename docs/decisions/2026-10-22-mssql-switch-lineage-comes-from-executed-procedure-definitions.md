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
  in the definition, comments removed, as a query of that procedure. It is read in Query Store and
  plan-cache mode alike, through `StoredProcedureLineageMixin.yield_supplementary_stored_procedure_queries`.
- The read is best effort. It needs `VIEW SERVER STATE` (`VIEW SERVER PERFORMANCE STATE` on 2022),
  which a user who only reads Query Store may lack, so a failed read logs a warning and loses only
  the `SWITCH` lineage. It is not reported as a failure of the run.
- The parser rewrites a `SWITCH` into `INSERT INTO b SELECT * FROM a` before parsing, so the edge
  runs from the switched table to the `TO` table, which is the direction the rows move.

## Consequences

A `SWITCH` is attributed to the procedure's last execution only, since the procedure stats keep
no per-run history, and a procedure evicted from the plan cache before the run is missed. A
`SWITCH` built in dynamic SQL is not in the definition and stays invisible. Revisit if SQL Server
starts recording DDL statements in Query Store.
