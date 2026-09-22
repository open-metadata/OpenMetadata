# Ingestion Runtime Diagnostics

**Status:** Proposed
**Author:** Sriharsha Chintalapani
**Date:** 2026-05-15

---

## TL;DR

OpenMetadata ingestion processes fail in production in two main ways: they **hang** (often silently) and they **OOM**. Today we have no built-in way to answer "what was it doing right before it died?", so we ship fixes based on hypotheses and hope. This doc proposes a small, always-available diagnostics subsystem inside the ingestion framework that — when an operator enables DEBUG logging on the workflow — captures enough runtime state (current operation, in-flight HTTP, memory growth, stage backpressure) that the root cause is in the logs every time. The cost when off: zero. The cost when on: ~500 KB and < 0.01% CPU.

The doc is organized so each component below can ship as an independent PR.

---

## 1. Why we need this — case studies from production

### Case study 1: the "Snowflake hang" that was actually a logging recursion

**Symptom (2026-05).** Snowflake ingestion pods on a customer cluster were hanging indefinitely. From outside the pod:
- `kubectl logs` returned nothing recent.
- The OpenMetadata server saw no incoming requests from the connector.
- No queries appeared in Snowflake `QUERY_HISTORY` for the stuck window.
- The pod's CPU was pegged.

**Hypothesis-driven fixes that did not help.**
1. **"HTTP pool is stale, no timeouts."** Shipped PR #28131 to add request timeouts. Hang recurred.
2. **"Snowflake driver hang."** Considered OCSP, chunk-download, network. Could not falsify without data.
3. **"Server-side backpressure."** Plausible — but `kubectl logs` showed no inbound requests on the server, so the connector wasn't even reaching it.

**What it actually was.** A py-spy dump (which itself required `kubectl debug --profile=sysadmin` with `SYS_PTRACE` — a 30-minute setup) revealed MainThread sitting **~977 frames deep** in `StreamableLogHandler.emit()`, alternating between `logger.warning("queue is full")` and `logger.error("error in emit")`. The handler was attached to the same logger it was calling, creating infinite recursion as soon as the bounded log queue filled. Every other thread — including the log-shipper itself — was blocked on the Python `logging` module's per-handler `RLock` held by MainThread. No HTTP request was in flight. No timeout could have helped.

