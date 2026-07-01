# Lineage & Usage Progress Counters — Design

**Date:** 2026-07-02
**Branch:** `manila`
**Status:** Approved (pre-implementation)

## Problem

Progress tracking (global counters + ETA + CLI/SSE rendering) exists for the
**metadata** topology walk. The **usage** and **lineage** workflows show no
progress at all: their sources iterate through `_iter` rather than the topology
runner, so they never create a `_progress_registry`, and the report timer's
`_progress_reporter()` (which scans workflow steps for that attribute) finds
nothing to render.

Goal: give usage and lineage the same live progress + ETA, and place the seam
in the **shared base sources** so every SQL connector inherits it — Snowflake is
just the first beneficiary, with no Snowflake-specific counting code.

## Goals

- Live progress for usage and lineage runs, in the CLI header and streamed over
  SSE, using the existing `GlobalCounter` / ETA / rendering machinery unchanged.
- The reusable seam lives in the base sources (`QueryParserSource`,
  `UsageSource`, `LineageSource`) — connectors get progress by inheritance.
- Honest denominators/ETA only where they are free and meaningful; a plain
  climbing count everywhere else. Never a misleading bar.
- Zero extra queries against the warehouse.

## Non-Goals

- No active-scope tree for these workflows (no sub-scope worth drilling into;
  daily runs collapse any day/window grouping to a single node). Header-only.
- No `COUNT(*)` pre-scans. Denominators come from values already computed
  (`resultLimit`, the day span). ETA on the ACCESS_HISTORY lineage path is
  explicitly out of scope (see below).
- No new connector adoption beyond what inheriting the bases provides. Snowflake
  is validated; other SQL connectors inherit the same behaviour but are not
  separately verified here.
- No UI rendering work — ingestion → server contract (CLI + existing SSE schema)
  only.

## Background: why these units (the decisions behind the model)

The iteration unit differs by path, which dictates what can be counted:

| Path | What it iterates | `resultLimit` | Denominator available? |
|---|---|---|---|
| **Usage** (`usage_source.py`, `snowflake/usage.py:yield_table_queries`) | `TableQuery` rows, **per day** | caps **per day** | yes — `resultLimit × days` is a true ceiling |
| **Legacy lineage** — QUERY_HISTORY (`_use_access_history=False`) | `TableQuery` rows, one offset loop | caps once | yes — `resultLimit` |
| **ACCESS_HISTORY lineage** — default (`snowflake/lineage.py:273`) | **deduplicated table-edges per date-window** | none | **no** |

Why the ACCESS_HISTORY path gets **no denominator / no ETA**:

- Its emitted unit is table-edges produced by a server-side
  `FLATTEN + join + GROUP BY`. The edge total only exists *after* that
  (expensive) aggregation runs, so `COUNT(*)` of the result re-runs the heavy
  scan — it would roughly **double** the most expensive query in the run.
- Cheaper counts (raw `ACCESS_HISTORY` rows, `DISTINCT query_id`) are a
  **different unit** than what the client emits (the dedup happens server-side;
  the client only ever iterates the aggregated edges), so any such denominator
  produces a bar pinned near 0%.
- **Date windows** are the only quantity both free-upfront and equal-unit to
  what the client advances on — but with the default `accessHistoryChunkSize=2`
  and the common **daily** lineage schedule (`queryLogDuration≈1`), a run is a
  **single window**, so `Windows 1/1` is a useless bar. Not worth the machinery.

Conclusion: the ACCESS_HISTORY path shows a plain climbing count of lineage
records, no denominator, no ETA. The query paths get the reconciled ceiling +
ETA because there a denominator is free and meaningful.

## Counting model (final)

| Path | Counter (label = the noun) | Total | ETA |
|---|---|---|---|
| **Usage** | `Queries` | `resultLimit × days`, reconciled to the real count as it runs | yes |
| **Legacy lineage** | `Queries` | `resultLimit`, reconciled | yes |
| **ACCESS_HISTORY lineage** | `LineageRecords` | `None` (running count) | no |

Rendered CLI (header-only):

```
# usage / legacy lineage
Queries         1,240/5,000   ~2m

# ACCESS_HISTORY lineage (default)
LineageRecords  8,210
```

### Representation choice — totalless global counter, not the `Ingested:` line

Each live count is a **`GlobalCounter`** whose `entityType` label is the noun,
rather than the generic `Ingested: N assets` line. Rationale:

