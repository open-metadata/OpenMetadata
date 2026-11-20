# Doris usage reads `__internal_schema.audit_log`, whose times are in the Doris global time zone

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_query_log_window_is_converted_to_the_doris_time_zone`, `test_usage_reads_the_queries_users_ran` and `test_unreadable_query_log_fails_with_the_grant_it_needs` in `ingestion/tests/unit/source/database/doris/test_doris_usage.py`
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
- Before reading, the source fails when it cannot read the table, naming the grant, and warns when
  `enable_audit_plugin` is false.

## Consequences

Usage needs no setup beyond `SELECT_PRIV` on the table, which exposes the SQL of every user. Changing
the global `time_zone` shifts the rows written before the change. Query lineage (issue #37548) is
meant to reuse the statement with its own filters. Revisit if Doris records a UTC time or stops
writing `time` in the global time zone.
