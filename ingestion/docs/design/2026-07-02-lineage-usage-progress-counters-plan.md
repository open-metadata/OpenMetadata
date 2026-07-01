# Lineage & Usage Progress Counters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the usage and lineage ingestion workflows live progress counters + ETA (CLI header and SSE), driven from the shared base sources so every SQL connector inherits it — with Snowflake as the first beneficiary.

**Architecture:** Reuse the existing `ProgressRegistry` global-counter / ETA / rendering machinery unchanged. Extract the registry-owning lazy `progress` property into a small mixin the query-parser base inherits, then add counter call-sites in the shared `UsageSource._iter` (a reconciled `Queries` counter with a `resultLimit × days` ceiling + ETA) and `LineageSource.yield_query_lineage` (legacy `Queries` counter), plus a totalless `LineageRecords` counter at Snowflake's ACCESS_HISTORY emit sites.

**Tech Stack:** Python 3.10–3.11, pytest, Pydantic 2.x. No new dependencies. No JSON-schema change, no `make generate`.

## Global Constraints

- **No JSON-schema / `make generate` change.** The feature rides the already-shipped `ProgressUpdate.globalCounters` array and `estimatedSecondsRemaining` field.
- **Zero extra warehouse queries.** Denominators come from `resultLimit` and the `self.start`/`self.end` day span only.
- **pytest style** (project rule): plain classes prefixed `Test`, `assert` statements, `unittest.mock` for mocking, no `unittest.TestCase`.
- **Test the outcome, not call wiring** — assert on registry/rendered state.
- **Python venv required:** `source env/bin/activate` (repo root) before running any `pytest`.
- Run lint before finishing: `cd ingestion && make py_format` (ruff fix + format).

---

### Task 1: Registry — bulk `track(n)` + start the clock on counter activity

**Files:**
- Modify: `ingestion/src/metadata/utils/progress_registry.py` (`set_total` ~L125, `seed_scope_total` ~L137, `track` ~L158)
- Test: `ingestion/tests/unit/test_progress_registry.py`

**Interfaces:**
- Consumes: existing `ProgressRegistry` (`set_total`, `seed_scope_total`, `reconcile_scope_total`, `global_counters`, `elapsed_seconds`).
- Produces: `track(type_: str, n: int = 1) -> None` (bulk increment); `_started_at` is set on the first `set_total` / `seed_scope_total` / `track` (previously only on `open()`), so `elapsed_seconds()` / `eta_seconds()` work without a topology tree.

- [ ] **Step 1: Write the failing tests**

Add to `ingestion/tests/unit/test_progress_registry.py`:

```python
class TestGlobalCounterClockAndBulk:
    def test_track_accepts_bulk_count(self):
        registry = ProgressRegistry()
        registry.set_total("Queries", 100)
        registry.track("Queries", 40)
        registry.track("Queries", 2)
        assert registry.global_counters() == [("Queries", 42, 100)]

    def test_track_defaults_to_one(self):
        registry = ProgressRegistry()
        registry.set_total("Workspace", None)
        registry.track("Workspace")
        assert registry.global_counters() == [("Workspace", 1, None)]

    def test_clock_starts_on_counter_activity_without_open(self):
        registry = ProgressRegistry()
        assert registry.elapsed_seconds() is None
        registry.seed_scope_total("Queries", "run", 50)
        assert registry.elapsed_seconds() is not None

    def test_seed_then_reconcile_settles_total_to_done(self):
        registry = ProgressRegistry()
        registry.seed_scope_total("Queries", "run", 100)
        registry.track("Queries", 40)
        registry.reconcile_scope_total("Queries", "run", 40)
        assert registry.global_counters() == [("Queries", 40, 40)]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/unit/test_progress_registry.py::TestGlobalCounterClockAndBulk -v`
Expected: FAIL — `test_track_accepts_bulk_count` errors (`track() takes 2 positional arguments`), `test_clock_starts_on_counter_activity_without_open` fails (`elapsed_seconds()` is `None`).

- [ ] **Step 3: Implement**

In `progress_registry.py`, add a private helper and call it from the three methods. Change `track`'s signature to accept `n`:

```python
    def _mark_started(self) -> None:
        if self._started_at is None:
            self._started_at = time.monotonic()

    def set_total(self, type_: str, total: Optional[int]) -> None:  # noqa: UP045
        """Declare a flat global total for ``type_`` (e.g. ``Database`` = 4).
        Header-level and independent of the tree — survives pruning."""
        with self._lock:
            self._mark_started()
            self._global.setdefault(type_, GlobalCounter()).total = total
```