- Global counters already flow to **both** the CLI header and the SSE
  `globalCounters` array; the `Ingested:` line only reaches SSE via
  `payload()`'s tree root, and these workflows have **no tree** — so a totalless
  global counter is the only way the ACCESS_HISTORY count reaches the server.
- The counter's label carries the per-workflow noun (`Queries` /
  `LineageRecords`) for free — no new per-source "noun" field needed.
- This is a net *removal* of surface vs. a per-source noun: it reuses
  `global_counters()` end-to-end.

The generic `Ingested: N assets` line is **suppressed when
`assets_ingested() == 0`** (see reporter change) so usage/lineage — which never
call `advance()` — don't render a stray `Ingested: 0 assets`. Metadata is
unaffected (it calls `advance()` on leaf entities, so its line still renders).

## Components & changes

### (1) Registry-owning seam on the base sources

Today only `TopologyRunnerMixin` owns a registry, via a lazy `progress`
property (`topology_runner.py:122-130`). Extract that ~6-line lazy property into
a tiny shared mixin so non-topology sources reuse it verbatim:

```python
class ProgressTrackingMixin:
    @property
    def progress(self) -> ProgressRegistry:
        registry = self.__dict__.get("_progress_registry")
        if registry is None:
            registry = ProgressRegistry()
            self.__dict__["_progress_registry"] = registry
        return registry
```

- `TopologyRunnerMixin` inherits it (behaviour unchanged — same `__dict__` key,
  so `_progress_reporter()`'s `getattr(step, "_progress_registry")` scan keeps
  working).
- `QueryParserSource` (base of both `UsageSource` and `LineageSource`) inherits
  it, so usage/lineage sources now expose `_progress_registry` and the existing
  reporter picks them up with **no workflow/base-workflow change**.

### (2) `ProgressRegistry` — start the clock on first counter activity

`elapsed_seconds()` keys off `_started_at`, set lazily on the first `open()`
(`progress_registry.py:95`). These workflows never call `open()` (no tree), so
the clock would never start and ETA would always be `None`. Fix: also set
`_started_at` (if unset) at the start of the first **counter** mutation —
`set_total`, `seed_scope_total`, and `track`. `time.monotonic()` as today.

No other registry change: `set_total` / `set_reconcilable` /
`reconcile_scope_total` / `track` / `global_counters` / `elapsed_seconds` /
`eta_seconds` (driver = last-declared counter with a known total) all already do
what these paths need.

### (3) `ProgressReporter` — suppress the empty `Ingested:` line

In `progress_render._header`, render the `Ingested: {n} assets` line only when
`assets_ingested() > 0`. Header with counters but zero assets (usage/lineage)
then shows just the counter line(s). Metadata unchanged.

### (4) Base source call sites

**Seeding a reconcilable ceiling — use `seed_scope_total`, not `set_total`.**
The denominator must start at the ceiling and settle *to* the real `done`, so
the seed has to register a *scope estimate* that reconcile can delta against.
`set_total` records no estimate, so a later `reconcile_scope_total(t, s, done)`
would compute `total = ceiling + done` (it adds `n - previous` with
`previous = 0`). Seeding via `seed_scope_total(t, s, ceiling)` records
`estimate[s] = ceiling`, so `reconcile_scope_total(t, s, actual)` gives
`total = ceiling + actual − ceiling = actual` — exactly `N/N`. All seeding below
uses per-scope `seed_scope_total` + `reconcile_scope_total`.

**`UsageSource` (`usage_source.py`)** — declare + drive `Queries`, one scope
per day (so multi-day backfills reconcile progressively; daily runs are a single
scope):

- Before the day loop: for each day `d` in `range(max(1, (self.end -
  self.start).days))`, `self.progress.seed_scope_total("Queries", f"day-{d}",
  self.source_config.resultLimit)` — total starts at `resultLimit × days`.
- Per processed query in day `d` (as each `TableQuery` is built in
  `yield_table_queries` / drained in `_iter`): `self.progress.track("Queries")`
  — `done += 1`, drives a smooth ETA.