**The fix:** route in-handler diagnostics through a separate non-propagating logger (PR #28160).

**Time to root cause:** ~6 hours of investigation, plus one shipped fix that addressed an entirely different theory.
**Time it should have taken:** seconds, if the process had logged "MainThread stuck for 312 s in `streamable_logger.emit`" on its own.

### Case study 2: connector OOMs without a clear cause

**Symptom (ongoing).** Several connectors — Snowflake, Postgres on large databases, S3-based connectors — die with OOMKill on Kubernetes. The pod restarts. The next run sometimes succeeds, sometimes OOMs again.

**Why we cannot diagnose today.** When the OOMKill fires:
- We get an exit code (137), no Python traceback, no last-state log.
- We have no idea which stage was running.
- We have no idea what type of object was occupying memory.
- We have no idea whether memory was growing slowly (leak) or spiked at a specific entity (one bad row).

**Suspected contributors, none confirmed.**
- Entity backlog: when one stage stalls, upstream stages keep producing and accumulate Pydantic entity objects.
- PyArrow `ResultBatch` objects held by reference longer than necessary.
- Unbounded internal caches in connector base classes (lineage cache, schema cache).
- Log queue with very large entries (multi-MB stack traces, formatted entity dumps).
- HTTP request bodies buffered for shipping batches.

Each of these is a plausible OOM source. Without per-stage memory growth tracking + a snapshot at OOM time, every fix is a guess. We have already shipped PRs to one or two of these on the suspicion that they were "the" cause.

### Case study 3: silent slowness (no logs for hours)

**Symptom.** Long-running ingestion (DBT, lineage) shows no progress in logs for hours, then either completes or is killed by the workflow timeout. Customer asks: "is it stuck, or just slow?"

**Today:** we cannot answer. We tell them to wait, or kill and rerun.

**What we need:** every 30 seconds, a single structured log line saying *exactly* what entity is being processed and how long has been spent on it. The customer (and we) instantly know "it's making progress, table 4732 of 9000" vs "it hasn't moved in 4 hours, kill it."

---

## 2. The principle: stop guessing, start measuring

These cases share a single root cause: **we ask the process to fail silently, then try to reconstruct what happened after the fact.** The instrumentation we keep needing is the same every time:

- What thread was doing what, just before the failure?
- Was memory growing? At what rate? On which stage?
- What HTTP requests were in flight?
- What was the queue depth between stages?
- What was the last entity successfully yielded by the source / written by the sink?

This information is **cheap to capture** if we capture it as the process runs, instead of trying to recover it from a dead pod. The cost of always-on capture is tiny; the cost of ad-hoc post-mortem debugging is enormous. This doc designs the always-on capture layer.

---

## 3. Scope

### Goals

- Every ingestion process running with `loggerLevel == DEBUG` produces a continuous, low-volume stream of structured diagnostic output (heartbeats, watchdog warnings) and supports on-demand dumps (signal-triggered).
- The dump from a hung or about-to-OOM process is enough to identify the **stage**, **entity**, **operation**, **HTTP request**, **memory consumer**, and **stack** involved.
- All of this works with no external tooling: no `py-spy`, no `kubectl debug`, no `ptrace`. The information is in `kubectl logs`.
- Zero overhead when off. Single existing knob (`loggerLevel`).

### Non-goals

- A general-purpose APM/metrics system.
- Profiling for throughput optimization.
- Replacing the existing workflow status counters.
- Adding any new ingestion config field or env var.
- Catching every possible failure. We optimize for the common failure modes seen in production (hangs, OOMs, slowness).

### What this is NOT

This is not a substitute for fixing bugs. The point is to **identify which bug to fix**. After this lands, when a customer reports a hang or OOM, we expect:
1. Look at `kubectl logs`.
2. Identify the operation/entity/memory pattern.
3. Open a focused bug fix.

…instead of "let's try adding timeouts and see if it helps."

---

## 4. Activation

Single knob: `workflowConfig.loggerLevel`.

| `loggerLevel` | Diagnostics module behavior |
|---|---|
| `DEBUG` | Fully installed: signals, watchdog, heartbeat, memory tracker, HTTP introspection. Output to stderr + structured logs. |
| `INFO` (or anything else) | Module is dead code. `operation()` is a no-op `contextmanager`. No threads. No signal handlers. Memory cost ≈ 0. |

We deliberately avoid new env vars or new config fields. Diagnostic toggle reuses an existing UI-controllable setting.

Trade-off: **first occurrence of a non-reproducing hang on INFO is undiagnosed.** Mitigation: flip log level → re-run → captured. One cycle on first occurrence, never afterward. Worth it to keep production runs strictly free of overhead.

---

## 5. Architecture

Five components, all under `metadata/ingestion/diagnostics/`. A single `diagnostics.install(workflow)` call in `BaseWorkflow.execute()` activates everything when `loggerLevel == DEBUG`.

### 5.1 Operation registry (`registry.py`)

Per-thread stack of "what am I doing right now":

```python
from metadata.ingestion.diagnostics import operation

with operation("source.iter", entity_fqn=fqn):
    with operation("snowflake.query", sql=stmt[:500], query_id=qid):
        cursor.execute(stmt)
    with operation("sink.write", entity_type="table"):
        ometa.create_or_update(table)
```

State: `{thread_id: [(name, kwargs, started_monotonic), ...]}`.

The registry exposes `snapshot()` which, for each live thread, returns the stack with per-frame durations. This is the ground truth used by every other component (heartbeat, watchdog, signal dump).

**Properties:**
- Thread-safe via a single fine-grained lock.
- O(1) push/pop per `operation()` enter/exit.
- Kwargs are truncated to 2000 chars at registration (a 10 MB DDL string would stay referenced otherwise).
- Stack depth capped at 20 to guard against runaway nesting.
- The watchdog garbage-collects entries for dead `thread.ident`s on each tick.

**Cost:** ~1 µs per enter/exit; ~15 KB at peak.

### 5.2 Signal handlers (`signals.py`)

On install, registers `SIGUSR1` and `SIGUSR2` plus `faulthandler.register`. On signal:

| Signal | What gets dumped |
|---|---|
| `SIGUSR1` | Full: `faulthandler.dump_traceback(all_threads=True)` + operation registry snapshot + in-flight HTTP requests + memory state + workflow status |
| `SIGUSR2` | Incremental: registry + HTTP + memory only. Cheap. For periodic polling. |

Operator workflow when something looks stuck:
```bash
kubectl exec <pod> -- bash -c 'pkill -SIGUSR1 -f "python.*main.py"'
kubectl logs <pod> --tail=500
```

No `py-spy`, no `kubectl debug`, no `ptrace`. Works on any pod, any cluster, any time.

`faulthandler` is stdlib; it captures both Python and native (C extension) frames, runs from a signal handler safely, and writes synchronously.

### 5.3 Watchdog (`watchdog.py`)

A daemon thread that wakes every 10 s. For each live thread:
- Look up the deepest active operation in the registry.
- If it has been on the same operation for **> 60 s** → log a structured warning line.
- If it has been on the same operation for **> 300 s** → trigger a full `SIGUSR1`-style dump.

Re-dump throttle: at most one full dump per `(thread, operation_name)` per 5 minutes.

This is the behavioral change that changes everything: **the process logs its own hangs**. No human has to be watching the pod for the data to be captured.

### 5.4 Heartbeat (`heartbeat.py`)

A daemon thread that emits one structured log line every 30 s while the workflow is running:

```
diag.heartbeat stage=source step=table progress=4732/9000 current_op=source.iter
  current_fqn=svc.db.schema.table4732 current_op_age=8s rss=412M rss_delta_30s=+2.1M
  threads=8 active_http=1 queue_source_to_sink=240/1000
```

This single line answers, for the operator looking at `kubectl logs`:
- Am I making progress? (compare two heartbeats)
- What stage am I on?
- What entity am I currently processing?
- Is memory growing? At what rate?
- Is one stage backed up behind another?

Output cadence is tunable as a constant; 30 s is a sensible default for ingestion that typically runs minutes to hours.

### 5.5 HTTP introspection (`http_introspect.py`)

Wraps the two HTTP surfaces we own:

| Surface | Wrap point | What we record |
|---|---|---|
| `OMetaClient` | `REST._request()` | method, URL, started_at, request_id in an active-requests dict, plus an `operation("ometa.http", ...)` registry entry |
| Snowflake (and other DB connectors) | `cursor.execute()` | SQL (truncated), query_id, started_at, plus an `operation("snowflake.query", ...)` registry entry |

Active-requests dict is keyed by `(thread_id, request_id)`, entries removed in `finally`. On dump, rendered as a table:

```
diag.dump.http
  thread=log-shipper-xyz method=POST url=/api/v1/.../logs age=37s
  thread=MainThread       method=PUT  url=/api/v1/tables    age=2s
```

For surfaces we don't own (Snowflake's OCSP validator, chunk downloader), we rely on the `faulthandler` thread dump (native + Python frames) to identify the hang location. Those frames have characteristic library paths that are easy to recognize.

