# The Glue test connection probes what ingestion reads, within a fixed table budget

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Ingestion team
- **Guard:** `ingestion/tests/unit/source/database/glue/test_connection.py`
  (`test_glue_source_probes_with_a_pipeline_only_schema_filter`,
  `test_pipeline_filters_match_fully_qualified_names_with_use_fqn_for_filtering`,
  `test_get_tables_stops_once_the_table_scan_budget_is_spent`,
  `test_get_tables_stops_once_the_database_scan_budget_is_spent`,
  `test_get_tables_stops_paging_databases_once_a_table_is_found`,
  `test_get_tables_matches_the_table_filter_on_the_name_ingestion_keeps`,
  `test_get_tables_flags_a_count_cut_short_by_the_scan_budget`)
- **Related:** open-metadata/OpenMetadata#36348, open-metadata/OpenMetadata#36347

## Context
The Glue `GetTables` check probed the first databases `GetDatabases` returned, ignoring every filter
pattern. Glue raises `AccessDeniedException` for a database the identity cannot read (a
cross-account resource link, for one) instead of returning an empty list, and `GlueSource` runs the
check before ingestion starts. A database the filters exclude could therefore abort the metadata
agent. Matching filters while paging introduces a second risk: a selective filter that keeps
nothing can read an entire large catalog and outrun the step timeout.

## Decision
- The probe skips every database and table the filters exclude, matched the way ingestion matches
  them: the database pattern against the catalog ID (not applied when `databaseName` is set), the
  schema pattern against the Glue database name, the table pattern against the table name cut to
  its first 128 characters (as ingestion stores it), or
  their fully qualified names when `useFqnForFiltering` is set.
- Which patterns: the startup test connection of an ingestion run uses the **pipeline's**
  (`sourceConfig`) patterns, handed over by `GlueSource` through `GlueConnection.scope_to`. A
  standalone test connection, which has no pipeline, uses the connection's default patterns.
- The probe reads at most `MAX_TABLES_TO_SCAN` = 1000 tables in total, across all probed
  databases. Spending the budget without finding a kept table returns the non-blocking "Table
  probe stopped early" caveat, never a failure and never the "ingestion would collect nothing"
  caveat. A count of kept tables found before the budget ran out is reported as a floor
  ("scan stopped after 1000 tables read; more may exist").
- Likewise, finding the databases to probe reads at most `MAX_DATABASES_TO_SCAN` = 1000 databases;
  running out first returns the same non-blocking caveat, worded for whether the filters kept no
  database or kept some that exposed no table. Database paging stays lazy, so a database that
  proves access stops further `GetDatabases` requests.

## Consequences
A filter excluding an unreadable database is enough to pass the check; no grant on that database is
needed. The probe proves only that some targeted table is listable, not that every targeted
database is readable — ingestion still reports a denied database as a per-schema failure. The
two budgets keep the check to about ten `GetDatabases` and ten `GetTables` pages; revisit it if the step timeout
changes or a catalog's kept tables routinely sort behind more than 1000 excluded ones.
