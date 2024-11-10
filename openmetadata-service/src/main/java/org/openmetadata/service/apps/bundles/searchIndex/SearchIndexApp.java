package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.io.Closeable;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
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
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.quartz.JobExecutionContext;

@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {

  private static final String ALL = "all";
  private static final Set<String> ALL_ENTITIES =
      Set.of(
          "table",
          "dashboard",
          "topic",
          "pipeline",
          "ingestionPipeline",
          "searchIndex",
          "user",
          "team",
          "glossary",
          "glossaryTerm",
          "mlmodel",
          "tag",
          "classification",
          "query",
          "container",
          "database",
          "databaseSchema",
          "testCase",
          "testSuite",
          "chart",
          "dashboardDataModel",
          "databaseService",
          "messagingService",
          "dashboardService",
          "pipelineService",
          "mlmodelService",
          "searchService",
          "entityReportData",
          "webAnalyticEntityViewReportData",
          "webAnalyticUserActivityReportData",
          "domain",
          "storedProcedure",
          "storageService",
          "testCaseResolutionStatus",
          "testCaseResult",
          "apiService",
          "apiEndpoint",
          "apiCollection",
          "metric");
  public static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT);

  private BulkSink searchIndexSink;

  @Getter private EventPublisherJob jobData;
  private final Object jobDataLock = new Object();
  private volatile boolean stopped = false;

  private ExecutorService producerExecutor;
  private ExecutorService consumerExecutor;
  private final BlockingQueue<IndexingTask> taskQueue = new LinkedBlockingQueue<>();

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    EventPublisherJob request =
        JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class)
            .withStats(new Stats());
    if (request.getEntities().contains(ALL)) {
      request.setEntities(ALL_ENTITIES);
    }
    jobData = request;
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    try {
      initializeJob();
      LOG.info("Executing Reindexing Job with JobData : {}", jobData);
      jobData.setStatus(EventPublisherJob.Status.RUNNING);
      String runType =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");
      if (!ON_DEMAND_JOB.equals(runType)) {
        jobData.setRecreateIndex(false);
      }
      performReindex(jobExecutionContext);
      sendUpdates(jobExecutionContext);
    } catch (Exception ex) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage(
                  String.format(
                      "Reindexing Job Has Encountered an Exception.%nJob Data: %s,%nStack: %s",
                      jobData.toString(), ExceptionUtils.getStackTrace(ex)));
      LOG.error(indexingError.getMessage());
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(indexingError);
    } finally {
      sendUpdates(jobExecutionContext);
    }
  }

  private void cleanUpStaleJobsFromRuns() {
    try {
      collectionDAO
          .appExtensionTimeSeriesDao()
          .markStaleEntriesStopped(getApp().getId().toString());
    } catch (Exception ex) {
      LOG.error("Failed in Marking Stale Entries Stopped.", ex);
    }
  }

  private void initializeJob() {
    cleanUpStaleJobsFromRuns();
    this.jobData.setStats(initializeTotalRecords(jobData.getEntities(), collectionDAO));

    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.searchIndexSink =
          new OpenSearchIndexSink(
              searchRepository.getSearchClient(), jobData.getPayLoadSize(), 100, 5, 1000, 10000);
    } else {
      this.searchIndexSink =
          new ElasticSearchIndexSink(
              searchRepository.getSearchClient(), jobData.getPayLoadSize(), 100, 5, 1000, 10000);
    }
  }

  public void updateRecordToDb(JobExecutionContext jobExecutionContext) {
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

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
  }

  private void performReindex(JobExecutionContext jobExecutionContext) throws InterruptedException {
    if (jobData.getStats() == null) {
      jobData.setStats(new Stats());
    }

    int numProducers = jobData.getEntities().size();
    this.producerExecutor = Executors.newFixedThreadPool(numProducers);
    int numConsumers = Math.min(Runtime.getRuntime().availableProcessors(), 10);
    this.consumerExecutor = Executors.newFixedThreadPool(numConsumers);
    CountDownLatch producerLatch = new CountDownLatch(numProducers);

    for (String entityType : jobData.getEntities()) {
      producerExecutor.submit(
          () -> {
            try {
              reCreateIndexes(entityType);
              processEntityType(entityType);
            } catch (Exception e) {
              LOG.error("Error processing entity type {}", entityType, e);
            } finally {
              producerLatch.countDown();
            }
          });
    }

    for (int i = 0; i < numConsumers; i++) {
      consumerExecutor.submit(
          () -> {
            try {
              while (true) {
                IndexingTask<?> task = taskQueue.take();
                if (task == IndexingTask.POISON_PILL) {
                  break;
                }
                processTask(task, jobExecutionContext);
              }
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            }
          });
    }
    producerLatch.await();
    for (int i = 0; i < numConsumers; i++) {
      taskQueue.put(IndexingTask.POISON_PILL);
    }
    producerExecutor.shutdown();
    try {
      if (!producerExecutor.awaitTermination(1, TimeUnit.HOURS)) {
        producerExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      producerExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }

    consumerExecutor.shutdown();
    try {
      if (!consumerExecutor.awaitTermination(20, TimeUnit.SECONDS)) {
        consumerExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      consumerExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }

    if (searchIndexSink instanceof Closeable) {
      try {
        ((Closeable) searchIndexSink).close();
      } catch (IOException e) {
        LOG.error("Failed to close search index sink.", e);
      }
    }
  }

  private void processEntityType(String entityType)
      throws InterruptedException, SearchIndexException {
    Source source = getSource(entityType);
    while (!source.isDone() && !stopped) {
      Object resultList = source.readNext(null);
      if (resultList == null) {
        break;
      }

      if (!TIME_SERIES_ENTITIES.contains(entityType)) {
        List<? extends EntityInterface> entities =
            ((ResultList<? extends EntityInterface>) resultList).getData();
        if (entities != null && !entities.isEmpty()) {
          IndexingTask<? extends EntityInterface> task = new IndexingTask<>(entityType, entities);
          taskQueue.put(task);
        }
      } else {
        List<? extends EntityTimeSeriesInterface> entities =
            ((ResultList<? extends EntityTimeSeriesInterface>) resultList).getData();
        if (entities != null && !entities.isEmpty()) {
          IndexingTask<? extends EntityTimeSeriesInterface> task =
              new IndexingTask<>(entityType, entities);
          taskQueue.put(task);
        }
      }
    }
  }

  @NotNull
  private Source getSource(String entityType) {
    List<String> fields = List.of("*");
    Source source;
    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      PaginatedEntitiesSource paginatedSource =
          new PaginatedEntitiesSource(entityType, jobData.getBatchSize(), fields);
      if (!CommonUtil.nullOrEmpty(jobData.getAfterCursor())) {
        paginatedSource.setCursor(jobData.getAfterCursor());
      }
      source = paginatedSource;
    } else {
      PaginatedEntityTimeSeriesSource paginatedSource =
          new PaginatedEntityTimeSeriesSource(entityType, jobData.getBatchSize(), fields);
      if (!CommonUtil.nullOrEmpty(jobData.getAfterCursor())) {
        paginatedSource.setCursor(jobData.getAfterCursor());
      }
      source = paginatedSource;
    }
    return source;
  }

  private void processTask(IndexingTask task, JobExecutionContext jobExecutionContext) {
    String entityType = task.getEntityType();
    List<?> entities = task.getEntities();
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, entityType);

    try {
      if (!TIME_SERIES_ENTITIES.contains(entityType)) {
        @SuppressWarnings("unchecked")
        List<EntityInterface> entityList = (List<EntityInterface>) entities;
        searchIndexSink.write(entityList, contextData);
      } else {
        @SuppressWarnings("unchecked")
        List<EntityTimeSeriesInterface> entityList = (List<EntityTimeSeriesInterface>) entities;
        searchIndexSink.write(entityList, contextData);
      }

      // After successful write, create a new StepStats for the current batch
      StepStats currentEntityStats = new StepStats();
      currentEntityStats.setSuccessRecords(entities.size());
      currentEntityStats.setFailedRecords(0);
      // Do NOT set Total Records here

      // Update statistics in a thread-safe manner
      synchronized (jobDataLock) {
        updateStats(entityType, currentEntityStats);
      }

      sendUpdates(jobExecutionContext);
    } catch (Exception e) {
      synchronized (jobDataLock) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        jobData.setFailure(
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.JOB)
                .withMessage(e.getMessage()));

        StepStats failedEntityStats = new StepStats();
        failedEntityStats.setSuccessRecords(0);
        failedEntityStats.setFailedRecords(entities.size());
        updateStats(entityType, failedEntityStats);
      }

      sendUpdates(jobExecutionContext);
      LOG.error("Unexpected error during processing task for entity {}", entityType, e);
    }
  }

  public synchronized void updateStats(String entityType, StepStats currentEntityStats) {
    Stats jobDataStats = jobData.getStats();
    if (jobDataStats.getEntityStats() == null) {
      jobDataStats.setEntityStats(new StepStats());
      LOG.debug("Initialized entityStats map.");
    }

    StepStats existingEntityStats =
        (StepStats) jobDataStats.getEntityStats().getAdditionalProperties().get(entityType);
    if (existingEntityStats == null) {
      jobDataStats.getEntityStats().getAdditionalProperties().put(entityType, currentEntityStats);
      LOG.debug("Initialized StepStats for entityType '{}': {}", entityType, currentEntityStats);
    } else {
      existingEntityStats.setSuccessRecords(
          existingEntityStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
      existingEntityStats.setFailedRecords(
          existingEntityStats.getFailedRecords() + currentEntityStats.getFailedRecords());
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
      LOG.debug("Initialized jobStats.");
    }

    jobStats.setSuccessRecords(
        jobStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
    jobStats.setFailedRecords(jobStats.getFailedRecords() + currentEntityStats.getFailedRecords());
    LOG.debug(
        "Updated jobStats: Success - {}, Failed - {}",
        jobStats.getSuccessRecords(),
        jobStats.getFailedRecords());
    jobData.setStats(jobDataStats);
  }

  public Stats initializeTotalRecords(Set<String> entities, CollectionDAO dao) {
    synchronized (jobDataLock) {
      Stats jobDataStats = jobData.getStats();
      int total = 0;
      if (jobDataStats.getEntityStats() == null) {
        jobDataStats.setEntityStats(new StepStats());
        LOG.debug("Initialized entityStats map.");
      }

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
      }
      jobStats.setTotalRecords(total);
      LOG.debug("Set job-level Total Records: {}", jobStats.getTotalRecords());
      jobData.setStats(jobDataStats);
      return jobDataStats;
    }
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
      updateRecordToDb(jobExecutionContext);
      if (WebSocketManager.getInstance() != null) {
        WebSocketManager.getInstance()
            .broadCastMessageToAll(
                WebSocketManager.JOB_STATUS_BROADCAST_CHANNEL, JsonUtils.pojoToJson(jobData));
      }
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }

  private void reCreateIndexes(String entityType) {
    if (Boolean.FALSE.equals(jobData.getRecreateIndex())) {
      return;
    }

    IndexMapping indexType = searchRepository.getIndexMapping(entityType);
    searchRepository.deleteIndex(indexType);
    searchRepository.createIndex(indexType);
  }

  public void stopJob() {
    LOG.info("Stopping reindexing job.");
    stopped = true;

    if (producerExecutor != null && !producerExecutor.isShutdown()) {
      producerExecutor.shutdownNow();
      try {
        if (!producerExecutor.awaitTermination(60, TimeUnit.SECONDS)) {
          LOG.warn("ProducerExecutor did not terminate within the specified timeout.");
        }
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for ProducerExecutor to terminate.", e);
        producerExecutor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }

    if (consumerExecutor != null && !consumerExecutor.isShutdown()) {
      consumerExecutor.shutdownNow();
      try {
        if (!consumerExecutor.awaitTermination(60, TimeUnit.SECONDS)) {
          LOG.warn("ConsumerExecutor did not terminate within the specified timeout.");
        }
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for ConsumerExecutor to terminate.", e);
        consumerExecutor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }
  }

  @Getter
  private static class IndexingTask<T> {
    private final String entityType;
    private final List<T> entities;
    public static final IndexingTask<?> POISON_PILL = new IndexingTask<>(null, null);

    public IndexingTask(String entityType, List<T> entities) {
      this.entityType = entityType;
      this.entities = entities;
    }
  }
}
