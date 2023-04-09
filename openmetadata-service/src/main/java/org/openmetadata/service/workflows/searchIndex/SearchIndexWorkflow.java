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

import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.getIndexFields;
import static org.openmetadata.service.util.ReIndexingHandler.REINDEXING_JOB_EXTENSION;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getSuccessFromBulkResponse;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.exception.ProcessorException;
import org.openmetadata.service.exception.SinkException;
import org.openmetadata.service.exception.SourceException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ReIndexingHandler;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class SearchIndexWorkflow implements Runnable {
  private final List<PaginatedEntitiesSource> paginatedEntitiesSources = new ArrayList<>();
  private final List<PaginatedDataInsightSource> paginatedDataInsightSources = new ArrayList<>();
  private final EsEntitiesProcessor entitiesProcessor;
  private final EsDataInsightProcessor dataInsightProcessor;
  private final EsSearchIndexSink searchIndexSink;
  private final ElasticSearchIndexDefinition elasticSearchIndexDefinition;
  @Getter private final EventPublisherJob jobData;
  private final CollectionDAO dao;

  public SearchIndexWorkflow(
      CollectionDAO dao,
      ElasticSearchIndexDefinition elasticSearchIndexDefinition,
      RestHighLevelClient client,
      EventPublisherJob request) {
    this.dao = dao;
    this.jobData = request;
    request
        .getEntities()
        .forEach(
            (entityType) -> {
              if (!isDataInsightIndex(entityType)) {
                List<String> fields =
                    new ArrayList<>(
                        Objects.requireNonNull(getIndexFields(entityType, jobData.getSearchIndexMappingLanguage())));
                paginatedEntitiesSources.add(new PaginatedEntitiesSource(entityType, jobData.getBatchSize(), fields));
              } else {
                paginatedDataInsightSources.add(
                    new PaginatedDataInsightSource(dao, entityType, jobData.getBatchSize()));
              }
            });
    this.entitiesProcessor = new EsEntitiesProcessor();
    this.dataInsightProcessor = new EsDataInsightProcessor();
    this.searchIndexSink = new EsSearchIndexSink(client);
    this.elasticSearchIndexDefinition = elasticSearchIndexDefinition;
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
              "Reindexing Job Has Encountered an Exception. \n Job Data: %s, \n  Stack : %s ",
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
      while (!paginatedEntitiesSource.isDone()) {
        long currentTime = System.currentTimeMillis();
        int requestToProcess = jobData.getBatchSize();
        int failed = requestToProcess;
        int success = 0;
        try {
          resultList = paginatedEntitiesSource.readNext(null);
          requestToProcess = resultList.getData().size() + resultList.getErrors().size();
          if (resultList.getData().size() > 0) {
            // process data to build Reindex Request
            BulkRequest requests = entitiesProcessor.process(resultList, contextData);
            // write the data to ElasticSearch
            BulkResponse response = searchIndexSink.write(requests, contextData);
            // update Status
            handleErrors(resultList, response, currentTime);
            // Update stats
            success = getSuccessFromBulkResponse(response);
            failed = requestToProcess - success;
          } else {
            failed = 0;
          }
        } catch (SourceException rx) {
          handleSourceError(
              rx.getMessage(),
              String.format(
                  "EntityType: %s \n Cause: %s \n Stack: %s",
                  paginatedEntitiesSource.getEntityType(), rx.getCause(), ExceptionUtils.getStackTrace(rx)),
              currentTime);
        } catch (ProcessorException px) {
          handleProcessorError(
              px.getMessage(),
              String.format(
                  "EntityType: %s \n Cause: %s \n Stack: %s",
                  paginatedEntitiesSource.getEntityType(), px.getCause(), ExceptionUtils.getStackTrace(px)),
              currentTime);
        } catch (SinkException wx) {
          handleEsSinkError(
              wx.getMessage(),
              String.format(
                  "EntityType: %s \n Cause: %s \n Stack: %s",
                  paginatedEntitiesSource.getEntityType(), wx.getCause(), ExceptionUtils.getStackTrace(wx)),
              currentTime);
        } finally {
          updateStats(
              success,
              failed,
              paginatedEntitiesSource.getStats(),
              entitiesProcessor.getStats(),
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
      while (!paginatedDataInsightSource.isDone()) {
        long currentTime = System.currentTimeMillis();
        int requestToProcess = jobData.getBatchSize();
        int failed = requestToProcess;
        int success = 0;
        try {
          resultList = paginatedDataInsightSource.readNext(null);
          requestToProcess = resultList.getData().size() + resultList.getErrors().size();
          if (resultList.getData().size() > 0) {
            // process data to build Reindex Request
            BulkRequest requests = dataInsightProcessor.process(resultList, contextData);
            // write the data to ElasticSearch
            // write the data to ElasticSearch
            BulkResponse response = searchIndexSink.write(requests, contextData);
            // update Status
            handleErrors(resultList, response, currentTime);
            // Update stats
            success = getSuccessFromBulkResponse(response);
            failed = requestToProcess - success;
          } else {
            failed = 0;
          }
        } catch (SourceException rx) {
          handleSourceError(
              rx.getMessage(),
              String.format(
                  "EntityType: %s \n Cause: %s \n Stack: %s",
                  paginatedDataInsightSource.getEntityType(), rx.getCause(), ExceptionUtils.getStackTrace(rx)),
              currentTime);
        } catch (ProcessorException px) {
          handleProcessorError(
              px.getMessage(),
              String.format(
                  "EntityType: %s \n Cause: %s \n Stack: %s",
                  paginatedDataInsightSource.getEntityType(), px.getCause(), ExceptionUtils.getStackTrace(px)),
              currentTime);
        } catch (SinkException wx) {
          handleEsSinkError(
              wx.getMessage(),
              String.format(
                  "EntityType: %s \n Cause: %s \n Stack: %s",
                  paginatedDataInsightSource.getEntityType(), wx.getCause(), ExceptionUtils.getStackTrace(wx)),
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
    } catch (JsonProcessingException ex) {
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

  public void updateRecordToDb() throws IOException {
    String recordString =
        dao.entityExtensionTimeSeriesDao().getExtension(EntityUtil.getCheckSum(jobData.getId().toString()), REINDEXING_JOB_EXTENSION);
    EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
    long originalLastUpdate = lastRecord.getTimestamp();
    dao.entityExtensionTimeSeriesDao()
        .update(
            EntityUtil.getCheckSum(jobData.getId().toString()), REINDEXING_JOB_EXTENSION, JsonUtils.pojoToJson(jobData), originalLastUpdate);
  }

  private void reCreateIndexes(String entityType) {
    if (!jobData.getRecreateIndex()) {
      return;
    }

    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    // Delete index
    elasticSearchIndexDefinition.deleteIndex(indexType);
    // Create index
    elasticSearchIndexDefinition.createIndex(indexType, jobData.getSearchIndexMappingLanguage().value());
  }

  private void handleErrors(ResultList<?> data, BulkResponse response, long time) {
    handleSourceError(data, time);
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
  private void handleSourceError(ResultList<?> data, long time) {
    if (data.getErrors().size() > 0) {
      handleSourceError(
          "SourceContext: Encountered Error While Reading Data",
          String.format(
              "Following Entities were not fetched Successfully : %s", JsonUtils.pojoToJson(data.getErrors())),
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
                        "EsWriterContext: Encountered Error While Writing Data \n Entity \n ID : [%s] ",
                        failure.getId()))
                .withLastFailedReason(
                    String.format(
                        "Index Type: [%s], Reason: [%s] \n Trace : [%s]",
                        failure.getIndex(), failure.getMessage(), ExceptionUtils.getStackTrace(failure.getCause())))
                .withLastFailedAt(System.currentTimeMillis());
        details.add(esFailure);
      }
    }
    if (details.size() > 0) {
      handleEsSinkError(
          "[EsWriter] BulkResponseItems",
          String.format("[BulkItemResponse] Got Following Error Responses: \n %s ", JsonUtils.pojoToJson(details)),
          time);
    }
  }

  private void updateJobStatus() {
    if (jobData.getFailure().getSinkError() != null
        || jobData.getFailure().getSourceError() != null
        || jobData.getFailure().getProcessorError() != null) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
    } else {
      jobData.setStatus(EventPublisherJob.Status.COMPLETED);
    }
  }

  private Failure getFailure() {
    return jobData.getFailure() != null ? jobData.getFailure() : new Failure();
  }

  private FailureDetails getFailureDetails(String context, String reason, long time) {
    return new FailureDetails().withContext(context).withLastFailedReason(reason).withLastFailedAt(time);
  }
}
