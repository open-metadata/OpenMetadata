/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import static org.openmetadata.schema.analytics.ReportData.ReportDataType.ENTITY_REPORT_DATA;
import static org.openmetadata.schema.analytics.ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA;
import static org.openmetadata.schema.analytics.ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.resources.elasticsearch.BuildSearchIndexResource.ELASTIC_SEARCH_ENTITY_FQN_BATCH;
import static org.openmetadata.service.resources.elasticsearch.BuildSearchIndexResource.ELASTIC_SEARCH_EXTENSION;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.action.ActionListener;
import org.elasticsearch.action.bulk.BackoffPolicy;
import org.elasticsearch.action.bulk.BulkProcessor;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.common.xcontent.XContentType;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.schema.settings.FailureDetails;
import org.openmetadata.schema.settings.Stats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexFactory;
import org.openmetadata.service.elasticsearch.ReportDataIndexes;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.elasticsearch.BulkProcessorListener;

@Slf4j
public class ElasticSearchIndexUtil {

  private final CollectionDAO dao;
  private final ExecutorService threadScheduler;
  private final RestHighLevelClient client;
  private final ElasticSearchIndexDefinition elasticSearchIndexDefinition;
  private final String lang;

  public ElasticSearchIndexUtil(
      CollectionDAO dao,
      RestHighLevelClient client,
      ElasticSearchIndexDefinition elasticSearchIndexDefinition,
      String lang) {
    this.dao = dao;
    this.client = client;
    this.elasticSearchIndexDefinition = elasticSearchIndexDefinition;
    this.lang = lang;
    this.threadScheduler =
        new ThreadPoolExecutor(
            2, 2, 0L, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(5), new ThreadPoolExecutor.CallerRunsPolicy());
  }

  private BulkProcessor getBulkProcessor(BulkProcessorListener listener, int bulkSize, int flushIntervalInSeconds) {
    BiConsumer<BulkRequest, ActionListener<BulkResponse>> bulkConsumer =
        (request, bulkListener) -> client.bulkAsync(request, RequestOptions.DEFAULT, bulkListener);
    BulkProcessor.Builder builder = BulkProcessor.builder(bulkConsumer, listener, "es-reindex");
    builder.setBulkActions(bulkSize);
    builder.setConcurrentRequests(2);
    builder.setFlushInterval(TimeValue.timeValueSeconds(flushIntervalInSeconds));
    builder.setBackoffPolicy(BackoffPolicy.constantBackoff(TimeValue.timeValueSeconds(1L), 3));
    return builder.build();
  }

  public synchronized Response startReindexingBatchMode(
      UriInfo uriInfo, UUID startedBy, CreateEventPublisherJob createRequest) {
    // create a new Job
    threadScheduler.submit(
        () -> {
          try {
            this.submitBatchJob(uriInfo, startedBy, createRequest);
          } catch (IOException e) {
            LOG.error("Reindexing Batch Job error", e);
          }
        });
    return Response.status(Response.Status.OK).entity("Reindexing Started").build();
  }

  private synchronized void submitBatchJob(UriInfo uriInfo, UUID startedBy, CreateEventPublisherJob createRequest)
      throws IOException {
    long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
    String recordString =
        dao.entityExtensionTimeSeriesDao().getExtension(ELASTIC_SEARCH_ENTITY_FQN_BATCH, ELASTIC_SEARCH_EXTENSION);
    EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
    long originalLastUpdate = lastRecord.getTimestamp();
    lastRecord.setStatus(EventPublisherJob.Status.STARTING);
    lastRecord.setStats(new Stats().withFailed(0).withTotal(0).withSuccess(0));
    lastRecord.setTimestamp(updateTime);
    lastRecord.setEntities(createRequest.getEntities());
    dao.entityExtensionTimeSeriesDao()
        .update(
            ELASTIC_SEARCH_ENTITY_FQN_BATCH,
            ELASTIC_SEARCH_EXTENSION,
            JsonUtils.pojoToJson(lastRecord),
            originalLastUpdate);

    // Update Listener for only Batch
    BulkProcessorListener bulkProcessorListener = new BulkProcessorListener(dao, startedBy);
    BulkProcessor processor =
        getBulkProcessor(bulkProcessorListener, createRequest.getBatchSize(), createRequest.getFlushIntervalInSec());

    for (String entityName : createRequest.getEntities()) {
      try {
        updateEntityBatch(processor, bulkProcessorListener, uriInfo, entityName, createRequest);
      } catch (Exception ex) {
        LOG.error("Reindexing intermittent failure for entityType : {}", entityName, ex);
      }
    }
  }

