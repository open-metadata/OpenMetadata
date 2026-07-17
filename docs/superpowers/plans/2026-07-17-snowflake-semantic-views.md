# Snowflake Semantic View Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Snowflake semantic views as OpenMetadata `Table` entities with `tableType: SemanticView`, capturing their DDL and no columns, gated behind an opt-in `includeSemanticViews` connection flag.

**Architecture:** Follow the existing Snowflake **Stage** ingestion pattern exactly. A semantic view is discovered with `SHOW SEMANTIC VIEWS IN SCHEMA "<schema>"`, mapped to a `SnowflakeTable` typed `TableType.SemanticView`, surfaced with empty columns, and given a best-effort DDL via `GET_DDL('SEMANTIC_VIEW', ...)`. Discovery is wrapped in warn-and-continue so unsupported accounts never fail the schema.

**Tech Stack:** Python 3.10/3.11, SQLAlchemy (snowflake-sqlalchemy dialect, monkey-patched), Pydantic 2.x, pytest. JSON Schema → code generation via `make generate`.

## Global Constraints

- Python: use pytest with plain `assert`, plain `Test*` classes (no `unittest.TestCase`), `unittest.mock` for mocking. Copied verbatim from CLAUDE.md.
- Run all Python via the repo venv: `source env/bin/activate` (or invoke `env/bin/python` / `env/bin/pytest` directly). Never pip-install into the user's venv.
- Per-object ingestion errors must **warn and continue**, never escalate to `status.failed`.
- No raw string literals for enum values in Python — use `TableType.SemanticView`.
- `includeSemanticViews` default is **`false`** (opt-in).
- The `SemanticView` enum value must be added to BOTH the `enum` array and the parallel `javaEnums` array in `table.json`.

---

### Task 1: Add `SemanticView` TableType + `includeSemanticViews` connection flag (schema + regenerate)

**Files:**
- Modify: `openmetadata-spec/src/main/resources/json/schema/entity/data/table.json:27-82`
- Modify: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json:103-108`
- Regenerated (do not hand-edit): `ingestion/src/metadata/generated/schema/entity/data/table.py`, `ingestion/src/metadata/generated/schema/entity/services/connections/database/snowflakeConnection.py`
- Test: `ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py`

**Interfaces:**
- Produces: `TableType.SemanticView` (Python enum member, value `"SemanticView"`); `SnowflakeConnection.includeSemanticViews: Optional[bool]` defaulting to `False`.

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py`:

```python
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Unit tests for Snowflake semantic view ingestion (issue #23680)."""

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)


def test_semantic_view_table_type_exists():
    assert TableType.SemanticView.value == "SemanticView"


def test_include_semantic_views_defaults_to_false():
    field = SnowflakeConnection.model_fields["includeSemanticViews"]
    assert field.default is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py -v`
Expected: FAIL — `AttributeError: SemanticView` (enum member missing) and/or `KeyError: 'includeSemanticViews'`.

- [ ] **Step 3: Edit `table.json`** — add `"SemanticView"` to both arrays.

In the `enum` array, change the last entry `"Stage"` (line 40) so the tail reads:
```json
        "Stream",
        "Stage",
        "SemanticView"
```

In the `javaEnums` array, change the last entry (lines 79-81) so the tail reads:
```json
        {
          "name": "Stage"
        },
        {
          "name": "SemanticView"
        }
```

- [ ] **Step 4: Edit `snowflakeConnection.json`** — add the flag after `includeStages` (line 108).

After the `includeStages` block, insert:
```json
    "includeSemanticViews": {
      "title": "Include Semantic Views",
      "description": "Ingest Snowflake semantic views as data assets.",
      "type": "boolean",
      "default": false
    },
```
(Ensure the preceding `includeStages` block still ends with a comma and the new block ends with a comma before `clientSessionKeepAlive`.)

- [ ] **Step 5: Regenerate models**

Run:
```bash
source env/bin/activate
make generate
```
Expected: exits 0; `ingestion/src/metadata/generated/.../table.py` now contains `SemanticView = 'SemanticView'` and `snowflakeConnection.py` contains `includeSemanticViews`.

