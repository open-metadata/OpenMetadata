# A Sigma Data Model's lineage links only the sources its elements read

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Sigma connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py` (`test_a_table_an_element_reads_is_linked_to_its_sigma_data_model`,
  `test_a_table_no_element_reads_is_not_linked`, `test_a_sigma_data_model_another_one_reads_is_linked_to_it`,
  `test_a_sigma_data_model_no_element_reads_is_not_linked`)
- **Related:** —

## Context

The Sigma connector ingests each Sigma Data Model as one `DashboardDataModel`, with a `TABLE` column per data model
element. Its upstream lineage comes from `GET /v2/dataModels/{dataModelId}/lineage`. The response mixes element rows,
which carry `sourceIds` (direct sources) and `dataSourceIds` (root sources), with one row per source: `table`
(`inodeId`), `data-model` (`dataModelId`), `customSQL`, `csv-upload` and others.

Sigma describes the endpoint as listing "the elements, data sources, and upstream lineage for those data sources", so
a row is not necessarily read by the data model itself. Sigma's documented example for the workbook endpoint, which
has the same response shape, lists a `table` row that no element's `sourceIds` or `dataSourceIds` names. Linking
every `table` row would add a shortcut edge from a table that feeds another data model straight to the data model
reading that other one.

Neither the spec nor the docs say how an element names its sources. Sigma's examples write ids bare, as `<id>/<suffix>`
(the workbook lineage example's `dataSourceIds`) and with an `inode-` prefix (column ids in the data model
representation example, such as `inode-4exq8bsACBpDyQUvKGGTO0/ORDER_NUMBER`).

## Decision

- A `table` row is linked when an element of the data model names it in `sourceIds` or `dataSourceIds` by its
  `inodeId` or by the `urlId` of its `/files` entry, with or without an `inode-` prefix. The table is resolved as for
  workbook elements: from the `/files` path, then the table's connection path when that finds no single table
  (ADR:2026-11-12-sigma-connection-path-is-read-only-when-the-display-path-finds-no-table), linked only when exactly
  one table matches across `dbServicePrefixes`, or across every database service when none is set
  (ADR:2026-11-12-sigma-lineage-searches-every-database-service-without-prefixes).
- A `data-model` row is linked when an element names it by its `dataModelId` or its `dataModelUrlId`, alone or as
  `<url id>/<element>`.
- Rows of any other type are not linked.
- Edges run from the table or data model to the one `DashboardDataModel` of the Sigma Data Model. Which element reads a
  source, and column lineage, are not represented.

## Consequences

- A source named in a form this rule does not know gets no edge rather than a wrong one. A live response showing
  another form is the reason to extend the rule.
- A table that feeds another data model reaches this one through that data model's own edge, not a direct one.
- Representing per-element sources would need one entity per data model element, which changes data model FQNs and is
  a separate decision.
