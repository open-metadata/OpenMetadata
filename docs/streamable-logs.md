# Streamable Ingestion Logs

This document describes the end-to-end design of OpenMetadata's streamable ingestion-pipeline log system: how logs flow from a running connector to durable S3 storage, how the UI reads them while a run is in progress, and how the system handles long idle gaps, restarts, and abandoned runs.

## Overview

Ingestion pipelines (metadata, profiler, lineage, usage, dbt, etc.) emit logs as they run. Operators need to:

- Watch logs **live** while a pipeline is running, including for long-running connectors that can take hours.
- Read logs **after the run ends**, with a single canonical artifact per run.
- Recover gracefully from server restarts, network blips, and connector idle gaps.

OpenMetadata addresses this with a server-side log storage abstraction backed by S3 (or any S3-compatible store like MinIO). The connector pushes log batches over HTTP; the server persists them and serves both live and post-run reads.

## Architecture

```
┌──────────────────────┐
│ Python ingestion     │  POST /logs/{fqn}/{runId}        (append)
│ connector            │  POST /logs/{fqn}/{runId}/close  (finalize)
│ (logs_mixin.py)      │
└──────────┬───────────┘
           │ HTTP
           ▼
┌──────────────────────┐
│ OpenMetadata server  │
│ IngestionPipeline    │
│ Resource             │
└──────────┬───────────┘
           │ LogStorageInterface
           ▼
┌──────────────────────┐         ┌──────────────────────┐
│ S3LogStorage         │────────▶│ S3 / MinIO bucket    │
│ (streaming, in-mem   │         │  partial.txt         │
│  buffers, sweeper)   │         │  logs.txt            │
└──────────┬───────────┘         └──────────────────────┘
           │ SSE / GET (paginated / download)
           ▼
┌──────────────────────┐
│ OpenMetadata UI      │
│ (live tail + history)│
└──────────────────────┘
```

The `LogStorageInterface` abstraction supports multiple backends:

| Backend | Purpose |
|---------|---------|
| `S3LogStorage` | Production: stores logs durably in S3 / MinIO. The focus of this document. |
| `DefaultLogStorage` | Backward-compat: delegates to the pipeline service client (Airflow / Argo). No first-class storage. |

This document covers the `S3LogStorage` implementation.

## Storage Layout

Each pipeline run is identified by a `(fqn, runId)` tuple. On S3 the layout is:

```
{bucket}/{prefix}/                          # prefix defaults to "pipeline-logs"
  {sanitizedFQN}/{runId}/
    partial.txt                             # readable view during the run
    logs.txt                                # final artifact, materialized at /close
  .active/{sanitizedFQN}/{runId}/{serverId} # heartbeat marker
```

**`partial.txt`** is the durable, readable view of an in-progress run. It is updated periodically as the connector appends batches. It carries durable offset state in S3 user-defined metadata:

| Metadata key | Purpose |
|--------------|---------|
| `x-amz-meta-last-flushed-line` | Logical line counter at the moment of this PUT. Drives retry idempotency and post-restart recovery. |
| `x-amz-meta-total-bytes` | Cross-check on body size; helps detect drift. |
| `x-amz-meta-writer-epoch` | Bumped each time a fresh OM-server instance picks up the stream after a restart. |
| `x-amz-meta-writer-version` | Identifies the writer code version. Useful during migration windows. |

**`logs.txt`** is the canonical post-run artifact. It is created **only** at `/close` (or by the abandoned-run sweeper), as a server-side S3 copy of the final `partial.txt`. Content matches `partial.txt` exactly at the moment of close.

**`.active/...`** markers are dropped as a side effect of `appendLogs`. They have no functional role in correctness; they are operational hints for diagnostics ("which OM-server instance most recently saw this run").

A bucket lifecycle policy ensures cleanup:
- `expirationDays` (default 30) on the `pipeline-logs/` prefix expires all logs after the retention window.

## Run Lifecycle

### 1. Connector emits a batch

The Python ingestion runner buffers log lines and POSTs batches to the server:

