# Search Indexing Stats Redesign

## Overview

Redesign the SearchIndexingApp stats tracking to simplify the current complex implementation and add support for vector embedding statistics.

## Goals

1. **Simplify stats building** - Replace multi-source stats with single pipeline model
2. **Add vector embedding stats** - Track vector indexing separately without affecting overall job status
3. **Per-entity index promotion** - Promote staged indexes immediately per entity type
4. **Alias management from indexMapping.json** - Use configuration instead of reading from old index
5. **Payload-aware vector bulk processor** - Respect payload size limits for vector chunks

## Design

### 1. Simplified Stats Architecture

Replace the current multi-source stats with a **single pipeline model**:

```
Read Stage → Process Stage → Sink Stage ──→ Vector Stage
    ↓              ↓              ↓              ↓
 ReaderStats   ProcessStats    SinkStats    VectorStats
    ↓              ↓              ↓              ↓
    └──────────────┴──────────────┴──────────────┘
                            ↓
              search_index_server_stats (single source of truth)
```

#### Stats Structure (per entity type, per server)

```java
public class PipelineStats {
    // Reader: Database read operations
    int readerSuccess;    // Entities read successfully
    int readerFailed;     // Critical read errors (DB issues)
    int readerWarnings;   // Non-critical (stale references, still processed)

    // Process: Entity → SearchDoc conversion
    int processSuccess;   // Docs built successfully
    int processFailed;    // Build failures (EntityNotFoundException, schema errors)
    int processWarnings;  // Non-critical processing issues

    // Sink: Elasticsearch/OpenSearch write
    int sinkSuccess;      // Docs indexed successfully
    int sinkFailed;       // Index failures (rejected, mapping errors)
    int sinkWarnings;     // Partial success (some fields skipped)

    // Vector: Vector embedding indexing (Collate-specific)
    int vectorSuccess;    // Embeddings indexed successfully
    int vectorFailed;     // Embedding failures (API errors, chunk issues)
    int vectorWarnings;   // Non-critical (fingerprint match, skipped regeneration)
}
```

#### Key Points
- **No reconciliation needed** - each stage reports its own accurate counts
- **Vector stats are independent** - don't affect overall job success/failure
- **Single DB table** as source of truth, updated incrementally

### 2. Database Schema Updates

#### Update `search_index_server_stats` Table

```sql
ALTER TABLE search_index_server_stats ADD COLUMN (
    -- Process stage (new)
    processSuccess INT DEFAULT 0,
    processFailed INT DEFAULT 0,
    processWarnings INT DEFAULT 0,

    -- Vector stage (new - Collate specific)
    vectorSuccess INT DEFAULT 0,
    vectorFailed INT DEFAULT 0,
    vectorWarnings INT DEFAULT 0
);
```

#### Update `search_index_failures` Table

```sql
ALTER TABLE search_index_failures
    MODIFY COLUMN failureStage ENUM(
        'READER',           -- DB read failure
        'READER_EXCEPTION', -- Non-critical read issue
        'PROCESS',          -- Entity → Doc conversion failure
        'SINK',             -- ES/OpenSearch write failure
        'VECTOR_SINK'       -- Vector embedding failure
    );
```

#### Migration Strategy
- Add new columns with defaults (non-breaking)
- New code writes to new columns
- Old `entityBuildFailures` mapped to `processFailed` during aggregation (temporary)
- Clean removal in future release

### 3. Simplified Stats Tracking Code

#### New `StageStatsTracker` Class

