# Redshift Connection Pooling Guide

## Overview

Connection pooling allows the Redshift ingestion connector to maintain multiple concurrent database connections, enabling parallel query execution. This can improve performance when:
- Multiple worker threads need to query Redshift simultaneously
- The bottleneck is connection establishment rather than query execution
- Redshift can handle increased concurrent connection load

## Important: When Connection Pooling Helps

### Current Bottleneck Analysis

Based on testing with 10K+ tables:
- **Baseline (sequential)**: 28m 16.75s
- **With 2 async workers + two-phase lifecycle**: 11m 42.82s (59% improvement)
- **Bottleneck**: Redshift query execution time, not Python connection handling

**Connection pooling works WHEN**:
- SQLAlchemy's existing pool (default: 5 connections, unlimited overflow) is exhausted
- Multiple queries wait for available connections
- Redshift can handle more concurrent queries without slowing down

**Connection pooling DOES NOT help WHEN**:
- Redshift itself is slow to execute queries (current situation)
- Workers are idle waiting for query results
- Increasing connections just means more queries waiting in Redshift's queue

### Use Cases

✅ **Connection pooling is beneficial when**:
1. You see logs like "Timed out waiting for connection from pool"
2. Workers idle with no active SQL queries
3. Redshift has spare capacity (check cluster metrics)
4. Running incremental ingestion with fewer tables

❌ **Connection pooling will NOT help when**:
1. Redshift queries take a long time to execute
2. Workers actively waiting for query results
3. Redshift cluster is at capacity
4. Bottleneck is data processing, not connection handling

## Configuration

Connection pooling is configured via `connectionArguments` in the Redshift connection configuration:

```yaml
source:
  type: redshift
  serviceName: redshift-service-name
  serviceConnection:
    config:
      type: Redshift
      hostPort: your-redshift-cluster.region.redshift.amazonaws.com:5439
      username: your_username
      password: your_password
      database: your_database
      connectionArguments:
        # Connection Pooling Configuration
        pool_size: 10              # Number of persistent connections (default: 5)
        max_overflow: 20           # Additional temporary connections (default: 10)
        pool_timeout: 60           # Wait up to 60 seconds for available connection (default: 30)
        pool_recycle: 3600         # Recycle connections after 1 hour (default: 3600)
        pool_pre_ping: true        # Test connections before using them (default: True)
```

### Parameters Explained

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pool_size` | int | 5 | Number of persistent connections maintained in the pool. These connections stay open and are reused. |
| `max_overflow` | int | 10 | Maximum number of additional temporary connections that can be created beyond `pool_size` when all persistent connections are in use. |
| `pool_timeout` | int | 30 | Seconds to wait for an available connection before timing out. |
| `pool_recycle` | int | 3600 | Seconds before a connection is recycled (closed and reopened). Prevents using stale connections. |
| `pool_pre_ping` | bool | True | Test each connection with a simple query before using it to detect dead connections. |

### Total Connections

**Maximum concurrent connections** = `pool_size` + `max_overflow`

Example:
- `pool_size: 10` + `max_overflow: 20` = **up to 30 concurrent connections**

## Performance Tuning

### Conservative Settings (Start Here)

```yaml
connectionArguments:
  pool_size: 10              # 2x default
  max_overflow: 20           # 2x default
  pool_timeout: 60           # 2x default
  pool_recycle: 3600         # Default (1 hour)
  pool_pre_ping: true        # Recommended
```

**When to use**: Testing connection pooling for the first time.

### Aggressive Settings (High Concurrency)

```yaml
connectionArguments:
  pool_size: 20              # 4x default
  max_overflow: 30           # 3x default
  pool_timeout: 90           # 3x default
  pool_recycle: 1800         # 30 minutes (more aggressive recycling)
  pool_pre_ping: true        # Recommended
```

**When to use**: When you have confirmed Redshift can handle more concurrent connections and you're processing large datasets with many worker threads.

### Minimal Settings (Reduce Overhead)

```yaml
connectionArguments:
  pool_size: 5               # Default
  max_overflow: 5            # Reduced
  pool_timeout: 30           # Default
  pool_recycle: 7200         # 2 hours
  pool_pre_ping: false       # Skip pre-ping checks
```

**When to use**: When connection overhead is minimal and you want to reduce pre-ping checks.

## Monitoring

### Check if Pooling is Working

Look for this log message at startup:
```
Redshift connection pooling configured: {'pool_size': 10, 'max_overflow': 20, 'pool_timeout': 60, 'pool_recycle': 3600, 'pool_pre_ping': True}
```

### Monitor Redshift Connections

Check active connections in Redshift:
```sql
SELECT
    COUNT(*) as connection_count,
    db_name,
    user_name
