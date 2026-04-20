# Server-Side Diagnostics & Load Test Correlation

The diagnostics endpoint (`GET /api/v1/system/diagnostics`) provides a single-call performance snapshot of the OpenMetadata server. Combined with the load test script, it enables pinpointing **where** time is spent during high-load scenarios and produces actionable tuning recommendations.

## The Diagnostics Endpoint

### Basic Usage

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8585/api/v1/system/diagnostics | python3 -m json.tool
```

### Response Structure

```json
{
  "timestamp": "2026-03-02T19:00:00Z",
  "jvm": { ... },
  "jetty": { ... },
  "database": { ... },
  "database_queries": { ... },
  "bulk_executor": { ... },
  "request_latency": { ... }
}
```

Each section is explained below.

---

## Understanding Each Section

### JVM

| Field | What It Tells You |
|-------|-------------------|
| `heap_used_bytes` / `heap_max_bytes` | Current heap consumption vs maximum. |
| `heap_usage_pct` | If >85% after load, GC pressure is likely adding tail latency. |
| `gc_pause_total_ms` | Cumulative GC pause time since JVM start. Compare before/after load to see how much GC occurred during the test. |
| `gc_count` | Total GC collections. A large delta during load means frequent stop-the-world pauses. |
| `thread_count` / `thread_peak` | Active JVM threads. Correlate with Jetty thread pool. |
| `cpu_process_pct` | Process CPU utilization (0-100). If pinned at 100%, the server is CPU-bound. |
| `uptime_seconds` | Useful to confirm the server wasn't restarted mid-test. |

### Jetty (Thread Pool)

| Field | What It Tells You |
|-------|-------------------|
| `threads_busy` / `threads_max` | How many request-handling threads are in use. |
| `utilization_pct` | **Key metric.** If >90% with `queue_size > 0`, the thread pool is saturated and requests are queuing. |
| `queue_size` | Requests waiting for a free thread. Non-zero means latency is being added by queuing. |
| `queue_time_avg_ms` | Average time a request waits in the queue before getting a thread. |
| `virtual_threads_enabled` | Whether Java 21 virtual threads are active (eliminates thread pool as a bottleneck). |

### Database (HikariCP Pool)

| Field | What It Tells You |
|-------|-------------------|
| `pool_active` / `pool_max` | Active DB connections vs maximum pool size. |
| `pool_usage_pct` | **Key metric.** If >80%, connection contention is likely. Requests wait for a free connection. |
| `pool_pending` | Threads waiting for a DB connection. If >0 during load, the pool is undersized. |
| `pool_idle` | Spare connections. If 0 during load, the pool is fully utilized. |
| `connection_acquire_avg_ms` | Average time to acquire a connection from the pool. High values (>50ms) indicate pool contention. |
| `connection_acquire_max_ms` | Maximum connection acquire time observed. |
| `connection_acquire_count` | Total number of connection acquire operations. |

### Database Queries (Per-Type Profiling)

Breaks down DB query timing by operation type (select, insert, update, delete):

| Field | What It Tells You |
|-------|-------------------|
| `total_operations` | Sum of all DB operations across all types. |
| `{type}.count` | Number of queries of this type. |
| `{type}.mean_ms` | Average query duration. |
| `{type}.max_ms` | Maximum query duration. Spikes indicate lock contention or full table scans. |
| `{type}.p95_ms` | 95th percentile query duration. If >100ms, investigate slow queries. |
| `{type}.total_ms` | Total cumulative time spent in queries of this type. |

**Reading the profile:** If `select.p95_ms` is 200ms while `insert.p95_ms` is only 20ms, read queries are the bottleneck. This often indicates missing indexes or N+1 query patterns.

### Bulk Executor

| Field | What It Tells You |
|-------|-------------------|
| `queue_depth` / `queue_capacity` | Items in the async processing queue. |
| `queue_usage_pct` | If >70%, approaching the rejection threshold (HTTP 503 errors). |
| `active_threads` / `max_threads` | Worker threads actively processing bulk operations. |
| `has_capacity` | `false` means the next bulk submission will be rejected with 503. |

### Request Latency (Per-Endpoint Breakdown)

This is the most actionable section. For each `METHOD /endpoint` combination:

| Field | What It Tells You |
|-------|-------------------|
| `count` | Total requests processed for this endpoint. |
| `avg_total_ms` | Average end-to-end latency. |
| `avg_db_ms` / `db_pct` | Time spent in database queries and its percentage of total. |
| `avg_search_ms` / `search_pct` | Time spent in search/Elasticsearch operations. |
| `avg_internal_ms` / `internal_pct` | Time in Java code (serialization, validation, business logic). |
| `avg_db_ops` / `avg_search_ops` | Average number of DB/search round-trips per request. |

**Reading the breakdown:** If `PUT /v1/tables` shows `db_pct: 56%`, then 56% of the request time is spent waiting for database queries. Combined with `database.pool_usage_pct: 85%`, this tells you the DB connection pool is the bottleneck.

---

## Load Test Integration

The load test script automatically queries the diagnostics endpoint at three points:

1. **Before load** — baseline snapshot
2. **During load** — sampled every 10 seconds by the health monitor
3. **After load** — final snapshot for comparison

### Running a Load Test with Diagnostics

```bash
# Basic: diagnostics are collected automatically
./perf-test.sh --scale small --server http://localhost:8585 --admin-port 8586