### 5.6 Memory tracker (`memory.py`) — NEW, motivated by case study 2

A daemon thread that samples memory every 30 s and maintains a small ring buffer (last ~10 samples). It records:

| Metric | Source |
|---|---|
| `rss` | `psutil.Process().memory_info().rss` |
| `rss_growth_per_sec` | derivative over the ring buffer |
| `cgroup_current` / `cgroup_max` | `/sys/fs/cgroup/memory.{current,max}` |
| `cgroup_oom_kill_count` | `/sys/fs/cgroup/memory.events` `oom_kill` field |
| `gc_collections` | `gc.get_stats()` per generation |
| `top_object_types` | `gc.get_objects()` aggregated by `type(obj).__name__`, top 10 by count |

On heartbeat, only `rss` and `rss_delta_30s` are emitted. On full dump (SIGUSR1 or watchdog auto-dump), all of the above are emitted including the top-10 object types.

The "top object types" is the OOM debugging breakthrough. Today we can't see which objects are growing. With `gc.get_objects()` aggregated into a Counter, a dump from a process that's growing toward OOM looks like:

```
diag.dump.memory
  rss=2841M rss_delta_30s=+45M cgroup=2841M/3072M oom_kills=0
  gc_gen0=23 gc_gen1=4 gc_gen2=1
  top_types:
    Table              182341
    Column             1843219
    Tag                94823
    LineageEdge        451233
    PyArrowResultBatch 47
    SnowflakeResultBatch 12
```