Verify quickly:
```bash
env/bin/python -c "from metadata.generated.schema.entity.data.table import TableType; print(TableType.SemanticView)"
```
Expected: `TableType.SemanticView`

- [ ] **Step 6: Run test to verify it passes**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add openmetadata-spec/src/main/resources/json/schema/entity/data/table.json \
        openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json \
        ingestion/src/metadata/generated/schema/entity/data/table.py \
        ingestion/src/metadata/generated/schema/entity/services/connections/database/snowflakeConnection.py \
        ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py
git commit -m "feat(snowflake): add SemanticView table type and includeSemanticViews flag (#23680)"
```

> Note: `make generate` may also touch generated Java/TS `TableType`/`SnowflakeConnection` files. If `git status` shows additional regenerated files under `openmetadata-service/.../generated` or `openmetadata-ui/.../generated`, add those too — they are expected regeneration output, not manual edits.

---

### Task 2: Semantic view discovery query + dialect function + inspector registration

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/queries.py:230` (after `SNOWFLAKE_GET_STAGES`)
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/utils.py` (import at ~42; new `get_semantic_view_names` after `get_stage_names` at ~342; new `get_semantic_view_names_reflection` after `get_stage_names_reflection` at ~211)
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py:174,185` (register dialect + inspector methods)
- Test: `ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py`

**Interfaces:**
- Consumes: `TableType.SemanticView` (Task 1); `SnowflakeTable`, `SnowflakeTableList` from `snowflake/models.py`.
- Produces: `get_semantic_view_names(self, connection, schema, **kw) -> SnowflakeTableList` (dialect function; entries typed `TableType.SemanticView`, name from result `row[1]`); `SNOWFLAKE_GET_SEMANTIC_VIEWS` query constant.

- [ ] **Step 1: Write the failing test**

Append to `test_snowflake_semantic_views.py`:

```python
from unittest.mock import Mock

from metadata.ingestion.source.database.snowflake.utils import get_semantic_view_names


def test_get_semantic_view_names_maps_rows_to_semantic_view_type():
    # SHOW SEMANTIC VIEWS returns rows shaped (created_on, name, database, schema, ...)
    rows = [
        ("2026-01-01", "SALES_SEMANTIC", "DB", "PUBLIC"),
        ("2026-01-02", "ORDERS_SEMANTIC", "DB", "PUBLIC"),
    ]
    connection = Mock()
    connection.execute.return_value = iter(rows)

    dialect = Mock()
    # get_semantic_view_names(dialect, ...) binds `dialect` as `self`, so
    # `self.normalize_name(row[1])` calls this single-arg lambda with the name.
    dialect.normalize_name = lambda name: name

    result = get_semantic_view_names(dialect, connection, schema="PUBLIC")

    names = [t.name for t in result.tables]
    assert names == ["SALES_SEMANTIC", "ORDERS_SEMANTIC"]
    assert all(t.type_ == TableType.SemanticView for t in result.tables)
    assert all(t.deleted is None for t in result.tables)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py::test_get_semantic_view_names_maps_rows_to_semantic_view_type -v`
Expected: FAIL — `ImportError: cannot import name 'get_semantic_view_names'`.

- [ ] **Step 3: Add the query constant**

In `queries.py`, immediately after the `SNOWFLAKE_GET_STAGES` block (line 230), add:
```python
SNOWFLAKE_GET_SEMANTIC_VIEWS = """
SHOW SEMANTIC VIEWS IN SCHEMA "{schema}"
"""
```

- [ ] **Step 4: Import the query in `utils.py`**

In the `from ...snowflake.queries import (` block (around line 38-47), add `SNOWFLAKE_GET_SEMANTIC_VIEWS,` in alphabetical position (after `SNOWFLAKE_GET_SCHEMA_COLUMNS,`, before `SNOWFLAKE_GET_STAGES,`).

- [ ] **Step 5: Add the dialect function**

In `utils.py`, immediately after `get_stage_names` (ends ~line 342), add:
```python
def get_semantic_view_names(self, connection, schema, **kw):
    """Return all semantic view names in schema."""
    parameters = {"schema": fqn.unquote_name(schema)}
    cursor = connection.execute(text(SNOWFLAKE_GET_SEMANTIC_VIEWS.format(**parameters)))
    result = SnowflakeTableList(
        tables=[
            SnowflakeTable(
                name=self.normalize_name(row[1]),
                deleted=None,
                type_=TableType.SemanticView,
            )
            for row in cursor
        ]
    )
    return result  # noqa: RET504
```

