package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.io.Closeable;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpHeaders;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchClient;
import os.org.opensearch.OpenSearchException;
import os.org.opensearch.action.ActionListener;
import os.org.opensearch.action.DocWriteRequest;
import os.org.opensearch.action.bulk.BulkItemResponse;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.bulk.BulkResponse;
import os.org.opensearch.action.update.UpdateRequest;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.common.xcontent.XContentType;
import os.org.opensearch.rest.RestStatus;

@Slf4j
public class OpenSearchIndexSink implements BulkSink, Closeable {

  private final StepStats stats = new StepStats();
  private final SearchClient client;
  private final long maxPayloadSizeInBytes;
  private final int maxRetries;
  private final long initialBackoffMillis;
  private final long maxBackoffMillis;
  private final Semaphore semaphore;
  private static final RequestOptions COMPRESSED_REQUEST_OPTIONS =
      RequestOptions.DEFAULT.toBuilder().addHeader(HttpHeaders.CONTENT_ENCODING, "gzip").build();

  public OpenSearchIndexSink(
      SearchClient client,
      long maxPayloadSizeInBytes,
      int maxConcurrentRequests,
      int maxRetries,
      long initialBackoffMillis,
      long maxBackoffMillis) {
    this.client = client;
    this.maxPayloadSizeInBytes = maxPayloadSizeInBytes;
    this.maxRetries = maxRetries;
    this.initialBackoffMillis = initialBackoffMillis;
    this.maxBackoffMillis = maxBackoffMillis;
    this.semaphore = new Semaphore(maxConcurrentRequests);
  }

  @Override
  public void write(List<?> entities, Map<String, Object> contextData) throws SearchIndexException {
    String entityType = (String) contextData.get("entityType");
    LOG.debug(
        "[OpenSearchIndexSink] Processing {} entities of type {}", entities.size(), entityType);

    List<EntityError> entityErrorList = new ArrayList<>();
    List<DocWriteRequest<?>> requests = new ArrayList<>();
    List<CountDownLatch> pendingRequests = new ArrayList<>();
    long currentBatchSize = 0L;

    for (Object entity : entities) {
      try {
        DocWriteRequest<?> request = convertEntityToRequest(entity, entityType);
        long requestSize = estimateRequestSizeInBytes(request);

        if (currentBatchSize + requestSize > maxPayloadSizeInBytes) {
          CountDownLatch latch = new CountDownLatch(1);
          pendingRequests.add(latch);
          sendBulkRequestAsyncWithCallback(new ArrayList<>(requests), entityErrorList, latch);
          requests.clear();
          currentBatchSize = 0L;
        }

        requests.add(request);
        currentBatchSize += requestSize;

      } catch (Exception e) {
        entityErrorList.add(
            new EntityError()
                .withMessage(
                    String.format(
                        "Failed to convert entity to request: %s , Stack : %s",
                        e.getMessage(), ExceptionUtils.exceptionStackTraceAsString(e)))
                .withEntity(entity.toString()));
        LOG.error("Error converting entity to request", e);
      }
    }

    if (!requests.isEmpty()) {
      CountDownLatch latch = new CountDownLatch(1);
      pendingRequests.add(latch);
      sendBulkRequestAsyncWithCallback(requests, entityErrorList, latch);
    }

    // Wait for all async operations to complete
    for (CountDownLatch latch : pendingRequests) {
      try {
        latch.await();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new SearchIndexException(createIndexingError(entities.size(), e));
      }
    }

    int totalEntities = entities.size();
    int failedEntities = entityErrorList.size();
    int successfulEntities = totalEntities - failedEntities;
    updateStats(successfulEntities, failedEntities);

    if (!entityErrorList.isEmpty()) {
      throw new SearchIndexException(
          new IndexingError()
              .withErrorSource(SINK)
              .withSubmittedCount(totalEntities)
              .withSuccessCount(successfulEntities)
              .withFailedCount(failedEntities)
              .withMessage(String.format("Issues in Sink to OpenSearch: %s", entityErrorList))
              .withFailedEntities(entityErrorList));
    }
  }