Add `self._mark_started()` as the first statement inside the `with self._lock:` block of `seed_scope_total` too. Then update `track`:

```python
    def track(self, type_: str, n: int = 1) -> None:
        """Record ``n`` completed units of ``type_`` (default 1). No-op for an
        undeclared type, so callers may invoke it unconditionally."""
        with self._lock:
            self._mark_started()
            counter = self._global.get(type_)
            if counter is not None:
                counter.done += n
                if counter.total is not None and counter.total < counter.done:
                    counter.total = counter.done
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/unit/test_progress_registry.py -v`
Expected: PASS (all existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/metadata/utils/progress_registry.py ingestion/tests/unit/test_progress_registry.py
git commit -m "feat(ingestion): bulk track(n) + start progress clock on counter activity"
```

---

### Task 2: Reporter — suppress the `Ingested:` line when no assets

**Files:**
- Modify: `ingestion/src/metadata/workflow/progress_render.py` (`ProgressReporter._header` ~L83-93)
- Test: `ingestion/tests/unit/workflow/test_progress_rendering.py`

**Interfaces:**
- Consumes: `ProgressRegistry.assets_ingested()`, `global_counters()`.
- Produces: `_header` renders the `Ingested: N assets` line **only** when `assets_ingested() > 0`; counter lines render regardless. No signature change.

- [ ] **Step 1: Write the failing tests**

Add to `ingestion/tests/unit/workflow/test_progress_rendering.py`:

```python
class TestHeaderIngestedSuppression:
    def test_ingested_line_suppressed_when_no_assets(self):
        registry = ProgressRegistry()
        registry.set_total("Queries", 100)
        registry.track("Queries", 12)
        text = ProgressReporter(registry).cli()
        assert "Queries 12/100" in text
        assert "Ingested:" not in text

    def test_totalless_counter_renders_without_denominator_or_eta(self):
        registry = ProgressRegistry()
        registry.set_total("LineageRecords", None)
        registry.track("LineageRecords", 8210)
        text = ProgressReporter(registry).cli()
        assert "LineageRecords 8210" in text
        assert "/" not in text
        assert "Ingested:" not in text

    def test_ingested_line_kept_when_assets_present(self):
        registry = ProgressRegistry()
        registry.open(["db", "schema"], "Table", 3)
        registry.advance(["db", "schema"], "Table")
        text = ProgressReporter(registry).cli()
        assert "Ingested: 1 assets" in text
```

(Match the existing file's imports for `ProgressRegistry` / `ProgressReporter`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/unit/workflow/test_progress_rendering.py::TestHeaderIngestedSuppression -v`
Expected: FAIL — `Ingested:` appears (as `Ingested: 0 assets`) in the first two tests.

- [ ] **Step 3: Implement**

In `progress_render.py`, guard the appended line:

```python
        assets = self._registry.assets_ingested()
        if assets > 0:
            lines.append(f"Ingested: {assets:,} assets")
        return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/unit/workflow/test_progress_rendering.py -v`
Expected: PASS (existing metadata-header tests still pass — they advance leaves, so assets > 0).

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/metadata/workflow/progress_render.py ingestion/tests/unit/workflow/test_progress_rendering.py
git commit -m "feat(ingestion): suppress Ingested line when no leaf assets counted"
```

---

### Task 3: Extract `ProgressTrackingMixin` and share it

**Files:**
- Create: `ingestion/src/metadata/utils/progress_tracking.py`
- Modify: `ingestion/src/metadata/ingestion/api/topology_runner.py` (class decl L64; delete local `progress` property L122-130)
- Modify: `ingestion/src/metadata/ingestion/source/database/query_parser_source.py` (class decl L38)
- Test: `ingestion/tests/unit/test_progress_tracking_mixin.py`

**Interfaces:**
- Produces: `ProgressTrackingMixin` with `progress -> ProgressRegistry` (lazy, stored under `self.__dict__["_progress_registry"]` — the exact key `_progress_reporter()` scans). `QueryParserSource` and `TopologyRunnerMixin` both inherit it.

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/test_progress_tracking_mixin.py`:

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
"""Unit tests for the shared ProgressTrackingMixin."""

from metadata.utils.progress_registry import ProgressRegistry
from metadata.utils.progress_tracking import ProgressTrackingMixin


class _Owner(ProgressTrackingMixin):
    pass


class TestProgressTrackingMixin:
    def test_lazily_creates_one_registry(self):
        owner = _Owner()
        registry = owner.progress
        assert isinstance(registry, ProgressRegistry)
        assert owner.progress is registry

    def test_exposes_the_scanned_attribute(self):
        owner = _Owner()
        _ = owner.progress
        assert owner.__dict__.get("_progress_registry") is owner.progress
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/unit/test_progress_tracking_mixin.py -v`
Expected: FAIL — `ModuleNotFoundError: metadata.utils.progress_tracking`.

- [ ] **Step 3: Implement the mixin**

Create `ingestion/src/metadata/utils/progress_tracking.py`:

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
"""Shared mixin that lazily owns a per-source ProgressRegistry.

Any Source that mixes this in gets a ``progress`` registry discoverable by the
workflow reporter (which scans steps for the ``_progress_registry`` attribute),
without participating in the topology runner.
"""

from metadata.utils.progress_registry import ProgressRegistry


class ProgressTrackingMixin:
    @property
    def progress(self) -> ProgressRegistry:
        """Per-Source progress registry. First access is single-threaded
        (in _iter, before worker threads spawn), so lazy init is safe."""
        registry = self.__dict__.get("_progress_registry")
        if registry is None:
            registry = ProgressRegistry()
            self.__dict__["_progress_registry"] = registry
        return registry
```

- [ ] **Step 4: Wire it into the two bases**

In `topology_runner.py`: add the import near the other `metadata.utils` imports:

```python
from metadata.utils.progress_tracking import ProgressTrackingMixin
```

Change the class declaration (L64) from:

```python
class TopologyRunnerMixin(Generic[C]):
```
to:
```python
class TopologyRunnerMixin(ProgressTrackingMixin, Generic[C]):
```

Delete the now-duplicated `progress` property (the `@property def progress` block at ~L122-130) — the mixin supplies it with identical behaviour and the same `_progress_registry` key.

In `query_parser_source.py`: add the import:

```python
from metadata.utils.progress_tracking import ProgressTrackingMixin
```

Change the class declaration (L38) from:

```python
class QueryParserSource(Source, ABC):
```
to:
```python
class QueryParserSource(ProgressTrackingMixin, Source, ABC):
```

- [ ] **Step 5: Run tests to verify the mixin + no regression in topology progress**

Run: `python -m pytest tests/unit/test_progress_tracking_mixin.py tests/unit/test_progress_registry.py tests/unit/workflow/test_progress_rendering.py -v`
Expected: PASS. Then a smoke import to confirm the topology runner still constructs its registry:
Run: `python -c "from metadata.ingestion.api.topology_runner import TopologyRunnerMixin; print(hasattr(TopologyRunnerMixin, 'progress'))"`
Expected: prints `True`.

- [ ] **Step 6: Commit**

```bash
git add ingestion/src/metadata/utils/progress_tracking.py ingestion/tests/unit/test_progress_tracking_mixin.py ingestion/src/metadata/ingestion/api/topology_runner.py ingestion/src/metadata/ingestion/source/database/query_parser_source.py
git commit -m "refactor(ingestion): extract ProgressTrackingMixin; share registry ownership"
```

---

### Task 4: Usage — reconciled `Queries` counter in the shared `_iter`

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/usage_source.py` (`_iter` L165-168)
- Test: `ingestion/tests/unit/test_usage_progress.py`

**Interfaces:**
- Consumes: `ProgressTrackingMixin.progress` (Task 3); `track(n)` + reconcile (Task 1); `self.start`, `self.end`, `self.source_config.resultLimit` from `QueryParserSource`.
- Produces: after a usage run, `progress.global_counters()` has a single `("Queries", <processed>, <processed>)` entry (seeded at `resultLimit × days`, reconciled to the real count).

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/test_usage_progress.py`:

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
"""Progress counter behaviour for the shared UsageSource._iter."""

from datetime import datetime
from types import SimpleNamespace

from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.database.usage_source import UsageSource


def _make_usage_source(batches, result_limit, start, end):
    """Build a UsageSource without its heavy __init__, wired with a fake
    get_table_query so _iter can be exercised in isolation."""
    source = UsageSource.__new__(UsageSource)
    source.__dict__["source_config"] = SimpleNamespace(resultLimit=result_limit)
    source.start = start
    source.end = end
    source.get_table_query = lambda: iter(batches)
    return source


def _query():
    return TableQuery(query="select 1", serviceName="svc")


class TestUsageProgress:
    def test_seeds_ceiling_and_reconciles_to_real_count(self):
        # 2-day span, resultLimit 1000 -> ceiling 2000; 3 real queries across 2 batches
        batches = [
            TableQueries(queries=[_query(), _query()]),
            TableQueries(queries=[_query()]),
        ]
        source = _make_usage_source(
            batches, result_limit=1000, start=datetime(2026, 1, 1), end=datetime(2026, 1, 3)
        )

        list(UsageSource._iter(source))

        assert source.progress.global_counters() == [("Queries", 3, 3)]

    def test_ceiling_is_result_limit_times_days_before_reconcile(self):
        captured = {}

        def batches():
            # peek the seeded total after the first batch, before completion
            captured["mid"] = source.progress.global_counters()
            yield TableQueries(queries=[_query()])

        source = _make_usage_source(
            batches(), result_limit=1000, start=datetime(2026, 1, 1), end=datetime(2026, 1, 3)
        )
        list(UsageSource._iter(source))

        # first observation: total seeded at resultLimit * 2 days = 2000
        assert captured["mid"] == [("Queries", 0, 2000)]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/unit/test_usage_progress.py -v`
Expected: FAIL — `global_counters()` is empty (`[]`), no `Queries` counter declared yet.

- [ ] **Step 3: Implement the counter in `_iter`**

Replace `UsageSource._iter` (L165-168) with:

```python
    def _iter(self, *_, **__) -> Iterable[Either[TableQuery]]:
        days = max(1, (self.end - self.start).days)
        self.progress.seed_scope_total("Queries", "run", self.source_config.resultLimit * days)
        processed = 0
        for table_queries in self.get_table_query():
            if table_queries:
                count = len(table_queries.queries)
                self.progress.track("Queries", count)
                processed += count
                yield Either(right=table_queries)
        self.progress.reconcile_scope_total("Queries", "run", processed)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/unit/test_usage_progress.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/usage_source.py ingestion/tests/unit/test_usage_progress.py
git commit -m "feat(ingestion): usage Queries progress counter with reconciled resultLimit×days ceiling"
```

---

### Task 5: Legacy lineage — `Queries` counter via a producer wrapper

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/lineage_source.py` (`yield_query_lineage` L357-384)
- Test: `ingestion/tests/unit/lineage/test_lineage_progress.py`

**Interfaces:**
- Consumes: `progress` (Task 3), `seed_scope_total`/`track`/`reconcile_scope_total` (Task 1), `self.query_lineage_producer`, `self.source_config.resultLimit`.
- Produces: on the legacy QUERY_HISTORY path, `progress.global_counters()` has `("Queries", <produced>, <produced>)` after the run. Not declared on the ACCESS_HISTORY override path.

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/lineage/test_lineage_progress.py`:

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
"""Progress counter behaviour for the legacy lineage query path."""

from types import SimpleNamespace
from unittest.mock import patch

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource


def _lineage_source(result_limit, produced_queries):
    source = LineageSource.__new__(LineageSource)
    source.__dict__["source_config"] = SimpleNamespace(resultLimit=result_limit)
    source.query_lineage_producer = lambda: iter(produced_queries)
    return source


class TestLegacyLineageProgress:
    def test_producer_wrapper_tracks_and_reconciles_queries(self):
        produced = [TableQuery(query="select 1", serviceName="svc") for _ in range(4)]
        source = _lineage_source(result_limit=1000, produced_queries=produced)

        # Replace the heavy multiprocessing driver with one that just drains the
        # (wrapped) producer, which is what advances the counter.
        def fake_generate(producer_fn, processor_fn, args, **kwargs):
            for _ in producer_fn():
                yield from ()

        with patch.object(LineageSource, "generate_lineage_with_processes", staticmethod(fake_generate)):
            list(LineageSource.yield_query_lineage(source))

        assert source.progress.global_counters() == [("Queries", 4, 4)]
```

(If `LineageSource.yield_query_lineage` reads attributes like `self.service_connection`/`self.dialect`/`self.graph`/`self.config`/`self.metadata` before the `generate_lineage_with_processes` call, set them on the stub as `SimpleNamespace`/`None` to match — inspect L364-378 and add the minimal attributes the method touches. The test asserts only on the counter outcome.)

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/unit/lineage/test_lineage_progress.py -v`
Expected: FAIL — no `Queries` counter (`global_counters()` is `[]`).

- [ ] **Step 3: Implement the producer wrapper**

In `lineage_source.py`, edit `yield_query_lineage` (L357-384). Seed before, wrap the producer, reconcile after. Replace the body's `producer_fn = self.query_lineage_producer` and the trailing `yield from` with:

```python
        self.progress.seed_scope_total("Queries", "run", self.source_config.resultLimit)
        produced = 0

        def producer_fn():
            nonlocal produced
            for table_query in self.query_lineage_producer():
                produced += 1
                self.progress.track("Queries")
                yield table_query

        processor_fn = query_lineage_processor
        args = (
            self.metadata,
            self.dialect,
            self.graph,
            self.source_config.processCrossDatabaseLineage,
            self.source_config.crossDatabaseServiceNames,
            self.source_config.parsingTimeoutLimit,
            self.config.serviceName,
            self.get_query_parser_type(),
        )
        yield from self.generate_lineage_with_processes(
            producer_fn,
            processor_fn,
            args,
            max_threads=self.source_config.threads,
        )
        self.progress.reconcile_scope_total("Queries", "run", produced)
```

(Keep the existing `logger.info`, `connection_type`, and `self.dialect = ...` lines at the top of the method unchanged; only the producer/args/`yield from` region changes, plus the seed line before it and the reconcile line after.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/unit/lineage/test_lineage_progress.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/lineage_source.py ingestion/tests/unit/lineage/test_lineage_progress.py
git commit -m "feat(ingestion): legacy lineage Queries progress counter via producer wrapper"
```

---

### Task 6: Snowflake ACCESS_HISTORY — totalless `LineageRecords` counter

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/snowflake/lineage.py` (`_yield_access_history_lineage` L239-257; `_yield_combined_access_history` L273-307; `_yield_copy_history_lineage` ~L442+)
- Test: `ingestion/tests/unit/lineage/test_snowflake_access_history_progress.py`

**Interfaces:**
- Consumes: `progress` (Task 3), `set_total(type_, None)` + `track` (Task 1).
- Produces: after the ACCESS_HISTORY path, `progress.global_counters()` contains `("LineageRecords", <edges>, None)` and `eta_seconds()` is `None`.

- [ ] **Step 1: Write the failing test**

Create `ingestion/tests/unit/lineage/test_snowflake_access_history_progress.py`:

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
"""Progress counter behaviour for Snowflake's ACCESS_HISTORY lineage path."""

from unittest.mock import MagicMock

from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.snowflake.lineage import SnowflakeLineageSource


class TestAccessHistoryProgress:
    def test_tracks_lineage_records_without_total_or_eta(self):
        source = SnowflakeLineageSource.__new__(SnowflakeLineageSource)

        edges = [Either(right=MagicMock()) for _ in range(3)]
        source._yield_combined_access_history = lambda: iter(edges)
        source._yield_copy_history_lineage = lambda: iter([Either(right=MagicMock())])

        results = list(SnowflakeLineageSource._yield_access_history_lineage(source))

        assert len(results) == 4
        assert source.progress.global_counters() == [("LineageRecords", 4, None)]
        assert source.progress.eta_seconds() is None
```

Note: `_yield_access_history_lineage` wraps both sub-phases in try/except, so the test stubs the two sub-methods and asserts the counter is advanced once per emitted `Either`. The `track` call must live inside the sub-methods (per emitted edge), so instead stub at the row level — see Step 3; adjust the test to stub `_fetch_access_history_rows`/`_build_access_history_edge` if you prefer end-to-end, but the outcome asserted (counter == emitted count, total None) is the contract.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/unit/lineage/test_snowflake_access_history_progress.py -v`
Expected: FAIL — no `LineageRecords` counter.

- [ ] **Step 3: Implement**

In `snowflake/lineage.py`, declare the counter once at the top of `_yield_access_history_lineage` (before the two phases):

```python
        self.progress.set_total("LineageRecords", None)
```

Then add a `track` at each emit site. In `_yield_combined_access_history`, where it currently does `emitted += 1` before `yield Either(right=edge)`:

```python
                emitted += 1
                if row.query_text:
                    emitted_with_sql += 1
                self.progress.track("LineageRecords")
                yield Either(right=edge)  # pyright: ignore[reportCallIssue]
```

In `_yield_copy_history_lineage`, add `self.progress.track("LineageRecords")` immediately before each `yield Either(right=...)` of a built edge (next to its existing `emitted += 1`).

(If keeping the test at the `_yield_access_history_lineage` level as written, move the `track` to that wrapper — one call per `Either` drained from each phase — instead of inside the phases. Pick one site; the contract is one `track` per emitted edge. The version above counts at the true emit points, so also stub `_fetch_access_history_rows` + `_build_access_history_edge` in the test to drive N edges through `_yield_combined_access_history`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/unit/lineage/test_snowflake_access_history_progress.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/snowflake/lineage.py ingestion/tests/unit/lineage/test_snowflake_access_history_progress.py
git commit -m "feat(snowflake): LineageRecords progress counter on ACCESS_HISTORY lineage path"
```

---

### Task 7: Full-suite verification + lint

**Files:** none (verification only).

- [ ] **Step 1: Run the full progress + usage/lineage unit suites**

Run:
```bash
source env/bin/activate
cd ingestion
python -m pytest \
  tests/unit/test_progress_registry.py \
  tests/unit/test_progress_tracking_mixin.py \
  tests/unit/test_usage_progress.py \
  tests/unit/lineage/ \
  tests/unit/workflow/test_progress_rendering.py \
  tests/unit/workflow/test_status_mixin_progress.py -v
```
Expected: all PASS.

- [ ] **Step 2: Guard against stale `set_group` / single-axis API**

Run: `grep -rn "set_group\|complete_group\|group_progress" src/metadata | grep -v test`
Expected: no matches (the single-group axis was already replaced by `globalCounters` earlier on this branch).

- [ ] **Step 3: Confirm no schema drift was introduced**

Run: `git diff --name-only origin/main...HEAD -- '*.json' | grep -i progressUpdate || echo "no schema change"`
Expected: prints `no schema change`.

- [ ] **Step 4: Lint**

Run: `cd ingestion && make py_format_check`
Expected: passes. If it reports fixes, run `make py_format`, re-run the suites from Step 1, and amend the relevant commit.

- [ ] **Step 5: Final commit (only if lint produced changes)**

```bash
git add -A ingestion/src ingestion/tests
git commit -m "chore(ingestion): ruff format for lineage/usage progress counters"
```

---

## Self-Review

**Spec coverage:**
- Counting model — Usage `Queries X/(resultLimit×days)` reconciled + ETA → Task 4. Legacy lineage `Queries X/resultLimit` reconciled + ETA → Task 5. ACCESS_HISTORY `LineageRecords` totalless → Task 6. ✔
- Totalless-counter representation (reaches CLI + SSE via `global_counters()`; label = noun) — inherent to Tasks 4–6 using global counters; `Ingested:` suppression → Task 2. ✔
- Registry-owning seam on base sources (`ProgressTrackingMixin`) → Task 3. ✔
- Clock start without `open()`; bulk `track(n)` → Task 1. ✔
- No SSE/schema change; `globalCounters` + `estimatedSecondsRemaining` reused → verified in Task 7 Step 3 (no schema diff); the mixin's registry is discovered by the existing `_progress_reporter()` scan, and `send_progress_update` already maps `global_counters()` + `eta_seconds()`. ✔
- Extensibility — counters driven in shared `UsageSource._iter` / `LineageSource.yield_query_lineage`, so any SQL connector inherits them; Snowflake adds one call site for its bespoke ACCESS_HISTORY path. ✔
- Edge cases: `days == 0` clamp → Task 4 (`max(1, …)`); actual < ceiling reconcile-down → Task 1 + Task 4 tests; totalless `track` requires prior declaration → Task 6 (`set_total(..., None)` first). ✔

**Placeholder scan:** no TBD/TODO; every code step shows complete code. Tasks 5 and 6 flag stub-attribute adjustments to match the exact methods — these are inspection notes, not missing code (the asserted contract and the production edits are fully specified).

**Type consistency:** `track(type_, n=1)`, `seed_scope_total(type_, scope, n)`, `reconcile_scope_total(type_, scope, observed)`, `set_total(type_, total)`, `global_counters() -> List[Tuple[str, int, Optional[int]]]`, `progress -> ProgressRegistry` used identically across Tasks 1, 3, 4, 5, 6. Counter labels `"Queries"` and `"LineageRecords"` are consistent everywhere.
