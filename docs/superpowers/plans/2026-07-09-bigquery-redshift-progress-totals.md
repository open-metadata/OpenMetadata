# BigQuery & Redshift Progress Totals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the BigQuery and Redshift connectors declare `Database` and per-database `DatabaseSchema` progress denominators up front (Snowflake-parity), so ingestion runs render accurate `%` and ETA.

**Architecture:** Each connector implements the existing optional `declare_progress_totals(self, totals: TotalsDeclarer)` hook. Both set the `Database` total from a cheap name enumeration and seed per-database `DatabaseSchema` scope totals from a single listing — BigQuery via `client.list_datasets(project)`, Redshift via a new cross-database `SVV_ALL_SCHEMAS` query. When schema enumeration is unavailable, both degrade to `totals.mark_reconcilable(DatabaseSchema.__name__)`, matching Snowflake's fallback. Filtering is done through pure `_is_database_filtered` / `_is_schema_filtered` predicates (no status side effects) that both the totals hook and the walk share.

**Tech Stack:** Python 3.10-3.11, pytest, SQLAlchemy, `google-cloud-bigquery`, OpenMetadata ingestion framework (`metadata.ingestion.progress`).

## Global Constraints

- Python venv MUST be active before running anything: `source env/bin/activate` from repo root (or the worktree's `env/bin/python` directly). Never pip-install into the user's venv.
- Run tests with the repo venv: `python -m pytest ...` from `ingestion/`.
- Progress totals are best-effort: the runner already wraps `declare_progress_totals` in try/except (`progress/runner_tracker.py::_declare_totals_once`) — a failure warns and continues. Do NOT let totals code raise in a way that aborts the walk.
- Filter-only predicates MUST NOT call `self.status.filter(...)` — the walk (`get_database_names` / `_get_filtered_schema_names`) owns status side effects; emitting them from the totals path would double-count filtered entities in the run status.
- Do NOT run incremental setup (`_set_incremental_table_processor`, `_prepare_schema_incremental_data`, `incremental_table_processor`) or inspector/session setup inside the totals path — enumerate and filter names only.
- Follow project Python rules: pytest with plain `assert`, plain `Test*` classes (no `unittest.TestCase`), `unittest.mock` for mocking, mocks only at boundaries.
- Reference implementation to mirror: `ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py` (`declare_progress_totals`, `_schema_names_by_database`, `_is_schema_filtered`) and its test `ingestion/tests/unit/source/database/test_snowflake_progress_count.py`.
- The `TotalsDeclarer` API (from `metadata.ingestion.progress.modes`): `set_total(entity_type: str, total: Optional[int])`, `seed_scope_total(entity_type: str, scope: str, n: int)`, `mark_reconcilable(entity_type: str)`. Entity keys are `Database.__name__` and `DatabaseSchema.__name__`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `ingestion/src/metadata/ingestion/source/database/redshift/queries.py` | Redshift SQL constants | Add `REDSHIFT_GET_ALL_SCHEMAS`. |
| `ingestion/src/metadata/ingestion/source/database/redshift/metadata.py` | Redshift source | Add `declare_progress_totals` + `_is_database_filtered` / `_is_schema_filtered` / `_schema_names_by_database` / `_filtered_database_names_for_totals`; imports. |
| `ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py` | BigQuery source | Add `declare_progress_totals` + `_is_database_filtered` / `_is_schema_filtered` / `_raw_dataset_names` / `_kept_schema_counts`; import `TotalsDeclarer`. |
| `ingestion/tests/unit/source/database/test_redshift_progress_count.py` | Redshift totals tests | Create. |
| `ingestion/tests/unit/source/database/test_bigquery_progress_count.py` | BigQuery totals tests | Create. |

---

## Task 1: Redshift progress totals

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/redshift/queries.py` (add constant near `REDSHIFT_GET_DATABASE_NAMES`, ~line 292)
- Modify: `ingestion/src/metadata/ingestion/source/database/redshift/metadata.py` (imports near lines 16/79/98; new methods on `RedshiftSource`)
- Test: `ingestion/tests/unit/source/database/test_redshift_progress_count.py` (create)

**Interfaces:**
- Consumes: `TotalsDeclarer` from `metadata.ingestion.progress.modes`; `Database`, `DatabaseSchema` (already imported in `redshift/metadata.py`); `filter_by_database`, `filter_by_schema` from `metadata.utils.filters`; `self.get_configured_database()`, `self.get_database_names_raw()`, `self.connection`, `self.context`, `self.metadata`, `self.source_config`, `self.status`.
- Produces:
  - `RedshiftSource.declare_progress_totals(self, totals: TotalsDeclarer) -> None`
  - `RedshiftSource._is_database_filtered(self, database_name: str) -> bool`
  - `RedshiftSource._is_schema_filtered(self, database_name: str, schema_name: str) -> bool`
  - `RedshiftSource._schema_names_by_database(self) -> Optional[Dict[str, List[str]]]` (returns `None` when `SVV_ALL_SCHEMAS` is unavailable)
  - `RedshiftSource._filtered_database_names_for_totals(self) -> List[str]`
  - `REDSHIFT_GET_ALL_SCHEMAS: str` in `redshift/queries.py`

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/source/database/test_redshift_progress_count.py`:

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
"""Redshift seeds ``Database`` + per-database ``DatabaseSchema`` progress totals
from a single cross-database ``SVV_ALL_SCHEMAS``, and reconciles when that view
is unavailable."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.ingestion.progress.modes import ProgressMode, TotalsDeclarer
from metadata.ingestion.progress.tracking import ProgressTracking
from metadata.ingestion.source.database.redshift import metadata as redshift_metadata

RedshiftSource = redshift_metadata.RedshiftSource


@pytest.fixture
def redshift_source():
    source = object.__new__(RedshiftSource)
    source.source_config = SimpleNamespace(
        useFqnForFiltering=False,
        databaseFilterPattern=None,
        schemaFilterPattern=None,
    )
    source.metadata = MagicMock()
    source.status = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.__dict__["_progress_tracking"] = ProgressTracking(ProgressMode.AUTO, "Test")
    return source


def _counters(source):
    return {t: (done, total) for t, done, total in source.progress_tracking.registry.global_counters()}


def test_declare_progress_totals_seeds_database_and_schema(redshift_source):
    redshift_source._filtered_database_names_for_totals = lambda: ["db1", "db2"]
    redshift_source._schema_names_by_database = lambda: {"db1": ["s1", "s2"], "db2": ["s3"]}
    redshift_source._is_schema_filtered = lambda db, sch: False
    redshift_source.declare_progress_totals(TotalsDeclarer(redshift_source.progress_tracking.registry))
    counters = _counters(redshift_source)
    assert counters["Database"] == (0, 2)
    assert counters["DatabaseSchema"] == (0, 3)


def test_declare_progress_totals_applies_schema_filter(redshift_source):
    redshift_source._filtered_database_names_for_totals = lambda: ["db1"]
    redshift_source._schema_names_by_database = lambda: {"db1": ["keep", "drop"]}
    redshift_source._is_schema_filtered = lambda db, sch: sch == "drop"
    redshift_source.declare_progress_totals(TotalsDeclarer(redshift_source.progress_tracking.registry))
    assert _counters(redshift_source)["DatabaseSchema"] == (0, 1)


def test_declare_progress_totals_reconciles_when_view_unavailable(redshift_source):
    redshift_source._filtered_database_names_for_totals = lambda: ["db1"]
    redshift_source._schema_names_by_database = lambda: None
    redshift_source.declare_progress_totals(TotalsDeclarer(redshift_source.progress_tracking.registry))
    registry = redshift_source.progress_tracking.registry
    assert registry.is_reconcilable("DatabaseSchema") is True
    counters = _counters(redshift_source)
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, None)


def test_schema_names_by_database_groups_rows_and_returns_none_on_error(redshift_source):
    redshift_source.connection = MagicMock()
    redshift_source.connection.execute.return_value.fetchall.return_value = [
        ("db1", "s1"),
        ("db1", "s2"),
        ("db2", "s3"),
    ]
    grouped = redshift_source._schema_names_by_database()
    assert grouped == {"db1": ["s1", "s2"], "db2": ["s3"]}

    redshift_source.connection.execute.side_effect = Exception("permission denied on SVV_ALL_SCHEMAS")
    assert redshift_source._schema_names_by_database() is None


def test_filtered_database_names_for_totals_uses_configured_database(redshift_source):
    redshift_source.get_configured_database = lambda: "only_db"
    redshift_source.get_database_names_raw = MagicMock()
    assert redshift_source._filtered_database_names_for_totals() == ["only_db"]
    redshift_source.get_database_names_raw.assert_not_called()


def test_filtered_database_names_for_totals_filters_all_databases(redshift_source):
    redshift_source.get_configured_database = lambda: None
    redshift_source.get_database_names_raw = lambda: iter(["keep", "drop"])
    redshift_source._is_database_filtered = lambda db: db == "drop"
    assert redshift_source._filtered_database_names_for_totals() == ["keep"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ingestion && python -m pytest tests/unit/source/database/test_redshift_progress_count.py -v`
Expected: FAIL — `AttributeError`/`TypeError` because `declare_progress_totals`, `_schema_names_by_database`, and `_filtered_database_names_for_totals` don't exist yet on `RedshiftSource`.

- [ ] **Step 3: Add the `REDSHIFT_GET_ALL_SCHEMAS` query constant**

In `ingestion/src/metadata/ingestion/source/database/redshift/queries.py`, add directly after the existing `REDSHIFT_GET_DATABASE_NAMES` block (~line 294):

```python
REDSHIFT_GET_ALL_SCHEMAS = """
SELECT database_name, schema_name FROM SVV_ALL_SCHEMAS
"""
```

- [ ] **Step 4: Update imports in `redshift/metadata.py`**

Change the typing import (line 16) to add `Dict`:

```python
from typing import Dict, Iterable, List, Optional  # noqa: UP035
```

Add `REDSHIFT_GET_ALL_SCHEMAS` to the queries import block (lines 75-82):

```python
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_EXTERNAL_TABLE_LOCATION,
    REDSHIFT_GET_ALL_CONSTRAINTS,
    REDSHIFT_GET_ALL_RELATION_INFO,
    REDSHIFT_GET_ALL_SCHEMAS,
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_GET_STORED_PROCEDURES,
    REDSHIFT_LIFE_CYCLE_QUERY,
)
```

Change the filters import (line 98) to add `filter_by_schema`:

```python
from metadata.utils.filters import filter_by_database, filter_by_schema
```

Add the progress import (place with the other `metadata.ingestion` imports, e.g. after line 56):

```python
from metadata.ingestion.progress.modes import TotalsDeclarer
```

- [ ] **Step 5: Add the methods to `RedshiftSource`**

Add these methods to the `RedshiftSource` class in `redshift/metadata.py` (place them just above `get_database_names`, ~line 280):

```python
def _is_database_filtered(self, database_name: str) -> bool:
    """Whether a database fails ``databaseFilterPattern``. Pure predicate —
    no status side effects — so the totals hook and the walk share it."""
    database_fqn = fqn.build(
        self.metadata,
        entity_type=Database,
        service_name=self.context.get().database_service,
        database_name=database_name,
    )
    filter_name = database_fqn if self.source_config.useFqnForFiltering else database_name
    return filter_by_database(self.source_config.databaseFilterPattern, filter_name)

def _is_schema_filtered(self, database_name: str, schema_name: str) -> bool:
    """Whether a schema fails ``schemaFilterPattern``, matched the same way as
    the walk (FQN or bare name per ``useFqnForFiltering``). Context-free: the
    FQN is built from the explicit database name."""
    schema_fqn = fqn.build(
        self.metadata,
        entity_type=DatabaseSchema,
        service_name=self.context.get().database_service,
        database_name=database_name,
        schema_name=schema_name,
    )
    filter_name = schema_fqn if self.source_config.useFqnForFiltering else schema_name
    return filter_by_schema(self.source_config.schemaFilterPattern, filter_name)

def _filtered_database_names_for_totals(self) -> List[str]:  # noqa: UP006
    """Filtered database names for the progress denominator. Single configured
    database when ``ingestAllDatabases`` is off, else the filtered result of the
    lightweight ``pg_database`` enumeration. Emits no status side effects."""
    configured_db = self.get_configured_database()
    if configured_db:
        result = [configured_db]
    else:
        result = [db for db in self.get_database_names_raw() if not self._is_database_filtered(db)]
    return result

def _schema_names_by_database(self) -> "Optional[Dict[str, List[str]]]":  # noqa: UP006,UP045
    """``{database: [schema_names]}`` for every visible database from a single
    cross-database ``SVV_ALL_SCHEMAS`` — one round-trip, no per-database
    reconnect. Returns ``None`` when the view is unavailable (older cluster or
    restricted role) so the caller falls back to reconcile-only."""
    try:
        rows = self.connection.execute(text(REDSHIFT_GET_ALL_SCHEMAS)).fetchall()
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning(
            "SVV_ALL_SCHEMAS unavailable (%s); progress schema total will reconcile during the walk.",
            exc,
        )
        return None
    by_database: Dict[str, List[str]] = {}  # noqa: UP006
    for row in rows:
        database_name = row[0]
        schema_name = row[1]
        if database_name is not None and schema_name is not None:
            by_database.setdefault(str(database_name), []).append(str(schema_name))
    return by_database

def declare_progress_totals(self, totals: TotalsDeclarer) -> None:
    """Seed the run-level ``Database`` and ``DatabaseSchema`` counters upfront.
    ``Database`` is the filtered DB count; ``DatabaseSchema`` is the post-filter
    schema count per database from the cross-database ``SVV_ALL_SCHEMAS``. When
    that view is unavailable the schema counter is marked reconcilable so the
    walk fills its total instead."""
    database_names = self._filtered_database_names_for_totals()
    totals.set_total(Database.__name__, len(database_names))
    schemas_by_database = self._schema_names_by_database()
    if schemas_by_database is None:
        totals.mark_reconcilable(DatabaseSchema.__name__)
    else:
        for database_name in database_names:
            kept = [
                schema_name
                for schema_name in schemas_by_database.get(database_name, [])
                if not self._is_schema_filtered(database_name, schema_name)
            ]
            totals.seed_scope_total(DatabaseSchema.__name__, database_name, len(kept))
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd ingestion && python -m pytest tests/unit/source/database/test_redshift_progress_count.py -v`
Expected: PASS (7 tests).

- [ ] **Step 7: Run the existing Redshift suite to confirm no regression**

Run: `cd ingestion && python -m pytest tests/unit/topology/database/test_redshift.py tests/unit/source/database/test_redshift_serverless.py -q`
Expected: PASS (unchanged — no walk methods were modified).

- [ ] **Step 8: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/redshift/queries.py \
        ingestion/src/metadata/ingestion/source/database/redshift/metadata.py \
        ingestion/tests/unit/source/database/test_redshift_progress_count.py
git commit -m "feat(ingestion): redshift declares progress totals via SVV_ALL_SCHEMAS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Redshift walk shares the filter predicate

Removes the duplicated inline `filter_by_database` from the walk so the totals
hook and the walk cannot diverge. Behavior-preserving — guarded by the existing
Redshift suite.

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/redshift/metadata.py` (`get_database_names`, ~lines 280-309)
- Test: existing `ingestion/tests/unit/topology/database/test_redshift.py` (regression guard)

**Interfaces:**
- Consumes: `RedshiftSource._is_database_filtered` (from Task 1).
- Produces: no new public surface; `get_database_names` behavior unchanged.

- [ ] **Step 1: Refactor `get_database_names` to use the shared predicate**

In `redshift/metadata.py`, replace the `else` branch's inline filter (the `filter_by_database(...)` call around lines 295-300) so it uses the predicate while keeping the status side effect:

```python
def get_database_names(self) -> Iterable[str]:
    if not self.config.serviceConnection.root.config.ingestAllDatabases:  # pyright: ignore[reportAttributeAccessIssue]
        configured_db = self.config.serviceConnection.root.config.database  # pyright: ignore[reportAttributeAccessIssue]
        self._set_incremental_table_processor(configured_db)
        self.set_external_location_map(configured_db)
        yield configured_db
    else:
        for new_database in self.get_database_names_raw():
            if self._is_database_filtered(new_database):
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_database,
                )
                self.status.filter(database_fqn, "Database Filtered Out")
                continue

            try:
                self.set_inspector(database_name=new_database)
                self._set_incremental_table_processor(new_database)
                self.set_external_location_map(new_database)
                yield new_database
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Error trying to connect to database {new_database}: {exc}")
```

- [ ] **Step 2: Run the existing Redshift suite to verify no behavior change**

Run: `cd ingestion && python -m pytest tests/unit/topology/database/test_redshift.py -q`
Expected: PASS (unchanged).

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/redshift/metadata.py
git commit -m "refactor(ingestion): redshift walk shares _is_database_filtered predicate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: BigQuery progress totals

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py` (import near line 108; new methods on `BigquerySource`)
- Test: `ingestion/tests/unit/source/database/test_bigquery_progress_count.py` (create)

**Interfaces:**
- Consumes: `TotalsDeclarer` from `metadata.ingestion.progress.modes`; `Database`, `DatabaseSchema`, `filter_by_database`, `filter_by_schema` (already imported in `bigquery/metadata.py`); `self.project_ids` (list, set in `__init__`), `self.client`, `self.service_connection`, `self.context`, `self.metadata`, `self.source_config`.
- Produces:
  - `BigquerySource.declare_progress_totals(self, totals: TotalsDeclarer) -> None`
  - `BigquerySource._is_database_filtered(self, project_id: str) -> bool`
  - `BigquerySource._is_schema_filtered(self, project_id: str, schema_name: str) -> bool`
  - `BigquerySource._raw_dataset_names(self, project_id: str) -> Iterable[str]` (context-free dataset listing)
  - `BigquerySource._kept_schema_counts(self, project_ids: List[str]) -> Optional[Dict[str, int]]` (returns `None` when any project's dataset listing fails)

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/source/database/test_bigquery_progress_count.py`:

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
"""BigQuery seeds ``Database`` (filtered projects) + per-project
``DatabaseSchema`` (filtered datasets) progress totals, reconciling when dataset
listing fails."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.ingestion.progress.modes import ProgressMode, TotalsDeclarer
from metadata.ingestion.progress.tracking import ProgressTracking
from metadata.ingestion.source.database.bigquery import metadata as bigquery_metadata

BigquerySource = bigquery_metadata.BigquerySource


@pytest.fixture
def bigquery_source():
    source = object.__new__(BigquerySource)
    source.source_config = SimpleNamespace(
        useFqnForFiltering=False,
        databaseFilterPattern=None,
        schemaFilterPattern=None,
    )
    source.metadata = MagicMock()
    source.status = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.__dict__["_progress_tracking"] = ProgressTracking(ProgressMode.AUTO, "Test")
    return source


def _counters(source):
    return {t: (done, total) for t, done, total in source.progress_tracking.registry.global_counters()}


def test_declare_progress_totals_seeds_projects_and_datasets(bigquery_source):
    bigquery_source.project_ids = ["p1", "p2"]
    bigquery_source._is_database_filtered = lambda p: False
    bigquery_source._raw_dataset_names = lambda p: {"p1": ["d1", "d2"], "p2": ["d3"]}[p]
    bigquery_source._is_schema_filtered = lambda p, s: False
    bigquery_source.declare_progress_totals(TotalsDeclarer(bigquery_source.progress_tracking.registry))
    counters = _counters(bigquery_source)
    assert counters["Database"] == (0, 2)
    assert counters["DatabaseSchema"] == (0, 3)


def test_declare_progress_totals_applies_filters(bigquery_source):
    bigquery_source.project_ids = ["keep", "drop"]
    bigquery_source._is_database_filtered = lambda p: p == "drop"
    bigquery_source._raw_dataset_names = lambda p: ["d1", "skip"]
    bigquery_source._is_schema_filtered = lambda p, s: s == "skip"
    bigquery_source.declare_progress_totals(TotalsDeclarer(bigquery_source.progress_tracking.registry))
    counters = _counters(bigquery_source)
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, 1)


