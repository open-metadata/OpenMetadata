package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.RECREATE_CONTEXT;
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
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.elasticsearch.EsUtils;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;
import org.openmetadata.service.search.indexes.DocBuildContext;

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

  /**
   * Bounded work queue for the shared doc-build pool. An unbounded queue let a fast partition
   * reader pile doc-build tasks faster than they drain; pairing a bounded queue with {@link
   * ThreadPoolExecutor.CallerRunsPolicy} turns overflow into backpressure (the submitting thread
   * runs the task inline) instead of unbounded heap growth. Mirrors the bounded-queue + backpressure
   * pattern already used by EventPubSub and OrderedLaneExecutor in this codebase.
   */
  private static final int DOC_BUILD_QUEUE_CAPACITY = 2_000;

  private static final ThreadPoolExecutor DOC_BUILD_EXECUTOR =
      createDocBuildExecutor(DEFAULT_DOC_BUILD_POOL_SIZE);

  /**
   * Dedicated pool for table column indexing, isolated from {@link #DOC_BUILD_EXECUTOR} so a burst
   * of column work cannot starve latency-sensitive entity doc-build (which is joined per batch and
   * shares a single FIFO queue). Also bounded + CallerRuns; in practice the column-task semaphore is
   * the binding limit and CallerRuns is only a backstop. Capacity is kept >= the semaphore permits
   * so the semaphore, not the queue, is what throttles.
   */
  private static final int COLUMN_BUILD_QUEUE_CAPACITY =
      Math.max(16, 4 * DEFAULT_DOC_BUILD_POOL_SIZE);

  private static final ThreadPoolExecutor COLUMN_BUILD_EXECUTOR =
      createColumnBuildExecutor(DEFAULT_DOC_BUILD_POOL_SIZE);

  private static ThreadPoolExecutor createDocBuildExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(DOC_BUILD_QUEUE_CAPACITY),
            Thread.ofVirtual().name("reindex-es-doc-build-", 0).factory(),
            new ThreadPoolExecutor.CallerRunsPolicy());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  private static ThreadPoolExecutor createColumnBuildExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(COLUMN_BUILD_QUEUE_CAPACITY),
            Thread.ofVirtual().name("reindex-es-column-build-", 0).factory(),
            new ThreadPoolExecutor.CallerRunsPolicy());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  public static synchronized void setDocBuildPoolSize(int size) {
    int newSize = Math.max(1, Math.min(50, size));
    resizePool(DOC_BUILD_EXECUTOR, newSize);
    resizePool(COLUMN_BUILD_EXECUTOR, newSize);
    LOG.info("ElasticSearch doc-build and column-build pools resized to {} threads", newSize);
  }

  private static void resizePool(ThreadPoolExecutor pool, int newSize) {
    if (newSize <= pool.getMaximumPoolSize()) {
      pool.setCorePoolSize(newSize);
      pool.setMaximumPoolSize(newSize);
    } else {
      pool.setMaximumPoolSize(newSize);
      pool.setCorePoolSize(newSize);
    }
  }

  public static synchronized void resetDocBuildPoolSize() {
    setDocBuildPoolSize(DEFAULT_DOC_BUILD_POOL_SIZE);
  }

  private final ElasticSearchClient searchClient;
  protected final SearchRepository searchRepository;
  private final long maxPayloadSizeBytes;
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

  // Column indexing: separate bulk processor with its own lifecycle
  private final CustomBulkProcessor columnBulkProcessor;
  private final AtomicLong columnSinkSubmitted = new AtomicLong(0);
  private final AtomicLong columnSinkSuccess = new AtomicLong(0);
  private final AtomicLong columnSinkFailed = new AtomicLong(0);
  private final AtomicLong columnBuildFailed = new AtomicLong(0);
  private final ConcurrentLinkedDeque<CompletableFuture<Void>> pendingColumnFutures =
      new ConcurrentLinkedDeque<>();

  /**
   * Process-wide upper bound on in-flight table column-index tasks. Each queued/running task retains
   * its full {@link Table} (with every column) until it runs, so unbounded fire-and-forget
   * submission lets a fast partition reader pin thousands of Tables at once in the {@link
   * #COLUMN_BUILD_EXECUTOR} queue — the OOM root cause for wide tables. The semaphore turns the
   * column path into bounded backpressure: {@link #submitColumnIndexTask} blocks the reader once this
   * many tasks are outstanding instead of queueing another that pins a Table. This is a hard memory
   * ceiling: it is intentionally fixed and is NOT scaled by {@link #setDocBuildPoolSize} (which tunes
   * doc-build parallelism, not the memory bound).
   */
  private static final int MAX_INFLIGHT_COLUMN_TASKS = Math.max(8, 2 * DEFAULT_DOC_BUILD_POOL_SIZE);

  // Static so the cap is shared across all sink instances, matching the static
  // COLUMN_BUILD_EXECUTOR
  // and its bounded queue: total in-flight column tasks (and retained Tables) stay bounded by
  // MAX_INFLIGHT_COLUMN_TASKS regardless of how many sinks run concurrently.
  private static final Semaphore columnTaskSemaphore = new Semaphore(MAX_INFLIGHT_COLUMN_TASKS);

  public ElasticSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (ElasticSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxPayloadSizeBytes = maxPayloadSizeBytes;

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

    ReindexContext reindexContext =
        contextData.containsKey(RECREATE_CONTEXT)
            ? (ReindexContext) contextData.get(RECREATE_CONTEXT)
            : null;

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
      long processStartNanos = System.nanoTime();
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

        // Per-entity DocBuildContext is prepared by the upstream processor stage (see
        // ReindexingUtil.populateDocBuildContext) and stuffed into contextData. The sink stays
        // transport-only: it just looks up each entity's context by id and hands it to
        // buildSearchIndexDoc, with no awareness of what's inside (lineage today, more later).
        @SuppressWarnings("unchecked")
        Map<UUID, DocBuildContext> docBuildContexts =
            (Map<UUID, DocBuildContext>)
                contextData.getOrDefault(DOC_BUILD_CONTEXT_KEY, Collections.emptyMap());

        // Add entities to search index in parallel
        List<CompletableFuture<Void>> futures =
            entityInterfaces.stream()
                .map(
                    entity ->
                        CompletableFuture.runAsync(
                            () -> addEntity(entity, indexName, tracker, docBuildContexts),
                            DOC_BUILD_EXECUTOR))
                .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

        // Index columns asynchronously when processing table entities. Each submission is gated by
        // a semaphore so a fast reader cannot pin an unbounded number of Table entities in the
        // shared doc-build queue (see submitColumnIndexTask).
        if (Entity.TABLE.equals(entityType)) {
          for (EntityInterface entity : entityInterfaces) {
            submitColumnIndexTask(entity, reindexContext);
          }
        }
      }
      if (tracker != null) {
        tracker.addStageTime(
            StageStatsTracker.Stage.PROCESS, System.nanoTime() - processStartNanos);
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

  private static final int BULK_OPERATION_METADATA_OVERHEAD = 150;

  private void addEntity(
      EntityInterface entity,
      String indexName,
      StageStatsTracker tracker,
      Map<UUID, DocBuildContext> docBuildContexts) {
    try {
      String entityType = Entity.getEntityTypeFromObject(entity);
      DocBuildContext ctx = docBuildContexts.getOrDefault(entity.getId(), DocBuildContext.empty());
      Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc(ctx);
      String json = JsonUtils.pojoToJson(searchIndexDoc);
      String docId = entity.getId().toString();
      long rawDocSize = (long) json.getBytes(StandardCharsets.UTF_8).length;
      long estimatedSize = rawDocSize + BULK_OPERATION_METADATA_OVERHEAD;

      if (rawDocSize > 1024 * 1024) {
        LOG.warn(
            "Large indexed doc: entityType={}, docId={}, size={}MB",
            entityType,
            docId,
            rawDocSize / (1024 * 1024));
      }

      if (estimatedSize > maxPayloadSizeBytes) {
        long sizeLimit = maxPayloadSizeBytes - BULK_OPERATION_METADATA_OVERHEAD;
        json = SearchIndexUtils.stripLineageForSize(json, sizeLimit, docId, entityType);
        rawDocSize = json.getBytes(StandardCharsets.UTF_8).length;
        estimatedSize = rawDocSize + BULK_OPERATION_METADATA_OVERHEAD;
      }

      if (estimatedSize > maxPayloadSizeBytes) {
        LOG.warn(
            "Document {} of type {} is too large for bulk ({} bytes), sending directly",
            docId,
            entityType,
            rawDocSize);
        totalSubmitted.incrementAndGet();
        if (tracker != null) {
          tracker.incrementPendingSink();
        }
        indexDocumentDirectly(indexName, docId, json, entityType, tracker);
        processSuccess.incrementAndGet();
        if (tracker != null) {
          tracker.recordProcess(StatsResult.SUCCESS);
        }
        return;
      }

      final String indexableJson = json;
      BulkOperation operation =
          BulkOperation.of(
              op ->
                  op.index(
                      idx ->
                          idx.index(indexName)
                              .id(docId)
                              .document(EsUtils.toJsonData(indexableJson))));
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

  private void indexDocumentDirectly(
      String indexName, String docId, String json, String entityType, StageStatsTracker tracker) {
    try {
      searchClient
          .getNewClient()
          .index(idx -> idx.index(indexName).id(docId).document(EsUtils.toJsonData(json)));
      totalSuccess.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordSink(StatsResult.SUCCESS);
      }
    } catch (Exception e) {
      LOG.error(
          "Direct index failed for document {} of type {}: {}",
          docId,
          entityType,
          e.getMessage(),
          e);
      totalFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordSink(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            docId,
            null,
            String.format(
                "Document too large for bulk (%d bytes); direct index failed: %s",
                json.getBytes(StandardCharsets.UTF_8).length, e.getMessage()),
            IndexingFailureRecorder.FailureStage.SINK);
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

  /**
   * Submit a table's column-indexing work to the shared doc-build pool under a bounded permit.
   *
   * <p>The permit is acquired on the calling (partition-reader) thread <em>before</em> the task is
   * scheduled, so when {@link #MAX_INFLIGHT_COLUMN_TASKS} tasks are already outstanding the reader
   * blocks here rather than queueing another task that pins a full {@link Table}. The permit is
   * released exactly once when the task completes (success or failure), or here if scheduling
   * itself fails synchronously.
   */
  private void submitColumnIndexTask(EntityInterface entity, ReindexContext reindexContext) {
    try {
      columnTaskSemaphore.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      // Record the skip so getColumnStats() reflects the missing work instead of counting these
      // columns as silently successful.
      columnBuildFailed.incrementAndGet();
      LOG.warn(
          "Interrupted while waiting to submit column-index task for table {}; skipping columns",
          entity.getName());
      return;
    }

    boolean releaseOwnedByTask = false;
    try {
      CompletableFuture<Void> future =
          CompletableFuture.runAsync(
                  () -> indexTableColumns(entity, reindexContext), COLUMN_BUILD_EXECUTOR)
              .exceptionally(
                  ex -> {
                    LOG.error("Failed to index columns for table {}", entity.getName(), ex);
                    return null;
                  })
              .whenComplete((result, ex) -> columnTaskSemaphore.release());
      releaseOwnedByTask = true;
      pendingColumnFutures.add(future);
      pendingColumnFutures.removeIf(CompletableFuture::isDone);
    } finally {
      // If scheduling threw synchronously (e.g. executor shutdown) the task's whenComplete never
      // ran, so release the permit here to avoid leaking it.
      if (!releaseOwnedByTask) {
        columnTaskSemaphore.release();
      }
    }
  }

  // Visible for testing: overridden by the column-backpressure regression test to control task
  // timing without standing up a real cluster.
  protected void indexTableColumns(EntityInterface entity, ReindexContext reindexContext) {
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

        BulkOperation operation =
            BulkOperation.of(
                op ->
                    op.index(
                        idx ->
                            idx.index(columnIndexName)
                                .id(docId)
                                .document(EsUtils.toJsonData(json))));
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
  public int getActiveBulkRequestCount() {
    return bulkProcessor.activeBulkRequests.get();
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
    if (columnBulkProcessor != null) {
      columnBulkProcessor.setFailureCallback(callback);
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
    /**
     * Cap on how long a flush will wait for a permit before declaring the bulk failed. Mirror
     * of the OpenSearch sink's bounded acquire (PR-level rationale documented there): a single
     * leaked async future drains the semaphore and parks every subsequent caller permanently,
     * freezing the pipeline at whatever record count was in flight. Stored per-instance so
     * tests can shorten it without sleeping for a minute.
     */
    private static final long DEFAULT_SEMAPHORE_ACQUIRE_TIMEOUT_SECONDS = 60L;

    // Volatile for cross-thread visibility — read by flushInternal on the scheduler thread,
    // written by the package-private test setter from a different thread.
    private volatile long semaphoreAcquireTimeoutSeconds =
        DEFAULT_SEMAPHORE_ACQUIRE_TIMEOUT_SECONDS;

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

        totalSubmitted.incrementAndGet();

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

        if (!buffer.isEmpty() && currentBufferSize + operationSize >= maxPayloadSizeBytes) {
          flushInternal();
        }
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
      } catch (Exception e) {
        // An exception escaping here would cancel the scheduled task permanently
        // (ScheduledExecutorService contract), silently disabling periodic flushing so trailing
        // buffers only ship on an explicit flush/close. Log and continue to the next interval.
        LOG.error("Scheduled flush failed; will retry on the next interval", e);
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
      LOG.debug("Executing bulk request {} with {} actions", executionId, numberOfActions);

      // Bounded acquire: a leaked bulk future (callback never fires) used to drain this
      // semaphore and park every subsequent caller forever. With a timeout we surface the
      // leak as a permanent failure so workers can keep moving and operators see an actual
      // error instead of the pipeline silently freezing at a fixed record count. Mirrors
      // OpenSearchBulkSink.flushInternal so both backends behave the same way.
      boolean acquired;
      try {
        acquired =
            concurrentRequestSemaphore.tryAcquire(semaphoreAcquireTimeoutSeconds, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for semaphore", e);
        Thread.currentThread().interrupt();
        recordPermanentFailure(toFlush, numberOfActions, "Interrupted while waiting for semaphore");
        return;
      }
      if (!acquired) {
        LOG.error(
            "Bulk semaphore exhausted for {}s — recording {} ops as failed (active bulk requests={}). Likely a leaked async future.",
            semaphoreAcquireTimeoutSeconds,
            numberOfActions,
            activeBulkRequests.get());
        recordPermanentFailure(
            toFlush, numberOfActions, "Bulk semaphore timeout — likely future leak");
        return;
      }

      activeBulkRequests.incrementAndGet();
      executeBulkWithRetry(toFlush, executionId, numberOfActions, 0);
    }

    // Package-private setter for tests to short-circuit the 60s default.
    void setSemaphoreAcquireTimeoutSecondsForTesting(long seconds) {
      this.semaphoreAcquireTimeoutSeconds = seconds;
    }

    private void executeBulkWithRetry(
        List<BulkOperation> operations, long executionId, int numberOfActions, int attemptNumber) {
      if (!circuitBreaker.allowRequest()) {
        LOG.warn(
            "Circuit breaker OPEN - fail-fast for bulk request {} with {} actions",
            executionId,
            numberOfActions);
        recordPermanentFailure(operations, numberOfActions, "Circuit breaker OPEN");
        activeBulkRequests.decrementAndGet();
        concurrentRequestSemaphore.release();
        return;
      }

      // Sink timing wraps the bulk HTTP round-trip — pure Elasticsearch latency.
      long bulkStartNanos = System.nanoTime();
      Set<StageStatsTracker> participatingTrackers = collectTrackers(operations);

      CompletableFuture<BulkResponse> future;
      try {
        future = asyncClient.bulk(b -> b.operations(operations).refresh(Refresh.False));
      } catch (IOException e) {
        // A synchronous throw here (e.g., dead transport) means the completion handler below
        // never runs. Without this catch the semaphore permit and activeBulkRequests slot leak,
        // eventually starving the pipeline and hanging close(). Mirror OpenSearchBulkSink so both
        // backends clean up identically.
        circuitBreaker.recordFailure();
        boolean retryScheduled =
            handleBulkFailure(operations, executionId, numberOfActions, attemptNumber, e);
        if (!retryScheduled) {
          activeBulkRequests.decrementAndGet();
          concurrentRequestSemaphore.release();
        }
        return;
      }

      future.whenComplete(
          (response, error) -> {
            long bulkElapsedNanos = System.nanoTime() - bulkStartNanos;
            for (StageStatsTracker tracker : participatingTrackers) {
              tracker.addStageTime(StageStatsTracker.Stage.SINK, bulkElapsedNanos);
            }
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

    /**
     * Resolve the distinct set of trackers represented in this bulk by walking each operation's
     * docId. Used to charge Sink wall-clock time to every participating entity.
     */
    private Set<StageStatsTracker> collectTrackers(List<BulkOperation> operations) {
      Set<StageStatsTracker> trackers = new HashSet<>();
      for (BulkOperation op : operations) {
        String docId = getDocId(op);
        if (docId != null) {
          StageStatsTracker tracker = docIdToTracker.get(docId);
          if (tracker != null) {
            trackers.add(tracker);
          }
        }
      }
      return trackers;
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
        LOG.error(
            "Bulk request {} failed completely after {} attempts with {} actions",
            executionId,
            attemptNumber + 1,
            numberOfActions,
            error);
        recordPermanentFailure(operations, numberOfActions, error.getMessage());
        return false;
      }
    }

    private void recordPermanentFailure(
        List<BulkOperation> operations, int numberOfActions, String failureMessage) {
      totalFailed.addAndGet(numberOfActions);

      for (BulkOperation op : operations) {
        String docId = getDocId(op);
        if (docId == null) {
          continue;
        }

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
              entityType, docId, null, failureMessage, IndexingFailureRecorder.FailureStage.SINK);
        }
      }

      statsUpdater.run();
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