```java
public class StageStatsTracker {
    private final String jobId;
    private final String serverId;
    private final String entityType;

    // Atomic counters per stage
    private final StageCounter reader = new StageCounter();
    private final StageCounter process = new StageCounter();
    private final StageCounter sink = new StageCounter();
    private final StageCounter vector = new StageCounter();

    // Record success/failure/warning for each stage
    public void recordReader(Result result) { reader.record(result); }
    public void recordProcess(Result result) { process.record(result); }
    public void recordSink(Result result) { sink.record(result); }
    public void recordVector(Result result) { vector.record(result); }

    // Flush to DB periodically (every N operations or time interval)
    public void flush() {
        searchIndexStatsRepository.upsert(jobId, serverId, entityType,
            reader, process, sink, vector);
    }
}

public class StageCounter {
    private final AtomicInteger success = new AtomicInteger();
    private final AtomicInteger failed = new AtomicInteger();
    private final AtomicInteger warnings = new AtomicInteger();

    public void record(Result result) {
        switch (result) {
            case SUCCESS -> success.incrementAndGet();
            case FAILED -> failed.incrementAndGet();
            case WARNING -> warnings.incrementAndGet();
        }
    }
}
```

#### Usage in Pipeline

```java
// In SearchIndexExecutor
for (Entity entity : batch) {
    // Read stage
    try {
        entity = readEntity(id);
        tracker.recordReader(SUCCESS);
    } catch (EntityNotFoundException e) {
        tracker.recordReader(WARNING);  // Non-critical, continue
        continue;
    } catch (Exception e) {
        tracker.recordReader(FAILED);   // Critical
        recordFailure(entity, READER, e);
        continue;
    }

    // Process stage
    try {
        doc = entity.buildSearchIndex();
        tracker.recordProcess(SUCCESS);
    } catch (Exception e) {
        tracker.recordProcess(FAILED);
        recordFailure(entity, PROCESS, e);
        continue;
    }

    // Sink stage - handled by BulkSink callback
    bulkSink.add(doc, entity, tracker);
}
```

### 4. Immediate Per-Entity Index Promotion

#### Current Flow (Wait for All)
```
Reindex table → Reindex dashboard → Reindex pipeline → ... → Promote ALL at once
```

#### New Flow (Promote Immediately)
```
Reindex table → Promote table immediately
Reindex dashboard → Promote dashboard immediately
Reindex pipeline → Promote pipeline immediately
```

#### Code Changes in `DefaultRecreateHandler`

```java
public class DefaultRecreateHandler implements RecreateHandler {

    // Called after EACH entity type completes (not at the end)
    public void promoteEntityIndex(String entityType, boolean success) {
        ReindexContext context = getContext();
        String stagedIndex = context.getStagedIndex(entityType);
        String canonicalIndex = context.getCanonicalIndex(entityType);

        if (!success) {
            // Delete failed staged index, keep old index active
            deleteIndex(stagedIndex);
            LOG.warn("Reindex failed for {}, keeping old index", entityType);
            return;
        }

        // Get aliases from indexMapping.json (not from old index)
        Set<String> aliases = getAliasesFromMapping(entityType);

        // Delete old indices with this prefix (except staged)
        deleteOldIndices(canonicalIndex, stagedIndex);

        // Promote: attach all aliases to staged index
        attachAliases(stagedIndex, aliases);

        LOG.info("Promoted {} -> {}", entityType, stagedIndex);
    }

    // Read aliases from indexMapping.json
    private Set<String> getAliasesFromMapping(String entityType) {
        IndexMapping mapping = indexMappings.get(entityType);
        Set<String> aliases = new HashSet<>();

        // Add parent aliases (e.g., "all", "dataAsset")
        aliases.addAll(mapping.getParentAliases());

        // Add short alias (e.g., "table")
        aliases.add(mapping.getAlias());

        // Add canonical index name as alias (e.g., "table_search_index")
        aliases.add(mapping.getIndexName());

        return aliases;
    }
}
```

### 5. Vector Bulk Processor with Payload Size Handling

