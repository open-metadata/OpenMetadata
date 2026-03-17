package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.RECREATE_CONTEXT;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TARGET_INDEX_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Phaser;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.EntityStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.JobStatsManager;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.slf4j.MDC;

/**
 * Core reindexing executor that handles entity indexing without any Quartz dependencies. Can be
 * used by:
 *
 * <ul>
 *   <li>SearchIndexApp (Quartz integration)
 *   <li>CLI tools
 *   <li>REST API endpoints
 *   <li>Unit tests
 * </ul>
 *
 * <p>Uses ReindexingProgressListener for extensible progress reporting.
 */
@Slf4j
public class SearchIndexExecutor implements AutoCloseable {

  private static final String ALL = "all";
  private static final String POISON_PILL = "__POISON_PILL__";
  private static final int DEFAULT_QUEUE_SIZE = 20000;
  private static final String RECREATE_INDEX = "recreateIndex";
  private static final String ENTITY_TYPE_KEY = "entityType";
  private static final String QUERY_COST_RESULT_INCORRECT = "queryCostResult";
  private static final String QUERY_COST_RESULT_WARNING =
      "Found incorrect entity type 'queryCostResult', correcting to 'queryCostRecord'";

  private static final int AVAILABLE_PROCESSORS = Runtime.getRuntime().availableProcessors();
  private static final int MAX_READERS_PER_ENTITY = 5;
  private static final int MAX_PRODUCER_THREADS = Math.min(20, AVAILABLE_PROCESSORS * 2);
  private static final int MAX_CONSUMER_THREADS = Math.min(20, AVAILABLE_PROCESSORS * 2);
  private static final int MAX_TOTAL_THREADS = Math.min(50, AVAILABLE_PROCESSORS * 4);

  public static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final CompositeProgressListener listeners;
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  private final AtomicBoolean sinkClosed = new AtomicBoolean(false);

  private BulkSink searchIndexSink;
  private RecreateIndexHandler recreateIndexHandler;
  private ReindexContext recreateContext;
  private ExecutorService producerExecutor;
  private ExecutorService consumerExecutor;
  private ExecutorService jobExecutor;
  private BlockingQueue<IndexingTask<?>> taskQueue;
  private final AtomicBoolean producersDone = new AtomicBoolean(false);

  @Getter private final AtomicReference<Stats> stats = new AtomicReference<>();
  private final AtomicReference<Integer> batchSize = new AtomicReference<>(100);

  private ReindexingConfiguration config;
  private ReindexingJobContext context;
  private long startTime;
  private IndexingFailureRecorder failureRecorder;
  private JobStatsManager statsManager;
  private final Map<String, AtomicInteger> entityBatchCounters = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> entityBatchFailures = new ConcurrentHashMap<>();
  private final Set<String> promotedEntities = ConcurrentHashMap.newKeySet();
  private final Map<String, StageStatsTracker> sinkTrackers = new ConcurrentHashMap<>();

  record IndexingTask<T>(String entityType, ResultList<T> entities, int offset, int retryCount) {
    IndexingTask(String entityType, ResultList<T> entities, int offset) {
      this(entityType, entities, offset, 0);
    }
  }

  record ThreadConfiguration(int numProducers, int numConsumers) {}

  @FunctionalInterface
  interface KeysetBatchReader {
    ResultList<?> readNextKeyset(String cursor) throws SearchIndexException;
  }

  static class MemoryInfo {
    final long maxMemory;
    final long usedMemory;
    final double usageRatio;

    MemoryInfo() {
      Runtime runtime = Runtime.getRuntime();
      this.maxMemory = runtime.maxMemory();
      long totalMemory = runtime.totalMemory();
      long freeMemory = runtime.freeMemory();
      this.usedMemory = totalMemory - freeMemory;
      this.usageRatio = (double) usedMemory / maxMemory;
    }
  }

  public SearchIndexExecutor(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.listeners = new CompositeProgressListener();
  }

  private EntityStatsTracker getTracker(String entityType) {
    return statsManager != null ? statsManager.getTracker(entityType) : null;
  }

  private void initStatsManager() {
    if (statsManager == null && context != null) {
      String jobId = context.getJobId().toString();
      String serverId =
          org.openmetadata
              .service
              .apps
              .bundles
              .searchIndex
              .distributed
              .ServerIdentityResolver
              .getInstance()
              .getServerId();
      statsManager = new JobStatsManager(jobId, serverId, collectionDAO);
    }
  }

  public SearchIndexExecutor addListener(ReindexingProgressListener listener) {
    listeners.addListener(listener);
    return this;
  }

  public SearchIndexExecutor removeListener(ReindexingProgressListener listener) {
    listeners.removeListener(listener);
    return this;
  }

  /**
   * Execute reindexing with the given configuration.
   *
   * @param config The reindexing configuration
   * @param context The job context
   * @return ExecutionResult with final stats
   */
  public ExecutionResult execute(ReindexingConfiguration config, ReindexingJobContext context) {
    this.config = config;
    this.context = context;
    this.startTime = System.currentTimeMillis();
    initializeState();

    listeners.onJobStarted(context);

    try {
      return executeSingleServer();
    } catch (Exception e) {
      LOG.error("Reindexing failed", e);
      listeners.onJobFailed(stats.get(), e);
      return ExecutionResult.fromStats(stats.get(), ExecutionResult.Status.FAILED, startTime);
    }
  }

  private void initializeState() {
    stopped.set(false);
    sinkClosed.set(false);
    recreateContext = null;
    producersDone.set(false);
    entityBatchCounters.clear();
    entityBatchFailures.clear();
    promotedEntities.clear();
    sinkTrackers.clear();
    initStatsManager();
  }

  private ExecutionResult executeSingleServer() throws Exception {
    Set<String> entities = expandEntities(config.entities());
    batchSize.set(config.batchSize());

    listeners.onJobConfigured(context, config);

    stats.set(initializeTotalRecords(entities));

    String serverId =
        org.openmetadata
            .service
            .apps
            .bundles
            .searchIndex
            .distributed
            .ServerIdentityResolver
            .getInstance()
            .getServerId();
    String jobId =
        context.getJobId() != null ? context.getJobId().toString() : UUID.randomUUID().toString();
    this.failureRecorder = new IndexingFailureRecorder(collectionDAO, jobId, serverId);
    cleanupOldFailures();

    initializeSink(config);

    if (config.recreateIndex()) {
      validateClusterCapacity(entities);
      listeners.onIndexRecreationStarted(entities);
      recreateContext = reCreateIndexes(entities);
    }

    reIndexFromStartToEnd(entities);
    closeSinkIfNeeded();
    // Promote anything yet to be promoted such as vector search indexes which is not part of
    // entities set
    finalizeReindex();

    return buildResult();
  }

  private Set<String> expandEntities(Set<String> entities) {
    if (entities.contains(ALL)) {
      return getAll();
    }
    return entities;
  }

  private void validateClusterCapacity(Set<String> entities) {
    try {
      SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
      validator.validateCapacityForRecreate(searchRepository, entities);
    } catch (InsufficientClusterCapacityException e) {
      LOG.error("Cluster capacity check failed: {}", e.getMessage());
      throw e;
    } catch (Exception e) {
      LOG.warn("Failed to validate cluster capacity, proceeding with caution: {}", e.getMessage());
    }
  }

