# OpenMetadata Cluster Sizing Runbook

This runbook walks through benchmarking an OpenMetadata cluster from 10K to 5M entities, identifying where performance breaks, and applying the right configuration for your target scale.

## Prerequisites

- OpenMetadata server running and accessible via HTTP
- Admin port exposed (optional, recommended for diagnostics — typically 8586)
- Python 3 installed on the benchmark host (for JSON parsing)
- `curl` and `bash` available
- Sufficient disk space for test data (each run generates JSON reports ~1-5MB)
- Network connectivity from benchmark host to server with low latency

## Quick Start

Run a full progressive benchmark with a single command:

```bash
cd bin/distributed-test
./scripts/benchmark-sizing.sh \
    --server http://your-server:8585 \
    --workers 30 \
    --ramp \
    --mixed \
    --output-dir ./sizing-results
```

This will:
1. Run a ramp test to find optimal concurrency
2. Loop through scales: 10k → 50k → 100k → 200k → 500k → ~2M → ~5M
3. At each scale, run both sequential and realistic modes
4. Stop automatically when a break-point is detected
5. Generate `SIZING-SUMMARY.md` with results and recommendations

## Step-by-Step Guide

### Step 1: Environment Setup

#### Option A: Point to existing server

```bash
# Verify connectivity
curl -s http://your-server:8585/api/v1/system/version | python3 -m json.tool
```

#### Option B: Start local distributed cluster

```bash
cd bin/distributed-test
./scripts/start.sh

# Servers will be available at:
#   Server 1: http://localhost:8585 (admin: 8586)
#   Server 2: http://localhost:8587 (admin: 8588)
#   Server 3: http://localhost:8589 (admin: 8590)
```

#### Note current configuration

Before benchmarking, record your current settings so you can compare before/after:

```bash
# Check server version
curl -s http://localhost:8585/api/v1/system/version

# If admin port is exposed, check diagnostics
curl -s http://localhost:8586/metrics | grep -E "jvm_memory|jetty_threads|hikari"
```

Key settings to note:
- JVM heap size (`-Xmx`)
- `SERVER_MAX_THREADS`
- `DB_CONNECTION_POOL_MAX_SIZE`
- `SERVER_ENABLE_VIRTUAL_THREAD`
- `BULK_OPERATION_QUEUE_SIZE`

### Step 2: Find Optimal Concurrency (Optional)

The ramp test progressively increases worker count to find the sweet spot between throughput and latency:

```bash
./scripts/perf-test.sh --ramp --scale 10k --workers 64 --admin-port 8586
```

**What to look for in ramp results:**

| Workers | RPS  | p95ms | Interpretation |
|---------|------|-------|----------------|
| 1-4     | Low  | Low   | Underutilizing server capacity |
| 8-16    | Peak | Low   | Sweet spot — use this worker count |
| 32+     | Flat | Rising | Server saturated — more workers hurt |

The ramp test output will suggest an `optimal_workers` value. Use it for subsequent runs.

### Step 3: Run Progressive Benchmark

#### Full run (recommended)

```bash
./scripts/benchmark-sizing.sh \
    --server http://localhost:8585 \
    --admin-port 8586 \
    --workers 30 \
    --ramp \
    --mixed \
    --mixed-duration 60 \
    --output-dir ./sizing-results
```

#### Quick 2-tier smoke test

```bash
./scripts/benchmark-sizing.sh \
    --server http://localhost:8585 \
    --start-scale 10k \
    --end-scale 50k \
    --output-dir /tmp/sizing-test
```

#### Sequential mode only (simpler, less contention)

```bash
./scripts/benchmark-sizing.sh \
    --server http://localhost:8585 \
    --modes seq \
    --end-scale 500k
```

#### Resume after failure

```bash
./scripts/benchmark-sizing.sh \
    --server http://localhost:8585 \
    --skip-existing \
    --output-dir ./sizing-results
```

#### What to expect at each scale tier