  private void sendBulkRequestAsyncWithCallback(
      List<DocWriteRequest<?>> requests, List<EntityError> entityErrorList, CountDownLatch latch)
      throws SearchIndexException {
    BulkRequest bulkRequest = new BulkRequest();
    bulkRequest.add(requests);

    try {
      semaphore.acquire();
      LOG.debug("Semaphore acquired. Available permits: {}", semaphore.availablePermits());
      ((RestHighLevelClient) client.getClient())
          .bulkAsync(
              bulkRequest,
              COMPRESSED_REQUEST_OPTIONS,
              new ActionListener<BulkResponse>() {
                @Override
                public void onResponse(BulkResponse response) {
                  try {
                    synchronized (entityErrorList) {
                      for (int i = 0; i < response.getItems().length; i++) {
                        BulkItemResponse itemResponse = response.getItems()[i];
                        if (itemResponse.isFailed()) {
                          String failureMessage = itemResponse.getFailureMessage();
                          String entityData = requests.get(i).toString();
                          entityErrorList.add(
                              new EntityError().withMessage(failureMessage).withEntity(entityData));
                          LOG.warn("Bulk item failed: {}", failureMessage);
                        }
                      }
                    }

                    int success = response.getItems().length;
                    int failed = 0;
                    for (BulkItemResponse item : response.getItems()) {
                      if (item.isFailed()) {
                        failed++;
                      }
                    }
                    success -= failed;
                    updateStats(success, failed);

                    if (response.hasFailures()) {
                      LOG.warn("Bulk request completed with failures. Total Failures: {}", failed);
                    } else {
                      LOG.debug("Bulk request successful with {} operations.", success);
                    }
                  } finally {
                    semaphore.release();
                    latch.countDown();
                    LOG.debug(
                        "Semaphore released. Available permits: {}", semaphore.availablePermits());
                  }
                }

                @Override
                public void onFailure(Exception e) {
                  try {
                    LOG.error("Bulk request failed asynchronously", e);
                    synchronized (entityErrorList) {
                      for (DocWriteRequest<?> request : requests) {
                        entityErrorList.add(
                            new EntityError()
                                .withMessage(
                                    String.format("Bulk request failed: %s", e.getMessage()))
                                .withEntity(request.toString()));
                      }
                    }
                  } finally {
                    semaphore.release();
                    latch.countDown();
                    LOG.debug(
                        "Semaphore released after failure. Available permits: {}",
                        semaphore.availablePermits());
                  }
                }
              });
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Bulk request interrupted", e);
      latch.countDown();
      throw new SearchIndexException(createIndexingError(requests.size(), e));
    }
  }