```
POST /api/v1/services/ingestionPipelines/logs/{fqn}/{runId}
Content-Type: application/json

"<raw log content>"          OR

{
  "logs": "<base64-gzipped log content>",
  "connectorId": "...",
  "compressed": true
}
```

`IngestionPipelineResource.writePipelineLogs` decodes the body and calls `repository.appendLogs(fqn, runId, content)`, which delegates to `S3LogStorage.appendLogs`.

### 2. Server-side append

`S3LogStorage.appendLogs` does five things, all in memory, all under a per-stream `ReentrantLock`:

1. **Increments `totalLinesAppended`**, the monotonic logical line counter that anchors retry idempotency.
2. **Appends to `SimpleLogBuffer`** (in-memory ring, capacity 1000 lines). This is the source for the SSE/WebSocket live-tail UI experience. It is bounded; oldest lines evict on overflow. It is **not** load-bearing for durability.
3. **Appends to `pendingFlush`** (in-memory queue, no fixed cap, byte-tracked). This is the durable-pending-write queue and survives until the next successful PUT.
4. **Notifies SSE listeners**, fanning out the new lines to any open live-tail HTTP connections.
5. **Schedules an early flush** if `pendingFlush` exceeds `earlyFlushWatermarkBytes` (default 5 MB). This protects against memory bloat under bursty writes.

A single-threaded `cleanupExecutor` schedules the periodic flush, the abandoned-run sweeper, and metrics updates.

### 3. Periodic flush to `partial.txt`

Every `partialFlushIntervalMinutes` (default 2) and on demand from the early-flush watermark, `writePartialLogsForStream` runs under the per-stream lock:

1. Snapshot `pendingFlush` and clear it.
2. If empty, no-op (idle streams cost nothing).
3. `GetObject partial.txt` → reads `Content-Length` and metadata from the response headers. On 404, treat as empty.
4. Build new metadata (`last-flushed-line`, `total-bytes`, `writer-epoch`, `writer-version`).
5. **If existing body < 5 MB** — read the body, build merged body = existing + `\n`-joined snapshot, `PutObject` atomically.
6. **If existing body ≥ 5 MB** — abort the body stream and concatenate server-side via Multipart Upload: `CreateMultipartUpload`, `UploadPartCopy` (existing body as part 1), `UploadPart` (new content as part 2, the last part has no 5 MB minimum), `CompleteMultipartUpload`. The merged body never enters JVM heap and is not re-uploaded.
7. On failure, abort any in-flight multipart upload, re-merge the snapshot to the head of `pendingFlush`, and try again next tick. No data loss.

Because `pendingFlush` is unbounded by the `SimpleLogBuffer` cap, no line is ever evicted before being flushed.

### 4. Live read while running

The UI's "live logs" view does two things in parallel:

- **HTTP GET** `/logs/{fqn}/{runId}?after={cursor}` for paginated history. The server reads `partial.txt` from S3 and concatenates the in-memory `pendingFlush` snapshot for the most-recent-tail bytes that haven't yet been flushed. The cursor is a line offset.
- **Server-Sent Events (SSE)** for live tail. The endpoint registers a `LogStreamListener` against the stream key and pushes new lines as `notifyListeners` fires from each `appendLogs`.

This gives the user "everything written so far" via GET and "everything written in real time from now on" via SSE.

### 5. `/close` finalization

When the connector terminates (success, graceful failure, or graceful abort), it calls:

```
POST /api/v1/services/ingestionPipelines/logs/{fqn}/{runId}/close
```

`S3LogStorage.closeStream` runs under the per-stream lock:

1. **Final flush**: drain remaining `pendingFlush` to `partial.txt` (same path as the periodic flush).
2. **Server-side copy** `partial.txt` → `logs.txt`. Bytes do not transit through OM. Cheap and constant-time regardless of log size.
3. **Delete `partial.txt`**.
4. **Best-effort delete** the `.active/{fqn}/{runId}/{serverId}` marker.
5. Drop in-memory state for the stream (`activeStreams`, `pendingFlush`, `totalLinesAppended`, `recentLogsCache`, the per-stream lock).

