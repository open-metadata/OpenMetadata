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
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
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
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

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

  private static final int MAX_PRODUCER_THREADS = 20;
  private static final int MAX_CONSUMER_THREADS = 20;
  private static final int MAX_TOTAL_THREADS = 50;
  private static final int MAX_CONSECUTIVE_ERRORS = 5;
  private static final int BATCH_SIZE_INCREASE_THRESHOLD = 20;
  private static final long BACKPRESSURE_WAIT_MS = 5000;
  private static final long TUNE_INTERVAL_MS = 10000;

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
  private final AtomicInteger consecutiveErrors = new AtomicInteger(0);
  private final AtomicInteger consecutiveSuccesses = new AtomicInteger(0);
  private volatile long lastBackpressureTime = 0;
  private final AtomicInteger originalBatchSize = new AtomicInteger(0);

  private volatile long lastTuneTime = 0;
  private final AtomicLong totalProcessingTime = new AtomicLong(0);
  private final AtomicLong totalEntitiesProcessed = new AtomicLong(0);
  private volatile double currentThroughput = 0.0;

  private ReindexingConfiguration config;
  private ReindexingJobContext context;
  private long startTime;
  private IndexingFailureRecorder failureRecorder;
  private JobStatsManager statsManager;
  private final Map<String, AtomicInteger> entityBatchCounters = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> entityBatchFailures = new ConcurrentHashMap<>();
  private final Set<String> promotedEntities = ConcurrentHashMap.newKeySet();

  record IndexingTask<T>(String entityType, ResultList<T> entities, int offset, int retryCount) {
    IndexingTask(String entityType, ResultList<T> entities, int offset) {
      this(entityType, entities, offset, 0);
    }
  }

  record ThreadConfiguration(int numProducers, int numConsumers) {}

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

  static class TuningContext {
    final MemoryInfo memInfo;
    final int currentBatchSize;
    final int errorCount;
    final int successCount;

    TuningContext(MemoryInfo memInfo, int currentBatchSize, int errorCount, int successCount) {
      this.memInfo = memInfo;
      this.currentBatchSize = currentBatchSize;
      this.errorCount = errorCount;
      this.successCount = successCount;
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
    consecutiveErrors.set(0);
    consecutiveSuccesses.set(0);
    lastBackpressureTime = 0;
    originalBatchSize.set(0);
    recreateContext = null;
    producersDone.set(false);
    entityBatchCounters.clear();
    entityBatchFailures.clear();
    promotedEntities.clear();
    initStatsManager();
  }

  private ExecutionResult executeSingleServer() throws Exception {
    Set<String> entities = expandEntities(config.entities());
    ReindexingConfiguration effectiveConfig = applyAutoTuning(entities);

    listeners.onJobConfigured(context, effectiveConfig);

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

    initializeSink(effectiveConfig);

    if (effectiveConfig.recreateIndex()) {
      validateClusterCapacity(entities);
      listeners.onIndexRecreationStarted(entities);
      recreateContext = reCreateIndexes(entities);
    }

    SearchClusterMetrics clusterMetrics = null;
    if (effectiveConfig.autoTune()) {
      clusterMetrics = fetchClusterMetrics();
    }

    reIndexFromStartToEnd(clusterMetrics, entities);
    closeSinkIfNeeded();

    return buildResult();
  }

  private Set<String> expandEntities(Set<String> entities) {
    if (entities.contains(ALL)) {
      return getAll();
    }
    return entities;
  }

  private ReindexingConfiguration applyAutoTuning(Set<String> entities) {
    if (!config.autoTune()) {
      batchSize.set(config.batchSize());
      originalBatchSize.set(config.batchSize());
      return config;
    }

    SearchClusterMetrics metrics = fetchClusterMetrics();
    if (metrics == null) {
      batchSize.set(config.batchSize());
      originalBatchSize.set(config.batchSize());
      return config;
    }

    batchSize.set(metrics.getRecommendedBatchSize());
    originalBatchSize.set(metrics.getRecommendedBatchSize());

    return ReindexingConfiguration.builder()
        .entities(entities)
        .batchSize(metrics.getRecommendedBatchSize())
        .consumerThreads(metrics.getRecommendedConsumerThreads())
        .producerThreads(metrics.getRecommendedProducerThreads())
        .queueSize(metrics.getRecommendedQueueSize())
        .maxConcurrentRequests(metrics.getRecommendedConcurrentRequests())
        .payloadSize(metrics.getMaxPayloadSizeBytes())
        .recreateIndex(config.recreateIndex())
        .autoTune(true)
        .useDistributedIndexing(config.useDistributedIndexing())
        .force(config.force())
        .maxRetries(config.maxRetries())
        .initialBackoff(config.initialBackoff())
        .maxBackoff(config.maxBackoff())
        .searchIndexMappingLanguage(config.searchIndexMappingLanguage())
        .afterCursor(config.afterCursor())
        .slackBotToken(config.slackBotToken())
        .slackChannel(config.slackChannel())
        .build();
  }

  private SearchClusterMetrics fetchClusterMetrics() {
    try {
      long totalRecords =
          stats.get() != null && stats.get().getJobStats() != null
              ? stats.get().getJobStats().getTotalRecords()
              : 0;
      return SearchClusterMetrics.fetchClusterMetrics(
          searchRepository, totalRecords, searchRepository.getMaxDBConnections());
    } catch (Exception e) {
      LOG.warn("Failed to fetch cluster metrics, using defaults", e);
      return null;
    }
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
      String entityType, String entityId, String entityFqn, String errorMessage) {
    if (failureRecorder != null) {
      failureRecorder.recordSinkFailure(entityType, entityId, entityFqn, errorMessage);
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

  private void reIndexFromStartToEnd(SearchClusterMetrics clusterMetrics, Set<String> entities)
      throws InterruptedException {
    long totalEntities =
        stats.get() != null && stats.get().getJobStats() != null
            ? stats.get().getJobStats().getTotalRecords()
            : 0;

    ThreadConfiguration threadConfig = calculateThreadConfiguration(totalEntities, clusterMetrics);
    int effectiveQueueSize = initializeQueueAndExecutors(threadConfig, entities.size());

    LOG.info(
        "Starting reindexing with {} producers, {} consumers, queue size {}",
        threadConfig.numProducers(),
        threadConfig.numConsumers(),
        effectiveQueueSize);

    executeReindexing(threadConfig.numConsumers(), entities);
  }

  private ThreadConfiguration calculateThreadConfiguration(
      long totalEntities, SearchClusterMetrics clusterMetrics) {
    int numConsumers =
        config.consumerThreads() > 0 ? Math.min(config.consumerThreads(), MAX_CONSUMER_THREADS) : 2;
    int numProducers = Math.clamp((int) (totalEntities / 10000), 2, MAX_PRODUCER_THREADS);

    if (clusterMetrics != null) {
      numConsumers = Math.min(clusterMetrics.getRecommendedConsumerThreads(), MAX_CONSUMER_THREADS);
      numProducers = Math.min(clusterMetrics.getRecommendedProducerThreads(), MAX_PRODUCER_THREADS);
    }

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

    jobExecutor =
        Executors.newFixedThreadPool(entityCount, Thread.ofPlatform().name("job-", 0).factory());

    int finalNumConsumers = Math.min(threadConfig.numConsumers(), MAX_CONSUMER_THREADS);
    consumerExecutor =
        Executors.newFixedThreadPool(
            finalNumConsumers, Thread.ofPlatform().name("consumer-", 0).factory());

    producerExecutor =
        Executors.newFixedThreadPool(
            threadConfig.numProducers(), Thread.ofPlatform().name("producer-", 0).factory());

    return effectiveQueueSize;
  }

  private int calculateMemoryAwareQueueSize(int requestedSize) {
    MemoryInfo memInfo = new MemoryInfo();
    long estimatedEntitySize = 5 * 1024L;
    long maxQueueMemory = (long) (memInfo.maxMemory * 0.25);
    int memoryBasedLimit = (int) (maxQueueMemory / (estimatedEntitySize * batchSize.get()));
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
    for (int i = 0; i < numConsumers; i++) {
      final int consumerId = i;
      consumerExecutor.submit(() -> runConsumer(consumerId, consumerLatch));
    }
    return consumerLatch;
  }

  private void runConsumer(int consumerId, CountDownLatch consumerLatch) {
    LOG.debug("Consumer {} started", consumerId);
    try {
      while (!stopped.get()) {
        try {
          IndexingTask<?> task = taskQueue.poll(500, TimeUnit.MILLISECONDS);
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

    long taskStartTime = System.currentTimeMillis();

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

      long processingTime = System.currentTimeMillis() - taskStartTime;
      totalProcessingTime.addAndGet(processingTime);
      totalEntitiesProcessed.addAndGet(readerSuccessCount);

      performAdaptiveTuning();
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
    contextData.put(BulkSink.STATS_TRACKER_CONTEXT_KEY, getTracker(entityType));
    getTargetIndexForEntity(entityType)
        .ifPresent(index -> contextData.put(TARGET_INDEX_KEY, index));
    return contextData;
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
    } else {
      handleSuccessfulBatch();
    }

    updateStats(entityType, currentEntityStats);
    listeners.onProgressUpdate(stats.get(), context);
  }

  private void handleSuccessfulBatch() {
    if (consecutiveErrors.get() > 0) {
      consecutiveErrors.set(0);
    }
    consecutiveSuccesses.incrementAndGet();

    if (consecutiveSuccesses.get() >= BATCH_SIZE_INCREASE_THRESHOLD
        && originalBatchSize.get() > 0) {
      int currentBatchSize = batchSize.get();
      int targetBatchSize = Math.clamp((currentBatchSize * 3L) / 2, 1, originalBatchSize.get());

      if (targetBatchSize > currentBatchSize) {
        batchSize.set(targetBatchSize);
        LOG.info("Increased batch size from {} to {}", currentBatchSize, targetBatchSize);
        updateSinkBatchSize(targetBatchSize);
        consecutiveSuccesses.set(0);
      }
    }
  }

  private void handleSearchIndexException(
      String entityType, ResultList<?> entities, SearchIndexException e) {
    if (!stopped.get()) {
      IndexingError indexingError = e.getIndexingError();
      if (indexingError != null) {
        listeners.onError(entityType, indexingError, stats.get());
        handleBackpressure(indexingError.getMessage());
      } else {
        IndexingError error = createSinkError(e.getMessage());
        listeners.onError(entityType, error, stats.get());
        handleBackpressure(e.getMessage());
      }

      syncSinkStatsFromBulkSink();

      int dataSize = entities != null && entities.getData() != null ? entities.getData().size() : 0;
      StepStats failedStats = createFailedStats(indexingError, dataSize);
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
      StepStats failedStats = new StepStats().withSuccessRecords(0).withFailedRecords(failedCount);
      updateStats(entityType, failedStats);
    }
    LOG.error("Error for {}", entityType, e);
  }

  private void handleBackpressure(String errorMessage) {
    if (errorMessage != null && isBackpressureError(errorMessage)) {
      consecutiveErrors.incrementAndGet();
      consecutiveSuccesses.set(0);
      LOG.warn("Detected backpressure (consecutive errors: {})", consecutiveErrors.get());

      boolean isPayloadTooLarge = isPayloadTooLargeError(errorMessage);
      int requiredConsecutiveErrors = isPayloadTooLarge ? 1 : MAX_CONSECUTIVE_ERRORS;

      if (consecutiveErrors.get() >= requiredConsecutiveErrors) {
        int currentBatchSize = batchSize.get();
        int reductionFactor = isPayloadTooLarge ? 4 : 2;
        int newBatchSize = Math.clamp(currentBatchSize / reductionFactor, 50, Integer.MAX_VALUE);

        if (newBatchSize < currentBatchSize) {
          batchSize.set(newBatchSize);
          LOG.info(
              "Reduced batch size from {} to {} due to {} error",
              currentBatchSize,
              newBatchSize,
              isPayloadTooLarge ? "payload too large" : "backpressure");
          updateSinkBatchSize(newBatchSize);
          consecutiveErrors.set(0);
        }
      }
      lastBackpressureTime = System.currentTimeMillis();
    }
  }

  private boolean isBackpressureError(String errorMessage) {
    if (errorMessage == null) {
      return false;
    }
    String lowerCaseMessage = errorMessage.toLowerCase();
    return lowerCaseMessage.contains("rejected_execution_exception")
        || lowerCaseMessage.contains("circuit_breaking_exception")
        || lowerCaseMessage.contains("too_many_requests")
        || isPayloadTooLargeError(errorMessage);
  }

  private boolean isPayloadTooLargeError(String errorMessage) {
    if (errorMessage == null) {
      return false;
    }
    String lowerCaseMessage = errorMessage.toLowerCase();
    return lowerCaseMessage.contains("request entity too large")
        || lowerCaseMessage.contains("content too long")
        || lowerCaseMessage.contains("413");
  }

  private void performAdaptiveTuning() {
    if (!config.autoTune()) {
      return;
    }

    long currentTime = System.currentTimeMillis();
    if (currentTime - lastTuneTime < TUNE_INTERVAL_MS) {
      return;
    }

    lastTuneTime = currentTime;

    long processedEntities = totalEntitiesProcessed.get();
    long processingTime = totalProcessingTime.get();
    if (processingTime > 0) {
      currentThroughput = (processedEntities * 1000.0) / processingTime;
    }

    TuningContext tuningContext =
        new TuningContext(
            new MemoryInfo(), batchSize.get(), consecutiveErrors.get(), consecutiveSuccesses.get());

    if (tuningContext.errorCount == 0
        && tuningContext.successCount > BATCH_SIZE_INCREASE_THRESHOLD
        && tuningContext.memInfo.usageRatio < 0.7) {
      int newBatchSize = Math.min(tuningContext.currentBatchSize + 50, 1000);
      if (newBatchSize != tuningContext.currentBatchSize) {
        batchSize.set(newBatchSize);
        LOG.info(
            "Auto-tune: Increased batch size to {} (throughput: {}/sec)",
            newBatchSize,
            String.format("%.1f", currentThroughput));
        updateSinkBatchSize(newBatchSize);
      }
    } else if (tuningContext.memInfo.usageRatio > 0.8) {
      int newBatchSize = Math.max(tuningContext.currentBatchSize - 100, 50);
      if (newBatchSize != tuningContext.currentBatchSize) {
        batchSize.set(newBatchSize);
        LOG.warn(
            "Auto-tune: Reduced batch size to {} due to memory pressure ({}% used)",
            newBatchSize, (int) (tuningContext.memInfo.usageRatio * 100));
      }
    }
  }

  private void updateSinkBatchSize(int newBatchSize) {
    if (searchIndexSink instanceof OpenSearchBulkSink opensearchBulkSink) {
      opensearchBulkSink.updateBatchSize(newBatchSize);
    } else if (searchIndexSink instanceof ElasticSearchBulkSink elasticSearchBulkSink) {
      elasticSearchBulkSink.updateBatchSize(newBatchSize);
    }
  }

  private void signalConsumersToStop(int numConsumers) {
    producersDone.set(true);
    for (int i = 0; i < numConsumers; i++) {
      boolean offered = taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      if (!offered) {
        LOG.debug("Could not add poison pill to queue");
      }
    }
  }

  private void waitForConsumersToComplete(CountDownLatch consumerLatch)
      throws InterruptedException {
    LOG.info("Waiting for consumers to complete...");
    consumerLatch.await();
    LOG.info("All consumers finished");
  }

  private void processEntityReindex(Set<String> entities) throws InterruptedException {
    int snapshotBatchSize = batchSize.get();
    int latchCount = getTotalLatchCount(entities, snapshotBatchSize);
    CountDownLatch producerLatch = new CountDownLatch(latchCount);

    for (String entityType : entities) {
      jobExecutor.submit(() -> processEntityType(entityType, producerLatch, snapshotBatchSize));
    }

    while (!producerLatch.await(1, TimeUnit.SECONDS)) {
      if (stopped.get() || Thread.currentThread().isInterrupted()) {
        LOG.info("Stop signal received during reindexing");
        if (producerExecutor != null) producerExecutor.shutdownNow();
        if (jobExecutor != null) jobExecutor.shutdownNow();
        return;
      }
    }
  }

  private void processEntityType(
      String entityType, CountDownLatch producerLatch, int fixedBatchSize) {
    try {
      listeners.onEntityTypeStarted(entityType, getTotalEntityRecords(entityType));

      int totalEntityRecords = getTotalEntityRecords(entityType);
      int loadPerThread = calculateNumberOfThreads(totalEntityRecords, fixedBatchSize);

      // Initialize per-entity batch tracking for promotion
      int batchCount = totalEntityRecords > 0 ? loadPerThread : 0;
      entityBatchCounters.put(entityType, new AtomicInteger(batchCount));
      entityBatchFailures.put(entityType, new AtomicInteger(0));

      if (totalEntityRecords > 0) {
        for (int i = 0; i < loadPerThread; i++) {
          int currentOffset = i * fixedBatchSize;
          producerExecutor.submit(() -> processBatch(entityType, currentOffset, producerLatch));
        }
      } else {
        // No records to process - promote immediately if recreating indexes
        promoteEntityIndexIfReady(entityType);
      }

      StepStats entityStats =
          stats.get() != null && stats.get().getEntityStats() != null
              ? stats.get().getEntityStats().getAdditionalProperties().get(entityType)
              : null;
      listeners.onEntityTypeCompleted(entityType, entityStats);
    } catch (Exception e) {
      LOG.error("Error processing entity type {}", entityType, e);
    }
  }

  private void processBatch(String entityType, int currentOffset, CountDownLatch producerLatch) {
    boolean batchHadFailure = false;
    try {
      if (stopped.get()) {
        return;
      }

      // Wait for backpressure to clear instead of dropping the batch
      long backpressureWaitStart = System.currentTimeMillis();
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
        Thread.sleep(500);
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

    // Check if already promoted (avoid double promotion)
    if (promotedEntities.contains(entityType)) {
      LOG.debug("Entity '{}' already promoted, skipping.", entityType);
      return;
    }

    // Determine success based on whether there were any batch failures
    AtomicInteger failures = entityBatchFailures.get(entityType);
    boolean entitySuccess = failures == null || failures.get() == 0;

    // Build entity context and promote
    Optional<String> stagedIndexOpt = recreateContext.getStagedIndex(entityType);
    if (stagedIndexOpt.isEmpty()) {
      LOG.debug("No staged index found for entity '{}', skipping promotion.", entityType);
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
      promotedEntities.add(entityType);
    }
  }

  private boolean isBackpressureActive() {
    if (lastBackpressureTime == 0) {
      return false;
    }
    return System.currentTimeMillis() - lastBackpressureTime < BACKPRESSURE_WAIT_MS;
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
        return repository.getTimeSeriesDao().listCount(listFilter);
      }
    } catch (Exception e) {
      LOG.debug("Error getting total for '{}'", entityType, e);
      return 0;
    }
  }

  private int getTotalLatchCount(Set<String> entities, int fixedBatchSize) {
    if (stats.get() == null) {
      return entities.size();
    }

    return entities.stream()
        .mapToInt(
            entityType -> {
              int totalRecords = getTotalEntityRecords(entityType);
              return calculateNumberOfThreads(totalRecords, fixedBatchSize);
            })
        .sum();
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

  synchronized void updateStats(String entityType, StepStats currentEntityStats) {
    Stats jobDataStats = stats.get();
    if (jobDataStats == null) {
      return;
    }

    updateEntityStats(jobDataStats, entityType, currentEntityStats);
    updateJobStats(jobDataStats);
    stats.set(jobDataStats);
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

    stats.set(jobDataStats);
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

    stats.set(jobDataStats);
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

    stats.set(jobDataStats);
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
        statsObj.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum();

    int totalFailed =
        statsObj.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getFailedRecords)
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
    Set<String> entityAvailableForIndex =
        Entity.getEntityList().stream()
            .filter(t -> searchRepository.getEntityIndexMap().containsKey(t))
            .collect(Collectors.toSet());
    Set<String> entities = new HashSet<>(entityAvailableForIndex);
    entities.addAll(
        TIME_SERIES_ENTITIES.stream()
            .filter(t -> searchRepository.getEntityIndexMap().containsKey(t))
            .collect(Collectors.toSet()));
    return entities;
  }

  private ReindexContext reCreateIndexes(Set<String> entities) {
    if (recreateIndexHandler == null) {
      return null;
    }
    return recreateIndexHandler.reCreateIndexes(entities);
  }

  private void closeSinkIfNeeded() throws IOException {
    if (searchIndexSink != null && sinkClosed.compareAndSet(false, true)) {
      // Check for pending vector tasks before closing
      int pendingVectorTasks = searchIndexSink.getPendingVectorTaskCount();
      if (pendingVectorTasks > 0) {
        LOG.info(
            "Waiting for {} pending vector embedding tasks to complete before closing",
            pendingVectorTasks);
      }

      LOG.info("Forcing final flush of bulk processor and vector embeddings");
      // close() internally calls awaitVectorCompletion() first, then flushes search index
      searchIndexSink.close();
      syncSinkStatsFromBulkSink();
    }
  }

  private ExecutionResult buildResult() {
    if (failureRecorder != null) {
      failureRecorder.flush();
    }

    syncSinkStatsFromBulkSink();

    Stats currentStats = stats.get();
    if (currentStats != null) {
      StatsReconciler.reconcile(currentStats);
      stats.set(currentStats);
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

    if (taskQueue != null) {
      taskQueue.clear();
      for (int i = 0; i < 10; i++) {
        taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      }
    }

    shutdownExecutor(producerExecutor, "producer");
    shutdownExecutor(consumerExecutor, "consumer");
    shutdownExecutor(jobExecutor, "job");

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
    stop();
    cleanup();
  }
}
