# Snowflake Semantic View Ingestion — Design

- **Issue:** [#23680](https://github.com/open-metadata/OpenMetadata/issues/23680) — Extend Snowflake metadata ingestion to "Semantic views"
- **Date:** 2026-07-17
- **Approach:** Option A — metadata-only (no logical columns)

## Problem

Snowflake introduced a new schema-level object, the **semantic view**
(`docs.snowflake.com/en/user-guide/views-semantic/overview`). The current
Snowflake connector does not ingest them, so they are invisible in
OpenMetadata. Users want semantic views to appear alongside tables, views,
materialized views, streams, and stages.

A semantic view is discovered with `SHOW SEMANTIC VIEWS IN SCHEMA "<schema>"`
(a distinct discovery command, not a `TABLE_TYPE` in `INFORMATION_SCHEMA`). Its
internal structure is composed of **logical objects** — facts, dimensions,
metrics, and relationships — rather than traditional columns. It is queried via
`SELECT ... FROM SEMANTIC_VIEW(...)`.

## Goal

Ingest each semantic view as a `Table` entity with `tableType: SemanticView`,
capturing its DDL/definition, with **no columns**. This mirrors the existing
Stage and Stream ingestion pattern — both are schema-level objects that also
lack conventional columns and are already surfaced as `Table` entities with a
dedicated `TableType`.

## Non-Goals (future work)

- Surfacing dimensions / metrics / facts as columns (a later "Option B"
  enhancement).
- Lineage from a semantic view to its base tables.
- Column-level profiling (not applicable — no columns).

## Design

### 1. Schema change — `TableType` enum

`openmetadata-spec/src/main/resources/json/schema/entity/data/table.json`

Add `"SemanticView"` to **both** the `enum` array and the parallel `javaEnums`
array of `TableType` (`javaType: org.openmetadata.schema.type.TableType`).
Running `make generate` regenerates the Java, Python, and TypeScript models.

### 2. Connection config toggle — `includeSemanticViews`

`openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json`

Add an `includeSemanticViews` boolean property, mirroring `includeStreams` /
`includeStages`.

- **Default: `false`** (opt-in). `SHOW SEMANTIC VIEWS` errors on accounts,
  regions, or Snowflake versions where the feature is not enabled, so it is
  safer to require explicit opt-in. Both `includeStreams` and `includeStages`
  also default to `false`.

The UI form field is generated automatically from the schema; no manual UI work
is required beyond regeneration.

### 3. Ingestion code — `ingestion/src/metadata/ingestion/source/database/snowflake/`

- **`queries.py`** — add
  `SNOWFLAKE_GET_SEMANTIC_VIEWS = 'SHOW SEMANTIC VIEWS IN SCHEMA "{schema}"'`.
- **`models.py`** — add a `SnowflakeSemanticView` Pydantic model (name +
  optional definition), mirroring `SnowflakeStage`.
- **`utils.py`** — add `get_semantic_view_names()` (a custom dialect function)
  and its `get_semantic_view_names_reflection()` wrapper. It executes the SHOW
  query and returns a `SnowflakeTableList` whose entries are typed
  `TableType.SemanticView`. Register it in the QUERY_MAPS block.
- **`metadata.py`** —
  - Register the dialect/inspector method in the patch block (currently
    metadata.py:170-193).
  - Add `_get_semantic_view_names_and_types()` returning
    `[TableNameAndType(name, TableType.SemanticView)]`.
  - Gate it into `query_table_names_and_types()` behind
    `self.service_connection.includeSemanticViews`.
  - In `_get_columns_internal()`, return `[]` for `SemanticView` (same as
    Stage).
  - In `get_schema_definition()`, fetch the DDL for `SemanticView` via
    `GET_DDL('SEMANTIC_VIEW', '<fqn>')`; on error, fall back to no definition.
- **`constants.py`** — add `TableType.SemanticView: "semantic-view"` to
  `TABLE_TYPE_URL_MAP` for source-URL linking to the Snowflake UI.

### 4. Error resilience

`_get_semantic_view_names_and_types()` must **warn and continue** — returning
`[]` — if the `SHOW SEMANTIC VIEWS` query raises (e.g. feature unavailable on
the target account). A failure to list semantic views must never fail ingestion
of the rest of the schema. This follows the project's per-object error policy
(warn, don't escalate to `status.failed`).

### 5. Tests

Unit test in the existing Snowflake topology test module
(`ingestion/tests/unit/topology/database/test_snowflake.py`, or the closest
existing Snowflake unit test):

- Mock the `SHOW SEMANTIC VIEWS` result and assert a `SemanticView`-typed table
  is produced with empty columns and the expected DDL.
- Assert the `includeSemanticViews=false` toggle suppresses the discovery query.
- Assert that an error from the SHOW query is swallowed (warn-and-continue) and
  does not raise.

## Reference pattern

The Snowflake **Stage** support (PR #25370, commit `8342de6f8e`) is the closest
end-to-end template: it added a `SHOW` query, a dialect/reflection function, a
model, an `includeStages` toggle, empty-column handling, a `TableType` enum
value, and a `TABLE_TYPE_URL_MAP` entry — exactly the surface this change
touches. Stream support (PR #20278) is a secondary reference.