def test_declare_progress_totals_reconciles_when_listing_fails(bigquery_source):
    bigquery_source.project_ids = ["p1"]
    bigquery_source._is_database_filtered = lambda p: False

    def _boom(_project_id):
        raise Exception("list_datasets denied")

    bigquery_source._raw_dataset_names = _boom
    bigquery_source._is_schema_filtered = lambda p, s: False
    bigquery_source.declare_progress_totals(TotalsDeclarer(bigquery_source.progress_tracking.registry))
    registry = bigquery_source.progress_tracking.registry
    assert registry.is_reconcilable("DatabaseSchema") is True
    counters = _counters(bigquery_source)
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, None)


def test_raw_dataset_names_prefers_configured_schema(bigquery_source):
    bigquery_source.service_connection = SimpleNamespace(databaseSchema="only_ds")
    bigquery_source.client = MagicMock()
    assert list(bigquery_source._raw_dataset_names("p1")) == ["only_ds"]
    bigquery_source.client.list_datasets.assert_not_called()


def test_raw_dataset_names_lists_from_client(bigquery_source):
    bigquery_source.service_connection = SimpleNamespace()
    bigquery_source.client = MagicMock()
    bigquery_source.client.list_datasets.return_value = [
        SimpleNamespace(dataset_id="d1"),
        SimpleNamespace(dataset_id="d2"),
    ]
    assert list(bigquery_source._raw_dataset_names("p1")) == ["d1", "d2"]
    bigquery_source.client.list_datasets.assert_called_once_with("p1")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ingestion && python -m pytest tests/unit/source/database/test_bigquery_progress_count.py -v`
Expected: FAIL — `AttributeError` because `declare_progress_totals`, `_raw_dataset_names`, etc. don't exist on `BigquerySource`.

- [ ] **Step 3: Add the `TotalsDeclarer` import**

In `bigquery/metadata.py`, add near the other `metadata.ingestion` imports (e.g. after the `MultiDBSource` import on line 108):

```python
from metadata.ingestion.progress.modes import TotalsDeclarer
```

- [ ] **Step 4: Add the methods to `BigquerySource`**

Add these methods to the `BigquerySource` class in `bigquery/metadata.py` (place them just above `get_database_names_raw`, ~line 824):

```python
def _is_database_filtered(self, project_id: str) -> bool:
    """Whether a project fails ``databaseFilterPattern``. Pure predicate — no
    status side effects — so the totals hook and the walk share it."""
    database_fqn = fqn.build(
        self.metadata,
        entity_type=Database,
        service_name=self.context.get().database_service,
        database_name=project_id,
    )
    filter_name = database_fqn if self.source_config.useFqnForFiltering else project_id
    return filter_by_database(self.source_config.databaseFilterPattern, filter_name)

