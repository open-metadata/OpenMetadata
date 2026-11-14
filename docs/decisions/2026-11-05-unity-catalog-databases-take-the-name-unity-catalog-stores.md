# A Unity Catalog Database takes the name Unity Catalog stores, not the configured text

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** akashverma0786
- **Guard:** `ingestion/tests/unit/topology/database/test_unitycatalog_configured_scope.py`
- **Related:** ADR:2026-10-19-unity-catalog-lineage-resolves-only-upstreams-across-services

## Context
The connection's `catalog` is free text, and Unity Catalog resolves it case-insensitively: Test
Connection passes for `Demo`, `DEMO` or `demo`. Unity Catalog stores catalog, schema and table names
lowercase, and its system tables report them that way. The source named the Database after the
typed text, so a catalog configured as `Demo` became `svc.Demo`, while lineage, metric-view lineage
and incremental extraction build `svc.demo…` from what Unity Catalog reports and look it up by exact
name. Every lookup missed: the service got no lineage at all, and the run still reported success.
Schemas and tables never had the problem, because they are named from the API.

## Decision
- The Database for a configured catalog is named `catalogs.get(<catalog>).name`, the name Unity
  Catalog returns. Only when that call fails is the configured text lowercased instead.
- A relation that a user writes in text the connector parses, such as a metric view's YAML
  `source`, is lowercased before it is resolved. A scope inherited from the ingested Database is
  used as stored.
- Lookups build FQNs from Unity Catalog's names and match them exactly; they do not search.

## Consequences
Lineage, metric-view lineage and incremental deletion match the ingested entities for any casing
the user types. A service ingested before this change with a mixed-case `catalog` gets a second,
lowercase Database on its next run; the old one keeps its curated metadata and goes stale until it
is deleted. Moving that metadata over needs a Database rename the server does not support today
(`renameAllowed` is off for Database), so it is left to a separate migration. A Unity Catalog name
that is not lowercase would break this rule; the Databricks docs and live checks say there is none.