  public ResultList<ReportData> getReportDataPagination(String entityFQN, int limit, String before, String after) {
    RestUtil.validateCursors(before, after);
    int reportDataCount = dao.entityExtensionTimeSeriesDao().listCount(entityFQN);
    List<CollectionDAO.ReportDataRow> reportDataList;
    if (before != null) {
      reportDataList =
          dao.entityExtensionTimeSeriesDao().getBeforeExtension(entityFQN, limit + 1, RestUtil.decodeCursor(before));
    } else {
      reportDataList =
          dao.entityExtensionTimeSeriesDao()
              .getAfterExtension(entityFQN, limit + 1, after == null ? "0" : RestUtil.decodeCursor(after));
    }
    ResultList<ReportData> reportDataResultList;
    if (before != null) {
      reportDataResultList = getBeforeExtensionList(reportDataList, limit, reportDataCount);
    } else {
      reportDataResultList = getAfterExtensionList(reportDataList, after, limit, reportDataCount);
    }
    return reportDataResultList;
  }

  private ResultList<ReportData> getBeforeExtensionList(
      List<CollectionDAO.ReportDataRow> reportDataRowList, int limit, int total) {
    String beforeCursor = null;
    String afterCursor;
    if (reportDataRowList.size() > limit) {
      reportDataRowList.remove(0);
      beforeCursor = reportDataRowList.get(0).getRowNum();
    }
    afterCursor = reportDataRowList.get(reportDataRowList.size() - 1).getRowNum();
    List<ReportData> reportDataList = new ArrayList<>();
    for (CollectionDAO.ReportDataRow reportDataRow : reportDataRowList) {
      reportDataList.add(reportDataRow.getReportData());
    }
    return getReportDataResultList(reportDataList, beforeCursor, afterCursor, total);
  }

  private ResultList<ReportData> getAfterExtensionList(
      List<CollectionDAO.ReportDataRow> reportDataRowList, String after, int limit, int total) {
    String beforeCursor;
    String afterCursor = null;
    beforeCursor = after == null ? null : reportDataRowList.get(0).getRowNum();
    if (reportDataRowList.size() > limit) {
      reportDataRowList.remove(limit);
      afterCursor = reportDataRowList.get(limit - 1).getRowNum();
    }
    List<ReportData> reportDataList = new ArrayList<>();
    for (CollectionDAO.ReportDataRow reportDataRow : reportDataRowList) {
      reportDataList.add(reportDataRow.getReportData());
    }
    return getReportDataResultList(reportDataList, beforeCursor, afterCursor, total);
  }

  private ResultList<ReportData> getReportDataResultList(
      List<ReportData> queries, String before, String after, int total) {
    return new ResultList<>(queries, before, after, total);
  }

  private synchronized void fetchReportData(
      String entityFQN,
      CreateEventPublisherJob createRequest,
      BulkProcessor processor,
      BulkProcessorListener listener,
      String entityType,
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType) {
    ResultList<ReportData> result;
    String after = null;
    try {
      do {
        result = getReportDataPagination(entityFQN, createRequest.getBatchSize(), null, after);
        listener.addRequests(result.getPaging().getTotal());
        updateElasticSearchForDataInsightBatch(processor, indexType, entityType, result.getData());
        processor.flush();
        after = result.getPaging().getAfter();
      } while (after != null);
    } catch (Exception ex) {
      LOG.error("Failed in listing all Entities of type : {}, Reason : ", entityType, ex);
      FailureDetails failureDetails =
          new FailureDetails()
              .withContext(String.format("%s:Failure in fetching Data", entityType))
              .withLastFailedReason(
                  String.format("Failed in listing all ReportData \n Reason : %s", ExceptionUtils.getStackTrace(ex)));
      listener.updateElasticSearchStatus(EventPublisherJob.Status.IDLE, failureDetails, null);
    }
  }

  private synchronized void updateEntityBatch(
      BulkProcessor processor,
      BulkProcessorListener listener,
      UriInfo uriInfo,
      String entityType,
      CreateEventPublisherJob createRequest) {
    listener.allowTotalRequestUpdate();

    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);