Now we know exactly what's accumulating. If `Table` is in the hundreds of thousands and growing per heartbeat, the sink is the bottleneck. If `PyArrowResultBatch` is growing, the source is holding references. We move from "OOM, unknown why" to "OOM, sink starved, here's the entity backlog."

**Cost.** `gc.get_objects()` is the one expensive call (it iterates all tracked objects). It's invoked only on dump (SIGUSR1 / watchdog auto-dump), not on heartbeat. On heartbeat we only sample `rss`. So the steady-state cost is `psutil.memory_info()` + arithmetic — sub-millisecond.

### 5.7 Stage backpressure visibility (`stage_progress.py`) — NEW

The topology runner moves entities through source → processor → sink stages via internal buffers. Today these buffers are invisible. A common OOM pattern: source produces faster than sink can drain → entities pile up in the in-memory buffer → OOM.

This component adds two small numbers to the heartbeat: queue depth and recent transition rate per inter-stage boundary. Implemented by hooking the topology runner's stage transitions to a tiny counter, not by changing the runner's logic.

Heartbeat then shows:

```
diag.heartbeat ... stage_queues=source→processor:14/100 processor→sink:240/1000
```

If `processor→sink` is at capacity for many heartbeats, the sink is starving — and you know to look at the OpenMetadata server / sink-side HTTP, not the source.

---

## 6. Output format (stable, grep-friendly)

All diagnostic output uses a `diag.` prefix:

```
diag.heartbeat    stage=... rss=... queue=...
diag.warn.stuck   thread=MainThread op=snowflake.query duration=72s kwargs={...}
diag.dump.begin   reason=watchdog trigger_op=snowflake.query duration=312s
diag.dump.threads ...
diag.dump.ops     ...
diag.dump.http    ...
diag.dump.memory  ...
diag.dump.queues  ...
diag.dump.end
```

Filter with `grep '^diag\.'`. Parse with any structured log tool. Same prefix appears in stderr-only output from internal loggers, so the operator sees everything together.

---

## 7. Wire-in points (existing framework code that needs to call `operation()`)

| File | Change | Why |
|---|---|---|
| `metadata/workflow/base_workflow.py` | Call `diagnostics.install(self)` if `loggerLevel == DEBUG` | Activation point |
| `metadata/ingestion/api/steps.py` | Wrap `Source.iter()` / `Processor.run()` / `Sink.write_record()` in `operation(...)` | The three stages |
| `metadata/ingestion/topology_runner.py` | Notify stage_progress on transitions | Backpressure visibility |
| `metadata/ingestion/ometa/client.py` | Wrap `REST._request()` in `operation` + active-HTTP register | OMetaClient introspection |
| `metadata/ingestion/source/database/common_db_source.py` (and DB connectors) | Wrap `cursor.execute()` in `operation` | DB query introspection |

Connector authors writing new connectors do not need to know any of this. They get instrumentation for free at the framework seams.

---

## 8. Defaults (hardcoded; not user-configurable)

| Setting | Value | Rationale |
|---|---|---|
| Activation | `loggerLevel == DEBUG` | Reuse existing config |
| Watchdog tick | 10 s | Responsive, cheap |
| Stuck-warning threshold | 60 s | Most legit ops < this |
| Auto-dump threshold | 300 s | True hang |
| Re-dump throttle | 5 min per (thread, op) | Prevent flooding |
| Heartbeat cadence | 30 s | Useful, low-noise |
| Memory sample interval | 30 s (heartbeat) | Cheap |
| Memory deep-snapshot | only on dump | `gc.get_objects()` is the only expensive call |
| Kwargs truncation | 2000 chars | Captures normal SQL |
| Op stack depth cap | 20 | Defensive |
| Output target | stderr (also routed to `/tmp/openmetadata-diag-<pid>.log`) | Survives log rotation |

Constants live in `diagnostics/__init__.py`. If reality shows them wrong, we change them in code — not config.

---

## 9. Memory and CPU budget

**Off (INFO mode, every production run today):** zero. Dead code.

**On (DEBUG mode):**

