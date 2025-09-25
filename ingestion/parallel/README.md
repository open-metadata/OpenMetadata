# OpenMetadata Parallel Ingestion with Argo Workflows

Distributed metadata ingestion system that processes large databases in parallel using Kubernetes and Argo Workflows.

## Quick Start

```bash
# Build and deploy
make deploy

# Submit workflow
argo submit workflow.yaml -n openmetadata --parameter-file configs/postgres-workflow.yaml

# Monitor
argo watch @latest -n openmetadata
```

## Architecture

```
┌─────────────────┐
│  Argo Workflow  │
└────────┬────────┘
         │
    ┌────▼────┐
    │Discovery │ ← Discovers all schemas
    └────┬────┘
         │
    ┌────▼────────────────────────────┐
    │     Parallel Processing         │
    │  ┌──────┐ ┌──────┐ ┌──────┐   │
    │  │Schema│ │Schema│ │Schema│   │ ← One pod per schema
    │  │  01  │ │  02  │ │  N   │   │
    │  └──────┘ └──────┘ └──────┘   │
    └─────────────────────────────────┘
```

## How It Works

1. **Discovery Phase**: Identifies all schemas to process using OpenMetadata's source classes
2. **Parallel Processing**: Spawns up to N concurrent pods (configurable)
3. **Schema Isolation**: Each pod processes one schema independently
4. **Direct Integration**: Uses OpenMetadata's native ingestion framework

## Configuration

### Workflow Configuration

Create a standard OpenMetadata workflow configuration:

```yaml
# configs/postgres-workflow.yaml
source:
  type: postgres
  serviceName: my_postgres
  serviceConnection:
    config:
      type: Postgres
      username: user
      authType:
        password: pass
      hostPort: localhost:5432
      database: mydb
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes: ["public", "schema_.*"]

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://openmetadata:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: <token>
```

### Parallelism Control

Edit `workflow.yaml`:
```yaml
spec:
  parallelism: 5  # Maximum concurrent pods
```

## Supported Databases

Works with any OpenMetadata-supported database:
- PostgreSQL, MySQL, MariaDB
- Snowflake, BigQuery, Redshift
- SQL Server, Oracle, DB2
- Athena, Presto, Trino
- 70+ more connectors

## Commands

```bash
# Build Docker image
make build

# Deploy to Kubernetes
make deploy

# Submit workflow
make submit CONFIG=configs/postgres-workflow.yaml

# Monitor workflow
make watch

# Clean up
make clean
```

## Performance

| Database Size | Schemas | Parallelism | Expected Speedup |
|--------------|---------|-------------|------------------|
| Small | < 10 | 5 | 3-5x |
| Medium | 10-50 | 10 | 5-8x |
| Large | 50+ | 20 | 10-15x |

## Project Structure

```
ingestion/parallel/
├── workflow.yaml                 # Argo workflow template
├── workflow_executor.py          # CLI for discovery/processing
├── processor/
│   ├── sharding.py              # Work distribution logic
│   └── runner.py                # Execution engine
├── configs/                      # Workflow configurations
├── deploy/k8s/                   # Kubernetes manifests
└── images/
    └── om-parallel-worker.Dockerfile  # Container image
```

## Requirements

- Kubernetes 1.19+
- Argo Workflows 3.x
- OpenMetadata Server
- Database access from Kubernetes

## License

OpenMetadata Community License