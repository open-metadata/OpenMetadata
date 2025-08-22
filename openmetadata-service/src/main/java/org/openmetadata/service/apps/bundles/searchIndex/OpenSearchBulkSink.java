package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.action.bulk.BackoffPolicy;
import os.org.opensearch.action.bulk.BulkProcessor;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.bulk.BulkResponse;
import os.org.opensearch.action.index.IndexRequest;
import os.org.opensearch.action.update.UpdateRequest;
import os.org.opensearch.client.HttpAsyncResponseConsumerFactory;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.common.unit.ByteSizeUnit;
import os.org.opensearch.common.unit.ByteSizeValue;
import os.org.opensearch.common.unit.TimeValue;
import os.org.opensearch.common.xcontent.XContentType;

/**
 * OpenSearch implementation using native BulkProcessor
 */
@Slf4j
public class OpenSearchBulkSink implements BulkSink {

  private final OpenSearchClient searchClient;
  protected final SearchRepository searchRepository;
  private final BulkProcessor bulkProcessor;
  private final StepStats stats = new StepStats();

  // Track metrics
  private final AtomicLong totalSubmitted = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);

  // Configuration
  private volatile int batchSize;
  private volatile int maxConcurrentRequests;

  public OpenSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (OpenSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;

    // Initialize stats
    stats.withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);

    // Create bulk processor
    this.bulkProcessor = createBulkProcessor(batchSize, maxConcurrentRequests, maxPayloadSizeBytes);
  }

  private BulkProcessor createBulkProcessor(
      int bulkActions, int concurrentRequests, long maxPayloadSizeBytes) {
    RestHighLevelClient client = searchClient.getClient();

    // Create custom request options with larger buffer for big responses
    RequestOptions.Builder optionsBuilder = RequestOptions.DEFAULT.toBuilder();
    optionsBuilder.setHttpAsyncResponseConsumerFactory(
        new HttpAsyncResponseConsumerFactory.HeapBufferedResponseConsumerFactory(
            100 * 1024 * 1024)); // 100MB buffer

    RequestOptions requestOptions = optionsBuilder.build();

    LOG.info(
        "Creating BulkProcessor with batch size {}, {} concurrent requests, max payload {} MB",
        bulkActions,
        concurrentRequests,
        maxPayloadSizeBytes / (1024 * 1024));

    return BulkProcessor.builder(
            (request, bulkListener) -> client.bulkAsync(request, requestOptions, bulkListener),
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
                      String failureMessage = item.getFailureMessage();
                      // Log document_missing_exception differently as it indicates a race condition
                      if (failureMessage != null
                          && failureMessage.contains("document_missing_exception")) {
                        LOG.warn(
                            "Document missing error for {}: {} - This may occur during concurrent reindexing",
                            item.getId(),
                            failureMessage);
                      } else {
                        LOG.warn("Failed to index document {}: {}", item.getId(), failureMessage);
                      }
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
                    LOG.warn(
                        "Detected backpressure from OpenSearch cluster. The BulkProcessor will handle retry with exponential backoff.");
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
                  LOG.warn(
                      "Detected backpressure from OpenSearch cluster. The BulkProcessor will handle retry with exponential backoff.");
                }

                updateStats();
              }
            })
        .setBulkActions(bulkActions)
        .setBulkSize(new ByteSizeValue(maxPayloadSizeBytes, ByteSizeUnit.BYTES))
        .setFlushInterval(TimeValue.timeValueSeconds(5)) // Reduced from 10s for better throughput
        .setConcurrentRequests(concurrentRequests)
        .setBackoffPolicy(
            BackoffPolicy.exponentialBackoff(
                TimeValue.timeValueMillis(100), 3)) // Reduced from 1s to 100ms for faster retries
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

    Boolean recreateIndex = (Boolean) contextData.getOrDefault("recreateIndex", false);

    // Check if embeddings are enabled for this specific entity type
    boolean embeddingsEnabled = isVectorEmbeddingEnabledForEntity(entityType);

    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    if (indexMapping == null) {
      LOG.debug("No index mapping found for entityType '{}'. Skipping indexing.", entityType);
      return;
    }
    String indexName = indexMapping.getIndexName(searchRepository.getClusterAlias());

    try {
      // Check if these are time series entities
      if (!entities.isEmpty() && entities.getFirst() instanceof EntityTimeSeriesInterface) {
        List<EntityTimeSeriesInterface> tsEntities = (List<EntityTimeSeriesInterface>) entities;
        for (EntityTimeSeriesInterface entity : tsEntities) {
          addTimeSeriesEntity(entity, indexName, entityType);
        }
      } else {
        List<EntityInterface> entityInterfaces = (List<EntityInterface>) entities;
        for (EntityInterface entity : entityInterfaces) {
          addEntity(entity, indexName, recreateIndex, embeddingsEnabled);
        }
      }
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

  private void addEntity(
      EntityInterface entity, String indexName, boolean recreateIndex, boolean embeddingsEnabled) {
    // Build the search index document using the proper transformation
    String entityType = Entity.getEntityTypeFromObject(entity);
    Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
    String json = JsonUtils.pojoToJson(searchIndexDoc);

    if (recreateIndex) {
      // Use IndexRequest for fresh indexing to avoid document_missing_exception
      IndexRequest indexRequest =
          new IndexRequest(indexName).id(entity.getId().toString()).source(json, XContentType.JSON);
      bulkProcessor.add(indexRequest);
    } else {
      // Use UpdateRequest with upsert for regular updates
      UpdateRequest updateRequest = new UpdateRequest(indexName, entity.getId().toString());
      updateRequest.doc(json, XContentType.JSON);
      updateRequest.docAsUpsert(true);
      bulkProcessor.add(updateRequest);
    }

    // If embeddings are enabled, also index to vector_search_index
    if (embeddingsEnabled) {
      addEntityToVectorIndex(bulkProcessor, entity, recreateIndex);
    }
  }

  private void addTimeSeriesEntity(
      EntityTimeSeriesInterface entity, String indexName, String entityType) {
    Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
    String json = JsonUtils.pojoToJson(searchIndexDoc);
    String docId = entity.getId().toString();

    IndexRequest indexRequest =
        new IndexRequest(indexName).id(docId).source(json, XContentType.JSON);

    // Add to bulk processor - it handles everything including size limits
    bulkProcessor.add(indexRequest);
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
  public void close() {
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
   * Get current batch size
   */
  public int getBatchSize() {
    return batchSize;
  }

  /**
   * Get current concurrent requests
   */
  public int getConcurrentRequests() {
    return maxConcurrentRequests;
  }

  /**
   * Update batch size - Note: This only updates the value for future processor creation
   */
  public void updateBatchSize(int newBatchSize) {
    this.batchSize = newBatchSize;
    LOG.info("Batch size updated to: {}", newBatchSize);
  }

  /**
   * Update concurrent requests - Note: This only updates the value for future processor creation
   */
  public void updateConcurrentRequests(int concurrentRequests) {
    this.maxConcurrentRequests = concurrentRequests;
    LOG.info("Concurrent requests updated to: {}", concurrentRequests);
  }

  /**
   * Checks if vector embeddings are enabled for a specific entity type.
   * This combines SearchRepository capability check with job configuration.
   */
  protected boolean isVectorEmbeddingEnabledForEntity(String entityType) {
    return false;
  }

  /**
   * Adds entity to vector_search_index for embedding search.
   * This method will only be called when embeddings are enabled for the entity type.
   */
  protected void addEntityToVectorIndex(
      BulkProcessor bulkProcessor, EntityInterface entity, boolean recreateIndex) {}
}