  private void sendBulkRequestAsync(
      List<DocWriteRequest<?>> requests, List<EntityError> entityErrorList)
      throws SearchIndexException {
    BulkRequest bulkRequest = new BulkRequest();
    bulkRequest.add(requests);

    try {
      semaphore.acquire();
      LOG.debug("Semaphore acquired. Available permits: {}", semaphore.availablePermits());
      ((RestHighLevelClient) client.getClient())
          .bulkAsync(
              bulkRequest,
              RequestOptions.DEFAULT,
              new ActionListener<BulkResponse>() {
                @Override
                public void onResponse(BulkResponse response) {
                  try {
                    for (int i = 0; i < response.getItems().length; i++) {
                      BulkItemResponse itemResponse = response.getItems()[i];
                      if (itemResponse.isFailed()) {
                        String failureMessage = itemResponse.getFailureMessage();
                        String entityData = requests.get(i).toString();
                        entityErrorList.add(
                            new EntityError().withMessage(failureMessage).withEntity(entityData));
                        LOG.warn("Bulk item failed: {}", failureMessage);
                      }
                    }

                    int success = response.getItems().length;
                    int failed = 0;
                    for (BulkItemResponse item : response.getItems()) {
                      if (item.isFailed()) {
                        failed++;
                      }
                    }
                    success -= failed;
                    updateStats(success, failed);

                    if (response.hasFailures()) {
                      LOG.warn("Bulk request completed with failures. Total Failures: {}", failed);
                    } else {
                      LOG.debug("Bulk request successful with {} operations.", success);
                    }
                  } finally {
                    semaphore.release();
                    LOG.debug(
                        "Semaphore released. Available permits: {}", semaphore.availablePermits());
                  }
                }

                @Override
                public void onFailure(Exception e) {
                  try {
                    LOG.error("Bulk request failed asynchronously", e);
                    if (isRetriableException(e)) {
                      retryBulkRequest(bulkRequest, entityErrorList, 1);
                    } else {
                      handleNonRetriableException(requests.size(), e);
                    }
                  } catch (Exception ex) {
                    entityErrorList.add(
                        new EntityError()
                            .withMessage(
                                String.format(
                                    "Bulk request failed: %s, StackTrace: %s",
                                    ex.getMessage(),
                                    ExceptionUtils.exceptionStackTraceAsString(ex)))
                            .withEntity(requests.toString()));
                    LOG.error("Bulk request retry attempt {}/{} failed", 1, maxRetries, ex);
                  } finally {
                    semaphore.release();
                    LOG.debug(
                        "Semaphore released after failure. Available permits: {}",
                        semaphore.availablePermits());
                  }
                }
              });
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Bulk request interrupted", e);
      throw new SearchIndexException(createIndexingError(requests.size(), e));
    }
  }

  private void retryBulkRequest(
      BulkRequest bulkRequest, List<EntityError> entityErrorList, int attempt)
      throws SearchIndexException {
    if (attempt > maxRetries) {
      LOG.error("Exceeded maximum retries for bulk request");
      throw new SearchIndexException(
          new IndexingError()
              .withErrorSource(SINK)
              .withSubmittedCount(bulkRequest.numberOfActions())
              .withSuccessCount(0)
              .withFailedCount(bulkRequest.numberOfActions())
              .withMessage("Exceeded maximum retries for bulk request"));
    }

    long backoffMillis =
        Math.min(initialBackoffMillis * (long) Math.pow(2, attempt - 1), maxBackoffMillis);
    LOG.info(
        "Retrying bulk request (attempt {}/{}) after {} ms", attempt, maxRetries, backoffMillis);

    try {
      Thread.sleep(backoffMillis + ThreadLocalRandom.current().nextLong(0, backoffMillis));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Sleep interrupted during backoff", e);
      throw new SearchIndexException(createIndexingError(bulkRequest.numberOfActions(), e));
    }

    try {
      semaphore.acquire();
      LOG.debug(
          "Semaphore acquired for retry attempt {}/{}. Available permits: {}",
          attempt,
          maxRetries,
          semaphore.availablePermits());
      ((RestHighLevelClient) client.getClient())
          .bulkAsync(
              bulkRequest,
              RequestOptions.DEFAULT,
              new ActionListener<>() {
                @Override
                public void onResponse(BulkResponse response) {
                  try {
                    for (int i = 0; i < response.getItems().length; i++) {
                      BulkItemResponse itemResponse = response.getItems()[i];
                      if (itemResponse.isFailed()) {
                        String failureMessage = itemResponse.getFailureMessage();
                        String entityData = bulkRequest.requests().get(i).toString();
                        entityErrorList.add(
                            new EntityError().withMessage(failureMessage).withEntity(entityData));
                        LOG.warn("Bulk item failed on retry {}: {}", attempt, failureMessage);
                      }
                    }

                    int success = response.getItems().length;
                    int failed = 0;
                    for (BulkItemResponse item : response.getItems()) {
                      if (item.isFailed()) {
                        failed++;
                      }
                    }
                    success -= failed;
                    updateStats(success, failed);

                    if (response.hasFailures()) {
                      LOG.warn(
                          "Bulk request retry attempt {}/{} completed with {} failures.",
                          attempt,
                          maxRetries,
                          failed);
                    } else {
                      LOG.debug(
                          "Bulk request retry attempt {}/{} successful with {} operations.",
                          attempt,
                          maxRetries,
                          success);
                    }
                  } finally {
                    semaphore.release();
                    LOG.debug(
                        "Semaphore released after retry. Available permits: {}",
                        semaphore.availablePermits());
                  }
                }

                @Override
                public void onFailure(Exception e) {
                  try {
                    LOG.error("Bulk request retry attempt {}/{} failed", attempt, maxRetries, e);
                    if (isRetriableException(e)) {
                      retryBulkRequest(bulkRequest, entityErrorList, attempt + 1);
                    } else {
                      handleNonRetriableException(bulkRequest.numberOfActions(), e);
                    }
                  } catch (Exception ex) {
                    LOG.error("Bulk request retry attempt {}/{} failed", attempt, maxRetries, ex);
                  } finally {
                    semaphore.release();
                    LOG.debug(
                        "Semaphore released after retry failure. Available permits: {}",
                        semaphore.availablePermits());
                  }
                }
              });
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Bulk request retry interrupted", e);
      throw new SearchIndexException(createIndexingError(bulkRequest.numberOfActions(), e));
    }
  }

