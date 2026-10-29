# Microsoft Fabric puts the OpenMetadata query header inside the statement

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Akash Verma
- **Guard:** `ingestion/tests/unit/connections/test_query_headers.py`
  (`test_sql_server_family_connections_dispatch_to_the_inline_header[microsoftfabric]`,
  `test_a_fabric_engine_attaches_the_header`); Collate
  `ingestion-extension/tests/unit/topology/database/test_microsoft_fabric_usage.py::test_statements_the_connector_runs_are_left_out_of_query_history`
- **Related:** [OpenMetadata #36532](https://github.com/open-metadata/OpenMetadata/pull/36532),
  [Collate #7986](https://github.com/open-metadata/openmetadata-collate/pull/7986)

## Context

OpenMetadata tags the SQL a connection runs with a `/* {"app": "OpenMetadata", ...} */` header when the
connection has `supportsQueryComment`, so that usage and lineage can leave those statements out of query
history. Two things kept the Fabric connector's own SQL in its history:

- The Microsoft Fabric connection had no `supportsQueryComment`, so its SQL was never tagged. One metadata run
  of a warehouse added 443 untagged rows. One run pushed a user's query out of a usage run with `resultLimit`
  300; at the default of 1000, three runs (1,326 rows) did.
- Fabric's query history (`queryinsights.exec_requests_history`) drops a statement's leading comments, although
  Microsoft documents `command` as the complete text. Probed live on a warehouse, six times over two days:
  `/* {"app": "OpenMetadata", ...} */ SELECT 'marker' AS x` is stored without the header, and
  `SELECT /* {"app": "OpenMetadata", ...} */ 'marker' AS x` is stored with it. So a header placed first would
  still be lost.

## Decision

The Microsoft Fabric connection has `supportsQueryComment`, and `headers.py` places its header after the
statement's first word. The OpenMetadata exclusion in Collate's `FABRIC_SQL_STATEMENT` matches the header
anywhere in the statement, never only at its start. OpenMetadata #36532 merges before Collate #7986, whose
tagging test needs the header on OpenMetadata `main`.

## Consequences

The header is part of the stored statement text, so a Fabric history filter anchored at the start of the
statement misses it. Revisit if a statement sent with the header first comes back from `queryinsights` with it.
