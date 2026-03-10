package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TARGET_INDEX_KEY;

import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
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
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.elasticsearch.EsUtils;

/**
 * Elasticsearch implementation using new Java API client with custom bulk handler
 */
@Slf4j
public class ElasticSearchBulkSink implements BulkSink {
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
            Thread.ofVirtual().name("reindex-es-doc-build-", 0).factory());
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
    LOG.info("ElasticSearch doc-build pool resized to {} threads", newSize);
  }

  public static synchronized void resetDocBuildPoolSize() {
    setDocBuildPoolSize(DEFAULT_DOC_BUILD_POOL_SIZE);
  }

  private final ElasticSearchClient searchClient;
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

  public ElasticSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (ElasticSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;

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

        // Add entities to search index in parallel
        List<CompletableFuture<Void>> futures =
            entityInterfaces.stream()
                .map(
                    entity ->
                        CompletableFuture.runAsync(
                            () -> addEntity(entity, indexName, recreateIndex, tracker),
                            DOC_BUILD_EXECUTOR))
                .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
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
      EntityInterface entity, String indexName, boolean recreateIndex, StageStatsTracker tracker) {
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
                        idx -> idx.index(indexName).id(docId).document(EsUtils.toJsonData(json))));
      } else {
        operation =
            BulkOperation.of(
                op ->
                    op.update(
                        upd ->
                            upd.index(indexName)
                                .id(docId)
                                .action(a -> a.doc(EsUtils.toJsonData(json)).docAsUpsert(true))));
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
                      idx -> idx.index(indexName).id(docId).document(EsUtils.toJsonData(json))));

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
  public StepStats getProcessStats() {
    long success = processSuccess.get();
    long failed = processFailed.get();
    return new StepStats()
        .withTotalRecords((int) (success + failed))
        .withSuccessRecords((int) success)
        .withFailedRecords((int) failed);
  }

  @Override
  public void close() {
    try {
      // Flush any pending requests
      bulkProcessor.flush();

      // Wait for completion
      boolean terminated = bulkProcessor.awaitClose(60, TimeUnit.SECONDS);
      if (!terminated) {
        LOG.warn("Bulk processor did not terminate within timeout");
      }

      // Final stats update to ensure all processed records are reflected
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
  public int getActiveBulkRequestCount() {
    return bulkProcessor.activeBulkRequests.get();
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

  /**
   * Get current batch size
   */
  public int getBatchSize() {
    return batchSize;
  }

  /**
   * Get current concurrent requests
   */
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

  /**
   * Update batch size - Note: This only updates the value for future processor creation
   */
  public void updateBatchSize(int newBatchSize) {
    this.batchSize = newBatchSize;
    LOG.info("Batch size updated to: {}", newBatchSize);
  }

  /**
   * Update concurrent requests - Note: This only updates the value for future processor creation
   */
  public void updateConcurrentRequests(int concurrentRequests) {
    this.maxConcurrentRequests = concurrentRequests;
    LOG.info("Concurrent requests updated to: {}", concurrentRequests);
  }

  public static class CustomBulkProcessor {
    private final ElasticsearchAsyncClient asyncClient;
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
    private final BulkCircuitBreaker circuitBreaker;

    CustomBulkProcessor(
        ElasticSearchClient client,
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
      this.asyncClient = new ElasticsearchAsyncClient(client.getNewClient()._transport());
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
      this.scheduler =
          Executors.newScheduledThreadPool(
              1, Thread.ofPlatform().name("reindex-es-bulk-flush").factory());

      scheduler.scheduleAtFixedRate(
          this::flushIfNeeded, flushIntervalMillis, flushIntervalMillis, TimeUnit.MILLISECONDS);
    }

    void setFailureCallback(FailureCallback callback) {
      this.failureCallback = callback;
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

      // Wait for all active bulk requests to complete with exponential backoff
      long sleepMs = 100;
      while (activeBulkRequests.get() > 0) {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed >= timeoutMillis) {
          LOG.warn(
              "Timeout waiting for {} active bulk requests to complete", activeBulkRequests.get());
          return false;
        }
        Thread.sleep(sleepMs);
        sleepMs = Math.min(sleepMs * 2, 1000);
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
      if (!circuitBreaker.allowRequest()) {
        LOG.warn(
            "Circuit breaker OPEN - fail-fast for bulk request {} with {} actions",
            executionId,
            numberOfActions);
        totalFailed.addAndGet(numberOfActions);
        statsUpdater.run();
        activeBulkRequests.decrementAndGet();
        concurrentRequestSemaphore.release();
        return;
      }

      CompletableFuture<BulkResponse> future =
          asyncClient.bulk(b -> b.operations(operations).refresh(Refresh.False));

      future.whenComplete(
          (response, error) -> {
            boolean retryScheduled = false;
            try {
              if (error != null) {
                circuitBreaker.recordFailure();
                retryScheduled =
                    handleBulkFailure(
                        operations, executionId, numberOfActions, attemptNumber, error);
              } else if (response.errors()) {
                circuitBreaker.recordSuccess();
                handlePartialFailure(response, executionId, numberOfActions);
              } else {
                circuitBreaker.recordSuccess();
                totalSuccess.addAndGet(numberOfActions);
                LOG.debug(
                    "Bulk request {} completed successfully with {} actions",
                    executionId,
                    numberOfActions);
                statsUpdater.run();
                // Record SINK success and clean up tracking maps
                int missingTrackers = 0;
                for (BulkOperation op : operations) {
                  String docId = getDocId(op);
                  if (docId != null) {
                    docIdToEntityType.remove(docId);
                    StageStatsTracker tracker = docIdToTracker.remove(docId);
                    if (tracker != null) {
                      tracker.recordSink(StatsResult.SUCCESS);
                    } else {
                      missingTrackers++;
                    }
                  }
                }
                if (missingTrackers > 0) {
                  LOG.warn(
                      "Bulk request {} had {} operations without tracker - sink stats not recorded",
                      executionId,
                      missingTrackers);
                }
              }
            } finally {
              if (!retryScheduled) {
                activeBulkRequests.decrementAndGet();
                concurrentRequestSemaphore.release();
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

        // Report failures via callback and tracker
        for (BulkOperation op : operations) {
          String docId = getDocId(op);
          if (docId != null) {
            String entityType = docIdToEntityType.remove(docId);
            if (entityType == null) {
              entityType = extractEntityTypeFromIndex(getIndex(op));
            }
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
        statsUpdater.run();
        return false;
      }
    }

    private void handlePartialFailure(
        BulkResponse response, long executionId, int numberOfActions) {
      int failures = 0;
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
          if (tracker != null) {
            tracker.recordSink(StatsResult.FAILED);
          }
          if (failureCallback != null) {
            failureCallback.onFailure(
                entityType, docId, null, failureMessage, IndexingFailureRecorder.FailureStage.SINK);
          }
        } else {
          // Clean up on success
          if (docId != null) {
            docIdToEntityType.remove(docId);
          }
          if (tracker != null) {
            tracker.recordSink(StatsResult.SUCCESS);
          }
        }
      }
      int successes = numberOfActions - failures;
      totalSuccess.addAndGet(successes);
      totalFailed.addAndGet(failures);

      LOG.warn(
          "Bulk request {} completed with {} failures out of {} actions",
          executionId,
          failures,
          numberOfActions);
      statsUpdater.run();
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

      // Wait for all active bulk requests to complete with exponential backoff
      long sleepMs = 100;
      while (activeBulkRequests.get() > 0) {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed >= timeoutMillis) {
          LOG.warn(
              "Timeout waiting for {} active bulk requests to complete", activeBulkRequests.get());
          return false;
        }
        Thread.sleep(sleepMs);
        sleepMs = Math.min(sleepMs * 2, 1000);
      }

      return scheduler.awaitTermination(
          timeoutMillis - (System.currentTimeMillis() - startTime), TimeUnit.MILLISECONDS);
    }
  }
}
