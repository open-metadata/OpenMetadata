# Distributed Search Index Reindexing

## Overview

Distributed indexing enables OpenMetadata to scale search reindexing across multiple servers, providing:

- **Horizontal Scalability**: Work is partitioned and processed by multiple servers concurrently
- **Fault Tolerance**: Automatic recovery from server crashes with partition reassignment
- **Progress Tracking**: Real-time progress via WebSocket with per-entity statistics
- **Exactly-Once Processing**: Database-backed coordination ensures no duplicate processing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OpenMetadata Cluster                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │   Server 1   │    │   Server 2   │    │   Server 3   │                 │
│   │              │    │              │    │              │                 │
│   │ ┌──────────┐ │    │ ┌──────────┐ │    │ ┌──────────┐ │                 │
│   │ │ Partition│ │    │ │ Partition│ │    │ │ Partition│ │                 │
│   │ │ Worker   │ │    │ │ Worker   │ │    │ │ Worker   │ │                 │
│   │ └────┬─────┘ │    │ └────┬─────┘ │    │ └────┬─────┘ │                 │
│   │      │       │    │      │       │    │      │       │                 │
│   │      ▼       │    │      ▼       │    │      ▼       │                 │
│   │ ┌──────────┐ │    │ ┌──────────┐ │    │ ┌──────────┐ │                 │
│   │ │Coordinator│    │ │Coordinator│    │ │Coordinator│ │                 │
│   │ └────┬─────┘ │    │ └────┬─────┘ │    │ └────┬─────┘ │                 │
│   └──────┼───────┘    └──────┼───────┘    └──────┼───────┘                 │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                               │
│                              ▼                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                         MySQL / PostgreSQL                            │  │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│   │  │search_index_job │  │search_index_    │  │search_reindex_lock  │   │  │
│   │  │                 │  │partition        │  │                     │   │  │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│                              ▼                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    Elasticsearch / OpenSearch                         │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Job Lifecycle

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  INITIALIZING │────▶│     READY     │────▶│    RUNNING    │────▶│   COMPLETED   │
└───────────────┘     └───────────────┘     └───────┬───────┘     └───────────────┘
                                                    │
                                                    │ (errors)
                                                    ▼
                                            ┌───────────────┐
                                            │  COMPLETED    │
                                            │  WITH_ERRORS  │
                                            └───────────────┘
        ┌───────────────┐                          │
        │    FAILED     │◀─────────────────────────┤ (fatal error)
        └───────────────┘                          │
                                                   │ (user stop)
        ┌───────────────┐     ┌───────────────┐    │
        │    STOPPED    │◀────│   STOPPING    │◀───┘
        └───────────────┘     └───────────────┘
```

## Partition Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Partition State Machine                             │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │ PENDING │◀─────────────────────────────────────────┐
    └────┬────┘                                          │
         │ claim (atomic)                                │
         ▼                                               │ retry (< max)
    ┌────────────┐                                       │
    │ PROCESSING │───────────────────────────────────────┤
    └─────┬──────┘                                       │
          │                                              │
          ├─────────────────┬────────────────┐           │
          │                 │                │           │
          ▼                 ▼                ▼           │
    ┌───────────┐    ┌───────────┐    ┌───────────┐     │
    │ COMPLETED │    │  FAILED   │    │ (timeout) │─────┘
    └───────────┘    └───────────┘    └───────────┘
                           │
                           │ retry >= max
                           ▼
                     ┌───────────┐
                     │  FAILED   │
                     │(permanent)│
                     └───────────┘
```

## Database Schema

### search_index_job

Stores job metadata and aggregated statistics.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| status | VARCHAR(32) | Job status enum |
| jobConfiguration | TEXT | JSON configuration (entities, batch size, etc.) |
| stagedIndexPrefix | VARCHAR(255) | Prefix for staged indices during recreation |
| totalRecords | BIGINT | Total entities to process |
| processedRecords | BIGINT | Entities processed so far |
| successRecords | BIGINT | Successfully indexed |
| failedRecords | BIGINT | Failed to index |
| statsJson | TEXT | Per-entity statistics JSON |
| createdBy | VARCHAR(255) | User who created the job |
| createdAt | BIGINT | Creation timestamp |
| startedAt | BIGINT | When processing started |
| completedAt | BIGINT | When job finished |
| updatedAt | BIGINT | Last update timestamp |
| errorMessage | TEXT | Error details if failed |

### search_index_partition

