package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_NAME_LIST_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
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
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchEntitiesProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchEntityTimeSeriesProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.search.opensearch.OpenSearchEntitiesProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchEntityTimeSeriesProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.quartz.JobExecutionContext;

@Slf4j
@SuppressWarnings("unused")
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
  private final List<Source> paginatedSources = new ArrayList<>();
  private Processor entityProcessor;
  private Processor entityTimeSeriesProcessor;
  private Sink searchIndexSink;

  @Getter EventPublisherJob jobData;
  private final Object jobDataLock = new Object(); // Dedicated final lock object
  private volatile boolean stopped = false;
  @Getter private volatile ExecutorService executorService;

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    // request for reindexing
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
      if (!runType.equals(ON_DEMAND_JOB)) {
        jobData.setRecreateIndex(false);
      }
      performReindex(jobExecutionContext);
    } catch (Exception ex) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage(
                  String.format(
                      "Reindexing Job Has Encountered an Exception. %n Job Data: %s, %n  Stack : %s ",
                      jobData.toString(), ExceptionUtils.getStackTrace(ex)));
      LOG.error(indexingError.getMessage());
      jobData.setStatus(EventPublisherJob.Status.RUNNING);
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
      LOG.error("Failed in Marking Stale Entries Stopped.");
    }
  }

  private void initializeJob() {
    List<Source> paginatedEntityTimeSeriesSources = new ArrayList<>();
    cleanUpStaleJobsFromRuns();

    int totalRecords = getTotalRequestToProcess(jobData.getEntities(), collectionDAO);
    this.jobData.setStats(
        new Stats()
            .withJobStats(
                new StepStats()
                    .withTotalRecords(totalRecords)
                    .withFailedRecords(0)
                    .withSuccessRecords(0)));
    jobData
        .getEntities()
        .forEach(
            entityType -> {
              if (!TIME_SERIES_ENTITIES.contains(entityType)) {
                List<String> fields = List.of("*");
                PaginatedEntitiesSource source =
                    new PaginatedEntitiesSource(entityType, jobData.getBatchSize(), fields);
                if (!CommonUtil.nullOrEmpty(jobData.getAfterCursor())) {
                  source.setCursor(jobData.getAfterCursor());
                }
                paginatedSources.add(source);
              } else {
                PaginatedEntityTimeSeriesSource source =
                    new PaginatedEntityTimeSeriesSource(
                        entityType, jobData.getBatchSize(), List.of("*"));
                if (!CommonUtil.nullOrEmpty(jobData.getAfterCursor())) {
                  source.setCursor(jobData.getAfterCursor());
                }
                paginatedEntityTimeSeriesSources.add(source);
              }
            });

    paginatedSources.addAll(paginatedEntityTimeSeriesSources);
    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new OpenSearchEntitiesProcessor(totalRecords);
      this.entityTimeSeriesProcessor = new OpenSearchEntityTimeSeriesProcessor(totalRecords);
      this.searchIndexSink =
          new OpenSearchIndexSink(searchRepository, totalRecords, jobData.getPayLoadSize());
    } else {
      this.entityProcessor = new ElasticSearchEntitiesProcessor(totalRecords);
      this.entityTimeSeriesProcessor = new ElasticSearchEntityTimeSeriesProcessor(totalRecords);
      this.searchIndexSink =
          new ElasticSearchIndexSink(searchRepository, totalRecords, jobData.getPayLoadSize());
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

  private void performReindex(JobExecutionContext jobExecutionContext) {
    if (jobData.getStats() == null) {
      jobData.setStats(new Stats());
    }

    if (executorService == null || executorService.isShutdown() || executorService.isTerminated()) {
      this.executorService = Executors.newFixedThreadPool(searchRepository.getNumThreads());
      LOG.debug("Initialized new ExecutorService with {} threads.", searchRepository.getNumThreads());
    }
    List<Future<?>> futures = new ArrayList<>();

    for (Source paginatedSource : paginatedSources) {
      Future<?> future =
          executorService.submit(
              () -> {
                String entityType = paginatedSource.getEntityType();
                Map<String, Object> contextData = new HashMap<>();
                contextData.put(ENTITY_TYPE_KEY, entityType);
                try {
                  reCreateIndexes(entityType);
                  contextData.put(ENTITY_TYPE_KEY, entityType);

                  while (!paginatedSource.isDone()) {
                    Object resultList = paginatedSource.readNext(null);
                    if (resultList == null) {
                      break;
                    }

                    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
                      List<String> entityNames =
                          getEntityNameFromEntity(
                              (ResultList<? extends EntityInterface>) resultList, entityType);
                      contextData.put(ENTITY_NAME_LIST_KEY, entityNames);
                      processEntity(
                          (ResultList<? extends EntityInterface>) resultList,
                          contextData,
                          paginatedSource);
                    } else {
                      List<String> entityNames =
                          getEntityNameFromEntityTimeSeries(
                              (ResultList<? extends EntityTimeSeriesInterface>) resultList,
                              entityType);
                      contextData.put(ENTITY_NAME_LIST_KEY, entityNames);
                      processEntityTimeSeries(
                          (ResultList<? extends EntityTimeSeriesInterface>) resultList,
                          contextData,
                          paginatedSource);
                    }
                    synchronized (jobDataLock) {
                      updateStats(entityType, paginatedSource.getStats());
                    }
                    sendUpdates(jobExecutionContext);
                  }

                } catch (SearchIndexException e) {
                  synchronized (jobDataLock) {
                    jobData.setStatus(EventPublisherJob.Status.RUNNING);
                    jobData.setFailure(e.getIndexingError());
                    paginatedSource.updateStats(
                        e.getIndexingError().getSuccessCount(),
                        e.getIndexingError().getFailedCount());
                    updateStats(entityType, paginatedSource.getStats());
                  }
                  sendUpdates(jobExecutionContext);
                } catch (Exception e) {
                  synchronized (jobDataLock) {
                    jobData.setStatus(EventPublisherJob.Status.FAILED);
                    jobData.setFailure(
                        new IndexingError()
                            .withErrorSource(IndexingError.ErrorSource.JOB)
                            .withMessage(e.getMessage()));
                  }
                  sendUpdates(jobExecutionContext);
                  LOG.error("Unexpected error during reindexing for entity {}", entityType, e);
                }
              });

      futures.add(future);
    }

    executorService.shutdown();

    try {
      boolean allTasksCompleted = executorService.awaitTermination(1, TimeUnit.HOURS);
      if (!allTasksCompleted) {
        LOG.warn("Reindexing tasks did not complete within the expected time.");
        executorService.shutdownNow();
      }
    } catch (InterruptedException e) {
      LOG.error("Reindexing was interrupted", e);
      executorService.shutdownNow();
      Thread.currentThread().interrupt();
    }

    for (Future<?> future : futures) {
      try {
        future.get();
      } catch (InterruptedException e) {
        LOG.error("Task was interrupted", e);
        Thread.currentThread().interrupt();
      } catch (ExecutionException e) {
        LOG.error("Exception in reindexing task", e.getCause());
      }
    }
  }

  private List<String> getEntityNameFromEntity(
      ResultList<? extends EntityInterface> resultList, String entityType) {
    return resultList.getData().stream()
        .map(entity -> String.format("%s %s", entityType, entity.getId()))
        .toList();
  }

  private List<String> getEntityNameFromEntityTimeSeries(
      ResultList<? extends EntityTimeSeriesInterface> resultList, String entityType) {
    return resultList.getData().stream()
        .map(entity -> String.format("%s %s", entityType, entity.getId()))
        .toList();
  }

  private void processEntity(
      ResultList<? extends EntityInterface> resultList,
      Map<String, Object> contextData,
      Source paginatedSource)
      throws SearchIndexException {
    if (!resultList.getData().isEmpty()) {
      searchIndexSink.write(entityProcessor.process(resultList, contextData), contextData);
      if (!resultList.getErrors().isEmpty()) {
        throw new SearchIndexException(
            new IndexingError()
                .withErrorSource(READER)
                .withLastFailedCursor(paginatedSource.getLastFailedCursor())
                .withSubmittedCount(paginatedSource.getBatchSize())
                .withSuccessCount(resultList.getData().size())
                .withFailedCount(resultList.getErrors().size())
                .withMessage(
                    "Issues in Reading A Batch For Entities. Check Errors Corresponding to Entities.")
                .withFailedEntities(resultList.getErrors()));
      }
      paginatedSource.updateStats(resultList.getData().size(), 0);
    }
  }

  private void processEntityTimeSeries(
      ResultList<? extends EntityTimeSeriesInterface> resultList,
      Map<String, Object> contextData,
      Source paginatedSource)
      throws SearchIndexException {
    if (!resultList.getData().isEmpty()) {
      searchIndexSink.write(
          entityTimeSeriesProcessor.process(resultList, contextData), contextData);
      if (!resultList.getErrors().isEmpty()) {
        throw new SearchIndexException(
            new IndexingError()
                .withErrorSource(READER)
                .withLastFailedCursor(paginatedSource.getLastFailedCursor())
                .withSubmittedCount(paginatedSource.getBatchSize())
                .withSuccessCount(resultList.getData().size())
                .withFailedCount(resultList.getErrors().size())
                .withMessage(
                    "Issues in Reading A Batch For Entities. Check Errors Corresponding to Entities.")
                .withFailedEntities(resultList.getErrors()));
      }
      paginatedSource.updateStats(resultList.getData().size(), 0);
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

  public void updateStats(String entityType, StepStats currentEntityStats) {
    Stats jobDataStats = jobData.getStats();

    StepStats entityLevelStats = jobDataStats.getEntityStats();
    if (entityLevelStats == null) {
      entityLevelStats =
          new StepStats().withTotalRecords(null).withFailedRecords(null).withSuccessRecords(null);
    }
    entityLevelStats.withAdditionalProperty(entityType, currentEntityStats);

    StepStats stats = jobData.getStats().getJobStats();
    if (stats == null) {
      stats =
          new StepStats()
              .withTotalRecords(getTotalRequestToProcess(jobData.getEntities(), collectionDAO));
    }

    stats.setSuccessRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .map(s -> (StepStats) s)
            .mapToInt(StepStats::getSuccessRecords)
            .sum());
    stats.setFailedRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .map(s -> (StepStats) s)
            .mapToInt(StepStats::getFailedRecords)
            .sum());

    jobDataStats.setJobStats(stats);
    jobDataStats.setEntityStats(entityLevelStats);

    jobData.setStats(jobDataStats);
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
    if (executorService != null && !executorService.isShutdown()) {
      List<Runnable> awaitingTasks = executorService.shutdownNow();
      LOG.info(
          "ExecutorService has been shutdown. Awaiting termination. {} tasks were awaiting execution.",
          awaitingTasks.size());

      try {
        if (!executorService.awaitTermination(60, TimeUnit.SECONDS)) {
          LOG.warn("ExecutorService did not terminate within the specified timeout.");
        }
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for ExecutorService to terminate.", e);
        List<Runnable> stillAwaitingTasks = executorService.shutdownNow(); // Force shutdown
        LOG.info(
            "Forced shutdown initiated due to interruption. {} tasks were awaiting execution.",
            stillAwaitingTasks.size());
        Thread.currentThread().interrupt(); // Restore interrupt status
      }
    }
  }
}