| Component | Memory | CPU |
|---|---|---|
| Registry | ~15 KB | ~1 µs / op enter+exit |
| Active HTTP tracker | ~5 KB | ~1 µs / request |
| Watchdog thread | ~100 KB RSS | ~10 µs / 10 s |
| Heartbeat thread | ~100 KB RSS | ~100 µs / 30 s |
| Memory tracker | ~10 KB ring buffer | ~1 ms / 30 s (sample only) |
| Memory deep-snapshot | 0 ongoing | ~50–500 ms on each dump (rare) |
| Stage progress | ~5 KB | ~1 µs / transition |
| `faulthandler` buffer | ~8 KB | 0 until SIGUSR1 |
| **Total** | **~250 KB** | **< 0.01% CPU** |

The deep memory snapshot (`gc.get_objects()`) is the only expensive call and only fires on actual dump events.

---

## 10. Implementation plan — six small PRs

Each PR is independently reviewable, independently shippable, and each one improves visibility on its own.

### PR 1 — Foundation (~350 LoC)
- `diagnostics/__init__.py` with public API (`install`, `operation`, `is_active`, `dump`)
- `diagnostics/registry.py`
- `diagnostics/signals.py` (SIGUSR1 / SIGUSR2 + faulthandler)
- Wire `diagnostics.install()` into `BaseWorkflow.execute()`
- Wrap `Source.iter()` and `Sink.write_record()` in `operation()`
- Wrap `OMetaClient._request()` + active-HTTP register
- Unit tests: registry, signal-triggered dump, no-op fallback when not installed

**Ships value:** `kill -SIGUSR1` works for any DEBUG-enabled run. We can dump state on demand.

### PR 2 — Watchdog + heartbeat (~250 LoC)
- `diagnostics/watchdog.py` with 60 s warn / 300 s auto-dump
- `diagnostics/heartbeat.py` with 30 s cadence
- Integration test: install diagnostics, sleep in an `operation()`, assert watchdog logs a stuck line and auto-dumps

**Ships value:** The process auto-detects its own hangs. Heartbeat confirms liveness.

### PR 3 — Memory tracker (~200 LoC)
- `diagnostics/memory.py`: RSS + cgroup sampling on heartbeat, `gc.get_objects()` top-types on dump
- Heartbeat output gains `rss=` and `rss_delta_30s=` fields
- Dump output gains `diag.dump.memory` section
- Tests: simulate growth, assert top types are reported correctly

**Ships value:** OOMs become diagnosable. We see which object type is growing.

### PR 4 — Stage backpressure visibility (~150 LoC)
- `diagnostics/stage_progress.py`: small counter hooked into topology runner
- Heartbeat output gains `stage_queues=` field
- Test: induce a slow sink, assert queue depth shows up in heartbeat

**Ships value:** We can tell whether the source, processor, or sink is the bottleneck.

### PR 5 — DB connector instrumentation (~200 LoC)
- Wrap `cursor.execute()` in `common_db_source.py` so every SQL query is in the operation registry with query text + query_id
- Same pattern can be replicated per-connector when there's a need

**Ships value:** "Stuck on a SQL query" becomes a labeled, visible op.

### PR 6 — Disk-persisted dumps (~50 LoC)
- Mirror SIGUSR1 dumps to `/tmp/openmetadata-diag-<pid>.log` so they survive container restarts and log rotation

**Ships value:** Post-mortem diagnosis works even if `kubectl logs` rolled over.

After **PR 1** alone we can already diagnose the Snowflake-style hang on the next DEBUG run.
After **PR 2** we no longer need to be watching the pod.
After **PR 3** we can diagnose OOMs.
PRs 4–6 are continuous improvement.

---

## 11. Worked examples — what would these PRs have told us?

### The streamable_logger hang

Before: 6 hours of py-spy + manual analysis + one wrong-theory fix.

With this work installed at the time:
- Watchdog at 60 s: `diag.warn.stuck thread=MainThread op=source.iter entity_fqn=svc.db.schema.table42 duration=72s` — already pointing at a specific table.
- Heartbeat at 30 s: would stop firing because MainThread is wedged in the recursion (still useful: the *last* heartbeat tells us where it died).
- Watchdog auto-dump at 300 s: thread stack via `faulthandler` shows the same 977-deep `emit -> warning -> emit` chain, directly fingering `streamable_logger.py` as the culprit. **Total time to root cause: ~5 minutes from log readout.**