  private void initializeSink(ReindexingConfiguration config) {
    this.searchIndexSink =
        searchRepository.createBulkSink(
            config.batchSize(), config.maxConcurrentRequests(), config.payloadSize());
    this.recreateIndexHandler = searchRepository.createReindexHandler();

    if (searchIndexSink != null) {
      searchIndexSink.setFailureCallback(this::handleSinkFailure);
    }

    LOG.debug("Initialized BulkSink with batch size: {}", config.batchSize());
  }

  private void handleSinkFailure(
      String entityType,
      String entityId,
      String entityFqn,
      String errorMessage,
      IndexingFailureRecorder.FailureStage stage) {
    if (failureRecorder != null) {
      if (stage == IndexingFailureRecorder.FailureStage.PROCESS) {
        failureRecorder.recordProcessFailure(entityType, entityId, entityFqn, errorMessage);
      } else {
        failureRecorder.recordSinkFailure(entityType, entityId, entityFqn, errorMessage);
      }
    }
  }

  private void cleanupOldFailures() {
    try {
      long cutoffTime = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(30);
      int deleted = collectionDAO.searchIndexFailureDAO().deleteOlderThan(cutoffTime);
      if (deleted > 0) {
        LOG.info("Cleaned up {} old failure records", deleted);
      }
    } catch (Exception e) {
      LOG.warn("Failed to cleanup old failure records", e);
    }
  }

  private void reIndexFromStartToEnd(Set<String> entities) throws InterruptedException {
    long totalEntities =
        stats.get() != null && stats.get().getJobStats() != null
            ? stats.get().getJobStats().getTotalRecords()
            : 0;

    ThreadConfiguration threadConfig = calculateThreadConfiguration(totalEntities);
    int effectiveQueueSize = initializeQueueAndExecutors(threadConfig, entities.size());

    LOG.info(
        "Starting reindexing with {} producers, {} consumers, queue size {}",
        threadConfig.numProducers(),
        threadConfig.numConsumers(),
        effectiveQueueSize);

    executeReindexing(threadConfig.numConsumers(), entities);
  }

  private ThreadConfiguration calculateThreadConfiguration(long totalEntities) {
    int numConsumers =
        config.consumerThreads() > 0 ? Math.min(config.consumerThreads(), MAX_CONSUMER_THREADS) : 2;
    int numProducers =
        config.producerThreads() > 1
            ? Math.min(config.producerThreads(), MAX_PRODUCER_THREADS)
            : Math.clamp((int) (totalEntities / 10000), 2, MAX_PRODUCER_THREADS);

    return adjustThreadsForLimit(numProducers, numConsumers);
  }

  private ThreadConfiguration adjustThreadsForLimit(int numProducers, int numConsumers) {
    int entityCount = config.entities() != null ? config.entities().size() : 0;
    int totalThreads = numProducers + numConsumers + entityCount;

    if (totalThreads > MAX_TOTAL_THREADS) {
      LOG.warn(
          "Total thread count {} exceeds limit {}, reducing...", totalThreads, MAX_TOTAL_THREADS);
      double ratio = (double) MAX_TOTAL_THREADS / totalThreads;
      numProducers = Math.max(1, (int) (numProducers * ratio));
      numConsumers = Math.max(1, (int) (numConsumers * ratio));
    }

    return new ThreadConfiguration(numProducers, numConsumers);
  }

  private int initializeQueueAndExecutors(ThreadConfiguration threadConfig, int entityCount) {
    int queueSize = config.queueSize() > 0 ? config.queueSize() : DEFAULT_QUEUE_SIZE;
    int effectiveQueueSize = calculateMemoryAwareQueueSize(queueSize);

    taskQueue = new LinkedBlockingQueue<>(effectiveQueueSize);
    producersDone.set(false);

    String jobIdTag = MDC.get("reindexJobId");
    String threadPrefix = "reindex-" + (jobIdTag != null ? jobIdTag + "-" : "");

    int maxJobThreads =
        Math.max(1, MAX_TOTAL_THREADS - threadConfig.numProducers() - threadConfig.numConsumers());
    int cappedEntityCount = Math.min(entityCount, maxJobThreads);
    jobExecutor =
        Executors.newFixedThreadPool(
            cappedEntityCount, Thread.ofPlatform().name(threadPrefix + "job-", 0).factory());

    int finalNumConsumers = Math.min(threadConfig.numConsumers(), MAX_CONSUMER_THREADS);
    consumerExecutor =
        Executors.newFixedThreadPool(
            finalNumConsumers, Thread.ofPlatform().name(threadPrefix + "consumer-", 0).factory());

    producerExecutor =
        Executors.newFixedThreadPool(
            threadConfig.numProducers(),
            Thread.ofPlatform().name(threadPrefix + "producer-", 0).factory());

    return effectiveQueueSize;
  }

  private int calculateMemoryAwareQueueSize(int requestedSize) {
    MemoryInfo memInfo = new MemoryInfo();
    long estimatedEntitySize = 5 * 1024L;
    long maxQueueMemory = (long) (memInfo.maxMemory * 0.25);
    long memoryBasedLimitLong = maxQueueMemory / (estimatedEntitySize * batchSize.get());
    int memoryBasedLimit = (int) Math.max(1, Math.min(memoryBasedLimitLong, Integer.MAX_VALUE));
    return Math.min(requestedSize, memoryBasedLimit);
  }

  private void executeReindexing(int numConsumers, Set<String> entities)
      throws InterruptedException {
    CountDownLatch consumerLatch = startConsumerThreads(numConsumers);

    try {
      processEntityReindex(entities);
      signalConsumersToStop(numConsumers);
      waitForConsumersToComplete(consumerLatch);
    } catch (InterruptedException e) {
      LOG.info("Reindexing interrupted - stopping immediately");
      stopped.set(true);
      Thread.currentThread().interrupt();
      throw e;
    } finally {
      cleanupExecutors();
    }
  }

  private CountDownLatch startConsumerThreads(int numConsumers) {
    CountDownLatch consumerLatch = new CountDownLatch(numConsumers);
    Map<String, String> mdc = MDC.getCopyOfContextMap();
    for (int i = 0; i < numConsumers; i++) {
      final int consumerId = i;
      consumerExecutor.submit(
          () -> {
            if (mdc != null) MDC.setContextMap(mdc);
            try {
              runConsumer(consumerId, consumerLatch);
            } finally {
              MDC.clear();
            }
          });
    }
    return consumerLatch;
  }

  private void runConsumer(int consumerId, CountDownLatch consumerLatch) {
    LOG.debug("Consumer {} started", consumerId);
    try {
      while (!stopped.get()) {
        try {
          IndexingTask<?> task = taskQueue.poll(200, TimeUnit.MILLISECONDS);
          if (task == null) {
            continue;
          }
          if (POISON_PILL.equals(task.entityType())) {
            break;
          }
          processTask(task);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }
      }
    } finally {
      LOG.debug("Consumer {} stopped", consumerId);
      consumerLatch.countDown();
    }
  }