`/close` is idempotent. A second call finds no `partial.txt` and no in-memory state; it is a graceful no-op. A `/close` that arrives after the abandoned-run sweeper already finalized the stream behaves the same way.

### 6. Post-`/close` reads

Once `/close` completes, `logs.txt` is the canonical artifact. `getLogs(fqn, runId)` reads it directly. Pagination is by line offset; the response includes `after` (next cursor) and `total` (total bytes / lines).

There is also a download endpoint that streams the full file (or composes from segments / partial in legacy fallbacks).

## Read Paths

| Endpoint | Pre-`/close` | Post-`/close` |
|----------|-------------|---------------|
| `GET /logs/{fqn}/{runId}` | Reads `partial.txt` + appends `pendingFlush` snapshot. Apply cursor pagination. | Reads `logs.txt`. |
| `GET /logs/{fqn}/{runId}/download` | Streams `partial.txt`. | Streams `logs.txt`. |
| `GET /logs/{fqn}/stream/{runId}` (SSE) | Registers a listener; replays last 100 buffered lines, then live-streams new lines. | (Not used post-close; the run is over.) |

Legacy `partial.txt` files written by older code (without S3 metadata) read normally; the new flush logic treats them as "no prior offset" and merges any new content correctly.

## Abandoned-Run Recovery

Connectors can die without calling `/close` — process killed, OOM, network partition, infrastructure failure. To bound resource use and still produce a final `logs.txt`, a sweeper runs periodically:

- **Schedule**: every `cleanupIntervalMinutes` (default 60).
- **Threshold**: `streamTimeoutMinutes` since last `appendLogs` (default 1440 = 24h).

For each expired stream, the sweeper does the same finalization steps as `/close` (final flush, copy to `logs.txt`, delete `partial.txt`, drop in-memory state). The end result is identical: an abandoned run produces a finalized `logs.txt` artifact that the UI can read, just delayed.

The 24h default is intentionally lenient: typical idle gaps in slow connectors (waiting on source queries, batch boundaries, queues) are minutes-to-hours, not days. Operators can tune the threshold downward in deployments where memory pressure from many parallel runs requires more aggressive reclamation.

## Failure Modes & Recovery

| Failure | Recovery |
|---------|----------|
| S3 PUT fails during periodic flush | `pendingFlush` snapshot is restored under the lock. Next tick retries. No data loss. |
| OM-server restart mid-run | All in-memory state lost. `partial.txt` on S3 retains all previously-flushed content. The next `appendLogs` re-creates state; the first flush after restart reads `partial.txt` (with metadata) and resumes from `last-flushed-line`. Worst-case loss: lines that were in `pendingFlush` at restart time, bounded above by `partialFlushIntervalMinutes`. |
| Connector dies without `/close` | Abandoned-run sweeper finalizes the run after `streamTimeoutHours`. `logs.txt` is materialized from the most recent `partial.txt`. |
| `/close` retries after partial success | All steps are idempotent. Second call finds no `partial.txt` and no in-memory state; no-op. |
| Concurrent `appendLogs` and cleanup | The per-stream lock serializes them. Cleanup finds the stream "fresh" again and skips it next tick. |
| Bucket lifecycle expires `partial.txt` mid-run | Should not happen at default `expirationDays = 30`. If misconfigured (very low retention), the next flush would treat it as a fresh `partial.txt` and start over. Recommended floor: 7 days. |

## Configuration

All settings live under `LogStorageConfiguration` in `openmetadata.yaml`:

| Field | Default | Description |
|-------|---------|-------------|
| `bucketName` | (required) | S3 bucket for log storage. |
| `prefix` | `pipeline-logs` | Key prefix within the bucket. |
| `enableServerSideEncryption` | `true` | Apply SSE on every PUT. |
| `sseAlgorithm` | `AES_256` | Or `AWS_KMS` (requires `kmsKeyId`). |
| `storageClass` | `STANDARD_IA` | S3 storage class for log objects. |
| `expirationDays` | 30 | Bucket lifecycle: expire all logs after this many days. |
| `streamTimeoutMinutes` | 1440 | Idle threshold (in minutes) before the abandoned-run sweeper finalizes a stream. |
| `cleanupIntervalMinutes` | 60 | How often the sweeper wakes up to check for abandoned streams. |
| `partialFlushIntervalMinutes` | 2 | Periodic `pendingFlush` → `partial.txt` cadence. |
| `earlyFlushWatermarkBytes` | 5242880 (5 MB) | Triggers an out-of-band flush when `pendingFlush` exceeds this size. |
| `pendingFlushAlertAfterFailures` | 10 | Emit an alerting metric after this many consecutive failed flushes for a stream. |
| `maxConcurrentStreams` | 100 | Bound on in-flight pipeline runs per OM-server instance. |
| `awsConfig.*` | — | AWS credentials / region / endpoint (also supports IAM role + custom endpoints for MinIO). |

## Concurrency Model

Coordination is a per-stream lock keyed by `streamKey = fqn + "/" + runId`. The lock is held for the duration of `appendLogs`, periodic flush, abandoned-run cleanup, and `/close`. Locks are backed by a Guava `Striped<Lock>` with a fixed stripe count, so memory does not grow with completed-run accumulation; the same key always maps to the same lock instance, eliminating the acquire-vs-remove race that a per-key map would have. False contention across stripes is bounded by `maxConcurrentStreams << stripe count`.

A single-threaded `ScheduledExecutorService` (`cleanupExecutor`) drives:
- Periodic flushes (`writePartialLogs`)
- Abandoned-run sweeper (`cleanupAbandonedStreams`)
- Metrics updates (`updateStreamMetrics`)
- One-shot early flushes scheduled by the watermark trigger

Under sustained burst load, scheduled tasks queue on this single thread. This is intentional: it bounds resource use and avoids unbounded thread creation under spikes. If a deployment regularly sees queue backlog, the watermark or flush interval can be tuned.

## Observability

Key metrics exposed by `StreamableLogsMetrics`:

- `om_streamable_logs_log_shipment_*` — distribution of append latencies.
- `om_streamable_logs_logs_sent` / `logs_failed` — counter of successful and failed appends.
- `om_streamable_logs_batch_size` — distribution of lines per batch.
- `om_streamable_logs_s3_*` — distribution of S3 read/write latencies and counters of S3 errors.
- `om_streamable_logs_pending_part_uploads` — gauge for monitoring queue backlog (legacy, will be retired with multipart removal).
- `om_streamable_logs_multipart_uploads` — gauge for active multipart uploads (legacy, will be retired).
- `om_streamable_logs_pending_flush_bytes` — gauge for in-memory `pendingFlush` size per stream (new).
- `om_streamable_logs_consecutive_flush_failures` — gauge per stream (new).

Recommended alerts:
- `pending_flush_bytes` > 50 MB sustained → memory pressure or persistent S3 failures.
- `consecutive_flush_failures` ≥ 10 → S3 connectivity or auth issue.
- `s3_errors` rate > 1/min → S3 health degradation.

## Multi-Server Topology

The design assumes single-writer-per-run: an ALB / load balancer enforces sticky sessions for `(fqn, runId)` via the `PIPELINE_SESSION` cookie set on the first `appendLogs` response. All subsequent requests for the same run land on the same OM-server instance for the lifetime of the run.

If stickiness is broken (cookie stripped by a proxy, multi-cluster routing without coordination), two OM-server instances could write to the same `partial.txt` and clobber each other. This is **out of scope** for the current design. A future iteration could move offset state to the database for cross-server coordination.

## References

- Source files:
  - `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
  - `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/LogStorageFactory.java`
  - `openmetadata-spec/src/main/java/org/openmetadata/service/logstorage/LogStorageInterface.java`
  - `openmetadata-service/src/main/java/org/openmetadata/service/resources/services/ingestionpipelines/IngestionPipelineResource.java`
  - `ingestion/src/metadata/utils/streamable_logger.py`
  - `ingestion/src/metadata/ingestion/ometa/mixins/logs_mixin.py`
- Related PRs: #23590, #24198, #24287, #24410