def _is_schema_filtered(self, project_id: str, schema_name: str) -> bool:
    """Whether a dataset fails ``schemaFilterPattern``, matched the same way as
    the walk. Context-free: the FQN is built from the explicit project id."""
    schema_fqn = fqn.build(
        self.metadata,
        entity_type=DatabaseSchema,
        service_name=self.context.get().database_service,
        database_name=project_id,
        schema_name=schema_name,
    )
    filter_name = schema_fqn if self.source_config.useFqnForFiltering else schema_name
    return filter_by_schema(self.source_config.schemaFilterPattern, filter_name)

def _raw_dataset_names(self, project_id: str) -> Iterable[str]:
    """Dataset IDs for ``project_id``, context-free (does not read the walk's
    current database). Honors a single configured ``databaseSchema``."""
    configured_schema = self.service_connection.__dict__.get("databaseSchema")
    if configured_schema:
        yield configured_schema
    else:
        for dataset in self.client.list_datasets(project_id):
            yield dataset.dataset_id

def _kept_schema_counts(self, project_ids: List[str]) -> "Optional[Dict[str, int]]":  # noqa: UP006,UP045
    """Post-filter dataset count per project from ``list_datasets``. Returns
    ``None`` when any project's listing fails, so the caller reconciles the
    schema total instead of seeding partial scopes."""
    counts: Dict[str, int] = {}  # noqa: UP006
    try:
        for project_id in project_ids:
            counts[project_id] = sum(
                1
                for dataset in self._raw_dataset_names(project_id)
                if not self._is_schema_filtered(project_id, dataset)
            )
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning(
            "BigQuery dataset listing failed (%s); progress schema total will reconcile during the walk.",
            exc,
        )
        counts = None
    return counts

