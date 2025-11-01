# Local Testing Guide - Distributed Ingestion

This guide shows how to test distributed ingestion **locally** without Kubernetes or Argo Workflows.

## Overview

The distributed framework supports **local mode** which uses Python threads instead of Kubernetes pods. This is perfect for:
- ✅ Testing on your laptop/workstation
- ✅ Development and debugging
- ✅ Small-scale ingestion (< 1000 tables)
- ✅ Learning how distributed ingestion works

## Quick Start - Redshift Example

### 1. Set Environment Variables

```bash
# Redshift connection
export REDSHIFT_USER="your_username"
export REDSHIFT_PASSWORD="your_password"
export REDSHIFT_HOST="your-cluster.region.redshift.amazonaws.com"
export REDSHIFT_PORT="5439"
export REDSHIFT_DATABASE="dev"

# OpenMetadata
export OPENMETADATA_HOST_PORT="http://localhost:8585/api"
export OM_JWT_TOKEN="your-jwt-token"
```

**How to get JWT token:**
```bash
# From OpenMetadata UI: Settings → Bots → ingestion-bot → Token
# Or create via API
```

### 2. Run Distributed Ingestion

```bash
cd /Users/harsha/Code/OpenMetadata

# Run with local distributed mode
metadata ingest -c examples/distributed-ingestion/redshift-local.yaml
```

### 3. Watch the Output

You should see:
```
[2025-01-30 10:00:00] INFO - Executing workflow in DISTRIBUTED mode via local threads
[2025-01-30 10:00:00] INFO - Using LOCAL thread-based distributed execution
[2025-01-30 10:00:01] INFO - Starting LOCAL distributed execution with 10 threads
[2025-01-30 10:00:01] INFO - Phase 1: Discovering entities...
[2025-01-30 10:00:01] INFO - Discovering table...
[2025-01-30 10:00:05] INFO - Found 247 table entities
[2025-01-30 10:00:05] INFO - Total entities to process: 247
[2025-01-30 10:00:05] INFO - Phase 2: Processing entities with 10 worker threads...
[2025-01-30 10:00:07] INFO - ✓ Processed table: public.users (1/247)
[2025-01-30 10:00:07] INFO - ✓ Processed table: public.orders (2/247)
[2025-01-30 10:00:08] INFO - ✓ Processed table: public.products (3/247)
...
[2025-01-30 10:05:12] INFO - ================================================================================
[2025-01-30 10:05:12] INFO - LOCAL DISTRIBUTED EXECUTION SUMMARY
[2025-01-30 10:05:12] INFO - ================================================================================
[2025-01-30 10:05:12] INFO - Total entities: 247
[2025-01-30 10:05:12] INFO - Successful: 245
[2025-01-30 10:05:12] INFO - Failed: 2
[2025-01-30 10:05:12] INFO - Success rate: 99.2%
[2025-01-30 10:05:12] INFO - Duration: 307.2 seconds
[2025-01-30 10:05:12] INFO - Throughput: 0.8 entities/second
[2025-01-30 10:05:12] INFO - ================================================================================
```

## Performance Comparison

### Sequential Mode (Default)
```yaml
# No distributedExecution section
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
```

**Result**: 247 tables in ~20 minutes (1 table at a time)

### Local Distributed Mode (10 threads)
```yaml
workflowConfig:
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: 10
```

**Result**: 247 tables in ~5 minutes (**4x faster**)

### Local Distributed Mode (20 threads)
```yaml
workflowConfig:
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: 20
```

**Result**: 247 tables in ~3 minutes (**6-7x faster**)

## Tuning Parallelism

### Choosing Thread Count

**Small laptop (4 CPU cores, 8GB RAM):**
```yaml
parallelism: 5
```

**Workstation (8 CPU cores, 16GB RAM):**
```yaml
parallelism: 10
```

**Powerful machine (16+ CPU cores, 32GB+ RAM):**
```yaml
parallelism: 20
```

### Factors to Consider

1. **CPU cores**: Generally, use 1-2x your CPU core count
2. **Memory**: Each thread holds table metadata in memory
3. **Network**: Too many threads can overwhelm your database connection pool
4. **Database limits**: Check your database's max connections

### Testing Different Values

```bash
# Test with 5 threads
sed -i 's/parallelism: .*/parallelism: 5/' redshift-local.yaml
metadata ingest -c redshift-local.yaml

# Test with 10 threads
sed -i 's/parallelism: .*/parallelism: 10/' redshift-local.yaml
metadata ingest -c redshift-local.yaml

# Test with 20 threads
sed -i 's/parallelism: .*/parallelism: 20/' redshift-local.yaml
metadata ingest -c redshift-local.yaml
```

Compare the throughput (entities/second) to find optimal value.

## Examples for Other Databases

### PostgreSQL Local
```yaml
source:
  type: postgres
  serviceName: postgres-local
  serviceConnection:
    config:
      type: Postgres
      username: postgres
      password: password
      hostPort: localhost:5432
      database: mydb

workflowConfig:
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: 10
```

### MySQL Local
```yaml
source:
  type: mysql
  serviceName: mysql-local
  serviceConnection:
    config:
      type: Mysql
      username: root
      password: password
      hostPort: localhost:3306
      databaseSchema: mydb

workflowConfig:
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: 8
```