- [ ] **Step 6: Add the inspector reflection wrapper**

In `utils.py`, immediately after `get_stage_names_reflection` (ends ~line 211), add:
```python
def get_semantic_view_names_reflection(self, schema=None, **kw):
    """Return all semantic view names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:  # pylint: disable=protected-access
        return self.dialect.get_semantic_view_names(conn, schema, info_cache=self.info_cache, **kw)
```

- [ ] **Step 7: Register on dialect + inspector in `metadata.py`**

Import: in the `from ...snowflake.utils import (` block, add `get_semantic_view_names,` and `get_semantic_view_names_reflection,` (keep alphabetical/grouped with the existing `get_stage_names` / `get_stage_names_reflection` imports).

In the patch block (lines 169-193), after `SnowflakeDialect.get_stage_names = get_stage_names` (line 174) add:
```python
SnowflakeDialect.get_semantic_view_names = get_semantic_view_names
```
After `Inspector.get_stage_names = get_stage_names_reflection` (line 185) add:
```python
Inspector.get_semantic_view_names = get_semantic_view_names_reflection
```

- [ ] **Step 8: Run test to verify it passes**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py -v`
Expected: PASS (all tests).

- [ ] **Step 9: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/snowflake/queries.py \
        ingestion/src/metadata/ingestion/source/database/snowflake/utils.py \
        ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py \
        ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py
git commit -m "feat(snowflake): discover semantic views via SHOW SEMANTIC VIEWS (#23680)"
```

---

### Task 3: Semantic view DDL definition + source-URL mapping

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/queries.py:505` (after `SNOWFLAKE_GET_STREAM_DEFINITION`)
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/utils.py` (import at ~43; new `get_semantic_view_definition` after `get_stream_definition` at ~389)
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py:192` (register on Inspector); `metadata.py:1143-1152` (add `get_schema_definition` branch)
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/constants.py:64` (add URL map entry)
- Test: `ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py`

**Interfaces:**
- Consumes: `TableType.SemanticView`; `SnowflakeSource.get_schema_definition(self, table_type, table_name, schema_name, inspector)` (existing).
- Produces: `get_semantic_view_definition(self, connection, semantic_view_name, schema=None, **kw) -> Optional[str]` (registered as `Inspector.get_semantic_view_definition`); `SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION` query constant.

- [ ] **Step 1: Write the failing test**

Append to `test_snowflake_semantic_views.py`:

```python
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource


def test_get_schema_definition_uses_semantic_view_definition():
    inspector = Mock()
    inspector.get_semantic_view_definition.return_value = "CREATE SEMANTIC VIEW SALES_SEMANTIC ..."

    self_mock = Mock()
    self_mock.connection = Mock()

    result = SnowflakeSource.get_schema_definition(
        self_mock,
        table_type=TableType.SemanticView,
        table_name="SALES_SEMANTIC",
        schema_name="PUBLIC",
        inspector=inspector,
    )

    inspector.get_semantic_view_definition.assert_called_once_with(
        self_mock.connection, "SALES_SEMANTIC", "PUBLIC"
    )
    assert result == "CREATE SEMANTIC VIEW SALES_SEMANTIC ..."
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py::test_get_schema_definition_uses_semantic_view_definition -v`
Expected: FAIL — `get_schema_definition` returns `None` (no `SemanticView` branch), so `assert_called_once_with` fails.

- [ ] **Step 3: Add the DDL query constant**

In `queries.py`, immediately after the `SNOWFLAKE_GET_STREAM_DEFINITION` block (line 505), add:
```python
SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION = """
SELECT GET_DDL('SEMANTIC_VIEW','{semantic_view_name}') AS \"text\"
"""
```

- [ ] **Step 4: Import it in `utils.py`**

In the queries import block, add `SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION,` (alphabetical — after `SNOWFLAKE_GET_SCHEMA_COLUMNS,`, before `SNOWFLAKE_GET_SEMANTIC_VIEWS,`).