### A future OOM (Case study 2 generalized)

Heartbeat history in `kubectl logs`:
```
T+0:00  diag.heartbeat ... rss=400M
T+5:00  diag.heartbeat ... rss=900M  rss_delta_30s=+50M  stage_queues=source→sink:1000/1000
T+8:00  diag.heartbeat ... rss=1.8G  rss_delta_30s=+60M  stage_queues=source→sink:1000/1000
```

The watchdog or the operator's SIGUSR1 gives:
```
diag.dump.memory
  rss=2.6G rss_delta_30s=+50M
  top_types:
    Table       423019
    Column      4109832
    LineageEdge 8431
```

Verdict: sink is at capacity, source keeps producing `Table` and `Column` objects, those accumulate. The problem is sink-side throughput, not the source. We open a focused PR on the sink — instead of three speculative ones across the source.

### A "is it stuck or slow?" question

Customer reports an ingestion running for 4 hours with no logs. We say: `kubectl logs | grep diag.heartbeat | tail -5`. They paste:
```
T+3:50:00 diag.heartbeat ... stage=source step=table progress=4730/9000 rss=412M
T+3:50:30 diag.heartbeat ... stage=source step=table progress=4732/9000 rss=413M
T+3:51:00 diag.heartbeat ... stage=source step=table progress=4734/9000 rss=414M
```

It's making progress — slowly. We point them at the source's per-entity duration to identify which kind of table is slow. **No "kill and rerun" needed.**

---

## 12. Tradeoffs accepted

1. **First occurrence of a non-reproducing hang on INFO will be undiagnosed.** Mitigated by flipping the workflow's log level and re-running. One redeploy cycle on first occurrence, never afterward.
2. **DEBUG runs emit more output** (heartbeat every 30 s + HTTP per-request lines). Acceptable — DEBUG is opt-in for investigation.
3. **No external knobs for thresholds.** If 60 s / 300 s / 30 s prove wrong, we change them in code. We are explicitly trading user-tunability for fewer config knobs.
4. **Native code in C extensions is captured only via `faulthandler` thread dumps, not the operation registry.** Sufficient for identifying *where* a hang is; not for labeling what the C code is doing semantically.
5. **`gc.get_objects()` is moderately expensive** (10s of ms on processes with millions of objects). We only call it on dump, not heartbeat.

---

## 13. Open questions

1. **Argo emissary at PID 1.** In Argo workflow pods, the Python process is not PID 1. `kill -SIGUSR1 1` would signal the emissary, not Python. Use `pkill -SIGUSR1 -f python.*main.py` instead. Document this in operator-facing notes.
2. **Should heartbeat be at INFO level (visible by default) or DEBUG-only?** Leaning toward "INFO when diagnostics is installed" — once an operator opted into DEBUG to install us, heartbeats are exactly what they want to see.
3. **Should the operation registry also record args for the connector's `_iter` calls?** Probably not — those args can be arbitrarily large (Table objects, schemas). Stick to `entity_fqn` only.
4. **Auto-dump on `MemoryError` exception?** Lean yes — extremely cheap to wire and exactly the moment we want a snapshot. To be decided in PR 3.
5. **Disk-persisted dump location.** `/tmp/openmetadata-diag-<pid>.log` is the default; users with custom log volume mounts may want a different path. Reasonable to make this one a hardcoded constant for now; revisit if customer asks.

---

## 14. Anti-patterns this design explicitly rejects

To stay honest, here is what we are NOT building and why:

| Tempting feature | Rejected because |
|---|---|
| New env var to toggle diagnostics | Invisible to remote-deployed customers; needs pod redeploy to change |
| New ingestion config field for diagnostics | Permanent surface area for something almost no customer should touch; reuse `loggerLevel` |
| Periodic remote shipping of diagnostic state | Would re-create the streamable_logger failure mode (handler-on-itself recursion). All output stays local. |
| A web dashboard / sidecar | Far more complex than needed; `kubectl logs` already exists |
| Full APM instrumentation (every function call traced) | Overhead; not necessary for the hangs/OOMs we actually see |
| Optional drop-in flame graph generator | Different problem space (CPU profiling); see `py-spy record` for that |

The principle throughout: **minimum new surface, maximum information per line of log output.**