def declare_progress_totals(self, totals: TotalsDeclarer) -> None:
    """Seed the run-level ``Database`` (filtered project count) and per-project
    ``DatabaseSchema`` (filtered dataset count) counters upfront. When dataset
    listing fails for any project, mark the schema counter reconcilable so the
    walk fills its total instead."""
    filtered_projects = [project_id for project_id in self.project_ids if not self._is_database_filtered(project_id)]
    totals.set_total(Database.__name__, len(filtered_projects))
    kept_by_project = self._kept_schema_counts(filtered_projects)
    if kept_by_project is None:
        totals.mark_reconcilable(DatabaseSchema.__name__)
    else:
        for project_id, count in kept_by_project.items():
            totals.seed_scope_total(DatabaseSchema.__name__, project_id, count)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd ingestion && python -m pytest tests/unit/source/database/test_bigquery_progress_count.py -v`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the existing BigQuery suite to confirm no regression**

Run: `cd ingestion && python -m pytest tests/unit/topology/database/test_bigquery.py -q`
Expected: PASS (unchanged — no walk methods were modified).

- [ ] **Step 7: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py \
        ingestion/tests/unit/source/database/test_bigquery_progress_count.py
git commit -m "feat(ingestion): bigquery declares progress totals from list_datasets

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: BigQuery walk shares the filter predicates

Removes the duplicated inline `filter_by_database` / `filter_by_schema` from the
walk so the totals hook and the walk cannot diverge. Behavior-preserving —
guarded by the existing BigQuery suite.

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py` (`get_database_names` ~lines 827-864; `_get_filtered_schema_names` ~lines 664-684; `_get_filtered_datasets` ~lines 643-662)
- Test: existing `ingestion/tests/unit/topology/database/test_bigquery.py` (regression guard)

