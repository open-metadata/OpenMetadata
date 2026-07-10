# Hoist Filter Predicates to DatabaseServiceSource — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the duplicated `_is_database_filtered` / `_is_schema_filtered` predicates into the shared `DatabaseServiceSource` base and delete the three connector copies, so there is one filter-predicate implementation.

**Architecture:** Add the two pure predicates to `DatabaseServiceSource` (`database_service.py`) — the common base every SQL connector extends — then delete the identical copies from BigQuery, Redshift, and Snowflake, which inherit them unchanged. The base's own walk methods (`_get_filtered_database_names` / `_get_filtered_schema_names`) are intentionally left untouched (Scope A).

**Tech Stack:** Python 3.10-3.11, pytest, OpenMetadata ingestion framework.

## Global Constraints

- Python venv MUST be used: run tests via `/Users/apple/conductor/workspaces/OpenMetadata/zagreb/env/bin/python -m pytest ...` from `ingestion/`. Never bare `python`. Never pip install.
- Predicates are **pure**: no `self.status.filter(...)` or other side effects.
- Use Snowflake's safer guard form: `filter_name = <fqn> if self.source_config.useFqnForFiltering and <fqn> else <bare_name>`.
- `_is_database_filtered` uses `filter_by_database`; `_is_schema_filtered` uses `filter_by_schema`. Both delegate to the same `_filter`, so this is equivalent to existing behavior.
- Do NOT modify `_get_filtered_database_names` / `_get_filtered_schema_names` in the base (Scope A).
- Do NOT touch `ingestion/Dockerfile.ci`. Stage files by explicit path (never `git add -A`/`-u`).
- Python test hygiene: pytest + plain `assert`, no `unittest.TestCase`, mocks only at boundaries, assert observable outcomes.
- Reference (identical logic being consolidated): `snowflake/metadata.py::_is_schema_filtered`, `redshift/metadata.py::_is_database_filtered`/`_is_schema_filtered`, `bigquery/metadata.py::_is_database_filtered`/`_is_schema_filtered`.
- Verified facts for tests: with `metadata = MagicMock()` and `context.get().database_service == "svc"`, `fqn.build(... Database, database_name="db")` → `"svc.db"`, and `fqn.build(... DatabaseSchema, database_name="db", schema_name="sch")` → `"svc.db.sch"`. `filter_by_database(None, name)` → `False`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `ingestion/src/metadata/ingestion/source/database/database_service.py` | Base `DatabaseServiceSource` | Add `filter_by_database` import + two predicate methods. |
| `ingestion/tests/unit/source/database/test_base_filter_predicates.py` | Base predicate tests | Create. |
| `ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py` | BigQuery source | Delete both predicates + unused imports. |
| `ingestion/src/metadata/ingestion/source/database/redshift/metadata.py` | Redshift source | Delete both predicates + unused imports. |
| `ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py` | Snowflake source | Delete `_is_schema_filtered` + unused `filter_by_schema` import. |

---