- [ ] **Step 5: Add the definition helper**

In `utils.py`, immediately after `get_stream_definition` (ends ~line 389), add:
```python
def get_semantic_view_definition(  # pylint: disable=unused-argument
    self, connection, semantic_view_name, schema=None, **kw
):
    """Gets the semantic view definition (DDL)."""
    schema = schema or self.default_schema_name
    semantic_view_name = f'"{schema}"."{semantic_view_name}"' if schema else f'"{semantic_view_name}"'
    cursor = connection.execute(
        text(SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION.format(semantic_view_name=semantic_view_name))
    )
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None
```

- [ ] **Step 6: Register on Inspector in `metadata.py`**

Add `get_semantic_view_definition,` to the `snowflake.utils` import block. After `Inspector.get_stream_definition = get_stream_definition` (line 192) add:
```python
Inspector.get_semantic_view_definition = get_semantic_view_definition
```

- [ ] **Step 7: Add the `get_schema_definition` branch**

In `metadata.py`, in `get_schema_definition` (lines 1143-1152), add a branch after the `Stream` branch (line 1146) and before the `Stage` branch:
```python
            elif table_type == TableType.SemanticView:
                schema_definition = inspector.get_semantic_view_definition(
                    self.connection, table_name, schema_name
                )
```

- [ ] **Step 8: Add the source-URL map entry**

In `constants.py`, inside `TABLE_TYPE_URL_MAP` (after `TableType.Stage: "stage",` on line 64), add:
```python
    TableType.SemanticView: "semantic-view",
```

- [ ] **Step 9: Run test to verify it passes**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py -v`
Expected: PASS (all tests).

- [ ] **Step 10: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/snowflake/queries.py \
        ingestion/src/metadata/ingestion/source/database/snowflake/utils.py \
        ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py \
        ingestion/src/metadata/ingestion/source/database/snowflake/constants.py \
        ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py
git commit -m "feat(snowflake): fetch semantic view DDL and source URL (#23680)"
```

---

### Task 4: Wire semantic views into table discovery (gating, empty columns, warn-and-continue)

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py` (new `_get_semantic_view_names_and_types` after `_get_stage_names_and_types` at ~813; extend `query_table_names_and_types` at ~824-832; extend `_get_columns_internal` Stage branch at ~1066-1067)
- Test: `ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py`

**Interfaces:**
- Consumes: `TableType.SemanticView`; `SnowflakeSource._get_columns_internal`, `SnowflakeSource.query_table_names_and_types` (existing); `TableNameAndType` from `common_db_source`; `self.service_connection.includeSemanticViews` (Task 1).
- Produces: `SnowflakeSource._get_semantic_view_names_and_types(self, schema_name) -> List[TableNameAndType]`.

- [ ] **Step 1: Write the failing tests**

Append to `test_snowflake_semantic_views.py`:

```python
from metadata.ingestion.source.database.common_db_source import TableNameAndType


def test_semantic_view_has_no_columns():
    inspector = Mock()

    result = SnowflakeSource._get_columns_internal(
        Mock(),
        schema_name="PUBLIC",
        table_name="SALES_SEMANTIC",
        db_name="DB",
        inspector=inspector,
        table_type=TableType.SemanticView,
    )

    assert result == []
    assert inspector.get_columns.call_count == 0


def test_query_table_names_includes_semantic_views_when_enabled():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = True
    self_mock._get_table_names_and_types.return_value = []
    self_mock._get_semantic_view_names_and_types.return_value = [
        TableNameAndType(name="SALES_SEMANTIC", type_=TableType.SemanticView)
    ]

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    self_mock._get_semantic_view_names_and_types.assert_called_once_with("PUBLIC")
    assert [t.name for t in result] == ["SALES_SEMANTIC"]


def test_query_table_names_excludes_semantic_views_when_disabled():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = False
    self_mock._get_table_names_and_types.return_value = []

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    self_mock._get_semantic_view_names_and_types.assert_not_called()
    assert result == []


