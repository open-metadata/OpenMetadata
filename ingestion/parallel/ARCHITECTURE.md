# OpenMetadata Parallel Ingestion Architecture

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [How It Works](#how-it-works)
4. [Universal Adapters](#universal-adapters)
5. [Deployment](#deployment)
6. [Testing with Real Connectors](#testing-with-real-connectors)
7. [Performance Benchmarks](#performance-benchmarks)
8. [Troubleshooting](#troubleshooting)

## Overview

The OpenMetadata Parallel Ingestion Framework enables horizontal scaling of all ingestion workflows (metadata, lineage, usage, profiler, data quality) without modifying existing connectors. It uses Kubernetes-native orchestration with Argo Workflows and optional distributed processing with Ray.

### Key Benefits

- **No connector changes required** - Works with all existing OpenMetadata sources
- **Horizontal scaling** - Process millions of entities in parallel
- **Fault tolerant** - Automatic retries, dead letter queues
- **Cost efficient** - Scales up when needed, scales down when done
- **Production ready** - Monitoring, logging, idempotency built-in

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                   Argo Workflow Orchestration                 │
│                                                               │
│  ┌───────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │ Partition │ ──► │ Parallel Map │ ──► │    Reduce    │   │
│  │  (Once)   │     │  (N Workers) │     │  (Optional)  │   │
│  └───────────┘     └──────────────┘     └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │          Execution Options              │
        │                                         │
        │  ┌─────────────┐    ┌──────────────┐  │
        │  │  Ray Cluster │ OR │  Argo Pods   │  │
        │  │  (Optimal)   │    │  (Fallback)  │  │
        │  └─────────────┘    └──────────────┘  │
        └─────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Universal Adapters                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Universal  │  │  Universal  │  │  Universal  │         │
│  │   Source    │  │  Processor  │  │    Sink     │         │
│  │   Adapter   │  │   Adapter   │  │   Adapter   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │ Wraps          │ Wraps          │ Wraps           │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐         │
│  │  Existing   │  │  Existing   │  │  Existing   │         │
│  │ OM Sources  │  │ Processors  │  │   Sinks     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### The Core Challenge

OpenMetadata workflows iterate through entities one at a time:

```python
# Traditional sequential processing
for entity in source._iter():  # Makes network calls
    processed = processor.run(entity)
    sink.run(processed)
```

### The Parallel Solution

We parallelize by:

1. **Discovery Phase**: Understand how to partition work WITHOUT processing all data
2. **Parallel Execution**: Each worker processes a subset using source filtering

### Detailed Flow

#### 1. Discovery Phase (Partition)

```python
def discover_shards(source):
    # Use efficient APIs when available
    if hasattr(source, 'list_databases'):
        # One API call instead of full iteration
        databases = source.list_databases()
        return [Shard(id=db) for db in databases]
    
    # Use source configuration capabilities
    elif source.supports_filtering:
        # Quick metadata query
        return query_partitioning_metadata()
    
    # Fallback: minimal sampling
    else:
        sample = take_sample(source, size=100)
        return estimate_shards(sample)
```

#### 2. Parallel Execution (Map)

Each worker gets a modified source configuration:

```python
# Worker 1 configuration
config["databaseFilterPattern"] = {"includes": ["sales"]}

# Worker 2 configuration  
config["databaseFilterPattern"] = {"includes": ["analytics"]}

# Each worker only fetches its subset!
source = create_source(worker_config)
for entity in source._iter():  # Only queries assigned database
    process_and_sink(entity)
```

### Sharding Strategies

| Workflow | Strategy | Description | Example |
|----------|----------|-------------|---------|
| **Metadata** | Database/Schema | One shard per database or schema | `shard-1: sales DB`, `shard-2: analytics DB` |
| **Lineage** | Time Window | Split by time ranges | `shard-1: 00:00-06:00`, `shard-2: 06:00-12:00` |
| **Usage** | Time Window | Daily windows for aggregation | `shard-1: 2024-01-01`, `shard-2: 2024-01-02` |
| **Profiler** | Table Count | Even distribution by table count | `shard-1: tables 1-50`, `shard-2: tables 51-100` |
| **Data Quality** | Schema/Table | Logical grouping for tests | `shard-1: schema A`, `shard-2: schema B` |

### Handling Sources Without Filtering

For sources that don't support filtering, we use smart caching:

```python
# Option 1: In-memory for small datasets
if dataset_size < 1MB:
    cached_entities = list(source._iter())  # Run once
    # Pass via Argo parameters
    
# Option 2: ConfigMap for medium datasets
elif dataset_size < 10MB:
    k8s_client.create_configmap(data={"entities": json.dumps(entities)})
    
# Option 3: Shared volume for large datasets
else:
    # Write to PersistentVolume
    with open("/cache/entities.pkl", "wb") as f:
        pickle.dump(entities, f)
```

## Universal Adapters

### How They Work

Universal adapters wrap existing OpenMetadata components without modification:

```python
class UniversalSourceAdapter(SourceAdapter):
    def __init__(self, config):
        # Original source configuration
        self.source_config = config["source_config"]
        # Sharding strategy
        self.sharding_strategy = config["sharding_strategy"]
    
    def discover_shards(self):
        # Initialize original source
        source = self._create_source()
        # Discover partitions
        return self.sharding_strategy.discover_shards(source)
    
    def iter_records(self, shard):
        # Create source with shard-specific config
        shard_config = self._modify_config_for_shard(shard)
        source = self._create_source(shard_config)
        
        # Source only fetches this shard's data
        for entity in source._iter():
            yield Record(entity)
```

### Supported Connectors

All OpenMetadata connectors work out-of-the-box:

| Connector | Filter Support | Sharding Strategy |
|-----------|---------------|-------------------|
| PostgreSQL/MySQL | ✅ Database, Schema patterns | Database or Schema |
| BigQuery | ✅ Project, Dataset patterns | Dataset |
| Snowflake | ✅ Database, Schema patterns | Database or Schema |
| Redshift | ✅ Database, Schema patterns | Schema |
| Athena | ✅ Database patterns | Database |
| S3/GCS | ✅ Prefix patterns | Prefix-based |
| Kafka | ✅ Topic patterns | Topic groups |
| Tableau/PowerBI | ✅ Project filters | Project/Workspace |
| DBT | ✅ Model patterns | Model groups |

## Deployment

### Prerequisites

```bash
# 1. Kubernetes cluster (1.24+)
kubectl version --client

# 2. Argo Workflows
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.0/install.yaml

# 3. (Optional) KubeRay for optimal performance
helm repo add kuberay https://ray-project.github.io/kuberay-helm/
helm install kuberay-operator kuberay/kuberay-operator --create-namespace -n kuberay-system
```

### Installation

```bash
# 1. Create namespace and RBAC
kubectl create namespace openmetadata
kubectl apply -f ingestion/parallel/deploy/kuberay/rbac.yaml

# 2. Build and push images
docker build -f ingestion/parallel/images/om-ray-runner.Dockerfile -t your-registry/om-ray-runner:latest .
docker push your-registry/om-ray-runner:latest

# 3. Deploy workflow templates
kubectl apply -f ingestion/parallel/deploy/argo/om-parallel-ingestion.yaml

# 4. Configure secrets
kubectl -n openmetadata create secret generic om-secrets \
  --from-literal=api-key=YOUR_OPENMETADATA_API_KEY
```

## Testing with Real Connectors

### Example 1: PostgreSQL Metadata Ingestion

#### Setup Test Database

```sql
-- Create test databases with varying sizes
CREATE DATABASE sales;
CREATE DATABASE analytics;
CREATE DATABASE logs;

-- Create tables in each database
\c sales
CREATE SCHEMA ecommerce;
CREATE SCHEMA inventory;
-- Create 1000 tables
DO $$ 
BEGIN 
    FOR i IN 1..1000 LOOP
        EXECUTE format('CREATE TABLE ecommerce.orders_%s (id INT, data TEXT)', i);
    END LOOP;
END $$;

\c analytics
-- Create 500 tables
DO $$ 
BEGIN 
    FOR i IN 1..500 LOOP
        EXECUTE format('CREATE TABLE public.metrics_%s (id INT, value DECIMAL)', i);
    END LOOP;
END $$;
```

#### Configure and Run Parallel Ingestion

```bash
# Create configuration
cat > postgres-config.json <<EOF
{
  "source_config": {
    "type": "postgres",
    "serviceName": "postgres_test",
    "serviceConnection": {
      "config": {
        "type": "Postgres",
        "username": "postgres",
        "password": "password",
        "hostPort": "postgres-test:5432"
      }
    }
  },
  "sharding_strategy": {
    "type": "database"
  }
}
EOF

# Submit workflow
argo submit -n openmetadata --from workflowtemplate/om-parallel-ingestion \
  -p source_class='ingestion.parallel.adapters.universal_source.MetadataSourceAdapter' \
  -p processor_class='ingestion.parallel.adapters.universal_processor.UniversalProcessorAdapter' \
  -p sink_class='ingestion.parallel.adapters.universal_sink.UniversalSinkAdapter' \
  -p config="$(cat postgres-config.json)" \
  -p workerReplicas=3 \
  --name postgres-parallel-test
```

#### Monitor Progress

```bash
# Watch workflow
argo get -n openmetadata postgres-parallel-test --watch

# Check logs
argo logs -n openmetadata postgres-parallel-test -f

# View in UI
kubectl -n argo port-forward deployment/argo-server 2746:2746
# Open https://localhost:2746
```

### Example 2: BigQuery Lineage with Time Windows

```bash
# Configuration for lineage
cat > bigquery-lineage-config.json <<EOF
{
  "source_config": {
    "type": "bigquery-lineage",
    "serviceName": "bigquery_prod",
    "serviceConnection": {
      "config": {
        "type": "BigQuery",
        "credentials": {
          "gcpConfig": {
            "projectId": "my-project",
            "type": "service_account",
            "privateKeyId": "key-id",
            "privateKey": "-----BEGIN RSA PRIVATE KEY-----"
          }
        }
      }
    },
    "sourceConfig": {
      "config": {
        "queryLogDuration": 7
      }
    }
  },
  "sharding_strategy": {
    "type": "time_window",
    "window_hours": 6
  }
}
EOF

# Run with more workers for time-based sharding
argo submit -n openmetadata --from workflowtemplate/om-parallel-ingestion \
  -p source_class='ingestion.parallel.adapters.universal_source.LineageSourceAdapter' \
  -p enable_reduce=true \
  -p workerReplicas=8
```

### Example 3: Snowflake Profiler

```bash
# Test with table count sharding
cat > snowflake-profiler-config.json <<EOF
{
  "source_config": {
    "type": "snowflake",
    "serviceName": "snowflake_test",
    "serviceConnection": {
      "config": {
        "type": "Snowflake",
        "username": "OPENMETADATA",
        "password": "password",
        "account": "myaccount.us-east-1",
        "warehouse": "COMPUTE_WH"
      }
    }
  },
  "sharding_strategy": {
    "type": "table_count",
    "tables_per_shard": 50
  }
}
EOF

# Profiler needs more memory
argo submit -n openmetadata --from workflowtemplate/om-parallel-ingestion \
  -p source_class='ingestion.parallel.adapters.universal_source.ProfilerSourceAdapter' \
  -p processor_class='ingestion.parallel.adapters.universal_processor.ProfilerProcessorAdapter' \
  -p sink_class='ingestion.parallel.adapters.universal_sink.ProfilerSinkAdapter' \
  -p workerReplicas=10 \
  -p worker_memory='4Gi'
```

## Performance Benchmarks

### Test Setup

```python
# benchmark.py
import time
import subprocess
import json

def run_benchmark(workflow_type, config, workers):
    start_time = time.time()
    
    # Submit workflow
    result = subprocess.run([
        "argo", "submit", "-n", "openmetadata",
        "--from", "workflowtemplate/om-parallel-ingestion",
        "-p", f"workerReplicas={workers}",
        "-p", f"config={json.dumps(config)}",
        "--wait"  # Wait for completion
    ], capture_output=True)
    
    end_time = time.time()
    return {
        "duration": end_time - start_time,
        "workers": workers,
        "status": "success" if result.returncode == 0 else "failed"
    }

# Run benchmarks
configs = {
    "metadata": load_config("metadata"),
    "lineage": load_config("lineage"),
    "profiler": load_config("profiler")
}

results = {}
for workflow_type, config in configs.items():
    results[workflow_type] = []
    for workers in [1, 3, 5, 10]:
        result = run_benchmark(workflow_type, config, workers)
        results[workflow_type].append(result)
        print(f"{workflow_type} with {workers} workers: {result['duration']:.2f}s")
```

### Expected Results

| Workflow | Dataset Size | Sequential Time | Parallel (10 workers) | Speedup |
|----------|-------------|-----------------|----------------------|---------|
| Metadata | 10K tables | 120 min | 15 min | 8x |
| Lineage | 1M queries | 180 min | 25 min | 7.2x |
| Usage | 5M events | 240 min | 30 min | 8x |
| Profiler | 1K tables | 300 min | 35 min | 8.6x |
| Data Quality | 500 tables | 60 min | 8 min | 7.5x |

### Monitoring Performance

```bash
# CPU/Memory usage
kubectl top pods -n openmetadata -l app=om-parallel

# Ray metrics (if using Ray)
kubectl port-forward -n openmetadata svc/ray-head-svc 8265:8265
# Open http://localhost:8265

# Prometheus metrics
curl http://localhost:8000/metrics | grep om_parallel

# Check for bottlenecks
argo logs -n openmetadata <workflow-name> | grep "Processing time"
```

### Performance Tuning

1. **Adjust Worker Count**
   ```bash
   # CPU-bound (metadata, lineage)
   -p workerReplicas=20
   
   # Memory-bound (profiler)
   -p workerReplicas=10 -p worker_memory=8Gi
   ```

2. **Optimize Batch Size**
   ```bash
   # Larger batches for simple operations
   -p microbatch_size=5000
   
   # Smaller for complex operations
   -p microbatch_size=100
   ```

3. **Shard Size Tuning**
   ```json
   {
     "sharding_strategy": {
       "type": "table_count",
       "tables_per_shard": 25  // Reduce for heavy operations
     }
   }
   ```

## Troubleshooting

### Common Issues

#### 1. Workers Not Starting

```bash
# Check Ray cluster
kubectl get raycluster -n openmetadata
kubectl describe raycluster <name> -n openmetadata

# Check worker pods
kubectl get pods -n openmetadata -l ray-node-type=worker
kubectl logs -n openmetadata <worker-pod>
```

#### 2. Out of Memory

```bash
# Increase memory limits
-p worker_memory=8Gi

# Reduce batch size
-p microbatch_size=100

# Check memory usage
kubectl top pods -n openmetadata
```

#### 3. Slow Performance

```bash
# Check if source supports filtering
kubectl logs -n openmetadata <partition-pod> | grep "supports_filtering"

# If not, check cache strategy
kubectl logs -n openmetadata <partition-pod> | grep "cache_type"

# Verify sharding distribution
argo logs -n openmetadata <workflow> | grep "Discovered.*shards"
```

#### 4. Failed Records

```bash
# Check Dead Letter Queue
kubectl exec -n openmetadata <worker-pod> -- ls /tmp/om-parallel-dlq/

# View failures
kubectl exec -n openmetadata <worker-pod> -- cat /tmp/om-parallel-dlq/*/shard-*_failures.jsonl
```

### Debug Commands

```bash
# Full workflow status
argo get -n openmetadata <workflow-name> -o yaml

# Performance analysis
argo logs -n openmetadata <workflow-name> | grep -E "(duration|throughput|processed)"

# Resource utilization
kubectl top pods -n openmetadata -l workflows.argoproj.io/workflow=<workflow-name>

# Check network calls
kubectl logs -n openmetadata <worker-pod> | grep -E "(SELECT|GET|POST)"
```

## Best Practices

1. **Choose the Right Sharding Strategy**
   - Database sharding for metadata when you have many databases
   - Schema sharding when databases are large
   - Time windows for temporal data (usage, lineage)
   - Table count for even distribution

2. **Optimize for Your Workload**
   - More workers for I/O bound operations (metadata)
   - Fewer workers with more memory for compute-heavy (profiler)
   - Adjust batch sizes based on operation complexity

3. **Monitor and Iterate**
   - Start with default settings
   - Monitor performance metrics
   - Adjust workers and batch sizes
   - Use profiling data to optimize

4. **Handle Failures Gracefully**
   - Enable DLQ for production
   - Set appropriate retry limits
   - Monitor failure patterns
   - Implement alerting

## Conclusion

The OpenMetadata Parallel Ingestion Framework provides massive scalability improvements (7-10x typical) for all ingestion workflows without requiring any changes to existing connectors. By leveraging Kubernetes-native orchestration and intelligent sharding strategies, it transforms OpenMetadata into a truly scalable metadata platform capable of handling enterprise-scale data estates.