## Task 1: Add the predicates to DatabaseServiceSource

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/database_service.py` (import line 73; add methods near the existing `_get_filtered_schema_names`, ~line 574)
- Test: `ingestion/tests/unit/source/database/test_base_filter_predicates.py` (create)

**Interfaces:**
- Consumes: `Database`, `DatabaseSchema`, `fqn` (already imported in `database_service.py`); `filter_by_schema` (already imported); `filter_by_database` (to be added); instance attrs `self.metadata`, `self.context`, `self.source_config`.
- Produces:
  - `DatabaseServiceSource._is_database_filtered(self, database_name: str) -> bool`
  - `DatabaseServiceSource._is_schema_filtered(self, database_name: str, schema_name: str) -> bool`

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/source/database/test_base_filter_predicates.py`:

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
"""The shared ``DatabaseServiceSource`` filter predicates: pure, FQN-aware,
honoring ``useFqnForFiltering``."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.database_service import DatabaseServiceSource


class _StubSource(DatabaseServiceSource):
    """Concrete stand-in for the ABC so the base predicates can be unit-tested
    directly. Clearing ``__abstractmethods__`` lets ``object.__new__`` build a
    bare instance without implementing the 11 unrelated abstract methods."""


_StubSource.__abstractmethods__ = frozenset()


def _source(use_fqn, database_pattern=None, schema_pattern=None):
    source = object.__new__(_StubSource)
    source.metadata = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.source_config = SimpleNamespace(
        useFqnForFiltering=use_fqn,
        databaseFilterPattern=database_pattern,
        schemaFilterPattern=schema_pattern,
    )
    return source


def test_database_not_filtered_when_pattern_is_none():
    assert _source(use_fqn=False)._is_database_filtered("db") is False


def test_database_filtered_by_bare_name_exclude():
    source = _source(use_fqn=False, database_pattern=FilterPattern(excludes=["db"]))
    assert source._is_database_filtered("db") is True
    assert source._is_database_filtered("other") is False


def test_database_fqn_matching_depends_on_use_fqn_flag():
    # Exclude targets the FQN "svc.db", which only matches when useFqnForFiltering is on.
    pattern = FilterPattern(excludes=["svc.db"])
    assert _source(use_fqn=True, database_pattern=pattern)._is_database_filtered("db") is True
    assert _source(use_fqn=False, database_pattern=pattern)._is_database_filtered("db") is False


def test_schema_not_filtered_when_pattern_is_none():
    assert _source(use_fqn=False)._is_schema_filtered("db", "sch") is False


def test_schema_filtered_by_bare_name_exclude():
    source = _source(use_fqn=False, schema_pattern=FilterPattern(excludes=["sch"]))
    assert source._is_schema_filtered("db", "sch") is True
    assert source._is_schema_filtered("db", "other") is False


def test_schema_fqn_matching_depends_on_use_fqn_flag():
    # Exclude targets the schema FQN "svc.db.sch".
    pattern = FilterPattern(excludes=["svc.db.sch"])
    assert _source(use_fqn=True, schema_pattern=pattern)._is_schema_filtered("db", "sch") is True
    assert _source(use_fqn=False, schema_pattern=pattern)._is_schema_filtered("db", "sch") is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ingestion && ../env/bin/python -m pytest tests/unit/source/database/test_base_filter_predicates.py -q`
Expected: FAIL — `AttributeError: '_StubSource' object has no attribute '_is_database_filtered'`.
(The `_StubSource` subclass with `__abstractmethods__` cleared lets `object.__new__` build a bare base instance; the failure must be the missing predicate, not an instantiation error.)

- [ ] **Step 3: Add the `filter_by_database` import**

In `database_service.py`, change line 73:

```python
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_stored_procedure
```

- [ ] **Step 4: Add the two predicate methods**

In `database_service.py`, add these methods to `DatabaseServiceSource`, immediately after `_get_filtered_schema_names` (which ends at ~line 573, right before `is_stored_procedure_filtered`):

```python
def _is_database_filtered(self, database_name: str) -> bool:
    """Whether a database fails ``databaseFilterPattern``. Pure predicate — no
    status side effects — so the totals hook and the walk can share it."""
    database_fqn = fqn.build(
        self.metadata,
        entity_type=Database,
        service_name=self.context.get().database_service,
        database_name=database_name,
    )
    filter_name = database_fqn if self.source_config.useFqnForFiltering and database_fqn else database_name
    return filter_by_database(self.source_config.databaseFilterPattern, filter_name)

def _is_schema_filtered(self, database_name: str, schema_name: str) -> bool:
    """Whether a schema fails ``schemaFilterPattern``, matched the same way as the
    walk (FQN or bare name per ``useFqnForFiltering``). Context-free: the FQN is
    built from the explicit database name."""
    schema_fqn = fqn.build(
        self.metadata,
        entity_type=DatabaseSchema,
        service_name=self.context.get().database_service,
        database_name=database_name,
        schema_name=schema_name,
    )
    filter_name = schema_fqn if self.source_config.useFqnForFiltering and schema_fqn else schema_name
    return filter_by_schema(self.source_config.schemaFilterPattern, filter_name)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd ingestion && ../env/bin/python -m pytest tests/unit/source/database/test_base_filter_predicates.py -q`
Expected: PASS (6 tests).

- [ ] **Step 6: Confirm no connector regression (connectors still have their own copies, which shadow the base — all green)**

Run: `cd ingestion && ../env/bin/python -m pytest tests/unit/source/database/test_bigquery_progress_count.py tests/unit/source/database/test_redshift_progress_count.py tests/unit/source/database/test_snowflake_progress_count.py -q`
Expected: PASS (unchanged).

- [ ] **Step 7: Lint**

Run: `cd ingestion && ../env/bin/python -m ruff check src/metadata/ingestion/source/database/database_service.py tests/unit/source/database/test_base_filter_predicates.py && ../env/bin/python -m ruff format --check src/metadata/ingestion/source/database/database_service.py tests/unit/source/database/test_base_filter_predicates.py`
Expected: clean (if format differs, run `ruff format` on the two files first).

- [ ] **Step 8: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/database_service.py \
        ingestion/tests/unit/source/database/test_base_filter_predicates.py
git commit -m "refactor(ingestion): add shared filter predicates to DatabaseServiceSource

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Delete the connector copies

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py` (delete `_is_database_filtered` ~811-821 and `_is_schema_filtered` ~823-834; imports line 113)
- Modify: `ingestion/src/metadata/ingestion/source/database/redshift/metadata.py` (delete `_is_database_filtered` ~282-292 and `_is_schema_filtered` ~294-306; imports line 100)
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py` (delete `_is_schema_filtered` ~470-482; imports line 133)

**Interfaces:**
- Consumes: `DatabaseServiceSource._is_database_filtered` / `_is_schema_filtered` (from Task 1) — inherited by all three connectors.
- Produces: no new surface. All existing call sites (`self._is_database_filtered(...)`, `self._is_schema_filtered(...)`) resolve to the inherited base methods. BigQuery passes `project_id` as the `database_name` argument (a project is the database) — unchanged.

- [ ] **Step 1: Delete BigQuery's two predicates and clean imports**

In `bigquery/metadata.py`, delete the entire `_is_database_filtered` method (~lines 811-821) and the entire `_is_schema_filtered` method (~lines 823-834). Then update the filters import (line 113) — both are now unused in this file (all call sites use `self._is_*_filtered`, and no other code references `filter_by_database`/`filter_by_schema` here):

Remove the line:
```python
from metadata.utils.filters import filter_by_database, filter_by_schema
```
(Delete it entirely — grep the file first to be sure: `grep -n "filter_by_database\|filter_by_schema" bigquery/metadata.py` should show ONLY the deleted methods' former lines. If any other use remains, keep the needed name.)

- [ ] **Step 2: Delete Redshift's two predicates and clean imports**

In `redshift/metadata.py`, delete the entire `_is_database_filtered` method (~lines 282-292) and the entire `_is_schema_filtered` method (~lines 294-306). Then remove the now-unused import (line 100):
```python
from metadata.utils.filters import filter_by_database, filter_by_schema
```
(Delete entirely — verify with `grep -n "filter_by_database\|filter_by_schema" redshift/metadata.py` that no other use remains before removing.)

- [ ] **Step 3: Delete Snowflake's `_is_schema_filtered` and clean the import**

In `snowflake/metadata.py`, delete the entire `_is_schema_filtered` method (~lines 470-482). Snowflake still uses `filter_by_database` (in `_compute_filtered_database_names`, ~line 426) but no longer uses `filter_by_schema`. Change the import (line 133) from:
```python
from metadata.utils.filters import filter_by_database, filter_by_schema
```
to:
```python
from metadata.utils.filters import filter_by_database
```
(Verify with `grep -n "filter_by_schema" snowflake/metadata.py` — should be empty after the method deletion.)

- [ ] **Step 4: Verify the connectors now inherit the base predicates**

Run: `cd ingestion && ../env/bin/python -c "
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.ingestion.source.database.redshift.metadata import RedshiftSource
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
for cls in (BigquerySource, RedshiftSource, SnowflakeSource):
    assert '_is_schema_filtered' not in cls.__dict__, cls.__name__ + ' still defines _is_schema_filtered'
    assert cls._is_schema_filtered is DatabaseServiceSource._is_schema_filtered, cls.__name__ + ' does not inherit base _is_schema_filtered'
for cls in (BigquerySource, RedshiftSource):
    assert '_is_database_filtered' not in cls.__dict__, cls.__name__ + ' still defines _is_database_filtered'
    assert cls._is_database_filtered is DatabaseServiceSource._is_database_filtered, cls.__name__ + ' does not inherit base _is_database_filtered'
print('OK: all three connectors inherit the base predicates')
"`
Expected: `OK: all three connectors inherit the base predicates`.

- [ ] **Step 5: Lint (catches any leftover unused import)**

Run: `cd ingestion && ../env/bin/python -m ruff check src/metadata/ingestion/source/database/bigquery/metadata.py src/metadata/ingestion/source/database/redshift/metadata.py src/metadata/ingestion/source/database/snowflake/metadata.py`
Expected: `All checks passed!` (a leftover unused import fails here with F401 — fix by removing it).

- [ ] **Step 6: Run the progress-count tests (now exercising the inherited predicates)**

Run: `cd ingestion && ../env/bin/python -m pytest tests/unit/source/database/test_bigquery_progress_count.py tests/unit/source/database/test_redshift_progress_count.py tests/unit/source/database/test_snowflake_progress_count.py -q`
Expected: PASS (unchanged).

- [ ] **Step 7: Run the broader connector regression suites**

Run: `cd ingestion && ../env/bin/python -m pytest tests/unit/topology/database/test_bigquery.py tests/unit/topology/database/test_redshift.py tests/unit/topology/database/test_redshift_serverless.py tests/unit/topology/database/test_snowflake.py -q`
Expected: PASS (unchanged — behavior identical, predicates just moved).

- [ ] **Step 8: Format + final format check**

Run: `cd ingestion && ../env/bin/python -m ruff format src/metadata/ingestion/source/database/bigquery/metadata.py src/metadata/ingestion/source/database/redshift/metadata.py src/metadata/ingestion/source/database/snowflake/metadata.py && ../env/bin/python -m ruff format --check src/metadata/ingestion/source/database/bigquery/metadata.py src/metadata/ingestion/source/database/redshift/metadata.py src/metadata/ingestion/source/database/snowflake/metadata.py`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py \
        ingestion/src/metadata/ingestion/source/database/redshift/metadata.py \
        ingestion/src/metadata/ingestion/source/database/snowflake/metadata.py
git commit -m "refactor(ingestion): delete duplicated filter predicates; inherit from base

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** predicates added to base (Task 1); Snowflake safer guard adopted (Task 1 Step 4); connector copies deleted + import cleanup, Snowflake keeps `filter_by_database` (Task 2 Steps 1-3); base walk methods untouched (not in any task — Scope A); base unit test (Task 1); regression via progress-count + connector suites + ruff (both tasks). All spec sections mapped.
- **Ordering keeps tests green:** Task 1 adds base methods while connectors still define their own (shadowing, harmless). Task 2 removes the shadows so the base versions take effect. Neither task leaves the tree red.
- **Type consistency:** `_is_database_filtered(self, database_name: str) -> bool` and `_is_schema_filtered(self, database_name: str, schema_name: str) -> bool` — same signatures used in the base definition (Task 1) and the inheritance assertions (Task 2 Step 4).
- **Behavior:** unified predicates use the `and <fqn>` guard; equivalent to prior behavior since `fqn.build` returns a non-empty string when service/db names are set. `filter_by_database` vs `filter_by_schema` for the db predicate is equivalent (both delegate to `_filter`).