**Interfaces:**
- Consumes: `BigquerySource._is_database_filtered`, `BigquerySource._is_schema_filtered` (from Task 3); `self.context.get().database` supplies the project id in the walk.
- Produces: no new public surface; walk filtering behavior unchanged.

- [ ] **Step 1: Refactor `get_database_names` to use `_is_database_filtered`**

In `bigquery/metadata.py`, replace the inline `filter_by_database(...)` check in `get_database_names` (~lines 835-838). Change:

```python
            if filter_by_database(
                self.source_config.databaseFilterPattern,
                database_fqn if self.source_config.useFqnForFiltering else project_id,
            ):
                self.status.filter(database_fqn, "Database Filtered out")
```

to:

```python
            if self._is_database_filtered(project_id):
                self.status.filter(database_fqn, "Database Filtered out")
```

(Leave the surrounding `database_fqn = fqn.build(...)` — it is still used for the `status.filter` call — and the `else:` body unchanged.)

- [ ] **Step 2: Refactor `_get_filtered_datasets` and `_get_filtered_schema_names` to use `_is_schema_filtered`**

In `_get_filtered_datasets` (~lines 643-662), replace the inline `filter_by_schema(...)` with the shared predicate keyed on the explicit `project_id`:

```python
def _get_filtered_datasets(self, project_id: str) -> List[str]:  # noqa: UP006
    """Return dataset IDs that pass the schema filter pattern."""
    return [
        schema_name
        for schema_name in self.get_raw_database_schema_names()
        if not self._is_schema_filtered(project_id, schema_name)
    ]
```

