package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.OpenSearchAsyncClient;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;
import os.org.opensearch.client.util.ObjectBuilder;

class OpenSearchBulkProcessorTest {

  @Test
  void addReportsSuccessByEntityTypeAndCleansTrackingMaps() throws Exception {
    try (ProcessorHarness harness = newHarness(2, 1)) {
      StageStatsTracker tableTracker = mock(StageStatsTracker.class);
      StageStatsTracker pipelineTracker = mock(StageStatsTracker.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);

      harness.processor.setStatsCallback(statsCallback);
      BulkResponse response = successResponse();
      when(harness.asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      harness.processor.add(
          indexOperation("table_search_index", "doc-1"), "doc-1", "table", tableTracker, 1L);
      harness.processor.add(
          deleteOperation("pipeline_search_index_rebuild_123", "doc-2"),
          "doc-2",
          null,
          pipelineTracker,
          1L);

      assertEquals(2, harness.totalSubmitted.get());
      assertEquals(2, harness.totalSuccess.get());
      assertEquals(0, harness.totalFailed.get());
      assertEquals(1, harness.statsUpdates.get());
      verify(harness.circuitBreaker).recordSuccess();
      verify(tableTracker).recordSink(StatsResult.SUCCESS);
      verify(pipelineTracker).recordSink(StatsResult.SUCCESS);
      verify(statsCallback).onSuccess("table", 1);
      verify(statsCallback).onSuccess("pipeline", 1);
      assertTrue(getEntityTypeMap(harness.processor).isEmpty());
      assertTrue(getTrackerMap(harness.processor).isEmpty());
    }
  }

  @Test
  void addRecordsPartialFailuresWithPerTypeCallbacks() throws Exception {
    try (ProcessorHarness harness = newHarness(2, 1)) {
      StageStatsTracker tableTracker = mock(StageStatsTracker.class);
      StageStatsTracker dashboardTracker = mock(StageStatsTracker.class);
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);

      harness.processor.setFailureCallback(failureCallback);
      harness.processor.setStatsCallback(statsCallback);
      BulkResponse response =
          partialFailureResponse(
              "doc-1",
              "table_search_index",
              "doc-2",
              "dashboard_search_index_rebuild_9",
              "document_missing_exception: doc missing");
      when(harness.asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      harness.processor.add(
          indexOperation("table_search_index", "doc-1"), "doc-1", "table", tableTracker, 1L);
      harness.processor.add(
          deleteOperation("dashboard_search_index_rebuild_9", "doc-2"),
          "doc-2",
          null,
          dashboardTracker,
          1L);

      assertEquals(2, harness.totalSubmitted.get());
      assertEquals(1, harness.totalSuccess.get());
      assertEquals(1, harness.totalFailed.get());
      assertEquals(1, harness.statsUpdates.get());
      verify(harness.circuitBreaker).recordSuccess();
      verify(tableTracker).recordSink(StatsResult.SUCCESS);
      verify(dashboardTracker).recordSink(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              "dashboard",
              "doc-2",
              null,
              "document_missing_exception: doc missing",
              IndexingFailureRecorder.FailureStage.SINK);
      verify(statsCallback).onSuccess("table", 1);
      verify(statsCallback).onFailure("dashboard", 1);
      assertTrue(getEntityTypeMap(harness.processor).isEmpty());
      assertTrue(getTrackerMap(harness.processor).isEmpty());
    }
  }

  @Test
  void addFailsFastWhenCircuitBreakerIsOpenAndReportsDroppedRecords() throws Exception {
    try (ProcessorHarness harness = newHarness(2, 1)) {
      StageStatsTracker tableTracker = mock(StageStatsTracker.class);
      StageStatsTracker mlModelTracker = mock(StageStatsTracker.class);
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);

      when(harness.circuitBreaker.allowRequest()).thenReturn(false);
      when(harness.circuitBreaker.getState()).thenReturn(BulkCircuitBreaker.State.OPEN);
      harness.processor.setFailureCallback(failureCallback);
      harness.processor.setStatsCallback(statsCallback);

      harness.processor.add(
          indexOperation("table_search_index", "doc-1"), "doc-1", "table", tableTracker, 1L);
      harness.processor.add(
          deleteOperation("mlmodel_search_index_rebuild_12", "doc-2"),
          "doc-2",
          null,
          mlModelTracker,
          1L);

      assertEquals(2, harness.totalSubmitted.get());
      assertEquals(0, harness.totalSuccess.get());
      assertEquals(2, harness.totalFailed.get());
      assertEquals(1, harness.statsUpdates.get());
      verify(tableTracker).recordSink(StatsResult.FAILED);
      verify(mlModelTracker).recordSink(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              "table",
              "doc-1",
              null,
              "Circuit breaker OPEN",
              IndexingFailureRecorder.FailureStage.SINK);
      verify(failureCallback)
          .onFailure(
              "mlmodel",
              "doc-2",
              null,
              "Circuit breaker OPEN",
              IndexingFailureRecorder.FailureStage.SINK);
      verify(statsCallback).onFailure("table", 1);
      verify(statsCallback).onFailure("mlmodel", 1);
      verifyNoInteractions(harness.asyncClient);
      assertTrue(getEntityTypeMap(harness.processor).isEmpty());
      assertTrue(getTrackerMap(harness.processor).isEmpty());
    }
  }

