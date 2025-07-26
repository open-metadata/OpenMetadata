package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.quartz.JobExecutionContext;

@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {

  /**
   * Custom exception for reindexing job failures
   */
  public static class ReindexingException extends RuntimeException {
    public ReindexingException(String message) {
      super(message);
    }

    public ReindexingException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  private static final String ALL = "all";
  private static final String POISON_PILL = "__POISON_PILL__";
  private static final int DEFAULT_QUEUE_SIZE = 20000;
  private static final String AUTO_TUNE = "Auto-tune";
  private static final String ENABLED = "Enabled";
  private static final String DISABLED = "Disabled";
  private static final String RECREATE_INDEX = "recreateIndex";
  private static final String ENTITY_TYPE_KEY = "entityType";

  // String constants to avoid duplication
  private static final String APP_SCHEDULE_RUN = "AppScheduleRun";
  private static final String CONSUMER_THREADS = "Consumer threads";
  private static final String PRODUCER_THREADS = "Producer threads";
  private static final String BATCH_SIZE = "Batch size";
  private static final String QUEUE_SIZE_EFFECTIVE = "Queue size (effective)";
  private static final String TOTAL_ENTITIES = "Total entities";
  private static final String SEARCH_TYPE = "Search type";
  private static final String RECREATING_INDICES = "Recreating indices";
  private static final String PAYLOAD_SIZE = "Payload size";
  private static final String CONCURRENT_REQUESTS = "Concurrent requests";
  private static final String SINK_ERROR_MESSAGE = "Issues in Sink to Elastic Search for %s";
  private static final String ERROR_SENDING_UPDATES = "Error sending updates";
  private static final String QUERY_COST_RESULT_INCORRECT = "queryCostResult";
  private static final String QUERY_COST_RESULT_WARNING =
      "Found incorrect entity type 'queryCostResult', correcting to 'queryCostRecord'";

  private static final int MAX_PRODUCER_THREADS = 20;
  private static final int MAX_CONSUMER_THREADS = 20;
  private static final int MAX_TOTAL_THREADS = 50;

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

  private BulkSink searchIndexSink;

  @Getter private EventPublisherJob jobData;
  private ExecutorService producerExecutor;
  private ExecutorService consumerExecutor;
  private ExecutorService jobExecutor;
  private final AtomicReference<Stats> searchIndexStats = new AtomicReference<>();
  private final AtomicReference<Integer> batchSize = new AtomicReference<>(5);
  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;
  private volatile long lastWebSocketUpdate = 0;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000; // 2 seconds
  private ReindexingJobLogger jobLogger;
  private SlackWebApiClient slackClient;
  private String entitiesDisplayString;
  private boolean isSmartReindexing;

  private final AtomicInteger consecutiveErrors = new AtomicInteger(0);
  private final AtomicInteger consecutiveSuccesses = new AtomicInteger(0);
  private volatile long lastBackpressureTime = 0;
  private static final int MAX_CONSECUTIVE_ERRORS = 5;
  private static final int BATCH_SIZE_INCREASE_THRESHOLD = 50;
  private static final long BACKPRESSURE_WAIT_MS = 5000;
  private final AtomicInteger originalBatchSize = new AtomicInteger(0);

  // Adaptive tuning metrics
  private volatile long lastTuneTime = 0;
  private static final long TUNE_INTERVAL_MS = 30000; // Re-tune every 30 seconds
  private final AtomicLong totalProcessingTime = new AtomicLong(0);
  private final AtomicLong totalEntitiesProcessed = new AtomicLong(0);
  private volatile double currentThroughput = 0.0;

  private BlockingQueue<IndexingTask<?>> taskQueue;
  private final AtomicBoolean producersDone = new AtomicBoolean(false);

  record IndexingTask<T>(String entityType, ResultList<T> entities, int offset, int retryCount) {
    IndexingTask(String entityType, ResultList<T> entities, int offset) {
      this(entityType, entities, offset, 0);
    }
  }

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    jobData = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class);
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    initializeJobState();
    initializeJobData(jobExecutionContext);

    try {
      runReindexing(jobExecutionContext);
    } catch (Exception ex) {
      handleExecutionException(ex);
    } finally {
      finalizeJobExecution(jobExecutionContext);
    }
  }

  private void initializeJobState() {
    stopped = false;
    consecutiveErrors.set(0);
    consecutiveSuccesses.set(0);
    lastBackpressureTime = 0;
    originalBatchSize.set(0);
  }

  private void initializeJobData(JobExecutionContext jobExecutionContext) {
    if (jobData == null) {
      jobData = loadJobData(jobExecutionContext);
    }

    String jobName = jobExecutionContext.getJobDetail().getKey().getName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig =
          JsonUtils.convertValue(jobData, new TypeReference<Map<String, Object>>() {});
      getApp().setAppConfiguration(jsonAppConfig);
    }
  }

  private EventPublisherJob loadJobData(JobExecutionContext jobExecutionContext) {
    String appConfigJson =
        (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG);
    if (appConfigJson != null) {
      return JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
    }

    if (getApp() != null && getApp().getAppConfiguration() != null) {
      return JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
    }

    LOG.error("Unable to initialize jobData from JobDataMap or App configuration");
    throw new ReindexingException("JobData is not initialized");
  }

  private void runReindexing(JobExecutionContext jobExecutionContext) throws Exception {
    setupEntities();
    LOG.info(
        "Search Index Job Started for Entities: {}, RecreateIndex: {}",
        jobData.getEntities(),
        jobData.getRecreateIndex());

    SearchClusterMetrics clusterMetrics = initializeJob(jobExecutionContext);

    if (Boolean.TRUE.equals(jobData.getRecreateIndex())) {
      recreateIndicesIfNeeded();
    }

    updateJobStatus(EventPublisherJob.Status.RUNNING);
    reIndexFromStartToEnd(clusterMetrics);
    closeSinkIfNeeded();
    updateFinalJobStatus();
    handleJobCompletion();
  }

  private void setupEntities() {
    boolean containsAll = jobData.getEntities().contains(ALL);
    if (containsAll) {
      entitiesDisplayString = "All";
      jobData.setEntities(getAll());
    } else {
      entitiesDisplayString = String.join(", ", jobData.getEntities());
    }
  }

  private void recreateIndicesIfNeeded() {
    if (jobLogger != null) {
      jobLogger.addInitDetail(RECREATING_INDICES, "Yes");
    }
    reCreateIndexes(jobData.getEntities());
  }

  private void closeSinkIfNeeded() throws IOException {
    if (searchIndexSink != null) {
      LOG.info("Forcing final flush of bulk processor");
      searchIndexSink.close();
    }
  }

  private void updateFinalJobStatus() {
    if (stopped) {
      updateJobStatus(EventPublisherJob.Status.STOPPED);
    } else if (hasIncompleteProcessing()) {
      updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      LOG.warn("Reindexing completed with errors - some entities were not fully indexed");
    } else {
      updateJobStatus(EventPublisherJob.Status.COMPLETED);
    }
  }

  private boolean hasIncompleteProcessing() {
    if (jobData == null || jobData.getStats() == null || jobData.getStats().getJobStats() == null) {
      return false;
    }

    StepStats jobStats = jobData.getStats().getJobStats();
    long failed = jobStats.getFailedRecords() != null ? jobStats.getFailedRecords() : 0;
    long processed = jobStats.getSuccessRecords() != null ? jobStats.getSuccessRecords() : 0;
    long total = jobStats.getTotalRecords() != null ? jobStats.getTotalRecords() : 0;

    return failed > 0 || (total > 0 && processed < total);
  }

  private void handleExecutionException(Exception ex) {
    closeSinkSafely();

    if (stopped) {
      handleStoppedJob();
    } else {
      handleJobFailure(ex);
    }
  }

  private void closeSinkSafely() {
    if (searchIndexSink != null) {
      try {
        searchIndexSink.close();
      } catch (Exception e) {
        LOG.error("Error closing search index sink during exception handling", e);
      }
    }
  }

  private void handleStoppedJob() {
    if (jobData != null) {
      LOG.info("Search Index Job Stopped for Entities: {}", jobData.getEntities());
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }
  }

  private void sendWebSocketUpdateSafely(JobExecutionContext jobExecutionContext) {
    try {
      sendUpdates(jobExecutionContext, true);
    } catch (Exception wsEx) {
      LOG.error("Failed to send WebSocket update for STOPPED status", wsEx);
    }
  }

  private void finalizeJobExecution(JobExecutionContext jobExecutionContext) {
    sendUpdates(jobExecutionContext, true);

    if (stopped && jobExecutionContext != null) {
      updateStoppedStatusInJobDataMap(jobExecutionContext);
    }
  }

  private void updateStoppedStatusInJobDataMap(JobExecutionContext jobExecutionContext) {
    LOG.info("Ensuring final STOPPED status in JobDataMap");
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(AppRunRecord.Status.STOPPED);
    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(APP_SCHEDULE_RUN, JsonUtils.pojoToJson(appRecord));
  }

  private static class MemoryInfo {
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

  private int calculateMemoryAwareQueueSize(int requestedSize) {
    MemoryInfo memInfo = new MemoryInfo();
    long estimatedEntitySize = 5 * 1024L; // 5KB per entity
    long maxQueueMemory = (long) (memInfo.maxMemory * 0.25); // Use max 25% of heap for queue
    int memoryBasedLimit = (int) (maxQueueMemory / (estimatedEntitySize * batchSize.get()));
    return Math.min(requestedSize, memoryBasedLimit);
  }

  /**
   * Cleans up stale jobs from previous runs.
   */
  private String getInstanceUrl() {
    try {
      SystemRepository systemRepository = Entity.getSystemRepository();
      if (systemRepository != null) {
        Settings settings = systemRepository.getOMBaseUrlConfigInternal();
        if (settings != null && settings.getConfigValue() != null) {
          OpenMetadataBaseUrlConfiguration urlConfig =
              (OpenMetadataBaseUrlConfiguration) settings.getConfigValue();
          if (urlConfig != null && urlConfig.getOpenMetadataUrl() != null) {
            return urlConfig.getOpenMetadataUrl();
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not get instance URL from SystemSettings", e);
    }
    return "http://localhost:8585";
  }

  private boolean detectSmartReindexing() {
    // Smart reindexing is detected when:
    // 1. Not all entities are being reindexed (subset)
    // 2. Recreate index is true
    // 3. Force flag is false (or null)
    if (jobData == null) return false;

    boolean isSubset =
        jobData.getEntities() != null
            && !jobData.getEntities().contains("all")
            && jobData.getEntities().size() < 20; // Assume < 20 entities is a subset
    boolean isRecreate = Boolean.TRUE.equals(jobData.getRecreateIndex());
    boolean isNotForced = !Boolean.TRUE.equals(jobData.getForce());

    return isSubset && isRecreate && isNotForced;
  }

  private void cleanUpStaleJobsFromRuns() {
    try {
      App app = getApp();
      if (app != null && app.getId() != null) {
        collectionDAO.appExtensionTimeSeriesDao().markStaleEntriesStopped(app.getId().toString());
        LOG.debug("Cleaned up stale jobs.");
      } else {
        LOG.debug("App not initialized, skipping stale job cleanup");
      }
    } catch (Exception ex) {
      LOG.error("Failed in marking stale entries as stopped.", ex);
    }
  }

  private SearchClusterMetrics initializeJob(JobExecutionContext jobExecutionContext) {
    cleanUpStaleJobsFromRuns();
    isSmartReindexing = detectSmartReindexing();
    jobLogger = new ReindexingJobLogger(jobData, isSmartReindexing);

    if (jobData.getSlackBotToken() != null
        && !jobData.getSlackBotToken().isEmpty()
        && jobData.getSlackChannel() != null
        && !jobData.getSlackChannel().isEmpty()) {
      String instanceUrl = getInstanceUrl();
      slackClient =
          new SlackWebApiClient(jobData.getSlackBotToken(), jobData.getSlackChannel(), instanceUrl);

      if (entitiesDisplayString == null) {
        boolean isAllEntities = jobData.getEntities().contains(ALL);
        entitiesDisplayString = isAllEntities ? "All" : String.join(", ", jobData.getEntities());
      }

      // Collect configuration details for Slack notification
      Map<String, String> slackConfigDetails = new HashMap<>();
      if (Boolean.TRUE.equals(jobData.getAutoTune())) {
        slackConfigDetails.put(AUTO_TUNE, ENABLED);
      }

      slackClient.setConfigurationDetails(slackConfigDetails);
      // Initial notification will be sent after full configuration is set
    }

    LOG.debug("Executing Reindexing Job with JobData: {}", jobData);
    updateJobStatus(EventPublisherJob.Status.RUNNING);
    LOG.debug("Initializing job statistics.");
    searchIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(searchIndexStats.get());

    SearchClusterMetrics clusterMetrics = null;
    if (Boolean.TRUE.equals(jobData.getAutoTune())) {
      LOG.info("Auto-tune enabled, analyzing cluster and adjusting parameters...");
      clusterMetrics =
          SearchClusterMetrics.fetchClusterMetrics(
              searchRepository,
              searchIndexStats.get().getJobStats().getTotalRecords(),
              searchRepository.getMaxDBConnections());

      // Log cluster configuration detected
      clusterMetrics.logRecommendations();

      jobData.setBatchSize(clusterMetrics.getRecommendedBatchSize());
      jobData.setMaxConcurrentRequests(clusterMetrics.getRecommendedConcurrentRequests());
      jobData.setPayLoadSize(clusterMetrics.getMaxPayloadSizeBytes());
      jobData.setConsumerThreads(clusterMetrics.getRecommendedConsumerThreads());
      jobData.setQueueSize(clusterMetrics.getRecommendedQueueSize());

      jobLogger.addInitDetail(AUTO_TUNE, ENABLED);
      jobLogger.addInitDetail(BATCH_SIZE, jobData.getBatchSize());
      jobLogger.addInitDetail(CONCURRENT_REQUESTS, jobData.getMaxConcurrentRequests());
      jobLogger.addInitDetail(PAYLOAD_SIZE, (jobData.getPayLoadSize() / (1024 * 1024)) + " MB");
      jobLogger.addInitDetail(CONSUMER_THREADS, jobData.getConsumerThreads());
      jobLogger.addInitDetail("Queue size", jobData.getQueueSize());
    }

    batchSize.set(jobData.getBatchSize());
    originalBatchSize.set(jobData.getBatchSize());
    sendUpdates(jobExecutionContext, true);

    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();
    jobLogger.addInitDetail(SEARCH_TYPE, searchType);

    if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.searchIndexSink =
          new OpenSearchBulkSink(
              searchRepository,
              jobData.getBatchSize(),
              jobData.getMaxConcurrentRequests(),
              jobData.getPayLoadSize());
      LOG.debug("Initialized OpenSearchBulkSink with batch size: {}", jobData.getBatchSize());
    } else {
      this.searchIndexSink =
          new ElasticSearchBulkSink(
              searchRepository,
              jobData.getBatchSize(),
              jobData.getMaxConcurrentRequests(),
              jobData.getPayLoadSize());
      LOG.debug("Initialized ElasticSearchBulkSink with batch size: {}", jobData.getBatchSize());
    }

    return clusterMetrics;
  }

  public void updateRecordToDbAndNotify(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);

    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));
    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }
    if (jobData.getStats() != null) {
      appRecord.setSuccessContext(
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats()));
    }

    if (WebSocketManager.getInstance() != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      WebSocketManager.getInstance()
          .broadCastMessageToAll(SEARCH_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
      LOG.debug(
          "Broad-casted job updates via WebSocket. Channel: {}, Status: {}, HasFailure: {}",
          SEARCH_INDEX_JOB_BROADCAST_CHANNEL,
          appRecord.getStatus(),
          jobData.getFailure() != null);
    }
  }

  private void reIndexFromStartToEnd(SearchClusterMetrics clusterMetrics)
      throws InterruptedException {
    long totalEntities = searchIndexStats.get().getJobStats().getTotalRecords();

    ThreadConfiguration threadConfig = calculateThreadConfiguration(totalEntities, clusterMetrics);
    int effectiveQueueSize = initializeQueueAndExecutors(threadConfig);
    updateSlackNotification(threadConfig, effectiveQueueSize, totalEntities, clusterMetrics);
    executeReindexing(threadConfig.numConsumers);
  }

  private ThreadConfiguration calculateThreadConfiguration(
      long totalEntities, SearchClusterMetrics clusterMetrics) {
    int numConsumers =
        jobData.getConsumerThreads() != null
            ? Math.min(jobData.getConsumerThreads(), MAX_CONSUMER_THREADS)
            : 2;
    int numProducers = Math.clamp((int) (totalEntities / 10000), 2, MAX_PRODUCER_THREADS);

    if (clusterMetrics != null) {
      numConsumers = Math.min(clusterMetrics.getRecommendedConsumerThreads(), MAX_CONSUMER_THREADS);
      numProducers = Math.min(clusterMetrics.getRecommendedProducerThreads(), MAX_PRODUCER_THREADS);
      jobLogger.addInitDetail("Auto-tuned consumer threads", numConsumers);
      jobLogger.addInitDetail("Auto-tuned producer threads", numProducers);
    }

    return adjustThreadsForLimit(numProducers, numConsumers);
  }

  private ThreadConfiguration adjustThreadsForLimit(int numProducers, int numConsumers) {
    int totalThreads = numProducers + numConsumers + jobData.getEntities().size();
    if (totalThreads > MAX_TOTAL_THREADS) {
      jobLogger.logWarning(
          "Total thread count {} exceeds limit {}, reducing...", totalThreads, MAX_TOTAL_THREADS);
      double ratio = (double) MAX_TOTAL_THREADS / totalThreads;
      numProducers = Math.max(1, (int) (numProducers * ratio));
      numConsumers = Math.max(1, (int) (numConsumers * ratio));
      jobLogger.addInitDetail(
          "Adjusted threads",
          String.format("%d producers, %d consumers", numProducers, numConsumers));
    }

    jobLogger.addInitDetail(PRODUCER_THREADS, numProducers);
    jobLogger.addInitDetail(CONSUMER_THREADS, numConsumers);

    return new ThreadConfiguration(numProducers, numConsumers);
  }

  private int initializeQueueAndExecutors(ThreadConfiguration threadConfig) {
    int queueSize = jobData.getQueueSize() != null ? jobData.getQueueSize() : DEFAULT_QUEUE_SIZE;
    int effectiveQueueSize = calculateMemoryAwareQueueSize(queueSize);

    LOG.info(
        "Queue sizing - Requested: {}, Effective (memory-aware): {}",
        queueSize,
        effectiveQueueSize);

    jobLogger.addInitDetail("Queue size (requested)", queueSize);
    jobLogger.addInitDetail(QUEUE_SIZE_EFFECTIVE, effectiveQueueSize);
    jobLogger.addInitDetail(TOTAL_ENTITIES, searchIndexStats.get().getJobStats().getTotalRecords());
    jobLogger.logInitialization();

    taskQueue = new LinkedBlockingQueue<>(effectiveQueueSize);
    producersDone.set(false);
    jobExecutor =
        Executors.newFixedThreadPool(
            jobData.getEntities().size(), Thread.ofPlatform().name("job-", 0).factory());

    int finalNumConsumers = threadConfig.numConsumers;
    if (finalNumConsumers > MAX_CONSUMER_THREADS) {
      LOG.error(
          "Consumer threads {} exceeds maximum {}, forcing to max",
          finalNumConsumers,
          MAX_CONSUMER_THREADS);
      finalNumConsumers = MAX_CONSUMER_THREADS;
    }

    consumerExecutor =
        Executors.newFixedThreadPool(
            finalNumConsumers, Thread.ofPlatform().name("consumer-", 0).factory());
    producerExecutor =
        Executors.newFixedThreadPool(
            threadConfig.numProducers, Thread.ofPlatform().name("producer-", 0).factory());

    return effectiveQueueSize;
  }

  private void updateSlackNotification(
      ThreadConfiguration threadConfig,
      int effectiveQueueSize,
      long totalEntities,
      SearchClusterMetrics clusterMetrics) {
    if (slackClient != null) {
      Map<String, String> finalConfigDetails =
          buildConfigurationDetails(
              threadConfig, effectiveQueueSize, totalEntities, clusterMetrics);
      slackClient.setConfigurationDetails(finalConfigDetails);
      slackClient.sendStartNotification(
          entitiesDisplayString, isSmartReindexing, jobData.getEntities().size());
    }
  }

  private Map<String, String> buildConfigurationDetails(
      ThreadConfiguration threadConfig,
      int effectiveQueueSize,
      long totalEntities,
      SearchClusterMetrics clusterMetrics) {
    Map<String, String> finalConfigDetails = new HashMap<>();
    finalConfigDetails.put(
        AUTO_TUNE, Boolean.TRUE.equals(jobData.getAutoTune()) ? ENABLED : DISABLED);
    finalConfigDetails.put(PRODUCER_THREADS, String.valueOf(threadConfig.numProducers));
    finalConfigDetails.put(CONSUMER_THREADS, String.valueOf(threadConfig.numConsumers));
    finalConfigDetails.put(TOTAL_ENTITIES, String.valueOf(totalEntities));
    finalConfigDetails.put(BATCH_SIZE, String.valueOf(batchSize.get()));
    finalConfigDetails.put(QUEUE_SIZE_EFFECTIVE, String.valueOf(effectiveQueueSize));
    finalConfigDetails.put(SEARCH_TYPE, searchRepository.getSearchType().toString().toLowerCase());
    finalConfigDetails.put(
        RECREATING_INDICES, Boolean.TRUE.equals(jobData.getRecreateIndex()) ? "Yes" : "No");

    if (clusterMetrics != null) {
      finalConfigDetails.put(PAYLOAD_SIZE, (jobData.getPayLoadSize() / (1024 * 1024)) + " MB");
      finalConfigDetails.put(
          CONCURRENT_REQUESTS, String.valueOf(jobData.getMaxConcurrentRequests()));
    }

    return finalConfigDetails;
  }

  private void executeReindexing(int numConsumers) throws InterruptedException {
    CountDownLatch consumerLatch = startConsumerThreads(numConsumers);

    try {
      processEntityReindex();
      signalConsumersToStop(numConsumers);
      waitForConsumersToComplete(consumerLatch);
    } catch (InterruptedException e) {
      handleInterruption(e);
    } catch (Exception e) {
      try {
        handleReindexingError(e);
      } catch (Exception ex) {
        LOG.error("Error handling reindexing error", ex);
        throw new ReindexingException("Error during reindexing process", ex);
      }
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
    jobLogger.logConsumerLifecycle(consumerId, true);
    try {
      while (!stopped && (!producersDone.get() || !taskQueue.isEmpty())) {
        try {
          IndexingTask<?> task = taskQueue.poll(100, TimeUnit.MILLISECONDS);
          if (task != null && !POISON_PILL.equals(task.entityType())) {
            processTask(task, jobExecutionContext);
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }
      }
    } finally {
      jobLogger.logConsumerLifecycle(consumerId, false);
      consumerLatch.countDown();
    }
  }

  private void signalConsumersToStop(int numConsumers) {
    producersDone.set(true);
    for (int i = 0; i < numConsumers; i++) {
      // Best effort to add poison pills - consumers will exit anyway when producersDone is true
      boolean offered = taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      if (!offered) {
        LOG.debug("Could not add poison pill to queue - queue may be full");
      }
    }
  }

  private void waitForConsumersToComplete(CountDownLatch consumerLatch)
      throws InterruptedException {
    boolean finished = consumerLatch.await(5, TimeUnit.MINUTES);
    if (!finished) {
      LOG.warn("Consumers did not finish within timeout");
    }
  }

  private void handleInterruption(InterruptedException e) throws InterruptedException {
    LOG.info("Reindexing interrupted - stopping immediately");
    stopped = true;
    Thread.currentThread().interrupt();
    throw e;
  }

  private void handleReindexingError(Exception e) throws Exception {
    if (!stopped) {
      if (jobLogger != null) {
        jobLogger.logError("reindexing process", e);
      } else {
        LOG.error("Error during reindexing process.", e);
      }
    }
    throw e;
  }

  private void cleanupExecutors() {
    if (!stopped) {
      shutdownExecutor(consumerExecutor, "ConsumerExecutor", 30, TimeUnit.SECONDS);
      shutdownExecutor(jobExecutor, "JobExecutor", 20, TimeUnit.SECONDS);
      shutdownExecutor(producerExecutor, "ProducerExecutor", 1, TimeUnit.MINUTES);
    }
  }

  private static class ThreadConfiguration {
    final int numProducers;
    final int numConsumers;

    ThreadConfiguration(int numProducers, int numConsumers) {
      this.numProducers = numProducers;
      this.numConsumers = numConsumers;
    }
  }

  private void processEntityReindex() throws InterruptedException {
    int latchCount = getTotalLatchCount(jobData.getEntities());
    CountDownLatch producerLatch = new CountDownLatch(latchCount);
    submitProducerTask(producerLatch);

    while (!producerLatch.await(1, TimeUnit.SECONDS)) {
      if (stopped || Thread.currentThread().isInterrupted()) {
        LOG.info("Stop signal or interrupt received during reindexing - exiting immediately");
        if (producerExecutor != null) {
          producerExecutor.shutdownNow();
        }
        if (jobExecutor != null) {
          jobExecutor.shutdownNow();
        }
        return;
      }
    }
  }

  private void submitProducerTask(CountDownLatch producerLatch) {
    for (String entityType : jobData.getEntities()) {
      jobExecutor.submit(() -> processEntityType(entityType, producerLatch));
    }
  }

  private void processEntityType(String entityType, CountDownLatch producerLatch) {
    try {
      if (jobLogger != null) {
        jobLogger.markEntityStarted(entityType);
      }

      int totalEntityRecords = getTotalEntityRecords(entityType);
      int loadPerThread = calculateNumberOfThreads(totalEntityRecords);

      if (totalEntityRecords > 0) {
        submitBatchTasks(entityType, loadPerThread, producerLatch);
      }

      if (jobLogger != null) {
        jobLogger.markEntityCompleted(entityType);
      }
    } catch (Exception e) {
      LOG.error("Error processing entity type {}", entityType, e);
    }
  }

  private void submitBatchTasks(
      String entityType, int loadPerThread, CountDownLatch producerLatch) {
    for (int i = 0; i < loadPerThread; i++) {
      LOG.debug("Submitting virtual thread producer task for batch {}/{}", i + 1, loadPerThread);
      int currentOffset = i * batchSize.get();
      producerExecutor.submit(() -> processBatch(entityType, currentOffset, producerLatch));
    }
  }

  private void processBatch(String entityType, int currentOffset, CountDownLatch producerLatch) {
    try {
      if (shouldSkipBatch()) {
        return;
      }

      LOG.debug(
          "Virtual thread processing offset: {}, remaining batches: {}",
          currentOffset,
          producerLatch.getCount());
      Source<?> source = createSource(entityType);
      processReadTask(entityType, source, currentOffset);
    } catch (Exception e) {
      if (!stopped) {
        LOG.error("Error processing entity type {} with virtual thread", entityType, e);
      }
    } finally {
      LOG.debug("Virtual thread completed batch, remaining: {}", producerLatch.getCount() - 1);
      producerLatch.countDown();
    }
  }

  private boolean shouldSkipBatch() {
    if (stopped) {
      LOG.debug("Skipping batch - stop signal received");
      return true;
    }

    if (isBackpressureActive()) {
      LOG.debug("Backpressure active, will retry later");
      return true;
    }

    return false;
  }

  /**
   * Shuts down an executor service gracefully.
   */
  private void shutdownExecutor(
      ExecutorService executor, String name, long timeout, TimeUnit unit) {
    if (executor != null && !executor.isShutdown()) {
      executor.shutdown();
      try {
        if (!executor.awaitTermination(timeout, unit)) {
          executor.shutdownNow();
          LOG.warn("{} did not terminate within the specified timeout.", name);
        } else {
          LOG.info("{} terminated successfully.", name);
        }
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for {} to terminate.", name, e);
        executor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }
  }

  private void updateJobStatus(EventPublisherJob.Status newStatus) {
    EventPublisherJob.Status currentStatus = jobData.getStatus();

    // If stopped flag is set, only allow transition to STOP_IN_PROGRESS or STOPPED
    if (stopped
        && newStatus != EventPublisherJob.Status.STOP_IN_PROGRESS
        && newStatus != EventPublisherJob.Status.STOPPED) {
      LOG.info(
          "Skipping status update to {} because stop has been initiated (current: {})",
          newStatus,
          currentStatus);
      return;
    }

    if (currentStatus == EventPublisherJob.Status.STOP_IN_PROGRESS
        || currentStatus == EventPublisherJob.Status.STOPPED) {
      LOG.debug(
          "Skipping status update to {} because current status is {}", newStatus, currentStatus);
      return;
    }

    LOG.info("Updating job status from {} to {}", currentStatus, newStatus);
    jobData.setStatus(newStatus);
  }

  private void handleBackpressure(String errorMessage) {
    if (errorMessage != null && errorMessage.contains("rejected_execution_exception")) {
      consecutiveErrors.incrementAndGet();
      consecutiveSuccesses.set(0); // Reset success counter
      LOG.warn(
          "Detected backpressure from OpenSearch (consecutive errors: {})",
          consecutiveErrors.get());

      if (consecutiveErrors.get() >= MAX_CONSECUTIVE_ERRORS) {
        int currentBatchSize = batchSize.get();
        int newBatchSize =
            Math.clamp(currentBatchSize / 2, 50, Integer.MAX_VALUE); // Reduce by half, minimum 50

        if (newBatchSize < currentBatchSize) {
          batchSize.set(newBatchSize);
          LOG.info(
              "Reduced batch size from {} to {} due to backpressure",
              currentBatchSize,
              newBatchSize);
          jobData.setBatchSize(newBatchSize);
          consecutiveErrors.set(0); // Reset counter

          // Update the bulk sink's batch size
          if (searchIndexSink instanceof OpenSearchBulkSink opensearchBulkSink) {
            opensearchBulkSink.updateBatchSize(newBatchSize);
          } else if (searchIndexSink instanceof ElasticSearchBulkSink elasticSearchBulkSink) {
            elasticSearchBulkSink.updateBatchSize(newBatchSize);
          }
        }
      }

      // Record backpressure time
      lastBackpressureTime = System.currentTimeMillis();
    }
  }

  /**
   * Check if backpressure is currently active
   */
  private boolean isBackpressureActive() {
    if (lastBackpressureTime == 0) {
      return false;
    }

    long timeSinceBackpressure = System.currentTimeMillis() - lastBackpressureTime;

    // Consider backpressure active if within the wait window
    return timeSinceBackpressure < BACKPRESSURE_WAIT_MS;
  }

  /**
   * Perform adaptive tuning based on runtime metrics
   */
  private void performAdaptiveTuning() {
    if (!shouldPerformTuning()) {
      return;
    }

    lastTuneTime = System.currentTimeMillis();
    updateThroughputMetrics();

    TuningContext context = createTuningContext();
    adjustBatchSize(context);
    logTuningMetrics(context);
  }

  private boolean shouldPerformTuning() {
    long currentTime = System.currentTimeMillis();
    return Boolean.TRUE.equals(jobData.getAutoTune())
        && currentTime - lastTuneTime >= TUNE_INTERVAL_MS;
  }

  private void updateThroughputMetrics() {
    long processedEntities = totalEntitiesProcessed.get();
    long processingTime = totalProcessingTime.get();
    if (processingTime > 0) {
      currentThroughput = (processedEntities * 1000.0) / processingTime;
    }
  }

  private TuningContext createTuningContext() {
    return new TuningContext(
        new MemoryInfo(), batchSize.get(), consecutiveErrors.get(), consecutiveSuccesses.get());
  }

  private void adjustBatchSize(TuningContext context) {
    if (shouldIncreaseBatchSize(context)) {
      increaseBatchSizeForTuning(context);
    } else if (shouldDecreaseBatchSize(context)) {
      decreaseBatchSizeForTuning(context);
    }
  }

  private boolean shouldIncreaseBatchSize(TuningContext context) {
    return context.errorCount == 0
        && context.successCount > BATCH_SIZE_INCREASE_THRESHOLD
        && context.memInfo.usageRatio < 0.7;
  }

  private boolean shouldDecreaseBatchSize(TuningContext context) {
    return context.memInfo.usageRatio > 0.8;
  }

  private void increaseBatchSizeForTuning(TuningContext context) {
    int newBatchSize = Math.min(context.currentBatchSize + 50, 1000);
    if (newBatchSize != context.currentBatchSize) {
      batchSize.set(newBatchSize);
      LOG.info(
          "Auto-tune: Increased batch size from {} to {} (throughput: {} entities/sec)",
          context.currentBatchSize,
          newBatchSize,
          String.format("%.1f", currentThroughput));
      updateSinkBatchSize(newBatchSize);
    }
  }

  private void decreaseBatchSizeForTuning(TuningContext context) {
    int newBatchSize = Math.max(context.currentBatchSize - 100, 50);
    if (newBatchSize != context.currentBatchSize) {
      batchSize.set(newBatchSize);
      LOG.warn(
          "Auto-tune: Reduced batch size from {} to {} due to memory pressure ({}% used)",
          context.currentBatchSize, newBatchSize, (int) (context.memInfo.usageRatio * 100));
    }
  }

  private void logTuningMetrics(TuningContext context) {
    if (currentThroughput <= 0) {
      return;
    }

    Stats currentStats = searchIndexStats.get();
    if (currentStats == null || currentStats.getJobStats() == null) {
      return;
    }

    StepStats jobStats = currentStats.getJobStats();
    long total = getValueOrZero(jobStats.getTotalRecords());
    long processed = getValueOrZero(jobStats.getSuccessRecords());

    if (total > 0 && processed > 0) {
      long remaining = total - processed;
      long etaSeconds = (long) (remaining / currentThroughput);
      LOG.info(
          "Auto-tune metrics: Throughput: {} entities/sec, ETA: {} minutes, Memory: {}%",
          String.format("%.1f", currentThroughput),
          etaSeconds / 60,
          (int) (context.memInfo.usageRatio * 100));
    }
  }

  private static class TuningContext {
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

  private void handleJobFailure(Exception ex) {
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(
                String.format("Reindexing Job Has Encountered an Exception: %s", ex.getMessage()));
    LOG.error("Reindexing Job Failed", ex);

    // Send Slack error notification
    if (slackClient != null) {
      slackClient.sendErrorNotification(ex.getMessage());
    }

    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(indexingError);
    }
  }

  private void handleJobCompletion() {
    if (!hasCompleteJobData()) {
      logBasicCompletion();
      return;
    }

    jobLogger.logCompletion(jobData.getStats());
    sendSlackCompletionNotification();
  }

  private boolean hasCompleteJobData() {
    return jobLogger != null && jobData != null && jobData.getStats() != null;
  }

  private void logBasicCompletion() {
    if (jobData != null) {
      LOG.info("Search Index Job Completed for Entities: {}", jobData.getEntities());
    } else {
      LOG.info("Search Index Job Completed");
    }
  }

  private void sendSlackCompletionNotification() {
    if (slackClient == null) {
      return;
    }

    JobCompletionMetrics metrics = calculateCompletionMetrics();
    slackClient.sendCompletionNotification(
        jobData.getStats(), metrics.elapsedSeconds, metrics.hasErrors);
  }

  private JobCompletionMetrics calculateCompletionMetrics() {
    long elapsedSeconds = calculateElapsedSeconds();
    boolean hasErrors = checkForErrors();
    return new JobCompletionMetrics(elapsedSeconds, hasErrors);
  }

  private long calculateElapsedSeconds() {
    if (jobData.getTimestamp() == null) {
      return 0;
    }
    return (System.currentTimeMillis() - jobData.getTimestamp()) / 1000;
  }

  private boolean checkForErrors() {
    StepStats jobStats = jobData.getStats().getJobStats();
    if (jobStats == null) {
      return false;
    }

    long failed = getValueOrZero(jobStats.getFailedRecords());
    long processed = getValueOrZero(jobStats.getSuccessRecords());
    long total = getValueOrZero(jobStats.getTotalRecords());

    return failed > 0 || (total > 0 && processed < total);
  }

  private long getValueOrZero(Integer value) {
    return value != null ? value : 0;
  }

  private static class JobCompletionMetrics {
    final long elapsedSeconds;
    final boolean hasErrors;

    JobCompletionMetrics(long elapsedSeconds, boolean hasErrors) {
      this.elapsedSeconds = elapsedSeconds;
      this.hasErrors = hasErrors;
    }
  }

  public Stats initializeTotalRecords(Set<String> entities) {
    if (jobData == null) {
      jobData = new EventPublisherJob();
    }
    Stats jobDataStats = jobData.getStats();
    if (jobDataStats == null) {
      jobDataStats = new Stats();
      jobData.setStats(jobDataStats);
    }
    if (jobDataStats.getEntityStats() == null) {
      jobDataStats.setEntityStats(new EntityStats());
      LOG.debug("Initialized entityStats map.");
    }

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getEntityTotal(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);

      jobDataStats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
      LOG.debug("Set Total Records for entityType '{}': {}", entityType, entityTotal);
    }

    StepStats jobStats = jobDataStats.getJobStats();
    if (jobStats == null) {
      jobStats = new StepStats();
      jobDataStats.setJobStats(jobStats);
      LOG.debug("Initialized jobStats.");
    }
    jobStats.setTotalRecords(total);
    LOG.debug("Set job-level Total Records: {}", jobStats.getTotalRecords());

    jobData.setStats(jobDataStats);
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
        return repository.getDao().listTotalCount();
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
      LOG.debug("Error while getting total entities to index for '{}'", entityType, e);
      return 0;
    }
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext) {
    sendUpdates(jobExecutionContext, false);
  }

  private void logThroughputIfNeeded() {
    if (jobLogger != null) {
      Stats stats = searchIndexStats.get();
      if (stats != null) {
        jobLogger.logProgress(stats);

        // Also send Slack update if client is initialized
        if (slackClient != null) {
          slackClient.sendProgressUpdate(stats);
        }
      }
    }
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext, boolean forceUpdate) {
    try {
      long currentTime = System.currentTimeMillis();
      // Throttle updates unless forced (for errors, completion, etc.)
      if (!forceUpdate && (currentTime - lastWebSocketUpdate < WEBSOCKET_UPDATE_INTERVAL_MS)) {
        LOG.debug(
            "Throttling WebSocket update - {} ms since last update",
            currentTime - lastWebSocketUpdate);
        return;
      }

      lastWebSocketUpdate = currentTime;
      LOG.debug(
          "Sending WebSocket update - forced: {}, status: {}", forceUpdate, jobData.getStatus());

      // Check and log throughput periodically
      logThroughputIfNeeded();

      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, SEARCH_INDEX_JOB_BROADCAST_CHANNEL);
      updateRecordToDbAndNotify(jobExecutionContext);
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }

  private void reCreateIndexes(Set<String> entities) {
    for (String entityType : entities) {
      if (Boolean.FALSE.equals(jobData.getRecreateIndex())) {
        LOG.debug("RecreateIndex is false. Skipping index recreation for '{}'.", entityType);
        return;
      }
      IndexMapping indexType = searchRepository.getIndexMapping(entityType);
      if (indexType == null) {
        LOG.warn(
            "No index mapping found for entityType '{}'. Skipping index recreation.", entityType);
        continue;
      }
      searchRepository.deleteIndex(indexType);
      searchRepository.createIndex(indexType);
      LOG.debug("Recreated index for entityType '{}'.", entityType);
    }
  }

  private Source<?> createSource(String entityType) {
    String correctedEntityType = entityType;
    if (QUERY_COST_RESULT_INCORRECT.equals(entityType)) {
      LOG.warn(QUERY_COST_RESULT_WARNING);
      correctedEntityType = QUERY_COST_RECORD;
    }

    List<String> searchIndexFields = getSearchIndexFields(correctedEntityType);

    if (!TIME_SERIES_ENTITIES.contains(correctedEntityType)) {
      return new PaginatedEntitiesSource(correctedEntityType, batchSize.get(), searchIndexFields);
    } else {
      return new PaginatedEntityTimeSeriesSource(
          correctedEntityType, batchSize.get(), searchIndexFields);
    }
  }

  private List<String> getSearchIndexFields(String entityType) {
    if (TIME_SERIES_ENTITIES.contains(entityType)) {
      return List.of(); // Empty list for time series
    }
    return List.of("*");
  }

  @Override
  public void stop() {
    LOG.info("Reindexing job is being stopped.");
    stopped = true;

    updateInitialStopStatus();
    updateJobExecutionContextForStop();
    persistFinalStoppedStatus();
    shutdownExecutors();
    cleanupResources();

    LOG.info("Reindexing job stopped successfully.");
  }

  private void updateInitialStopStatus() {
    if (jobData == null) {
      LOG.warn("jobData is null during stop - cannot capture current status");
      return;
    }

    EventPublisherJob.Status currentStatus = jobData.getStatus();
    LOG.info("Current job status before stop: {}", currentStatus);

    if (currentStatus != EventPublisherJob.Status.STOP_IN_PROGRESS
        && currentStatus != EventPublisherJob.Status.STOPPED) {
      jobData.setStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
      LOG.info("Updated job status to STOP_IN_PROGRESS");
    }
  }

  private void updateJobExecutionContextForStop() {
    if (jobExecutionContext == null) {
      return;
    }

    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(AppRunRecord.Status.STOP_IN_PROGRESS);
    appRecord.setEndTime(System.currentTimeMillis());
    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(APP_SCHEDULE_RUN, JsonUtils.pojoToJson(appRecord));
    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    sendUpdates(jobExecutionContext, true);
  }

  private void persistFinalStoppedStatus() {
    try {
      setFinalStoppedStatusInJobData();
      persistStoppedStatusToDatabase();
    } catch (Exception e) {
      LOG.error("Error updating final STOPPED status", e);
    }
  }

  private void setFinalStoppedStatusInJobData() {
    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
      LOG.info("Final status set to STOPPED");
    } else {
      LOG.warn("jobData is null, cannot set final STOPPED status");
    }
  }

  private void persistStoppedStatusToDatabase() {
    if (jobExecutionContext == null) {
      return;
    }

    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(AppRunRecord.Status.STOPPED);
    appRecord.setEndTime(System.currentTimeMillis());
    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(APP_SCHEDULE_RUN, JsonUtils.pojoToJson(appRecord));

    try {
      pushAppStatusUpdates(jobExecutionContext, appRecord, true);
      LOG.info("Successfully persisted STOPPED status to database");
    } catch (Exception dbEx) {
      LOG.error("Failed to persist STOPPED status to database", dbEx);
    }

    sendWebSocketUpdateSafely(jobExecutionContext);
  }

  private void shutdownExecutors() {
    shutdownSingleExecutor(producerExecutor, "producer");
    shutdownSingleExecutor(consumerExecutor, "consumer");
    shutdownSingleExecutor(jobExecutor, "job");
  }

  private void shutdownSingleExecutor(ExecutorService executor, String executorName) {
    if (executor != null && !executor.isShutdown()) {
      LOG.info("Force shutting down {} executor", executorName);
      List<Runnable> pendingTasks = executor.shutdownNow();
      LOG.info("Cancelled {} pending {} tasks", pendingTasks.size(), executorName);
    }
  }

  private void cleanupResources() {
    clearTaskQueue();
    closeSearchIndexSink();
  }

  private void clearTaskQueue() {
    if (taskQueue == null) {
      return;
    }

    taskQueue.clear();
    // Add poison pills to wake up any blocked consumers
    for (int i = 0; i < 10; i++) {
      boolean offered = taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      if (!offered) {
        // Queue is cleared, so this shouldn't happen but log it just in case
        LOG.debug("Could not add poison pill to cleared queue");
        break;
      }
    }
  }

  private void closeSearchIndexSink() {
    if (searchIndexSink == null) {
      return;
    }

    try {
      LOG.info("Closing search index sink");
      searchIndexSink.close();
    } catch (Exception e) {
      LOG.error("Error closing search index sink", e);
    }
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          Response.Status.BAD_REQUEST, "Invalid App Configuration: " + e.getMessage());
    }
  }

  private void processTask(IndexingTask<?> task, JobExecutionContext jobExecutionContext) {
    String entityType = task.entityType();
    ResultList<?> entities = task.entities();
    Map<String, Object> contextData = createContextData(entityType);

    long startTime = System.currentTimeMillis();

    try {
      writeEntitiesToSink(entityType, entities, contextData);
      StepStats currentEntityStats = createEntityStats(entities);
      handleTaskSuccess(entityType, entities, currentEntityStats, jobExecutionContext);

      long processingTime = System.currentTimeMillis() - startTime;
      totalProcessingTime.addAndGet(processingTime);
      totalEntitiesProcessed.addAndGet(entities.getData().size());

      performAdaptiveTuning();
    } catch (SearchIndexException e) {
      handleSearchIndexException(entityType, entities, e, jobExecutionContext);
    } catch (Exception e) {
      handleGenericException(entityType, entities, e, jobExecutionContext);
    }
  }

  private Map<String, Object> createContextData(String entityType) {
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, entityType);
    contextData.put(RECREATE_INDEX, jobData.getRecreateIndex());
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
    StepStats stats = new StepStats();
    stats.setSuccessRecords(listOrEmpty(entities.getData()).size());
    stats.setFailedRecords(listOrEmpty(entities.getErrors()).size());
    return stats;
  }

  private void handleTaskSuccess(
      String entityType,
      ResultList<?> entities,
      StepStats currentEntityStats,
      JobExecutionContext jobExecutionContext) {
    if (entities.getErrors() != null && !entities.getErrors().isEmpty()) {
      handleReaderErrors(entities);
    } else {
      handleSuccessfulBatch();
    }

    updateStats(entityType, currentEntityStats);
    LOG.debug(
        "Broadcasting metrics update for entity type: {}, success: {}, failed: {}",
        entityType,
        currentEntityStats.getSuccessRecords(),
        currentEntityStats.getFailedRecords());
    sendUpdates(jobExecutionContext);
  }

  private void handleReaderErrors(ResultList<?> entities) {
    jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
    jobData.setFailure(
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.READER)
            .withSubmittedCount(batchSize.get())
            .withSuccessCount(entities.getData().size())
            .withFailedCount(entities.getErrors().size())
            .withMessage(
                "Issues in Reading A Batch For Entities. Check Errors Corresponding to Entities.")
            .withFailedEntities(entities.getErrors()));
  }

  private void handleSuccessfulBatch() {
    if (consecutiveErrors.get() > 0) {
      consecutiveErrors.set(0);
      LOG.debug("Reset consecutive error counter after successful batch");
    }

    consecutiveSuccesses.incrementAndGet();
    if (shouldIncreaseBatchSize()) {
      increaseBatchSize();
    }
  }

  private boolean shouldIncreaseBatchSize() {
    return consecutiveSuccesses.get() >= BATCH_SIZE_INCREASE_THRESHOLD
        && originalBatchSize.get() > 0;
  }

  private void increaseBatchSize() {
    int currentBatchSize = batchSize.get();
    int targetBatchSize = Math.clamp(currentBatchSize * 3L / 2, 1, originalBatchSize.get());

    if (targetBatchSize > currentBatchSize) {
      batchSize.set(targetBatchSize);
      LOG.info(
          "Increased batch size from {} to {} after {} successful batches",
          currentBatchSize,
          targetBatchSize,
          consecutiveSuccesses.get());
      jobData.setBatchSize(targetBatchSize);
      consecutiveSuccesses.set(0);
      updateSinkBatchSize(targetBatchSize);
    }
  }

  private void updateSinkBatchSize(int newBatchSize) {
    if (searchIndexSink instanceof OpenSearchBulkSink opensearchBulkSink) {
      opensearchBulkSink.updateBatchSize(newBatchSize);
    } else if (searchIndexSink instanceof ElasticSearchBulkSink elasticSearchBulkSink) {
      elasticSearchBulkSink.updateBatchSize(newBatchSize);
    }
  }

  private void handleSearchIndexException(
      String entityType,
      ResultList<?> entities,
      SearchIndexException e,
      JobExecutionContext jobExecutionContext) {
    if (!stopped) {
      updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      IndexingError indexingError = e.getIndexingError();

      if (indexingError != null) {
        jobData.setFailure(indexingError);
        handleBackpressure(indexingError.getMessage());
      } else {
        jobData.setFailure(createSinkError(e.getMessage()));
        handleBackpressure(e.getMessage());
      }

      StepStats failedStats = createFailedStats(indexingError, entities.getData().size());
      updateStats(entityType, failedStats);
      try {
        sendUpdates(jobExecutionContext, true);
      } catch (Exception ex) {
        LOG.error(ERROR_SENDING_UPDATES, ex);
      }
    }
    LOG.error(String.format(SINK_ERROR_MESSAGE, entityType), e);
  }

  private void handleGenericException(
      String entityType,
      ResultList<?> entities,
      Exception e,
      JobExecutionContext jobExecutionContext) {
    if (!stopped) {
      updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      jobData.setFailure(createSinkError(ExceptionUtils.getStackTrace(e)));

      int failedCount =
          entities != null && entities.getData() != null ? entities.getData().size() : 0;
      StepStats failedStats = new StepStats().withSuccessRecords(0).withFailedRecords(failedCount);

      updateStats(entityType, failedStats);
      try {
        sendUpdates(jobExecutionContext, true);
      } catch (Exception ex) {
        LOG.error(ERROR_SENDING_UPDATES, ex);
      }
    }
    LOG.error(String.format(SINK_ERROR_MESSAGE, entityType), e);
  }

  private IndexingError createSinkError(String message) {
    return new IndexingError().withErrorSource(IndexingError.ErrorSource.SINK).withMessage(message);
  }

  private StepStats createFailedStats(IndexingError indexingError, int dataSize) {
    StepStats stats = new StepStats();
    stats.setSuccessRecords(indexingError != null ? indexingError.getSuccessCount() : 0);
    stats.setFailedRecords(indexingError != null ? indexingError.getFailedCount() : dataSize);
    return stats;
  }

  @NotNull
  private Set<String> getAll() {
    Set<String> entities = new HashSet<>(Entity.getEntityList());
    entities.addAll(TIME_SERIES_ENTITIES);
    return entities;
  }

  private int getTotalLatchCount(Set<String> entities) {
    if (searchIndexStats.get() == null) {
      LOG.warn("searchIndexStats not initialized, using entity count as latch count");
      return entities.size();
    }

    return entities.stream()
        .mapToInt(
            entityType -> {
              int totalRecords = getTotalEntityRecords(entityType);
              return calculateNumberOfThreads(totalRecords);
            })
        .sum();
  }

  private int getTotalEntityRecords(String entityType) {
    if (searchIndexStats.get() == null
        || searchIndexStats.get().getEntityStats() == null
        || searchIndexStats.get().getEntityStats().getAdditionalProperties() == null) {
      return 0;
    }

    StepStats statsObj =
        searchIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType);
    if (statsObj != null) {
      return statsObj.getTotalRecords() != null ? statsObj.getTotalRecords() : 0;
    }
    return 0;
  }

  synchronized void updateStats(String entityType, StepStats currentEntityStats) {
    Stats jobDataStats = searchIndexStats.get();
    if (jobDataStats == null) {
      return; // Safety check
    }

    updateEntityStats(jobDataStats, entityType, currentEntityStats);
    updateJobStats(jobDataStats);
    searchIndexStats.set(jobDataStats);
    jobData.setStats(jobDataStats);
  }

  private void updateEntityStats(Stats stats, String entityType, StepStats currentEntityStats) {
    StepStats entityStats = stats.getEntityStats().getAdditionalProperties().get(entityType);
    if (entityStats != null) {
      entityStats.withSuccessRecords(
          entityStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
      entityStats.withFailedRecords(
          entityStats.getFailedRecords() + currentEntityStats.getFailedRecords());
      LOG.debug(
          "Updated stats for {}: success={}, failed={}, total={}",
          entityType,
          entityStats.getSuccessRecords(),
          entityStats.getFailedRecords(),
          entityStats.getTotalRecords());
    }
  }

  private void updateJobStats(Stats stats) {
    StepStats jobStats = stats.getJobStats();

    int totalSuccess =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum();

    int totalFailed =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getFailedRecords)
            .sum();

    jobStats.withSuccessRecords(totalSuccess).withFailedRecords(totalFailed);
    LOG.debug(
        "Updated job stats: success={}, failed={}, total={}",
        jobStats.getSuccessRecords(),
        jobStats.getFailedRecords(),
        jobStats.getTotalRecords());
  }

  private void processReadTask(String entityType, Source<?> source, int offset) {
    try {
      if (shouldSkipProcessing()) {
        return;
      }

      Object resultList = readEntityBatch(source, offset, entityType);
      if (shouldSkipProcessing()) {
        return;
      }

      if (resultList != null) {
        processResultList(entityType, resultList, offset);
      }
    } catch (SearchIndexException e) {
      handleReadTaskException(entityType, e);
    }
  }

  private boolean shouldSkipProcessing() {
    if (stopped) {
      LOG.debug("Skipping processing - stop signal received");
      return true;
    }
    return false;
  }

  private Object readEntityBatch(Source<?> source, int offset, String entityType)
      throws SearchIndexException {
    Object resultList = source.readWithCursor(RestUtil.encodeCursor(String.valueOf(offset)));
    LOG.debug("Read Entities with entityType: {},  CurrentOffset: {}", entityType, offset);
    return resultList;
  }

  private void processResultList(String entityType, Object resultList, int offset) {
    ResultList<?> entities = extractEntities(entityType, resultList);
    if (!nullOrEmpty(entities.getData()) && !stopped) {
      queueIndexingTask(entityType, entities, offset);
    }
  }

  private void queueIndexingTask(String entityType, ResultList<?> entities, int offset) {
    IndexingTask<?> task = new IndexingTask<>(entityType, entities, offset);
    try {
      taskQueue.put(task);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while queueing task for entityType: {}", entityType);
    }
  }

  private void handleReadTaskException(String entityType, SearchIndexException e) {
    LOG.error("Error while reading source for entityType: {}", entityType, e);

    if (!stopped) {
      updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
    }

    if (jobData != null) {
      jobData.setFailure(e.getIndexingError());
    }

    updateFailureStats(entityType);
  }

  private void updateFailureStats(String entityType) {
    int remainingRecords = getRemainingRecordsToProcess(entityType);
    int failedCount = Math.min(remainingRecords, batchSize.get());
    updateStats(entityType, new StepStats().withSuccessRecords(0).withFailedRecords(failedCount));
  }

  private int calculateNumberOfThreads(int totalEntityRecords) {
    int mod = totalEntityRecords % batchSize.get();
    if (mod == 0) {
      return totalEntityRecords / batchSize.get();
    } else {
      return (totalEntityRecords / batchSize.get()) + 1;
    }
  }

  @SuppressWarnings("unchecked")
  private ResultList<?> extractEntities(String entityType, Object resultList) {
    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      return ((ResultList<? extends EntityInterface>) resultList);
    } else {
      return ((ResultList<? extends EntityTimeSeriesInterface>) resultList);
    }
  }

  private int getRemainingRecordsToProcess(String entityType) {
    StepStats entityStats =
        searchIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType);
    return entityStats.getTotalRecords()
        - entityStats.getFailedRecords()
        - entityStats.getSuccessRecords();
  }
}
