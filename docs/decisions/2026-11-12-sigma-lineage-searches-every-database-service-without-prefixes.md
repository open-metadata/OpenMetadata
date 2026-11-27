# Without Database Service Prefixes, Sigma lineage searches every database service for a unique table

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Sigma connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py`
  (`test_without_db_service_prefixes_a_table_found_in_one_service_is_linked`,
  `test_without_db_service_prefixes_a_table_found_in_two_services_is_not_linked`,
  `test_a_table_found_in_two_configured_services_is_not_linked`)
- **Related:** PR #37296 (`741ddbb134d`); `REVIEW.md` "Lineage does not guess";
  ADR:2026-10-27-hex-project-is-one-data-model-with-a-column-group-per-cell-id

## Context

Before #37296 the Sigma connector searched every database service when no
`lineageInformation.dbServicePrefixes` was set and linked the first search hit, so a table that exists in several
services or databases was linked to whichever came back first. #37296 made the SQL path and the file fallback
resolve within the configured prefixes and link a table only when exactly one matches, and with no prefix it linked
no table at all. Users then got Sigma dashboards with no table lineage unless they listed every warehouse service,
while the other dashboard connectors draw lineage with the field left empty: Tableau, Metabase and Mode search
with service `*` and link every table that matches, Power BI links the first match, and Hex searches every service
and links only a unique match.

## Decision

- With prefixes set, nothing changes: a table resolves inside the configured prefixes and is linked only when
  exactly one table matches across all of them.
- With no prefix, the reference is searched across every database service (the base class's `None` prefix, an
  unscoped search through the shared table binding resolution), and linked only when exactly one table in the whole
  catalog matches. No first hit is taken: the same schema and table in two services, or in two databases of one
  service, leaves the element without that table's lineage.
- The workbook's SQL is parsed in the dialect of its Sigma connection when all its sources use one connection, and
  in ANSI otherwise, since no prefix names a service type.

## Consequences

- `REVIEW.md` "Lineage does not guess" lists a "wildcard service" among the forbidden resolutions. This record
  accepts an unscoped search when the user configured no service, on the condition the rule's first sentence keeps:
  an unambiguous match across everything searched. It is the trade-off Hex already makes; linking every match or
  the first match of a `*` search, as Tableau, Metabase, Mode and Power BI do, stays forbidden here.
- A larger catalog makes ambiguity more likely, so tables with common names (`PUBLIC.ORDERS`) can lose lineage that
  a prefix would have resolved. The connector help tells users to set prefixes in that case.
- A search per distinct table reference, as with one prefix; the per-run resolution cache bounds repeats.
- Mapping a Sigma `connectionId` (its `type`, `account`, `httpPath`) to a database service would narrow the search
  further; it is a new configuration contract and would need its own record.
