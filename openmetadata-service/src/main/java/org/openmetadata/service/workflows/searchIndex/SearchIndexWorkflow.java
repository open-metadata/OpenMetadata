/*
 *  Copyright 2022 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.workflows.searchIndex;

import static org.openmetadata.service.jdbi3.unitofwork.JdbiUnitOfWorkProvider.getWrappedInstanceForDaoClass;
import static org.openmetadata.service.util.ReIndexingHandler.REINDEXING_JOB_EXTENSION;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
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
import org.openmetadata.service.util.ReIndexingHandler;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;

@Slf4j
public class SearchIndexWorkflow implements Runnable {
  private static final String ENTITY_TYPE_ERROR_MSG = "EntityType: %s %n Cause: %s %n Stack: %s";
  private final List<PaginatedEntitiesSource> paginatedEntitiesSources = new ArrayList<>();
  private final List<PaginatedDataInsightSource> paginatedDataInsightSources = new ArrayList<>();
  private final Processor entityProcessor;
  private final Processor dataInsightProcessor;
  private final Sink searchIndexSink;
  private final SearchRepository searchRepository;
  @Getter final EventPublisherJob jobData;
  private final CollectionDAO dao;
  private volatile boolean stopped = false;

  public SearchIndexWorkflow(SearchRepository client, EventPublisherJob request) {
    this.dao = (CollectionDAO) getWrappedInstanceForDaoClass(CollectionDAO.class);
    this.jobData = request;
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
    this.searchRepository = client;
    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new OpenSearchEntitiesProcessor();
      this.dataInsightProcessor = new OpenSearchDataInsightProcessor();
      this.searchIndexSink = new OpenSearchIndexSink(searchRepository);
    } else {
      this.entityProcessor = new ElasticSearchEntitiesProcessor();
      this.dataInsightProcessor = new ElasticSearchDataInsightProcessor();
      this.searchIndexSink = new ElasticSearchIndexSink(searchRepository);
    }
  }

  @SneakyThrows
  public void run() {
    try {
      LOG.info("Executing Reindexing Job with JobData : {}", jobData);
      // Update Job Status
      jobData.setStatus(EventPublisherJob.Status.RUNNING);
      // Run ReIndexing
      entitiesReIndex();
      dataInsightReindex();
      // Mark Job as Completed
      updateJobStatus();
      jobData.setEndTime(System.currentTimeMillis());
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
      updateRecordToDb();
      // Send update
      sendUpdates();
      // Remove list from active jobs
      ReIndexingHandler.getInstance().removeCompletedJob(jobData.getId());
    }
  }

  private void entitiesReIndex() {
    Map<String, Object> contextData = new HashMap<>();
    for (PaginatedEntitiesSource paginatedEntitiesSource : paginatedEntitiesSources) {
      reCreateIndexes(paginatedEntitiesSource.getEntityType());
      contextData.put(ENTITY_TYPE_KEY, paginatedEntitiesSource.getEntityType());
      ResultList<? extends EntityInterface> resultList;
      while (!stopped && !paginatedEntitiesSource.isDone()) {
        long currentTime = System.currentTimeMillis();
        int requestToProcess = jobData.getBatchSize();
        int failed = requestToProcess;
        int success = 0;
        try {
          resultList = paginatedEntitiesSource.readNext(null);
          requestToProcess = resultList.getData().size() + resultList.getErrors().size();
          if (!resultList.getData().isEmpty()) {
            if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
              // process data to build Reindex Request
              org.opensearch.action.bulk.BulkRequest requests =
                  (org.opensearch.action.bulk.BulkRequest) entityProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              org.opensearch.action.bulk.BulkResponse response =
                  (org.opensearch.action.bulk.BulkResponse) searchIndexSink.write(requests, contextData);
              // update Status
              handleErrorsOs(resultList, paginatedEntitiesSource.getLastFailedCursor(), response, currentTime);
              // Update stats
              success = searchRepository.getSearchClient().getSuccessFromBulkResponse(response);
            } else {
              // process data to build Reindex Request
              BulkRequest requests = (BulkRequest) entityProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              BulkResponse response = (BulkResponse) searchIndexSink.write(requests, contextData);
              // update Status
              handleErrorsEs(resultList, paginatedEntitiesSource.getLastFailedCursor(), response, currentTime);
              // Update stats
              success = searchRepository.getSearchClient().getSuccessFromBulkResponse(response);
            }
            failed = requestToProcess - success;
          } else {
            failed = 0;
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
        } finally {
          updateStats(
              success,
              failed,
              paginatedEntitiesSource.getStats(),
              entityProcessor.getStats(),
              searchIndexSink.getStats());
          sendUpdates();
        }
      }
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
        int requestToProcess = jobData.getBatchSize();
        int failed = requestToProcess;
        int success = 0;
        try {
          resultList = paginatedDataInsightSource.readNext(null);
          requestToProcess = resultList.getData().size() + resultList.getErrors().size();
          if (!resultList.getData().isEmpty()) {
            if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
              // process data to build Reindex Request
              org.opensearch.action.bulk.BulkRequest requests =
                  (org.opensearch.action.bulk.BulkRequest) dataInsightProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              org.opensearch.action.bulk.BulkResponse response =
                  (org.opensearch.action.bulk.BulkResponse) searchIndexSink.write(requests, contextData);
              handleErrorsOs(resultList, "", response, currentTime);
              // Update stats
              success = searchRepository.getSearchClient().getSuccessFromBulkResponse(response);
            } else {
              // process data to build Reindex Request
              BulkRequest requests = (BulkRequest) dataInsightProcessor.process(resultList, contextData);
              // process data to build Reindex Request
              BulkResponse response = (BulkResponse) searchIndexSink.write(requests, contextData);
              handleErrorsEs(resultList, "", response, currentTime);
              // Update stats
              success = searchRepository.getSearchClient().getSuccessFromBulkResponse(response);
            }
            failed = requestToProcess - success;
          } else {
            failed = 0;
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
        } finally {
          updateStats(
              success,
              failed,
              paginatedDataInsightSource.getStats(),
              dataInsightProcessor.getStats(),
              searchIndexSink.getStats());
          sendUpdates();
        }
      }
    }
  }

  private void sendUpdates() {
    try {
      WebSocketManager.getInstance()
          .sendToOne(
              jobData.getStartedBy(), WebSocketManager.JOB_STATUS_BROADCAST_CHANNEL, JsonUtils.pojoToJson(jobData));
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }

  public void updateStats(
      int currentSuccess, int currentFailed, StepStats reader, StepStats processor, StepStats writer) {
    // Job Level Stats
    Stats jobDataStats = jobData.getStats() != null ? jobData.getStats() : new Stats();

    // Total Stats
    StepStats stats = jobData.getStats().getJobStats();
    if (stats == null) {
      stats = new StepStats().withTotalRecords(getTotalRequestToProcess(jobData.getEntities(), dao));
    }
    getUpdatedStats(stats, currentSuccess, currentFailed);

    // Update for the Job
    jobDataStats.setJobStats(stats);
    // Reader Stats
    jobDataStats.setSourceStats(reader);
    // Processor
    jobDataStats.setProcessorStats(processor);
    // Writer
    jobDataStats.setSinkStats(writer);

    jobData.setStats(jobDataStats);
  }

  public void updateRecordToDb() {
    String recordString =
        dao.entityExtensionTimeSeriesDao().getExtension(jobData.getId().toString(), REINDEXING_JOB_EXTENSION);
    EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
    long originalLastUpdate = lastRecord.getTimestamp();
    dao.entityExtensionTimeSeriesDao()
        .update(
            jobData.getId().toString(), REINDEXING_JOB_EXTENSION, JsonUtils.pojoToJson(jobData), originalLastUpdate);
  }

  private void reCreateIndexes(String entityType) {
    if (Boolean.TRUE.equals(jobData.getRecreateIndex())) {
      IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
      if (indexMapping != null) {
        searchRepository.deleteIndex(indexMapping);
        searchRepository.createIndex(indexMapping);
      }
    }
  }

  private void handleErrorsOs(
      ResultList<?> data, String lastCursor, org.opensearch.action.bulk.BulkResponse response, long time) {
    handleSourceError(data, lastCursor, time);
    handleOsSinkErrors(response, time);
  }

  private void handleErrorsEs(ResultList<?> data, String lastCursor, BulkResponse response, long time) {
    handleSourceError(data, lastCursor, time);
    handleEsSinkErrors(response, time);
  }

  private void handleSourceError(String context, String reason, long time) {
    Failure failures = getFailure();
    FailureDetails readerFailures = getFailureDetails(context, reason, time);
    failures.setSourceError(readerFailures);
    jobData.setFailure(failures);
  }

  private void handleProcessorError(String context, String reason, long time) {
    Failure failures = getFailure();
    FailureDetails processorError = getFailureDetails(context, reason, time);
    failures.setProcessorError(processorError);
    jobData.setFailure(failures);
  }

  private void handleEsSinkError(String context, String reason, long time) {
    Failure failures = getFailure();
    FailureDetails writerFailure = getFailureDetails(context, reason, time);
    failures.setSinkError(writerFailure);
    jobData.setFailure(failures);
  }

  private void handleJobError(String context, String reason, long time) {
    Failure failures = getFailure();
    FailureDetails jobFailure = getFailureDetails(context, reason, time);
    failures.setJobError(jobFailure);
    jobData.setFailure(failures);
  }

  @SneakyThrows
  private void handleSourceError(ResultList<?> data, String lastCursor, long time) {
    if (!data.getErrors().isEmpty()) {
      handleSourceError(
          String.format("SourceContext: After Cursor : %s, Encountered Error While Reading Data.", lastCursor),
          String.format(
              "Following Entities were not fetched Successfully : %s", JsonUtils.pojoToJson(data.getErrors())),
          time);
    }
  }

  @SneakyThrows
  private void handleOsSinkErrors(org.opensearch.action.bulk.BulkResponse response, long time) {
    List<FailureDetails> details = new ArrayList<>();
    for (org.opensearch.action.bulk.BulkItemResponse bulkItemResponse : response) {
      if (bulkItemResponse.isFailed()) {
        org.opensearch.action.bulk.BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
        FailureDetails esFailure =
            new FailureDetails()
                .withContext(
                    String.format(
                        "EsWriterContext: Encountered Error While Writing Data %n Entity %n ID : [%s] ",
                        failure.getId()))
                .withLastFailedReason(
                    String.format(
                        "Index Type: [%s], Reason: [%s] %n Trace : [%s]",
                        failure.getIndex(), failure.getMessage(), ExceptionUtils.getStackTrace(failure.getCause())))
                .withLastFailedAt(System.currentTimeMillis());
        details.add(esFailure);
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
    List<FailureDetails> details = new ArrayList<>();
    for (BulkItemResponse bulkItemResponse : response) {
      if (bulkItemResponse.isFailed()) {
        BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
        FailureDetails esFailure =
            new FailureDetails()
                .withContext(
                    String.format(
                        "EsWriterContext: Encountered Error While Writing Data %n Entity %n ID : [%s] ",
                        failure.getId()))
                .withLastFailedReason(
                    String.format(
                        "Index Type: [%s], Reason: [%s] %n Trace : [%s]",
                        failure.getIndex(), failure.getMessage(), ExceptionUtils.getStackTrace(failure.getCause())))
                .withLastFailedAt(System.currentTimeMillis());
        details.add(esFailure);
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
      if (jobData.getFailure().getSinkError() != null
          || jobData.getFailure().getSourceError() != null
          || jobData.getFailure().getProcessorError() != null) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
      } else {
        jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      }
    }
  }

  private Failure getFailure() {
    return jobData.getFailure() != null ? jobData.getFailure() : new Failure();
  }

  private FailureDetails getFailureDetails(String context, String reason, long time) {
    return new FailureDetails().withContext(context).withLastFailedReason(reason).withLastFailedAt(time);
  }

  public void stopJob() {
    stopped = true;
  }
}
