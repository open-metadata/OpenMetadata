package org.openmetadata.service.resources.elasticSearch;

import static org.openmetadata.service.resources.elasticSearch.BuildSearchIndexResource.ELASTIC_SEARCH_EXTENSION;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkProcessor;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.schema.settings.FailureDetails;
import org.openmetadata.schema.settings.Stats;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class BulkProcessorListener implements BulkProcessor.Listener {
  private volatile boolean updateTotalRequest = true;
  private volatile int totalSuccessCount = 0;
  private volatile int totalFailedCount = 0;
  private volatile int totalRequests = 0;

  private CreateEventPublisherJob createRequest;
  private String requestIssuer = "anonymous";
  private String entityFQN;
  private final CollectionDAO dao;
  private Long startTime;
  private Long originalStartTime;

  public BulkProcessorListener(CollectionDAO dao) {
    this.dao = dao;
  }

  @Override
  public void beforeBulk(long executionId, BulkRequest bulkRequest) {
    int numberOfActions = bulkRequest.numberOfActions();
    LOG.info("Executing bulk [{}] with {} requests", executionId, numberOfActions);
  }

  @Override
  public void afterBulk(long executionId, BulkRequest bulkRequest, BulkResponse bulkResponse) {
    int failedCount = 0;
    int successCount;
    FailureDetails failureDetails = null;
    for (BulkItemResponse bulkItemResponse : bulkResponse) {
      if (bulkItemResponse.isFailed()) {
        BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
        failureDetails = new FailureDetails();
        failureDetails.setLastFailedAt(
            Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime());
        failureDetails.setLastFailedReason(
            String.format("ID [%s]. Reason : %s", failure.getId(), failure.getMessage()));
        failedCount++;
      }
    }
    successCount = bulkResponse.getItems().length - failedCount;
    updateFailedAndSuccess(failedCount, successCount);
    // update stats in DB
    Long time = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
    EventPublisherJob updateJob =
        new EventPublisherJob()
            .withName(createRequest.getName())
            .withPublisherType(createRequest.getPublisherType())
            .withRunMode(createRequest.getRunMode())
            .withStatus(EventPublisherJob.Status.RUNNING)
            .withTimestamp(time)
            .withStats(new Stats().withFailed(totalFailedCount).withSuccess(totalSuccessCount).withTotal(totalRequests))
            .withStartedBy(requestIssuer)
            .withFailureDetails(failureDetails)
            .withStartTime(originalStartTime)
            .withEntities(createRequest.getEntities());
    if (totalRequests == totalFailedCount + totalSuccessCount) {
      updateJob.setStatus(EventPublisherJob.Status.SUCCESS);
      updateJob.setEndTime(time);
    }
    try {
      dao.entityExtensionTimeSeriesDao()
          .update(entityFQN, ELASTIC_SEARCH_EXTENSION, JsonUtils.pojoToJson(updateJob), startTime);
    } catch (JsonProcessingException e) {
      LOG.error("Failed in Converting to Json.");
    }
    startTime = time;
  }

  @Override
  public void afterBulk(long executionId, BulkRequest bulkRequest, Throwable throwable) {
    LOG.error("Failed to execute bulk", throwable);
    updateFailedAndSuccess(bulkRequest.numberOfActions(), 0);
  }

  public String getEntityFQN() {
    return entityFQN;
  }

  public void setRequestIssuer(String adminName) {
    this.requestIssuer = adminName;
  }

  public void setEntityFQN(String entityFQN) {
    this.entityFQN = entityFQN;
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

  public void setStartTime(Long time) {
    this.startTime = time;
    this.originalStartTime = time;
  }

  public CreateEventPublisherJob getCreateRequest() {
    return createRequest;
  }

  public void setCreateRequest(CreateEventPublisherJob createRequest) {
    this.createRequest = createRequest;
  }
}
