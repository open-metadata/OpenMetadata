package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import es.co.elastic.clients.elasticsearch.core.BulkRequest;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import es.co.elastic.clients.util.ObjectBuilder;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.indexes.SearchIndex;

class ElasticSearchIndexSinkTest {

  private static final String ENTITY_TYPE = "table";

  private ElasticSearchClient searchClient;
  private SearchRepository searchRepository;
  private IndexMapping indexMapping;

  @BeforeEach
  void setUp() {
    searchClient = mock(ElasticSearchClient.class);
    searchRepository = mock(SearchRepository.class);
    indexMapping = mock(IndexMapping.class);

    es.co.elastic.clients.elasticsearch.ElasticsearchClient apiClient =
        mock(es.co.elastic.clients.elasticsearch.ElasticsearchClient.class, RETURNS_DEEP_STUBS);
    when(searchClient.getNewClient()).thenReturn(apiClient);
    when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("cluster");
    when(indexMapping.getIndexName("cluster")).thenReturn("table_search_index");
  }

  @Test
  void writeDoesNotSendEmptyOverflowBatchAndCountsEntitySuccessOnce() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<ElasticsearchAsyncClient> asyncConstruction =
            mockConstruction(ElasticsearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchIndexSink sink = new ElasticSearchIndexSink(searchClient, 1, 1, 3, 10, 50);
      ElasticsearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = successResponse(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, entity, Map.of("field", "value".repeat(32)));

      sink.write(List.of(entity), Map.of("entityType", ENTITY_TYPE));

      verify(asyncClient, times(1)).bulk(anyBulkRequestBuilder());
      assertEquals(1, sink.getStats().getSuccessRecords());
      assertEquals(0, sink.getStats().getFailedRecords());
    }
  }

  @Test
  void writeHandlesTimeSeriesEntitiesWithoutDoubleCounting() throws Exception {
    EntityTimeSeriesInterface entity = mock(EntityTimeSeriesInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<ElasticsearchAsyncClient> asyncConstruction =
            mockConstruction(ElasticsearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchIndexSink sink = new ElasticSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      ElasticsearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = successResponse(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, entity, Map.of("ts", 42));

      sink.write(List.of(entity), Map.of("entityType", ENTITY_TYPE));

      assertEquals(1, sink.getStats().getSuccessRecords());
      assertEquals(0, sink.getStats().getFailedRecords());
    }
  }

  @Test
  void writeTracksBulkItemFailuresWithoutDoubleCountingStats() {
    EntityInterface firstEntity = mock(EntityInterface.class);
    EntityInterface secondEntity = mock(EntityInterface.class);
    when(firstEntity.getId()).thenReturn(UUID.randomUUID());
    when(secondEntity.getId()).thenReturn(UUID.randomUUID());

    try (MockedConstruction<ElasticsearchAsyncClient> asyncConstruction =
            mockConstruction(ElasticsearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchIndexSink sink = new ElasticSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      ElasticsearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = partialFailureResponse();
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, firstEntity, Map.of("field", "first"));
      stubSearchIndexDoc(entityMock, secondEntity, Map.of("field", "second"));

      SearchIndexException exception =
          assertThrows(
              SearchIndexException.class,
              () ->
                  sink.write(
                      List.of(firstEntity, secondEntity), Map.of("entityType", ENTITY_TYPE)));

      assertNotNull(exception.getIndexingError());
      assertEquals(1, exception.getIndexingError().getSuccessCount());
      assertEquals(1, exception.getIndexingError().getFailedCount());
      assertEquals(1, sink.getStats().getSuccessRecords());
      assertEquals(1, sink.getStats().getFailedRecords());
    }
  }

  @Test
  void writeTracksConversionFailuresWithoutDoubleCountingBulkResults() {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());

    try (MockedConstruction<ElasticsearchAsyncClient> asyncConstruction =
            mockConstruction(ElasticsearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchIndexSink sink = new ElasticSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      ElasticsearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = successResponse(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, entity, Map.of("field", "value"));

      SearchIndexException exception =
          assertThrows(
              SearchIndexException.class,
              () -> sink.write(List.of(entity, new Object()), Map.of("entityType", ENTITY_TYPE)));

      assertNotNull(exception.getIndexingError());
      assertEquals(1, exception.getIndexingError().getSuccessCount());
      assertEquals(1, exception.getIndexingError().getFailedCount());
      assertEquals(1, sink.getStats().getSuccessRecords());
      assertEquals(1, sink.getStats().getFailedRecords());
    }
  }

  @Test
  void writeThrowsWhenInterruptedWhileWaitingForPendingBulkResponses() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());

    try (MockedConstruction<ElasticsearchAsyncClient> asyncConstruction =
            mockConstruction(ElasticsearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchIndexSink sink = new ElasticSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      ElasticsearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      CompletableFuture<BulkResponse> pending = new CompletableFuture<>();
      CountDownLatch bulkStarted = new CountDownLatch(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenAnswer(
              invocation -> {
                bulkStarted.countDown();
                return pending;
              });

      stubSearchIndexDoc(entityMock, entity, Map.of("field", "value"));

      Thread currentThread = Thread.currentThread();
      Thread interrupter =
          Thread.ofPlatform()
              .start(
                  () -> {
                    try {
                      bulkStarted.await();
                      Thread.sleep(100);
                      currentThread.interrupt();
                    } catch (InterruptedException ignored) {
                      Thread.currentThread().interrupt();
                    }
                  });

      try {
        SearchIndexException exception =
            assertThrows(
                SearchIndexException.class,
                () -> sink.write(List.of(entity), Map.of("entityType", ENTITY_TYPE)));

        assertNotNull(exception.getIndexingError());
        assertEquals(1, exception.getIndexingError().getFailedCount());
      } finally {
        Thread.interrupted();
        pending.complete(successResponse(1));
        interrupter.join(1_000);
      }
    }
  }

  @Test
  void closeDelegatesToSearchClient() {
    try (MockedConstruction<ElasticsearchAsyncClient> asyncConstruction =
        mockConstruction(ElasticsearchAsyncClient.class)) {
      ElasticSearchIndexSink sink = new ElasticSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      assertFalse(asyncConstruction.constructed().isEmpty());

      sink.close();

      verify(searchClient).close();
    }
  }

  private void stubSearchIndexDoc(
      MockedStatic<Entity> entityMock, Object entity, Map<String, Object> doc) {
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
    SearchIndex searchIndex = new StubSearchIndex(doc);
    entityMock.when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity)).thenReturn(searchIndex);
  }

  private BulkResponse successResponse(int itemCount) {
    BulkResponse response = mock(BulkResponse.class);
    List<BulkResponseItem> items =
        java.util.stream.IntStream.range(0, itemCount)
            .mapToObj(
                i -> {
                  BulkResponseItem item = mock(BulkResponseItem.class);
                  when(item.error()).thenReturn(null);
                  return item;
                })
            .toList();
    when(response.items()).thenReturn(items);
    when(response.errors()).thenReturn(false);
    return response;
  }

  private BulkResponse partialFailureResponse() {
    BulkResponse response = mock(BulkResponse.class);
    BulkResponseItem successItem = mock(BulkResponseItem.class);
    BulkResponseItem failedItem = mock(BulkResponseItem.class);
    es.co.elastic.clients.elasticsearch._types.ErrorCause errorCause =
        mock(es.co.elastic.clients.elasticsearch._types.ErrorCause.class);

    when(successItem.error()).thenReturn(null);
    when(failedItem.error()).thenReturn(errorCause);
    when(errorCause.reason()).thenReturn("mapping rejected");
    when(response.items()).thenReturn(List.of(successItem, failedItem));
    when(response.errors()).thenReturn(true);
    return response;
  }

  private static class StubSearchIndex implements SearchIndex {
    private final Map<String, Object> doc;

    private StubSearchIndex(Map<String, Object> doc) {
      this.doc = doc;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc() {
      return doc;
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return doc;
    }
  }

  @SuppressWarnings("unchecked")
  private Function<BulkRequest.Builder, ObjectBuilder<BulkRequest>> anyBulkRequestBuilder() {
    return any();
  }
}
