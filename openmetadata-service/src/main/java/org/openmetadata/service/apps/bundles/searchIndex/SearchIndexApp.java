package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.quartz.JobExecutionContext;

@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {
  private static final String ALL = "all";

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

  // Constants to replace magic numbers
  private BulkSink searchIndexSink;

  @Getter private EventPublisherJob jobData;
  private ExecutorService producerExecutor;
  private ExecutorService jobExecutor;
  private final AtomicReference<Stats> searchIndexStats = new AtomicReference<>();
  private final AtomicReference<Integer> batchSize = new AtomicReference<>(5);
  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;
  private volatile long lastWebSocketUpdate = 0;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000; // 2 seconds

  // Backpressure handling
  private volatile int consecutiveErrors = 0;
  private volatile int consecutiveSuccesses = 0;
  private volatile long lastBackpressureTime = 0;
  private static final int MAX_CONSECUTIVE_ERRORS = 5;
  private static final int BATCH_SIZE_INCREASE_THRESHOLD =
      50; // Increase after 50 successful batches
  private static final long BACKPRESSURE_WAIT_MS = 5000; // 5 seconds
  private int originalBatchSize = 0; // Store original batch size

  // Maximum concurrent tasks to prevent exhausting DB connections
  private static final int MAX_CONCURRENT_TASKS = 50;

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    EventPublisherJob request =
        JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class)
            .withStats(new Stats());
    JsonUtils.validateJsonSchema(request, EventPublisherJob.class);

    if (request.getEntities().size() == 1 && request.getEntities().contains(ALL)) {
      SearchRepository searchRepo = Entity.getSearchRepo();
      request.setEntities(searchRepo.getSearchEntities());
    }

    jobData = request;
    LOG.info("Initialized SearchIndexApp with entities: {}", jobData.getEntities());
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    try {
      this.jobExecutionContext = jobExecutionContext;

      // Initialize bounded executors
      this.jobExecutor =
          Executors.newFixedThreadPool(MAX_CONCURRENT_TASKS, Thread.ofVirtual().factory());

      initializeJob(jobExecutionContext);

      // Check if already interrupted
      if (Thread.currentThread().isInterrupted()) {
        LOG.info("Job interrupted before starting - exiting");
        stopped = true;
        return;
      }

      String runType =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");
      if (!ON_DEMAND_JOB.equals(runType)) {
        jobData.setRecreateIndex(false);
      }

      reCreateIndexes(jobData.getEntities());
      performReindex(jobExecutionContext);

      // Set job completion status if no errors occurred
      if (jobData.getStatus() == EventPublisherJob.Status.RUNNING) {
        updateJobStatus(EventPublisherJob.Status.COMPLETED);
        sendUpdates(jobExecutionContext, true);
      }
    } catch (InterruptedException ex) {
      LOG.info("Job interrupted - setting status to STOPPED");
      Thread.currentThread().interrupt();
      stopped = true;

      // Set STOPPED status instead of treating as failure
      jobData.setStatus(EventPublisherJob.Status.STOPPED);

      // Update database with STOPPED status
      if (jobExecutionContext != null) {
        AppRunRecord appRecord = getJobRecord(jobExecutionContext);
        appRecord.setStatus(AppRunRecord.Status.STOPPED);
        appRecord.setEndTime(System.currentTimeMillis());

        // Update the JobDataMap so OmAppJobListener sees the correct status
        jobExecutionContext
            .getJobDetail()
            .getJobDataMap()
            .put("AppScheduleRun", JsonUtils.pojoToJson(appRecord));

        pushAppStatusUpdates(jobExecutionContext, appRecord, true);
      }
    } catch (Exception ex) {
      // Check if we were interrupted (stop was called)
      if (Thread.currentThread().isInterrupted() || stopped) {
        LOG.info("Job interrupted via generic exception - setting status to STOPPED");
        stopped = true;

        jobData.setStatus(EventPublisherJob.Status.STOPPED);

        // Update database with STOPPED status
        if (jobExecutionContext != null) {
          AppRunRecord appRecord = getJobRecord(jobExecutionContext);
          appRecord.setStatus(AppRunRecord.Status.STOPPED);
          appRecord.setEndTime(System.currentTimeMillis());

          // Update the JobDataMap so OmAppJobListener sees the correct status
          jobExecutionContext
              .getJobDetail()
              .getJobDataMap()
              .put("AppScheduleRun", JsonUtils.pojoToJson(appRecord));

          pushAppStatusUpdates(jobExecutionContext, appRecord, true);
        }
      } else {
        handleJobFailure(ex);
      }
    } finally {
      // Always send final update
      sendUpdates(jobExecutionContext, true);

      // If stopped, ensure the final status is STOPPED in JobDataMap
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
  private void cleanUpStaleJobsFromRuns() {
    try {
      collectionDAO
          .appExtensionTimeSeriesDao()
          .markStaleEntriesStopped(getApp().getId().toString());
      LOG.debug("Cleaned up stale jobs.");
    } catch (Exception ex) {
      LOG.error("Failed in marking stale entries as stopped.", ex);
    }
  }

  private void initializeJob(JobExecutionContext jobExecutionContext) {
    cleanUpStaleJobsFromRuns();

    LOG.info("Executing Reindexing Job with JobData: {}", jobData);

    updateJobStatus(EventPublisherJob.Status.RUNNING);

    LOG.debug("Initializing job statistics.");
    searchIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(searchIndexStats.get());

    // Apply auto-tuning if enabled (after stats are initialized)
    if (Boolean.TRUE.equals(jobData.getAutoTune())) {
      LOG.info("Auto-tune enabled, analyzing cluster and adjusting parameters...");
      applyAutoTuning();
    }

    batchSize.set(jobData.getBatchSize());
    originalBatchSize = jobData.getBatchSize(); // Store original for later restoration
    sendUpdates(jobExecutionContext, true);

    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();
    LOG.info("Initializing searchIndexSink with search type: {}", searchType);

    // Use the new bulk processor-based implementations
    if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.searchIndexSink =
          new OpenSearchBulkSink(
              searchRepository,
              jobData.getBatchSize(),
              jobData.getMaxConcurrentRequests(),
              jobData.getPayLoadSize());
      LOG.info("Initialized OpenSearchBulkSink with batch size: {}", jobData.getBatchSize());
    } else {
      this.searchIndexSink =
          new ElasticSearchBulkSink(
              searchRepository,
              jobData.getBatchSize(),
              jobData.getMaxConcurrentRequests(),
              jobData.getPayLoadSize());
      LOG.info("Initialized ElasticSearchBulkSink with batch size: {}", jobData.getBatchSize());
    }
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
          appRecord.getFailureContext() != null);
      if (appRecord.getFailureContext() != null) {
        LOG.debug("WebSocket Error Message: {}", messageJson);
      }
    }

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    LOG.debug("Updated AppRunRecord in DB: {}", appRecord);
  }

  private void performReindex(JobExecutionContext jobExecutionContext) throws InterruptedException {
    int numProducers = jobData.getProducerThreads();
    int numConsumers = jobData.getConsumerThreads();
    LOG.info("Starting reindexing with {} producers and {} consumers.", numProducers, numConsumers);

    // Use bounded executor for producer threads
    producerExecutor =
        Executors.newFixedThreadPool(
            Math.min(numProducers, MAX_CONCURRENT_TASKS), Thread.ofVirtual().factory());

    try {
      processEntityReindex(jobExecutionContext);
    } catch (InterruptedException e) {
      LOG.info("Reindexing interrupted - stopping immediately");
      stopped = true;
      Thread.currentThread().interrupt(); // Preserve interrupt status
      throw e;
    } catch (Exception e) {
      if (!stopped) {
        LOG.error("Error during reindexing process.", e);
      }
      throw e;
    } finally {
      // Only do graceful shutdown if not stopped
      if (!stopped) {
        shutdownExecutor(jobExecutor, "JobExecutor", 20, TimeUnit.SECONDS);
        shutdownExecutor(producerExecutor, "ReaderExecutor", 1, TimeUnit.MINUTES);
      }
      // If stopped, executors are already force-shutdown in stop() method
    }
  }

  private void processEntityReindex(JobExecutionContext jobExecutionContext)
      throws InterruptedException {
    int latchCount = getTotalLatchCount(jobData.getEntities());
    CountDownLatch producerLatch = new CountDownLatch(latchCount);
    submitProducerTask(jobExecutionContext, producerLatch);

    // Wait for completion but check for stop signal and thread interruption every second
    while (!producerLatch.await(1, TimeUnit.SECONDS)) {
      if (stopped || Thread.currentThread().isInterrupted()) {
        LOG.info("Stop signal or interrupt received during reindexing - exiting immediately");
        // Force interrupt all tasks
        if (producerExecutor != null) {
          producerExecutor.shutdownNow();
        }
        if (jobExecutor != null) {
          jobExecutor.shutdownNow();
        }
        return; // Exit immediately without waiting
      }
    }
  }

  private void submitProducerTask(
      JobExecutionContext jobExecutionContext, CountDownLatch producerLatch) {
    for (String entityType : jobData.getEntities()) {
      jobExecutor.submit(
          () -> {
            try {
              int totalEntityRecords = getTotalEntityRecords(entityType);
              Source<?> source = createSource(entityType);
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
                          // Check if stopped before processing
                          if (stopped) {
                            LOG.debug("Skipping batch - stop signal received");
                            return;
                          }

                          // Apply natural throttling if we're experiencing backpressure
                          long backpressureDelay = getBackpressureDelay();
                          if (backpressureDelay > 0) {
                            LOG.debug("Applying backpressure delay of {} ms", backpressureDelay);
                            try {
                              TimeUnit.MILLISECONDS.sleep(backpressureDelay);
                            } catch (InterruptedException ie) {
                              Thread.currentThread().interrupt();
                              LOG.debug("Backpressure delay interrupted");
                              return;
                            }
                          }

                          LOG.debug(
                              "Virtual thread processing offset: {}, remaining batches: {}",
                              currentOffset,
                              producerLatch.getCount());
                          processReadTask(jobExecutionContext, entityType, source, currentOffset);
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
            } catch (Exception e) {
              LOG.error("Error processing entity type {}", entityType, e);
            }
          });
    }
  }

  /**
   * Shuts down an executor service gracefully.
   *
   * @param executor The executor service to shut down.
   * @param name     The name of the executor for logging.
   * @param timeout  The timeout duration.
   * @param unit     The time unit of the timeout.
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

    // Never overwrite STOP_IN_PROGRESS or STOPPED status
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
    // Check if this is a rejected execution exception
    if (errorMessage != null && errorMessage.contains("rejected_execution_exception")) {
      consecutiveErrors++;
      consecutiveSuccesses = 0; // Reset success counter
      LOG.warn("Detected backpressure from OpenSearch (consecutive errors: {})", consecutiveErrors);

      // Reduce batch size if we're getting too many errors
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        int currentBatchSize = batchSize.get();
        int newBatchSize = Math.max(50, currentBatchSize / 2); // Reduce by half, minimum 50

        if (newBatchSize < currentBatchSize) {
          batchSize.set(newBatchSize);
          LOG.info(
              "Reduced batch size from {} to {} due to backpressure",
              currentBatchSize,
              newBatchSize);
          jobData.setBatchSize(newBatchSize); // Update jobData as well

          // Update the bulk sink's batch size
          if (searchIndexSink instanceof OpenSearchBulkSink) {
            ((OpenSearchBulkSink) searchIndexSink).updateBatchSize(newBatchSize);
          } else if (searchIndexSink instanceof ElasticSearchBulkSink) {
            ((ElasticSearchBulkSink) searchIndexSink).updateBatchSize(newBatchSize);
          }
        }

        // Don't use Thread.sleep - instead, record the time and let the system naturally throttle
        LOG.info(
            "Detected severe backpressure. Will naturally throttle operations for {} seconds",
            BACKPRESSURE_WAIT_MS / 1000);

        consecutiveErrors = 0; // Reset counter after adjustment
        lastBackpressureTime = System.currentTimeMillis();
      }
    }
  }

  /**
   * Check if we should slow down due to recent backpressure.
   * This provides natural throttling without blocking threads.
   * @return suggested delay in milliseconds, or 0 if no throttling needed
   */
  private long getBackpressureDelay() {
    if (lastBackpressureTime == 0) {
      return 0;
    }

    long timeSinceBackpressure = System.currentTimeMillis() - lastBackpressureTime;
    if (timeSinceBackpressure >= BACKPRESSURE_WAIT_MS) {
      return 0; // Cooldown period has passed
    }

    // Return a delay proportional to how recently we saw backpressure
    // More recent = longer delay (max 500ms, min 50ms)
    long remainingCooldown = BACKPRESSURE_WAIT_MS - timeSinceBackpressure;
    return Math.min(500, Math.max(50, remainingCooldown / 10));
  }

  private void handleJobFailure(Exception ex) {
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(
                String.format(
                    "Reindexing Job Has Encountered an Exception.%nJob Data: %s,%nStack: %s",
                    jobData.toString(), ExceptionUtils.getStackTrace(ex)));
    LOG.error(indexingError.getMessage(), ex);
    updateJobStatus(EventPublisherJob.Status.FAILED);
    jobData.setFailure(indexingError);
  }

  public void updateStats(String entityType, StepStats currentEntityStats) {
    Stats jobDataStats = jobData.getStats();
    if (jobDataStats.getEntityStats() == null) {
      jobDataStats.setEntityStats(new EntityStats());
    }

    StepStats existingEntityStats =
        jobDataStats.getEntityStats().getAdditionalProperties().get(entityType);
    if (existingEntityStats == null) {
      jobDataStats.getEntityStats().getAdditionalProperties().put(entityType, currentEntityStats);
      LOG.debug("Initialized StepStats for entityType '{}': {}", entityType, currentEntityStats);
    } else {
      accumulateStepStats(existingEntityStats, currentEntityStats);
      LOG.debug(
          "Accumulated StepStats for entityType '{}': Success - {}, Failed - {}",
          entityType,
          existingEntityStats.getSuccessRecords(),
          existingEntityStats.getFailedRecords());
    }

    StepStats jobStats = jobDataStats.getJobStats();
    if (jobStats == null) {
      jobStats = new StepStats();
      jobDataStats.setJobStats(jobStats);
    }

    accumulateStepStats(jobStats, currentEntityStats);
    LOG.debug(
        "Updated jobStats: Success - {}, Failed - {}",
        jobStats.getSuccessRecords(),
        jobStats.getFailedRecords());

    jobData.setStats(jobDataStats);
  }

  private void accumulateStepStats(StepStats target, StepStats source) {
    if (target == null || source == null) {
      return;
    }
    target.setTotalRecords(target.getTotalRecords() + source.getTotalRecords());
    target.setSuccessRecords(target.getSuccessRecords() + source.getSuccessRecords());
    target.setFailedRecords(target.getFailedRecords() + source.getFailedRecords());
  }

  public Stats initializeTotalRecords(Set<String> entities) {
    Stats jobDataStats = jobData.getStats();
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
      // Handle incorrect entity type name for query cost
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

  private void reCreateIndexes(Set<String> entities) throws SearchIndexException {
    for (String entityType : entities) {
      if (Boolean.FALSE.equals(jobData.getRecreateIndex())) {
        LOG.debug("RecreateIndex is false. Skipping index recreation for '{}'.", entityType);
        return;
      }

      try {
        // Handle incorrect entity type name for query cost
        String correctedEntityType = entityType;
        if ("queryCostResult".equals(entityType)) {
          LOG.warn(
              "Found incorrect entity type 'queryCostResult', correcting to 'queryCostRecord'");
          correctedEntityType = QUERY_COST_RECORD;
        }

        IndexMapping indexType = searchRepository.getIndexMapping(correctedEntityType);
        if (indexType == null) {
          LOG.warn(
              "No index mapping found for entityType '{}'. Skipping index recreation.",
              correctedEntityType);
          continue; // Use continue instead of return to process other entities
        }
        searchRepository.deleteIndex(indexType);
        searchRepository.createIndex(indexType);
        LOG.info("Recreated index for entityType '{}'.", correctedEntityType);
      } catch (Exception e) {
        LOG.error("Failed to recreate index for entityType '{}'.", entityType, e);
        throw new SearchIndexException(e);
      }
    }
  }

  @Override
  public void interrupt() {
    LOG.error("SearchIndexApp.interrupt() called from Quartz scheduler - STOPPING NOW");
    try {
      stop();
    } catch (Exception e) {
      LOG.error("Error in stop() method", e);
      // Still try to set stopped flag
      stopped = true;
    }
  }

  @SuppressWarnings("unused")
  @Override
  public void stop() {
    LOG.info("SearchIndexApp.stop() called - force immediate stop.");
    stopped = true;
    EventPublisherJob.Status currentStatus = jobData.getStatus();
    LOG.info("Current status before setting to STOP_IN_PROGRESS: {}", currentStatus);
    updateJobStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
    LOG.info("Status update to STOP_IN_PROGRESS requested");

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

    if (jobExecutor != null && !jobExecutor.isShutdown()) {
      LOG.info("Force shutting down job executor");
      List<Runnable> pendingTasks = jobExecutor.shutdownNow();
      LOG.info("Cancelled {} pending job tasks", pendingTasks.size());
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

    // Handle incorrect entity type name for query cost
    String correctedEntityType = entityType;
    if ("queryCostResult".equals(entityType)) {
      LOG.warn("Found incorrect entity type 'queryCostResult', correcting to 'queryCostRecord'");
      correctedEntityType = QUERY_COST_RECORD;
    }

    Map<String, Object> contextData = new HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, correctedEntityType);

    try {
      if (!TIME_SERIES_ENTITIES.contains(correctedEntityType)) {
        @SuppressWarnings("unchecked")
        List<EntityInterface> entityList = (List<EntityInterface>) entities.getData();
        searchIndexSink.write(entityList, contextData);
      } else {
        @SuppressWarnings("unchecked")
        List<EntityTimeSeriesInterface> entityList =
            (List<EntityTimeSeriesInterface>) entities.getData();
        searchIndexSink.write(entityList, contextData);
      }

      // After successful write, create a new StepStats for the current batch
      StepStats currentEntityStats = new StepStats();
      currentEntityStats.setSuccessRecords(listOrEmpty(entities.getData()).size());
      currentEntityStats.setFailedRecords(listOrEmpty(entities.getErrors()).size());
      // Do NOT set Total Records here

      // Update statistics in a thread-safe manner
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
        // Reset consecutive errors on successful batch
        if (consecutiveErrors > 0) {
          consecutiveErrors = 0;
          LOG.debug("Reset consecutive error counter after successful batch");
        }

        // Track consecutive successes and potentially increase batch size
        consecutiveSuccesses++;
        if (consecutiveSuccesses >= BATCH_SIZE_INCREASE_THRESHOLD && originalBatchSize > 0) {
          int currentBatchSize = batchSize.get();
          int targetBatchSize =
              Math.min(originalBatchSize, currentBatchSize * 3 / 2); // Increase by 50%

          if (targetBatchSize > currentBatchSize) {
            batchSize.set(targetBatchSize);
            LOG.info(
                "Increased batch size from {} to {} after {} successful batches",
                currentBatchSize,
                targetBatchSize,
                consecutiveSuccesses);
            jobData.setBatchSize(targetBatchSize);
            consecutiveSuccesses = 0; // Reset counter

            // Update the bulk sink's batch size
            if (searchIndexSink instanceof OpenSearchBulkSink) {
              ((OpenSearchBulkSink) searchIndexSink).updateBatchSize(targetBatchSize);
            } else if (searchIndexSink instanceof ElasticSearchBulkSink) {
              ((ElasticSearchBulkSink) searchIndexSink).updateBatchSize(targetBatchSize);
            }
          }
        }
      }
      updateStats(entityType, currentEntityStats);

      // Broadcast updated metrics via WebSocket after each batch
      LOG.debug(
          "Broadcasting metrics update for entity type: {}, success: {}, failed: {}",
          entityType,
          currentEntityStats.getSuccessRecords(),
          currentEntityStats.getFailedRecords());
      sendUpdates(jobExecutionContext);

    } catch (SearchIndexException e) {
      // Only update to ACTIVE_ERROR if not stopped
      if (!stopped) {
        updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
        // Use the IndexingError from SearchIndexException if available
        IndexingError indexingError = e.getIndexingError();
        if (indexingError != null) {
          jobData.setFailure(indexingError);
          // Check for backpressure
          handleBackpressure(indexingError.getMessage());
        } else {
          jobData.setFailure(
              new IndexingError()
                  .withErrorSource(IndexingError.ErrorSource.SINK)
                  .withMessage(e.getMessage()));
          // Check for backpressure
          handleBackpressure(e.getMessage());
        }

        StepStats failedEntityStats = new StepStats();
        failedEntityStats.setSuccessRecords(
            indexingError != null ? indexingError.getSuccessCount() : 0);
        failedEntityStats.setFailedRecords(
            indexingError != null ? indexingError.getFailedCount() : entities.getData().size());
        updateStats(entityType, failedEntityStats);

        // Immediately broadcast the error via WebSocket
        sendUpdates(jobExecutionContext, true); // Force update for errors
        LOG.error("Search indexing error during processing task for entity {}", entityType, e);
      } else {
        LOG.debug("Ignoring search index error during stop operation for entity {}", entityType);
      }
    } catch (Exception e) {
      // Only update to ACTIVE_ERROR if not stopped
      if (!stopped) {
        updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
        jobData.setFailure(
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.JOB)
                .withMessage(e.getMessage()));

        StepStats failedEntityStats = new StepStats();
        failedEntityStats.setSuccessRecords(0);
        failedEntityStats.setFailedRecords(entities.getData().size());
        updateStats(entityType, failedEntityStats);

        // Immediately broadcast the error via WebSocket
        sendUpdates(jobExecutionContext, true); // Force update for errors
        LOG.error("Unexpected error during processing task for entity {}", entityType, e);
      } else {
        LOG.debug("Ignoring error during stop operation for entity {}", entityType);
      }
    } finally {
      if (!stopped) {
        sendUpdates(jobExecutionContext);
      }
    }
  }

  @NotNull
  private Source<?> createSource(String entityType) {
    List<String> fields = List.of("*");
    Source<?> source;

    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      PaginatedEntitiesSource paginatedSource =
          new PaginatedEntitiesSource(entityType, batchSize.get(), fields);
      if (!nullOrEmpty(jobData.getAfterCursor())) {
        paginatedSource.getCursor().set(jobData.getAfterCursor());
      }
      source = paginatedSource;
    } else {
      PaginatedEntityTimeSeriesSource paginatedSource =
          new PaginatedEntityTimeSeriesSource(entityType, batchSize.get(), fields);
      if (!nullOrEmpty(jobData.getAfterCursor())) {
        paginatedSource.getCursor().set(jobData.getAfterCursor());
      }
      source = paginatedSource;
    }

    return source;
  }

  private int getTotalLatchCount(Set<String> entities) {
    int totalCount = 0;
    for (String entityType : entities) {
      int totalEntityRecords = getTotalEntityRecords(entityType);
      int noOfThreads = calculateNumberOfThreads(totalEntityRecords);
      totalCount += noOfThreads;
    }
    return totalCount;
  }

  private int getTotalEntityRecords(String entityType) {
    return ((StepStats)
            searchIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType))
        .getTotalRecords();
  }

  private void processReadTask(
      JobExecutionContext jobExecutionContext, String entityType, Source<?> source, int offset) {
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
          processTask(task, jobExecutionContext);
        }
      }
    } catch (SearchIndexException e) {
      LOG.error("Error while reading source for entityType: {}", entityType, e);
      // Only update to ACTIVE_ERROR if not stopped
      if (!stopped) {
        updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      }
      jobData.setFailure(e.getIndexingError());
      int remainingRecords = getRemainingRecordsToProcess(entityType);
      if (remainingRecords - batchSize.get() <= 0) {
        updateStats(
            entityType, new StepStats().withSuccessRecords(0).withFailedRecords(remainingRecords));
      } else {
        updateStats(
            entityType, new StepStats().withSuccessRecords(0).withFailedRecords(batchSize.get()));
      }
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
        ((StepStats)
            searchIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType));
    return entityStats.getTotalRecords()
        - entityStats.getFailedRecords()
        - entityStats.getSuccessRecords();
  }

  private void applyAutoTuning() {
    try {
      ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();
      LOG.info("Auto-tune: Request compression enabled for {} bulk operations", searchType);
      LOG.info("Auto-tune: JSON payloads will be gzip compressed (~75% size reduction)");

      long totalEntities = searchIndexStats.get().getJobStats().getTotalRecords();
      SearchClusterMetrics clusterMetrics =
          SearchClusterMetrics.fetchClusterMetrics(searchRepository, totalEntities);
      clusterMetrics.logRecommendations();
      LOG.info("Applying auto-tuned parameters...");
      LOG.info(
          "Original - Batch Size: {}, Producer Threads: {}, Concurrent Requests: {}, Payload Size: {} MB",
          jobData.getBatchSize(),
          jobData.getProducerThreads(),
          jobData.getMaxConcurrentRequests(),
          jobData.getPayLoadSize() / (1024 * 1024));

      jobData.setBatchSize(clusterMetrics.getRecommendedBatchSize());
      jobData.setProducerThreads(clusterMetrics.getRecommendedProducerThreads());
      jobData.setMaxConcurrentRequests(clusterMetrics.getRecommendedConcurrentRequests());
      jobData.setPayLoadSize(clusterMetrics.getMaxPayloadSizeBytes());

      LOG.info(
          "Auto-tuned - Batch Size: {}, Producer Threads: {}, Concurrent Requests: {}, Payload Size: {} MB",
          jobData.getBatchSize(),
          jobData.getProducerThreads(),
          jobData.getMaxConcurrentRequests(),
          jobData.getPayLoadSize() / (1024 * 1024));

    } catch (Exception e) {
      LOG.warn("Auto-tuning failed, using original parameters: {}", e.getMessage());
      LOG.debug("Auto-tuning error details", e);
    }
  }

  static record IndexingTask<T>(
      String entityType, ResultList<T> entities, int currentEntityOffset) {
    public static final IndexingTask<?> POISON_PILL =
        new IndexingTask<>(null, new ResultList<>(), -1);
  }
}