| Scale | Entities | Typical Duration | What It Tests |
|-------|----------|-----------------|---------------|
| 10k   | ~10,000  | 2-5 min         | Baseline — should pass easily |
| 50k   | ~50,000  | 5-15 min        | Small production workload |
| 100k  | ~100,000 | 10-30 min       | Medium production workload |
| 200k  | ~200,000 | 20-60 min       | Large production workload |
| 500k  | ~500,000 | 1-3 hours       | Enterprise scale — DB pool pressure |
| large | ~2,000,000 | 3-8 hours     | Large enterprise — thread/memory limits |
| xlarge | ~5,000,000 | 8-24 hours   | Extreme scale — full cluster stress |

#### Monitoring during benchmark

While the benchmark runs, monitor the server:

```bash
# Watch server logs for errors
docker logs -f openmetadata-server-1 2>&1 | grep -E "ERROR|WARN|OOM"

# Watch DB connection pool (if admin port exposed)
watch -n 5 'curl -s http://localhost:8586/metrics | grep hikari'

# Watch JVM heap
watch -n 5 'curl -s http://localhost:8586/metrics | grep "jvm_memory_bytes_used.*heap"'
```

### Step 4: Analyze Results

After the benchmark completes, open the generated summary:

```bash
cat ./sizing-results/SIZING-SUMMARY.md
```

#### Reading the Progressive Results table

```
| Scale | Mode       | Entities | RPS   | p95 (ms) | Errors % | Assessment |
|-------|------------|----------|-------|----------|----------|------------|
| 10k   | Sequential | 10234    | 456.2 | 312      | 0.05     | adequate   |
| 10k   | Realistic  | 10234    | 389.1 | 445      | 0.12     | adequate   |
| 50k   | Sequential | 50120    | 412.3 | 456      | 0.23     | adequate   |
| 50k   | Realistic  | 50120    | 312.4 | 890      | 1.45     | marginal   |
| 100k  | Realistic  | 98450    | 189.2 | 2345     | 12.3     | undersized |
```

Key columns:
- **RPS**: Higher is better. Watch for drops between tiers.
- **p95**: 95th percentile latency. Under 500ms is good, over 2000ms is concerning.
- **Errors %**: Under 1% is acceptable. Over 5% signals resource exhaustion.
- **Assessment**: `adequate` (good), `marginal` (tuning needed), `undersized` (upgrade needed).

#### Interpreting sequential vs realistic differences

- **Sequential** runs entity types one at a time — measures raw throughput per entity type
- **Realistic** runs all types concurrently — exposes cross-entity contention (DB locks, thread pool pressure)
- A large gap (>30% RPS drop or >2x p95 increase) in realistic mode indicates contention issues
- If sequential is fine but realistic breaks, focus on: DB pool size, thread count, bulk executor tuning

#### Understanding the break-point

The benchmark stops when it detects:
- Assessment = `undersized`
- Error rate > 10%
- p95 latency > 10 seconds
- Throughput per entity degraded >50% from previous tier

The tier just before the break-point is your current cluster's capacity ceiling.

#### Reading cluster_sizing recommendations

Each JSON report contains a `cluster_sizing` section with specific recommendations:

```bash
python3 -c "
import json
with open('./sizing-results/sizing-50k-realistic.json') as f:
    data = json.load(f)
for k, v in data['cluster_sizing']['recommendations'].items():
    if isinstance(v, dict) and 'recommended_env' in v:
        print(f\"{k}: {v['recommended_env']} (was: {v.get('current_env', 'unknown')})\")
"
```

### Step 5: Apply Recommendations

#### Configuration Matrix

| Parameter | Small (<50K) | Medium (50-200K) | Large (200K-2M) | XLarge (2-5M) |
|-----------|-------------|-------------------|-----------------|---------------|
| `SERVER_MAX_THREADS` | 150 | 300 | 500 | 750 |
| `SERVER_ENABLE_VIRTUAL_THREAD` | false | true | true | true |
| `DB_CONNECTION_POOL_MAX_SIZE` | 50 | 100 | 200 | 300 |
| `DB_CONNECTION_TIMEOUT` | 30000 | 30000 | 60000 | 60000 |
| `ELASTICSEARCH_MAX_CONN_TOTAL` | 50 | 100 | 200 | 300 |
| `BULK_OPERATION_QUEUE_SIZE` | 1000 | 2000 | 5000 | 10000 |
| `BULK_OPERATION_MAX_THREADS` | 10 | 20 | 30 | 50 |
| `SERVER_ACCEPT_QUEUE_SIZE` | 50 | 100 | 200 | 500 |
| JVM Heap (`-Xmx`) | 2G | 4G | 8G | 16G |

