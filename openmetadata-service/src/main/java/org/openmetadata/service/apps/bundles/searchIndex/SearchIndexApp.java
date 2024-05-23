package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
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
          "testCaseResolutionStatus");
  public static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          "testCaseResolutionStatus");
  private final List<Source> paginatedSources = new ArrayList<>();
  private Processor entityProcessor;
  private Processor entityTimeSeriesProcessor;
  private Sink searchIndexSink;

  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;

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
      // Update Job Status
      jobData.setStatus(EventPublisherJob.Status.RUNNING);

      // Make recreate as false for onDemand
      String runType =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");

      // Schedule Run has re-create set to false
      if (!runType.equals(ON_DEMAND_JOB)) {
        jobData.setRecreateIndex(false);
      }

      // Run ReIndexing
      performReindex(jobExecutionContext);
      // Mark Job as Completed
      updateJobStatus();
    } catch (Exception ex) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage(
                  String.format(
                      "Reindexing Job Has Encountered an Exception. %n Job Data: %s, %n  Stack : %s ",
                      jobData.toString(), ExceptionUtils.getStackTrace(ex)));
      LOG.error(indexingError.getMessage());
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(indexingError);
    } finally {
      // Send update
      sendUpdates(jobExecutionContext);
    }
  }

  private void initializeJob() {
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
                paginatedSources.add(source);
              }
            });
    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new OpenSearchEntitiesProcessor(totalRecords);
      this.entityTimeSeriesProcessor = new OpenSearchEntityTimeSeriesProcessor(totalRecords);
      this.searchIndexSink = new OpenSearchIndexSink(searchRepository, totalRecords);
    } else {
      this.entityProcessor = new ElasticSearchEntitiesProcessor(totalRecords);
      this.entityTimeSeriesProcessor = new ElasticSearchEntityTimeSeriesProcessor(totalRecords);
      this.searchIndexSink = new ElasticSearchIndexSink(searchRepository, totalRecords);
    }
  }

  public void updateRecordToDb(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);

    // Update Run Record with Status
    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));

    // Update Error
    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }

    // Update Stats
    if (jobData.getStats() != null) {
      appRecord.setSuccessContext(
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats()));
    }

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
  }

  private void performReindex(JobExecutionContext jobExecutionContext) throws SearchIndexException {
    Map<String, Object> contextData = new HashMap<>();
    for (Source paginatedSource : paginatedSources) {
      List<String> entityName = new ArrayList<>();
      reCreateIndexes(paginatedSource.getEntityType());
      contextData.put(ENTITY_TYPE_KEY, paginatedSource.getEntityType());
      Object resultList;
      while (!stopped && !paginatedSource.isDone()) {
        try {
          resultList = paginatedSource.readNext(null);
          if (!TIME_SERIES_ENTITIES.contains(paginatedSource.getEntityType())) {
            entityName =
                getEntityNameFromEntity(
                    (ResultList<? extends EntityInterface>) resultList,
                    paginatedSource.getEntityType());
            contextData.put(ENTITY_NAME_LIST_KEY, entityName);
            processEntity(
                (ResultList<? extends EntityInterface>) resultList, contextData, paginatedSource);
          } else {
            entityName =
                getEntityNameFromEntityTimeSeries(
                    (ResultList<? extends EntityTimeSeriesInterface>) resultList,
                    paginatedSource.getEntityType());
            contextData.put(ENTITY_NAME_LIST_KEY, entityName);
            processEntityTimeSeries(
                (ResultList<? extends EntityTimeSeriesInterface>) resultList,
                contextData,
                paginatedSource);
          }

        } catch (SearchIndexException rx) {
          jobData.setStatus(EventPublisherJob.Status.FAILED);
          jobData.setFailure(rx.getIndexingError());
          paginatedSource.updateStats(
              rx.getIndexingError().getSuccessCount(), rx.getIndexingError().getFailedCount());
        } finally {
          updateStats(paginatedSource.getEntityType(), paginatedSource.getStats());
          sendUpdates(jobExecutionContext);
        }
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
      // store job details in Database
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      // Update Record to db
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
    // Job Level Stats
    Stats jobDataStats = jobData.getStats();

    // Update Entity Level Stats
    StepStats entityLevelStats = jobDataStats.getEntityStats();
    if (entityLevelStats == null) {
      entityLevelStats =
          new StepStats().withTotalRecords(null).withFailedRecords(null).withSuccessRecords(null);
    }
    entityLevelStats.withAdditionalProperty(entityType, currentEntityStats);

    // Total Stats
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

    // Update for the Job
    jobDataStats.setJobStats(stats);
    jobDataStats.setEntityStats(entityLevelStats);

    jobData.setStats(jobDataStats);
  }

  private void reCreateIndexes(String entityType) {
    if (Boolean.FALSE.equals(jobData.getRecreateIndex())) {
      return;
    }

    IndexMapping indexType = searchRepository.getIndexMapping(entityType);
    // Delete index
    searchRepository.deleteIndex(indexType);
    // Create index
    searchRepository.createIndex(indexType);
  }

  private void updateJobStatus() {
    if (stopped) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    } else {
      if (jobData.getFailure() != null) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
      } else {
        jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      }
    }
  }

  public void stopJob() {
    stopped = true;
  }
}