def test_query_table_names_swallows_semantic_view_errors():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = True
    self_mock._get_table_names_and_types.return_value = [
        TableNameAndType(name="T1", type_=TableType.Regular)
    ]
    self_mock._get_semantic_view_names_and_types.side_effect = Exception(
        "Unsupported feature: SEMANTIC VIEWS"
    )

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    assert [t.name for t in result] == ["T1"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py -v`
Expected: FAIL — `test_semantic_view_has_no_columns` fails (no branch → calls `get_columns`); the gating tests fail because `query_table_names_and_types` doesn't reference `includeSemanticViews`.

- [ ] **Step 3: Add `_get_semantic_view_names_and_types`**

In `metadata.py`, immediately after `_get_stage_names_and_types` (ends line 813), add:
```python
    def _get_semantic_view_names_and_types(self, schema_name: str) -> List[TableNameAndType]:  # noqa: UP006
        """Fetch semantic views from the schema"""
        table_type = TableType.SemanticView

        snowflake_semantic_views = self.inspector.get_semantic_view_names(schema=schema_name)

        return [
            TableNameAndType(name=semantic_view.name, type_=table_type)
            for semantic_view in snowflake_semantic_views.get_not_deleted()
        ]
```

- [ ] **Step 4: Gate it into `query_table_names_and_types`**

In `metadata.py`, in `query_table_names_and_types` (lines 824-832), after the `includeStages` block (lines 829-830) and before `return table_list`, add:
```python
        if self.service_connection.includeSemanticViews:
            try:
                table_list.extend(self._get_semantic_view_names_and_types(schema_name))
            except Exception as exc:
                logger.warning(f"Failed to list semantic views for schema [{schema_name}]: {exc}")
                logger.debug(traceback.format_exc())
```

- [ ] **Step 5: Return empty columns for semantic views**

In `metadata.py`, in `_get_columns_internal`, change the Stage early-return (lines 1065-1067):
```python
        # Stages do not have columns in Snowflake
        if table_type == TableType.Stage:
            return []
```
to:
```python
        # Stages and semantic views do not expose columns in Snowflake
        if table_type in (TableType.Stage, TableType.SemanticView):
            return []
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py -v`
Expected: PASS (all tests).

- [ ] **Step 7: Run the full Snowflake unit suite (no regressions)**

Run: `env/bin/python -m pytest ingestion/tests/unit/topology/database/test_snowflake.py ingestion/tests/unit/topology/database/test_snowflake_table_type_cache_pollution.py -q`
Expected: PASS.

- [ ] **Step 8: Format + lint the changed Python**

Run:
```bash
cd ingestion
make py_format
make py_format_check
cd ..
```
Expected: `py_format_check` exits 0.

- [ ] **Step 9: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py \
        ingestion/tests/unit/topology/database/test_snowflake_semantic_views.py
git commit -m "feat(snowflake): ingest semantic views behind includeSemanticViews (#23680)"
```

---

## Post-implementation verification (live account — implementer's own Snowflake)

These require a real Snowflake account with semantic views and are NOT part of the automated suite. Note results in the PR description:

1. Confirm `SHOW SEMANTIC VIEWS IN SCHEMA "<schema>"` returns the semantic view name at result index `1`. If the driver returns it at a different index, adjust `get_semantic_view_names` (`row[1]`).
2. Confirm `GET_DDL('SEMANTIC_VIEW', '<db>.<schema>.<name>')` returns the DDL text. If Snowflake rejects the `'SEMANTIC_VIEW'` object-type literal, the DDL gracefully falls back to `None` (wrapped in `get_schema_definition`'s try/except) — the semantic view is still ingested, just without a definition. File a follow-up if a different retrieval command is required.
3. Run an ingestion against the account with `includeSemanticViews: true` and confirm the semantic views appear as tables with `tableType: SemanticView`, empty columns, and (where supported) a DDL.

## Notes for the reviewer

- No new Pydantic model is added: `get_semantic_view_names` reuses `SnowflakeTable`/`SnowflakeTableList` exactly as `get_stage_names` does. The unused `SnowflakeStage` model is left untouched.
- Semantic views have no incremental-extraction path (mirrors stages) — `SHOW SEMANTIC VIEWS` has no time filter, so full discovery runs every time and there is no deleted-object detection.
- Out of scope (future PRs): surfacing dimensions/metrics/facts as columns; semantic-view→base-table lineage; UI icon/label polish for the new table type.
