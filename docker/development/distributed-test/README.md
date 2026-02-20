# Distributed Search Indexing Test Environment

This directory contains scripts and configurations to test the distributed search indexing feature with multiple OpenMetadata servers sharing a common database.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Test Environment                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ OM Server│  │ OM Server│  │ OM Server│                      │
│  │  :8585   │  │  :8587   │  │  :8589   │                      │
│  │ SERVER-1 │  │ SERVER-2 │  │ SERVER-3 │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │             │             │                             │
│       └─────────────┼─────────────┘                             │
│                     │                                           │
│              ┌──────┴──────┐                                    │
│              │   Polling   │  (DB-based coordination)           │
│              └──────┬──────┘                                    │
│                     │                                           │
│       ┌─────────────┴─────────────┐                             │
│       ▼                           ▼                             │
│  ┌─────────┐                ┌───────────┐                       │
│  │  MySQL  │                │ OpenSearch│                       │
│  │  :3306  │                │   :9200   │                       │
│  └─────────┘                └───────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start (Docker Compose)

### 1. Start the Environment

```bash
cd docker/development/distributed-test

# Start all services (builds images on first run)
./scripts/start.sh

# Or force rebuild
./scripts/start.sh --build
```

### 2. Load Test Data

```bash
# Load 10,000 tables (default)
./scripts/load-test-data.sh

# Or specify the number
./scripts/load-test-data.sh --tables 50000 --databases 50
```

### 3. Trigger Reindexing

```bash
# Trigger reindex on server 1
./scripts/trigger-reindex.sh

# With index recreation
./scripts/trigger-reindex.sh --recreate

# Specific entities only
./scripts/trigger-reindex.sh --entities table,dashboard
```

### 4. Monitor Progress

```bash
# Follow logs from all servers
./scripts/logs.sh -f

# Filter by pattern
./scripts/logs.sh -f --grep "partition"

# Single server logs
./scripts/logs.sh -f --server 1
```

### 5. Stop the Environment

```bash
# Stop containers (preserve data)
./scripts/stop.sh

# Stop and clean up volumes
./scripts/stop.sh --clean
```

## Local Development (IDE Debugging)

For debugging with breakpoints, run OM servers locally while using Docker for MySQL and OpenSearch.

### 1. Start Dependencies Only

```bash
cd docker/development/distributed-test
docker compose -f local/docker-compose-deps.yml up -d
```

### 2. Run Migrations (First Time)

```bash
cd /path/to/openmetadata
./bootstrap/openmetadata-ops.sh -d migrate --force
```

### 3. Option A: Run from Terminal

```bash
# Start all 3 servers in separate terminals
./local/run-local-servers.sh

# Or specific servers
./local/run-local-servers.sh 1 2
```

### 3. Option B: Run from IDE

Create run configurations in IntelliJ IDEA:

**Server 1:**
- Main class: `org.openmetadata.service.OpenMetadataApplication`
- Program arguments: `server docker/development/distributed-test/local/server1.yaml`
- VM options: `-Xmx1G -Xms512M`
- Working directory: Project root

**Server 2:**
- Same as above but with `local/server2.yaml`

**Server 3:**
- Same as above but with `local/server3.yaml`

## Server Ports

| Server | API Port | Admin Port |
|--------|----------|------------|
| Server 1 | 8585 | 8586 |
| Server 2 | 8587 | 8588 |
| Server 3 | 8589 | 8590 |

## Configuration

Edit `.env` to customize:

```bash
# Number of tables for test data
TEST_DATA_TABLES=10000

# Log level
LOG_LEVEL=INFO

# Heap size per server
OPENMETADATA_HEAP_OPTS=-Xmx1G -Xms1G
```

## Testing Distributed Indexing

### Verify Partition Distribution

1. Start all 3 servers
2. Load test data: `./scripts/load-test-data.sh --tables 10000`
3. Trigger reindex: `./scripts/trigger-reindex.sh --recreate`
4. Watch logs: `./scripts/logs.sh -f --grep "partition"`

You should see output like:
```
[SERVER-1] INFO  Claimed partition: table_0-999 (1000 records)
[SERVER-2] INFO  Claimed partition: table_1000-1999 (1000 records)
[SERVER-3] INFO  Claimed partition: table_2000-2999 (1000 records)
[SERVER-1] INFO  Completed partition: table_0-999
...
```

### Test Server Failure Recovery

1. Start reindexing with many partitions
2. Stop one server mid-process: `docker stop distributed_test_om_server_2`
3. Watch remaining servers pick up orphaned partitions
4. Verify job completes successfully

### Check Job Status

```bash
# Via API
curl -s http://localhost:8585/api/v1/apps/name/SearchIndexingApplication/status | jq

# Check partition table directly
docker exec -it distributed_test_mysql mysql -uopenmetadata_user -popenmetadata_password openmetadata_db \
  -e "SELECT status, COUNT(*) FROM search_index_partition GROUP BY status"
```

## Troubleshooting

### Servers Not Starting

Check if ports are in use:
```bash
lsof -i :8585
lsof -i :8587
lsof -i :8589
```

### Database Connection Issues

Verify MySQL is accessible:
```bash
docker exec -it distributed_test_mysql mysql -uopenmetadata_user -popenmetadata_password -e "SELECT 1"
```

### OpenSearch Not Ready

Check health:
```bash
curl http://localhost:9200/_cluster/health?pretty
```

### View Full Logs

```bash
# All container logs
docker compose logs -f

# Specific container
docker logs -f distributed_test_om_server_1
```

## File Structure

```
distributed-test/
├── docker-compose.yml          # Full environment (3 OM servers + deps)
├── .env                        # Configuration variables
├── config/
│   └── mysql-init.sql          # Database initialization
├── scripts/
│   ├── start.sh                # Start full environment
│   ├── stop.sh                 # Stop environment
│   ├── logs.sh                 # View aggregated logs
│   ├── trigger-reindex.sh      # Trigger reindexing
│   └── load-test-data.sh       # Load test data
├── local/
│   ├── docker-compose-deps.yml # Dependencies only (for IDE debugging)
│   ├── server1.yaml            # Server 1 config (port 8585)
│   ├── server2.yaml            # Server 2 config (port 8587)
│   ├── server3.yaml            # Server 3 config (port 8589)
│   └── run-local-servers.sh    # Start servers locally
└── README.md                   # This file
```