In `_get_filtered_schema_names` (~lines 664-684), replace the inline `filter_by_schema(...)` block. The walk's current project is `self.context.get().database`:

```python
def _get_filtered_schema_names(self, return_fqn: bool = False, add_to_status: bool = True) -> Iterable[str]:
    project_id = self.context.get().database
    for schema_name in self.get_raw_database_schema_names():
        schema_fqn = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.context.get().database_service,
            database_name=project_id,
            schema_name=schema_name,
        )
        if self._is_schema_filtered(project_id, schema_name):
            if add_to_status:
                self.status.filter(schema_fqn, "Schema Filtered Out")
            continue

        if self.incremental.enabled:
            self._prepare_schema_incremental_data(schema_name)

        yield schema_fqn if return_fqn else schema_name
```

- [ ] **Step 3: Run the existing BigQuery suite to verify no behavior change**

Run: `cd ingestion && python -m pytest tests/unit/topology/database/test_bigquery.py -q`
Expected: PASS (unchanged).

- [ ] **Step 4: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py
git commit -m "refactor(ingestion): bigquery walk shares filter predicates with totals hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Format, lint, and full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Apply Python formatting**

Run: `cd ingestion && make py_format`
Expected: ruff lint-fix + format applied; no residual errors.

- [ ] **Step 2: Verify lint + format matches CI**

