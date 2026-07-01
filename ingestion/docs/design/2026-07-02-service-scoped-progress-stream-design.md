# Service-Scoped Progress Stream — Design

*OpenMetadata backend (Java service + schema) + UI · 2026-07-02 · builds on the per-run progress SSE (`IngestionProgressTracker`, `ProgressSseManager`, `progressUpdate.json`) shipped on branch `manila`*

## Problem

Progress is streamed today with **one SSE connection per pipeline run**: the UI opens `GET /v1/services/ingestionPipelines/progress/{fqn}/stream/{runId}`, and the Java `IngestionProgressTracker` keys all state and listeners by `pipelineFqn/runId`.

The target UI is a per-**service** "Agents" page (see the `banking-redshift` mockup) showing every agent for a service at once — metadata, lineage, usage, profiler, autoclassification. With per-run streams that page must open **N concurrent SSE connections**, one per live agent. Browsers cap ~6 concurrent HTTP/1.1 connections per host, so a handful of live agents plus normal app traffic saturates the limit. This does not scale for the UI.

## Goal

1. **Collapse N per-run connections into one per-service connection.** A new endpoint `GET /v1/services/ingestionPipelines/progress/service/{serviceFqn}/stream` multiplexes progress for every live run of every pipeline under that service onto a single SSE stream.
2. **Route events client-side by pipeline.** Each event carries which pipeline/run it belongs to, so the UI can dispatch it to the right agent row.
3. **Keep the change small and additive.** The Python ingestion side is untouched; it keeps pushing bare `ProgressUpdate`s via the existing `PUT /progress/{fqn}/{runId}`. Profiler and autoclassification progress (Python counter work still pending) flow into the service stream automatically once they push through that same path — the multiplex is agnostic to agent type.

## Non-goals

- **No per-user/session stream.** A single connection per browser that subscribes/unsubscribes to services (and a fleet/overview page spanning many services) is explicitly deferred. The service→runs index built here is the seam a future session-level fan-in would build on, but it is not built now.
- **No service-level "total ingested" aggregate.** A service-wide/lifetime asset total is deferred. When built, it belongs in the **durable** layer (computed from persisted `pipelineStatus` run records), never derived from the ephemeral stream — deriving it from the stream would reset on every page reload.
- **No sticky completed-run replay on the stream.** Option A (below): the live progress tree is ephemeral. A client connecting *after* a run finished sees that agent's final state from the durable `pipelineStatus` REST data, not from the stream.
- **No change to the per-run endpoint.** It is retained for back-compat and shares the same underlying tracker state.

## Key distinction: ephemeral stream vs. durable totals

Two things are easy to conflate; the design keeps them separate:

- **Live progress tree** (moving bars, ETA, per-schema breakdown, the "Ingested N" line) — *ephemeral*, in-memory only while a run is in flight (`ProgressRegistry` in Python, `IngestionProgressTracker.ProgressState` in Java). Dropped on terminal.
- **Total ingested assets / records processed** — *durable*, already persisted per run in `pipelineStatus` (`status.json`: `stepSummary.records` plus the per-entity-type `progress` map). Written at run completion; this is what the UI's "Recently run" table and idle-agent counts read over normal REST.

Consequence: dropping a run's live tree on terminal loses nothing durable. The stream is a live overlay; totals live in the run status.

## Design

### Piece 1 — Envelope schema

New schema `openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/serviceProgressEvent.json`:

```jsonc
{
  "title": "ServiceProgressEvent",
  "description": "One pipeline's progress update multiplexed onto a service-scoped SSE stream.",
  "type": "object",
  "properties": {
    "pipelineFqn": { "type": "string", "description": "FQN of the pipeline this event belongs to" },
    "runId":       { "type": "string", "description": "Pipeline run ID" },
    "event":       { "$ref": "progressUpdate.json" }
  },
  "required": ["pipelineFqn", "runId", "event"],
  "additionalProperties": false
}
```

The per-run stream keeps sending bare `ProgressUpdate` (identity is in its URL). The service stream sends `ServiceProgressEvent` so the client can route by `pipelineFqn`. `agentType` is **not** in the envelope — the UI derives it from the `IngestionPipeline` entity by `pipelineFqn`. A wrapper is chosen over adding `pipelineFqn` to `ProgressUpdate` so the per-run payload stays lean and no shared object is mutated at send time.

### Piece 2 — `IngestionProgressTracker` changes

All new state is guarded by the existing locking model. Added:

- `Map<String /*serviceFqn*/, Set<String /*runKey = fqn/runId*/>> serviceActiveRuns` — live runs per service.
- `Map<String /*serviceFqn*/, List<Consumer<ServiceProgressEvent>>> serviceListeners`.
- A **bounded** `Cache<String /*pipelineFqn*/, String /*serviceFqn*/>` (Guava `CacheBuilder.newBuilder().maximumSize(1000).expireAfterAccess(1, TimeUnit.HOURS).build()`, matching the tracker's existing cache sizing and the project's bounded-cache rule) resolving service from the pipeline's `service` `EntityReference` — **not** by string-splitting the FQN.

Behavior changes:

- `updateProgress(fqn, runId, update)` — after the existing per-run state update and per-run listener notify: resolve `serviceFqn` (cache), add `runKey` to `serviceActiveRuns[serviceFqn]`, and notify `serviceListeners[serviceFqn]` with a `ServiceProgressEvent`. When the update is **terminal** (`PIPELINE_COMPLETE` or `ERROR`, matching `isTerminalProgressUpdate`), forward the terminal event to service listeners **then** remove `runKey` from the active set. Per-run `ProgressState` still lingers under the existing 1h `expireAfterAccess` TTL.
- New: `registerServiceListener(serviceFqn, listener)` / `unregisterServiceListener(serviceFqn, listener)`, mirroring the per-run registration (including the `activeProgressStreams` gauge).
- New: `getActiveRunSnapshots(serviceFqn)` → for each live `runKey`, its latest `ProgressUpdate` wrapped as a `ServiceProgressEvent`, for at-connect replay.

Empty-collection cleanup and gauge bookkeeping mirror the existing per-run `unregisterProgressListener`.

### Piece 3 — Repository + endpoint

`IngestionPipelineRepository.streamServiceProgress(serviceFqn, eventSink, sse)`, parallel to `streamProgress` but with two differences:

1. **At-connect replay:** iterate `getActiveRunSnapshots(serviceFqn)` and send each wrapped event, so the page paints immediately. No active runs → the stream opens empty (idle agents render from entity REST).
2. **A single run's terminal event does NOT close the sink.** The service stream stays open for the whole page session; a terminal event only drops that one run from the active set (handled in the tracker). The sink closes only on client disconnect / heartbeat failure / the `ProgressSseManager` cap — reusing the existing manager unchanged.

Endpoint on `IngestionPipelineResource`:

```
GET /v1/services/ingestionPipelines/progress/service/{serviceFqn}/stream
Produces: text/event-stream
```

- **Auth: service-level.** Authorize `VIEW_ALL` against the target **service** resource context derived from `serviceFqn` (stricter and more correct than the generic pipeline-type check the per-run endpoint uses).
- Returns 503 when `repository.isProgressTrackingEnabled()` is false, matching the per-run endpoint.

### Piece 4 — At-connect replay + lifecycle

- **Connect:** send one `ServiceProgressEvent` per active run (latest snapshot), then stream deltas.
- **Run terminal:** terminal envelope emitted once (UI animates that agent to done), run removed from the active set. Stream stays open.
- **Client disconnect / heartbeat failure:** `ProgressSseManager` cleans up and runs the `onClose` that unregisters the service listener.
- **No active runs at connect:** stream opens empty; the page shows idle agents from `IngestionPipeline` entity REST.

### Piece 5 — UI consumption (design-level; built later)

One `EventSource` per service page. Route each `ServiceProgressEvent` by `pipelineFqn` to its agent row. Idle agents render from `IngestionPipeline` entities; on a terminal event, the agent flips to its persisted last-run state from `pipelineStatus` REST. Building the actual React view is out of scope for this spec.

## Back-compat

The per-run endpoint and its `streamProgress` path are retained unchanged. Both stream shapes read the same underlying tracker state; the only added cost on the hot `updateProgress` path is one cache lookup + one service-listener notify per update (~every 10s per run).

## Testing

- **Tracker unit tests (JUnit):**
  - Two runs of two pipelines under the same service both land in `serviceActiveRuns[serviceFqn]` and both notify a single service listener.
  - A terminal update forwards the terminal event **and** removes only that run from the active set; the sibling run remains.
  - `getActiveRunSnapshots` returns the latest snapshot per active run.
  - The `pipelineFqn → serviceFqn` cache is bounded (eviction past `maximumSize`) and resolves via the pipeline's `service` reference.
  - A second service's updates do **not** notify the first service's listeners (isolation).
- **Integration test (`openmetadata-integration-tests`):** open the service stream, push progress for two pipelines of one service, assert both multiplex onto the one stream with correct `pipelineFqn` routing, and that a second service's events never leak in.

## Open items / future seams

- Per-user/session multiplex (subscribe/unsubscribe across services) — deferred; builds on `serviceActiveRuns`.
- Service-level durable "total ingested" aggregate — deferred to the `pipelineStatus`-backed durable layer.
- Profiler & autoclassification Python progress counters — separate pending work; they require no change here, only that they push through `PUT /progress/{fqn}/{runId}`.
