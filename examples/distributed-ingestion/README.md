# Distributed Ingestion Examples

This directory contains example workflow configurations for OpenMetadata's distributed ingestion framework.

## Overview

The distributed ingestion framework enables **40-50x speed improvements** by processing entities (tables, dashboards, etc.) in parallel across multiple Kubernetes pods using Argo Workflows.

### Performance Comparison

| Connector | Sequential Time | Distributed Time | Speedup | Parallelism |
|-----------|----------------|------------------|---------|-------------|
| Looker (2000 dashboards) | 20 hours | 25 minutes | 48x | 50 pods |
| Snowflake (10K tables) | 8 hours | 10 minutes | 48x | 100 pods |
| PostgreSQL (1K tables) | 1 hour | 2 minutes | 30x | 30 pods |

## Prerequisites

1. **Argo Workflows installed** in your Kubernetes cluster:
   ```bash
   kubectl create namespace argo
   kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/latest/download/install.yaml
   ```

2. **OpenMetadata running** and accessible from Kubernetes pods

3. **Service account** with permissions to create Argo Workflows:
   ```bash
   kubectl create serviceaccount openmetadata-ingestion -n openmetadata
   ```

## Quick Start

### Local Testing (No Kubernetes Required)

**Perfect for testing on your laptop:**
- `redshift-local.yaml` - Redshift with local thread-based execution
- `postgres-local.yaml` - PostgreSQL with local threads
- See **[LOCAL_TESTING.md](LOCAL_TESTING.md)** for complete guide

### Production (Kubernetes/Argo)

**For large-scale production deployments:**
- `snowflake-distributed.yaml` - Large Snowflake databases
- `looker-distributed.yaml` - Looker with many dashboards
- `postgres-distributed.yaml` - PostgreSQL databases

### 2. Set Environment Variables

```bash
# OpenMetadata
export OPENMETADATA_HOST_PORT="http://openmetadata.default.svc.cluster.local:8585/api"
export OM_JWT_TOKEN="your-jwt-token"

# Snowflake example
export SNOWFLAKE_USER="your-user"
export SNOWFLAKE_PASSWORD="your-password"
export SNOWFLAKE_ACCOUNT="your-account"
export SNOWFLAKE_WAREHOUSE="COMPUTE_WH"
export SNOWFLAKE_DATABASE="PROD"
```

### 3. Run Ingestion

```bash
metadata ingest -c snowflake-distributed.yaml
```

This will:
1. Submit an Argo Workflow to Kubernetes
2. Discovery pod lists all tables
3. Spawn 100 worker pods to process tables in parallel
4. Each worker ingests metadata to OpenMetadata

### 4. Monitor Progress

**View in Argo UI:**
```
https://argo-server/workflows/openmetadata/<workflow-name>
```

**Check via kubectl:**
```bash
# List workflows
kubectl get workflows -n openmetadata

# Get workflow details
kubectl describe workflow <workflow-name> -n openmetadata

# View worker logs
kubectl logs <worker-pod-name> -n openmetadata
```

**Check in OpenMetadata UI:**
- Navigate to: Settings → Services → Your Service → Ingestion
- Logs will show: "Executing workflow in DISTRIBUTED mode"

## Configuration Reference

### Distributed Execution Settings

```yaml
workflowConfig:
  distributedExecution:
    # Enable distributed mode
    enabled: true

    # Orchestrator (only 'argo' supported currently)
    orchestrator: argo

    # Maximum parallel worker pods
    parallelism: 50

    # Kubernetes namespace for workflow
    namespace: openmetadata

    # Docker image for workers
    image: openmetadata/ingestion:latest

    # Retry policy for failed entities
    retryPolicy:
      maxAttempts: 3
      backoffSeconds: 60
      backoffFactor: 2
      maxBackoffSeconds: 600

    # Resource requests per worker
    resourceRequests:
      cpu: "500m"
      memory: "1Gi"

    # Resource limits per worker
    resourceLimits:
      cpu: "1"
      memory: "2Gi"

    # Wait for completion or return immediately
    waitForCompletion: false

    # Maximum workflow execution time
    timeoutSeconds: 86400  # 24 hours
```

### Tuning Parallelism

**Small databases (< 100 tables):**
```yaml
parallelism: 10
resourceRequests:
  cpu: "500m"
  memory: "512Mi"
```

**Medium databases (100-1000 tables):**
```yaml
parallelism: 30
resourceRequests:
  cpu: "500m"
  memory: "1Gi"
```

**Large databases (1000+ tables):**
```yaml
parallelism: 100
resourceRequests:
  cpu: "1"
  memory: "2Gi"
```

**Very large databases (10K+ tables):**
```yaml
parallelism: 200
resourceRequests:
  cpu: "2"
  memory: "4Gi"
```

## Supported Connectors

All database and dashboard connectors now support distributed execution:

### Databases (60+ connectors)
- ✅ PostgreSQL
- ✅ MySQL
- ✅ Snowflake
- ✅ BigQuery
- ✅ Redshift
- ✅ Oracle
- ✅ SQL Server
- ✅ All other database sources

