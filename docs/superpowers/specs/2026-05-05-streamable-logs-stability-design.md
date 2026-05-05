# Streamable Logs Stability — Design

**Date:** 2026-05-05
**Status:** Draft, awaiting implementation plan
**Component:** `openmetadata-service` — `S3LogStorage`, `IngestionPipelineResource`
**Related:** PRs #24198, #24287, #24410, #23590

## Problem

Long-running ingestion pipelines using S3-backed streamable logs lose data when there is an idle gap of >5 minutes between log batches. The same pattern shows up against both on-disk artifacts:

- `partial.txt` versions on S3 show drops from ~80MB to a few KB.
- `logs.txt` versions show successive overwrites, each one containing only the latest segment of the run.

Three root-cause bugs in `S3LogStorage.java` (current version):

1. **`partial.txt` clobber.** `cleanupExpiredStreams` (every 1 min, threshold 5 min idle) calls `partialLogOffsets.remove(streamKey)`. After resume, the next `writePartialLogsForStream` reads `currentOffset = partialLogOffsets.getOrDefault(streamKey, 0L)` → `0`, and the guard `if (currentOffset > 0)` skips the read-merge step. The PUT writes only the in-memory `SimpleLogBuffer` contents, overwriting the prior 80MB body.

2. **`logs.txt` clobber.** The same 5-min sweep calls `MultipartS3OutputStream.close()`, which fires `completeMultipartUpload` and materializes `logs.txt` v1. After resume, `appendLogs` creates a fresh `MultipartS3OutputStream` against the same key with a new `uploadId`. The next `completeMultipartUpload` (next sweep or `/close`) overwrites `logs.txt` with only the latest segment.

3. **`SimpleLogBuffer` overflow drift.** `partialLogOffsets` stores a list-index count, but `SimpleLogBuffer` is bounded at 1000 lines and drops the oldest on overflow. If more than `maxCapacity` lines are appended between flush ticks, `subList(currentOffset, allLines.size())` indexes into the post-eviction buffer and silently drops a contiguous chunk of lines.

## Constraints

- **Single-writer-per-run topology**: multiple OM-server instances behind a load balancer with `PIPELINE_SESSION` cookie reliably honored end-to-end. Same `(fqn, runId)` always lands on one node within a run.
- **Reliable `/close`**: Python ingestion framework reliably hits `POST /logs/{fqn}/{runId}/close` on success, failure, and abort. Server-side finalization is a safety net for hard crashes only.
- **Size-agnostic**: `logs.txt` size varies widely across deployments. The design must be cheap regardless of total log size.
- **Backward-compatible artifacts**: same on-disk file names and shapes (`partial.txt`, `logs.txt`), same API endpoints, no changes to the ingestion-side client.

## Design

### 1. Storage layout

Per `(fqn, runId)`, only the existing two artifacts:

```
{prefix}/{sanitizedFQN}/{runId}/
  partial.txt          (readable view during the run; carries offset state in S3 user-defined metadata)
  logs.txt             (final artifact; only after /close or 24h-abandonment cleanup)
```

`partial.txt` carries durable state in S3 user-defined metadata (atomic with each PUT, no sidecar file, no extra S3 requests):

| Metadata key | Purpose |
|--------------|---------|
| `x-amz-meta-last-flushed-line` | Logical line counter at the moment of this PUT. Used for retry idempotency and post-restart `totalLinesAppended` recovery. |
| `x-amz-meta-total-bytes` | Cross-check on `partial.txt` body size; helps detect drift. |
| `x-amz-meta-writer-epoch` | Incremented on each fresh OM-server start that picks up this stream. Useful for debugging. |
| `x-amz-meta-writer-version` | Identifies the writer code version (e.g., `streamable-logs-v2`). Useful during migration windows. |

Metadata payload is well under the 2KB S3 limit per object.

### 2. Write path

#### Concurrency model

Coordination is a per-stream `ReentrantLock` keyed by `streamKey = fqn + "/" + runId`, held for the duration of `appendLogs`, `writePartialLogsForStream`, the cleanup-driven finalization in Section 3, and the `/close` flow in Section 4. The lock ensures `pendingFlush` snapshot-and-clear is atomic with the corresponding S3 PUT and that retries see consistent state. Locks live in a `ConcurrentHashMap<String, ReentrantLock>` and are removed when the stream is dropped.