```java
public class VectorBulkProcessor {
    private final List<BulkOperation> buffer = new ArrayList<>();
    private final AtomicLong currentPayloadBytes = new AtomicLong(0);

    private final int maxBulkActions;           // e.g., 500 chunks
    private final long maxPayloadSizeBytes;     // e.g., 50MB (conservative for vectors)

    public void addChunk(VectorChunk chunk, StageStatsTracker tracker) {
        long chunkSize = estimateChunkSize(chunk);

        // Flush if adding this chunk would exceed limits
        if (shouldFlush(chunkSize)) {
            flush();
        }

        buffer.add(toBulkOperation(chunk));
        currentPayloadBytes.addAndGet(chunkSize);
    }

    private boolean shouldFlush(long incomingSize) {
        return buffer.size() >= maxBulkActions
            || (currentPayloadBytes.get() + incomingSize) > maxPayloadSizeBytes;
    }

    private long estimateChunkSize(VectorChunk chunk) {
        // Vector: dimensions × 4 bytes (float32)
        long vectorSize = chunk.getEmbedding().length * 4L;
        // Metadata: estimate JSON overhead
        long metadataSize = chunk.getMetadataJson().length();
        // Buffer for ES overhead
        return (long) ((vectorSize + metadataSize) * 1.2);
    }

    public void flush() {
        if (buffer.isEmpty()) return;

        try {
            BulkResponse response = client.bulk(buffer);
            processResponse(response);  // Update stats via tracker
        } finally {
            buffer.clear();
            currentPayloadBytes.set(0);
        }
    }
}
```

### 6. Unified Failure Recording

```java
public class IndexingFailureRecorder {
    private final List<SearchIndexFailure> buffer = new ArrayList<>();
    private static final int BATCH_SIZE = 100;

    public enum FailureStage {
        READER,           // DB read failure
        READER_EXCEPTION, // Non-critical read issue
        PROCESS,          // Entity → Doc conversion failure
        SINK,             // ES/OpenSearch write failure
        VECTOR_SINK       // Vector embedding failure
    }

    public void recordFailure(
            String jobId,
            String entityType,
            String entityId,
            String entityFqn,
            FailureStage stage,
            Exception error) {

        SearchIndexFailure failure = SearchIndexFailure.builder()
            .jobId(jobId)
            .serverId(getServerId())
            .entityType(entityType)
            .entityId(entityId)
            .entityFqn(entityFqn)
            .failureStage(stage)
            .errorMessage(truncate(error.getMessage(), 65000))
            .stackTrace(truncate(getStackTrace(error), 65000))
            .timestamp(System.currentTimeMillis())
            .build();

        synchronized (buffer) {
            buffer.add(failure);
            if (buffer.size() >= BATCH_SIZE) {
                flush();
            }
        }
    }

    public void flush() {
        synchronized (buffer) {
            if (!buffer.isEmpty()) {
                repository.batchInsert(buffer);
                buffer.clear();
            }
        }
    }
}
```

## Implementation Plan

### Files to Modify

**OpenMetadata Submodule:**

| File | Changes |
|------|---------|
| `SearchIndexApp.java` | Simplify stats aggregation, remove reconciliation |
| `SearchIndexExecutor.java` | Use `StageStatsTracker`, clean pipeline flow |
| `DefaultRecreateHandler.java` | Per-entity promotion, alias from indexMapping.json |
| `OpenSearchBulkSink.java` | Integrate with `StageStatsTracker` |
| `StatsReconciler.java` | Remove or deprecate |
| DB migration | Add process/vector columns to stats table, update failure stage enum |

**Collate:**

| File | Changes |
|------|---------|
| `SearchRepositoryExt.java` | Initialize vector stats tracking |
| `OpenSearchBulkSinkExt.java` | Add payload-aware vector bulk processor |
| `ElasticSearchBulkSinkExt.java` | Same as above for ES |
| `RecreateWithEmbeddings.java` | Per-entity promotion for vector index |

### New Files to Create

| File | Purpose |
|------|---------|
| `StageStatsTracker.java` | Clean stats tracking per stage |
| `StageCounter.java` | Atomic counter for success/failed/warnings |
| `VectorBulkProcessor.java` | Payload-aware bulk processor for vectors |
| `PipelineStats.java` | Stats data model |

### Implementation Order

1. DB migrations (add columns, backward compatible)
2. `StageStatsTracker` and `StageCounter` (new code, no breaking changes)
3. Update `SearchIndexExecutor` to use new tracker
4. Update `DefaultRecreateHandler` for per-entity promotion
5. Add `VectorBulkProcessor` in Collate
6. Update `OpenSearchBulkSinkExt` for vector stats
7. Remove old reconciliation code