### Dashboards (20+ connectors)
- ✅ Looker
- ✅ PowerBI
- ✅ Tableau
- ✅ Metabase
- ✅ Superset
- ✅ All other dashboard sources

## Disabling Distributed Mode

To run in traditional sequential mode, either:

**Option 1: Omit configuration**
```yaml
workflowConfig:
  # No distributedExecution section
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
```

**Option 2: Explicitly disable**
```yaml
workflowConfig:
  distributedExecution:
    enabled: false
```

## Troubleshooting

### Workflow not submitting

**Error:** `Failed to create workflow via Kubernetes API`

**Solutions:**
1. Check Argo Workflows is installed:
   ```bash
   kubectl get crd workflows.argoproj.io
   ```

2. Check service account permissions:
   ```bash
   kubectl get serviceaccount openmetadata-ingestion -n openmetadata
   ```

3. Check namespace exists:
   ```bash
   kubectl get namespace openmetadata
   ```

### Workers failing

**Check worker logs:**
```bash
kubectl logs <worker-pod> -n openmetadata
```

**Common issues:**
- **OOM (Out of Memory)**: Increase `resourceLimits.memory`
- **Connection timeouts**: Check network connectivity to source systems
- **Authentication failures**: Verify credentials in workflow config

### Source doesn't support distributed mode

**Error:** `Source XYZ does not support distributed execution`

This means the source hasn't implemented `DiscoverableSource` yet. The workflow will automatically fall back to sequential mode.

To add support, see `DISTRIBUTED_INGESTION_IMPLEMENTATION.md` in the repository root.

### Discovery phase takes too long

If discovery is slow (> 5 minutes), the source might be doing heavy operations. Check the source implementation and ensure `discover_entities()` only fetches entity IDs, not full metadata.

## Advanced Usage

### Custom Resource Limits per Connector

Different connectors have different resource needs:

**Looker (API-heavy, LookML parsing):**
```yaml
resourceRequests:
  cpu: "1"
  memory: "2Gi"
resourceLimits:
  cpu: "2"
  memory: "4Gi"
```

**Snowflake (column introspection):**
```yaml
resourceRequests:
  cpu: "500m"
  memory: "1Gi"
resourceLimits:
  cpu: "1"
  memory: "2Gi"
```

### Monitoring Costs

Each worker pod consumes resources. Estimate costs:

```
Cost = (Number of entities / parallelism) × Time per entity × Pod cost per hour

Example (Snowflake):
- 10,000 tables
- Parallelism: 100
- Time per table: 2 seconds
- Pod cost: $0.10/hour

Total time: (10,000 / 100) × 2 seconds = 200 seconds = 3.3 minutes
Total cost: 100 pods × (3.3/60) hours × $0.10 = $0.55
```

Compare to sequential (8 hours × 1 pod × $0.10 = $0.80).

### Filtering for Testing

Test with a small subset before full ingestion:

```yaml
sourceConfig:
  config:
    type: DatabaseMetadata
    schemaFilterPattern:
      includes:
        - "^test_schema$"  # Just one schema
```

Then scale up:
```yaml
schemaFilterPattern:
  includes:
    - "^prod_.*"  # All production schemas
```

## Best Practices

1. **Start small**: Test with `parallelism: 10` before scaling to 100+
2. **Monitor resources**: Watch pod CPU/memory usage in Kubernetes
3. **Set realistic timeouts**: Large ingestions may take hours
4. **Use filters**: Test with filtered schemas before full ingestion
5. **Check source rate limits**: Some APIs (e.g., Looker) have rate limits
6. **Schedule during off-hours**: Avoid peak database usage times

## Examples by Use Case

### Daily Incremental Ingestion
```yaml
distributedExecution:
  enabled: true
  parallelism: 30
  waitForCompletion: true
sourceConfig:
  config:
    markDeletedTables: true  # Detect deleted tables
```

### One-time Full Ingestion
```yaml
distributedExecution:
  enabled: true
  parallelism: 100
  waitForCompletion: false  # Don't block
  timeoutSeconds: 86400  # 24 hours
```

### Testing/Development
```yaml
distributedExecution:
  enabled: true
  parallelism: 5  # Low parallelism
  waitForCompletion: true
  timeoutSeconds: 600  # 10 minutes
sourceConfig:
  config:
    schemaFilterPattern:
      includes: ["^dev_.*"]
```

## Next Steps

1. **Review**: Read `DISTRIBUTED_INGESTION_IMPLEMENTATION.md` for architecture details
2. **Customize**: Modify example configs for your environment
3. **Deploy**: Submit workflows and monitor in Argo UI
4. **Scale**: Increase parallelism as needed
5. **Contribute**: Add distributed support to more connectors!

## Support

- **Documentation**: See repository root `/DISTRIBUTED_INGESTION_IMPLEMENTATION.md`
- **Issues**: https://github.com/open-metadata/OpenMetadata/issues
- **Slack**: #openmetadata-ingestion

---

**Generated with distributed ingestion framework v1.0**
