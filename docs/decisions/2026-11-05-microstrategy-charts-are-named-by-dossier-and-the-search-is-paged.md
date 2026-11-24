# MicroStrategy charts are named by dossier, and the dossier search is paged and project-scoped

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial) · v2 2026-11-12 (configurable Library path) · v3 2026-11-12 (charts renamed by a server migration) · v4 2026-11-13 (2.0 backport renames charts in 2.0.9) · v5 2026-11-13 (documents told apart by viewMedia; cube SQL parsed once) · v6 2026-11-14 (column-level lineage)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_microstrategy.py` (`test_charts_of_different_dossiers_do_not_collide`, `test_search_is_scoped_by_the_project_header_and_paged`, `test_a_failed_project_search_keeps_every_stale_entity`, `test_a_custom_library_path_replaces_the_default`, `test_an_empty_library_path_falls_back_to_the_default`, `test_dashboard_url_uses_the_library_path`, `test_documents_are_skipped_without_reading_their_definition`, `test_cube_sql_is_parsed_once_for_every_prefix_and_dossier`, `test_projections_are_matched_on_the_columns_they_read_not_their_aliases`, `test_a_schema_attribute_form_maps_to_the_column_the_cube_reads`, `test_every_form_of_an_attribute_maps_to_one_attribute_column`, `test_a_cte_is_never_read_as_the_table_it_is_named_after`, `test_same_named_tables_are_told_apart_by_their_qualifiers`, `test_an_unnest_or_values_source_is_never_read_as_a_table`); `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/MicroStrategyChartRenameMigrationIT.java`
- **Related:** ADR:2026-10-30-an-empty-seen-set-deletes-the-scope-only-when-the-connector-confirms-its-listing

## Context
The MicroStrategy connector named a chart `<pageKey><visualizationKey>`, such as `K53W63`. Those
keys are unique only within one dossier: on the MicroStrategy demo server, 14 of the 176 chart names
built that way from 21 dossiers repeated, one of them 6 times. Every dossier sharing a name pointed
at the same chart entity, overwritten by whichever dossier was ingested last.

The quick search (`GET /searches/results`) was sent with a `project_id` query parameter, which the
server ignores. Each project's search returned every dossier the user can read in every project
(1379 rather than 518 for one project on the demo server), so each dossier was ingested once per
project, labelled with the wrong project, and its definition read once per project. The search
also asked for every result in one response (`limit=-1`).

## Decision
- A chart is named `<dossierId>_<pageKey><visualizationKey>`: the old name with the dossier id as
  a prefix, so a migration can build it from what is stored. Page and visualization keys contain
  no underscore, so the name is unambiguous and needs no FQN quoting.
- The search is scoped by the `X-MSTR-ProjectID` header and paged 500 results at a time
  (`SEARCH_PAGE_SIZE`). Projects are filtered by `projectFilterPattern` before their dossiers are
  searched.
- When a dossier's existing dashboard or charts cannot be read from OpenMetadata, its dashboard
  and charts are left as they are and stale charts are not deleted in that run. A chart list
  built without that read would unlink them.
- A server migration (`MicroStrategyChartRename`) renames the charts already ingested: 2.0.9 on
  the 2.0 line and 2.1.0 on 2.1, so every upgrade to either, from 1.x or 2.0.x, runs it. Every release since the connector was added
  (1.6) named a dashboard by its dossier id and a chart `<pageKey><visualizationKey>`, so each chart
  a dashboard links becomes `<dashboardName>_<oldName>` in place and keeps its id, tags, owners,
  followers and threads. A chart the old names made shared by several dashboards is renamed for
  the one whose id sorts first and copied, with its user-added metadata, for each of the others.
  Copying it in the connector instead would keep one-off migration code in every run.
- The migration reads charts through the repository, so it runs in a version whose code matches
  the schema: 2.0.9 on the 2.0 line, and on 2.1 after the 2.1.0 conversation and custom property
  migrations. A chart already named after its dashboard is skipped, so a 2.0.9 install upgraded
  to 2.1 renames nothing twice.
- A chart request names its dashboard once that dashboard exists. A chart update without
  `dashboards` deletes the dashboard → chart relationship server-side. A new dashboard is created
  after its charts and links them itself.
- `username` and `password` are optional in the connection schema. The login sends them only when
  they are set, so the Anonymous login mode (8) works without credentials. The login request times
  out after 10 s to connect and 60 s to read (`LOGIN_TIMEOUT`); every other call keeps the REST
  client's (10, 300).
- A client certificate and key in SSL Config are sent for mutual TLS whatever Verify SSL is set to.
- Cube SQL and owner email lookups are cached per id in a 512-entry LRU (`CACHE_SIZE`), failures
  included.
- A run that could not list every project's dossiers, or dropped a listed object that did not
  parse, deletes no stale dashboard, chart or data model. `markDeleted*` would otherwise
  soft-delete what a non-empty seen-set leaves out, and the `SourceListing` confirmation only
  governs an empty one.
- A dossier whose definition cannot be read is still ingested from its listing. It keeps the charts
  it already has linked, and they count as seen, so stale charts are still deleted. Its data models
  are not linked from the dashboard, so a run with such a dossier deletes no stale data model.

## Consequences
- The upgrade renames every MicroStrategy chart, and the first ingestion run finds them under
  their new names. A copy made for a shared chart has a new id, so its followers are copied but its
  votes, threads and manually drawn lineage stay on the renamed original. A chart linked to no
  dashboard keeps its old name and is soft-deleted as stale.
- A server that keeps failing to render some definitions keeps stale data models until it renders
  them. Reverting that needs a per-dossier stale scope, which `deleteStale` does not have.

## Amendment: v2 2026-11-12, configurable Library path
The connector appended a hardcoded `MicroStrategyLibrary` to `hostPort`. A Library web app deployed
under another name, or a second Library deployment on the same server, could not be ingested:
putting its path in `hostPort` produced `<path>/MicroStrategyLibrary/api` and a 404.

- `hostPort` is the MicroStrategy server root, with no path.
- `libraryPath` names the Library web app. It defaults to `MicroStrategyLibrary`; surrounding
  whitespace and slashes are stripped, and an empty value falls back to the default
  (`DEFAULT_LIBRARY_PATH`).
- The connector calls `<hostPort>/<libraryPath>/api` for login and every REST call, and builds
  dashboard source URLs as `<hostPort>/<libraryPath>/app/<projectId>/<dossierId>`.
- A login that answers 404 says to check the Host and Port and the Library Path, not the credentials.

A saved connection without `libraryPath` resolves to the URLs it used before, so no migration is
needed. A `hostPort` that still carries a Library path is not rewritten: guessing whether a trailing
path segment is a Library app would misread servers mounted under a path of their own.

## Amendment: v4 2026-11-13, the 2.0 backport renames charts in 2.0.9
v3 said a 2.0 backport would register the chart rename in 2.0.8. 2.0.8 was released before the
rename merged, so the backport adds it as a new 2.0.9 migration; on 2.1 it stays in 2.1.0. The
Decision section says so.

## Amendment: v5 2026-11-13, documents are told apart by viewMedia; cube SQL is parsed once
The quick search returns Report Services documents, document templates and themes with the same
type (55) and subtype (14081) as dossiers. The connector read each one's definition from the dossier
API, which answers HTTP 500 for a document; on 2.0 the client then failed with `KeyError: 'message'`
on the error body. On the demo server, 640 of the 1312 type-55 objects are not dossiers.

- A search result is a dossier when `viewMedia & 0xE8000000 == 0x60000000`: bits 30 and 29 set,
  bits 31 and 27 clear. This is the rule MicroStrategy's own SDK applies (`mstrio-py`,
  `is_dashboard`); no other field of the search result tells them apart. A result without
  `viewMedia` is read as a dossier, as before.
- Anything else is skipped before its definition is read, recorded as filtered, and counted as
  listed and filtered, so a project holding only documents still confirms its listing. One warning
  per project gives the count.
- A document the dossier API happened to render was ingested before and is now soft-deleted as
  stale on the next run. Ingesting documents through `/api/documents/{id}/definition`, whose datasets
  have the dossier's shape but whose visualizations sit in layouts and panel stacks, is left for a
  later change.
- A cube's tables are parsed once per cube and dialect (`CACHE_SIZE` LRU, failures included). The
  base class asks for lineage once per `dbServicePrefixes` entry, so a cube was parsed once per
  prefix and per dossier using it.
- A table the cube SQL qualifies with a database (a BigQuery project) is searched for only under a
  prefix that names that database or, for a bare service name, whose service holds it. A service's
  database names are listed once per run; a failed listing assumes every database is possible.
- A data model whose objects repeat a column name, which the server rejects, keeps one column per
  object id and suffixes ` (2)`, ` (3)` to a different object with a taken name; `displayName`
  keeps the MicroStrategy name.

## Amendment: v6 2026-11-14, column-level lineage
Each table → data model edge now carries the column pairs the cube's SQL supports.

- A data model column is matched on the **warehouse columns a projection reads**, never on the
  projection's alias. MicroStrategy generates aliases (`WJXBFS1`, `CATEGORY0`) that name nothing.
  The SQL is read pass by pass (passes are separated by blank lines, not semicolons; a blank line
  inside parentheses, a comment or quoted text never splits one); a pass that is not SQL, or does not parse, contributes no columns and leaves table lineage as it was.
- **Schema cube attribute:** its form's expression, read through the modeling API
  (`/model/attributes`, logical → physical table through `/model/tables`), gives the (table, column)
  pairs the form can read. The physical table is named as the SQL names it: its table prefix when
  one is set, else its namespace. A pair the SQL also reads links that column to the attribute's
  own column (`Order`), not to the form's child (`Order.ID`): the lineage view draws no edge to a
  nested data model column. Every form of an attribute maps to that one column. Needs the service account to read schema objects; on HTTP 403, one warning,
  no further modeling calls in the run, and table lineage only.
- **Tables are compared on every qualifier both sides name** (table, schema, database or project).
  Two tables that share a name in different schemas or projects are never linked to each other's
  columns.
- **Data Import cube** (report subtype 779 or 780), which the modeling API refuses: an object is
  matched on its name, which the import derives from the column (`Order Id` ↔ `order_id`): the
  column of the same name, else the only column whose name matches once case, spaces and punctuation
  are dropped (letters of every script are kept). No column edge when that is not one column, when
  two objects of the cube share the name or match alike, or when the object was renamed.
- **Columns resolve within their own SELECT**: a nested query's aliases never resolve an outer
  column, and a pass that opens with comments is still read. A CTE, derived table, UNNEST or VALUES
  source is never read as a warehouse table (a CTE only where it is visible: in a non-recursive WITH,
  a CTE's body sees only the CTEs before it), and a column qualified as `schema.table.column`
  resolves on every qualifier it gives, so same-named tables in one query stay apart.
- **Schema cube metric:** no column edge. A metric built in Workstation refers to an embedded
  aggregation the API does not serve, so the fact column it aggregates is unknown, and mapping
  `WJXBFSn` aliases to metrics by position would be a guess.
- A failure while building column lineage drops the column pairs, never the table edge.
- Attribute, logical-table and dataset-type reads are cached per id (`CACHE_SIZE` LRU): each is read
  at most once while it stays cached.

## Amendment: v7 2026-11-17, a report dataset reads its source cube's SQL

A dossier dataset can be a report rather than an Intelligent Cube, and `/v2/cubes/{id}/sqlView`
answers it with HTTP 400 "Only cube is supported to get SQL view".

- **A report built on an Intelligent Cube** (a subset report) names its cube in `source` of
  `GET /v2/reports/{id}`, a read-only call that needs no modeling privilege. Its lineage is read from
  that cube's SQL, and its objects are matched as the cube's are: a report on a Data Import cube is
  matched on names, by the cube's subtype, not the report's.
- **A report on warehouse tables** has SQL only once it runs. Running it would query the warehouse on
  every ingestion, so it is not run: the dataset has no lineage, and one warning says so, naming it
  a prompted report when it has prompts.
- **A Live Intelligent Cube** keeps no copy of its data, and its SQL view answers "Live Intelligent
  Cubes cannot be published". Its SQL too exists only once it queries the warehouse, so it is not
  read either: no lineage, and one warning that says why.

## Amendment: v8 2026-11-21, schema cube metrics get column edges

Supersedes the v6 rule that a schema cube metric gets no column edge. Two sources tell which
warehouse columns a metric reads; neither maps generated `WJXBFSn` aliases by position.

- **The alias the SQL gives it.** The SQL generator names a metric's projection after the
  `columnNameAlias` set on the metric, else, on a server set to derive aliases from names, after its
  name: `Revenue Rank` is `REVENUERANK`. The metric is linked to the warehouse columns the
  projections of that alias read, in every SELECT of every pass; a projection over a derived table
  reads none. Names are compared normalized (`normalized`). Every object of the dataset first claims
  the name it is projected under (a metric its column alias, else its name; an attribute its name),
  and an alias is a metric's only when no other object, by id, claims it. A metric whose definition
  cannot be read claims its name, so it blocks a projection that may be its own without taking it. A display name alone is
  never trusted: a metric named `Revenue` and aliased `NETAMOUNT` does not take the `REVENUE`
  projection of a metric aliased `REVENUE`. The metrics a definition references are matched the same
  way, on their own column alias, whether or not the dataset holds them: `% Revenue` never takes
  `Revenue`'s `REVENUE`.
  - The column alias comes from the metric's definition, so it needs Architect privileges. Without
    them no metric gets a column edge: a name alone cannot tell a metric's projection from one a
    column alias set on another metric names, and a missing edge is better than a wrong one.
  - A metric outside the dataset, referenced by none of its metrics' definitions, can still project
    under a dataset metric's name; the claims cover only what the dataset and those definitions
    reach.
- **Its definition, otherwise.** `GET /model/metrics/{id}?showExpressionAs=tokens` (Architect
  privileges) resolves every object the metric's expression names. Tokens, not the tree: a metric
  built in Workstation wraps `Sum(Quantity)` in an embedded aggregation that no endpoint serves, and
  only the tokens resolve the fact inside it. Every metric referenced is followed, up to
  `MAX_METRIC_PARTS` per metric, except one the SQL already names, which takes that alias's columns.
  Every fact reached is read with `GET /model/facts/{id}`; its expressions map columns to logical
  tables as attribute forms do, and the metric is linked to those the cube SQL reads.
- A metric with no schema definition (one derived in a dossier) or one that cannot be read gets no
  column edge, and one warning per run says so; a 403 stops all modeling calls as for attributes.
- Metric definitions (column alias and references) and fact columns are cached per id
  (`CACHE_SIZE` LRU). Every metric of a schema cube costs one modeling call per run, for its column
  alias; one the SQL does not name costs one more per metric and fact it is built from.
- An attribute form or fact expression maps every column it names, at any depth: a form like
  `ApplySimple("#0 || #1", first_name, last_name)` links both columns, where v6 read only a bare
  column.
