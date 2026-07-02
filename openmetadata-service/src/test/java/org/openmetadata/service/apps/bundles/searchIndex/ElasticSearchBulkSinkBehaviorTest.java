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
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.vector.OpenSearchVectorService;

class ElasticSearchBulkSinkBehaviorTest {

  private static final String ENTITY_TYPE = "table";

  private SearchRepository searchRepository;
  private ElasticSearchClient searchClient;
  private IndexMapping indexMapping;

  @BeforeEach
  void setUp() {
    searchRepository = mock(SearchRepository.class);
    searchClient = mock(ElasticSearchClient.class);
    indexMapping = mock(IndexMapping.class);

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("cluster");
    when(indexMapping.getIndexName("cluster")).thenReturn("table_index");
  }

  @Test
  void writeReturnsEarlyForEmptyEntitiesAndRejectsMissingEntityType() throws Exception {
    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);

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

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);

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

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
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
            Map.class,
            Map.class
          },
          entity,
          "table_index",
          false,
          null,
          tracker,
          false,
          Map.of(),
          Map.of());

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

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
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
            Map.class,
            Map.class
          },
          entity,
          "table_index",
          true,
          null,
          tracker,
          false,
          Map.of(),
          Map.of());

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

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
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
    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      ElasticSearchBulkSink.CustomBulkProcessor columnProcessor =
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
  void isVectorEmbeddingEnabledForEntityReturnsFalseWhenIndexMappingMissing() {
    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<org.openmetadata.service.search.vector.ElasticSearchVectorService>
            vectorServiceMock =
                mockStatic(
                    org.openmetadata.service.search.vector.ElasticSearchVectorService.class)) {
      vectorServiceMock
          .when(org.openmetadata.service.search.vector.ElasticSearchVectorService::getInstance)
          .thenReturn(
              mock(org.openmetadata.service.search.vector.ElasticSearchVectorService.class));
      when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);

      // table is vector-indexable AND has mapping → enabled
      assertTrue(sink.isVectorEmbeddingEnabledForEntity("table"));

      // mapping unloaded → disabled, even when everything else says yes
      when(searchRepository.getIndexMapping("table")).thenReturn(null);
      assertFalse(sink.isVectorEmbeddingEnabledForEntity("table"));
    }
  }

  @Test
  void fetchExistingFingerprintsRoutesToStagedIndexDuringRecreate() throws Exception {
    org.openmetadata.service.search.vector.ElasticSearchVectorService vectorService =
        mock(org.openmetadata.service.search.vector.ElasticSearchVectorService.class);
    when(vectorService.getExistingFingerprintsBatch(any(), any())).thenReturn(Map.of());

    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    org.openmetadata.schema.type.EntityReference ref =
        new org.openmetadata.schema.type.EntityReference().withType("table");
    when(entity.getEntityReference()).thenReturn(ref);

    org.openmetadata.service.search.ReindexContext reindexContext =
        mock(org.openmetadata.service.search.ReindexContext.class);
    when(reindexContext.getStagedIndex("table"))
        .thenReturn(java.util.Optional.of("table_search_index_rebuild_123"));

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<org.openmetadata.service.search.vector.ElasticSearchVectorService>
            vectorServiceMock =
                mockStatic(
                    org.openmetadata.service.search.vector.ElasticSearchVectorService.class)) {
      vectorServiceMock
          .when(org.openmetadata.service.search.vector.ElasticSearchVectorService::getInstance)
          .thenReturn(vectorService);

      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      Method method =
          ElasticSearchBulkSink.class.getDeclaredMethod(
              "fetchExistingFingerprints",
              List.class,
              String.class,
              org.openmetadata.service.search.ReindexContext.class);
      method.setAccessible(true);

      // With staged index → fingerprints fetched against staged index
      method.invoke(sink, List.of(entity), "table_search_index", reindexContext);
      verify(vectorService)
          .getExistingFingerprintsBatch(eq("table_search_index_rebuild_123"), any());

      // No reindex context → fall back to canonical index
      method.invoke(sink, List.of(entity), "table_search_index", null);
      verify(vectorService).getExistingFingerprintsBatch(eq("table_search_index"), any());

      // ReindexContext present but no staged index → fall back to canonical index
      org.openmetadata.service.search.ReindexContext emptyContext =
          mock(org.openmetadata.service.search.ReindexContext.class);
      when(emptyContext.getStagedIndex("table")).thenReturn(java.util.Optional.empty());
      method.invoke(sink, List.of(entity), "table_search_index", emptyContext);
      verify(vectorService, org.mockito.Mockito.times(2))
          .getExistingFingerprintsBatch(eq("table_search_index"), any());
    }
  }

  @Test
  void settersUpdateConfigurationAndForwardFailureCallbacks() {
    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class)) {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);

      sink.updateBatchSize(25);
      sink.updateConcurrentRequests(4);
      sink.setFailureCallback(failureCallback);

      assertEquals(25, sink.getBatchSize());
      assertEquals(4, sink.getConcurrentRequests());
      verify(processor).setFailureCallback(failureCallback);
    }
  }

  @Test
  void addEntityLooksUpEntityContextFromMap() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);
    List<EsLineageData> edges = List.of(new EsLineageData());
    DocBuildContext ctxForEntity = DocBuildContext.withUpstreamLineage(edges);
    Map<UUID, DocBuildContext> docBuildContexts = Map.of(entityId, ctxForEntity);

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      ContextCapturingIndex.reset();
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenReturn(new ContextCapturingIndex());

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {EntityInterface.class, String.class, StageStatsTracker.class, Map.class},
          entity,
          "table_index",
          null,
          docBuildContexts);

      assertSame(ctxForEntity, ContextCapturingIndex.observedContext);
      assertSame(edges, ContextCapturingIndex.observedContext.prefetchedUpstreamLineage());
    }
  }

  @Test
  void addEntityFallsBackToEmptyContextWhenEntityNotInMap() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      ContextCapturingIndex.reset();
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenReturn(new ContextCapturingIndex());

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {EntityInterface.class, String.class, StageStatsTracker.class, Map.class},
          entity,
          "table_index",
          null,
          Collections.emptyMap());

      assertSame(DocBuildContext.empty(), ContextCapturingIndex.observedContext);
    }
  }

  @Test
  void addEntityNeverTouchesVectorServiceBecauseElasticsearchHasNoEmbeddingPath() throws Exception {
    // Vector embedding is OpenSearch-only (SearchRepository: "Vector embedding is only supported
    // with OpenSearch. Elasticsearch support is planned."). The ES sink therefore has no
    // embedding-reuse path and needs no dimension guard. This test locks that invariant in: if ES
    // vector support is ever added, the sink will start consulting OpenSearchVectorService and this
    // test will fail — forcing the author to also add the embedding-dimension reuse guard that
    // OpenSearchBulkSink#canReuseCachedEmbedding applies.
    EntityInterface entity = mock(EntityInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OpenSearchVectorService> vectorServiceMock =
            mockStatic(OpenSearchVectorService.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenReturn(new StubSearchIndex(Map.of("field", "value")));

      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000L);
      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {EntityInterface.class, String.class, StageStatsTracker.class, Map.class},
          entity,
          "table_index",
          tracker,
          Collections.emptyMap());

      vectorServiceMock.verify(OpenSearchVectorService::getInstance, never());
      verify(tracker).recordProcess(StatsResult.SUCCESS);
      assertEquals(1, sink.getProcessStats().getSuccessRecords());
    }
  }

  private Object invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(target, args);
  }

  private void setAtomicField(Object target, String fieldName, long value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    ((AtomicLong) field.get(target)).set(value);
  }

  private static class StubSearchIndex implements SearchIndex {
    private final Map<String, Object> doc;

    private StubSearchIndex(Map<String, Object> doc) {
      this.doc = doc;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc(DocBuildContext ctx) {
      return doc;
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public String getEntityTypeName() {
      return "stub";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return doc;
    }
  }

  private static class ContextCapturingIndex implements SearchIndex {
    private static DocBuildContext observedContext;

    static void reset() {
      observedContext = null;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc(DocBuildContext ctx) {
      observedContext = ctx;
      return Map.of("field", "value");
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public String getEntityTypeName() {
      return "stub-ctx";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return esDoc;
    }
  }
}