Stores individual work units for parallel processing.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| jobId | VARCHAR(36) | Foreign key to job |
| entityType | VARCHAR(255) | Entity type (table, database, etc.) |
| partitionIndex | INT | Partition number within entity type |
| rangeStart | BIGINT | Starting offset |
| rangeEnd | BIGINT | Ending offset |
| estimatedCount | BIGINT | Estimated entities in partition |
| workUnits | BIGINT | Weighted work estimate |
| priority | INT | Processing priority (higher = first) |
| status | VARCHAR(32) | Partition status |
| processingCursor | BIGINT | Current processing position |
| processedCount | BIGINT | Entities processed |
| successCount | BIGINT | Successfully indexed |
| failedCount | BIGINT | Failed to index |
| assignedServer | VARCHAR(255) | Server processing this partition |
| claimedAt | BIGINT | When partition was claimed |
| startedAt | BIGINT | When processing started |
| completedAt | BIGINT | When partition finished |
| lastUpdateAt | BIGINT | Last heartbeat timestamp |
| lastError | TEXT | Last error message |
| retryCount | INT | Number of retry attempts |

### search_reindex_lock

Distributed lock to prevent concurrent jobs.

| Column | Type | Description |
|--------|------|-------------|
| lockKey | VARCHAR(255) | Lock identifier |
| jobId | VARCHAR(36) | Job holding the lock |
| serverId | VARCHAR(255) | Server holding the lock |
| acquiredAt | BIGINT | When lock was acquired |
| lastHeartbeat | BIGINT | Last heartbeat timestamp |
| expiresAt | BIGINT | Lock expiration time |

## Key Components

### DistributedSearchIndexCoordinator

Central coordination layer for job and partition management:

- **Job Management**: Create, start, stop, and track jobs
- **Partition Management**: Create, claim, update, and complete partitions
- **Lock Management**: Distributed locking to prevent concurrent jobs
- **Stats Aggregation**: Real-time aggregation of partition statistics

### DistributedSearchIndexExecutor

Orchestrates job execution on a single server:

- **Job Creation**: Initializes job and calculates partitions
- **Worker Management**: Manages partition worker threads
- **Lock Refresh**: Keeps distributed lock alive during processing
- **Heartbeat**: Updates partition heartbeats to prevent stale detection

### PartitionWorker

Processes individual partitions:

- **Entity Reading**: Paginated reads from database
- **Bulk Indexing**: Writes to Elasticsearch/OpenSearch
- **Progress Tracking**: Updates cursor and counts
- **Error Handling**: Retries with exponential backoff

### JobRecoveryManager

Handles crash recovery during server startup:

- **Orphan Detection**: Finds jobs without active lock holders
- **Partition Reset**: Resets stuck PROCESSING partitions to PENDING
- **Decision Logic**: Determines whether to recover or fail old jobs

### PartitionCalculator

Calculates optimal work distribution:

- **Entity Counting**: Gets counts for each entity type
- **Work Estimation**: Applies complexity factors per entity type
- **LPT Algorithm**: Longest Processing Time first for load balancing
- **Partition Limits**: Enforces maximum partition counts for scale protection

## Concurrency Control

### Atomic Partition Claiming

Uses `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` to atomically claim partitions without race conditions:

```sql
UPDATE search_index_partition
SET status = 'PROCESSING', assignedServer = ?, claimedAt = ?, startedAt = ?, lastUpdateAt = ?
WHERE id = (
    SELECT id FROM search_index_partition
    WHERE jobId = ? AND status = 'PENDING'
    ORDER BY priority DESC, entityType, partitionIndex
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
```

### Stale Partition Detection

Partitions are considered stale if `lastUpdateAt < (now - PARTITION_CLAIM_TIMEOUT)`:

- Stale partitions under retry limit are reset to PENDING
- Stale partitions exceeding retry limit are marked FAILED

### Lock Transfer

Atomic lock transfer when job ID changes:

```sql
UPDATE search_reindex_lock
SET jobId = ?, serverId = ?, lastHeartbeat = ?, expiresAt = ?
WHERE lockKey = ? AND jobId = ?
```

## Configuration

Enable distributed indexing via the reindex API:

```json
{
  "entities": ["table", "database", "topic", "dashboard"],
  "recreateIndex": true,
  "batchSize": 100,
  "consumerThreads": 4,
  "useDistributedIndexing": true
}
```

### Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| useDistributedIndexing | false | Enable distributed mode |
| batchSize | 100 | Entities per batch |
| consumerThreads | 4 | Worker threads per server |
| maxConcurrentRequests | 100 | Concurrent ES/OS requests |
| payLoadSize | 100MB | Max bulk request size |

## Timeouts and Limits

| Constant | Value | Description |
|----------|-------|-------------|
| LOCK_TIMEOUT_MS | 5 minutes | Distributed lock TTL |
| LOCK_REFRESH_INTERVAL_MS | 1 minute | Lock heartbeat interval |
| PARTITION_CLAIM_TIMEOUT_MS | 5 minutes | Partition stale threshold |
| MAX_PARTITION_RETRIES | 3 | Max retries per partition |
| MAX_PARTITIONS_PER_ENTITY_TYPE | 10,000 | Per-entity partition limit |
| MAX_TOTAL_PARTITIONS | 50,000 | Total partitions per job |

## Error Handling

### Partition-Level Errors

1. **Transient Errors**: Partition is reset to PENDING with incremented retry count
2. **Permanent Errors**: After MAX_RETRIES, partition is marked FAILED
3. **Timeout Errors**: Stale partitions are reclaimed by other servers

### Job-Level Errors

1. **Lock Lost**: Job is marked FAILED, other servers can start new jobs
2. **All Partitions Failed**: Job completes with FAILED status
3. **Some Partitions Failed**: Job completes with COMPLETED_WITH_ERRORS status

## Monitoring

### WebSocket Updates

Progress is broadcast every 2 seconds via WebSocket channel `searchIndexJobStatus`:

```json
{
  "status": "RUNNING",
  "stats": {
    "jobStats": {
      "totalRecords": 100000,
      "successRecords": 45000,
      "failedRecords": 100
    },
    "entityStats": {
      "table": { "totalRecords": 50000, "successRecords": 25000, "failedRecords": 50 },
      "database": { "totalRecords": 50000, "successRecords": 20000, "failedRecords": 50 }
    }
  }
}
```

### Database Queries

Monitor job progress:

```sql
-- Job status
SELECT id, status, totalRecords, successRecords, failedRecords, updatedAt
FROM search_index_job WHERE status IN ('RUNNING', 'READY');

-- Partition distribution
SELECT assignedServer, status, COUNT(*) as count
FROM search_index_partition WHERE jobId = ?
GROUP BY assignedServer, status;

-- Stale partitions
SELECT * FROM search_index_partition
WHERE status = 'PROCESSING'
AND lastUpdateAt < (UNIX_TIMESTAMP() * 1000 - 300000);
```

## Recovery Scenarios

### Scenario 1: Server Crash During Processing

1. Server A crashes while processing partitions
2. Server B starts, `JobRecoveryManager.performStartupRecovery()` runs
3. Orphaned partitions (no valid lock, stale heartbeat) are detected
4. Partitions under retry limit are reset to PENDING
5. Server B continues processing remaining partitions

### Scenario 2: Network Partition

1. Server A loses database connectivity
2. Lock expires after LOCK_TIMEOUT_MS
3. Server B detects orphaned job, marks it for recovery
4. Server B can start a new job or continue existing one

### Scenario 3: Elasticsearch Overload

1. Partition processing fails with backpressure errors
2. Partition is marked FAILED with error message
3. Next server to claim it increments retry count
4. After MAX_RETRIES, partition is permanently failed
5. Job completes with COMPLETED_WITH_ERRORS

## Performance Considerations

### Partition Sizing

- **Too Small**: Excessive coordination overhead
- **Too Large**: Poor load balancing, longer recovery times
- **Recommended**: 5,000-10,000 entities per partition

### Worker Threads

- **Per Server**: Match to CPU cores (4-8 typical)
- **Total Cluster**: Scale horizontally by adding servers

### Database Load

- Partition claiming: ~1 query per partition per server
- Heartbeats: 1 query per 30 seconds per owned partition
- Stats aggregation: 1 GROUP BY query per 2 seconds

## Limitations

1. **Single Active Job**: Only one reindex job can run at a time (enforced by lock)
2. **Entity Count Changes**: If entities are added/deleted during reindex, counts may be slightly off
3. **Time Series Entities**: Currently uses same partitioning as regular entities

## Future Enhancements

- [ ] Parallel job support for different entity subsets
- [ ] Adaptive partition sizing based on processing speed
- [ ] Priority queue for critical entity types
- [ ] Checkpoint/resume for very long running jobs
