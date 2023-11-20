package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import es.org.elasticsearch.action.bulk.BulkItemResponse;
import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.ProcessorException;
import org.openmetadata.service.exception.SinkException;
import org.openmetadata.service.exception.SourceException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchDataInsightProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchEntitiesProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.search.opensearch.OpenSearchDataInsightProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchEntitiesProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.searchIndex.PaginatedDataInsightSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.quartz.JobExecutionContext;

@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {
  private static final String ENTITY_TYPE_ERROR_MSG = "EntityType: %s %n Cause: %s %n Stack: %s";
  private final List<PaginatedEntitiesSource> paginatedEntitiesSources = new ArrayList<>();
  private final List<PaginatedDataInsightSource> paginatedDataInsightSources = new ArrayList<>();
  private Processor entityProcessor;
  private Processor dataInsightProcessor;
  private Sink searchIndexSink;

  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;

  @Override
  public void init(App app, CollectionDAO dao, SearchRepository searchRepository) {
    super.init(app, dao, searchRepository);

    // request for reindexing
    EventPublisherJob request =
        JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class)
            .withStats(new Stats())
            .withFailure(new Failure());
    int totalRecords = getTotalRequestToProcess(request.getEntities(), collectionDAO);
    this.jobData = request;
    this.jobData.setStats(
        new Stats()
            .withJobStats(new StepStats().withTotalRecords(totalRecords).withFailedRecords(0).withSuccessRecords(0)));
    request
        .getEntities()
        .forEach(
            entityType -> {
              if (!isDataInsightIndex(entityType)) {
                List<String> fields = List.of("*");
                PaginatedEntitiesSource source =
                    new PaginatedEntitiesSource(entityType, jobData.getBatchSize(), fields);
                if (!CommonUtil.nullOrEmpty(request.getAfterCursor())) {
                  source.setCursor(request.getAfterCursor());
                }
                paginatedEntitiesSources.add(source);
              } else {
                paginatedDataInsightSources.add(
                    new PaginatedDataInsightSource(dao, entityType, jobData.getBatchSize()));
              }
            });
    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new OpenSearchEntitiesProcessor(totalRecords);
      this.dataInsightProcessor = new OpenSearchDataInsightProcessor(totalRecords);
      this.searchIndexSink = new OpenSearchIndexSink(searchRepository, totalRecords);
    } else {
      this.entityProcessor = new ElasticSearchEntitiesProcessor(totalRecords);
      this.dataInsightProcessor = new ElasticSearchDataInsightProcessor(totalRecords);
      this.searchIndexSink = new ElasticSearchIndexSink(searchRepository, totalRecords);
    }
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    try {
      LOG.info("Executing Reindexing Job with JobData : {}", jobData);
      // Update Job Status
      jobData.setStatus(EventPublisherJob.Status.RUNNING);
      // Run ReIndexing
      entitiesReIndex();
      dataInsightReindex();
      // Mark Job as Completed
      updateJobStatus();
    } catch (Exception ex) {
      String error =
          String.format(
              "Reindexing Job Has Encountered an Exception. %n Job Data: %s, %n  Stack : %s ",
              jobData.toString(), ExceptionUtils.getStackTrace(ex));
      LOG.error(error);
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      handleJobError("Failure in Job: Check Stack", error, System.currentTimeMillis());
    } finally {
      // store job details in Database
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      // Update Record to db
      updateRecordToDb(jobExecutionContext);
      // Send update
      sendUpdates();
    }
  }

  public void updateRecordToDb(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);

    // Update Run Record with Status
    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));

    // Update Error
    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", JsonUtils.pojoToJson(jobData.getFailure())));
    }

    // Update Stats
    if (jobData.getStats() != null) {
      appRecord.setSuccessContext(new SuccessContext().withAdditionalProperty("stats", jobData.getStats()));
    }

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
  }

  private void entitiesReIndex() {
    Map<String, Object> contextData = new HashMap<>();
    for (PaginatedEntitiesSource paginatedEntitiesSource : paginatedEntitiesSources) {
      reCreateIndexes(paginatedEntitiesSource.getEntityType());
      contextData.put(ENTITY_TYPE_KEY, paginatedEntitiesSource.getEntityType());
      ResultList<? extends EntityInterface> resultList;
      while (!stopped && !paginatedEntitiesSource.isDone()) {
        long currentTime = System.currentTimeMillis();
        try {
          resultList = paginatedEntitiesSource.readNext(null);
          if (!resultList.getData().isEmpty()) {
            if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
              // process data to build Reindex Request
              os.org.opensearch.action.bulk.BulkRequest requests =
                  (os.org.opensearch.action.bulk.BulkRequest) entityProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              os.org.opensearch.action.bulk.BulkResponse response =
                  (os.org.opensearch.action.bulk.BulkResponse) searchIndexSink.write(requests, contextData);
              // update Status
              handleErrorsOs(resultList, paginatedEntitiesSource.getLastFailedCursor(), response, currentTime);
            } else {
              // process data to build Reindex Request
              BulkRequest requests = (BulkRequest) entityProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              BulkResponse response = (BulkResponse) searchIndexSink.write(requests, contextData);
              // update Status
              handleErrorsEs(resultList, paginatedEntitiesSource.getLastFailedCursor(), response, currentTime);
            }
          }
        } catch (SourceException rx) {
          handleSourceError(
              rx.getMessage(),
              String.format(
                  ENTITY_TYPE_ERROR_MSG,
                  paginatedEntitiesSource.getEntityType(),
                  rx.getCause(),
                  ExceptionUtils.getStackTrace(rx)),
              currentTime);
        } catch (ProcessorException px) {
          handleProcessorError(
              px.getMessage(),
              String.format(
                  ENTITY_TYPE_ERROR_MSG,
                  paginatedEntitiesSource.getEntityType(),
                  px.getCause(),
                  ExceptionUtils.getStackTrace(px)),
              currentTime);
        } catch (SinkException wx) {
          handleEsSinkError(
              wx.getMessage(),
              String.format(
                  ENTITY_TYPE_ERROR_MSG,
                  paginatedEntitiesSource.getEntityType(),
                  wx.getCause(),
                  ExceptionUtils.getStackTrace(wx)),
              currentTime);
        }
      }
      updateStats(paginatedEntitiesSource.getEntityType(), paginatedEntitiesSource.getStats());
      sendUpdates();
    }
  }

  private void dataInsightReindex() {
    Map<String, Object> contextData = new HashMap<>();
    for (PaginatedDataInsightSource paginatedDataInsightSource : paginatedDataInsightSources) {
      reCreateIndexes(paginatedDataInsightSource.getEntityType());
      contextData.put(ENTITY_TYPE_KEY, paginatedDataInsightSource.getEntityType());
      ResultList<ReportData> resultList;
      while (!stopped && !paginatedDataInsightSource.isDone()) {
        long currentTime = System.currentTimeMillis();
        try {
          resultList = paginatedDataInsightSource.readNext(null);
          if (!resultList.getData().isEmpty()) {
            if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
              // process data to build Reindex Request
              os.org.opensearch.action.bulk.BulkRequest requests =
                  (os.org.opensearch.action.bulk.BulkRequest) dataInsightProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              os.org.opensearch.action.bulk.BulkResponse response =
                  (os.org.opensearch.action.bulk.BulkResponse) searchIndexSink.write(requests, contextData);
              handleErrorsOs(resultList, "", response, currentTime);
            } else {
              // process data to build Reindex Request
              BulkRequest requests = (BulkRequest) dataInsightProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              BulkResponse response = (BulkResponse) searchIndexSink.write(requests, contextData);
              handleErrorsEs(resultList, "", response, currentTime);
            }
          }
        } catch (SourceException rx) {
          handleSourceError(
              rx.getMessage(),
              String.format(
                  ENTITY_TYPE_ERROR_MSG,
                  paginatedDataInsightSource.getEntityType(),
                  rx.getCause(),
                  ExceptionUtils.getStackTrace(rx)),
              currentTime);
        } catch (ProcessorException px) {
          handleProcessorError(
              px.getMessage(),
              String.format(
                  ENTITY_TYPE_ERROR_MSG,
                  paginatedDataInsightSource.getEntityType(),
                  px.getCause(),
                  ExceptionUtils.getStackTrace(px)),
              currentTime);
        } catch (SinkException wx) {
          handleEsSinkError(
              wx.getMessage(),
              String.format(
                  ENTITY_TYPE_ERROR_MSG,
                  paginatedDataInsightSource.getEntityType(),
                  wx.getCause(),
                  ExceptionUtils.getStackTrace(wx)),
              currentTime);
        }
      }
      updateStats(paginatedDataInsightSource.getEntityType(), paginatedDataInsightSource.getStats());
      sendUpdates();
    }
  }

  private void sendUpdates() {
    try {
      WebSocketManager.getInstance()
          .broadCastMessageToAll(WebSocketManager.JOB_STATUS_BROADCAST_CHANNEL, JsonUtils.pojoToJson(jobData));
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
      entityLevelStats = new StepStats();
    }
    entityLevelStats.withAdditionalProperty(entityType, currentEntityStats);

    // Total Stats
    StepStats stats = jobData.getStats().getJobStats();
    if (stats == null) {
      stats = new StepStats().withTotalRecords(getTotalRequestToProcess(jobData.getEntities(), collectionDAO));
    }
    getUpdatedStats(stats, currentEntityStats.getSuccessRecords(), currentEntityStats.getFailedRecords());

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

  private void handleErrorsOs(
      ResultList<?> data, String lastCursor, os.org.opensearch.action.bulk.BulkResponse response, long time) {
    handleSourceError(data, lastCursor, time);
    handleOsSinkErrors(response, time);
  }

  private void handleErrorsEs(ResultList<?> data, String lastCursor, BulkResponse response, long time) {
    handleSourceError(data, lastCursor, time);
    handleEsSinkErrors(response, time);
  }

  private void handleSourceError(String context, String reason, long time) {
    handleError("source", context, reason, time);
  }

  private void handleProcessorError(String context, String reason, long time) {
    handleError("processor", context, reason, time);
  }

  private void handleError(String errType, String context, String reason, long time) {
    Failure failures = jobData.getFailure() != null ? jobData.getFailure() : new Failure();
    failures.withAdditionalProperty("errorFrom", errType);
    failures.withAdditionalProperty("context", context);
    failures.withAdditionalProperty("lastFailedReason", reason);
    failures.withAdditionalProperty("lastFailedAt", time);
    jobData.setFailure(failures);
  }

  private void handleEsSinkError(String context, String reason, long time) {
    handleError("sink", context, reason, time);
  }

  private void handleJobError(String context, String reason, long time) {
    handleError("job", context, reason, time);
  }

  @SneakyThrows
  private void handleSourceError(ResultList<?> data, String lastCursor, long time) {
    if (!data.getErrors().isEmpty()) {
      StringBuilder builder = new StringBuilder();
      for (String str : data.getErrors()) {
        builder.append(str);
        builder.append("%n");
      }
      handleSourceError(
          String.format("SourceContext: After Cursor : %s, Encountered Error While Reading Data.", lastCursor),
          String.format("Following Entities were not fetched Successfully : %s", builder),
          time);
    }
  }

  @SneakyThrows
  private void handleOsSinkErrors(os.org.opensearch.action.bulk.BulkResponse response, long time) {
    List<Map<String, Object>> details = new ArrayList<>();
    for (os.org.opensearch.action.bulk.BulkItemResponse bulkItemResponse : response) {
      if (bulkItemResponse.isFailed()) {
        Map<String, Object> detailsMap = new HashMap<>();
        os.org.opensearch.action.bulk.BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
        detailsMap.put(
            "context",
            String.format(
                "EsWriterContext: Encountered Error While Writing Data %n Entity %n ID : [%s] ", failure.getId()));
        detailsMap.put(
            "lastFailedReason",
            String.format(
                "Index Type: [%s], Reason: [%s] %n Trace : [%s]",
                failure.getIndex(), failure.getMessage(), ExceptionUtils.getStackTrace(failure.getCause())));
        detailsMap.put("lastFailedAt", System.currentTimeMillis());
        details.add(detailsMap);
      }
    }
    if (!details.isEmpty()) {
      handleEsSinkError(
          "[EsWriter] BulkResponseItems",
          String.format("[BulkItemResponse] Got Following Error Responses: %n %s ", JsonUtils.pojoToJson(details)),
          time);
    }
  }

  @SneakyThrows
  private void handleEsSinkErrors(BulkResponse response, long time) {

    List<Map<String, Object>> details = new ArrayList<>();
    for (BulkItemResponse bulkItemResponse : response) {
      if (bulkItemResponse.isFailed()) {
        Map<String, Object> detailsMap = new HashMap<>();
        BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
        detailsMap.put(
            "context",
            String.format(
                "EsWriterContext: Encountered Error While Writing Data %n Entity %n ID : [%s] ", failure.getId()));
        detailsMap.put(
            "lastFailedReason",
            String.format(
                "Index Type: [%s], Reason: [%s] %n Trace : [%s]",
                failure.getIndex(), failure.getMessage(), ExceptionUtils.getStackTrace(failure.getCause())));
        detailsMap.put("lastFailedAt", System.currentTimeMillis());
        details.add(detailsMap);
      }
    }
    if (!details.isEmpty()) {
      handleEsSinkError(
          "[EsWriter] BulkResponseItems",
          String.format("[BulkItemResponse] Got Following Error Responses: %n %s ", JsonUtils.pojoToJson(details)),
          time);
    }
  }

  private void updateJobStatus() {
    if (stopped) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    } else {
      if (jobData.getFailure() != null && !jobData.getFailure().getAdditionalProperties().isEmpty()) {
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
