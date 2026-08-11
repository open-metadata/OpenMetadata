# Live Ingestion Log Streaming (SSE)

How a client tails an ingestion pipeline's logs in real time over Server-Sent Events instead of
polling `/logs/{id}/last` on a timer.

For where the log bytes are stored and how they get there, read
[streamable-logs.md](streamable-logs.md). This document is about the **read path a UI uses while a
run is in progress**.

## Why streaming instead of polling

The paginated endpoint (`GET /logs/{id}/last?after=<cursor>`) forces every viewer into a poll loop:
pick an interval, re-issue the request, diff the cursor, repeat until the run ends. That has three
costs the streaming endpoint removes:

| Polling | Streaming |
|---|---|
| Every open tab is its own poll loop against S3 / Airflow. | All viewers of a run share **one** server-side reader. |
| Latency is the poll interval. | New content is pushed as soon as the shared reader sees it. |
| The client decides when the run is over (or never stops). | The server sends an explicit `complete` event and closes. |
| A "fetch everything" loop can walk pages without bound. | Reads per tick, bytes per stream, and stream lifetime are all capped. |

## The endpoint

### `GET /api/v1/services/ingestionPipelines/logs/{fqn}/stream/{runId}`

One endpoint for every deployment. `{fqn}` is the pipeline's **fullyQualifiedName or Id (UUID)**,
like `/logs/{id}/last`. `{runId}` is the run to follow — a UUID when the run's logs are in object
storage, or the pipeline service's own run identifier (Airflow's `scheduled__…`) otherwise.

| Query parameter | Default | Meaning |
|---|---|---|
| `after` | beginning of the log | Resume cursor from a previous event. Content up to the cursor is not re-sent. |

To tail the newest run, read its `runId` from `pipelineStatuses` first — the same field
`/logs/{id}/last` resolves internally.

Response: `text/event-stream`. Every frame is one JSON
[`LogStreamEvent`](../openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/logStreamEvent.json)
on an unnamed SSE event, so a plain `EventSource.onmessage` receives all of them.

```jsonc
// eventType: "logs" — new content
{"eventType":"logs","runId":"a1b2…","logs":"[2026-08-10 …] INFO Ingesting table x","after":"4211","replay":false,"truncated":false}

// eventType: "complete" — the server is closing the stream
{"eventType":"complete","runId":"a1b2…","after":"4680","reason":"runFinished"}

// eventType: "error" — the stream cannot be served; it is closed right after
{"eventType":"error","runId":"a1b2…","message":"The server is already streaming the maximum number of pipeline runs. …"}
```

| Field | Meaning |
|---|---|
| `eventType` | `logs`, `complete` or `error`. |
| `runId` | Run the content belongs to. |
| `logs` | Content appended since the previous event. Absent on `complete` / `error`. |
| `after` | Cursor pointing just past `logs`. **Store it**: it is what you pass to `?after=` to reconnect. |
| `replay` | `true` when the chunk came from the server's replay buffer because the stream was already running when you connected. |
| `truncated` | `true` on the first event when the server could not work out exactly what you are missing. **Treat it as a reset**: clear the viewer, render the replayed block that follows, and backfill earlier history from `GET /logs/{id}/last` or the download endpoint. |
| `reason` | Why the stream ended. See the table below. |
| `message` | Human-readable detail on `error`, and on a `complete` that ended early. |

Between events the server sends SSE heartbeat comments (`: heartbeat`) every 25 s so proxies do not
drop an idle connection. `EventSource` ignores them.

**End-of-stream reasons**

| `reason` | What happened | What a client should do |
|---|---|---|
| `runFinished` | The run reached a terminal state and its log went quiet — or the server has no status row for it and it stayed quiet for a minute. | Nothing. The log is complete. |
| `idleTimeout` | No new content for 5 minutes and the run never reported a terminal state. | Reconnect with `?after=` if you still care about the run. |
| `maxDuration` | The stream hit its 1 hour lifetime cap. | Reconnect with `?after=`. |
| `maxBytes` | The stream delivered 32 MB. | Use `GET /logs/{id}/last/download` for the rest. |

A stream that ends **without** a `complete` event was cut short — the client stopped draining the
socket and crossed its backlog ceiling, the server went away, or the network dropped. Treat a closed
body with no `complete` as "reconnect with `?after=<last cursor>`".

**Back off between reconnects.** The causes above are often persistent: a viewer that cannot keep up
crosses its backlog ceiling again on the next attempt, and each reconnect re-fetches the replay
backlog. Reconnecting immediately in a loop turns one struggling client into a load generator. Use a
capped exponential delay, and give up after a few consecutive failures rather than retrying forever.

**Status codes**

| Code | When |
|---|---|
| 200 | Stream opened. It is committed immediately — the response never waits for the run to finish. |
| 404 | No such pipeline. |

Everything that goes wrong *after* the pipeline resolves is reported as an `error` event on the
stream, not as an HTTP status: no log backend configured, the server at its stream capacity, a
viewer past the connection cap. A client therefore needs one error path (handle `eventType:
"error"`), not two.

## Using it from a browser

`EventSource` cannot set an `Authorization` header, so use `fetch` with a streaming reader:

