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

package org.openmetadata.service.jobs.reindexing;

import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.getIndexFields;
import static org.openmetadata.service.jobs.reindexing.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.jobs.reindexing.ReindexingUtil.getSuccessFromBulkResponse;
import static org.openmetadata.service.jobs.reindexing.ReindexingUtil.getTotalRequestToProcess;
import static org.openmetadata.service.jobs.reindexing.ReindexingUtil.isDataInsightIndex;
import static org.openmetadata.service.util.ReIndexingHandler.REINDEXING_JOB_EXTENSION;

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
import org.openmetadata.service.exception.ReaderException;
import org.openmetadata.service.exception.WriterException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ReIndexingHandler;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class ReindexingJob implements Runnable {
  private final List<PaginatedEntitiesReader> entitiesReaders = new ArrayList<>();
  private final List<PaginatedDataInsightReader> dataInsightReaders = new ArrayList<>();
  private final EsEntitiesProcessor entitiesProcessor;
  private final EsDataInsightProcessor dataInsightProcessor;
  private final EsReindexingWriter writer;
  private final ElasticSearchIndexDefinition elasticSearchIndexDefinition;
  @Getter private final EventPublisherJob jobData;
  private final CollectionDAO dao;

  public ReindexingJob(
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
                entitiesReaders.add(new PaginatedEntitiesReader(entityType, jobData.getBatchSize(), fields));
              } else {
                dataInsightReaders.add(new PaginatedDataInsightReader(dao, entityType, jobData.getBatchSize()));
              }
            });
    this.entitiesProcessor = new EsEntitiesProcessor();
    this.dataInsightProcessor = new EsDataInsightProcessor();
    this.writer = new EsReindexingWriter(client);
    this.elasticSearchIndexDefinition = elasticSearchIndexDefinition;
  }

  @SneakyThrows
  public void run() {
    LOG.info("Executing Reindexing Job with JobData : {}", jobData);

    // Update Job Status
    jobData.setStatus(EventPublisherJob.Status.RUNNING);

    // Run ReIndexing
    entitiesReIndexer();
    dataInsightReindexer();

    // Mark Job as Completed
    updateJobStatus();
    jobData.setEndTime(System.currentTimeMillis());

    // store job details in Database
    updateRecordToDb();
    ReIndexingHandler.getInstance().removeCompletedJob(jobData.getId());
  }

  private void entitiesReIndexer() {
    Map<String, Object> contextData = new HashMap<>();
    for (PaginatedEntitiesReader reader : entitiesReaders) {
      reCreateIndexes(reader.getEntityType());
      contextData.put(ENTITY_TYPE_KEY, reader.getEntityType());
      ResultList<? extends EntityInterface> resultList;
      while (!reader.isDone()) {
        long currentTime = System.currentTimeMillis();
        int requestToProcess = jobData.getBatchSize();
        int failed = requestToProcess;
        int success = 0;
        try {
          resultList = reader.readNext(null);
          requestToProcess = resultList.getData().size() + resultList.getErrors().size();
          // process data to build Reindex Request
          BulkRequest requests = entitiesProcessor.process(resultList, contextData);
          // write the data to ElasticSearch
          BulkResponse response = writer.write(requests, contextData);
          // update Status
          handleErrors(resultList, response, currentTime);
          // Update stats
          success = getSuccessFromBulkResponse(response);
          failed = requestToProcess - success;
        } catch (ReaderException rx) {
          handleReaderError(
              rx.getMessage(),
              String.format("Cause: %s \n Stack: %s", rx.getCause(), ExceptionUtils.getStackTrace(rx)),
              currentTime);
        } catch (ProcessorException px) {
          handleProcessorError(
              px.getMessage(),
              String.format("Cause: %s \n Stack: %s", px.getCause(), ExceptionUtils.getStackTrace(px)),
              currentTime);
        } catch (WriterException wx) {
          handleEsError(
              wx.getMessage(),
              String.format("Cause: %s \n Stack: %s", wx.getCause(), ExceptionUtils.getStackTrace(wx)),
              currentTime);
        } finally {
          updateStats(success, failed, reader.getStats(), entitiesProcessor.getStats(), writer.getStats());
        }
      }
    }
  }

  private void dataInsightReindexer() {
    Map<String, Object> contextData = new HashMap<>();
    for (PaginatedDataInsightReader dataInsightReader : dataInsightReaders) {
      reCreateIndexes(dataInsightReader.getEntityType());
      contextData.put(ENTITY_TYPE_KEY, dataInsightReader.getEntityType());
      ResultList<ReportData> resultList;
      while (!dataInsightReader.isDone()) {
        long currentTime = System.currentTimeMillis();
        int requestToProcess = jobData.getBatchSize();
        int failed = requestToProcess;
        int success = 0;
        try {
          resultList = dataInsightReader.readNext(null);
          requestToProcess = resultList.getData().size() + resultList.getErrors().size();
          // process data to build Reindex Request
          BulkRequest requests = dataInsightProcessor.process(resultList, contextData);
          // write the data to ElasticSearch
          BulkResponse response = writer.write(requests, contextData);
          // update Status
          handleErrors(resultList, response, currentTime);
          // Update stats
          success = getSuccessFromBulkResponse(response);
          failed = requestToProcess - success;
        } catch (ReaderException rx) {
          handleReaderError(
              rx.getMessage(),
              String.format("Cause: %s \n Stack: %s", rx.getCause(), ExceptionUtils.getStackTrace(rx)),
              currentTime);
        } catch (ProcessorException px) {
          handleProcessorError(
              px.getMessage(),
              String.format("Cause: %s \n Stack: %s", px.getCause(), ExceptionUtils.getStackTrace(px)),
              currentTime);
        } catch (WriterException wx) {
          handleEsError(
              wx.getMessage(),
              String.format("Cause: %s \n Stack: %s", wx.getCause(), ExceptionUtils.getStackTrace(wx)),
              currentTime);
        } finally {
          updateStats(
              success, failed, dataInsightReader.getStats(), dataInsightProcessor.getStats(), writer.getStats());
        }
      }
    }
  }

  public void updateStats(
      int currentSuccess, int currentFailed, StepStats reader, StepStats processor, StepStats writer) {
    // Job Level Stats
    Stats jobDataStats = jobData.getStats() != null ? jobData.getStats() : new Stats();

    // Total Stats
    StepStats stats = jobData.getStats().getJobStats();
    if (stats == null) {
      stats = new StepStats().withTotalRecords(getTotalRequestToProcess(jobData.getEntities()));
    }
    stats.setTotalSuccessRecords(stats.getTotalSuccessRecords() + currentSuccess);
    stats.setTotalFailedRecords(stats.getTotalFailedRecords() + currentFailed);

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
        dao.entityExtensionTimeSeriesDao().getExtension(jobData.getId().toString(), REINDEXING_JOB_EXTENSION);
    EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
    long originalLastUpdate = lastRecord.getTimestamp();
    dao.entityExtensionTimeSeriesDao()
        .update(
            jobData.getId().toString(), REINDEXING_JOB_EXTENSION, JsonUtils.pojoToJson(jobData), originalLastUpdate);
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
    handleReaderError(data, time);
    handleEsErrors(response, time);
  }

  private void handleReaderError(String context, String reason, long time) {
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

  private void handleEsError(String context, String reason, long time) {
    Failure failures = getFailure();
    FailureDetails writerFailure = getFailureDetails(context, reason, time);
    failures.setProcessorError(writerFailure);
    jobData.setFailure(failures);
  }

  @SneakyThrows
  private void handleReaderError(ResultList<?> data, long time) {
    if (data.getErrors().size() > 0) {
      handleReaderError(
          "ReaderContext: Encountered Error While Reading Data",
          String.format(
              "Following Entities were not fetched Successfully : %s", JsonUtils.pojoToJson(data.getErrors())),
          time);
    }
  }

  @SneakyThrows
  private void handleEsErrors(BulkResponse response, long time) {
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
      handleEsError(
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