The existing single-threaded `cleanupExecutor` continues to drive periodic flushes, the cleanup sweeper, and metrics updates. Early-flush triggers (Section 2's watermark) submit one-shot tasks to the same executor; under sustained burst load this can introduce queueing latency, but it bounds resource use and avoids a separate thread pool.

#### Per-stream in-memory state

Three pieces with cleaner separation than today:

| Field | Purpose | Bound |
|-------|---------|-------|
| `SimpleLogBuffer` (tail cache) | Recent lines for SSE/WebSocket live tail. NOT load-bearing for durability. | 1000 lines (unchanged) |
| `pendingFlush` (NEW) | Lines appended since the last successful `partial.txt` PUT. Drains on flush. | Watermark-bounded |
| `totalLinesAppended` (NEW) | Monotonic logical line counter. Never decrements. Source of truth for offsets. | `long` |

#### `appendLogs(fqn, runId, batch)`

Under the per-stream lock:

1. Increment `totalLinesAppended` by the number of lines in `batch`.
2. Append to `SimpleLogBuffer` (existing eviction stays — it is now only a tail cache).
3. Append to `pendingFlush` (no fixed cap; bytes-tracked).
4. Notify SSE listeners.
5. If `pendingFlush.bytes > earlyFlushWatermark` (default 5 MB), schedule an out-of-band flush via the existing scheduled executor.

The `MultipartS3OutputStream` write path is **removed entirely**. It is the source of bug 2 above and adds no value once `/close` produces `logs.txt` by copying `partial.txt` (Section 4).

#### Periodic flush — `writePartialLogsForStream(streamKey)`

Runs every `partialFlushIntervalMinutes` (default 2 min) and on-demand when triggered by the early-flush watermark.

Under the per-stream lock:

1. Snapshot `pendingFlush` contents and clear it.
2. If empty, no-op (idle streams are free).
3. `GetObject partial.txt` (always — no `if (currentOffset > 0)` guard). Capture body and metadata. On `NoSuchKeyException`, treat as empty body with no prior metadata.
4. New body = existing body + `\n`-joined snapshot.
5. New metadata:
   - `last-flushed-line` = `totalLinesAppended`
   - `total-bytes` = new body length in bytes
   - `writer-epoch` = current epoch (this OM-server instance's session counter)
   - `writer-version` = code version constant
6. `PutObject partial.txt` with body and metadata atomically.
7. On success, the snapshot is durably persisted; nothing further to do.
8. On `PutObject` failure: re-merge the snapshot back to the head of `pendingFlush` (under the lock) and surface a metric. The next flush tick retries.

#### Restart recovery

On the first `appendLogs` for `(fqn, runId)` after a fresh OM-server start, in-memory state is empty (`pendingFlush = []`, `totalLinesAppended = 0`).

The first flush after restart performs:

- `GetObject partial.txt` → returns prior body and metadata.
- If metadata's `last-flushed-line` is present, set `totalLinesAppended = max(totalLinesAppended, last-flushed-line + snapshot.size)` so the counter is monotonic across restarts.
- Bump `writer-epoch`.
- Merge snapshot, PUT.

Worst-case data loss on restart: the lines that were in `pendingFlush` at the moment of restart but never flushed — bounded above by `partialFlushIntervalMinutes` worth of recent appends (or less, due to the early-flush watermark). Pre-restart durably-flushed content is fully preserved.

#### Buffer overflow

With `pendingFlush` watermark-bounded and the early-flush trigger, eviction-driven line loss is structurally impossible: `pendingFlush` is unbounded in size and is drained synchronously before lines could be lost. `SimpleLogBuffer`'s 1000-line cap remains, but it is now only the SSE tail cache — eviction there has no durability impact.

### 3. `cleanupAbandonedStreams` (renamed from `cleanupExpiredStreams`)

**Job:** release in-memory state for runs whose `/close` never arrived (process killed, OOM, network partition).

**Schedule:** every `cleanupIntervalMinutes` (default 60). Today's 1-min interval was tied to the aggressive 5-min threshold; with a 24h threshold, hourly polling is plenty.

**Threshold:** `streamTimeoutHours` since last `appendLogs` (default 24). Configurable.

**Per expired stream**, under the per-stream lock:

1. Drain remaining `pendingFlush` to `partial.txt` (final flush, same path as periodic flush).
2. `CopyObjectRequest` from `partial.txt` → `logs.txt` (server-side, no bytes through OM).
3. `DeleteObject partial.txt`.
4. Best-effort delete `.active/{sanitizedFQN}/{runId}/{serverId}` marker.
5. Drop in-memory state for the stream: `activeStreams`, `pendingFlush`, `totalLinesAppended`, `recentLogsCache`.

If step 1 (final flush) fails, abort the cleanup for this stream this tick, log a warning, retain in-memory state, retry next tick. After N consecutive failures (default 10), emit an alerting metric. The stream stays in memory until success or operator intervention.

If step 2 (copy) fails after step 1 succeeded, leave `partial.txt` in place; next tick retries the copy.

### 4. `/close` flow

The `/close` endpoint is the only path that materializes `logs.txt` in the normal happy-path lifecycle.

**`closeStream(fqn, runId)`**, under the per-stream lock:

1. **Final flush**: drain remaining `pendingFlush` to `partial.txt` via the same read-merge + metadata path.
2. **Server-side copy**: `CopyObjectRequest` from `partial.txt` → `logs.txt`.
3. **Delete partial.txt**: single `DeleteObject`.
4. **Best-effort delete** the `.active/{sanitizedFQN}/{runId}/{serverId}` marker.
5. Drop in-memory state for the stream.

**Idempotency:**
- `/close` called twice → second call finds no `partial.txt`, no in-memory state, no-ops gracefully. The `logs.txt` from the first call is preserved.
- `/close` arriving for a stream already cleaned up by `cleanupAbandonedStreams` → same: `logs.txt` already exists, `partial.txt` already gone, no-op.
- `/close` racing with the periodic `writePartialLogs` tick → lock serializes them.

**Failure modes:**
- Step 1 (final flush PUT) fails → return 5xx, client retries `/close`. `partial.txt` may be one flush behind on data but is not corrupted.
- Step 2 (copy) fails → return 5xx, client retries. `partial.txt` still in place with full content.
- Step 3 (delete `partial.txt`) fails → log warning, swallow. `logs.txt` exists, that is the user-visible artifact. `partial.txt` is cleaned up by the bucket lifecycle policy after `expirationDays` (default 30).

There is no multipart upload to abort. The write path stopped using one in Section 2.

### 5. Read path

No changes to API endpoints, payload shapes, or client code. One subtle correction inside `getCombinedLogsForActiveStream`:

| Read | Source today | Source after this change |
|------|--------------|--------------------------|
| `getLogs(fqn, runId)` post-`/close` | GET `logs.txt`; fallback to `partial.txt` on 404 | Identical |
| `getCombinedLogsForActiveStream` mid-run | GET `partial.txt`; fallback to `recentLogsCache` | GET `partial.txt`, then concatenate `pendingFlush` snapshot (read-only — no clear) for the most-recent-tail bytes that haven't been flushed yet. Apply cursor pagination. |
| `getRecentLogs(N)` (live tail) | `SimpleLogBuffer` last N | Identical |
| `registerLogListener` (SSE) | `notifyListeners` per `appendLogs` | Identical |
| `getLogInputStream` (download) | `logs.txt` post-close, `partial.txt` mid-run | Identical |

### 6. Migration & rollout

Completed runs with `logs.txt` remain readable — no changes to the artifact format or read path.

In-flight runs at deploy time may lose data; accepted. No special legacy-handling code is needed: legacy `partial.txt` files without metadata are read normally (treated as "no prior offset"), and the next flush adds metadata.

Existing in-flight multipart uploads from the old code become orphans on deploy and are aborted by the bucket lifecycle (`abortIncompleteMultipartUpload` = 7 days). No operator action required.

**Configuration changes** (all in `LogStorageConfiguration`):

| Field | Default | Replaces |
|-------|---------|----------|
| `streamTimeoutHours` | 24 | `streamTimeoutMinutes` (kept for backward-compat; if set < 30, log a deprecation warning at startup) |
| `cleanupIntervalMinutes` | 60 | hard-coded 1-minute schedule in `S3LogStorage.initialize` |
| `partialFlushIntervalMinutes` | 2 | hard-coded 2-minute schedule (no behavioral change; promoted to config) |
| `earlyFlushWatermarkBytes` | 5 \* 1024 \* 1024 | new |
| `pendingFlushAlertAfterFailures` | 10 | new |

## Testing

Test cases that must exist:

1. **Idle gap > stream timeout**: simulate 10-minute idle on a stream with prior `partial.txt` content; confirm next append + flush merges, does not clobber. (Replays the 80MB→KB scenario.)
2. **OM-server restart mid-run**: drop in-memory state, re-init `S3LogStorage`, append again, flush; confirm `partial.txt` retains pre-restart content + appends post-restart content.
3. **High-burst write**: append > 10,000 lines in < 2 min; confirm early-flush watermark fires, no lines dropped, `totalLinesAppended` and `partial.txt` body line count match.
4. **`/close` happy path**: append, flush, close; assert `logs.txt` byte-equals the durably-flushed content of `partial.txt` at the moment of close, and `partial.txt` is deleted.
5. **`/close` idempotency**: call `/close` twice; second call returns 200, `logs.txt` is unchanged.
6. **`/close` arriving after `cleanupAbandonedStreams` already finalized**: `logs.txt` already exists; `/close` is a no-op.
7. **`PutObject` failure during flush**: inject S3 failure on PUT; confirm `pendingFlush` is restored (lines not lost), retry succeeds.
8. **Buffer overflow defense**: append > `SimpleLogBuffer` capacity in a tight loop; assert `pendingFlush` is unbounded by that cap and no lines are evicted prior to flush.
9. **Migration — legacy `partial.txt`**: pre-create a `partial.txt` without metadata, then exercise the new flush path; assert it merges correctly, no clobber.
10. **`cleanupAbandonedStreams` finalization**: simulate 25h idle; confirm `logs.txt` materialized via copy, `partial.txt` deleted, in-memory state cleared.

Integration tests live in `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/` per CLAUDE.md conventions, using a real S3-compatible backend (MinIO via Docker).

## Out of scope

- Multi-server-without-stickiness topology. Design assumes the current ALB stickiness contract.
- Recovering data from runs that lost lines under the old buggy code, prior to deploy.
- Switching to a segment-based storage model (Approach A from brainstorming). Considered and rejected in favor of backward-compat.

## Open items

None blocking. Implementation plan to be produced in a follow-up via the `superpowers:writing-plans` skill.
