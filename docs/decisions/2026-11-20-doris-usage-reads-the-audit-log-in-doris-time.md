# Doris usage reads `__internal_schema.audit_log`, whose times are in the Doris global time zone

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_query_log_window_is_converted_to_the_doris_time_zone`, `test_usage_reads_the_queries_users_ran`, `test_probe_reads_every_column_of_the_query_log_statement` and `test_unreadable_query_log_is_reported_without_failing_the_run` in `ingestion/tests/unit/source/database/doris/test_doris_usage.py`; `test_usage_resolves_the_internal_catalog_of_the_query_log` in `ingestion/tests/unit/source/database/doris/test_doris_view_lineage.py`
- **Related:** issue #37545, issue #37537, ADR:2026-11-13-doris-internal-catalog-names-the-service-database

## Context

Doris records every statement in the built-in table `__internal_schema.audit_log`: on by default since
3.1.2, kept for 30 days in daily partitions of its `time` column. Doris writes `time`, the start of the
statement, in its global `time_zone`: a background loader formats it, outside any session. The usage
workflow asks for whole UTC days. `catalog` and `db` are those of the session, not of the tables the
statement reads. The table also holds OpenMetadata's own queries, failed statements, statements Doris
runs itself (statistics collection, materialized view refresh), and statements cut at
`audit_plugin_max_sql_length`. Its `queried_tables_and_views` lists the base tables of a view next to
the view.

## Decision

The usage source reads `__internal_schema.audit_log`.

- The UTC window is converted to Doris time with `CONVERT_TZ('<utc>', '+00:00', @@global.time_zone)`,
  compared with `time` as stored, so Doris prunes the daily partitions; the start time is converted
  back to UTC. Doris resolves its own time zone names.
- Usage counts the statements users ran: `is_query = 1`, `is_internal = 0`, state `OK` or `EOF`.
  Queries tagged by OpenMetadata or dbt and truncated statements are left out. The tables of a query
  come from parsing its text, not from `queried_tables_and_views`.
- `catalog` is the query's database: `internal` resolves to the service's database by the record
  above, another catalog keeps its name. `db` is the schema of unqualified names.
- Before reading, the source checks that it can read the columns it uses (releases before 3.1 lack
  `is_internal`) and that `enable_audit_plugin` is true. Neither failure fails the run: it is logged
  and recorded as a warning of the run, naming Doris 4.1 or later and the grant. AutoPilot stops at a
  failed usage agent, before the profiler and classification agents, and the table needs a grant of
  its own.

## Consequences

Usage needs no setup beyond `SELECT_PRIV` on the table, which exposes the SQL of every user; without
it, the usage agent reads nothing and says why. Changing the global `time_zone` shifts the rows
written before the change. Doris 4.0 and later mark a session internal for the rest of its life once
it runs `SHOW TABLE STATUS`, or `SHOW TABLES`, `SHOW DATABASES` or `SHOW [FULL] COLUMNS` with a
`WHERE` (`QueryState.isInternal` is never reset), so the later queries of such a session are not
counted; that is a Doris bug, to be fixed there. Query lineage (issue #37548) is
meant to reuse the statement with its own filters. Revisit if Doris records a UTC time or stops
writing `time` in the global time zone.