  private void handleNonRetriableException(int requestCount, Exception e)
      throws SearchIndexException {
    throw new SearchIndexException(
        new IndexingError()
            .withErrorSource(SINK)
            .withSubmittedCount(requestCount)
            .withSuccessCount(0)
            .withFailedCount(requestCount)
            .withMessage(String.format("Issue in Sink to Elasticsearch: %s", e.getMessage()))
            .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e)));
  }

  private boolean isRetriableException(Exception e) {
    return e instanceof IOException
        || (e instanceof OpenSearchException
            && isRetriableStatusCode(((OpenSearchException) e).status()));
  }

  private boolean isRetriableStatusCode(RestStatus status) {
    return status == RestStatus.TOO_MANY_REQUESTS
        || status == RestStatus.SERVICE_UNAVAILABLE
        || status == RestStatus.GATEWAY_TIMEOUT;
  }

  private long estimateRequestSizeInBytes(DocWriteRequest<?> request) {
    return new BulkRequest().add(request).estimatedSizeInBytes();
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }

  @Override
  public void close() {
    client.close();
  }

  private DocWriteRequest<?> convertEntityToRequest(Object entity, String entityType) {
    if (entity instanceof EntityInterface) {
      return getEntityInterfaceRequest(entityType, (EntityInterface) entity);
    } else if (entity instanceof EntityTimeSeriesInterface) {
      return getEntityTimeSeriesInterfaceRequest(entityType, (EntityTimeSeriesInterface) entity);
    } else {
      throw new IllegalArgumentException("Unknown entity type: " + entity.getClass());
    }
  }

  private UpdateRequest getEntityInterfaceRequest(String entityType, EntityInterface entity) {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    UpdateRequest updateRequest =
        new UpdateRequest(
            indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias()),
            entity.getId().toString());
    String jsonDoc =
        JsonUtils.pojoToJson(Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc());
    updateRequest.doc(jsonDoc, XContentType.JSON);
    updateRequest.docAsUpsert(true);
    return updateRequest;
  }

  private UpdateRequest getEntityTimeSeriesInterfaceRequest(
      String entityType, EntityTimeSeriesInterface entity) {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    UpdateRequest updateRequest =
        new UpdateRequest(
            indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias()),
            entity.getId().toString());
    String jsonDoc =
        JsonUtils.pojoToJson(Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc());
    updateRequest.doc(jsonDoc, XContentType.JSON);
    updateRequest.docAsUpsert(true);
    return updateRequest;
  }

  private IndexingError createIndexingError(int requestCount, Exception e) {
    return new IndexingError()
        .withErrorSource(SINK)
        .withSubmittedCount(requestCount)
        .withSuccessCount(0)
        .withFailedCount(requestCount)
        .withMessage(String.format("Issue in Sink to Elasticsearch: %s", e.getMessage()))
        .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
  }
}
