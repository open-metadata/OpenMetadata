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
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
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
  private static final String ALL = "all";
  private static final String POISON_PILL = "__POISON_PILL__";
  private static final int DEFAULT_QUEUE_SIZE = 20000;

  // Thread limits to prevent exhaustion in cloud environments
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

  private volatile int consecutiveErrors = 0;
  private volatile int consecutiveSuccesses = 0;
  private volatile long lastBackpressureTime = 0;
  private static final int MAX_CONSECUTIVE_ERRORS = 5;
  private static final int BATCH_SIZE_INCREASE_THRESHOLD = 50;
  private static final long BACKPRESSURE_WAIT_MS = 5000;
  private int originalBatchSize = 0;

  private BlockingQueue<IndexingTask<?>> taskQueue;
  private final AtomicBoolean producersDone = new AtomicBoolean(false);

  record IndexingTask<T>(String entityType, ResultList<T> entities, int offset) {}

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
    stopped = false;
    consecutiveErrors = 0;
    consecutiveSuccesses = 0;
    lastBackpressureTime = 0;
    originalBatchSize = 0;

    if (jobData == null) {
      String appConfigJson =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG);
      if (appConfigJson != null) {
        jobData = JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
      } else {
        if (getApp() != null && getApp().getAppConfiguration() != null) {
          jobData = JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
        } else {
          LOG.error("Unable to initialize jobData from JobDataMap or App configuration");
          throw new IllegalStateException("JobData is not initialized");
        }
      }
    }

    String jobName = jobExecutionContext.getJobDetail().getKey().getName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig = JsonUtils.convertValue(jobData, Map.class);
      getApp().setAppConfiguration(jsonAppConfig);
    }

    try {
      boolean containsAll = jobData.getEntities().contains(ALL);
      if (containsAll) {
        entitiesDisplayString = "All";
        jobData.setEntities(getAll());
      } else {
        entitiesDisplayString = String.join(", ", jobData.getEntities());
      }

      LOG.info(
          "Search Index Job Started for Entities: {}, RecreateIndex: {}",
          jobData.getEntities(),
          jobData.getRecreateIndex());

      SearchClusterMetrics clusterMetrics = initializeJob(jobExecutionContext);

      if (Boolean.TRUE.equals(jobData.getRecreateIndex())) {
        if (jobLogger != null) {
          jobLogger.addInitDetail("Recreating indices", "Yes");
        }
        reCreateIndexes(jobData.getEntities());
      }

      updateJobStatus(EventPublisherJob.Status.RUNNING);

      reIndexFromStartToEnd(clusterMetrics);

      if (searchIndexSink != null) {
        LOG.info("Forcing final flush of bulk processor");
        searchIndexSink.close();
      }

      if (stopped) {
        updateJobStatus(EventPublisherJob.Status.STOPPED);
      } else {
        boolean hasIncompleteProcessing = false;
        if (jobData != null
            && jobData.getStats() != null
            && jobData.getStats().getJobStats() != null) {
          long failed =
              jobData.getStats().getJobStats().getFailedRecords() != null
                  ? jobData.getStats().getJobStats().getFailedRecords()
                  : 0;
          long processed =
              jobData.getStats().getJobStats().getSuccessRecords() != null
                  ? jobData.getStats().getJobStats().getSuccessRecords()
                  : 0;
          long total =
              jobData.getStats().getJobStats().getTotalRecords() != null
                  ? jobData.getStats().getJobStats().getTotalRecords()
                  : 0;

          hasIncompleteProcessing = failed > 0 || (total > 0 && processed < total);
        }

        if (hasIncompleteProcessing) {
          updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
          LOG.warn("Reindexing completed with errors - some entities were not fully indexed");
        } else {
          updateJobStatus(EventPublisherJob.Status.COMPLETED);
        }
      }

      handleJobCompletion();
    } catch (Exception ex) {
      if (searchIndexSink != null) {
        try {
          searchIndexSink.close();
        } catch (Exception e) {
          LOG.error("Error closing search index sink during exception handling", e);
        }
      }

      if (stopped) {
        if (jobData != null) {
          LOG.info("Search Index Job Stopped for Entities: {}", jobData.getEntities());
          jobData.setStatus(EventPublisherJob.Status.STOPPED);
        }
      } else {
        handleJobFailure(ex);
      }
    } finally {
      sendUpdates(jobExecutionContext, true);

      if (stopped && jobExecutionContext != null) {
        LOG.info("Ensuring final STOPPED status in JobDataMap");
        AppRunRecord appRecord = getJobRecord(jobExecutionContext);
        appRecord.setStatus(AppRunRecord.Status.STOPPED);
        jobExecutionContext
            .getJobDetail()
            .getJobDataMap()
            .put("AppScheduleRun", JsonUtils.pojoToJson(appRecord));
      }
    }
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
    boolean isSmartReindexing = detectSmartReindexing();
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
      slackClient.sendStartNotification(
          entitiesDisplayString, isSmartReindexing, jobData.getEntities().size());
    }

    LOG.debug("Executing Reindexing Job with JobData: {}", jobData);
    updateJobStatus(EventPublisherJob.Status.RUNNING);
    LOG.debug("Initializing job statistics.");
    searchIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(searchIndexStats.get());

    SearchClusterMetrics clusterMetrics = null;
    if (Boolean.TRUE.equals(jobData.getAutoTune())) {
      LOG.debug("Auto-tune enabled, analyzing cluster and adjusting parameters...");
      clusterMetrics =
          SearchClusterMetrics.fetchClusterMetrics(
              searchRepository,
              searchIndexStats.get().getJobStats().getTotalRecords(),
              searchRepository.getMaxDBConnections());

      jobData.setBatchSize(clusterMetrics.getRecommendedBatchSize());
      jobData.setMaxConcurrentRequests(clusterMetrics.getRecommendedConcurrentRequests());
      jobData.setPayLoadSize(clusterMetrics.getMaxPayloadSizeBytes());
      jobData.setConsumerThreads(clusterMetrics.getRecommendedConsumerThreads());
      jobData.setQueueSize(clusterMetrics.getRecommendedQueueSize());

      jobLogger.addInitDetail("Auto-tune", "Enabled");
      jobLogger.addInitDetail("Batch size", jobData.getBatchSize());
      jobLogger.addInitDetail("Concurrent requests", jobData.getMaxConcurrentRequests());
      jobLogger.addInitDetail("Payload size", (jobData.getPayLoadSize() / (1024 * 1024)) + " MB");
      jobLogger.addInitDetail("Consumer threads", jobData.getConsumerThreads());
      jobLogger.addInitDetail("Queue size", jobData.getQueueSize());
    }

    batchSize.set(jobData.getBatchSize());
    originalBatchSize = jobData.getBatchSize();
    sendUpdates(jobExecutionContext, true);

    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();
    jobLogger.addInitDetail("Search type", searchType);

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

    jobLogger.addInitDetail("Producer threads", numProducers);
    jobLogger.addInitDetail("Consumer threads", numConsumers);
    jobLogger.addInitDetail("Total entities", totalEntities);

    int queueSize = jobData.getQueueSize() != null ? jobData.getQueueSize() : DEFAULT_QUEUE_SIZE;
    jobLogger.addInitDetail("Queue size", queueSize);
    jobLogger.logInitialization();
    taskQueue = new ArrayBlockingQueue<>(queueSize);
    producersDone.set(false);
    // Use fixed thread pool to prevent thread explosion
    jobExecutor =
        Executors.newFixedThreadPool(
            jobData.getEntities().size(), Thread.ofPlatform().name("job-", 0).factory());
    // CRITICAL: Ensure we're not exceeding consumer thread limit
    if (numConsumers > MAX_CONSUMER_THREADS) {
      LOG.error(
          "Consumer threads {} exceeds maximum {}, forcing to max",
          numConsumers,
          MAX_CONSUMER_THREADS);
      numConsumers = MAX_CONSUMER_THREADS;
    }

    consumerExecutor =
        Executors.newFixedThreadPool(
            numConsumers, Thread.ofPlatform().name("consumer-", 0).factory());

    CountDownLatch consumerLatch = new CountDownLatch(numConsumers);
    for (int i = 0; i < numConsumers; i++) {
      final int consumerId = i;
      consumerExecutor.submit(
          () -> {
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
          });
    }

    producerExecutor =
        Executors.newFixedThreadPool(
            numProducers, Thread.ofPlatform().name("producer-", 0).factory());

    try {
      processEntityReindex(jobExecutionContext);
      producersDone.set(true);
      for (int i = 0; i < numConsumers; i++) {
        taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      }
      boolean finished = consumerLatch.await(5, TimeUnit.MINUTES);
      if (!finished) {
        LOG.warn("Consumers did not finish within timeout");
      }

    } catch (InterruptedException e) {
      LOG.info("Reindexing interrupted - stopping immediately");
      stopped = true;
      Thread.currentThread().interrupt();
      throw e;
    } catch (Exception e) {
      if (!stopped) {
        if (jobLogger != null) {
          jobLogger.logError("reindexing process", e);
        } else {
          LOG.error("Error during reindexing process.", e);
        }
      }
      throw e;
    } finally {
      if (!stopped) {
        shutdownExecutor(consumerExecutor, "ConsumerExecutor", 30, TimeUnit.SECONDS);
        shutdownExecutor(jobExecutor, "JobExecutor", 20, TimeUnit.SECONDS);
        shutdownExecutor(producerExecutor, "ProducerExecutor", 1, TimeUnit.MINUTES);
      }
    }
  }

  private void processEntityReindex(JobExecutionContext jobExecutionContext)
      throws InterruptedException {
    int latchCount = getTotalLatchCount(jobData.getEntities());
    CountDownLatch producerLatch = new CountDownLatch(latchCount);
    submitProducerTask(jobExecutionContext, producerLatch);

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

  private void submitProducerTask(
      JobExecutionContext jobExecutionContext, CountDownLatch producerLatch) {
    for (String entityType : jobData.getEntities()) {
      jobExecutor.submit(
          () -> {
            try {
              // Notify logger that we're starting this entity
              if (jobLogger != null) {
                jobLogger.markEntityStarted(entityType);
              }

              int totalEntityRecords = getTotalEntityRecords(entityType);
              int loadPerThread = calculateNumberOfThreads(totalEntityRecords);
              if (totalEntityRecords > 0) {
                for (int i = 0; i < loadPerThread; i++) {
                  LOG.debug(
                      "Submitting virtual thread producer task for batch {}/{}",
                      i + 1,
                      loadPerThread);
                  int currentOffset = i * batchSize.get();
                  producerExecutor.submit(
                      () -> {
                        try {
                          if (stopped) {
                            LOG.debug("Skipping batch - stop signal received");
                            return;
                          }
                          // Check for backpressure but don't block
                          if (isBackpressureActive()) {
                            LOG.debug("Backpressure active, will retry later");
                            // Re-submit this task to be processed later
                            producerLatch.countDown();
                            return;
                          }
                          LOG.debug(
                              "Virtual thread processing offset: {}, remaining batches: {}",
                              currentOffset,
                              producerLatch.getCount());
                          Source<?> source = createSource(entityType);
                          processReadTask(entityType, source, currentOffset);
                        } catch (Exception e) {
                          // Don't log errors if we're stopping
                          if (!stopped) {
                            LOG.error(
                                "Error processing entity type {} with virtual thread",
                                entityType,
                                e);
                          }
                        } finally {
                          LOG.debug(
                              "Virtual thread completed batch, remaining: {}",
                              producerLatch.getCount() - 1);
                          producerLatch.countDown();
                        }
                      });
                }
              }
              // Notify logger that this entity is complete
              if (jobLogger != null) {
                jobLogger.markEntityCompleted(entityType);
              }
            } catch (Exception e) {
              LOG.error("Error processing entity type {}", entityType, e);
            }
          });
    }
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
    if (stopped) {
      if (newStatus != EventPublisherJob.Status.STOP_IN_PROGRESS
          && newStatus != EventPublisherJob.Status.STOPPED) {
        LOG.info(
            "Skipping status update to {} because stop has been initiated (current: {})",
            newStatus,
            currentStatus);
        return;
      }
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
      consecutiveErrors++;
      consecutiveSuccesses = 0; // Reset success counter
      LOG.warn("Detected backpressure from OpenSearch (consecutive errors: {})", consecutiveErrors);

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
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
          consecutiveErrors = 0; // Reset counter

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
    if (jobLogger != null && jobData != null && jobData.getStats() != null) {
      jobLogger.logCompletion(jobData.getStats());

      if (slackClient != null) {
        long elapsedSeconds = 0;
        boolean hasErrors = false;
        if (jobData.getStats().getJobStats() != null) {
          long failed =
              jobData.getStats().getJobStats().getFailedRecords() != null
                  ? jobData.getStats().getJobStats().getFailedRecords()
                  : 0;
          long processed =
              jobData.getStats().getJobStats().getSuccessRecords() != null
                  ? jobData.getStats().getJobStats().getSuccessRecords()
                  : 0;
          long total =
              jobData.getStats().getJobStats().getTotalRecords() != null
                  ? jobData.getStats().getJobStats().getTotalRecords()
                  : 0;
          hasErrors = failed > 0 || (total > 0 && processed < total);
        }

        if (jobData.getTimestamp() != null) {
          elapsedSeconds = (System.currentTimeMillis() - jobData.getTimestamp()) / 1000;
        }
        slackClient.sendCompletionNotification(jobData.getStats(), elapsedSeconds, hasErrors);
      }
    } else if (jobData != null) {
      LOG.info("Search Index Job Completed for Entities: {}", jobData.getEntities());
    } else {
      LOG.info("Search Index Job Completed");
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
      if ("queryCostResult".equals(entityType)) {
        LOG.warn("Found incorrect entity type 'queryCostResult', correcting to 'queryCostRecord'");
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
    if ("queryCostResult".equals(entityType)) {
      LOG.warn("Found incorrect entity type 'queryCostResult', correcting to 'queryCostRecord'");
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

    EventPublisherJob.Status currentStatus = null;
    if (jobData != null) {
      currentStatus = jobData.getStatus();
      LOG.info("Current job status before stop: {}", currentStatus);

      if (currentStatus != EventPublisherJob.Status.STOP_IN_PROGRESS
          && currentStatus != EventPublisherJob.Status.STOPPED) {
        jobData.setStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
        LOG.info("Updated job status to STOP_IN_PROGRESS");
      }
    } else {
      LOG.warn("jobData is null during stop - cannot capture current status");
    }

    if (jobExecutionContext != null) {
      AppRunRecord appRecord = getJobRecord(jobExecutionContext);
      appRecord.setStatus(AppRunRecord.Status.STOP_IN_PROGRESS);
      appRecord.setEndTime(System.currentTimeMillis());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put("AppScheduleRun", JsonUtils.pojoToJson(appRecord));
      pushAppStatusUpdates(jobExecutionContext, appRecord, true);
      sendUpdates(jobExecutionContext, true);
    }

    // CRITICAL: Update final status to database BEFORE shutting down any resources
    try {
      // Set final STOPPED status
      if (jobData != null) {
        jobData.setStatus(EventPublisherJob.Status.STOPPED);
        LOG.info("Final status set to STOPPED");
      } else {
        LOG.warn("jobData is null, cannot set final STOPPED status");
      }

      if (jobExecutionContext != null) {
        AppRunRecord appRecord = getJobRecord(jobExecutionContext);
        appRecord.setStatus(AppRunRecord.Status.STOPPED);
        appRecord.setEndTime(System.currentTimeMillis());
        jobExecutionContext
            .getJobDetail()
            .getJobDataMap()
            .put("AppScheduleRun", JsonUtils.pojoToJson(appRecord));

        // Persist to database BEFORE any resources are closed
        try {
          pushAppStatusUpdates(jobExecutionContext, appRecord, true);
          LOG.info("Successfully persisted STOPPED status to database");
        } catch (Exception dbEx) {
          LOG.error("Failed to persist STOPPED status to database", dbEx);
        }

        // Send WebSocket update
        try {
          sendUpdates(jobExecutionContext, true);
        } catch (Exception wsEx) {
          LOG.error("Failed to send WebSocket update for STOPPED status", wsEx);
        }
      }
    } catch (Exception e) {
      LOG.error("Error updating final STOPPED status", e);
    }

    // NOW shutdown executors and close resources
    if (producerExecutor != null && !producerExecutor.isShutdown()) {
      LOG.info("Force shutting down producer executor");
      List<Runnable> pendingTasks = producerExecutor.shutdownNow();
      LOG.info("Cancelled {} pending producer tasks", pendingTasks.size());
    }

    if (consumerExecutor != null && !consumerExecutor.isShutdown()) {
      LOG.info("Force shutting down consumer executor");
      List<Runnable> pendingTasks = consumerExecutor.shutdownNow();
      LOG.info("Cancelled {} pending consumer tasks", pendingTasks.size());
    }

    if (jobExecutor != null && !jobExecutor.isShutdown()) {
      LOG.info("Force shutting down job executor");
      List<Runnable> pendingTasks = jobExecutor.shutdownNow();
      LOG.info("Cancelled {} pending job tasks", pendingTasks.size());
    }

    // Clear the task queue
    if (taskQueue != null) {
      taskQueue.clear();
      // Add poison pills to wake up any blocked consumers
      for (int i = 0; i < 10; i++) {
        taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      }
    }

    // Close the sink to stop any pending writes
    if (searchIndexSink != null) {
      try {
        LOG.info("Closing search index sink");
        searchIndexSink.close();
      } catch (Exception e) {
        LOG.error("Error closing search index sink", e);
      }
    }

    LOG.info("Reindexing job stopped successfully.");
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
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, entityType);

    try {
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

      StepStats currentEntityStats = new StepStats();
      currentEntityStats.setSuccessRecords(listOrEmpty(entities.getData()).size());
      currentEntityStats.setFailedRecords(listOrEmpty(entities.getErrors()).size());

      if (!entities.getErrors().isEmpty()) {
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
      } else {
        if (consecutiveErrors > 0) {
          consecutiveErrors = 0;
          LOG.debug("Reset consecutive error counter after successful batch");
        }

        consecutiveSuccesses++;
        if (consecutiveSuccesses >= BATCH_SIZE_INCREASE_THRESHOLD && originalBatchSize > 0) {
          int currentBatchSize = batchSize.get();
          int targetBatchSize =
              Math.clamp(currentBatchSize * 3 / 2, 1, originalBatchSize); // Increase by 50%

          if (targetBatchSize > currentBatchSize) {
            batchSize.set(targetBatchSize);
            LOG.info(
                "Increased batch size from {} to {} after {} successful batches",
                currentBatchSize,
                targetBatchSize,
                consecutiveSuccesses);
            jobData.setBatchSize(targetBatchSize);
            consecutiveSuccesses = 0; // Reset counter

            if (searchIndexSink instanceof OpenSearchBulkSink opensearchBulkSink) {
              opensearchBulkSink.updateBatchSize(targetBatchSize);
            } else if (searchIndexSink instanceof ElasticSearchBulkSink elasticSearchBulkSink) {
              elasticSearchBulkSink.updateBatchSize(targetBatchSize);
            }
          }
        }
      }
      updateStats(entityType, currentEntityStats);

      LOG.debug(
          "Broadcasting metrics update for entity type: {}, success: {}, failed: {}",
          entityType,
          currentEntityStats.getSuccessRecords(),
          currentEntityStats.getFailedRecords());
      sendUpdates(jobExecutionContext);

    } catch (SearchIndexException e) {
      if (!stopped) {
        updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
        IndexingError indexingError = e.getIndexingError();
        if (indexingError != null) {
          jobData.setFailure(indexingError);
          handleBackpressure(indexingError.getMessage());
        } else {
          jobData.setFailure(
              new IndexingError()
                  .withErrorSource(IndexingError.ErrorSource.SINK)
                  .withMessage(e.getMessage()));
          handleBackpressure(e.getMessage());
        }

        StepStats failedEntityStats = new StepStats();
        failedEntityStats.setSuccessRecords(
            indexingError != null ? indexingError.getSuccessCount() : 0);
        failedEntityStats.setFailedRecords(
            indexingError != null ? indexingError.getFailedCount() : entities.getData().size());
        updateStats(entityType, failedEntityStats);
        sendUpdates(jobExecutionContext, true); // Force update for errors
      }
      LOG.error(String.format("Issues in Sink to Elastic Search for %s", entityType), e);
    } catch (Exception e) {
      if (!stopped) {
        updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
        jobData.setFailure(
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.SINK)
                .withMessage(ExceptionUtils.getStackTrace(e)));

        StepStats failedEntityStats = new StepStats();
        failedEntityStats.setSuccessRecords(0);
        failedEntityStats.setFailedRecords(
            entities != null && entities.getData() != null ? entities.getData().size() : 0);
        updateStats(entityType, failedEntityStats);
        sendUpdates(jobExecutionContext, true); // Force update for errors
      }
      LOG.error(String.format("Issues in Sink to Elastic Search for %s", entityType), e);
    }
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

    Object statsObj =
        searchIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType);
    if (statsObj instanceof StepStats) {
      StepStats stats = (StepStats) statsObj;
      return stats.getTotalRecords() != null ? stats.getTotalRecords() : 0;
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
    StepStats entityStats =
        (StepStats) stats.getEntityStats().getAdditionalProperties().get(entityType);
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
            .mapToInt(s -> ((StepStats) s).getSuccessRecords())
            .sum();

    int totalFailed =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(s -> ((StepStats) s).getFailedRecords())
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
      // Exit early if stopped
      if (stopped) {
        LOG.debug("Skipping read task - stop signal received");
        return;
      }

      Object resultList = source.readWithCursor(RestUtil.encodeCursor(String.valueOf(offset)));
      LOG.debug("Read Entities with entityType: {},  CurrentOffset: {}", entityType, offset);

      // Check again after read operation
      if (stopped) {
        LOG.debug("Skipping processing - stop signal received after read");
        return;
      }

      if (resultList != null) {
        ResultList<?> entities = extractEntities(entityType, resultList);
        if (!nullOrEmpty(entities.getData()) && !stopped) {
          IndexingTask<?> task = new IndexingTask<>(entityType, entities, offset);
          // Add to queue for consumers
          boolean added = taskQueue.offer(task, 30, TimeUnit.SECONDS);
          if (!added) {
            LOG.warn("Failed to add task to queue within timeout for entityType: {}", entityType);
          }
        }
      }
    } catch (SearchIndexException e) {
      LOG.error("Error while reading source for entityType: {}", entityType, e);
      // Only update to ACTIVE_ERROR if not stopped
      if (!stopped) {
        updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      }
      if (jobData != null) {
        jobData.setFailure(e.getIndexingError());
      }
      int remainingRecords = getRemainingRecordsToProcess(entityType);
      if (remainingRecords - batchSize.get() <= 0) {
        updateStats(
            entityType, new StepStats().withSuccessRecords(0).withFailedRecords(remainingRecords));
      } else {
        updateStats(
            entityType, new StepStats().withSuccessRecords(0).withFailedRecords(batchSize.get()));
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while adding task to queue");
    }
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