```ts
const controller = new AbortController();
let cursor: string | undefined;

const tail = async (fqn: string, runId: string) => {
  const url = new URL(
    `${getBasePath()}/api/v1/services/ingestionPipelines/logs/${getEncodedFqn(
      fqn
    )}/stream/${encodeURIComponent(runId)}`,
    window.location.origin
  );
  if (cursor) {
    url.searchParams.set('after', cursor);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await getOidcToken()}` },
    signal: controller.signal,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      if (!frame.startsWith('data: ')) {
        continue; // heartbeat comment or blank separator
      }
      const event = JSON.parse(frame.slice(6));
      cursor = event.after ?? cursor;

      if (event.eventType === 'logs') {
        appendToViewer(event.logs);
      } else if (event.eventType === 'complete') {
        onStreamEnd(event.reason); // reconnect here for a non-runFinished reason
      } else {
        onStreamError(event.message);
      }
    }
  }
};
```

Reconnecting is always `?after=<last cursor you saw>`. The cursor is opaque: it means "line offset"
for object storage and "chunk offset" for Airflow, and the two are not interchangeable, so never
construct one by hand.

If the run is still being tailed for someone else when you reconnect, the server resumes you from
the shared reader's buffer: it replays exactly the chunks issued after your cursor. When your cursor
is older than that buffer — or came from another server behind the load balancer — the server cannot
tell what sits in between, so it replays what it has with `truncated: true`. That is the one case
where a client must reset its viewer rather than append.

## Using it from the command line

```bash
curl -N -H "Authorization: Bearer $OM_TOKEN" \
  "http://localhost:8585/api/v1/services/ingestionPipelines/logs/my.pipeline.fqn/stream/$RUN_ID"
```

`-N` disables curl's buffering, which is what makes the live tail visible.

## How it works

```
GET /logs/{fqn}/stream/{runId}
        │
        ▼
IngestionPipelineResource ──▶ IngestionLogStreamFactory ──▶ picks the source for where the bytes are
        │                                                     ├─ StorageLogTailSource        (S3, line cursor)
        │                                                     └─ PipelineServiceLogTailSource (Airflow/Argo, chunk cursor)
        ▼
IngestionLogStreamManager ──▶ one IngestionLogTailer per (pipeline, run)
        │                          │  polls every 2 s on a shared scheduler
        │                          │  keeps a bounded replay buffer
        │                          └▶ fans each chunk out to every viewer
        └─ SseConnectionRegistry: connection cap + 25 s heartbeat + disconnect sweep
```

**One reader per run.** The tailer is keyed by `(storage backend, pipeline FQN, run)`. Opening the
same run in ten tabs creates ten SSE connections but still exactly one reader against S3 or Airflow.
The last viewer to disconnect stops the reader, so an unwatched run is not read at all.

**Cursors are per backend.** Object storage paginates a run's log by line offset. The pipeline
service paginates it in fixed-size chunks and keeps appending to the last chunk while the task runs,
so a chunk-index cursor alone would re-deliver a growing chunk on every poll — the cursor is
`chunk:charactersAlreadyDelivered` and only the growth is emitted. The source also never asks for a
chunk index the backend did not itself report, because Airflow answers an out-of-range chunk with a
400.

**Knowing when to stop.** The run's state is read from its pipeline-status rows, at most once every
10 s and never again once terminal — no call to the pipeline service is made for this. Once the run
is terminal the stream stays open until the log has been quiet for 10 s, so the final flush of a
just-finished run is still delivered.

Only the last few runs of a pipeline keep a status row, so a run the server finds no row for is
**unknown**, not finished — that describes a run that aged out of the window *and* one that was
triggered a second ago and has not written anything yet. An unknown run gets a full minute of
silence before the stream closes, which is what stops a freshly triggered pipeline from being
reported as already over while Airflow is still starting the task.

**Nothing is unbounded.** Every limit below is enforced by `LogStreamSettings`:

| Limit | Default | What it protects |
|---|---|---|
| `pollSeconds` | 2 | Read rate against the log backend, per run. |
| `linesPerRead` | 1000 | Page size held in heap at any moment. |
| `maxReadsPerTick` | 20 | Burst of backend calls when catching up on a backlog. |
| `maxBytesPerTick` | 1 MB | Content pushed at a client in one tick. |
| `maxStreamBytes` | 32 MB | Total a single stream will deliver. |
| `maxStreamSeconds` | 3600 | Lifetime of a forgotten browser tab. |
| `maxIdleSeconds` | 300 | Runs that die without reporting a terminal state. |
| `finishGraceSeconds` | 10 | Silence after a confirmed-terminal run before closing. |
| `unknownRunGraceSeconds` | 60 | Silence before closing a run with no status row — a just-triggered run needs time to start writing. |
| `maxReplayBytes` | 256 KB | Backlog kept per run for late joiners. |
| `maxPendingBytesPerClient` | 4 MB | Memory a stalled browser can pin. |
| `maxActiveRuns` | 200 | Runs tailed concurrently per server. |
| `maxActiveConnections` | 500 | Open log stream connections per server. |

A request past `maxActiveRuns` or `maxActiveConnections` gets an `error` event and a closed stream
rather than being queued.

Polling runs on a shared scheduler sized from `maxActiveRuns` (one thread per 25 runs, clamped to
2–16). A poll is a network read, so a slow backend shows up as a longer effective poll interval for
everyone rather than as a stalled stream — and a poll that fails for any reason closes its own
stream and gives the run's tail slot back instead of leaving a dead reader behind.

## Multi-server deployments

A tailer is per server. Two servers behind a load balancer that both have viewers for the same run
each keep one reader, which is the intended trade: reads are cheap and idempotent, and no
cross-server coordination is needed. The write path's sticky-session requirement (see
[streamable-logs.md](streamable-logs.md#multi-server-topology)) does not apply here — reading
`partial.txt` from S3 works from any instance.

## Source files

- `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/stream/` — the streaming engine
- `openmetadata-service/src/main/java/org/openmetadata/service/sse/SseConnectionRegistry.java` — connection cap and heartbeat
- `openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/logStreamEvent.json` — the event schema
- `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/stream/` — unit tests
- `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/IngestionPipelineLogStreamIT.java` — end-to-end test