Run: `cd ingestion && make py_format_check`
Expected: PASS (clean).

- [ ] **Step 3: Run the four new/affected connector test files together**

Run:
```bash
cd ingestion && python -m pytest \
  tests/unit/source/database/test_redshift_progress_count.py \
  tests/unit/source/database/test_bigquery_progress_count.py \
  tests/unit/topology/database/test_redshift.py \
  tests/unit/topology/database/test_bigquery.py -q
```
Expected: PASS (all).

- [ ] **Step 4: Static type check on the changed modules**

Run: `cd ingestion && python -m basedpyright src/metadata/ingestion/source/database/redshift/metadata.py src/metadata/ingestion/source/database/bigquery/metadata.py`
Expected: no NEW errors versus baseline. If the partial venv makes basedpyright rewrite `baseline.json`, restore it (`git checkout -- ingestion/.../baseline.json`) and rely on inline suppressions — do NOT commit a regenerated baseline.

- [ ] **Step 5: Commit any formatting-only changes**

```bash
git add -u ingestion/src/metadata/ingestion/source/database
git commit -m "style(ingestion): apply py_format to bigquery/redshift progress totals

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Skip this commit if `git status` shows no changes after Step 1.)

---

## Self-Review Notes

- **Spec coverage:** BigQuery totals (Task 3), Redshift totals via `SVV_ALL_SCHEMAS` (Task 1), reconcilable fallback for both (Tasks 1 & 3, tested), `ingestAllDatabases=false` single-DB handling (Task 1, tested), filter-only helpers with no status side effects (Tasks 1 & 3), DRY predicate sharing with the walk (Tasks 2 & 4), no incremental side effects in totals path (enforced — totals path never calls incremental setup), testing approach (all tasks + Task 5). All spec sections map to a task.
- **`SVV_ALL_SCHEMAS` risk:** cannot be verified against a live cluster here; the `try/except → None → mark_reconcilable` path (Task 1 Step 5, tested in `test_schema_names_by_database_groups_rows_and_returns_none_on_error` + `test_declare_progress_totals_reconciles_when_view_unavailable`) guarantees graceful degradation if the column names/behavior differ on serverless or older clusters. Confirm columns with `SELECT database_name, schema_name FROM SVV_ALL_SCHEMAS LIMIT 5` on a real cluster before merge.
- **Type consistency:** `_schema_names_by_database` returns `Optional[Dict[str, List[str]]]` and `_kept_schema_counts` returns `Optional[Dict[str, int]]`; both callers branch on `is None` → `mark_reconcilable`. `declare_progress_totals` signature `(self, totals: TotalsDeclarer) -> None` matches the base hook in `api/topology_runner.py`.
- **Walk refactors (Tasks 2 & 4) are optional-but-recommended:** if the executor finds any behavior mismatch flagged by the existing suites, they may skip the refactor and keep the (small) duplicated filter lines — the totals feature (Tasks 1 & 3) stands alone and does not depend on Tasks 2/4.
