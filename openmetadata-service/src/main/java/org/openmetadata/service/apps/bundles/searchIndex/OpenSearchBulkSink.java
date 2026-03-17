package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.RECREATE_CONTEXT;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TARGET_INDEX_KEY;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchAsyncClient;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;

/**
 * OpenSearch implementation using new Java API client with custom bulk handler
 */
@Slf4j
public class OpenSearchBulkSink implements BulkSink {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER =
      new JacksonJsonpMapper(OBJECT_MAPPER);
  private static final int DEFAULT_DOC_BUILD_POOL_SIZE =
      Math.min(50, Runtime.getRuntime().availableProcessors() * 4);
  private static final ThreadPoolExecutor DOC_BUILD_EXECUTOR =
      createDocBuildExecutor(DEFAULT_DOC_BUILD_POOL_SIZE);

  private static ThreadPoolExecutor createDocBuildExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            Thread.ofVirtual().name("reindex-os-doc-build-", 0).factory());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  public static synchronized void setDocBuildPoolSize(int size) {
    int newSize = Math.max(1, Math.min(50, size));
    if (newSize <= DOC_BUILD_EXECUTOR.getMaximumPoolSize()) {
      DOC_BUILD_EXECUTOR.setCorePoolSize(newSize);
      DOC_BUILD_EXECUTOR.setMaximumPoolSize(newSize);
    } else {
      DOC_BUILD_EXECUTOR.setMaximumPoolSize(newSize);
      DOC_BUILD_EXECUTOR.setCorePoolSize(newSize);
    }
    LOG.info("OpenSearch doc-build pool resized to {} threads", newSize);
  }

  public static synchronized void resetDocBuildPoolSize() {
    setDocBuildPoolSize(DEFAULT_DOC_BUILD_POOL_SIZE);
  }

  /** Callback interface for reporting sink statistics per entity type. */
  public interface SinkStatsCallback {
    void onSuccess(String entityType, int count);

    void onFailure(String entityType, int count);
  }

  private final OpenSearchClient searchClient;
  protected final SearchRepository searchRepository;
  private final CustomBulkProcessor bulkProcessor;
  private final StepStats stats = new StepStats();

  // Track metrics
  private final AtomicLong totalSubmitted = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);

  // Process stage metrics (document building/transformation)
  private final AtomicLong processSuccess = new AtomicLong(0);
  private final AtomicLong processFailed = new AtomicLong(0);

  // Configuration
  private volatile int batchSize;
  private volatile int maxConcurrentRequests;

  // Failure callback
  private volatile FailureCallback failureCallback;

  // Stats callback for per-entity-type reporting
  private volatile SinkStatsCallback statsCallback;

  // Vector embedding stats (incremented inline during addEntity)
  private final AtomicLong vectorSuccess = new AtomicLong(0);
  private final AtomicLong vectorFailed = new AtomicLong(0);

  // Column indexing: separate bulk processor with its own lifecycle
  private final CustomBulkProcessor columnBulkProcessor;
  private final AtomicLong columnSinkSubmitted = new AtomicLong(0);
  private final AtomicLong columnSinkSuccess = new AtomicLong(0);
  private final AtomicLong columnSinkFailed = new AtomicLong(0);
  private final AtomicLong columnBuildFailed = new AtomicLong(0);
  private final ConcurrentLinkedDeque<CompletableFuture<Void>> pendingColumnFutures =
      new ConcurrentLinkedDeque<>();

  public OpenSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (OpenSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;

    // Initialize stats
    stats.withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);

    // Create bulk processor
    this.bulkProcessor = createBulkProcessor(batchSize, maxConcurrentRequests, maxPayloadSizeBytes);
    this.columnBulkProcessor = createColumnBulkProcessor(maxPayloadSizeBytes);
  }

  private CustomBulkProcessor createBulkProcessor(
      int bulkActions, int concurrentRequests, long maxPayloadSizeBytes) {
    LOG.info(
        "Creating CustomBulkProcessor with batch size {}, {} concurrent requests, max payload {} MB",
        bulkActions,
        concurrentRequests,
        maxPayloadSizeBytes / (1024 * 1024));

    BulkCircuitBreaker circuitBreaker = new BulkCircuitBreaker(5, 30_000, 10_000);
    return new CustomBulkProcessor(
        searchClient,
        bulkActions,
        maxPayloadSizeBytes,
        concurrentRequests,
        1000, // 1 second flush interval
        100, // 100ms initial backoff
        3, // 3 retries
        totalSubmitted,
        totalSuccess,
        totalFailed,
        this::updateStats,
        circuitBreaker);
  }

  private CustomBulkProcessor createColumnBulkProcessor(long maxPayloadSizeBytes) {
    BulkCircuitBreaker circuitBreaker = new BulkCircuitBreaker(5, 30_000, 10_000);
    return new CustomBulkProcessor(
        searchClient,
        500, // larger batch for small column docs
        maxPayloadSizeBytes,
        2, // fewer concurrent requests
        1000,
        100,
        3,
        columnSinkSubmitted,
        columnSinkSuccess,
        columnSinkFailed,
        () -> {},
        circuitBreaker);
  }

  @Override
  @SuppressWarnings("unchecked")
  public void write(List<?> entities, Map<String, Object> contextData) throws Exception {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (entityType == null) {
      throw new IllegalArgumentException("Entity type is required in context data");
    }

    Boolean recreateIndex = (Boolean) contextData.getOrDefault("recreateIndex", false);

    // Extract StageStatsTracker from context for stats recording
    StageStatsTracker tracker = extractTracker(contextData);

    // Check if embeddings are enabled for this specific entity type
    boolean embeddingsEnabled = isVectorEmbeddingEnabledForEntity(entityType);

    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    if (indexMapping == null) {
      LOG.warn(
          "No index mapping found for entityType '{}'. Skipping {} entities without recording stats.",
          entityType,
          entities.size());
      return;
    }

    if (tracker == null) {
      LOG.warn(
          "No StageStatsTracker found in context for entityType '{}'. Stats will not be recorded for {} entities.",
          entityType,
          entities.size());
    }

    String indexName =
        (String)
            contextData.getOrDefault(
                TARGET_INDEX_KEY, indexMapping.getIndexName(searchRepository.getClusterAlias()));

    try {
      // Check if these are time series entities
      if (!entities.isEmpty() && entities.get(0) instanceof EntityTimeSeriesInterface) {
        List<EntityTimeSeriesInterface> tsEntities = (List<EntityTimeSeriesInterface>) entities;
        List<CompletableFuture<Void>> futures =
            tsEntities.stream()
                .map(
                    entity ->
                        CompletableFuture.runAsync(
                            () -> addTimeSeriesEntity(entity, indexName, entityType, tracker),
                            DOC_BUILD_EXECUTOR))
                .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
      } else {
        List<EntityInterface> entityInterfaces = (List<EntityInterface>) entities;
        ReindexContext reindexContext =
            contextData.containsKey(RECREATE_CONTEXT)
                ? (ReindexContext) contextData.get(RECREATE_CONTEXT)
                : null;

        // Pre-fetch fingerprints for batch optimization (skip during recreate — fresh index)
        Map<String, String> existingFingerprints = Collections.emptyMap();
        if (embeddingsEnabled && !recreateIndex) {
          existingFingerprints =
              fetchExistingFingerprints(entityInterfaces, indexName, reindexContext);
        }

        // Add entities to search index in parallel
        Map<String, String> finalFingerprints = existingFingerprints;
        List<CompletableFuture<Void>> futures =
            entityInterfaces.stream()
                .map(
                    entity ->
                        CompletableFuture.runAsync(
                            () ->
                                addEntity(
                                    entity,
                                    indexName,
                                    recreateIndex,
                                    reindexContext,
                                    tracker,
                                    embeddingsEnabled,
                                    finalFingerprints),
                            DOC_BUILD_EXECUTOR))
                .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

        // Index columns asynchronously when processing table entities
        if (Entity.TABLE.equals(entityType)) {
          for (EntityInterface entity : entityInterfaces) {
            CompletableFuture<Void> future =
                CompletableFuture.runAsync(
                        () -> indexTableColumns(entity, recreateIndex, reindexContext),
                        DOC_BUILD_EXECUTOR)
                    .exceptionally(
                        ex -> {
                          LOG.error("Failed to index columns for table {}", entity.getName(), ex);
                          return null;
                        });
            pendingColumnFutures.add(future);
          }
          pendingColumnFutures.removeIf(CompletableFuture::isDone);
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to write {} entities of type {}", entities.size(), entityType, e);

      // Create an IndexingError for compatibility
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.SINK)
              .withSubmittedCount(entities.size())
              .withSuccessCount(0)
              .withFailedCount(entities.size())
              .withMessage(e.getMessage());

      throw new SearchIndexException(error);
    }
  }

  protected StageStatsTracker extractTracker(Map<String, Object> contextData) {
    if (contextData != null && contextData.containsKey(STATS_TRACKER_CONTEXT_KEY)) {
      Object tracker = contextData.get(STATS_TRACKER_CONTEXT_KEY);
      if (tracker instanceof StageStatsTracker stageTracker) {
        return stageTracker;
      }
    }
    return null;
  }

  private static final int BULK_OPERATION_METADATA_OVERHEAD = 50;

  private void addEntity(
      EntityInterface entity,
      String indexName,
      boolean recreateIndex,
      ReindexContext reindexContext,
      StageStatsTracker tracker,
      boolean embeddingsEnabled,
      Map<String, String> existingFingerprints) {
    try {
      String entityType = Entity.getEntityTypeFromObject(entity);
      Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
      String json = JsonUtils.pojoToJson(searchIndexDoc);

      if (embeddingsEnabled) {
        json = enrichWithEmbedding(entity, json, recreateIndex, existingFingerprints, tracker);
      }

      String finalJson = json;
      String docId = entity.getId().toString();
      long estimatedSize =
          (long) finalJson.getBytes(StandardCharsets.UTF_8).length
              + BULK_OPERATION_METADATA_OVERHEAD;

      BulkOperation operation;
      if (recreateIndex) {
        operation =
            BulkOperation.of(
                op ->
                    op.index(
                        idx ->
                            idx.index(indexName)
                                .id(docId)
                                .document(OsUtils.toJsonData(finalJson))));
      } else {
        operation =
            BulkOperation.of(
                op ->
                    op.update(
                        upd ->
                            upd.index(indexName)
                                .id(docId)
                                .document(OsUtils.toJsonData(finalJson))
                                .docAsUpsert(true)));
      }
      if (tracker != null) {
        tracker.incrementPendingSink();
      }
      bulkProcessor.add(operation, docId, entityType, tracker, estimatedSize);
      processSuccess.incrementAndGet();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.SUCCESS);
      }
    } catch (EntityNotFoundException e) {
      LOG.error("Entity Not Found Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      processFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        String entityTypeName = Entity.getEntityTypeFromObject(entity);
        failureCallback.onFailure(
            entityTypeName,
            entity.getId() != null ? entity.getId().toString() : null,
            entity.getFullyQualifiedName(),
            e.getMessage(),
            IndexingFailureRecorder.FailureStage.PROCESS);
      }
    } catch (Exception e) {
      LOG.error(
          "Encountered Issue while building SearchDoc from Entity Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      processFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        String entityTypeName = Entity.getEntityTypeFromObject(entity);
        failureCallback.onFailure(
            entityTypeName,
            entity.getId() != null ? entity.getId().toString() : null,
            entity.getFullyQualifiedName(),
            e.getMessage(),
            IndexingFailureRecorder.FailureStage.PROCESS);
      }
    }
  }

  private void addTimeSeriesEntity(
      EntityTimeSeriesInterface entity,
      String indexName,
      String entityType,
      StageStatsTracker tracker) {
    try {
      Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
      String json = JsonUtils.pojoToJson(searchIndexDoc);
      String docId = entity.getId().toString();
      long estimatedSize =
          (long) json.getBytes(StandardCharsets.UTF_8).length + BULK_OPERATION_METADATA_OVERHEAD;

      BulkOperation operation =
          BulkOperation.of(
              op ->
                  op.index(
                      idx -> idx.index(indexName).id(docId).document(OsUtils.toJsonData(json))));

      if (tracker != null) {
        tracker.incrementPendingSink();
      }
      bulkProcessor.add(operation, docId, entityType, tracker, estimatedSize);
      processSuccess.incrementAndGet();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.SUCCESS);
      }
    } catch (EntityNotFoundException e) {
      LOG.error("Entity Not Found Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      processFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            entity.getId() != null ? entity.getId().toString() : null,
            null,
            e.getMessage(),
            IndexingFailureRecorder.FailureStage.PROCESS);
      }
    } catch (Exception e) {
      LOG.error(
          "Encountered Issue while building SearchDoc from Entity Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      processFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            entity.getId() != null ? entity.getId().toString() : null,
            null,
            e.getMessage(),
            IndexingFailureRecorder.FailureStage.PROCESS);
      }
    }
  }

  private void indexTableColumns(
      EntityInterface entity, boolean recreateIndex, ReindexContext reindexContext) {
    if (!(entity instanceof Table table)) {
      return;
    }

    IndexMapping columnIndexMapping = searchRepository.getIndexMapping(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      LOG.debug("No index mapping found for tableColumn. Skipping column indexing.");
      return;
    }

    String columnIndexName;
    if (reindexContext != null) {
      Optional<String> stagedIndex = reindexContext.getStagedIndex(Entity.TABLE_COLUMN);
      columnIndexName =
          stagedIndex.orElse(columnIndexMapping.getIndexName(searchRepository.getClusterAlias()));
    } else {
      columnIndexName = columnIndexMapping.getIndexName(searchRepository.getClusterAlias());
    }

    List<Column> flattenedColumns = ColumnSearchIndex.flattenColumns(table.getColumns());
    for (Column column : flattenedColumns) {
      try {
        ColumnSearchIndex columnIndex = new ColumnSearchIndex(column, table);
        Map<String, Object> searchIndexDoc = columnIndex.buildSearchIndexDoc();
        String json = JsonUtils.pojoToJson(searchIndexDoc);
        String docId = searchIndexDoc.get("id").toString();

        BulkOperation operation;
        if (recreateIndex) {
          operation =
              BulkOperation.of(
                  op ->
                      op.index(
                          idx ->
                              idx.index(columnIndexName)
                                  .id(docId)
                                  .document(OsUtils.toJsonData(json))));
        } else {
          operation =
              BulkOperation.of(
                  op ->
                      op.update(
                          upd ->
                              upd.index(columnIndexName)
                                  .id(docId)
                                  .document(OsUtils.toJsonData(json))
                                  .docAsUpsert(true)));
        }
        long estimatedSize =
            (long) json.getBytes(StandardCharsets.UTF_8).length + BULK_OPERATION_METADATA_OVERHEAD;
        columnBulkProcessor.add(operation, docId, Entity.TABLE_COLUMN, null, estimatedSize);
      } catch (Exception e) {
        columnBuildFailed.incrementAndGet();
        LOG.error(
            "Failed to index column {} for table {}",
            column.getFullyQualifiedName(),
            table.getFullyQualifiedName(),
            e);
      }
    }
  }

  /** Get stats for column indexing from the dedicated column bulk processor */
  public StepStats getColumnStats() {
    long success = columnSinkSuccess.get();
    long failed = columnSinkFailed.get() + columnBuildFailed.get();
    return new StepStats()
        .withTotalRecords((int) (success + failed))
        .withSuccessRecords((int) success)
        .withFailedRecords((int) failed);
  }

  private void drainPendingColumnFutures(int timeoutSeconds) {
    List<CompletableFuture<Void>> remaining = new ArrayList<>();
    CompletableFuture<Void> f;
    while ((f = pendingColumnFutures.poll()) != null) {
      if (!f.isDone()) {
        remaining.add(f);
      }
    }
    if (!remaining.isEmpty()) {
      try {
        CompletableFuture.allOf(remaining.toArray(CompletableFuture[]::new))
            .get(timeoutSeconds, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        LOG.warn("Interrupted waiting for {} in-flight column doc-build tasks", remaining.size());
        Thread.currentThread().interrupt();
      } catch (Exception e) {
        LOG.warn("Timed out waiting for {} in-flight column doc-build tasks", remaining.size());
      }
    }
  }

  private void updateStats() {
    stats.setTotalRecords((int) totalSubmitted.get());
    stats.setSuccessRecords((int) totalSuccess.get());
    stats.setFailedRecords((int) totalFailed.get());
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    // Stats are updated automatically by the bulk processor
    // This method is here for interface compatibility
  }

  @Override
  public StepStats getStats() {
    // Read directly from atomic counters for accurate real-time stats
    // Use success + failed as total to ensure invariant holds (total = success + failed)
    // This handles entity build failures which increment failed but not submitted
    long success = totalSuccess.get();
    long failed = totalFailed.get();
    return new StepStats()
        .withTotalRecords((int) (success + failed))
        .withSuccessRecords((int) success)
        .withFailedRecords((int) failed);
  }

  @Override
  public void close() {
    try {
      bulkProcessor.flush();

      // Wait for in-flight column doc-build tasks before flushing the column processor
      drainPendingColumnFutures(30);
      columnBulkProcessor.flush();

      boolean terminated = bulkProcessor.awaitClose(60, TimeUnit.SECONDS);
      if (!terminated) {
        LOG.warn("Bulk processor did not terminate within timeout");
      }

      boolean columnTerminated = columnBulkProcessor.awaitClose(30, TimeUnit.SECONDS);
      if (!columnTerminated) {
        LOG.warn("Column bulk processor did not terminate within timeout");
      }

      updateStats();

      LOG.info(
          "Sink closed - final stats: submitted={}, success={}, failed={}, columns: success={}, failed={}",
          totalSubmitted.get(),
          totalSuccess.get(),
          totalFailed.get(),
          columnSinkSuccess.get(),
          columnSinkFailed.get() + columnBuildFailed.get());

    } catch (InterruptedException e) {
      LOG.warn("Interrupted while closing bulk processor", e);
      Thread.currentThread().interrupt();
    }
  }

  @Override
  public boolean flushAndAwait(int timeoutSeconds) {
    try {
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
      boolean completed = bulkProcessor.flushAndWait(timeoutSeconds, TimeUnit.SECONDS);

      long remainingNanos = deadline - System.nanoTime();
      long remainingSecs = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(remainingNanos));
      drainPendingColumnFutures((int) remainingSecs);

      remainingNanos = deadline - System.nanoTime();
      remainingSecs = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(remainingNanos));
      boolean columnCompleted = columnBulkProcessor.flushAndWait(remainingSecs, TimeUnit.SECONDS);

      if (completed) {
        LOG.debug(
            "Flush complete - stats: submitted={}, success={}, failed={}",
            totalSubmitted.get(),
            totalSuccess.get(),
            totalFailed.get());
      }
      return completed && columnCompleted;
    } catch (InterruptedException e) {
      LOG.warn("Interrupted while waiting for flush to complete", e);
      Thread.currentThread().interrupt();
      return false;
    }
  }

  public int getBatchSize() {
    return batchSize;
  }

  public int getConcurrentRequests() {
    return maxConcurrentRequests;
  }

  @Override
  public void setFailureCallback(FailureCallback callback) {
    this.failureCallback = callback;
    if (bulkProcessor != null) {
      bulkProcessor.setFailureCallback(callback);
    }
    if (columnBulkProcessor != null) {
      columnBulkProcessor.setFailureCallback(callback);
    }
  }

  public void setStatsCallback(SinkStatsCallback callback) {
    this.statsCallback = callback;
    if (bulkProcessor != null) {
      bulkProcessor.setStatsCallback(callback);
    }
  }

  public void updateBatchSize(int newBatchSize) {
    this.batchSize = newBatchSize;
    LOG.info("Batch size updated to: {}", newBatchSize);
  }

  public void updateConcurrentRequests(int concurrentRequests) {
    this.maxConcurrentRequests = concurrentRequests;
    LOG.info("Concurrent requests updated to: {}", concurrentRequests);
  }

  boolean isVectorEmbeddingEnabledForEntity(String entityType) {
    return searchRepository.isVectorEmbeddingEnabled()
        && OpenSearchVectorService.getInstance() != null
        && AvailableEntityTypes.isVectorIndexable(entityType)
        && searchRepository.getIndexMapping(entityType) != null;
  }

  @SuppressWarnings("unchecked")
  private String enrichWithEmbedding(
      EntityInterface entity,
      String json,
      boolean recreateIndex,
      Map<String, String> existingFingerprints,
      StageStatsTracker tracker) {
    try {
      OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
      if (vectorService == null) {
        return json;
      }

      if (!recreateIndex) {
        String currentFp = VectorDocBuilder.computeFingerprintForEntity(entity);
        String existingFp = existingFingerprints.get(entity.getId().toString());
        if (existingFp != null && existingFp.equals(currentFp)) {
          vectorSuccess.incrementAndGet();
          if (tracker != null) {
            tracker.recordVector(StatsResult.SUCCESS);
          }
          return json;
        }
      }

      Map<String, Object> embeddingFields = vectorService.generateEmbeddingFields(entity);
      Map<String, Object> docMap = OBJECT_MAPPER.readValue(json, Map.class);
      docMap.putAll(embeddingFields);
      String enrichedJson = OBJECT_MAPPER.writeValueAsString(docMap);

      vectorSuccess.incrementAndGet();
      if (tracker != null) {
        tracker.recordVector(StatsResult.SUCCESS);
      }
      return enrichedJson;
    } catch (Exception e) {
      LOG.warn(
          "Failed to generate embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
      vectorFailed.incrementAndGet();
      if (tracker != null) {
        tracker.recordVector(StatsResult.FAILED);
      }
      return json;
    }
  }

  @Override
  public int getActiveBulkRequestCount() {
    return bulkProcessor.activeBulkRequests.get();
  }

  private Map<String, String> fetchExistingFingerprints(
      List<EntityInterface> entities, String indexName, ReindexContext reindexContext) {
    try {
      OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
      if (vectorService == null) {
        return Collections.emptyMap();
      }

      String entityType = entities.getFirst().getEntityReference().getType();
      String targetIndex = indexName;
      if (reindexContext != null) {
        String stagedIndex = reindexContext.getStagedIndex(entityType).orElse(null);
        if (stagedIndex != null) {
          targetIndex = stagedIndex;
        }
      }

      List<String> entityIds = new ArrayList<>(entities.size());
      for (EntityInterface entity : entities) {
        entityIds.add(entity.getId().toString());
      }
      return vectorService.getExistingFingerprintsBatch(targetIndex, entityIds);
    } catch (Exception e) {
      LOG.warn("Failed to fetch existing fingerprints: {}", e.getMessage());
      return Collections.emptyMap();
    }
  }

  @Override
  public StepStats getVectorStats() {
    return new StepStats()
        .withTotalRecords((int) (vectorSuccess.get() + vectorFailed.get()))
        .withSuccessRecords((int) vectorSuccess.get())
        .withFailedRecords((int) vectorFailed.get());
  }

  @Override
  public StepStats getProcessStats() {
    long success = processSuccess.get();
    long failed = processFailed.get();
    return new StepStats()
        .withTotalRecords((int) (success + failed))
        .withSuccessRecords((int) success)
        .withFailedRecords((int) failed);
  }

  public static class CustomBulkProcessor {
    private final OpenSearchAsyncClient asyncClient;
    private final List<BulkOperation> buffer = new ArrayList<>();

    /** Maps docId to entityType for failure reporting */
    private final ConcurrentHashMap<String, String> docIdToEntityType = new ConcurrentHashMap<>();

    /** Maps docId to StageStatsTracker for sink stats recording */
    private final ConcurrentHashMap<String, StageStatsTracker> docIdToTracker =
        new ConcurrentHashMap<>();

    private long currentBufferSize = 0;
    private final Lock lock = new ReentrantLock();
    private final int bulkActions;
    private final long maxPayloadSizeBytes;
    private final Semaphore concurrentRequestSemaphore;
    private final AtomicInteger activeBulkRequests = new AtomicInteger(0);
    private final AtomicLong executionIdCounter = new AtomicLong(0);
    private final ScheduledExecutorService scheduler;
    private final AtomicLong totalSubmitted;
    private final AtomicLong totalSuccess;
    private final AtomicLong totalFailed;
    private final Runnable statsUpdater;
    private final long initialBackoffMillis;
    private final int maxRetries;
    private volatile boolean closed = false;
    private volatile FailureCallback failureCallback;
    private volatile SinkStatsCallback statsCallback;
    private final BulkCircuitBreaker circuitBreaker;

    CustomBulkProcessor(
        OpenSearchClient client,
        int bulkActions,
        long maxPayloadSizeBytes,
        int concurrentRequests,
        long flushIntervalMillis,
        long initialBackoffMillis,
        int maxRetries,
        AtomicLong totalSubmitted,
        AtomicLong totalSuccess,
        AtomicLong totalFailed,
        Runnable statsUpdater,
        BulkCircuitBreaker circuitBreaker) {
      this.asyncClient = new OpenSearchAsyncClient(client.getNewClient()._transport());
      this.bulkActions = bulkActions;
      this.maxPayloadSizeBytes = maxPayloadSizeBytes;
      this.concurrentRequestSemaphore = new Semaphore(concurrentRequests);
      this.initialBackoffMillis = initialBackoffMillis;
      this.maxRetries = maxRetries;
      this.totalSubmitted = totalSubmitted;
      this.totalSuccess = totalSuccess;
      this.totalFailed = totalFailed;
      this.statsUpdater = statsUpdater;
      this.circuitBreaker = circuitBreaker;
      this.scheduler = Executors.newScheduledThreadPool(1);

      scheduler.scheduleAtFixedRate(
          this::flushIfNeeded, flushIntervalMillis, flushIntervalMillis, TimeUnit.MILLISECONDS);
    }

    void setFailureCallback(FailureCallback callback) {
      this.failureCallback = callback;
    }

    void setStatsCallback(SinkStatsCallback callback) {
      this.statsCallback = callback;
    }

    void add(BulkOperation operation) {
      add(operation, null, null, null);
    }

    void add(BulkOperation operation, String docId, String entityType, StageStatsTracker tracker) {
      add(operation, docId, entityType, tracker, -1);
    }

    void add(
        BulkOperation operation,
        String docId,
        String entityType,
        StageStatsTracker tracker,
        long estimatedSizeBytes) {
      lock.lock();
      try {
        if (closed) {
          throw new IllegalStateException("Bulk processor is closed");
        }

        if (docId != null) {
          if (entityType != null) {
            docIdToEntityType.put(docId, entityType);
          }
          if (tracker != null) {
            docIdToTracker.put(docId, tracker);
          }
        }

        long operationSize =
            estimatedSizeBytes > 0 ? estimatedSizeBytes : estimateOperationSize(operation);
        buffer.add(operation);
        currentBufferSize += operationSize;

        if (buffer.size() >= bulkActions || currentBufferSize >= maxPayloadSizeBytes) {
          flushInternal();
        }
      } finally {
        lock.unlock();
      }
    }

    private long estimateOperationSize(BulkOperation operation) {
      try {
        StringWriter writer = new StringWriter();
        JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
        operation.serialize(generator, JACKSON_JSONP_MAPPER);
        generator.close();
        return writer.toString().getBytes(StandardCharsets.UTF_8).length;
      } catch (Exception e) {
        LOG.warn("Failed to estimate bulk operation size, using default: {}", e.getMessage());
        return 1024;
      }
    }

    void flush() {
      lock.lock();
      try {
        if (!buffer.isEmpty()) {
          flushInternal();
        }
      } finally {
        lock.unlock();
      }
    }

    /**
     * Flush pending requests and wait for all active bulk requests to complete. Unlike awaitClose,
     * this does not close the processor - it can continue to be used after this call.
     *
     * @param timeout Maximum time to wait
     * @param unit Time unit for timeout
     * @return true if all requests completed within timeout
     */
    boolean flushAndWait(long timeout, TimeUnit unit) throws InterruptedException {
      flush();

      long timeoutMillis = unit.toMillis(timeout);
      long startTime = System.currentTimeMillis();

      // Wait for all active bulk requests to complete
      while (activeBulkRequests.get() > 0) {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed >= timeoutMillis) {
          LOG.warn(
              "Timeout waiting for {} active bulk requests to complete", activeBulkRequests.get());
          return false;
        }
        Thread.sleep(100);
      }
      return true;
    }

    private void flushIfNeeded() {
      lock.lock();
      try {
        if (!buffer.isEmpty() && !closed) {
          flushInternal();
        }
      } finally {
        lock.unlock();
      }
    }

    private void flushInternal() {
      if (buffer.isEmpty()) {
        return;
      }

      List<BulkOperation> toFlush = new ArrayList<>(buffer);
      long payloadSize = currentBufferSize;
      buffer.clear();
      currentBufferSize = 0;

      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      if (metrics != null) {
        metrics.recordPayloadSize(payloadSize);
        metrics.incrementPendingBulkRequests();
      }

      long executionId = executionIdCounter.incrementAndGet();
      int numberOfActions = toFlush.size();
      totalSubmitted.addAndGet(numberOfActions);

      LOG.debug("Executing bulk request {} with {} actions", executionId, numberOfActions);

      try {
        concurrentRequestSemaphore.acquire();
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for semaphore", e);
        Thread.currentThread().interrupt();
        totalFailed.addAndGet(numberOfActions);
        return;
      }

      activeBulkRequests.incrementAndGet();
      executeBulkWithRetry(toFlush, executionId, numberOfActions, 0);
    }

    private void executeBulkWithRetry(
        List<BulkOperation> operations, long executionId, int numberOfActions, int attemptNumber) {
      if (!circuitBreaker.allowRequest()) {
        LOG.warn(
            "Circuit breaker OPEN - fail-fast for bulk request {} with {} actions",
            executionId,
            numberOfActions);
        totalFailed.addAndGet(numberOfActions);
        statsUpdater.run();
        activeBulkRequests.decrementAndGet();
        concurrentRequestSemaphore.release();
        ReindexingMetrics metrics = ReindexingMetrics.getInstance();
        if (metrics != null) {
          metrics.decrementPendingBulkRequests();
        }
        return;
      }

      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      io.micrometer.core.instrument.Timer.Sample bulkTimerSample =
          metrics != null ? metrics.startBulkRequestTimer() : null;

      CompletableFuture<BulkResponse> future;
      try {
        future = asyncClient.bulk(b -> b.operations(operations).refresh(Refresh.False));
      } catch (IOException e) {
        if (metrics != null && bulkTimerSample != null) {
          metrics.recordBulkRequestCompleted(bulkTimerSample, false);
        }
        circuitBreaker.recordFailure();
        boolean retryScheduled =
            handleBulkFailure(operations, executionId, numberOfActions, attemptNumber, e);
        if (!retryScheduled) {
          activeBulkRequests.decrementAndGet();
          concurrentRequestSemaphore.release();
          if (metrics != null) {
            metrics.decrementPendingBulkRequests();
          }
        }
        return;
      }

      future.whenComplete(
          (response, error) -> {
            boolean retryScheduled = false;
            try {
              if (error != null) {
                if (metrics != null && bulkTimerSample != null) {
                  metrics.recordBulkRequestCompleted(bulkTimerSample, false);
                }
                circuitBreaker.recordFailure();
                retryScheduled =
                    handleBulkFailure(
                        operations, executionId, numberOfActions, attemptNumber, error);
              } else if (response.errors()) {
                if (metrics != null && bulkTimerSample != null) {
                  metrics.recordBulkRequestCompleted(bulkTimerSample, false);
                }
                circuitBreaker.recordSuccess();
                handlePartialFailure(response, executionId, numberOfActions);
              } else {
                if (metrics != null && bulkTimerSample != null) {
                  metrics.recordBulkRequestCompleted(bulkTimerSample, true);
                }
                circuitBreaker.recordSuccess();
                totalSuccess.addAndGet(numberOfActions);
                LOG.debug(
                    "Bulk request {} completed successfully with {} actions",
                    executionId,
                    numberOfActions);
                reportSuccessByEntityType(operations);
                statsUpdater.run();
              }
            } finally {
              if (!retryScheduled) {
                activeBulkRequests.decrementAndGet();
                concurrentRequestSemaphore.release();
                if (metrics != null) {
                  metrics.decrementPendingBulkRequests();
                }
              }
            }
          });
    }

    private boolean handleBulkFailure(
        List<BulkOperation> operations,
        long executionId,
        int numberOfActions,
        int attemptNumber,
        Throwable error) {
      if (shouldRetry(attemptNumber, error)
          && circuitBreaker.getState() != BulkCircuitBreaker.State.OPEN) {
        long backoffTime = calculateBackoff(attemptNumber);
        LOG.warn(
            "Bulk request {} failed (attempt {}), retrying in {}ms: {}",
            executionId,
            attemptNumber + 1,
            backoffTime,
            error.getMessage());

        scheduler.schedule(
            () -> executeBulkWithRetry(operations, executionId, numberOfActions, attemptNumber + 1),
            backoffTime,
            TimeUnit.MILLISECONDS);
        return true;
      } else {
        totalFailed.addAndGet(numberOfActions);
        LOG.error(
            "Bulk request {} failed completely after {} attempts with {} actions",
            executionId,
            attemptNumber + 1,
            numberOfActions,
            error);

        // Report failures via callback, stats callback, and tracker
        Map<String, Integer> failuresByType = new ConcurrentHashMap<>();
        for (BulkOperation op : operations) {
          String docId = getDocId(op);
          if (docId != null) {
            String entityType = docIdToEntityType.remove(docId);
            if (entityType == null) {
              entityType = extractEntityTypeFromIndex(getIndex(op));
            }
            failuresByType.merge(entityType, 1, Integer::sum);
            // Record SINK failure via tracker
            StageStatsTracker tracker = docIdToTracker.remove(docId);
            if (tracker != null) {
              tracker.recordSink(StatsResult.FAILED);
            }
            if (failureCallback != null) {
              failureCallback.onFailure(
                  entityType,
                  docId,
                  null,
                  error.getMessage(),
                  IndexingFailureRecorder.FailureStage.SINK);
            }
          }
        }
        if (statsCallback != null) {
          for (Map.Entry<String, Integer> entry : failuresByType.entrySet()) {
            statsCallback.onFailure(entry.getKey(), entry.getValue());
          }
        }
        statsUpdater.run();
        return false;
      }
    }

    private void handlePartialFailure(
        BulkResponse response, long executionId, int numberOfActions) {
      int failures = 0;
      Map<String, Integer> successesByType = new ConcurrentHashMap<>();
      Map<String, Integer> failuresByType = new ConcurrentHashMap<>();
      for (BulkResponseItem item : response.items()) {
        String docId = item.id();
        StageStatsTracker tracker = docId != null ? docIdToTracker.remove(docId) : null;
        if (item.error() != null) {
          failures++;
          String failureMessage = item.error().reason();
          if (failureMessage != null && failureMessage.contains("document_missing_exception")) {
            LOG.warn(
                "Document missing error for {}: {} - This may occur during concurrent reindexing",
                docId,
                failureMessage);
          } else {
            LOG.warn("Failed to index document {}: {}", docId, failureMessage);
          }
          String entityType = docId != null ? docIdToEntityType.remove(docId) : null;
          if (entityType == null) {
            entityType = extractEntityTypeFromIndex(item.index());
          }
          failuresByType.merge(entityType, 1, Integer::sum);
          if (tracker != null) {
            tracker.recordSink(StatsResult.FAILED);
          }
          if (failureCallback != null) {
            failureCallback.onFailure(
                entityType, docId, null, failureMessage, IndexingFailureRecorder.FailureStage.SINK);
          }
        } else {
          String entityType = docId != null ? docIdToEntityType.remove(docId) : null;
          if (entityType == null) {
            entityType = extractEntityTypeFromIndex(item.index());
          }
          successesByType.merge(entityType, 1, Integer::sum);
          if (tracker != null) {
            tracker.recordSink(StatsResult.SUCCESS);
          }
        }
      }
      int successes = numberOfActions - failures;
      totalSuccess.addAndGet(successes);
      totalFailed.addAndGet(failures);

      if (statsCallback != null) {
        for (Map.Entry<String, Integer> entry : successesByType.entrySet()) {
          statsCallback.onSuccess(entry.getKey(), entry.getValue());
        }
        for (Map.Entry<String, Integer> entry : failuresByType.entrySet()) {
          statsCallback.onFailure(entry.getKey(), entry.getValue());
        }
      }

      LOG.warn(
          "Bulk request {} completed with {} failures out of {} actions",
          executionId,
          failures,
          numberOfActions);
      statsUpdater.run();
    }

    private void reportSuccessByEntityType(List<BulkOperation> operations) {
      Map<String, Integer> successesByType = new ConcurrentHashMap<>();
      for (BulkOperation op : operations) {
        String docId = getDocId(op);
        String entityType = docId != null ? docIdToEntityType.remove(docId) : null;
        if (entityType == null) {
          entityType = extractEntityTypeFromIndex(getIndex(op));
        }
        successesByType.merge(entityType, 1, Integer::sum);
        // Record SINK success via tracker
        StageStatsTracker tracker = docId != null ? docIdToTracker.remove(docId) : null;
        if (tracker != null) {
          tracker.recordSink(StatsResult.SUCCESS);
        }
      }
      if (statsCallback != null) {
        for (Map.Entry<String, Integer> entry : successesByType.entrySet()) {
          statsCallback.onSuccess(entry.getKey(), entry.getValue());
        }
      }
    }

    private String getDocId(BulkOperation op) {
      if (op.isIndex()) return op.index().id();
      if (op.isUpdate()) return op.update().id();
      if (op.isDelete()) return op.delete().id();
      return null;
    }

    private String getIndex(BulkOperation op) {
      if (op.isIndex()) return op.index().index();
      if (op.isUpdate()) return op.update().index();
      if (op.isDelete()) return op.delete().index();
      return null;
    }

    private String extractEntityTypeFromIndex(String indexName) {
      if (indexName == null || indexName.isEmpty()) {
        return "unknown";
      }
      // Index names may be like "table_search_index" or "mlmodel_search_index_rebuild_123456"
      // Remove "_search_index" suffix and any rebuild timestamp
      String searchIndexSuffix = "_search_index";
      int searchIndexPos = indexName.indexOf(searchIndexSuffix);
      if (searchIndexPos > 0) {
        return indexName.substring(0, searchIndexPos);
      }
      return indexName;
    }

    private boolean shouldRetry(int attemptNumber, Throwable error) {
      if (attemptNumber >= maxRetries) {
        return false;
      }
      String errorMessage = error.getMessage();
      if (errorMessage == null) {
        return true;
      }
      String lowerCaseMessage = errorMessage.toLowerCase();
      return lowerCaseMessage.contains("rejected_execution_exception")
          || lowerCaseMessage.contains("esrejectedexecutionexception")
          || lowerCaseMessage.contains("remotetransportexception")
          || lowerCaseMessage.contains("connectexception")
          || lowerCaseMessage.contains("timeout")
          || lowerCaseMessage.contains("request entity too large")
          || lowerCaseMessage.contains("content too long")
          || lowerCaseMessage.contains("413")
          || lowerCaseMessage.contains("circuit_breaking_exception")
          || lowerCaseMessage.contains("too_many_requests");
    }

    boolean isPayloadTooLargeError(Throwable error) {
      if (error == null || error.getMessage() == null) {
        return false;
      }
      String lowerCaseMessage = error.getMessage().toLowerCase();
      return lowerCaseMessage.contains("request entity too large")
          || lowerCaseMessage.contains("content too long")
          || lowerCaseMessage.contains("413");
    }

    private long calculateBackoff(int attemptNumber) {
      return initialBackoffMillis * (long) Math.pow(2, attemptNumber);
    }

    boolean awaitClose(long timeout, TimeUnit unit) throws InterruptedException {
      closed = true;
      flush();
      scheduler.shutdown();

      long timeoutMillis = unit.toMillis(timeout);
      long startTime = System.currentTimeMillis();

      // Wait for all active bulk requests to complete
      while (activeBulkRequests.get() > 0) {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed >= timeoutMillis) {
          LOG.warn(
              "Timeout waiting for {} active bulk requests to complete", activeBulkRequests.get());
          return false;
        }
        Thread.sleep(100);
      }

      return scheduler.awaitTermination(
          timeoutMillis - (System.currentTimeMillis() - startTime), TimeUnit.MILLISECONDS);
    }
  }
}
