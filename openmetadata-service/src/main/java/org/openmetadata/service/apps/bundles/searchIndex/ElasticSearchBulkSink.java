package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import es.org.elasticsearch.action.bulk.BackoffPolicy;
import es.org.elasticsearch.action.bulk.BulkProcessor;
import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.action.index.IndexRequest;
import es.org.elasticsearch.action.update.UpdateRequest;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.common.unit.ByteSizeUnit;
import es.org.elasticsearch.common.unit.ByteSizeValue;
import es.org.elasticsearch.core.TimeValue;
import es.org.elasticsearch.xcontent.XContentType;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;

/**
 * Elasticsearch implementation using native BulkProcessor
 */
@Slf4j
public class ElasticSearchBulkSink implements BulkSink {

  private final ElasticSearchClient searchClient;
  private final SearchRepository searchRepository;
  private final BulkProcessor bulkProcessor;
  private final StepStats stats = new StepStats();

  // Track metrics
  private final AtomicLong totalSubmitted = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);

  // Configuration
  private volatile int batchSize;
  private volatile int maxConcurrentRequests;
  private final long maxPayloadSizeBytes;

  public ElasticSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (ElasticSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxPayloadSizeBytes = maxPayloadSizeBytes;

    // Initialize stats
    stats.withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);

    // Create bulk processor
    this.bulkProcessor = createBulkProcessor();
  }

  private BulkProcessor createBulkProcessor() {
    RestHighLevelClient client = (RestHighLevelClient) searchClient.getClient();

    return BulkProcessor.builder(
            (request, bulkListener) ->
                client.bulkAsync(request, RequestOptions.DEFAULT, bulkListener),
            new BulkProcessor.Listener() {
              @Override
              public void beforeBulk(long executionId, BulkRequest request) {
                int numberOfActions = request.numberOfActions();
                totalSubmitted.addAndGet(numberOfActions);
                LOG.debug(
                    "Executing bulk request {} with {} actions", executionId, numberOfActions);
              }

              @Override
              public void afterBulk(long executionId, BulkRequest request, BulkResponse response) {
                int numberOfActions = request.numberOfActions();

                if (response.hasFailures()) {
                  int failures = 0;
                  for (var item : response.getItems()) {
                    if (item.isFailed()) {
                      failures++;
                      LOG.warn("Failed to index document: {}", item.getFailureMessage());
                    }
                  }
                  int successes = numberOfActions - failures;
                  totalSuccess.addAndGet(successes);
                  totalFailed.addAndGet(failures);

                  LOG.warn(
                      "Bulk request {} completed with {} failures out of {} actions",
                      executionId,
                      failures,
                      numberOfActions);

                  // Check for rejected execution exceptions
                  String failureMessage = response.buildFailureMessage();
                  if (failureMessage.contains("rejected_execution_exception")) {
                    handleBackpressure();
                  }
                } else {
                  totalSuccess.addAndGet(numberOfActions);
                  LOG.debug(
                      "Bulk request {} completed successfully with {} actions",
                      executionId,
                      numberOfActions);
                }

                updateStats();
              }

              @Override
              public void afterBulk(long executionId, BulkRequest request, Throwable failure) {
                int numberOfActions = request.numberOfActions();
                totalFailed.addAndGet(numberOfActions);

                LOG.error(
                    "Bulk request {} failed completely with {} actions",
                    executionId,
                    numberOfActions,
                    failure);

                if (failure.getMessage() != null
                    && failure.getMessage().contains("rejected_execution_exception")) {
                  handleBackpressure();
                }

                updateStats();
              }
            })
        .setBulkActions(batchSize)
        .setBulkSize(new ByteSizeValue(maxPayloadSizeBytes, ByteSizeUnit.BYTES))
        .setFlushInterval(TimeValue.timeValueSeconds(5))
        .setConcurrentRequests(maxConcurrentRequests)
        .setBackoffPolicy(BackoffPolicy.exponentialBackoff(TimeValue.timeValueMillis(100), 3))
        .build();
  }

  @Override
  @SuppressWarnings("unchecked")
  public void write(List<?> entities, Map<String, Object> contextData) throws Exception {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (entityType == null) {
      throw new IllegalArgumentException("Entity type is required in context data");
    }

    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    String indexName = indexMapping.getIndexName();

    try {
      // Check if these are time series entities
      if (!entities.isEmpty() && entities.get(0) instanceof EntityTimeSeriesInterface) {
        List<EntityTimeSeriesInterface> tsEntities = (List<EntityTimeSeriesInterface>) entities;
        for (EntityTimeSeriesInterface entity : tsEntities) {
          addTimeSeriesEntity(entity, indexName);
        }
      } else {
        List<EntityInterface> entityInterfaces = (List<EntityInterface>) entities;
        for (EntityInterface entity : entityInterfaces) {
          addEntity(entity, indexName);
        }
      }

      // The bulk processor handles batching and flushing automatically
      // We don't need to explicitly flush here

    } catch (Exception e) {
      LOG.error("Failed to write {} entities of type {}", entities.size(), entityType, e);

      // Create an IndexingError for compatibility
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.SINK)
              .withSubmittedCount(entities.size())
              .withSuccessCount(0)
              .withFailedCount(entities.size())
              .withMessage(e.getMessage());

      throw new SearchIndexException(error);
    }
  }

  private void addEntity(EntityInterface entity, String indexName) throws Exception {
    // Build the search index document using the proper transformation
    String entityType = Entity.getEntityTypeFromObject(entity);
    Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
    String json = JsonUtils.pojoToJson(searchIndexDoc);

    UpdateRequest updateRequest = new UpdateRequest(indexName, entity.getId().toString());
    updateRequest.doc(json, XContentType.JSON);
    updateRequest.docAsUpsert(true);

    bulkProcessor.add(updateRequest);
  }

  private void addTimeSeriesEntity(EntityTimeSeriesInterface entity, String indexName)
      throws Exception {
    String json = JsonUtils.pojoToJson(entity);
    String docId = entity.getId().toString();

    IndexRequest indexRequest =
        new IndexRequest(indexName).id(docId).source(json, XContentType.JSON);

    bulkProcessor.add(indexRequest);
  }

  private void handleBackpressure() {
    // Reduce batch size on backpressure
    int newBatchSize = Math.max(50, batchSize / 2);
    if (newBatchSize < batchSize) {
      LOG.warn("Detected backpressure, reducing batch size from {} to {}", batchSize, newBatchSize);
      batchSize = newBatchSize;

      // Note: We can't update the existing bulk processor's batch size
      // It would require recreating the processor
    }
  }

  private void updateStats() {
    stats.setTotalRecords((int) totalSubmitted.get());
    stats.setSuccessRecords((int) totalSuccess.get());
    stats.setFailedRecords((int) totalFailed.get());
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    // Stats are updated automatically by the bulk processor
    // This method is here for interface compatibility
  }

  @Override
  public StepStats getStats() {
    return new StepStats()
        .withTotalRecords(stats.getTotalRecords())
        .withSuccessRecords(stats.getSuccessRecords())
        .withFailedRecords(stats.getFailedRecords());
  }

  @Override
  public void close() throws IOException {
    try {
      // Flush any pending requests
      bulkProcessor.flush();

      // Wait for completion
      boolean terminated = bulkProcessor.awaitClose(60, TimeUnit.SECONDS);
      if (!terminated) {
        LOG.warn("Bulk processor did not terminate within timeout");
      }
    } catch (InterruptedException e) {
      LOG.warn("Interrupted while closing bulk processor", e);
      Thread.currentThread().interrupt();
    }
  }

  /**
   * Update batch size dynamically
   */
  public void updateBatchSize(int newBatchSize) {
    this.batchSize = newBatchSize;
    // Note: The existing bulk processor will continue with old settings
    // New settings would apply if we recreate the processor
  }

  /**
   * Update concurrent requests dynamically
   */
  public void updateConcurrentRequests(int concurrentRequests) {
    this.maxConcurrentRequests = concurrentRequests;
    // Note: The existing bulk processor will continue with old settings
    // New settings would apply if we recreate the processor
  }
}