FROM pg_stat_activity
WHERE db_name = 'your_database'
GROUP BY db_name, user_name;
```

### Signs of Connection Exhaustion

Watch for these in logs:
- `TimeoutError: QueuePool limit of size X overflow Y reached`
- `Timed out waiting for connection from pool`
- Workers idle with no active queries

## Redshift Cluster Limits

### Check Your Limits

```sql
-- Check maximum connections
SHOW max_connections;

-- Check current connections
SELECT COUNT(*) FROM pg_stat_activity;
```

### Typical Limits

| Cluster Type | max_connections |
|--------------|-----------------|
| dc2.large | 200 |
| dc2.8xlarge | 2000 |
| ra3.xlplus | 500 |
| ra3.4xlarge | 1500 |
| ra3.16xlarge | 3000 |

**Important**: Leave headroom for:
- Other applications connecting to Redshift
- Redshift system processes
- OpenMetadata UI queries

## Example: Full Configuration

```yaml
source:
  type: redshift
  serviceName: redshift-optimized-service
  serviceConnection:
    config:
      type: Redshift
      hostPort: my-cluster.us-east-2.redshift.amazonaws.com:5439
      username: openmetadata
      password: ${REDSHIFT_PASSWORD}
      database: dev
      connectionArguments:
        # Connection pooling for parallel query execution
        pool_size: 10
        max_overflow: 20
        pool_timeout: 60
        pool_recycle: 3600
        pool_pre_ping: true
  sourceConfig:
    config:
      type: DatabaseMetadata
      includeViews: true
      includeTables: true

sink:
  type: metadata-rest
  config:
    api_endpoint: null
    bulk_sink_batch_size: 100    # Bulk API batching
    async_pipeline_workers: 2     # Async workers for parallel processing

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: ${OM_JWT_TOKEN}
```

## Troubleshooting

### Problem: Timeout Errors

```
TimeoutError: QueuePool limit of size 10 overflow 20 reached
```

**Solution**: Increase `pool_size` or `max_overflow`:
```yaml
connectionArguments:
  pool_size: 20          # Increased from 10
  max_overflow: 30       # Increased from 20
```

### Problem: Connection Refused

```
OperationalError: connection refused
```

**Possible causes**:
1. Exceeded Redshift's `max_connections`
2. Network/firewall issues
3. Redshift cluster paused or unreachable

**Solution**: Check Redshift cluster status and reduce connections:
```yaml
connectionArguments:
  pool_size: 5
  max_overflow: 5
```

### Problem: Stale Connections

```
OperationalError: server closed the connection unexpectedly
```

**Solution**: Enable `pool_pre_ping` and reduce `pool_recycle`:
```yaml
connectionArguments:
  pool_recycle: 1800     # 30 minutes instead of 1 hour
  pool_pre_ping: true    # Test connections before use
```

### Problem: No Performance Improvement

**Diagnosis**:
1. Check if connections are being used: Query `pg_stat_activity`
2. Monitor worker threads: Are they idle or actively processing?
3. Check Redshift query execution time: Is Redshift the bottleneck?

**Solution**: Connection pooling may not help if:
- Redshift is slow to execute queries (tune Redshift instead)
- Extraction/processing is the bottleneck (optimize Python code)
- Only 1-2 workers active (increase async_pipeline_workers first)

## Best Practices

1. **Start Conservative**: Begin with `pool_size: 10`, `max_overflow: 20`
2. **Monitor First**: Watch Redshift connection count and query performance
3. **Increase Gradually**: If seeing connection timeouts, increase pool settings
4. **Check Redshift Capacity**: Ensure cluster can handle additional connections
5. **Combine with Other Optimizations**: Use with bulk API and async workers for best results
6. **Enable Pre-Ping**: Always use `pool_pre_ping: true` in production
7. **Set Pool Recycle**: Prevent stale connections with reasonable `pool_recycle` value

## Further Optimizations

If connection pooling alone doesn't provide enough performance gain, consider:

1. **Incremental Ingestion**: Only extract changed tables
   ```yaml
   sourceConfig:
     config:
       incrementalMetadataExtractionConfiguration:
         enabled: true
         lookbackDays: 1
   ```

2. **Schema Filtering**: Process only specific schemas
   ```yaml
   sourceConfig:
     config:
       schemaFilterPattern:
         includes:
           - public
           - analytics
   ```

3. **Parallel Schema Processing**: Process multiple schemas concurrently (future feature)

4. **Redshift Performance Tuning**:
   - Add indexes on frequently queried columns
   - Optimize table distribution keys and sort keys
   - Increase Redshift cluster size if consistently at capacity

---

**Author**: Claude Code
**Date**: November 1, 2025
**Status**: ✅ Implemented & Documented
