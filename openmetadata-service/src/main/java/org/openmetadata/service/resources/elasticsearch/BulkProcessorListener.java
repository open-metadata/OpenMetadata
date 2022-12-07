package org.openmetadata.service.resources.elasticsearch;

import static org.openmetadata.service.resources.elasticsearch.BuildSearchIndexResource.ELASTIC_SEARCH_ENTITY_FQN_BATCH;
import static org.openmetadata.service.resources.elasticsearch.BuildSearchIndexResource.ELASTIC_SEARCH_EXTENSION;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkProcessor;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.schema.settings.EventPublisherJob.Status;
import org.openmetadata.schema.settings.FailureDetails;
import org.openmetadata.schema.settings.Stats;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class BulkProcessorListener implements BulkProcessor.Listener {
  private volatile boolean updateTotalRequest = true;
  private volatile int totalSuccessCount = 0;
  private volatile int totalFailedCount = 0;
  private volatile int totalRequests = 0;
  private final CollectionDAO dao;
  private final UUID startedBy;

  public BulkProcessorListener(CollectionDAO dao, UUID startedBy) {
    this.dao = dao;
    this.startedBy = startedBy;
    this.resetCounters();
  }

  @Override
  public void beforeBulk(long executionId, BulkRequest bulkRequest) {
    int numberOfActions = bulkRequest.numberOfActions();
    LOG.info("Executing bulk [{}] with {} requests", executionId, numberOfActions);
  }

  @Override
  public void afterBulk(long executionId, BulkRequest bulkRequest, BulkResponse bulkResponse) {
    // Get last Update Details
    try {
      boolean batchHasFailures = false;
      int failedCount = 0;
      // Checking for failure in Items
      FailureDetails failureDetails = new FailureDetails();
      for (BulkItemResponse bulkItemResponse : bulkResponse) {
        if (bulkItemResponse.isFailed()) {
          BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
          failureDetails.setLastFailedReason(
              String.format(
                  "Index Type: [%s], Reason: [%s] \n Trace : [%s]",
                  failure.getIndex(), failure.getMessage(), ExceptionUtils.getStackTrace(failure.getCause())));
          failureDetails.setContext(String.format("Entities Info : \n ID : [%s] ", failure.getId()));
          failedCount++;
          batchHasFailures = true;
        }
      }
      updateFailedAndSuccess(failedCount, bulkResponse.getItems().length - failedCount);

      EventPublisherJob.Status status = batchHasFailures ? Status.ACTIVE_WITH_ERROR : EventPublisherJob.Status.ACTIVE;
      Stats stats = new Stats().withFailed(totalFailedCount).withSuccess(totalSuccessCount).withTotal(totalRequests);
      FailureDetails hasFailureDetails = batchHasFailures ? failureDetails : null;
      updateElasticSearchStatus(status, hasFailureDetails, stats);
    } catch (RuntimeException e) {
      LOG.error("Error in processing Bulk");
    }
  }

  @Override
  public void afterBulk(long executionId, BulkRequest bulkRequest, Throwable throwable) {
    LOG.error("Failed to execute bulk", throwable);
    updateFailedAndSuccess(bulkRequest.numberOfActions(), 0);
    EventPublisherJob.Status status = Status.ACTIVE_WITH_ERROR;
    Stats stats = new Stats().withFailed(totalFailedCount).withSuccess(totalSuccessCount).withTotal(totalRequests);
    FailureDetails hasFailureDetails =
        new FailureDetails()
            .withContext(String.format("Bulk Requests : [%s] ", bulkRequest.getDescription()))
            .withLastFailedReason(
                String.format(
                    "Batch Failed Completely. \n Reason : [%s] \n Trace : [%s] ",
                    throwable.getMessage(), ExceptionUtils.getStackTrace(throwable)));
    updateElasticSearchStatus(status, hasFailureDetails, stats);
  }

  public synchronized void addRequests(int count) {
    if (updateTotalRequest) {
      totalRequests += count;
    }
    updateTotalRequest = false;
  }

  public synchronized void allowTotalRequestUpdate() {
    updateTotalRequest = true;
  }

  public synchronized void resetCounters() {
    totalRequests = 0;
    totalFailedCount = 0;
    totalSuccessCount = 0;
    updateTotalRequest = true;
  }

  public synchronized void updateFailedAndSuccess(int failedCount, int successCount) {
    totalFailedCount += failedCount;
    totalSuccessCount += successCount;
  }

  public void updateElasticSearchStatus(EventPublisherJob.Status status, FailureDetails failDetails, Stats newStats) {
    try {
      long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      String recordString =
          dao.entityExtensionTimeSeriesDao().getExtension(ELASTIC_SEARCH_ENTITY_FQN_BATCH, ELASTIC_SEARCH_EXTENSION);
      EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
      long originalLastUpdate = lastRecord.getTimestamp();
      if (totalRequests == totalFailedCount + totalSuccessCount) {
        lastRecord.setStatus(EventPublisherJob.Status.IDLE);
      } else {
        lastRecord.setStatus(status);
      }
      lastRecord.setTimestamp(updateTime);
      if (failDetails != null) {
        lastRecord.setFailureDetails(
            new FailureDetails()
                .withContext(failDetails.getContext())
                .withLastFailedAt(updateTime)
                .withLastFailedReason(failDetails.getLastFailedReason()));
      }
      lastRecord.setStats(newStats);
      dao.entityExtensionTimeSeriesDao()
          .update(
              ELASTIC_SEARCH_ENTITY_FQN_BATCH,
              ELASTIC_SEARCH_EXTENSION,
              JsonUtils.pojoToJson(lastRecord),
              originalLastUpdate);
      WebSocketManager.getInstance()
          .sendToOne(this.startedBy, WebSocketManager.JOB_STATUS_BROADCAST_CHANNEL, JsonUtils.pojoToJson(lastRecord));
    } catch (Exception e) {
      LOG.error("Failed to Update Elastic Search Job Info");
    }
  }
}