- When day `d`'s fetch is exhausted: `self.progress.reconcile_scope_total(
  "Queries", f"day-{d}", <rows_fetched_that_day>)` — tightens the denominator to
  that day's real count. After the last day the counter reads `N/N`.

**`LineageSource` (`lineage_source.py`)** — legacy QUERY_HISTORY path only,
single `"run"` scope:

- In `yield_query_lineage` (base/legacy): `seed_scope_total("Queries", "run",
  self.source_config.resultLimit)`, `track("Queries")` per consumed
  `TableQuery`, then `reconcile_scope_total("Queries", "run", <done>)` once the
  producer is exhausted. Placed so it runs on the base path and is **skipped**
  when a subclass routes to an ACCESS_HISTORY override.

### (5) Snowflake specifics (thin — mostly inheritance)

- **Usage / legacy lineage:** nothing Snowflake-specific — inherited from the
  bases above.
- **ACCESS_HISTORY lineage** (`snowflake/lineage.py`, the Snowflake-only
  default path): once, before emitting (e.g. at the top of
  `_yield_access_history_lineage`), `self.progress.set_total("LineageRecords",
  None)` to **declare** the counter — `track` is a no-op for an undeclared type,
  so the counter must exist first. Then in `_yield_combined_access_history` and
  `_yield_copy_history_lineage`, `self.progress.track("LineageRecords")` per
  emitted `AddLineageRequest`. `total=None` → renders as a climbing count, no
  ETA. (The counter calls sit next to the existing `emitted += 1` accounting.)

### (6) SSE / schema — no change

`globalCounters` (array of `{entityType, done, total}`) and
`estimatedSecondsRemaining` already exist on `ProgressUpdate`
(`progressUpdate.json`). `send_progress_update` already maps
`reporter.global_counters()` and `reporter.eta_seconds()`. The `Queries` /
`LineageRecords` counters and the ETA flow through unchanged — **no schema
change, no `make generate`.**

## Data flow

Report timer (`base.py:_report_ingestion_status`, every 10s) →
`_progress_reporter()` finds the usage/lineage source's `_progress_registry` →
`reporter.cli()` logs the header; `send_progress_update()` sends
`global_counters()` + `eta_seconds()` over SSE. The source drives the registry
inline from its `_iter`/producer loops. All registry ops are lock-guarded.

## Error handling / edge cases

- **`days == 0`** (sub-day window): clamp to `1` so the usage ceiling is never
  `0`. Reconcile settles it to the real count anyway.
- **Actual < ceiling** (fewer queries than `resultLimit × days`): reconcile at
  end nudges `total` down to `done` → ends at `N/N`, not `N/5000`.
- **Actual > ceiling** (should not happen — `resultLimit` is a hard per-day
  cap): `track`'s existing clamp raises `total` to `done` defensively.
- **ACCESS_HISTORY with zero edges:** `LineageRecords 0` — honest; no crash, no
  fake denominator.
- **Per-entity failures** stay warn-and-continue (project convention); a skipped
  query/edge simply isn't `track`ed.
- **Threading:** lineage's legacy path processes chunks on worker threads
  (`generate_lineage_with_processes`, multiprocessing disabled → same-process
  threads); the registry lock already guards concurrent `track`.

## Extensibility

The registry/reporter/SSE layers are untouched and connector-agnostic. The base
sources drive the counters off values every SQL connector already has
(`self.start`/`self.end`, `resultLimit`, the query producer). BigQuery,
Redshift, Databricks, etc. inherit usage/legacy-lineage progress automatically.
A connector with a bespoke default lineage path (like Snowflake's
ACCESS_HISTORY) adds one `track(<label>)` call at its emit site — the only
per-connector code.

## Testing (TDD, pytest)

- **Registry:** `elapsed_seconds()` becomes non-`None` after the first
  `set_total`/`track` (no `open()` needed); `eta_seconds()` uses the `Queries`
  driver; reconcile-down settles `total` to `done`.
- **Reporter:** header renders counter lines with **no** `Ingested:` line when
  `assets_ingested() == 0`; still renders it for metadata (assets > 0);
  totalless counter renders `LineageRecords 8210` (no `/`, no ETA).
- **`ProgressTrackingMixin`:** a fresh source instance lazily creates one
  registry; `_progress_reporter()` discovers it via the `_progress_registry`
  attribute.
- **`UsageSource`:** driving N queries over D days seeds
  `total = resultLimit × D`, ends with `done == N` and reconciled `total == N`.
- **`LineageSource` legacy:** `Queries` declared with `total = resultLimit`;
  ACCESS_HISTORY override path declares **no** `Queries` counter.
- **Snowflake ACCESS_HISTORY:** emitting K edges yields `LineageRecords K`,
  `total is None`, `eta_seconds() is None`.
- Assert on rendered/registry state (outcomes), not call wiring.

## Deploy note

No schema change → no coordinated server rebuild required for this feature (the
`globalCounters` / `estimatedSecondsRemaining` fields it rides on already
shipped on this branch).
