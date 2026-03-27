package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

class OpenSearchBulkSinkBehaviorTest {

  private static final String ENTITY_TYPE = "table";

  private SearchRepository searchRepository;
  private OpenSearchClient searchClient;
  private IndexMapping indexMapping;

  @BeforeEach
  void setUp() {
    searchRepository = mock(SearchRepository.class);
    searchClient = mock(OpenSearchClient.class);
    indexMapping = mock(IndexMapping.class);

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("cluster");
    when(indexMapping.getIndexName("cluster")).thenReturn("table_index");
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);
  }

  @Test
  void writeReturnsEarlyForEmptyEntitiesAndRejectsMissingEntityType() throws Exception {
    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      sink.write(
          List.of(), Map.of(BulkSink.STATS_TRACKER_CONTEXT_KEY, mock(StageStatsTracker.class)));

      assertThrows(
          IllegalArgumentException.class,
          () -> sink.write(List.of(mock(EntityInterface.class)), Map.of()));
      verify(processorConstruction.constructed().getFirst(), never())
          .add(any(), any(), any(), any(), anyLong());
    }
  }

  @Test
  void writeSkipsWhenIndexMappingMissingAndExtractsTrackersSafely() throws Exception {
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(null);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      sink.write(
          List.of(mock(EntityInterface.class)),
          Map.of("entityType", ENTITY_TYPE, BulkSink.STATS_TRACKER_CONTEXT_KEY, tracker));

      assertSame(tracker, sink.extractTracker(Map.of(BulkSink.STATS_TRACKER_CONTEXT_KEY, tracker)));
      assertNull(sink.extractTracker(Map.of(BulkSink.STATS_TRACKER_CONTEXT_KEY, "not-a-tracker")));
      assertNull(sink.extractTracker(null));
      verify(processorConstruction.constructed().getFirst(), never())
          .add(any(), any(), any(), any(), anyLong());
    }
  }

  @Test
  void addEntityRecordsSuccessAndProcessStats() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      SearchIndex searchIndex = new StubSearchIndex(Map.of("field", "value"));
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock.when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity)).thenReturn(searchIndex);

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {
            EntityInterface.class,
            String.class,
            boolean.class,
            ReindexContext.class,
            StageStatsTracker.class,
            boolean.class,
            Map.class
          },
          entity,
          "table_index",
          false,
          null,
          tracker,
          false,
          Collections.emptyMap());

      verify(processor)
          .add(any(), eq(entityId.toString()), eq(ENTITY_TYPE), eq(tracker), anyLong());
      verify(tracker).incrementPendingSink();
      verify(tracker).recordProcess(StatsResult.SUCCESS);
      assertEquals(1, sink.getProcessStats().getSuccessRecords());
      assertEquals(0, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void addEntityRecordsEntityNotFoundFailuresAndInvokesCallback() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);
    when(entity.getFullyQualifiedName()).thenReturn("table.fqn");

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      sink.setFailureCallback(failureCallback);

      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenThrow(EntityNotFoundException.byId(entityId.toString()));

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {
            EntityInterface.class,
            String.class,
            boolean.class,
            ReindexContext.class,
            StageStatsTracker.class,
            boolean.class,
            Map.class
          },
          entity,
          "table_index",
          true,
          null,
          tracker,
          false,
          Collections.emptyMap());

      verify(processorConstruction.constructed().getFirst()).setFailureCallback(failureCallback);
      verify(tracker).recordProcess(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              ENTITY_TYPE,
              entityId.toString(),
              "table.fqn",
              "Entity with id [" + entityId + "] not found.",
              IndexingFailureRecorder.FailureStage.PROCESS);
      assertEquals(1, sink.getStats().getFailedRecords());
      assertEquals(1, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void addTimeSeriesEntityRecordsSuccessAndGenericFailures() throws Exception {
    EntityTimeSeriesInterface successEntity = mock(EntityTimeSeriesInterface.class);
    EntityTimeSeriesInterface failedEntity = mock(EntityTimeSeriesInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
    UUID successId = UUID.randomUUID();
    UUID failedId = UUID.randomUUID();
    when(successEntity.getId()).thenReturn(successId);
    when(failedEntity.getId()).thenReturn(failedId);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      sink.setFailureCallback(failureCallback);

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      SearchIndex searchIndex = new StubSearchIndex(Map.of("field", "value"));
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, successEntity))
          .thenReturn(searchIndex);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, failedEntity))
          .thenThrow(new IllegalStateException("boom"));

      invokePrivate(
          sink,
          "addTimeSeriesEntity",
          new Class<?>[] {
            EntityTimeSeriesInterface.class, String.class, String.class, StageStatsTracker.class
          },
          successEntity,
          "table_index",
          ENTITY_TYPE,
          tracker);
      invokePrivate(
          sink,
          "addTimeSeriesEntity",
          new Class<?>[] {
            EntityTimeSeriesInterface.class, String.class, String.class, StageStatsTracker.class
          },
          failedEntity,
          "table_index",
          ENTITY_TYPE,
          tracker);

      verify(processor)
          .add(any(), eq(successId.toString()), eq(ENTITY_TYPE), eq(tracker), anyLong());
      verify(tracker).incrementPendingSink();
      verify(tracker).recordProcess(StatsResult.SUCCESS);
      verify(tracker).recordProcess(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              ENTITY_TYPE,
              failedId.toString(),
              null,
              "boom",
              IndexingFailureRecorder.FailureStage.PROCESS);
      assertEquals(1, sink.getProcessStats().getSuccessRecords());
      assertEquals(1, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void flushAndCloseDelegateToProcessorAndPreserveInterrupts() throws Exception {
    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      OpenSearchBulkSink.CustomBulkProcessor columnProcessor =
          processorConstruction.constructed().get(1);

      setAtomicField(sink, "totalSubmitted", 3);
      setAtomicField(sink, "totalSuccess", 2);
      setAtomicField(sink, "totalFailed", 1);
      setAtomicField(sink, "processSuccess", 4);
      setAtomicField(sink, "processFailed", 2);

      when(processor.flushAndWait(5, TimeUnit.SECONDS)).thenReturn(true);
      when(columnProcessor.flushAndWait(anyLong(), eq(TimeUnit.SECONDS))).thenReturn(true);
      when(processor.awaitClose(60, TimeUnit.SECONDS)).thenReturn(true);
      when(columnProcessor.awaitClose(30, TimeUnit.SECONDS)).thenReturn(true);

      assertTrue(sink.flushAndAwait(5));
      sink.close();

      verify(processor).flushAndWait(5, TimeUnit.SECONDS);
      verify(columnProcessor).flushAndWait(anyLong(), eq(TimeUnit.SECONDS));
      verify(processor).flush();
      verify(columnProcessor).flush();
      verify(processor).awaitClose(60, TimeUnit.SECONDS);
      verify(columnProcessor).awaitClose(30, TimeUnit.SECONDS);
      assertEquals(3, sink.getStats().getTotalRecords());
      assertEquals(2, sink.getStats().getSuccessRecords());
      assertEquals(1, sink.getStats().getFailedRecords());
      assertEquals(6, sink.getProcessStats().getTotalRecords());

      when(processor.flushAndWait(7, TimeUnit.SECONDS)).thenThrow(new InterruptedException("stop"));
      assertFalse(sink.flushAndAwait(7));
      assertTrue(Thread.currentThread().isInterrupted());
      Thread.interrupted();
    }
  }

  @Test
  void settersUpdateConfigurationAndForwardCallbacks() {
    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);

      sink.updateBatchSize(25);
      sink.updateConcurrentRequests(4);
      sink.setFailureCallback(failureCallback);
      sink.setStatsCallback(statsCallback);

      assertEquals(25, sink.getBatchSize());
      assertEquals(4, sink.getConcurrentRequests());
      verify(processor).setFailureCallback(failureCallback);
      verify(processor).setStatsCallback(statsCallback);
    }
  }

  private void invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    method.invoke(target, args);
  }

  private void setAtomicField(Object target, String fieldName, long value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    Object current = field.get(target);
    if (current instanceof AtomicLong atomicLong) {
      atomicLong.set(value);
    } else if (current instanceof java.util.concurrent.atomic.AtomicInteger atomicInteger) {
      atomicInteger.set((int) value);
    } else {
      throw new IllegalStateException("Unsupported atomic field " + fieldName);
    }
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
}
