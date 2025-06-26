package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

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
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.util.JsonUtils;
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
  private final SearchRepository searchRepository;
  private volatile BulkProcessor bulkProcessor;
  private final StepStats stats = new StepStats();
  private volatile long currentPayloadSize = 0;

  // Track metrics
  private final AtomicLong totalSubmitted = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);

  // Configuration
  private volatile int batchSize;
  private volatile int maxConcurrentRequests;
  private final long maxPayloadSizeBytes;
  private volatile BulkProcessor currentBulkProcessor;
  private final long clusterMaxRequestSize;
  private final boolean compressionEnabled;

  public OpenSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (OpenSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxPayloadSizeBytes = maxPayloadSizeBytes;

    // Get the actual max request size and compression status from cluster settings
    Map<String, Object> clusterSettings = getClusterSettings();
    this.clusterMaxRequestSize = SearchClusterMetrics.extractMaxContentLength(clusterSettings);
    this.compressionEnabled = SearchClusterMetrics.isCompressionEnabled(clusterSettings);

    LOG.info(
        "OpenSearch cluster config - Max content length: {} MB, Compression enabled: {}",
        clusterMaxRequestSize / (1024 * 1024),
        compressionEnabled);

    // Initialize stats
    stats.withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);

    // Create bulk processor
    this.bulkProcessor = createBulkProcessor(batchSize, maxConcurrentRequests);
    this.currentBulkProcessor = this.bulkProcessor;
  }

  private BulkProcessor createBulkProcessor(int bulkActions, int concurrentRequests) {
    RestHighLevelClient client = searchClient.getClient();

    // Create custom request options with larger buffer for big responses
    RequestOptions.Builder optionsBuilder = RequestOptions.DEFAULT.toBuilder();
    optionsBuilder.setHttpAsyncResponseConsumerFactory(
        new HttpAsyncResponseConsumerFactory.HeapBufferedResponseConsumerFactory(
            100 * 1024 * 1024)); // 100MB buffer

    // Note: The Java client doesn't automatically compress requests.
    // Compression must be enabled at the HTTP client level (Apache HttpClient)
    // or by using a custom request interceptor

    RequestOptions requestOptions = optionsBuilder.build();

    LOG.info(
        "Creating BulkProcessor with batch size {} and {} concurrent requests",
        bulkActions,
        concurrentRequests);

    return BulkProcessor.builder(
            (request, bulkListener) -> client.bulkAsync(request, requestOptions, bulkListener),
            new BulkProcessor.Listener() {
              @Override
              public void beforeBulk(long executionId, BulkRequest request) {
                int numberOfActions = request.numberOfActions();
                totalSubmitted.addAndGet(numberOfActions);
                // Reset payload size counter after flush
                // Reset payload size when bulk operation starts
                currentPayloadSize = 0;
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
                    LOG.warn(
                        "Detected backpressure from OpenSearch cluster (rejected_execution_exception). The BulkProcessor will handle retry with exponential backoff.");
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
                      "Detected backpressure from OpenSearch cluster (rejected_execution_exception). The BulkProcessor will handle retry with exponential backoff.");
                }

                updateStats();
              }
            })
        .setBulkActions(bulkActions)
        // Ensure we never exceed OpenSearch's configured limit
        .setBulkSize(
            new ByteSizeValue(
                Math.min(maxPayloadSizeBytes, clusterMaxRequestSize), ByteSizeUnit.BYTES))
        .setFlushInterval(TimeValue.timeValueSeconds(10)) // Increased from 5s
        .setConcurrentRequests(concurrentRequests)
        .setBackoffPolicy(
            BackoffPolicy.exponentialBackoff(
                TimeValue.timeValueMillis(1000),
                3)) // More aggressive backoff: 1s initial, 3 retries
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
      if (!entities.isEmpty() && entities.getFirst() instanceof EntityTimeSeriesInterface) {
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

    // Add to bulk processor with size checking
    addRequestWithSizeCheck(updateRequest, json.getBytes().length);
  }

  private void addTimeSeriesEntity(EntityTimeSeriesInterface entity, String indexName)
      throws Exception {
    String json = JsonUtils.pojoToJson(entity);
    String docId = entity.getId().toString();

    IndexRequest indexRequest =
        new IndexRequest(indexName).id(docId).source(json, XContentType.JSON);

    // Add to bulk processor with size checking
    addRequestWithSizeCheck(indexRequest, json.getBytes().length);
  }

  /**
   * Adds a request to the bulk processor, checking payload size and flushing if needed.
   * This centralizes the logic for managing payload size limits.
   */
  private void addRequestWithSizeCheck(Object request, long uncompressedSize) {
    // Check if single document exceeds cluster limit
    if (uncompressedSize > clusterMaxRequestSize) {
      LOG.error(
          "Single document exceeds OpenSearch cluster limit: {} MB > {} MB. Document will be skipped.",
          uncompressedSize / (1024.0 * 1024.0),
          clusterMaxRequestSize / (1024.0 * 1024.0));
      totalFailed.incrementAndGet();
      updateStats();
      return; // Skip this document
    }

    // Calculate effective size based on whether compression is enabled
    long effectiveSize;
    if (compressionEnabled) {
      // Compression typically achieves 75% reduction for JSON (25% of original size)
      effectiveSize = uncompressedSize / 4;
      LOG.debug(
          "Using compressed size estimate: {} bytes (from {} uncompressed)",
          effectiveSize,
          uncompressedSize);
    } else {
      // Use uncompressed size when compression is disabled
      effectiveSize = uncompressedSize;
    }

    // Check if adding this request would exceed the payload size limit
    // Using volatile - approximate size is sufficient for flushing decisions
    long currentSize = currentPayloadSize;
    long effectiveLimit = Math.min(maxPayloadSizeBytes, clusterMaxRequestSize);

    if (currentSize > 0 && currentSize + effectiveSize > effectiveLimit) {
      LOG.info(
          "Payload size limit reached. Current: {} MB, Request: {} KB, Max: {} MB (cluster limit: {} MB)",
          currentSize / (1024.0 * 1024.0),
          uncompressedSize / 1024.0,
          effectiveLimit / (1024.0 * 1024.0),
          clusterMaxRequestSize / (1024.0 * 1024.0));

      // Flush and reset
      bulkProcessor.flush();
      currentPayloadSize = 0;
    }

    // Add the request (BulkProcessor is thread-safe)
    if (request instanceof UpdateRequest) {
      bulkProcessor.add((UpdateRequest) request);
    } else if (request instanceof IndexRequest) {
      bulkProcessor.add((IndexRequest) request);
    }

    // Update current payload size atomically
    currentPayloadSize = currentSize + effectiveSize;

    // Warn about large documents
    if (uncompressedSize > 1024 * 1024) {
      LOG.warn(
          "Large document detected: {} MB uncompressed{}",
          uncompressedSize / (1024.0 * 1024.0),
          compressionEnabled
              ? String.format(", ~%.2f MB compressed", effectiveSize / (1024.0 * 1024.0))
              : "");
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
      if (currentBulkProcessor != null) {
        currentBulkProcessor.flush();

        // Wait for completion
        boolean terminated = currentBulkProcessor.awaitClose(60, TimeUnit.SECONDS);
        if (!terminated) {
          LOG.warn("Bulk processor did not terminate within timeout");
        }
      }
    } catch (InterruptedException e) {
      LOG.warn("Interrupted while closing bulk processor", e);
      Thread.currentThread().interrupt();
    }
  }

  /**
   * Get the cluster settings
   */
  private Map<String, Object> getClusterSettings() {
    try {
      return searchClient.clusterSettings();
    } catch (Exception e) {
      LOG.warn("Failed to fetch cluster settings: {}", e.getMessage());
      return new HashMap<>();
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
   * The current BulkProcessor continues with its original settings to avoid deadlocks
   */
  public void updateBatchSize(int newBatchSize) {
    this.batchSize = newBatchSize;
    LOG.info(
        "Batch size updated to: {}. This will take effect when a new processor is created.",
        newBatchSize);
  }

  /**
   * Update concurrent requests - Note: This only updates the value for future processor creation
   * The current BulkProcessor continues with its original settings to avoid deadlocks
   */
  public void updateConcurrentRequests(int concurrentRequests) {
    this.maxConcurrentRequests = concurrentRequests;
    LOG.info(
        "Concurrent requests updated to: {}. This will take effect when a new processor is created.",
        concurrentRequests);
  }
}