#### Applying changes

**Docker Compose:**

Add environment variables to your server service:

```yaml
environment:
  SERVER_MAX_THREADS: "300"
  SERVER_ENABLE_VIRTUAL_THREAD: "true"
  DB_CONNECTION_POOL_MAX_SIZE: "100"
  ELASTICSEARCH_MAX_CONN_TOTAL: "100"
  BULK_OPERATION_QUEUE_SIZE: "2000"
  BULK_OPERATION_MAX_THREADS: "20"
  JAVA_OPTS: "-Xmx4g -Xms4g"
```

**Kubernetes / Helm:**

```yaml
# values.yaml
openmetadata:
  config:
    serverMaxThreads: 300
    enableVirtualThread: true
    database:
      connectionPoolMaxSize: 100
      connectionTimeout: 30000
    elasticsearch:
      maxConnectionsTotal: 100
    bulkOperation:
      queueSize: 2000
      maxThreads: 20
  jvmOpts: "-Xmx4g -Xms4g"
```

**Bare metal / `openmetadata.yaml`:**

```yaml
server:
  applicationConnectors:
    - type: http
      port: 8585
      maxThreads: 300
  enableVirtualThread: true

database:
  hikariConfig:
    maximumPoolSize: 100
    connectionTimeout: 30000

elasticsearch:
  maxConnectionsTotal: 100
```

#### Verifying changes took effect

After restarting the server with new settings:

```bash
# Check via diagnostics endpoint
curl -s http://localhost:8585/api/v1/system/diagnostics | python3 -c "
import json, sys
d = json.load(sys.stdin)
j = d.get('jetty', {})
db = d.get('database', {})
print(f\"Jetty max threads: {j.get('threads_max', 'N/A')}\")
print(f\"DB pool max: {db.get('pool_max', 'N/A')}\")
print(f\"Virtual threads: {j.get('virtual_threads_enabled', 'N/A')}\")
"

# Check via Prometheus metrics (admin port)
curl -s http://localhost:8586/metrics | grep -E "jetty_threads_max|hikari.*max"
```

### Step 6: Re-validate

After applying configuration changes, re-run the benchmark at your target scale:

```bash
# Re-run just the tier that previously broke
./scripts/perf-test.sh \
    --scale 100k \
    --realistic \
    --mixed \
    --workers 30 \
    --admin-port 8586 \
    --output ./sizing-results/sizing-100k-realistic-tuned.json

# Or re-run the full progressive suite
./scripts/benchmark-sizing.sh \
    --server http://localhost:8585 \
    --admin-port 8586 \
    --output-dir ./sizing-results-tuned
```

Compare before/after:

```bash
# Side-by-side comparison
python3 -c "
import json
with open('./sizing-results/sizing-100k-realistic.json') as f:
    before = json.load(f)
with open('./sizing-results/sizing-100k-realistic-tuned.json') as f:
    after = json.load(f)

b = before['overall']
a = after['overall']
print(f\"{'Metric':<20} {'Before':>12} {'After':>12} {'Change':>12}\")
print('-' * 56)
for key in ['overall_throughput_rps', 'overall_error_rate_pct']:
    bv = b.get(key, 0)
    av = a.get(key, 0)
    diff = ((av - bv) / bv * 100) if bv > 0 else 0
    print(f\"{key:<20} {bv:>12.1f} {av:>12.1f} {diff:>+11.1f}%\")

print(f\"\nBefore: {before['cluster_sizing']['assessment']}\")
print(f\"After:  {after['cluster_sizing']['assessment']}\")
"
```

## Configuration Reference

