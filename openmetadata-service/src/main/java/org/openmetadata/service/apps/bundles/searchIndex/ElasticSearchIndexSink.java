package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getErrorsFromBulkResponse;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import es.org.elasticsearch.ElasticsearchException;
import es.org.elasticsearch.action.DocWriteRequest;
import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.action.update.UpdateRequest;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.rest.RestStatus;
import es.org.elasticsearch.xcontent.XContentType;
import java.io.Closeable;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ElasticSearchIndexSink implements BulkSink, Closeable {
  private final StepStats stats = new StepStats();
  private final SearchClient client;
  private final long maxPayloadSizeInBytes;
  private final int maxRetries;
  private final long initialBackoffMillis;
  private final long maxBackoffMillis;
  private final Semaphore semaphore;

  public ElasticSearchIndexSink(
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
        "[ElasticSearchIndexSink] Processing {} entities of type {}", entities.size(), entityType);

    List<EntityError> entityErrorList = new ArrayList<>();
    List<DocWriteRequest<?>> requests = new ArrayList<>();
    long currentBatchSize = 0L;

    for (Object entity : entities) {
      try {
        DocWriteRequest<?> request = convertEntityToRequest(entity, entityType);
        long requestSize = estimateRequestSizeInBytes(request);

        if (currentBatchSize + requestSize > maxPayloadSizeInBytes) {
          // Flush current batch
          sendBulkRequest(requests, entityErrorList);
          requests.clear();
          currentBatchSize = 0L;
        }

        requests.add(request);
        currentBatchSize += requestSize;

      } catch (Exception e) {
        entityErrorList.add(
            new EntityError()
                .withMessage("Failed to convert entity to request: " + e.getMessage())
                .withEntity(entity.toString()));
        LOG.error("Error converting entity to request", e);
      }
    }

    if (!requests.isEmpty()) {
      sendBulkRequest(requests, entityErrorList);
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
              .withMessage(String.format("Issues in Sink to Elasticsearch: %s", entityErrorList))
              .withFailedEntities(entityErrorList));
    }
  }

  private void sendBulkRequest(List<DocWriteRequest<?>> requests, List<EntityError> entityErrorList)
      throws SearchIndexException {
    BulkRequest bulkRequest = new BulkRequest();
    bulkRequest.add(requests);

    int attempt = 0;
    long backoffMillis = initialBackoffMillis;

    while (attempt <= maxRetries) {
      try {
        semaphore.acquire();
        try {
          BulkResponse response = client.bulk(bulkRequest, RequestOptions.DEFAULT);
          entityErrorList.addAll(getErrorsFromBulkResponse(response));
          break; // Success, exit retry loop
        } finally {
          semaphore.release();
        }
      } catch (IOException e) {
        if (isRetriableException(e)) {
          attempt++;
          LOG.warn(
              "Bulk request failed with retriable exception, retrying attempt {}/{}",
              attempt,
              maxRetries);
          sleepWithBackoff(backoffMillis);
          backoffMillis = Math.min(backoffMillis * 2, maxBackoffMillis);
        } else {
          LOG.error("Bulk request failed with non-retriable exception", e);
          throw new SearchIndexException(createIndexingError(requests.size(), e));
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        LOG.error("Bulk request interrupted", e);
        throw new SearchIndexException(createIndexingError(requests.size(), e));
      } catch (ElasticsearchException e) {
        if (isRetriableStatusCode(e.status())) {
          attempt++;
          LOG.warn(
              "Bulk request failed with status {}, retrying attempt {}/{}",
              e.status(),
              attempt,
              maxRetries);
          sleepWithBackoff(backoffMillis);
          backoffMillis = Math.min(backoffMillis * 2, maxBackoffMillis);
        } else {
          LOG.error("Bulk request failed with non-retriable status {}", e.status(), e);
          throw new SearchIndexException(createIndexingError(requests.size(), e));
        }
      }
    }

    if (attempt > maxRetries) {
      throw new SearchIndexException(
          new IndexingError()
              .withErrorSource(SINK)
              .withSubmittedCount(requests.size())
              .withSuccessCount(0)
              .withFailedCount(requests.size())
              .withMessage("Exceeded maximum retries for bulk request"));
    }
  }

  private boolean isRetriableException(Exception e) {
    return e instanceof IOException;
  }

  private boolean isRetriableStatusCode(RestStatus status) {
    return status == RestStatus.TOO_MANY_REQUESTS || status == RestStatus.SERVICE_UNAVAILABLE;
  }

  private void sleepWithBackoff(long millis) {
    try {
      Thread.sleep(millis + ThreadLocalRandom.current().nextLong(0, millis));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Sleep interrupted during backoff", e);
    }
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

  private DocWriteRequest<?> convertEntityToRequest(Object entity, String entityType) {
    if (entity instanceof EntityInterface) {
      return getEntityInterfaceRequest(entityType, (EntityInterface) entity);
    } else if (entity instanceof EntityTimeSeriesInterface) {
      return getEntityTimeSeriesInterfaceReqeust(entityType, (EntityTimeSeriesInterface) entity);
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
    updateRequest.doc(
        JsonUtils.pojoToJson(
            Objects.requireNonNull(Entity.buildSearchIndex(entityType, entity))
                .buildSearchIndexDoc()),
        XContentType.JSON);
    updateRequest.docAsUpsert(true);
    return updateRequest;
  }

  private UpdateRequest getEntityTimeSeriesInterfaceReqeust(
      String entityType, EntityTimeSeriesInterface entity) {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    UpdateRequest updateRequest =
        new UpdateRequest(
            indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias()),
            entity.getId().toString());
    updateRequest.doc(
        JsonUtils.pojoToJson(
            Objects.requireNonNull(
                Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc())),
        XContentType.JSON);
    updateRequest.docAsUpsert(true);
    return updateRequest;
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
  public void close() throws IOException {
    client.close();
  }
}