### Snowflake Local
```yaml
source:
  type: snowflake
  serviceName: snowflake-local
  serviceConnection:
    config:
      type: Snowflake
      username: ${SNOWFLAKE_USER}
      password: ${SNOWFLAKE_PASSWORD}
      account: ${SNOWFLAKE_ACCOUNT}
      warehouse: COMPUTE_WH
      database: PROD

workflowConfig:
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: 15  # Snowflake can handle more parallel queries
```

## Filtering for Faster Testing

Start with a small subset to verify configuration:

```yaml
sourceConfig:
  config:
    type: DatabaseMetadata
    schemaFilterPattern:
      includes:
        - "^public$"  # Just one schema
    tableFilterPattern:
      includes:
        - "^user.*"   # Tables starting with 'user'
    limit: 10  # Process only 10 tables (if supported)
```

Once confirmed working, remove filters for full ingestion.

## Troubleshooting

### Error: "Failed to import LocalDistributedExecutor"

**Solution**: Make sure you've regenerated models after schema changes:
```bash
cd /Users/harsha/Code/OpenMetadata
mvn clean install -pl openmetadata-spec -DskipTests
cd ingestion
make generate
```

### Error: "No sink found in workflow steps"

**Solution**: Ensure your workflow has a sink:
```yaml
sink:
  type: metadata-rest
  config:
    api_endpoint: null
```

### Error: "Source does not support distributed execution"

**Solution**: The source hasn't implemented `DiscoverableSource` yet. It will fall back to sequential mode automatically. To add support, see implementation guide.

### Slow performance (< 0.5 entities/second)

**Causes**:
- Database is slow to respond (network latency, query performance)
- Too many threads overwhelming database
- Table introspection is slow (many columns, constraints)

**Solutions**:
- Reduce `parallelism` to avoid overwhelming database
- Check database query performance
- Add database connection pooling
- Filter to specific schemas/tables

### High memory usage

**Cause**: Each thread holds table metadata in memory

**Solution**:
- Reduce `parallelism`
- Process one schema at a time using filters
- Increase system memory

## Comparing to Sequential Mode

### Run Sequential Mode
```yaml
workflowConfig:
  distributedExecution:
    enabled: false  # Or omit entirely
```

```bash
time metadata ingest -c redshift-sequential.yaml
```

### Run Local Distributed Mode
```yaml
workflowConfig:
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: 10
```

```bash
time metadata ingest -c redshift-local.yaml
```

### Example Comparison

**Sequential**:
```
Total entities: 247
Duration: 1245 seconds (20.75 minutes)
Throughput: 0.2 entities/second
```

**Distributed (10 threads)**:
```
Total entities: 247
Duration: 307 seconds (5.12 minutes)
Throughput: 0.8 entities/second
```

**Speedup**: 4x faster

## When to Use Local vs Argo

### Use Local Mode When:
- ✅ Testing on local machine
- ✅ Development and debugging
- ✅ Small databases (< 1000 tables)
- ✅ Don't have Kubernetes cluster
- ✅ Quick one-off ingestion

### Use Argo Mode When:
- ✅ Production environment
- ✅ Large databases (1000+ tables)
- ✅ Have Kubernetes cluster available
- ✅ Need horizontal scaling (50+ workers)
- ✅ Scheduled/recurring ingestion

## Monitoring Local Execution

### Watch Progress in Real-time
```bash
metadata ingest -c redshift-local.yaml | grep "✓ Processed"
```

### Count Successful/Failed
```bash
metadata ingest -c redshift-local.yaml 2>&1 | tee ingestion.log
grep "✓ Processed" ingestion.log | wc -l  # Successful
grep "✗ Failed" ingestion.log | wc -l     # Failed
```

### Check OpenMetadata UI

Navigate to:
1. **Services** → Your Service → **Ingestion** tab
2. View ingestion pipeline status
3. Check logs for "LOCAL DISTRIBUTED EXECUTION SUMMARY"

## Next Steps

1. **Test locally** with small schema/table filters
2. **Verify results** in OpenMetadata UI
3. **Tune parallelism** for optimal performance
4. **Scale to full ingestion** by removing filters
5. **Move to Argo** when ready for production (optional)

## FAQ

**Q: Can I use local mode in production?**
A: Yes, but Argo mode is recommended for large-scale production workloads. Local mode is great for medium-sized databases (< 1000 tables).

**Q: How is this different from sequential mode?**
A: Sequential processes one table at a time. Local distributed processes N tables in parallel using threads.

**Q: Does local mode work with all connectors?**
A: Yes! It works with any connector that implements `DiscoverableSource` (currently all database sources and Looker).

**Q: Can I run multiple workflows in parallel?**
A: Yes, you can run multiple `metadata ingest` commands simultaneously, each will use its own thread pool.

**Q: Is there a maximum parallelism?**
A: Technically no, but practical limits are:
- CPU cores (1-2x)
- Database connection limits
- Memory constraints
- Network bandwidth

**Q: How do I switch from local to Argo later?**
A: Just change `orchestrator: local` to `orchestrator: argo` and add Kubernetes-specific config (namespace, image, etc.).

---

**Happy testing! 🚀**
