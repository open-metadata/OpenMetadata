# Ingestion Progress ETA — Design

**Date:** 2026-07-01
**Branch:** `manila`
**Status:** Approved, pending implementation plan

## Problem

The ingestion progress header now renders global counters (`Database 2/4`,
`DatabaseSchema 12/45`, PowerBI `Workspace 300/420`) plus a monotonic
`Ingested: N assets` line. It tells the user *how much* is done but not *how
much longer* the run will take. Users want an ETA — an estimate of the time
remaining until the run completes.

## Goals

- A single overall run ETA, shown in the CLI progress header and streamed over
  SSE to the UI.
- Connector-agnostic: works for any connector that declares a global counter
  with a known total (Snowflake, PowerBI, and future adopters) with **no
  connector-specific code**.
- Honest: show an ETA only when a real number can be computed; never a
  misleading "calculating forever".

## Non-Goals

- No windowed / EWMA rate (cumulative average only).
- No per-counter ETAs (one overall number).
- No UI rendering work — this covers the ingestion → server contract (CLI +
  JSON schema) only. Formatting the streamed number in the OpenMetadata
  frontend is a separate task.
- No new connector adoption. ETA is derived purely from the global counters
  connectors already declare.

## Design

### Driver counter

The ETA is driven by the **last-declared global counter that has a known
total**. `global_counters()` returns counters in declaration (insertion) order:

- Snowflake declares `Database` then `DatabaseSchema` → driver is
  `DatabaseSchema` (the finest-grained real unit of work).
- PowerBI declares only `Workspace` → driver is `Workspace`.
- A connector that declares no counter with a total (e.g. Postgres/MySQL today,
  which only get running counts) has **no driver** → no ETA.

### Formula

Cumulative average over elapsed processing time:

```
eta_seconds = elapsed * (total - done) / done
```

`eta_seconds()` returns `None` (→ suppressed in every surface) when:

- `done == 0` — warm-up, nothing completed yet to divide by.
- No counter has a total — no driver.
- `done >= total` — effectively complete.
- `elapsed` is unavailable or non-positive.

The driver counts scopes (schemas/workspaces), which are not equal-sized, so
early ETAs are rough until enough scopes complete to average out. This is
inherent to any count-based ETA and acceptable for a `~6m` hint.

### Timing source

`ProgressRegistry` gains a monotonic start marker set lazily on the **first
`open()`** — i.e. when the topology walk actually starts processing a scope.
This deliberately excludes object construction and the upfront
`SHOW SCHEMAS` enumeration, so early ETAs are not inflated by setup time.

New registry API:

- `elapsed_seconds() -> Optional[float]` — `time.monotonic() - started_at`, or
  `None` before the first `open()`.

`time.monotonic()` (not wallclock) guarantees elapsed can never go negative on
a clock adjustment.

### Computation + rendering

- `ProgressReporter.eta_seconds() -> Optional[int]` — selects the driver counter
  from `global_counters()`, applies the formula against
  `registry.elapsed_seconds()`, returns rounded seconds or `None`.
- CLI header (`progress_render._header`): append a `~6m`-style suffix to the
  **driver counter's line only**; dropped when `eta_seconds()` is `None`:

  ```
  Database         2/4
  DatabaseSchema  12/45   ~6m
  Ingested: 1,204 assets
  ```

- `format_eta(seconds) -> str` helper: `~45s` / `~6m` / `~1h 20m`.

### SSE / schema

Add one top-level optional field to
`openmetadata-spec/.../ingestionPipelines/progressUpdate.json`:

```json
"estimatedSecondsRemaining": {
  "type": "integer",
  "description": "Estimated seconds until the run completes; null when not yet computable"
}
```

`make generate` regenerates the Python and Java models.
`workflow_status_mixin.send_progress_update()` sets the field from
`reporter.eta_seconds()` (omitted / null when `None`). The UI formats the raw
number itself.

## Testing (TDD, pytest)

- Registry: `elapsed_seconds()` is `None` before the first `open()`, positive
  after (monotonic clock patched).
- `eta_seconds()`:
  - warm-up (`done == 0`) → `None`
  - no counter with a total → `None`
  - complete (`done >= total`) → `None`
  - driver selection: with both `Database` and `DatabaseSchema` declared,
    asserts the ETA uses `DatabaseSchema` (last-declared with a total)
  - normal case: computes `elapsed * (total - done) / done` with a patched clock
- `format_eta`: boundaries (59s → `~59s`, 60s → `~1m`, 3600s → `~1h 0m`).
- CLI header: `~` suffix present on the driver line; absent when
  `eta_seconds()` is `None`.
- Mixin: maps `eta_seconds()` into `estimatedSecondsRemaining`; null when
  `None`.

## Deploy note

The new `estimatedSecondsRemaining` schema field requires `make generate` in a
clean env, and a server rebuilt from this branch's schema, for the field to
survive the ingestion → Java server → SSE path (same coordinated-deploy
constraint as the `globalCounters` feature).