| Parameter | Default | Description | When to Increase |
|-----------|---------|-------------|-----------------|
| `SERVER_MAX_THREADS` | 150 | Jetty HTTP thread pool | Jetty utilization >80% |
| `SERVER_ENABLE_VIRTUAL_THREAD` | false | Use JDK21 virtual threads | Always enable at >50K entities |
| `DB_CONNECTION_POOL_MAX_SIZE` | 50 | HikariCP max connections | DB pool utilization >70% or pending >0 |
| `DB_CONNECTION_TIMEOUT` | 30000 | Max wait for DB connection (ms) | Connection acquire timeouts |
| `ELASTICSEARCH_MAX_CONN_TOTAL` | 50 | Max HTTP connections to ES/OS | Search latency spikes |
| `BULK_OPERATION_QUEUE_SIZE` | 1000 | Async bulk operation queue depth | 503 "queue full" errors |
| `BULK_OPERATION_MAX_THREADS` | 10 | Worker threads for bulk ops | Queue filling up, low throughput |
| `SERVER_ACCEPT_QUEUE_SIZE` | 50 | TCP accept backlog | Connection refused under load |

## Interpreting Results

### Assessment Meanings

| Assessment | Meaning | Action |
|------------|---------|--------|
| `adequate` | Server handles this scale with acceptable latency and error rates | No changes needed |
| `marginal` | Performance is degrading — latency rising, some errors appearing | Tune configuration (Step 5) |
| `undersized` | Server cannot handle this scale — high errors, extreme latency | Upgrade resources or reduce scale target |

### Common Patterns and Fixes

| Pattern | Symptom | Fix |
|---------|---------|-----|
| DB pool exhaustion | p95 spikes, bimodal latency, pending connections >0 | Increase `DB_CONNECTION_POOL_MAX_SIZE` |
| Thread pool saturation | Jetty utilization >90%, queue depth growing | Increase `SERVER_MAX_THREADS`, enable virtual threads |
| Bulk executor overflow | 503 errors with "queue full" | Increase `BULK_OPERATION_QUEUE_SIZE` and `BULK_OPERATION_MAX_THREADS` |
| GC pressure | p99/p95 ratio >3x, periodic latency spikes | Increase heap, tune GC settings |
| Search bottleneck | High search latency in breakdown, low ES connection usage | Increase `ELASTICSEARCH_MAX_CONN_TOTAL` |
| Sequential OK, realistic broken | Performance fine per-type but breaks under mixed load | All of the above — concurrent load compounds contention |

### Sequential vs Realistic Differences

- **<10% RPS drop**: Excellent — server handles contention well
- **10-30% RPS drop**: Normal — some contention expected
- **30-50% RPS drop**: Concerning — review DB pool and thread settings
- **>50% RPS drop**: Critical contention — likely needs resource upgrades

## Troubleshooting

### Server OOM during benchmark

Symptoms: Server process killed, connection refused mid-run.

```bash
# Check if server was OOM-killed
docker logs openmetadata-server-1 2>&1 | tail -50
dmesg | grep -i "oom\|killed"

# Fix: Increase heap
# In docker-compose.yaml:
#   JAVA_OPTS: "-Xmx8g -Xms8g"
```

### Connection refused errors

Symptoms: Benchmark shows many `connection_error` entries.

```bash
# Check server is running
curl -s http://localhost:8585/api/v1/system/version

# Check accept queue
curl -s http://localhost:8586/metrics | grep "jetty_queued"

# Fix: Increase SERVER_ACCEPT_QUEUE_SIZE, check firewall rules
```

### Benchmark script hangs

Symptoms: No progress for >5 minutes.

```bash
# Check server health
curl -s http://localhost:8585/api/v1/system/version

# Check server thread dumps for deadlocks
curl -s http://localhost:8586/threads

# The script has a 60s per-request timeout; if the server is extremely slow
# but responsive, individual requests may be timing out and retrying
```

### How to resume after failure

The `--skip-existing` flag lets you resume:

```bash
# First, check what's already completed
ls -la ./sizing-results/sizing-*.json

# Resume from where it left off
./scripts/benchmark-sizing.sh \
    --skip-existing \
    --output-dir ./sizing-results
```

Individual tiers can also be re-run manually:

```bash
./scripts/perf-test.sh \
    --scale 100k \
    --realistic \
    --workers 30 \
    --output ./sizing-results/sizing-100k-realistic.json
```
