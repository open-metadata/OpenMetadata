package org.openmetadata.service.apps.bundles.searchIndex;

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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.ws.rs.core.Response;
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
  private final Object jobDataLock = new Object();
  private ExecutorService producerExecutor;
  private final ExecutorService jobExecutor = Executors.newCachedThreadPool();
  private BlockingQueue<Runnable> producerQueue = new LinkedBlockingQueue<>(100);
  private final AtomicReference<Stats> searchIndexStats = new AtomicReference<>();
  private final AtomicReference<Integer> batchSize = new AtomicReference<>(5);
  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    EventPublisherJob request =
        JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class)
            .withStats(new Stats());

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
      initializeJob(jobExecutionContext);
      String runType =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");
      if (!ON_DEMAND_JOB.equals(runType)) {
        jobData.setRecreateIndex(false);
      }

      reCreateIndexes(jobData.getEntities());
      performReindex(jobExecutionContext);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      handleJobFailure(ex);
    } catch (Exception ex) {
      handleJobFailure(ex);
    } finally {
      sendUpdates(jobExecutionContext);
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
      logger.error("Failed in marking stale entries as stopped.", ex);
    }
  }

  private void initializeJob(JobExecutionContext jobExecutionContext) {
    cleanUpStaleJobsFromRuns();

    LOG.info("Executing Reindexing Job with JobData: {}", jobData);
    logger.info(String.format("Executing Reindexing Job with JobData: %s", jobData));
    batchSize.set(jobData.getBatchSize());
    jobData.setStatus(EventPublisherJob.Status.RUNNING);

    LOG.debug("Initializing job statistics.");
    searchIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(searchIndexStats.get());
    sendUpdates(jobExecutionContext);

    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();
    LOG.info("Initializing searchIndexSink with search type: {}", searchType);

    if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.searchIndexSink =
          new OpenSearchIndexSink(
              searchRepository.getSearchClient(),
              jobData.getPayLoadSize(),
              jobData.getMaxConcurrentRequests(),
              jobData.getMaxRetries(),
              jobData.getInitialBackoff(),
              jobData.getMaxBackoff());
      LOG.info("Initialized OpenSearchIndexSink.");
    } else {
      this.searchIndexSink =
          new ElasticSearchIndexSink(
              searchRepository.getSearchClient(),
              jobData.getPayLoadSize(),
              jobData.getMaxConcurrentRequests(),
              jobData.getMaxRetries(),
              jobData.getInitialBackoff(),
              jobData.getMaxBackoff());
      LOG.info("Initialized ElasticSearchIndexSink.");
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
      WebSocketManager.getInstance()
          .broadCastMessageToAll(
              SEARCH_INDEX_JOB_BROADCAST_CHANNEL, JsonUtils.pojoToJson(appRecord));
      LOG.debug("Broad-casted job updates via WebSocket.");
    }

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    LOG.debug("Updated AppRunRecord in DB: {}", appRecord);
  }

  private void performReindex(JobExecutionContext jobExecutionContext) throws InterruptedException {
    int numProducers = jobData.getProducerThreads();
    int numConsumers = jobData.getConsumerThreads();
    LOG.info("Starting reindexing with {} producers and {} consumers.", numProducers, numConsumers);

    producerQueue = new LinkedBlockingQueue<>(jobData.getQueueSize());
    producerExecutor =
        new ThreadPoolExecutor(
            numProducers,
            numProducers,
            0L,
            TimeUnit.MILLISECONDS,
            producerQueue,
            new ThreadPoolExecutor.CallerRunsPolicy());

    try {
      processEntityReindex(jobExecutionContext);
    } catch (Exception e) {
      LOG.error("Error during reindexing process.", e);
      throw e;
    } finally {
      shutdownExecutor(jobExecutor, "JobExecutor", 20, TimeUnit.SECONDS);
      shutdownExecutor(producerExecutor, "ReaderExecutor", 1, TimeUnit.MINUTES);
    }
  }

  private void processEntityReindex(JobExecutionContext jobExecutionContext)
      throws InterruptedException {
    int latchCount = getTotalLatchCount(jobData.getEntities());
    CountDownLatch producerLatch = new CountDownLatch(latchCount);
    submitProducerTask(jobExecutionContext, producerLatch);
    producerLatch.await();
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
              Semaphore semaphore = new Semaphore(jobData.getQueueSize());
              if (totalEntityRecords > 0) {
                for (int i = 0; i < loadPerThread; i++) {
                  semaphore.acquire();
                  LOG.debug(
                      "Submitting producer task current queue size: {}", producerQueue.size());
                  int currentOffset = i * batchSize.get();
                  producerExecutor.submit(
                      () -> {
                        try {
                          LOG.debug(
                              "Running Task for CurrentOffset: {},  Producer Latch Down, Current : {}",
                              currentOffset,
                              producerLatch.getCount());
                          processReadTask(jobExecutionContext, entityType, source, currentOffset);
                        } catch (Exception e) {
                          LOG.error("Error processing entity type {}", entityType, e);
                        } finally {
                          LOG.debug(
                              "Producer Latch Down and Semaphore Release, Current : {}",
                              producerLatch.getCount());
                          producerLatch.countDown();
                          semaphore.release();
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

  private void handleJobFailure(Exception ex) {
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(
                String.format(
                    "Reindexing Job Has Encountered an Exception.%nJob Data: %s,%nStack: %s",
                    jobData.toString(), ExceptionUtils.getStackTrace(ex)));
    LOG.error(indexingError.getMessage(), ex);
    jobData.setStatus(EventPublisherJob.Status.FAILED);
    jobData.setFailure(indexingError);
  }

  public synchronized void updateStats(String entityType, StepStats currentEntityStats) {
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

  public synchronized Stats initializeTotalRecords(Set<String> entities) {
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
      if (!TIME_SERIES_ENTITIES.contains(entityType)) {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
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
    try {
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
        IndexMapping indexType = searchRepository.getIndexMapping(entityType);
        searchRepository.deleteIndex(indexType);
        searchRepository.createIndex(indexType);
        LOG.info("Recreated index for entityType '{}'.", entityType);
      } catch (Exception e) {
        LOG.error("Failed to recreate index for entityType '{}'.", entityType, e);
        throw new SearchIndexException(e);
      }
    }
  }

  @SuppressWarnings("unused")
  @Override
  public void stop() {
    LOG.info("Stopping reindexing job.");
    stopped = true;
    jobData.setStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
    sendUpdates(jobExecutionContext);
    shutdownExecutor(jobExecutor, "JobExecutor", 60, TimeUnit.SECONDS);
    shutdownExecutor(producerExecutor, "ProducerExecutor", 60, TimeUnit.SECONDS);
    LOG.info("Stopped reindexing job.");
    jobData.setStatus(EventPublisherJob.Status.STOPPED);
    sendUpdates(jobExecutionContext);
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

      // After successful write, create a new StepStats for the current batch
      StepStats currentEntityStats = new StepStats();
      currentEntityStats.setSuccessRecords(entities.getData().size());
      currentEntityStats.setFailedRecords(entities.getErrors().size());
      // Do NOT set Total Records here

      // Update statistics in a thread-safe manner
      synchronized (jobDataLock) {
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
        }
        updateStats(entityType, currentEntityStats);
      }

    } catch (Exception e) {
      synchronized (jobDataLock) {
        jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
        jobData.setFailure(
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.JOB)
                .withMessage(e.getMessage()));

        StepStats failedEntityStats = new StepStats();
        failedEntityStats.setSuccessRecords(0);
        failedEntityStats.setFailedRecords(entities.getData().size());
        updateStats(entityType, failedEntityStats);
      }
      LOG.error("Unexpected error during processing task for entity {}", entityType, e);
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
    return searchIndexStats
        .get()
        .getEntityStats()
        .getAdditionalProperties()
        .get(entityType)
        .getTotalRecords();
  }

  private void processReadTask(
      JobExecutionContext jobExecutionContext, String entityType, Source<?> source, int offset) {
    try {
      Object resultList = source.readWithCursor(RestUtil.encodeCursor(String.valueOf(offset)));
      LOG.debug("Read Entities with entityType: {},  CurrentOffset: {}", entityType, offset);
      if (resultList != null) {
        ResultList<?> entities = extractEntities(entityType, resultList);
        if (!nullOrEmpty(entities.getData())) {
          IndexingTask<?> task = new IndexingTask<>(entityType, entities, offset);
          processTask(task, jobExecutionContext);
        }
      }
    } catch (SearchIndexException e) {
      LOG.error("Error while reading source for entityType: {}", entityType, e);
      synchronized (jobDataLock) {
        jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
        jobData.setFailure(e.getIndexingError());
        int remainingRecords = getRemainingRecordsToProcess(entityType);
        if (remainingRecords - batchSize.get() <= 0) {
          updateStats(
              entityType,
              new StepStats().withSuccessRecords(0).withFailedRecords(remainingRecords));
        } else {
          updateStats(
              entityType, new StepStats().withSuccessRecords(0).withFailedRecords(batchSize.get()));
        }
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
        searchIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType);
    return entityStats.getTotalRecords()
        - entityStats.getFailedRecords()
        - entityStats.getSuccessRecords();
  }

  private record IndexingTask<T>(
      String entityType, ResultList<T> entities, int currentEntityOffset) {
    public static final IndexingTask<?> POISON_PILL =
        new IndexingTask<>(null, new ResultList<>(), -1);
  }
}