  /**
   * Process a single indexing task.
   *
   * <p>Stats are tracked via EntityStatsTracker (one per entity type) which flushes to
   * search_index_server_stats table. Each stage tracks:
   * <ul>
   *   <li>Reader: success/warnings/failed from ResultList
   *   <li>Process: success/failed during entity → search doc conversion (in BulkSink)
   *   <li>Sink: success/failed from ES/OS bulk response (in BulkSink)
   *   <li>Vector: success/failed for vector embeddings (in OpenSearchBulkSink)
   * </ul>
   */
  private void processTask(IndexingTask<?> task) {
    String entityType = task.entityType();
    ResultList<?> entities = task.entities();
    Map<String, Object> contextData = createContextData(entityType);
    EntityStatsTracker tracker = getTracker(entityType);

    // Stage 1: Reader stats (from source read)
    int readerSuccessCount = listOrEmpty(entities.getData()).size();
    int readerFailedCount = listOrEmpty(entities.getErrors()).size();
    int readerWarningsCount = entities.getWarningsCount() != null ? entities.getWarningsCount() : 0;

    updateReaderStats(readerSuccessCount, readerFailedCount, readerWarningsCount);
    if (tracker != null) {
      tracker.recordReaderBatch(readerSuccessCount, readerFailedCount, readerWarningsCount);
    }

    // Stage 2 & 3: Process + Sink handled by BulkSink via tracker passed in context
    try {
      writeEntitiesToSink(entityType, entities, contextData);

      // Update entity stats for progress reporting (uses reader counts, sink synced at end)
      StepStats currentEntityStats = createEntityStats(entities);
      handleTaskSuccess(entityType, entities, currentEntityStats);
    } catch (SearchIndexException e) {
      handleSearchIndexException(entityType, entities, e);
    } catch (Exception e) {
      handleGenericException(entityType, entities, e);
    }
  }