  @Test
  void addTreatsSemaphoreInterruptAsPermanentFailure() throws Exception {
    try (ProcessorHarness harness = newHarness(1, 0)) {
      StageStatsTracker tracker = mock(StageStatsTracker.class);
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);

      harness.processor.setFailureCallback(failureCallback);
      harness.processor.setStatsCallback(statsCallback);

      Thread.currentThread().interrupt();
      try {
        harness.processor.add(
            indexOperation("table_search_index", "doc-1"), "doc-1", "table", tracker, 1L);
        assertTrue(Thread.currentThread().isInterrupted());
      } finally {
        Thread.interrupted();
      }

      assertEquals(1, harness.totalSubmitted.get());
      assertEquals(0, harness.totalSuccess.get());
      assertEquals(1, harness.totalFailed.get());
      assertEquals(1, harness.statsUpdates.get());
      verify(tracker).recordSink(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              "table",
              "doc-1",
              null,
              "Interrupted while waiting for semaphore",
              IndexingFailureRecorder.FailureStage.SINK);
      verify(statsCallback).onFailure("table", 1);
      verifyNoInteractions(harness.asyncClient);
      assertTrue(getEntityTypeMap(harness.processor).isEmpty());
      assertTrue(getTrackerMap(harness.processor).isEmpty());
    }
  }

  @Test
  void flushAndAwaitCloseTimeOutWhileBulkRequestsRemainActive() throws Exception {
    try (ProcessorHarness harness = newHarness(10, 1)) {
      getActiveBulkRequests(harness.processor).set(1);

      assertFalse(harness.processor.flushAndWait(150, TimeUnit.MILLISECONDS));

      getActiveBulkRequests(harness.processor).set(1);
      assertFalse(harness.processor.awaitClose(150, TimeUnit.MILLISECONDS));
      getActiveBulkRequests(harness.processor).set(0);
    }
  }

  @Test
  void handleBulkFailureRecordsPermanentFailuresForOperationsWithoutDocumentIds() throws Exception {
    try (ProcessorHarness harness = newHarness(1, 1)) {
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);
      harness.processor.setFailureCallback(failureCallback);
      harness.processor.setStatsCallback(statsCallback);

      Method method =
          OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
              "handleBulkFailure", List.class, long.class, int.class, int.class, Throwable.class);
      method.setAccessible(true);

      BulkOperation operation =
          BulkOperation.of(op -> op.delete(delete -> delete.index("table_search_index")));
      boolean retry =
          (boolean)
              method.invoke(
                  harness.processor,
                  List.of(operation),
                  99L,
                  1,
                  Integer.MAX_VALUE,
                  new IllegalStateException("boom"));

      assertFalse(retry);
      assertEquals(1, harness.totalFailed.get());
      assertEquals(1, harness.statsUpdates.get());
      verifyNoInteractions(failureCallback, statsCallback);
    }
  }

  private ProcessorHarness newHarness(int bulkActions, int concurrentRequests) {
    OpenSearchClient searchClient = mock(OpenSearchClient.class);
    os.org.opensearch.client.opensearch.OpenSearchClient restClient =
        mock(os.org.opensearch.client.opensearch.OpenSearchClient.class, RETURNS_DEEP_STUBS);
    when(searchClient.getNewClient()).thenReturn(restClient);

    BulkCircuitBreaker circuitBreaker = mock(BulkCircuitBreaker.class);
    when(circuitBreaker.allowRequest()).thenReturn(true);
    when(circuitBreaker.getState()).thenReturn(BulkCircuitBreaker.State.CLOSED);

    AtomicLong totalSubmitted = new AtomicLong();
    AtomicLong totalSuccess = new AtomicLong();
    AtomicLong totalFailed = new AtomicLong();
    AtomicInteger statsUpdates = new AtomicInteger();

    MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
        mockConstruction(OpenSearchAsyncClient.class);

    OpenSearchBulkSink.CustomBulkProcessor processor =
        new OpenSearchBulkSink.CustomBulkProcessor(
            searchClient,
            bulkActions,
            4096L,
            concurrentRequests,
            60_000L,
            5L,
            1,
            totalSubmitted,
            totalSuccess,
            totalFailed,
            statsUpdates::incrementAndGet,
            circuitBreaker);

    return new ProcessorHarness(
        processor,
        circuitBreaker,
        asyncConstruction,
        asyncConstruction.constructed().getFirst(),
        totalSubmitted,
        totalSuccess,
        totalFailed,
        statsUpdates);
  }

  private BulkOperation indexOperation(String indexName, String docId) {
    return BulkOperation.of(
        op -> op.index(index -> index.index(indexName).id(docId).document(Map.of("id", docId))));
  }

  private BulkOperation deleteOperation(String indexName, String docId) {
    return BulkOperation.of(op -> op.delete(delete -> delete.index(indexName).id(docId)));
  }

  private BulkResponse successResponse() {
    BulkResponse response = mock(BulkResponse.class);
    when(response.errors()).thenReturn(false);
    return response;
  }

  private BulkResponse partialFailureResponse(
      String successId,
      String successIndex,
      String failedId,
      String failedIndex,
      String failureReason) {
    BulkResponse response = mock(BulkResponse.class);
    BulkResponseItem successItem = mock(BulkResponseItem.class);
    BulkResponseItem failureItem = mock(BulkResponseItem.class);
    os.org.opensearch.client.opensearch._types.ErrorCause errorCause =
        mock(os.org.opensearch.client.opensearch._types.ErrorCause.class);

    when(successItem.id()).thenReturn(successId);
    when(successItem.index()).thenReturn(successIndex);
    when(successItem.error()).thenReturn(null);

    when(failureItem.id()).thenReturn(failedId);
    when(failureItem.index()).thenReturn(failedIndex);
    when(failureItem.error()).thenReturn(errorCause);
    when(errorCause.reason()).thenReturn(failureReason);

    when(response.errors()).thenReturn(true);
    when(response.items()).thenReturn(List.of(successItem, failureItem));
    return response;
  }

  @SuppressWarnings("unchecked")
  private Map<String, String> getEntityTypeMap(OpenSearchBulkSink.CustomBulkProcessor processor)
      throws Exception {
    Field field =
        OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredField("docIdToEntityType");
    field.setAccessible(true);
    return (Map<String, String>) field.get(processor);
  }

  @SuppressWarnings("unchecked")
  private Map<String, StageStatsTracker> getTrackerMap(
      OpenSearchBulkSink.CustomBulkProcessor processor) throws Exception {
    Field field = OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredField("docIdToTracker");
    field.setAccessible(true);
    return (Map<String, StageStatsTracker>) field.get(processor);
  }

  private AtomicInteger getActiveBulkRequests(OpenSearchBulkSink.CustomBulkProcessor processor)
      throws Exception {
    Field field =
        OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredField("activeBulkRequests");
    field.setAccessible(true);
    return (AtomicInteger) field.get(processor);
  }

  @SuppressWarnings("unchecked")
  private List<BulkOperation> getBuffer(OpenSearchBulkSink.CustomBulkProcessor processor)
      throws Exception {
    Field field = OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredField("buffer");
    field.setAccessible(true);
    return (List<BulkOperation>) field.get(processor);
  }

  private Function<BulkRequest.Builder, ObjectBuilder<BulkRequest>> anyBulkRequestBuilder() {
    return any();
  }

  private final class ProcessorHarness implements AutoCloseable {
    private final OpenSearchBulkSink.CustomBulkProcessor processor;
    private final BulkCircuitBreaker circuitBreaker;
    private final MockedConstruction<OpenSearchAsyncClient> asyncConstruction;
    private final OpenSearchAsyncClient asyncClient;
    private final AtomicLong totalSubmitted;
    private final AtomicLong totalSuccess;
    private final AtomicLong totalFailed;
    private final AtomicInteger statsUpdates;

    private ProcessorHarness(
        OpenSearchBulkSink.CustomBulkProcessor processor,
        BulkCircuitBreaker circuitBreaker,
        MockedConstruction<OpenSearchAsyncClient> asyncConstruction,
        OpenSearchAsyncClient asyncClient,
        AtomicLong totalSubmitted,
        AtomicLong totalSuccess,
        AtomicLong totalFailed,
        AtomicInteger statsUpdates) {
      this.processor = processor;
      this.circuitBreaker = circuitBreaker;
      this.asyncConstruction = asyncConstruction;
      this.asyncClient = asyncClient;
      this.totalSubmitted = totalSubmitted;
      this.totalSuccess = totalSuccess;
      this.totalFailed = totalFailed;
      this.statsUpdates = statsUpdates;
    }

    @Override
    public void close() throws Exception {
      getBuffer(processor).clear();
      getEntityTypeMap(processor).clear();
      getTrackerMap(processor).clear();
      getActiveBulkRequests(processor).set(0);
      processor.awaitClose(1, TimeUnit.SECONDS);
      asyncConstruction.close();
    }
  }
}