    if (Boolean.TRUE.equals(createRequest.getRecreateIndex())) {
      // Delete index
      elasticSearchIndexDefinition.deleteIndex(indexType);
      // Create index
      elasticSearchIndexDefinition.createIndex(indexType, lang);
    }

    // Start fetching a list of Report Data and pushing them to ES
    if (entityType.equalsIgnoreCase(ElasticSearchIndexDefinition.ENTITY_REPORT_DATA)) {
      fetchReportData(String.valueOf(ENTITY_REPORT_DATA), createRequest, processor, listener, entityType, indexType);
    } else if (entityType.equalsIgnoreCase(ElasticSearchIndexDefinition.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA)) {
      fetchReportData(
          String.valueOf(WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA),
          createRequest,
          processor,
          listener,
          entityType,
          indexType);
    } else if (entityType.equalsIgnoreCase(ElasticSearchIndexDefinition.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)) {
      fetchReportData(
          String.valueOf(WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA),
          createRequest,
          processor,
          listener,
          entityType,
          indexType);
    } else {
      // Start fetching a list of Entities and pushing them to ES
      EntityRepository<? extends EntityInterface> entityRepository = Entity.getEntityRepository(entityType);
      List<String> allowedFields = entityRepository.getAllowedFields();
      String fields = String.join(",", allowedFields);
      ResultList<? extends EntityInterface> result;
      String after = null;
      try {
        do {
          if (entityType.equals(TEAM)) {
            // just name and display name are needed
            fields = "name,displayName";
          }
          result =
              entityRepository.listAfter(
                  uriInfo,
                  new EntityUtil.Fields(allowedFields, fields),
                  new ListFilter(Include.ALL),
                  createRequest.getBatchSize(),
                  after);
          listener.addRequests(result.getPaging().getTotal());
          updateElasticSearchForEntityBatch(indexType, processor, entityType, result.getData());
          processor.flush();
          after = result.getPaging().getAfter();
        } while (after != null);
      } catch (Exception ex) {
        LOG.error("Failed in listing all Entities of type : {}, Reason : ", entityType, ex);
        FailureDetails failureDetails =
            new FailureDetails()
                .withContext(String.format("%s:Failure in fetching Data", entityType))
                .withLastFailedReason(
                    String.format("Failed in listing all Entities \n Reason : %s", ExceptionUtils.getStackTrace(ex)));
        listener.updateElasticSearchStatus(EventPublisherJob.Status.IDLE, failureDetails, null);
      }
    }
  }

  private synchronized void updateElasticSearchForDataInsightBatch(
      BulkProcessor bulkProcessor,
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType,
      String entityType,
      List<ReportData> entities) {
    for (ReportData reportData : entities) {
      UpdateRequest request = getUpdateRequest(indexType, entityType, reportData);
      if (request != null) {
        bulkProcessor.add(request);
      }
    }
  }

  private synchronized void updateElasticSearchForEntityBatch(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType,
      BulkProcessor bulkProcessor,
      String entityType,
      List<? extends EntityInterface> entities) {
    for (EntityInterface entity : entities) {
      if (entityType.equals(TABLE)) {
        ((Table) entity).getColumns().forEach(table -> table.setProfile(null));
      }
      UpdateRequest request = getUpdateRequest(indexType, entityType, entity);
      if (request != null) {
        bulkProcessor.add(request);
      }
    }
  }

  private UpdateRequest getUpdateRequest(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType, String entityType, EntityInterface entity) {
    try {
      UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, entity.getId().toString());
      updateRequest.doc(
          JsonUtils.pojoToJson(
              Objects.requireNonNull(ElasticSearchIndexFactory.buildIndex(entityType, entity)).buildESDoc()),
          XContentType.JSON);
      updateRequest.docAsUpsert(true);
      return updateRequest;
    } catch (Exception ex) {
      LOG.error("Failed in creating update Request for indexType : {}, entityType: {}", indexType, entityType, ex);
    }
    return null;
  }

  private UpdateRequest getUpdateRequest(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType, String entityType, ReportData reportData) {
    try {
      UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, reportData.getId().toString());
      updateRequest.doc(JsonUtils.pojoToJson(new ReportDataIndexes(reportData).buildESDoc()), XContentType.JSON);
      updateRequest.docAsUpsert(true);
      return updateRequest;
    } catch (Exception ex) {
      LOG.error("Failed in creating update Request for indexType : {}, entityType: {}", indexType, entityType, ex);
    }
    return null;
  }
}