  private Map<String, Object> createContextData(String entityType) {
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, entityType);
    contextData.put(RECREATE_INDEX, config.recreateIndex());
    contextData.put(RECREATE_CONTEXT, recreateContext);
    contextData.put(BulkSink.STATS_TRACKER_CONTEXT_KEY, getSinkTracker(entityType));
    getTargetIndexForEntity(entityType)
        .ifPresent(index -> contextData.put(TARGET_INDEX_KEY, index));
    return contextData;
  }

  private StageStatsTracker getSinkTracker(String entityType) {
    if (context == null) {
      return null;
    }
    return sinkTrackers.computeIfAbsent(
        entityType,
        et -> {
          String jobId = context.getJobId().toString();
          String serverId =
              org.openmetadata
                  .service
                  .apps
                  .bundles
                  .searchIndex
                  .distributed
                  .ServerIdentityResolver
                  .getInstance()
                  .getServerId();
          return new StageStatsTracker(
              jobId, serverId, et, collectionDAO.searchIndexServerStatsDAO());
        });
  }

  private void writeEntitiesToSink(
      String entityType, ResultList<?> entities, Map<String, Object> contextData) throws Exception {
    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      @SuppressWarnings("unchecked")
      List<EntityInterface> entityList = (List<EntityInterface>) entities.getData();
      searchIndexSink.write(entityList, contextData);
    } else {
      @SuppressWarnings("unchecked")
      List<EntityTimeSeriesInterface> entityList =
          (List<EntityTimeSeriesInterface>) entities.getData();
      searchIndexSink.write(entityList, contextData);
    }
  }

  private StepStats createEntityStats(ResultList<?> entities) {
    StepStats stepStats = new StepStats();
    stepStats.setSuccessRecords(listOrEmpty(entities.getData()).size());
    stepStats.setFailedRecords(listOrEmpty(entities.getErrors()).size());
    return stepStats;
  }

  private void handleTaskSuccess(
      String entityType, ResultList<?> entities, StepStats currentEntityStats) {
    if (entities.getErrors() != null && !entities.getErrors().isEmpty()) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.READER)
              .withSubmittedCount(batchSize.get())
              .withSuccessCount(entities.getData().size())
              .withFailedCount(entities.getErrors().size())
              .withMessage("Issues in Reading A Batch For Entities.");
      listeners.onError(entityType, error, stats.get());
    }

    updateStats(entityType, currentEntityStats);
    listeners.onProgressUpdate(stats.get(), context);
  }

  private void handleSearchIndexException(
      String entityType, ResultList<?> entities, SearchIndexException e) {
    if (!stopped.get()) {
      IndexingError indexingError = e.getIndexingError();
      if (indexingError != null) {
        listeners.onError(entityType, indexingError, stats.get());
      } else {
        IndexingError error = createSinkError(e.getMessage());
        listeners.onError(entityType, error, stats.get());
      }

      syncSinkStatsFromBulkSink();

      int dataSize = entities != null && entities.getData() != null ? entities.getData().size() : 0;
      int readerErrors = entities != null ? listOrEmpty(entities.getErrors()).size() : 0;
      StepStats failedStats = createFailedStats(indexingError, dataSize + readerErrors);
      updateStats(entityType, failedStats);
    }
    LOG.error("Sink error for {}", entityType, e);
  }

  private void handleGenericException(String entityType, ResultList<?> entities, Exception e) {
    if (!stopped.get()) {
      IndexingError error = createSinkError(ExceptionUtils.getStackTrace(e));
      listeners.onError(entityType, error, stats.get());
      syncSinkStatsFromBulkSink();

      int failedCount =
          entities != null && entities.getData() != null ? entities.getData().size() : 0;
      int readerErrors = entities != null ? listOrEmpty(entities.getErrors()).size() : 0;
      StepStats failedStats =
          new StepStats().withSuccessRecords(0).withFailedRecords(failedCount + readerErrors);
      updateStats(entityType, failedStats);
    }
    LOG.error("Error for {}", entityType, e);
  }

  private void signalConsumersToStop(int numConsumers) throws InterruptedException {
    producersDone.set(true);
    for (int i = 0; i < numConsumers; i++) {
      taskQueue.put(new IndexingTask<>(POISON_PILL, null, -1));
    }
  }

  private void waitForConsumersToComplete(CountDownLatch consumerLatch)
      throws InterruptedException {
    LOG.info("Waiting for consumers to complete...");
    consumerLatch.await();
    LOG.info("All consumers finished");
  }

  private void processEntityReindex(Set<String> entities) throws InterruptedException {
    // Use Phaser instead of pre-computed CountDownLatch to handle dynamic reader counts.
    // Each entity type registers as a party, then dynamically registers its actual readers.
    // This eliminates the batch-size-snapshot mismatch where auto-tune could desynchronize
    // the pre-computed latch count from the actual number of readers created.
    List<String> ordered = EntityPriority.sortByPriority(entities);
    LOG.info("Entity processing order: {}", ordered);
    Phaser producerPhaser = new Phaser(entities.size());
    Map<String, String> mdc = MDC.getCopyOfContextMap();

    for (String entityType : ordered) {
      jobExecutor.submit(
          () -> {
            if (mdc != null) MDC.setContextMap(mdc);
            try {
              processEntityType(entityType, producerPhaser);
            } finally {
              MDC.clear();
            }
          });
    }

    int phase = 0;
    while (!producerPhaser.isTerminated()) {
      if (stopped.get() || Thread.currentThread().isInterrupted()) {
        LOG.info("Stop signal received during reindexing");
        if (producerExecutor != null) producerExecutor.shutdownNow();
        if (jobExecutor != null) jobExecutor.shutdownNow();
        return;
      }
      try {
        producerPhaser.awaitAdvanceInterruptibly(phase, 1, TimeUnit.SECONDS);
        break;
      } catch (TimeoutException e) {
        // Continue checking stop signal
      }
    }
  }

  private void processEntityType(String entityType, Phaser producerPhaser) {
    try {
      int fixedBatchSize = EntityBatchSizeEstimator.estimateBatchSize(entityType, batchSize.get());
      int totalEntityRecords = getTotalEntityRecords(entityType);
      listeners.onEntityTypeStarted(entityType, totalEntityRecords);

      entityBatchFailures.put(entityType, new AtomicInteger(0));

      if (totalEntityRecords > 0) {
        int numReaders =
            Math.min(
                calculateNumberOfThreads(totalEntityRecords, fixedBatchSize),
                MAX_READERS_PER_ENTITY);
        entityBatchCounters.put(entityType, new AtomicInteger(numReaders));

        // Dynamically register actual readers with the phaser
        producerPhaser.bulkRegister(numReaders);

        try {
          if (TIME_SERIES_ENTITIES.contains(entityType)) {
            Long filterStartTs = null;
            Long filterEndTs = null;
            if (config != null) {
              long startTs = config.getTimeSeriesStartTs(entityType);
              if (startTs > 0) {
                filterStartTs = startTs;
                filterEndTs = System.currentTimeMillis();
              }
            }
            final Long tsStart = filterStartTs;
            final Long tsEnd = filterEndTs;
            submitReaders(
                entityType,
                totalEntityRecords,
                fixedBatchSize,
                numReaders,
                producerPhaser,
                () -> {
                  PaginatedEntityTimeSeriesSource source =
                      (tsStart != null)
                          ? new PaginatedEntityTimeSeriesSource(
                              entityType,
                              fixedBatchSize,
                              getSearchIndexFields(entityType),
                              totalEntityRecords,
                              tsStart,
                              tsEnd)
                          : new PaginatedEntityTimeSeriesSource(
                              entityType,
                              fixedBatchSize,
                              getSearchIndexFields(entityType),
                              totalEntityRecords);
                  return source::readWithCursor;
                },
                (readers, total) -> {
                  List<String> cursors = new ArrayList<>();
                  int perReader = total / readers;
                  for (int i = 1; i < readers; i++) {
                    cursors.add(RestUtil.encodeCursor(String.valueOf(i * perReader)));
                  }
                  return cursors;
                });
          } else {
            PaginatedEntitiesSource entSource =
                new PaginatedEntitiesSource(
                    entityType,
                    fixedBatchSize,
                    getSearchIndexFields(entityType),
                    totalEntityRecords);
            submitReaders(
                entityType,
                totalEntityRecords,
                fixedBatchSize,
                numReaders,
                producerPhaser,
                () -> {
                  PaginatedEntitiesSource source =
                      new PaginatedEntitiesSource(
                          entityType,
                          fixedBatchSize,
                          getSearchIndexFields(entityType),
                          totalEntityRecords);
                  return source::readNextKeyset;
                },
                entSource::findBoundaryCursors);
          }
        } catch (Exception e) {
          LOG.error(
              "Failed to submit readers for {}, deregistering {} phaser parties",
              entityType,
              numReaders,
              e);
          for (int i = 0; i < numReaders; i++) {
            producerPhaser.arriveAndDeregister();
          }
          throw e;
        }
      } else {
        entityBatchCounters.put(entityType, new AtomicInteger(1));
        promoteEntityIndexIfReady(entityType);
      }

      StepStats entityStats =
          stats.get() != null && stats.get().getEntityStats() != null
              ? stats.get().getEntityStats().getAdditionalProperties().get(entityType)
              : null;
      listeners.onEntityTypeCompleted(entityType, entityStats);
    } catch (Exception e) {
      LOG.error("Error processing entity type {}", entityType, e);
    } finally {
      // Deregister the entity coordinator party
      producerPhaser.arriveAndDeregister();
    }
  }

  private void submitReaders(
      String entityType,
      int totalRecords,
      int fixedBatchSize,
      int numReaders,
      Phaser producerPhaser,
      java.util.function.Supplier<KeysetBatchReader> readerFactory,
      java.util.function.BiFunction<Integer, Integer, List<String>> boundaryFinder) {
    Map<String, String> mdc = MDC.getCopyOfContextMap();
    if (numReaders == 1) {
      KeysetBatchReader reader = readerFactory.get();
      producerExecutor.submit(
          () -> {
            if (mdc != null) MDC.setContextMap(mdc);
            try {
              processKeysetBatches(
                  entityType, Integer.MAX_VALUE, fixedBatchSize, null, reader, producerPhaser);
            } finally {
              MDC.clear();
            }
          });
      return;
    }

    List<String> boundaries = boundaryFinder.apply(numReaders, totalRecords);
    int actualReaders = boundaries.size() + 1;
    // Use ceiling division to avoid rounding-related entity loss at reader boundaries
    int recordsPerReader = (totalRecords + actualReaders - 1) / actualReaders;

    if (actualReaders < numReaders) {
      LOG.warn(
          "Boundary discovery for {} returned {} cursors (expected {}), using {} readers",
          entityType,
          boundaries.size(),
          numReaders - 1,
          actualReaders);
      entityBatchCounters.get(entityType).set(actualReaders);
      // Deregister extra reader parties from the phaser
      for (int j = 0; j < numReaders - actualReaders; j++) {
        producerPhaser.arriveAndDeregister();
      }
    }

    for (int i = 0; i < actualReaders; i++) {
      String startCursor = (i == 0) ? null : boundaries.get(i - 1);
      String endCursorForReader = (i < boundaries.size()) ? boundaries.get(i) : null;
      int limit = (i == actualReaders - 1) ? Integer.MAX_VALUE : recordsPerReader;
      KeysetBatchReader readerSource = readerFactory.get();
      final int readerLimit = limit;
      final String readerEndCursor = endCursorForReader;
      producerExecutor.submit(
          () -> {
            if (mdc != null) MDC.setContextMap(mdc);
            try {
              processKeysetBatches(
                  entityType,
                  readerLimit,
                  fixedBatchSize,
                  startCursor,
                  readerSource,
                  producerPhaser,
                  readerEndCursor);
            } finally {
              MDC.clear();
            }
          });
    }
  }

  private boolean hasReachedEndCursor(String afterCursor, String endCursor) {
    if (endCursor == null || afterCursor == null) return false;
    String decodedAfter = RestUtil.decodeCursor(afterCursor);
    String decodedEnd = RestUtil.decodeCursor(endCursor);
    if (decodedAfter == null || decodedEnd == null) return false;

    // Time-series cursors are numeric offsets
    try {
      int afterOffset = Integer.parseInt(decodedAfter);
      int endOffset = Integer.parseInt(decodedEnd);
      return afterOffset >= endOffset;
    } catch (NumberFormatException ignored) {
      // Not a numeric cursor, fall through to JSON comparison
    }

    // Regular entity cursors are JSON maps with "name" and "id" fields
    try {
      @SuppressWarnings("unchecked")
      Map<String, String> afterMap =
          org.openmetadata.schema.utils.JsonUtils.readValue(decodedAfter, Map.class);
      @SuppressWarnings("unchecked")
      Map<String, String> endMap =
          org.openmetadata.schema.utils.JsonUtils.readValue(decodedEnd, Map.class);
      String afterName = afterMap.getOrDefault("name", "");
      String endName = endMap.getOrDefault("name", "");
      int nameCompare = afterName.compareTo(endName);
      if (nameCompare != 0) return nameCompare >= 0;
      String afterId = afterMap.getOrDefault("id", "");
      String endId = endMap.getOrDefault("id", "");
      return afterId.compareTo(endId) >= 0;
    } catch (Exception e) {
      return decodedAfter.compareTo(decodedEnd) >= 0;
    }
  }

  private void processKeysetBatches(
      String entityType,
      int recordLimit,
      int fixedBatchSize,
      String startCursor,
      KeysetBatchReader batchReader,
      Phaser producerPhaser) {
    processKeysetBatches(
        entityType, recordLimit, fixedBatchSize, startCursor, batchReader, producerPhaser, null);
  }

  private void processKeysetBatches(
      String entityType,
      int recordLimit,
      int fixedBatchSize,
      String startCursor,
      KeysetBatchReader batchReader,
      Phaser producerPhaser,
      String endCursor) {
    boolean hadFailure = false;
    try {
      String keysetCursor = startCursor;
      int processed = 0;

      while (processed < recordLimit && !stopped.get()) {
        long backpressureWaitStart = System.currentTimeMillis();
        AdaptiveBackoff backoff = new AdaptiveBackoff(50, 2000);
        while (isBackpressureActive()) {
          if (stopped.get()) {
            return;
          }
          long elapsed = System.currentTimeMillis() - backpressureWaitStart;
          if (elapsed > 15_000) {
            LOG.warn("Backpressure wait timeout for {}, proceeding anyway", entityType);
            break;
          }
          Thread.sleep(backoff.nextDelay());
        }

        try {
          ResultList<?> result = readWithRetry(batchReader, keysetCursor, entityType);
          if (result == null || result.getData().isEmpty()) {
            LOG.debug(
                "Reader for {} exhausted at processed={} of limit={} (empty result)",
                entityType,
                processed,
                recordLimit);
            break;
          }

          if (!stopped.get()) {
            IndexingTask<?> task = new IndexingTask<>(entityType, result, processed);
            taskQueue.put(task);
          }

          int readerSuccessCount = result.getData().size();
          int readerFailedCount = listOrEmpty(result.getErrors()).size();
          int readerWarningsCount =
              result.getWarningsCount() != null ? result.getWarningsCount() : 0;
          processed += readerSuccessCount + readerFailedCount + readerWarningsCount;
          keysetCursor = result.getPaging() != null ? result.getPaging().getAfter() : null;
          if (keysetCursor == null) {
            LOG.debug(
                "Reader for {} exhausted at processed={} of limit={} (null cursor)",
                entityType,
                processed,
                recordLimit);
            break;
          }
          if (endCursor != null && hasReachedEndCursor(keysetCursor, endCursor)) {
            LOG.debug("Reader for {} reached end cursor at processed={}", entityType, processed);
            break;
          }
        } catch (SearchIndexException e) {
          hadFailure = true;
          LOG.error("Error reading keyset batch for {}", entityType, e);
          if (failureRecorder != null) {
            failureRecorder.recordReaderFailure(
                entityType, e.getMessage(), ExceptionUtils.getStackTrace(e));
          }
          listeners.onError(entityType, e.getIndexingError(), stats.get());
          int failedCount =
              e.getIndexingError() != null && e.getIndexingError().getFailedCount() != null
                  ? e.getIndexingError().getFailedCount()
                  : fixedBatchSize;
          updateReaderStats(0, failedCount, 0);
          updateStats(
              entityType, new StepStats().withSuccessRecords(0).withFailedRecords(failedCount));
          processed += fixedBatchSize;
        }
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted during keyset processing of {}", entityType);
    } catch (Exception e) {
      hadFailure = true;
      if (!stopped.get()) {
        LOG.error("Error in keyset processing for {}", entityType, e);
      }
    } finally {
      producerPhaser.arriveAndDeregister();
      if (hadFailure) {
        AtomicInteger failures = entityBatchFailures.get(entityType);
        if (failures != null) {
          failures.incrementAndGet();
        }
      }
      AtomicInteger remaining = entityBatchCounters.get(entityType);
      if (remaining != null && remaining.decrementAndGet() == 0) {
        promoteEntityIndexIfReady(entityType);
      }
    }
  }

  private void processBatch(String entityType, int currentOffset, CountDownLatch producerLatch) {
    boolean batchHadFailure = false;
    try {
      if (stopped.get()) {
        return;
      }

      long backpressureWaitStart = System.currentTimeMillis();
      AdaptiveBackoff backoff = new AdaptiveBackoff(50, 2000);
      while (isBackpressureActive()) {
        if (stopped.get()) {
          return;
        }
        long elapsed = System.currentTimeMillis() - backpressureWaitStart;
        if (elapsed > 15_000) {
          LOG.warn(
              "Backpressure wait timeout for {} offset {}, proceeding anyway",
              entityType,
              currentOffset);
          break;
        }
        Thread.sleep(backoff.nextDelay());
      }

      Source<?> source = createSource(entityType);
      processReadTask(entityType, source, currentOffset);
    } catch (Exception e) {
      batchHadFailure = true;
      if (!stopped.get()) {
        LOG.error("Error processing batch for {}", entityType, e);
      }
    } finally {
      producerLatch.countDown();
      // Track batch completion for per-entity promotion
      if (batchHadFailure) {
        AtomicInteger failures = entityBatchFailures.get(entityType);
        if (failures != null) {
          failures.incrementAndGet();
        }
      }
      AtomicInteger remaining = entityBatchCounters.get(entityType);
      if (remaining != null && remaining.decrementAndGet() == 0) {
        promoteEntityIndexIfReady(entityType);
      }
    }
  }

  private void promoteEntityIndexIfReady(String entityType) {
    if (recreateIndexHandler == null || recreateContext == null) {
      return;
    }
    if (!config.recreateIndex()) {
      return;
    }

    if (!promotedEntities.add(entityType)) {
      LOG.debug("Entity '{}' already promoted, skipping.", entityType);
      return;
    }

    AtomicInteger failures = entityBatchFailures.get(entityType);
    boolean entitySuccess = failures == null || failures.get() == 0;

    Optional<String> stagedIndexOpt = recreateContext.getStagedIndex(entityType);
    if (stagedIndexOpt.isEmpty()) {
      LOG.debug("No staged index found for entity '{}', skipping promotion.", entityType);
      promotedEntities.remove(entityType);
      return;
    }

    EntityReindexContext entityContext = buildEntityReindexContext(entityType);
    if (recreateIndexHandler instanceof DefaultRecreateHandler defaultHandler) {
      LOG.info(
          "Promoting index for entity '{}' (success={}, stagedIndex={})",
          entityType,
          entitySuccess,
          stagedIndexOpt.get());
      defaultHandler.promoteEntityIndex(entityContext, entitySuccess);

      // When promoting the table index, also promote the column index since columns
      // are indexed as part of table processing
      if (Entity.TABLE.equals(entityType)) {
        promoteColumnIndex(defaultHandler, entitySuccess);
      }
    }
  }

  private void promoteColumnIndex(DefaultRecreateHandler handler, boolean tableSuccess) {
    if (recreateContext == null) {
      return;
    }
    Optional<String> columnStagedIndex = recreateContext.getStagedIndex(Entity.TABLE_COLUMN);
    if (columnStagedIndex.isEmpty()) {
      return;
    }
    EntityReindexContext columnContext = buildEntityReindexContext(Entity.TABLE_COLUMN);
    LOG.info(
        "Promoting column index (success={}, stagedIndex={})",
        tableSuccess,
        columnStagedIndex.get());
    handler.promoteEntityIndex(columnContext, tableSuccess);
    promotedEntities.add(Entity.TABLE_COLUMN);
  }

  private ResultList<?> readWithRetry(
      KeysetBatchReader batchReader, String keysetCursor, String entityType)
      throws SearchIndexException, InterruptedException {
    int maxRetryAttempts = 3;
    long retryBackoffMs = 500;
    for (int attempt = 0; attempt <= maxRetryAttempts; attempt++) {
      try {
        return batchReader.readNextKeyset(keysetCursor);
      } catch (SearchIndexException e) {
        if (attempt >= maxRetryAttempts || !isTransientReadError(e)) {
          throw e;
        }
        long backoffDelay = retryBackoffMs * (1L << attempt);
        LOG.warn(
            "Transient read failure for {} (attempt {}/{}), retrying in {}ms",
            entityType,
            attempt + 1,
            maxRetryAttempts,
            backoffDelay);
        Thread.sleep(Math.min(backoffDelay, 10_000));
      }
    }
    return null;
  }

  private boolean isTransientReadError(SearchIndexException e) {
    String msg = e.getMessage();
    if (msg == null) {
      msg = "";
    }
    String lower = msg.toLowerCase();
    return lower.contains("timeout")
        || lower.contains("connection")
        || lower.contains("pool exhausted")
        || lower.contains("connectexception")
        || lower.contains("sockettimeoutexception")
        || lower.contains("remotetransportexception");
  }

  private boolean isBackpressureActive() {
    if (taskQueue != null) {
      int size = taskQueue.size();
      int capacity = size + taskQueue.remainingCapacity();
      if (capacity > 0) {
        int fillPercent = size * 100 / capacity;
        ReindexingMetrics metrics = ReindexingMetrics.getInstance();
        if (metrics != null) {
          metrics.updateQueueFillRatio(fillPercent);
        }
        if (fillPercent > 90) {
          return true;
        }
      }
    }
    return false;
  }

  private void processReadTask(String entityType, Source<?> source, int offset) {
    try {
      if (stopped.get()) {
        return;
      }

      Object resultList = source.readWithCursor(RestUtil.encodeCursor(String.valueOf(offset)));
      if (stopped.get()) {
        return;
      }

      if (resultList != null) {
        ResultList<?> entities = extractEntities(entityType, resultList);
        if (!nullOrEmpty(entities.getData()) && !stopped.get()) {
          IndexingTask<?> task = new IndexingTask<>(entityType, entities, offset);
          taskQueue.put(task);
        }
      }
    } catch (SearchIndexException e) {
      LOG.error("Error reading source for {}", entityType, e);
      if (!stopped.get()) {
        if (failureRecorder != null) {
          failureRecorder.recordReaderFailure(
              entityType, e.getMessage(), ExceptionUtils.getStackTrace(e));
        }

        listeners.onError(entityType, e.getIndexingError(), stats.get());
        IndexingError indexingError = e.getIndexingError();
        int failedCount =
            indexingError != null && indexingError.getFailedCount() != null
                ? indexingError.getFailedCount()
                : batchSize.get();
        updateReaderStats(0, failedCount, 0);
        StepStats failedStats =
            new StepStats().withSuccessRecords(0).withFailedRecords(failedCount);
        updateStats(entityType, failedStats);
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while queueing task for {}", entityType);
    }
  }

  private Source<?> createSource(String entityType) {
    String correctedEntityType = entityType;
    if (QUERY_COST_RESULT_INCORRECT.equals(entityType)) {
      LOG.warn(QUERY_COST_RESULT_WARNING);
      correctedEntityType = QUERY_COST_RECORD;
    }

    List<String> searchIndexFields = getSearchIndexFields(correctedEntityType);
    int knownTotal = getTotalEntityRecords(correctedEntityType);

    if (!TIME_SERIES_ENTITIES.contains(correctedEntityType)) {
      return new PaginatedEntitiesSource(
          correctedEntityType, batchSize.get(), searchIndexFields, knownTotal);
    } else {
      if (config != null) {
        long startTs = config.getTimeSeriesStartTs(correctedEntityType);
        if (startTs > 0) {
          return new PaginatedEntityTimeSeriesSource(
              correctedEntityType,
              batchSize.get(),
              searchIndexFields,
              knownTotal,
              startTs,
              System.currentTimeMillis());
        }
      }
      return new PaginatedEntityTimeSeriesSource(
          correctedEntityType, batchSize.get(), searchIndexFields, knownTotal);
    }
  }

  private List<String> getSearchIndexFields(String entityType) {
    if (TIME_SERIES_ENTITIES.contains(entityType)) {
      return List.of();
    }
    return List.of("*");
  }

  @SuppressWarnings("unchecked")
  private ResultList<?> extractEntities(String entityType, Object resultList) {
    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      return ((ResultList<? extends EntityInterface>) resultList);
    } else {
      return ((ResultList<? extends EntityTimeSeriesInterface>) resultList);
    }
  }

  private Optional<String> getTargetIndexForEntity(String entityType) {
    if (recreateContext == null) {
      return Optional.empty();
    }

    Optional<String> stagedIndex = recreateContext.getStagedIndex(entityType);
    if (stagedIndex.isPresent()) {
      return stagedIndex;
    }

    if (QUERY_COST_RESULT_INCORRECT.equals(entityType)) {
      return recreateContext.getStagedIndex(QUERY_COST_RECORD);
    }

    return Optional.empty();
  }

  public Stats initializeTotalRecords(Set<String> entities) {
    Stats jobDataStats = new Stats();
    jobDataStats.setEntityStats(new EntityStats());

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getEntityTotal(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);

      jobDataStats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
    }

    StepStats jobStats = new StepStats();
    jobStats.setTotalRecords(total);
    jobStats.setSuccessRecords(0);
    jobStats.setFailedRecords(0);
    jobDataStats.setJobStats(jobStats);

    StepStats readerStats = new StepStats();
    readerStats.setTotalRecords(total);
    readerStats.setSuccessRecords(0);
    readerStats.setFailedRecords(0);
    readerStats.setWarningRecords(0);
    jobDataStats.setReaderStats(readerStats);

    StepStats sinkStats = new StepStats();
    sinkStats.setTotalRecords(0);
    sinkStats.setSuccessRecords(0);
    sinkStats.setFailedRecords(0);
    jobDataStats.setSinkStats(sinkStats);

    StepStats processStats = new StepStats();
    processStats.setTotalRecords(0);
    processStats.setSuccessRecords(0);
    processStats.setFailedRecords(0);
    jobDataStats.setProcessStats(processStats);

    // Add a stats slot for TABLE_COLUMN since columns are indexed as part of table processing
    // but TABLE_COLUMN is not a standalone entity in the entities set
    if (entities.contains(Entity.TABLE) && !entities.contains(Entity.TABLE_COLUMN)) {
      StepStats columnEntityStats = new StepStats();
      columnEntityStats.setTotalRecords(0);
      columnEntityStats.setSuccessRecords(0);
      columnEntityStats.setFailedRecords(0);
      jobDataStats
          .getEntityStats()
          .getAdditionalProperties()
          .put(Entity.TABLE_COLUMN, columnEntityStats);
      LOG.info("Added TABLE_COLUMN stats slot for column indexing tracking");
    }

    return jobDataStats;
  }

  private int getEntityTotal(String entityType) {
    try {
      String correctedEntityType = entityType;
      if (QUERY_COST_RESULT_INCORRECT.equals(entityType)) {
        LOG.warn(QUERY_COST_RESULT_WARNING);
        correctedEntityType = QUERY_COST_RECORD;
      }

      if (!TIME_SERIES_ENTITIES.contains(correctedEntityType)) {
        EntityRepository<?> repository = Entity.getEntityRepository(correctedEntityType);
        return repository.getDao().listCount(new ListFilter(Include.ALL));
      } else {
        EntityTimeSeriesRepository<?> repository;
        ListFilter listFilter = new ListFilter(null);
        if (isDataInsightIndex(entityType)) {
          listFilter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(entityType));
          repository = Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
        } else {
          repository = Entity.getEntityTimeSeriesRepository(entityType);
        }
        if (config != null) {
          long startTs = config.getTimeSeriesStartTs(correctedEntityType);
          if (startTs > 0) {
            long endTs = System.currentTimeMillis();
            return repository.getTimeSeriesDao().listCount(listFilter, startTs, endTs, false);
          }
        }
        return repository.getTimeSeriesDao().listCount(listFilter);
      }
    } catch (Exception e) {
      LOG.debug("Error getting total for '{}'", entityType, e);
      return 0;
    }
  }

  private int getTotalEntityRecords(String entityType) {
    if (stats.get() == null
        || stats.get().getEntityStats() == null
        || stats.get().getEntityStats().getAdditionalProperties() == null) {
      return 0;
    }

    StepStats entityStats = stats.get().getEntityStats().getAdditionalProperties().get(entityType);
    if (entityStats != null) {
      return entityStats.getTotalRecords() != null ? entityStats.getTotalRecords() : 0;
    }
    return 0;
  }

  private int calculateNumberOfThreads(int totalEntityRecords, int fixedBatchSize) {
    if (fixedBatchSize <= 0) return 1;
    int mod = totalEntityRecords % fixedBatchSize;
    if (mod == 0) {
      return totalEntityRecords / fixedBatchSize;
    } else {
      return (totalEntityRecords / fixedBatchSize) + 1;
    }
  }

  // Stats is published once via stats.set(initializeTotalRecords(...)) and all subsequent
  // mutations operate on that same mutable object under synchronized methods.

  synchronized void updateStats(String entityType, StepStats currentEntityStats) {
    Stats jobDataStats = stats.get();
    if (jobDataStats == null) {
      return;
    }

    updateEntityStats(jobDataStats, entityType, currentEntityStats);

    // When processing tables, also update column stats from the sink
    if (Entity.TABLE.equals(entityType) && searchIndexSink != null) {
      updateColumnStatsFromSink(jobDataStats);
    }

    updateJobStats(jobDataStats);
  }

  private void updateColumnStatsFromSink(Stats jobDataStats) {
    if (searchIndexSink == null || jobDataStats == null || jobDataStats.getEntityStats() == null) {
      return;
    }
    StepStats columnStats = searchIndexSink.getColumnStats();
    if (columnStats != null && columnStats.getTotalRecords() > 0) {
      StepStats existingColumnStats =
          jobDataStats.getEntityStats().getAdditionalProperties().get(Entity.TABLE_COLUMN);
      if (existingColumnStats != null) {
        existingColumnStats.setTotalRecords(columnStats.getTotalRecords());
        existingColumnStats.setSuccessRecords(columnStats.getSuccessRecords());
        existingColumnStats.setFailedRecords(columnStats.getFailedRecords());
      }
    }
  }

  synchronized void updateReaderStats(int successCount, int failedCount, int warningsCount) {
    Stats jobDataStats = stats.get();
    if (jobDataStats == null) {
      return;
    }

    StepStats readerStats = jobDataStats.getReaderStats();
    if (readerStats == null) {
      readerStats = new StepStats();
      jobDataStats.setReaderStats(readerStats);
    }

    int currentSuccess =
        readerStats.getSuccessRecords() != null ? readerStats.getSuccessRecords() : 0;
    int currentFailed = readerStats.getFailedRecords() != null ? readerStats.getFailedRecords() : 0;
    int currentWarnings =
        readerStats.getWarningRecords() != null ? readerStats.getWarningRecords() : 0;

    readerStats.setSuccessRecords(currentSuccess + successCount);
    readerStats.setFailedRecords(currentFailed + failedCount);
    readerStats.setWarningRecords(currentWarnings + warningsCount);
  }

  synchronized void updateSinkTotalSubmitted(int submittedCount) {
    Stats jobDataStats = stats.get();
    if (jobDataStats == null) {
      return;
    }

    StepStats sinkStats = jobDataStats.getSinkStats();
    if (sinkStats == null) {
      sinkStats = new StepStats();
      sinkStats.setTotalRecords(0);
      jobDataStats.setSinkStats(sinkStats);
    }

    int currentTotal = sinkStats.getTotalRecords() != null ? sinkStats.getTotalRecords() : 0;
    sinkStats.setTotalRecords(currentTotal + submittedCount);
  }

  synchronized void syncSinkStatsFromBulkSink() {
    if (searchIndexSink == null) {
      return;
    }

    Stats jobDataStats = stats.get();
    if (jobDataStats == null) {
      return;
    }

    StepStats bulkSinkStats = searchIndexSink.getStats();
    if (bulkSinkStats == null) {
      return;
    }

    StepStats sinkStats = jobDataStats.getSinkStats();
    if (sinkStats == null) {
      sinkStats = new StepStats();
      jobDataStats.setSinkStats(sinkStats);
    }

    sinkStats.setTotalRecords(
        bulkSinkStats.getTotalRecords() != null ? bulkSinkStats.getTotalRecords() : 0);
    sinkStats.setSuccessRecords(
        bulkSinkStats.getSuccessRecords() != null ? bulkSinkStats.getSuccessRecords() : 0);
    sinkStats.setFailedRecords(
        bulkSinkStats.getFailedRecords() != null ? bulkSinkStats.getFailedRecords() : 0);

    // Sync vector stats if available
    StepStats vectorStats = searchIndexSink.getVectorStats();
    if (vectorStats != null
        && (vectorStats.getTotalRecords() != null && vectorStats.getTotalRecords() > 0)) {
      jobDataStats.setVectorStats(vectorStats);
    }

    // Sync process stats if available
    StepStats processStats = searchIndexSink.getProcessStats();
    if (processStats != null) {
      jobDataStats.setProcessStats(processStats);
    }
  }

  private void updateEntityStats(Stats statsObj, String entityType, StepStats currentEntityStats) {
    if (statsObj.getEntityStats() == null
        || statsObj.getEntityStats().getAdditionalProperties() == null) {
      return;
    }

    StepStats entityStats = statsObj.getEntityStats().getAdditionalProperties().get(entityType);
    if (entityStats != null) {
      entityStats.withSuccessRecords(
          entityStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
      entityStats.withFailedRecords(
          entityStats.getFailedRecords() + currentEntityStats.getFailedRecords());
    }
  }

  private void updateJobStats(Stats statsObj) {
    StepStats jobStats = statsObj.getJobStats();
    if (jobStats == null || statsObj.getEntityStats() == null) {
      return;
    }

    int totalSuccess =
        statsObj.getEntityStats().getAdditionalProperties().entrySet().stream()
            .filter(e -> !Entity.TABLE_COLUMN.equals(e.getKey()))
            .mapToInt(e -> e.getValue().getSuccessRecords())
            .sum();

    int totalFailed =
        statsObj.getEntityStats().getAdditionalProperties().entrySet().stream()
            .filter(e -> !Entity.TABLE_COLUMN.equals(e.getKey()))
            .mapToInt(e -> e.getValue().getFailedRecords())
            .sum();

    jobStats.withSuccessRecords(totalSuccess).withFailedRecords(totalFailed);
  }

  private IndexingError createSinkError(String message) {
    return new IndexingError().withErrorSource(IndexingError.ErrorSource.SINK).withMessage(message);
  }

  private StepStats createFailedStats(IndexingError indexingError, int dataSize) {
    StepStats failedStats = new StepStats();
    failedStats.setSuccessRecords(indexingError != null ? indexingError.getSuccessCount() : 0);
    failedStats.setFailedRecords(indexingError != null ? indexingError.getFailedCount() : dataSize);
    return failedStats;
  }

  private Set<String> getAll() {
    return new HashSet<>(searchRepository.getEntityIndexMap().keySet());
  }

  private ReindexContext reCreateIndexes(Set<String> entities) {
    if (recreateIndexHandler == null) {
      return null;
    }
    return recreateIndexHandler.reCreateIndexes(entities);
  }

  private void closeSinkIfNeeded() throws IOException {
    if (searchIndexSink != null && sinkClosed.compareAndSet(false, true)) {
      int pendingVectorTasks = searchIndexSink.getPendingVectorTaskCount();
      if (pendingVectorTasks > 0) {
        LOG.info(
            "Waiting for {} pending vector embedding tasks to complete before closing",
            pendingVectorTasks);
        VectorCompletionResult vcResult = searchIndexSink.awaitVectorCompletionWithDetails(300);
        LOG.info(
            "Vector completion: completed={}, pending={}, waited={}ms",
            vcResult.completed(),
            vcResult.pendingTaskCount(),
            vcResult.waitedMillis());
      }

      LOG.info("Forcing final flush of bulk processor and vector embeddings");
      searchIndexSink.close();
      syncSinkStatsFromBulkSink();
    }
  }

  private ExecutionResult buildResult() {
    if (failureRecorder != null) {
      failureRecorder.flush();
    }

    syncSinkStatsFromBulkSink();
    updateColumnStatsFromSink(stats.get());

    Stats currentStats = stats.get();
    if (currentStats != null) {
      StatsReconciler.reconcile(currentStats);
    }

    long endTime = System.currentTimeMillis();
    ExecutionResult.Status status = determineStatus();

    if (status == ExecutionResult.Status.COMPLETED) {
      listeners.onJobCompleted(stats.get(), endTime - startTime);
    } else if (status == ExecutionResult.Status.COMPLETED_WITH_ERRORS) {
      listeners.onJobCompletedWithErrors(stats.get(), endTime - startTime);
    } else if (status == ExecutionResult.Status.STOPPED) {
      listeners.onJobStopped(stats.get());
    }

    return ExecutionResult.fromStats(stats.get(), status, startTime);
  }

  private ExecutionResult.Status determineStatus() {
    if (stopped.get()) {
      return ExecutionResult.Status.STOPPED;
    }

    if (hasIncompleteProcessing()) {
      return ExecutionResult.Status.COMPLETED_WITH_ERRORS;
    }

    return ExecutionResult.Status.COMPLETED;
  }

  private boolean hasIncompleteProcessing() {
    Stats currentStats = stats.get();
    if (currentStats == null || currentStats.getJobStats() == null) {
      return false;
    }

    StepStats jobStats = currentStats.getJobStats();
    long failed = jobStats.getFailedRecords() != null ? jobStats.getFailedRecords() : 0;
    long processed = jobStats.getSuccessRecords() != null ? jobStats.getSuccessRecords() : 0;
    long total = jobStats.getTotalRecords() != null ? jobStats.getTotalRecords() : 0;

    return failed > 0 || (total > 0 && processed < total);
  }

  public void stop() {
    LOG.info("Stopping reindexing executor...");
    stopped.set(true);
    producersDone.set(true);

    listeners.onJobStopped(stats.get());

    if (searchIndexSink != null) {
      LOG.info(
          "Stopping executor: flushing sink ({} active bulk requests)",
          searchIndexSink.getActiveBulkRequestCount());
      searchIndexSink.flushAndAwait(10);
    }

    int dropped = taskQueue != null ? taskQueue.size() : 0;
    if (dropped > 0) {
      LOG.warn("Dropping {} queued tasks during shutdown", dropped);
    }

    shutdownExecutor(producerExecutor, "producer");
    shutdownExecutor(jobExecutor, "job");

    if (taskQueue != null) {
      taskQueue.clear();
      for (int i = 0; i < MAX_CONSUMER_THREADS; i++) {
        taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      }
    }
    if (consumerExecutor != null && !consumerExecutor.isShutdown()) {
      consumerExecutor.shutdown();
      try {
        if (!consumerExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
          consumerExecutor.shutdownNow();
          LOG.warn("Consumer executor did not terminate within 5s, forced shutdown");
        }
      } catch (InterruptedException e) {
        consumerExecutor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }

    LOG.info("Reindexing executor stopped");
  }

  public boolean isStopped() {
    return stopped.get();
  }

  private void cleanupExecutors() {
    if (!stopped.get()) {
      shutdownExecutor(consumerExecutor, "consumer", 30, TimeUnit.SECONDS);
      shutdownExecutor(jobExecutor, "job", 20, TimeUnit.SECONDS);
      shutdownExecutor(producerExecutor, "producer", 1, TimeUnit.MINUTES);
    }
  }

  private void shutdownExecutor(ExecutorService executor, String name) {
    if (executor != null && !executor.isShutdown()) {
      LOG.info("Force shutting down {} executor", name);
      List<Runnable> pendingTasks = executor.shutdownNow();
      LOG.info("Cancelled {} pending {} tasks", pendingTasks.size(), name);
    }
  }

  private void shutdownExecutor(
      ExecutorService executor, String name, long timeout, TimeUnit unit) {
    if (executor != null && !executor.isShutdown()) {
      executor.shutdown();
      try {
        if (!executor.awaitTermination(timeout, unit)) {
          executor.shutdownNow();
          LOG.warn("{} did not terminate within timeout", name);
        }
      } catch (InterruptedException e) {
        executor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }
  }

  private void cleanup() {
    if (failureRecorder != null) {
      try {
        failureRecorder.close();
      } catch (Exception e) {
        LOG.error("Error closing failure recorder", e);
      }
    }

    if (searchIndexSink != null && sinkClosed.compareAndSet(false, true)) {
      try {
        searchIndexSink.close();
      } catch (Exception e) {
        LOG.error("Error closing search index sink", e);
      }
    }

    finalizeReindex();
  }

  private void finalizeReindex() {
    if (recreateIndexHandler == null || recreateContext == null) {
      return;
    }

    try {
      recreateContext
          .getEntities()
          .forEach(
              entityType -> {
                // Skip entities already promoted via per-entity promotion
                if (promotedEntities.contains(entityType)) {
                  LOG.debug(
                      "Skipping finalizeReindex for entity '{}' - already promoted.", entityType);
                  return;
                }
                try {
                  AtomicInteger failures = entityBatchFailures.get(entityType);
                  boolean entitySuccess =
                      !stopped.get() && (failures == null || failures.get() == 0);
                  recreateIndexHandler.finalizeReindex(
                      buildEntityReindexContext(entityType), entitySuccess);
                } catch (Exception ex) {
                  LOG.error("Failed to finalize reindex for {}", entityType, ex);
                }
              });
    } finally {
      recreateContext = null;
      promotedEntities.clear();
    }
  }

  private EntityReindexContext buildEntityReindexContext(String entityType) {
    return EntityReindexContext.builder()
        .entityType(entityType)
        .originalIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
        .canonicalIndex(recreateContext.getCanonicalIndex(entityType).orElse(null))
        .activeIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
        .stagedIndex(recreateContext.getStagedIndex(entityType).orElse(null))
        .canonicalAliases(recreateContext.getCanonicalAlias(entityType).orElse(null))
        .existingAliases(recreateContext.getExistingAliases(entityType))
        .parentAliases(new HashSet<>(listOrEmpty(recreateContext.getParentAliases(entityType))))
        .build();
  }

  @Override
  public void close() {
    if (statsManager != null) {
      statsManager.flushAll();
    }
    sinkTrackers.values().forEach(StageStatsTracker::flush);
    stop();
    cleanup();
  }
}
