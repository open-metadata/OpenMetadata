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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Phaser;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.VectorBulkProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
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

  /** Callback interface for reporting sink statistics per entity type. */
  public interface SinkStatsCallback {
    void onSuccess(String entityType, int count);

    void onFailure(String entityType, int count);
  }

  private static final int MAX_VECTOR_THREADS = 10;

  private final OpenSearchClient searchClient;
  protected final SearchRepository searchRepository;
  private final CustomBulkProcessor bulkProcessor;
  private final StepStats stats = new StepStats();

  // Track metrics
  private final AtomicLong totalSubmitted = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);

  // Configuration
  private volatile int batchSize;
  private volatile int maxConcurrentRequests;

  // Failure callback
  private volatile FailureCallback failureCallback;

  // Stats callback for per-entity-type reporting
  private volatile SinkStatsCallback statsCallback;

  // Vector embedding fields
  private final ExecutorService vectorExecutor;
  private final Phaser phaser;
  private final CopyOnWriteArrayList<Thread> pendingThreads;
  private final AtomicLong vectorSuccess = new AtomicLong(0);
  private final AtomicLong vectorFailed = new AtomicLong(0);
  private VectorBulkProcessor vectorBulkProcessor;

  public OpenSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (OpenSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.vectorExecutor =
        Executors.newFixedThreadPool(MAX_VECTOR_THREADS, Thread.ofVirtual().factory());
    this.phaser = new Phaser(1);
    this.pendingThreads = new CopyOnWriteArrayList<>();

    // Initialize stats
    stats.withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);

    // Create bulk processor
    this.bulkProcessor = createBulkProcessor(batchSize, maxConcurrentRequests, maxPayloadSizeBytes);
  }

  private CustomBulkProcessor createBulkProcessor(
      int bulkActions, int concurrentRequests, long maxPayloadSizeBytes) {
    LOG.info(
        "Creating CustomBulkProcessor with batch size {}, {} concurrent requests, max payload {} MB",
        bulkActions,
        concurrentRequests,
        maxPayloadSizeBytes / (1024 * 1024));

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
        this::updateStats);
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
        for (EntityTimeSeriesInterface entity : tsEntities) {
          addTimeSeriesEntity(entity, indexName, entityType, tracker);
        }
      } else {
        List<EntityInterface> entityInterfaces = (List<EntityInterface>) entities;
        ReindexContext reindexContext =
            contextData.containsKey(RECREATE_CONTEXT)
                ? (ReindexContext) contextData.get(RECREATE_CONTEXT)
                : null;

        // Add entities to search index
        for (EntityInterface entity : entityInterfaces) {
          addEntity(entity, indexName, recreateIndex, reindexContext, tracker);
        }

        // Process vector embeddings in batch (no-op in base class)
        if (embeddingsEnabled) {
          addEntitiesToVectorIndexBatch(
              bulkProcessor, entityInterfaces, recreateIndex, reindexContext);
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
      StageStatsTracker tracker) {
    try {
      String entityType = Entity.getEntityTypeFromObject(entity);
      Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
      String json = JsonUtils.pojoToJson(searchIndexDoc);
      String docId = entity.getId().toString();
      long estimatedSize =
          (long) json.getBytes(StandardCharsets.UTF_8).length + BULK_OPERATION_METADATA_OVERHEAD;

      BulkOperation operation;
      if (recreateIndex) {
        operation =
            BulkOperation.of(
                op ->
                    op.index(
                        idx -> idx.index(indexName).id(docId).document(OsUtils.toJsonData(json))));
      } else {
        operation =
            BulkOperation.of(
                op ->
                    op.update(
                        upd ->
                            upd.index(indexName)
                                .id(docId)
                                .document(OsUtils.toJsonData(json))
                                .docAsUpsert(true)));
      }
      if (tracker != null) {
        tracker.incrementPendingSink();
      }
      bulkProcessor.add(operation, docId, entityType, tracker, estimatedSize);
      if (tracker != null) {
        tracker.recordProcess(StatsResult.SUCCESS);
      }
    } catch (EntityNotFoundException e) {
      LOG.error("Entity Not Found Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
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
            e.getMessage());
      }
    } catch (Exception e) {
      LOG.error(
          "Encountered Issue while building SearchDoc from Entity Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
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
            e.getMessage());
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
      if (tracker != null) {
        tracker.recordProcess(StatsResult.SUCCESS);
      }
    } catch (EntityNotFoundException e) {
      LOG.error("Entity Not Found Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            entity.getId() != null ? entity.getId().toString() : null,
            null,
            e.getMessage());
      }
    } catch (Exception e) {
      LOG.error(
          "Encountered Issue while building SearchDoc from Entity Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            entity.getId() != null ? entity.getId().toString() : null,
            null,
            e.getMessage());
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
      awaitVectorCompletion(300);
    } catch (Exception e) {
      LOG.warn("Error awaiting vector completion during close: {}", e.getMessage());
    }

    if (vectorBulkProcessor != null) {
      vectorBulkProcessor.close();
    }

    vectorExecutor.shutdown();
    try {
      if (!vectorExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
        vectorExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      vectorExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }

    try {
      bulkProcessor.flush();

      boolean terminated = bulkProcessor.awaitClose(60, TimeUnit.SECONDS);
      if (!terminated) {
        LOG.warn("Bulk processor did not terminate within timeout");
      }

      updateStats();

      LOG.info(
          "Sink closed - final stats: submitted={}, success={}, failed={}",
          totalSubmitted.get(),
          totalSuccess.get(),
          totalFailed.get());

    } catch (InterruptedException e) {
      LOG.warn("Interrupted while closing bulk processor", e);
      Thread.currentThread().interrupt();
    }
  }

  @Override
  public boolean flushAndAwait(int timeoutSeconds) {
    try {
      boolean completed = bulkProcessor.flushAndWait(timeoutSeconds, TimeUnit.SECONDS);
      if (completed) {
        LOG.debug(
            "Flush complete - stats: submitted={}, success={}, failed={}",
            totalSubmitted.get(),
            totalSuccess.get(),
            totalFailed.get());
      }
      return completed;
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
        && AvailableEntityTypes.isVectorIndexable(entityType);
  }

  void addEntitiesToVectorIndexBatch(
      CustomBulkProcessor bulkProcessor,
      List<EntityInterface> entities,
      boolean recreateIndex,
      ReindexContext reindexContext) {
    if (entities.isEmpty()) {
      return;
    }

    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      return;
    }

    String entityType = entities.getFirst().getEntityReference().getType();
    if (!AvailableEntityTypes.isVectorIndexable(entityType)) {
      return;
    }

    String canonicalIndex = VectorIndexService.getClusteredIndexName();
    String finalTargetIndex = canonicalIndex;
    String finalSourceIndex = null;

    if (reindexContext != null) {
      String stagedIndex =
          reindexContext.getStagedIndex(VectorIndexService.VECTOR_INDEX_KEY).orElse(null);
      if (stagedIndex != null) {
        finalSourceIndex = canonicalIndex;
        finalTargetIndex = stagedIndex;
      }
    }

    String srcIdx = finalSourceIndex;
    String tgtIdx = finalTargetIndex;

    Map<String, String> existingFingerprints = Map.of();
    if (srcIdx != null) {
      List<String> parentIds = new ArrayList<>(entities.size());
      for (EntityInterface entity : entities) {
        parentIds.add(entity.getId().toString());
      }
      existingFingerprints = vectorService.getExistingFingerprintsBatch(srcIdx, parentIds);
    }

    for (EntityInterface entity : entities) {
      String parentId = entity.getId().toString();
      String existingFp = existingFingerprints.get(parentId);
      String currentFp = VectorDocBuilder.computeFingerprintForEntity(entity);

      if (existingFp != null && existingFp.equals(currentFp) && srcIdx != null) {
        submitVectorTask(
            () -> processMigration(vectorService, srcIdx, tgtIdx, parentId, currentFp, entity));
      } else {
        submitVectorTask(() -> processEmbedding(vectorService, entity, tgtIdx));
      }
    }
  }

  private void processMigration(
      OpenSearchVectorService vectorService,
      String sourceIndex,
      String targetIndex,
      String parentId,
      String fingerprint,
      EntityInterface entity) {
    try {
      if (vectorService.copyExistingVectorDocuments(
          sourceIndex, targetIndex, parentId, fingerprint)) {
        vectorSuccess.incrementAndGet();
      } else {
        processEmbedding(vectorService, entity, targetIndex);
      }
    } catch (Exception e) {
      LOG.warn(
          "Vector migration failed for parent_id={}, falling back to recomputation: {}",
          parentId,
          e.getMessage());
      processEmbedding(vectorService, entity, targetIndex);
    }
  }

  private void processEmbedding(
      OpenSearchVectorService vectorService, EntityInterface entity, String targetIndex) {
    try {
      vectorService.updateVectorEmbeddings(entity, targetIndex);
      vectorSuccess.incrementAndGet();
    } catch (Exception e) {
      vectorFailed.incrementAndGet();
      LOG.error("Vector embedding failed for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private void submitVectorTask(Runnable task) {
    phaser.register();
    vectorExecutor.submit(
        () -> {
          Thread current = Thread.currentThread();
          pendingThreads.add(current);
          try {
            task.run();
          } finally {
            pendingThreads.remove(current);
            phaser.arriveAndDeregister();
          }
        });
  }

  @Override
  public boolean awaitVectorCompletion(int timeoutSeconds) {
    try {
      int phase = phaser.arrive();
      phaser.awaitAdvanceInterruptibly(phase, timeoutSeconds, TimeUnit.SECONDS);
      return true;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    } catch (TimeoutException e) {
      LOG.warn("Timeout waiting for vector completion after {}s", timeoutSeconds);
      return false;
    }
  }

  @Override
  public int getPendingVectorTaskCount() {
    return Math.max(0, phaser.getUnarrivedParties() - 1);
  }

  @Override
  public StepStats getVectorStats() {
    return new StepStats()
        .withTotalRecords((int) (vectorSuccess.get() + vectorFailed.get()))
        .withSuccessRecords((int) vectorSuccess.get())
        .withFailedRecords((int) vectorFailed.get());
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
        Runnable statsUpdater) {
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
      buffer.clear();
      currentBufferSize = 0;

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
      CompletableFuture<BulkResponse> future;
      try {
        future = asyncClient.bulk(b -> b.operations(operations).refresh(Refresh.False));
      } catch (IOException e) {
        handleBulkFailure(operations, executionId, numberOfActions, attemptNumber, e);
        return;
      }

      future.whenComplete(
          (response, error) -> {
            try {
              if (error != null) {
                handleBulkFailure(operations, executionId, numberOfActions, attemptNumber, error);
              } else if (response.errors()) {
                handlePartialFailure(response, executionId, numberOfActions);
              } else {
                totalSuccess.addAndGet(numberOfActions);
                LOG.debug(
                    "Bulk request {} completed successfully with {} actions",
                    executionId,
                    numberOfActions);
                reportSuccessByEntityType(operations);
                statsUpdater.run();
              }
            } finally {
              if (error != null && shouldRetry(attemptNumber, error)) {
                // Don't release resources yet, we're retrying
              } else {
                activeBulkRequests.decrementAndGet();
                concurrentRequestSemaphore.release();
              }
            }
          });
    }

    private void handleBulkFailure(
        List<BulkOperation> operations,
        long executionId,
        int numberOfActions,
        int attemptNumber,
        Throwable error) {
      if (shouldRetry(attemptNumber, error)) {
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
              failureCallback.onFailure(entityType, docId, null, error.getMessage());
            }
          }
        }
        if (statsCallback != null) {
          for (Map.Entry<String, Integer> entry : failuresByType.entrySet()) {
            statsCallback.onFailure(entry.getKey(), entry.getValue());
          }
        }
        statsUpdater.run();
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
            failureCallback.onFailure(entityType, docId, null, failureMessage);
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
