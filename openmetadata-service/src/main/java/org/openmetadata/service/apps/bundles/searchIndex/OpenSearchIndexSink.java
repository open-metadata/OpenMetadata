package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.Closeable;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Semaphore;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchAsyncClient;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;

@Slf4j
public class OpenSearchIndexSink implements BulkSink, Closeable {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER =
      new JacksonJsonpMapper(OBJECT_MAPPER);

  private final StepStats stats = new StepStats();
  private final SearchClient client;
  private final OpenSearchAsyncClient asyncClient;
  private final long maxPayloadSizeInBytes;
  private final int maxRetries;
  private final long initialBackoffMillis;
  private final long maxBackoffMillis;
  private final Semaphore semaphore;

  public OpenSearchIndexSink(
      SearchClient client,
      long maxPayloadSizeInBytes,
      int maxConcurrentRequests,
      int maxRetries,
      long initialBackoffMillis,
      long maxBackoffMillis) {
    this.client = client;
    OpenSearchClient osClient = (OpenSearchClient) client;
    this.asyncClient = new OpenSearchAsyncClient(osClient.getNewClient()._transport());
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
    List<BulkOperation> requests = new ArrayList<>();
    List<CountDownLatch> pendingRequests = new ArrayList<>();
    long currentBatchSize = 0L;

    for (Object entity : entities) {
      try {
        BulkOperation request = convertEntityToRequest(entity, entityType);
        long requestSize = estimateOperationSize(request);

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
      List<BulkOperation> operations, List<EntityError> entityErrorList, CountDownLatch latch)
      throws SearchIndexException {
    try {
      semaphore.acquire();
      LOG.debug("Semaphore acquired. Available permits: {}", semaphore.availablePermits());

      CompletableFuture<BulkResponse> future;
      try {
        future = asyncClient.bulk(b -> b.operations(operations));
      } catch (IOException e) {
        handleBulkFailure(operations, entityErrorList, e);
        semaphore.release();
        latch.countDown();
        return;
      }

      future.whenComplete(
          (response, error) -> {
            try {
              if (error != null) {
                handleBulkFailure(operations, entityErrorList, error);
              } else {
                handleBulkResponse(response, operations, entityErrorList);
              }
            } finally {
              semaphore.release();
              latch.countDown();
              LOG.debug("Semaphore released. Available permits: {}", semaphore.availablePermits());
            }
          });
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Bulk request interrupted", e);
      latch.countDown();
      throw new SearchIndexException(createIndexingError(operations.size(), e));
    }
  }

  private void handleBulkResponse(
      BulkResponse response, List<BulkOperation> operations, List<EntityError> entityErrorList) {
    synchronized (entityErrorList) {
      List<BulkResponseItem> items = response.items();
      for (int i = 0; i < items.size(); i++) {
        BulkResponseItem itemResponse = items.get(i);
        if (itemResponse.error() != null) {
          String failureMessage = itemResponse.error().reason();
          String entityData = operations.get(i).toString();
          entityErrorList.add(new EntityError().withMessage(failureMessage).withEntity(entityData));
          LOG.warn("Bulk item failed: {}", failureMessage);
        }
      }
    }

    int success = response.items().size();
    int failed = 0;
    for (BulkResponseItem item : response.items()) {
      if (item.error() != null) {
        failed++;
      }
    }
    success -= failed;
    updateStats(success, failed);

    if (response.errors()) {
      LOG.warn("Bulk request completed with failures. Total Failures: {}", failed);
    } else {
      LOG.debug("Bulk request successful with {} operations.", success);
    }
  }

  private void handleBulkFailure(
      List<BulkOperation> operations, List<EntityError> entityErrorList, Throwable error) {
    LOG.error("Bulk request failed asynchronously", error);
    synchronized (entityErrorList) {
      for (BulkOperation operation : operations) {
        entityErrorList.add(
            new EntityError()
                .withMessage(String.format("Bulk request failed: %s", error.getMessage()))
                .withEntity(operation.toString()));
      }
    }
    updateStats(0, operations.size());
  }

  private long estimateOperationSize(BulkOperation operation) {
    try {
      StringWriter writer = new StringWriter();
      JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
      operation.serialize(generator, JACKSON_JSONP_MAPPER);
      generator.close();
      return writer.toString().getBytes(StandardCharsets.UTF_8).length;
    } catch (Exception e) {
      LOG.warn("Failed to estimate bulk operation size, using default: {}", e.getMessage());
      return 1024;
    }
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

  private BulkOperation convertEntityToRequest(Object entity, String entityType) {
    if (entity instanceof EntityInterface) {
      return getEntityInterfaceOperation(entityType, (EntityInterface) entity);
    } else if (entity instanceof EntityTimeSeriesInterface) {
      return getEntityTimeSeriesInterfaceOperation(entityType, (EntityTimeSeriesInterface) entity);
    } else {
      throw new IllegalArgumentException("Unknown entity type: " + entity.getClass());
    }
  }

  private BulkOperation getEntityInterfaceOperation(String entityType, EntityInterface entity) {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    String indexName = indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    String jsonDoc =
        JsonUtils.pojoToJson(Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc());

    return BulkOperation.of(
        op ->
            op.update(
                upd ->
                    upd.index(indexName)
                        .id(entity.getId().toString())
                        .document(OsUtils.toJsonData(jsonDoc))
                        .docAsUpsert(true)));
  }

  private BulkOperation getEntityTimeSeriesInterfaceOperation(
      String entityType, EntityTimeSeriesInterface entity) {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    String indexName = indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    String jsonDoc =
        JsonUtils.pojoToJson(Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc());

    return BulkOperation.of(
        op ->
            op.update(
                upd ->
                    upd.index(indexName)
                        .id(entity.getId().toString())
                        .document(OsUtils.toJsonData(jsonDoc))
                        .docAsUpsert(true)));
  }

  private IndexingError createIndexingError(int requestCount, Exception e) {
    return new IndexingError()
        .withErrorSource(SINK)
        .withSubmittedCount(requestCount)
        .withSuccessCount(0)
        .withFailedCount(requestCount)
        .withMessage(String.format("Issue in Sink to OpenSearch: %s", e.getMessage()))
        .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
  }
}