# With explicit token
./perf-test.sh --scale medium --server http://localhost:8585 \
  --admin-port 8586 --token "$MY_TOKEN" --output /tmp/bench.json
```

The `--admin-port` flag enables both Prometheus scraping and diagnostics collection. Diagnostics work without it too (they use the main API port).

### Console Output

After the benchmark table, you'll see a `SERVER-SIDE BREAKDOWN` section:

```
SERVER-SIDE BREAKDOWN (from /api/v1/system/diagnostics):
  JVM:  heap 1.2GB/2GB (60%), GC pauses +450ms during load
  Jetty: 142/150 threads busy (95%), queue depth: 23
  DB Pool: 85/100 active (85%), 12 pending connections
  Bulk Executor: queue 450/1000 (45%)

  Latency Breakdown (PUT endpoints):
    Endpoint                          Total    DB%   Search%   Internal%
    /v1/tables                        320ms   56.2%     14.1%      29.7%
    /v1/topics                        180ms   48.0%     22.0%      30.0%
    /v1/dashboards                    250ms   52.0%     18.0%      30.0%

  BOTTLENECK: DB bottleneck on PUT /v1/tables: 56.2% of request time in DB, pool at 85.0% utilization
```

### JSON Report

The report includes top-level `diagnostics_before` and `diagnostics_after` objects, plus `cluster_sizing.server_side_analysis`:

```bash
cat /tmp/bench.json | python3 -c "
import json, sys
r = json.load(sys.stdin)

# Check if diagnostics were available
diag = r.get('diagnostics_after', {})
if diag:
    jvm = diag['jvm']
    print(f'Heap: {jvm[\"heap_usage_pct\"]}%')
    print(f'GC pauses: {jvm[\"gc_pause_total_ms\"]}ms')

    jetty = diag['jetty']
    print(f'Jetty: {jetty[\"threads_busy\"]}/{jetty[\"threads_max\"]} ({jetty[\"utilization_pct\"]}%)')

    db = diag['database']
    print(f'DB pool: {db[\"pool_active\"]}/{db[\"pool_max\"]} ({db[\"pool_usage_pct\"]}%)')

    for ep, data in diag.get('request_latency', {}).items():
        print(f'{ep}: total={data[\"avg_total_ms\"]}ms '
              f'DB={data[\"db_pct\"]}% Search={data[\"search_pct\"]}% '
              f'Internal={data[\"internal_pct\"]}%')
else:
    print('Diagnostics not available (server may be older version)')
"
```

---

## Bottleneck Detection Rules

The load test applies these rules automatically and surfaces them in findings:

| Condition | Diagnosis | Recommended Fix |
|-----------|-----------|-----------------|
| `db_pct > 60%` AND `pool_usage_pct > 80%` | DB is the bottleneck | `export DB_CONNECTION_POOL_MAX_SIZE=150` |
| `jetty.utilization_pct > 90%` AND `queue_size > 0` | Thread pool saturated | `export SERVER_MAX_THREADS=300` or enable virtual threads |
| `search_pct > 30%` for any endpoint | Search indexing consuming latency | `export ELASTICSEARCH_MAX_CONN_TOTAL=50` |
| `bulk_executor.queue_usage_pct > 70%` | Near bulk rejection threshold | `export BULK_OPERATION_QUEUE_SIZE=2000` |
| `jvm.heap_usage_pct > 85%` after load | Memory pressure / GC tail latency | Increase JVM heap (`-Xmx`) |
| `database_queries.{type}.p95_ms > 100ms` | Slow DB queries of that type | Add indexes, optimize queries |
| `connection_acquire_avg_ms > 50ms` | Connection pool contention | `export DB_CONNECTION_POOL_MAX_SIZE=150` |

---

## Common Scenarios

### Scenario 1: High Latency, DB is the Bottleneck

**Symptoms:** p95 latency >2s, `db_pct` >60%, `pool_usage_pct` >80%.

```
  Latency Breakdown:
    /v1/tables   320ms   DB=62%   Search=12%   Internal=26%
  DB Pool: 95/100 active (95%), 8 pending
