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

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.OpenSearchAsyncClient;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;
import os.org.opensearch.client.util.ObjectBuilder;

class OpenSearchIndexSinkTest {

  private static final String ENTITY_TYPE = "table";

  private OpenSearchClient searchClient;
  private SearchRepository searchRepository;
  private IndexMapping indexMapping;

  @BeforeEach
  void setUp() {
    searchClient = mock(OpenSearchClient.class);
    searchRepository = mock(SearchRepository.class);
    indexMapping = mock(IndexMapping.class);

    os.org.opensearch.client.opensearch.OpenSearchClient apiClient =
        mock(os.org.opensearch.client.opensearch.OpenSearchClient.class, RETURNS_DEEP_STUBS);
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

    try (MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
            mockConstruction(OpenSearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchIndexSink sink = new OpenSearchIndexSink(searchClient, 1, 1, 3, 10, 50);
      OpenSearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = successResponse(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, entity, entityId, Map.of("field", "value".repeat(32)));

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

    try (MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
            mockConstruction(OpenSearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchIndexSink sink = new OpenSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      OpenSearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = successResponse(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, entity, entityId, Map.of("ts", 42));

      sink.write(List.of(entity), Map.of("entityType", ENTITY_TYPE));

      assertEquals(1, sink.getStats().getSuccessRecords());
      assertEquals(0, sink.getStats().getFailedRecords());
    }
  }

  @Test
  void writeTracksBulkItemFailuresWithoutDoubleCountingStats() throws Exception {
    EntityInterface firstEntity = mock(EntityInterface.class);
    EntityInterface secondEntity = mock(EntityInterface.class);
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    when(firstEntity.getId()).thenReturn(firstId);
    when(secondEntity.getId()).thenReturn(secondId);

    try (MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
            mockConstruction(OpenSearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchIndexSink sink = new OpenSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      OpenSearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = partialFailureResponse();
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, firstEntity, firstId, Map.of("field", "first"));
      stubSearchIndexDoc(entityMock, secondEntity, secondId, Map.of("field", "second"));

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
  void writeTracksConversionFailuresWithoutDoubleCountingBulkResults() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
            mockConstruction(OpenSearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchIndexSink sink = new OpenSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      OpenSearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      BulkResponse response = successResponse(1);
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenReturn(CompletableFuture.completedFuture(response));

      stubSearchIndexDoc(entityMock, entity, entityId, Map.of("field", "value"));

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
  void writeWrapsAsyncClientIoFailures() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
            mockConstruction(OpenSearchAsyncClient.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchIndexSink sink = new OpenSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      OpenSearchAsyncClient asyncClient = asyncConstruction.constructed().getFirst();
      when(asyncClient.bulk(anyBulkRequestBuilder()))
          .thenThrow(new IOException("bulk write failed"));

      stubSearchIndexDoc(entityMock, entity, entityId, Map.of("field", "value"));

      SearchIndexException exception =
          assertThrows(
              SearchIndexException.class,
              () -> sink.write(List.of(entity), Map.of("entityType", ENTITY_TYPE)));

      assertNotNull(exception.getIndexingError());
      assertEquals(IndexingError.ErrorSource.SINK, exception.getIndexingError().getErrorSource());
      assertEquals(1, exception.getIndexingError().getFailedCount());
      assertEquals(0, sink.getStats().getSuccessRecords());
      assertEquals(1, sink.getStats().getFailedRecords());
    }
  }

  @Test
  void closeDelegatesToSearchClient() {
    try (MockedConstruction<OpenSearchAsyncClient> asyncConstruction =
        mockConstruction(OpenSearchAsyncClient.class)) {
      OpenSearchIndexSink sink = new OpenSearchIndexSink(searchClient, 4096, 1, 3, 10, 50);
      assertFalse(asyncConstruction.constructed().isEmpty());

      sink.close();

      verify(searchClient).close();
    }
  }

  private void stubSearchIndexDoc(
      MockedStatic<Entity> entityMock, Object entity, UUID entityId, Map<String, Object> doc) {
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
    os.org.opensearch.client.opensearch._types.ErrorCause errorCause =
        mock(os.org.opensearch.client.opensearch._types.ErrorCause.class);

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