```

**What's happening:** Every PUT requires multiple DB round-trips. At 95% pool utilization with 8 pending connections, requests are waiting for a free connection.

**Fix:**
```bash
export DB_CONNECTION_POOL_MAX_SIZE=150
export DB_CONNECTION_TIMEOUT=10000   # Fail fast instead of waiting 30s
```

### Scenario 2: Thread Pool Exhaustion

**Symptoms:** Connection refused errors, `utilization_pct` >95%, `queue_size` growing.

```
  Jetty: 148/150 threads busy (99%), queue depth: 45
```

**What's happening:** All Jetty threads are busy. New requests queue up, adding latency. If the queue fills, connections get refused.

**Fix:**
```bash
export SERVER_MAX_THREADS=300
# OR enable virtual threads (preferred for I/O-bound workloads):
export SERVER_ENABLE_VIRTUAL_THREAD=true
```

### Scenario 3: GC Pressure

**Symptoms:** Periodic latency spikes, `heap_usage_pct` >85%, large GC pause delta.

```
  JVM: heap 1.8GB/2GB (90%), GC pauses +2300ms during load
```

**What's happening:** The JVM is spending significant time in garbage collection. This manifests as periodic latency spikes and throughput drops.

**Fix:**
```bash
# Increase heap
export OPENMETADATA_HEAP_OPTS="-Xmx4g -Xms4g"
```

### Scenario 4: Bulk Executor Queue Filling

**Symptoms:** HTTP 503 errors on PUT endpoints.

```
  Bulk Executor: queue 980/1000 (98%)
  has_capacity: false
```

**What's happening:** The async processing queue is full. New requests that need bulk processing are rejected with 503.

**Fix:**
```bash
export BULK_OPERATION_QUEUE_SIZE=2000
export BULK_OPERATION_MAX_THREADS=20
```

### Scenario 5: Slow DB Queries

**Symptoms:** High p95 latency, `database_queries.select.p95_ms` >100ms, `db_pct` >60%.

```
  DB Query Profile (total operations: 125,000):
    Type         Count       Mean        Max
    select      80,000     12.3ms    450.0ms
    insert      40,000     25.1ms    890.0ms
  Connection acquire avg: 85.2ms
```

**What's happening:** Individual DB queries are slow (p95 >100ms) and connection acquire time is elevated, indicating both query performance issues and pool contention.

**Fix:**
```bash
# Increase pool size to reduce acquire contention
export DB_CONNECTION_POOL_MAX_SIZE=150
# Reduce connection timeout to fail fast
export DB_CONNECTION_TIMEOUT=10000
# Consider adding database indexes for slow SELECT queries
```

---

## Comparing Before/After Snapshots

The most valuable analysis comes from comparing diagnostics before and after load:

| Metric | Before | After | Interpretation |
|--------|--------|-------|----------------|
| `heap_usage_pct` | 25% | 85% | Significant memory allocation during load |
| `gc_pause_total_ms` | 200 | 2500 | 2.3s of GC pauses during the test |
| `pool_active` | 2 | 95 | Pool went from idle to near-max |
| `pool_pending` | 0 | 8 | Connection contention appeared |
| `queue_depth` | 0 | 450 | Bulk queue built up under load |

If the `diagnostics_during` samples are available in the health monitor data, you can plot these metrics over time to see exactly when bottlenecks emerged.

---

## Graceful Fallback

If the server doesn't have the diagnostics endpoint (older version), the load test:
- Prints a notice: `Diagnostics endpoint returned status=404 (may not be available)`
- Falls back to Prometheus scraping (if `--admin-port` is set)
- Skips the `SERVER-SIDE BREAKDOWN` section in the console output
- Omits `diagnostics_before`/`diagnostics_after` from the JSON report

No hard dependency — the load test works with or without it.
